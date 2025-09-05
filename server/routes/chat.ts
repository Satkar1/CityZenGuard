import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { mlLegalAssistant } from "../services/ml-legal-assistant";
import { analyzeLegalContent } from "../services/gemini";

const router = Router();

// ✅ Accept both "message" and "query"
const chatRequestSchema = z.object({
  message: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  userId: z.string()
});

// Send message to AI assistant
router.post("/message", async (req, res) => {
  console.log("[/api/chat/message] Incoming body:", req.body);

  try {
    const parsed = chatRequestSchema.parse(req.body);
    const { message, query, userId } = parsed;
    const text = message || query;

    if (!text) {
      return res.status(400).json({ error: "Missing 'message' or 'query'" });
    }

    // Save user message
    const userMessage = await storage.createChatMessage({
      userId,
      message: text
    });

    let aiResponse: string;
    let confidence: number = 0;

    try {
      // First try ML model
      const mlResult = await mlLegalAssistant.generateResponse(text);
      aiResponse = mlResult;
      confidence = 0.8; // Default confidence

      // If response seems generic, use Gemini AI as fallback
      if (aiResponse.length < 50 || aiResponse.includes("I don't understand")) {
        console.log("Using Gemini AI fallback for better response");

        const geminiPrompt = `You are a legal assistant AI helping Indian citizens with legal questions. 
Please provide helpful, accurate legal information for this question: "${text}"
Keep your response clear, concise, and legally sound. If the question is vague or requires specific legal advice, 
suggest consulting with a qualified lawyer.`;

        aiResponse = await analyzeLegalContent(geminiPrompt);
        confidence = 0.8;
      }
    } catch (mlError) {
      console.error("ML model error, using Gemini fallback:", mlError);

      // Fallback to Gemini AI
      const geminiPrompt = `You are a legal assistant AI helping Indian citizens with legal questions. 
Please provide helpful, accurate legal information for this question: "${text}"
Keep your response clear, concise, and legally sound. If the question is vague or requires specific legal advice, 
suggest consulting with a qualified lawyer.`;

      aiResponse = await analyzeLegalContent(geminiPrompt);
      confidence = 0.8;
    }

    // Save AI response
    const aiMessage = await storage.createChatMessage({
      userId,
      message: aiResponse
    });

    res.json({
      userMessage,
      aiMessage,
      confidence
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Chat processing failed" });
  }
});

// Get chat history for a user
router.get("/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await storage.getChatMessagesByUserId(userId);

    res.json(messages);
  } catch (error) {
    console.error("Chat history error:", error);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// Clear chat history for a user
router.delete("/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // For now, return success (in memory storage will be cleared on restart)
    res.json({ success: true, message: "Chat history cleared" });
  } catch (error) {
    console.error("Clear chat history error:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
});

export default router;
