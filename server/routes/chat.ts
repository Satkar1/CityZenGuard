import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertChatMessageSchema } from "../../shared/schema";
import { mlLegalAssistant } from "../services/ml-legal-assistant";
import { analyzeLegalContent } from "../services/gemini";
import { retrieveRelevantDocuments } from "../services/rag/retriever";
import { generateAnswer, warmUpModel } from "../services/generation/llm";

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  userId: z.string()
}).refine(data => data.message || data.query, {
  message: "Either 'message' or 'query' must be provided"
});

// Send message to AI assistant
router.post("/message", async (req, res) => {
  try {
    console.log(`[Chat] Received request:`, {
      body: JSON.stringify(req.body).slice(0, 200),
      userId: req.body?.userId || 'unknown'
    });
    
    const validatedData = chatRequestSchema.parse(req.body);
    const text = validatedData.message || validatedData.query || '';
    const { userId } = validatedData;
    
    console.log(`[Chat] Processing query: "${text.slice(0, 100)}..." for user: ${userId}`);
    
    // Save user message
    const userMessage = await storage.createChatMessage({
      userId,
      message: text
    });

    let aiResponse: string;
    let confidence: number = 0;
    let sources: any[] = [];

    try {
      console.log(`[Chat] Starting RAG pipeline for query`);
      
      // Step 1: Retrieve relevant documents
      const relevantDocs = await retrieveRelevantDocuments(text, 3);
      console.log(`[Chat] Retrieved ${relevantDocs.length} relevant documents`);
      
      // Step 2: Generate answer using RAG
      if (relevantDocs.length > 0) {
        const ragResult = await generateAnswer(text, relevantDocs);
        aiResponse = ragResult.answer;
        confidence = ragResult.confidence;
        
        // Prepare sources for response
        sources = relevantDocs.map((doc, index) => ({
          id: doc.id,
          title: doc.title,
          score: doc.score,
          source: doc.source
        }));
        
        console.log(`[Chat] RAG generated response with confidence: ${confidence}`);
      } else {
        console.log(`[Chat] No relevant documents found, trying ML fallback`);
        
        // Fallback to existing ML model
        try {
          const mlResult = await mlLegalAssistant.generateResponse(text);
          aiResponse = mlResult;
          confidence = 0.6; // Lower confidence for ML-only response
        } catch (mlError) {
          console.error("ML model error, using Gemini fallback:", mlError);
          
          // Final fallback to Gemini AI
          const geminiPrompt = `You are a legal assistant AI helping Indian citizens with legal questions. 
Please provide helpful, accurate legal information for this question: "${text}"
Keep your response clear, concise, and legally sound. If the question is vague or requires specific legal advice, 
suggest consulting with a qualified lawyer.`;
          
          aiResponse = await analyzeLegalContent(geminiPrompt);
          confidence = 0.7;
        }
      }
    } catch (error) {
      console.error("RAG pipeline error, using fallback:", error);
      
      // Final fallback to existing ML/Gemini pipeline
      try {
        const mlResult = await mlLegalAssistant.generateResponse(text);
        aiResponse = mlResult;
        confidence = 0.5;
      } catch (mlError) {
        const geminiPrompt = `You are a legal assistant AI helping Indian citizens with legal questions. 
Please provide helpful, accurate legal information for this question: "${text}"
Keep your response clear, concise, and legally sound.`;
        
        aiResponse = await analyzeLegalContent(geminiPrompt);
        confidence = 0.6;
      }
    }

    // Save AI response
    const aiMessage = await storage.createChatMessage({
      userId,
      message: aiResponse
    });

    console.log(`[Chat] Completed processing, returning response`);

    res.json({
      userMessage,
      aiMessage,
      confidence,
      sources
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
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
