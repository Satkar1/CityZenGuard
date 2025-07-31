import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { type User, type InsertUser, type Case, type InsertCase, type Fir, type InsertFir, type ChatMessage, type InsertChatMessage, type Notification, type InsertNotification, users, cases, firs, chatMessages, notifications } from "@shared/schema";
import { randomUUID } from "crypto";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Case methods
  getCasesByUserId(userId: string): Promise<Case[]>;
  createCase(caseData: InsertCase): Promise<Case>;
  
  // FIR methods
  getFirsByOfficerId(officerId: string): Promise<Fir[]>;
  createFir(fir: InsertFir): Promise<Fir>;
  updateFir(id: string, updates: Partial<Fir>): Promise<Fir | undefined>;
  
  // Chat methods
  getChatMessagesByUserId(userId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Notification methods
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Database error in getUser:", error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Database error in getUserByEmail:", error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getCasesByUserId(userId: string): Promise<Case[]> {
    return await db.select().from(cases).where(eq(cases.citizenId, userId));
  }

  async createCase(insertCase: InsertCase): Promise<Case> {
    const result = await db.insert(cases).values(insertCase).returning();
    return result[0];
  }

  async getFirsByOfficerId(officerId: string): Promise<Fir[]> {
    return await db.select().from(firs).where(eq(firs.officerId, officerId));
  }

  async createFir(insertFir: InsertFir): Promise<Fir> {
    const firNumber = `FIR/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}`;
    const result = await db.insert(firs).values({
      ...insertFir,
      firNumber,
    }).returning();
    return result[0];
  }

  async updateFir(id: string, updates: Partial<Fir>): Promise<Fir | undefined> {
    const result = await db.update(firs).set(updates).where(eq(firs.id, id)).returning();
    return result[0];
  }

  async getChatMessagesByUserId(userId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(insertMessage).returning();
    return result[0];
  }

  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(insertNotification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cases: Map<string, Case>;
  private firs: Map<string, Fir>;
  private chatMessages: Map<string, ChatMessage>;
  private notifications: Map<string, Notification>;

  constructor() {
    this.users = new Map();
    this.cases = new Map();
    this.firs = new Map();
    this.chatMessages = new Map();
    this.notifications = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  async getCasesByUserId(userId: string): Promise<Case[]> {
    return Array.from(this.cases.values()).filter(
      (caseItem) => caseItem.citizenId === userId,
    );
  }

  async createCase(insertCase: InsertCase): Promise<Case> {
    const id = randomUUID();
    const caseItem: Case = { 
      ...insertCase, 
      id, 
      createdAt: new Date(),
      filedDate: new Date()
    };
    this.cases.set(id, caseItem);
    return caseItem;
  }

  async getFirsByOfficerId(officerId: string): Promise<Fir[]> {
    return Array.from(this.firs.values()).filter(
      (fir) => fir.officerId === officerId,
    );
  }

  async createFir(insertFir: InsertFir): Promise<Fir> {
    const id = randomUUID();
    const firNumber = `FIR/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}`;
    const fir: Fir = { 
      ...insertFir, 
      id, 
      firNumber,
      createdAt: new Date(),
      submittedAt: null
    };
    this.firs.set(id, fir);
    return fir;
  }

  async updateFir(id: string, updates: Partial<Fir>): Promise<Fir | undefined> {
    const existingFir = this.firs.get(id);
    if (!existingFir) return undefined;
    
    const updatedFir = { ...existingFir, ...updates };
    this.firs.set(id, updatedFir);
    return updatedFir;
  }

  async getChatMessagesByUserId(userId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values()).filter(
      (message) => message.userId === userId,
    ).sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = { 
      ...insertMessage, 
      id, 
      response: null,
      isFromAI: false,
      createdAt: new Date() 
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId,
    ).sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = { 
      ...insertNotification, 
      id, 
      isRead: false,
      createdAt: new Date() 
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.isRead = true;
      this.notifications.set(id, notification);
    }
  }
}

// Use memory storage for development/demo purposes
console.log("Using in-memory storage for development");
export const storage = new MemStorage();
