import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import firsRoutes from "./routes/firs";
import casesRoutes from "./routes/cases";
import notificationsRoutes from "./routes/notifications";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all route modules
  app.use("/api/auth", authRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/firs", firsRoutes);
  app.use("/api/cases", casesRoutes);
  app.use("/api/notifications", notificationsRoutes);


  const httpServer = createServer(app);
  return httpServer;
}
