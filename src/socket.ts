
import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";

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

const GLOBAL_ROLES = ["admin", "chain_manager"];

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

    // Room riêng cho từng người dùng
    socket.join(`user:${user.id}`);

    // Room riêng theo vai trò
    socket.join(`role:${user.role}`);

    // Room riêng theo chi nhánh
    
// Room riêng theo chi nhánh
    if (user.branchId !== null) {
      socket.join(`branch:${user.branchId}`);

      // Room riêng nhận thông báo đặt bàn
      // Chỉ Branch Manager và Waiter được tham gia
      if (
        user.role === "branch_manager" ||
        user.role === "waiter"
      ) {
        socket.join(
          `branch:${user.branchId}:reservations`
        );
      }
    }

    // Room dành cho quản trị toàn hệ thống
    if (GLOBAL_ROLES.includes(user.role)) {
      socket.join("role:global");
    }

    console.log("SOCKET CONNECTED:", {
      socketId: socket.id,
      userId: user.id,
      role: user.role,
      branchId: user.branchId,
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
