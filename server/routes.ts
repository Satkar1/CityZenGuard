import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authService } from "./services/auth";
import { firService } from "./services/fir";
import { analyzeLegalContent, suggestLegalSections } from "./services/gemini";
import { insertUserSchema, insertChatMessageSchema, insertFirSchema } from "../shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { fullName, email, password, role } = req.body;
      
      if (!fullName || !email || !password || !role) {
        return res.status(400).json({ error: "All fields are required" });
      }
      
      // Check if user already exists (with fallback handling)
      let existingUser;
      try {
        existingUser = await storage.getUserByEmail(email);
      } catch (dbError) {
        console.warn("Database error, using fallback:", dbError);
        // If database fails, create a new MemStorage instance for this request
        const memStorage = new (await import('./storage')).MemStorage();
        existingUser = await memStorage.getUserByEmail(email);
      }
      
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" });
      }
      
      const hashedPassword = await authService.hashPassword(password);
      const user = await storage.createUser({
        fullName,
        email,
        password: hashedPassword,
        role,
      });
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || !(await authService.verifyPassword(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const token = authService.generateToken(user.id);
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      res.status(400).json({ error: "Login failed" });
    }
  });

  // Middleware to verify JWT token
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    try {
      const userId = authService.verifyToken(token);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Invalid token" });
      }
      req.user = user;
      next();
    } catch (error) {
      return res.status(403).json({ error: "Invalid token" });
    }
  };

  // Chat routes
  app.get("/api/chat/messages", authenticateToken, async (req: any, res) => {
    try {
      const messages = await storage.getChatMessagesByUserId(req.user.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/chat/message", authenticateToken, async (req: any, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const userMessage = await storage.createChatMessage({
        ...messageData,
        userId: req.user.id,
      });

      // Generate AI response
      const aiResponse = await analyzeLegalContent(messageData.message);
      
      const aiMessage = await storage.createChatMessage({
        message: aiResponse,
        userId: req.user.id,
      });

      res.json({ userMessage, aiMessage });
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // FIR routes
  app.get("/api/firs", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "police") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const firs = await storage.getFirsByOfficerId(req.user.id);
      res.json(firs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch FIRs" });
    }
  });

  app.post("/api/firs", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "police") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const firData = insertFirSchema.parse(req.body);
      const fir = await storage.createFir({
        ...firData,
        officerId: req.user.id,
      });
      
      res.json(fir);
    } catch (error) {
      res.status(400).json({ error: "Failed to create FIR" });
    }
  });

  app.put("/api/firs/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "police") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { id } = req.params;
      const updates = req.body;
      
      const updatedFir = await storage.updateFir(id, updates);
      if (!updatedFir) {
        return res.status(404).json({ error: "FIR not found" });
      }
      
      res.json(updatedFir);
    } catch (error) {
      res.status(400).json({ error: "Failed to update FIR" });
    }
  });

  // AI legal sections suggestion
  app.post("/api/firs/suggest-sections", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "police") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { description, incidentType } = req.body;
      const sections = await suggestLegalSections(description, incidentType);
      
      res.json({ sections });
    } catch (error) {
      res.status(500).json({ error: "Failed to suggest legal sections" });
    }
  });

  // Cases routes
  app.get("/api/cases", authenticateToken, async (req: any, res) => {
    try {
      const cases = await storage.getCasesByUserId(req.user.id);
      res.json(cases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  // Notifications routes
  app.get("/api/notifications", authenticateToken, async (req: any, res) => {
    try {
      const notifications = await storage.getNotificationsByUserId(req.user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/read", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationAsRead(id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to mark notification as read" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
