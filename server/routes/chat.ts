// server/routes/chat.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { retrieveTopK } from "../services/rag/retriever";
import { generateAnswer } from "../services/generation/llm";

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  userId: z.string()
});

router.post("/message", async (req, res) => {
  console.log("[Chat] Received request:", { body: req.body, userId: req.body?.userId });
  try {
    const parsed = chatRequestSchema.parse(req.body);
    const { message, query, userId } = parsed;
    const text = (message || query || "").trim();
    if (!text) return res.status(400).json({ error: "Missing message or query" });

    // Save user message
    const userMessage = await storage.createChatMessage({
      userId,
      message: text
    });

    console.log(`[Chat] Processing query: "${text}" for user: ${userId}`);
    const retrieved = await retrieveTopK(text, 3);
    console.log("[Chat] Retrieved docs:", retrieved.map(r => ({ id: r.id, score: r.score, title: r.title })));

    const contexts = retrieved.map(r => ({ title: r.title, text: r.text }));

    let aiResponse = "I couldn't find a good answer. Please consult a lawyer.";
    try {
      aiResponse = await generateAnswer(text, contexts);
    } catch (genErr) {
      console.error("Generation error", genErr);
      aiResponse = contexts.map(c => `${c.title} — ${c.text}`).join("\n\n");
    }

    const aiMessage = await storage.createChatMessage({
      userId,
      message: aiResponse
    });

    res.json({
      userMessage,
      aiMessage,
      confidence: 0.8,
      sources: retrieved.map(r => ({ id: r.id, title: r.title, score: r.score, source: r.source }))
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Chat processing failed" });
  }
});

export default router;
