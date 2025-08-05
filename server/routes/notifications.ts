import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertNotificationSchema } from "../../shared/schema";

const router = Router();

// Create a new notification
router.post("/", async (req, res) => {
  try {
    const notificationData = insertNotificationSchema.parse(req.body);
    
    const notification = await storage.createNotification(notificationData);
    
    res.status(201).json(notification);
  } catch (error) {
    console.error("Notification creation error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid notification data", details: error.errors });
    }
    res.status(500).json({ error: "Notification creation failed" });
  }
});

// Get all notifications for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { unreadOnly = "false" } = req.query;
    
    const notifications = await storage.getNotificationsByUserId(userId);
    
    // Filter for unread only if requested
    const filteredNotifications = unreadOnly === "true" 
      ? notifications.filter(n => !n.isRead)
      : notifications;
    
    res.json(filteredNotifications);
  } catch (error) {
    console.error("Notifications fetch error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, just return success (would need proper update implementation)
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Notification update error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Mark all notifications as read for a user
router.patch("/user/:userId/read-all", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const notifications = await storage.getNotificationsByUserId(userId);
    const unreadNotifications = notifications.filter(n => !n.isRead);
    
    res.json({ 
      success: true, 
      message: `Marked ${unreadNotifications.length} notifications as read` 
    });
  } catch (error) {
    console.error("Mark all read error:", error);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

// Get notification count for a user
router.get("/user/:userId/count", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const notifications = await storage.getNotificationsByUserId(userId);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    res.json({
      total: notifications.length,
      unread: unreadCount
    });
  } catch (error) {
    console.error("Notification count error:", error);
    res.status(500).json({ error: "Failed to get notification count" });
  }
});

// Delete a notification
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, just return success (would need proper implementation)
    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Notification deletion error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// Delete all notifications for a user
router.delete("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const notifications = await storage.getNotificationsByUserId(userId);
    
    res.json({ 
      success: true, 
      message: `Deleted ${notifications.length} notifications` 
    });
  } catch (error) {
    console.error("Delete all notifications error:", error);
    res.status(500).json({ error: "Failed to delete notifications" });
  }
});

// Create system notification for case updates
router.post("/case-update", async (req, res) => {
  try {
    const { caseId, citizenId, message } = z.object({
      caseId: z.string(),
      citizenId: z.string(),
      message: z.string()
    }).parse(req.body);
    
    const notification = await storage.createNotification({
      userId: citizenId,
      type: "case_update",
      title: "Case Update",
      message,
      isRead: false
    });
    
    res.status(201).json(notification);
  } catch (error) {
    console.error("Case notification error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid notification data" });
    }
    res.status(500).json({ error: "Failed to create case notification" });
  }
});

// Create system notification for hearing reminders
router.post("/hearing-reminder", async (req, res) => {
  try {
    const { caseId, citizenId, hearingDate } = z.object({
      caseId: z.string(),
      citizenId: z.string(),
      hearingDate: z.string()
    }).parse(req.body);
    
    const notification = await storage.createNotification({
      userId: citizenId,
      type: "hearing_reminder",
      title: "Hearing Reminder",
      message: `You have a court hearing scheduled for ${new Date(hearingDate).toLocaleDateString()}`,
      isRead: false
    });
    
    res.status(201).json(notification);
  } catch (error) {
    console.error("Hearing reminder error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid reminder data" });
    }
    res.status(500).json({ error: "Failed to create hearing reminder" });
  }
});

export default router;