
import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import StaffBranch from "./models/StaffBranch";

interface AppJwtPayload extends JwtPayload {
  id: number;
  role: string;
  branchId?: number | null;
}

interface SocketUser {
  id: number;
  role: string;
  branchId: number | null;
}

declare module "socket.io" {
  interface SocketData {
    user: SocketUser;
  }
}

let io: Server | null = null;

// Chỉ Admin được nhận sự kiện toàn hệ thống.
const GLOBAL_ROLES = ["admin"];

// Các vai trò nhân viên được tham gia room chi nhánh.
const STAFF_BRANCH_ROLES = [
  "branch_manager",
  "waiter",
  "kitchen",
  "cashier",
];

// Chỉ những vai trò này được nhận sự kiện đặt bàn.
const RESERVATION_ROLES = [
  "branch_manager",
  "waiter",
];

export const initSocket = (server: HttpServer): Server => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET chưa được cấu hình");
  }

  const configuredOrigins = process.env.CLIENT_URL
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins =
    configuredOrigins && configuredOrigins.length > 0
      ? configuredOrigins
      : ["http://localhost:5173", "http://localhost:5174"];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  /*
   * XÁC THỰC JWT VÀ PHÂN ROOM TRƯỚC KHI KẾT NỐI
   *
   * Việc tham gia room được hoàn thành trước next().
   * Như vậy Client không nhận trạng thái connected
   * khi quá trình phân room vẫn chưa hoàn tất.
   */
  io.use(async (socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;

      if (
        typeof authToken !== "string" ||
        !authToken.trim()
      ) {
        return next(new Error("SOCKET_UNAUTHORIZED"));
      }

      const token = authToken.startsWith("Bearer ")
        ? authToken.slice(7)
        : authToken;

      const decoded = jwt.verify(token, secret);

      if (
        typeof decoded !== "object" ||
        decoded === null
      ) {
        return next(new Error("SOCKET_INVALID_TOKEN"));
      }

      const payload = decoded as AppJwtPayload;

      if (
        !Number.isSafeInteger(payload.id) ||
        payload.id <= 0 ||
        typeof payload.role !== "string" ||
        !payload.role.trim()
      ) {
        return next(new Error("SOCKET_INVALID_USER"));
      }

      const branchId = payload.branchId ?? null;

      if (
        branchId !== null &&
        (
          !Number.isSafeInteger(branchId) ||
          branchId <= 0
        )
      ) {
        return next(new Error("SOCKET_INVALID_BRANCH"));
      }

      const user: SocketUser = {
        id: payload.id,
        role: payload.role,
        branchId,
      };

      socket.data.user = user;

      // Room riêng của người dùng.
      await socket.join(`user:${user.id}`);

      // ADMIN: nhận sự kiện toàn hệ thống.
      if (GLOBAL_ROLES.includes(user.role)) {
        await socket.join("role:global");
      }

      // CHAIN MANAGER:
      // Chỉ tham gia các chi nhánh được phân công
      // và đang hoạt động trong StaffBranch.
      else if (user.role === "chain_manager") {
        const assignments = await StaffBranch.findAll({
          where: {
            user_id: user.id,
            is_active: true,
          },
          attributes: ["branch_id"],
        });

        const branchIds = [
          ...new Set(
            assignments
              .map((item) => Number(item.branch_id))
              .filter(
                (id) =>
                  Number.isSafeInteger(id) &&
                  id > 0
              )
          ),
        ];

        for (const assignedBranchId of branchIds) {
          await socket.join(
            `branch:${assignedBranchId}`
          );

          await socket.join(
            `branch:${assignedBranchId}:reservations`
          );
        }
      }

      // NHÂN VIÊN CHI NHÁNH:
      // Chỉ những role hợp lệ mới được tham gia room.
      // branchId lấy từ JWT đã xác thực.
      else if (
        STAFF_BRANCH_ROLES.includes(user.role) &&
        user.branchId !== null
      ) {
        await socket.join(
          `branch:${user.branchId}`
        );

        if (
          RESERVATION_ROLES.includes(user.role)
        ) {
          await socket.join(
            `branch:${user.branchId}:reservations`
          );
        }
      }

      // Không có quyền join room nghiệp vụ:
      // user/customer chỉ giữ room riêng của mình.

      next();
    } catch (error: unknown) {
      console.error(
        "SOCKET AUTH / ROOM SETUP ERROR:",
        error
      );

      next(
        new Error("SOCKET_AUTH_OR_ROOM_SETUP_FAILED")
      );
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    console.log("SOCKET CONNECTED:", {
      socketId: socket.id,
      userId: user.id,
      role: user.role,
      branchId: user.branchId,
      rooms: [...socket.rooms].filter(
        (room) => room !== socket.id
      ),
    });
      console.log("SOCKET USER:", socket.data.user);
  console.log("SOCKET ROOMS:", [...socket.rooms]);

    socket.on("disconnect", (reason) => {
      console.log("SOCKET DISCONNECTED:", {
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        reason,
      });
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.IO chưa được khởi tạo");
  }

  return io;
};
