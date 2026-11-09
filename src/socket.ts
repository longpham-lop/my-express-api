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

const GLOBAL_ROLES = ["admin"];

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

  // Xác thực JWT trước khi cho phép Socket kết nối
  io.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;

      if (typeof authToken !== "string" || !authToken.trim()) {
        return next(new Error("SOCKET_UNAUTHORIZED"));
      }

      const token = authToken.startsWith("Bearer ")
        ? authToken.slice(7)
        : authToken;

      const decoded = jwt.verify(token, secret);

      if (typeof decoded !== "object" || decoded === null) {
        return next(new Error("SOCKET_INVALID_TOKEN"));
      }

      const payload = decoded as AppJwtPayload;

      if (
        !Number.isInteger(payload.id) ||
        payload.id <= 0 ||
        typeof payload.role !== "string" ||
        !payload.role.trim()
      ) {
        return next(new Error("SOCKET_INVALID_USER"));
      }

      const branchId = payload.branchId ?? null;

      if (
        branchId !== null &&
        (!Number.isInteger(branchId) || branchId <= 0)
      ) {
        return next(new Error("SOCKET_INVALID_BRANCH"));
      }

      socket.data.user = {
        id: payload.id,
        role: payload.role,
        branchId,
      };

      next();
    } catch {
      next(new Error("SOCKET_UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
  const user = socket.data.user;

  const joinUserRooms = async (): Promise<void> => {
    // Room riêng cho người dùng.
    await socket.join(`user:${user.id}`);

    // Room riêng theo vai trò.
    await socket.join(`role:${user.role}`);

    // ADMIN: nhận sự kiện toàn hệ thống.
    if (GLOBAL_ROLES.includes(user.role)) {
      await socket.join("role:global");
    }

    // CHAIN MANAGER:
    // Chỉ tham gia room của những chi nhánh
    // được phân công và đang hoạt động.
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
              (id) => Number.isSafeInteger(id) && id > 0
            )
        ),
      ];

      for (const branchId of branchIds) {
        await socket.join(`branch:${branchId}`);

        await socket.join(
          `branch:${branchId}:reservations`
        );
      }
    }

    // NHÂN VIÊN CHI NHÁNH:
    // Lấy branchId từ JWT đã xác thực,
    // không nhận branchId tùy ý từ Client.
    else if (user.branchId !== null) {
      await socket.join(`branch:${user.branchId}`);

      if (
        user.role === "branch_manager" ||
        user.role === "waiter"
      ) {
        await socket.join(
          `branch:${user.branchId}:reservations`
        );
      }
    }
  };

  void joinUserRooms()
    .then(() => {
      console.log("SOCKET CONNECTED:", {
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        branchId: user.branchId,
      });
    })
    .catch((error: unknown) => {
      console.error("SOCKET ROOM JOIN ERROR:", error);

      // Không cho kết nối tiếp tục nếu không xác định
      // được phạm vi room hợp lệ.
      socket.disconnect(true);
    });

  socket.on("disconnect", (reason) => {
    console.log("SOCKET DISCONNECTED:", {
      socketId: socket.id,
      userId: user.id,
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
