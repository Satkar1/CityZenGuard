import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().$type<"citizen" | "police">(),
  fullName: text("full_name").notNull(),
  contactNumber: text("contact_number"),
  policeStationId: text("police_station_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: text("case_number").notNull().unique(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  description: text("description"),
  citizenId: text("citizen_id").notNull().references(() => users.id),
  court: text("court"),
  nextHearing: timestamp("next_hearing"),
  filedDate: timestamp("filed_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const firs = pgTable("firs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firNumber: text("fir_number").unique(),
  incidentType: text("incident_type").notNull(),
  location: text("location").notNull(),
  incidentDate: timestamp("incident_date").notNull(),
  incidentTime: text("incident_time").notNull(),
  description: text("description").notNull(),
  victimName: text("victim_name").notNull(),
  victimContact: text("victim_contact").notNull(),
  victimAddress: text("victim_address").notNull(),
  legalSections: jsonb("legal_sections").$type<string[]>(),
  additionalComments: text("additional_comments"),
  officerId: text("officer_id").notNull().references(() => users.id),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  response: text("response"),
  isFromAI: boolean("is_from_ai").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  filedDate: true,
});

export const insertFirSchema = createInsertSchema(firs).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
  firNumber: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  response: true,
  isFromAI: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

export type InsertFir = z.infer<typeof insertFirSchema>;
export type Fir = typeof firs.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
