import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertCaseSchema } from "../../shared/schema";

const router = Router();

// Create a new case
router.post("/", async (req, res) => {
  try {
    const caseData = insertCaseSchema.parse(req.body);
    
    const newCase = await storage.createCase(caseData);
    
    res.status(201).json(newCase);
  } catch (error) {
    console.error("Case creation error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid case data", details: error.errors });
    }
    res.status(500).json({ error: "Case creation failed" });
  }
});

// Get all cases for a citizen
router.get("/citizen/:citizenId", async (req, res) => {
  try {
    const { citizenId } = req.params;
    const cases = await storage.getCasesByUserId(citizenId);
    
    res.json(cases);
  } catch (error) {
    console.error("Cases fetch error:", error);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

// Get case by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cases = await storage.getCasesByUserId(id);
    
    if (!cases || cases.length === 0) {
      return res.status(404).json({ error: "Case not found" });
    }
    
    res.json(cases[0]);
  } catch (error) {
    console.error("Case fetch error:", error);
    res.status(500).json({ error: "Failed to fetch case" });
  }
});

// Update case status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = z.object({ status: z.string() }).parse(req.body);
    
    // For now, just return success (would need proper update implementation)
    res.json({ success: true, message: "Case status updated" });
  } catch (error) {
    console.error("Case update error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid status data" });
    }
    res.status(500).json({ error: "Case update failed" });
  }
});

// Update case hearing date
router.patch("/:id/hearing", async (req, res) => {
  try {
    const { id } = req.params;
    const { hearingDate } = z.object({ 
      hearingDate: z.string().transform(str => new Date(str))
    }).parse(req.body);
    
    // For now, just return success (would need proper update implementation)
    res.json({ success: true, message: "Hearing date updated", hearingDate });
  } catch (error) {
    console.error("Case hearing update error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid hearing date data" });
    }
    res.status(500).json({ error: "Case hearing update failed" });
  }
});

// Get all cases (for admin/police dashboard)
router.get("/", async (req, res) => {
  try {
    // This would typically have pagination and filtering
    const { status, limit = "50", offset = "0" } = req.query;
    
    // For now, return empty array (would need proper implementation)
    const cases: any[] = [];
    
    // Filter by status if provided
    let filteredCases = cases;
    if (status && typeof status === 'string') {
      filteredCases = cases.filter((c: any) => c.status === status);
    }
    
    // Apply pagination
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    const paginatedCases = filteredCases.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      cases: paginatedCases,
      total: filteredCases.length,
      hasMore: offsetNum + limitNum < filteredCases.length
    });
  } catch (error) {
    console.error("Cases list error:", error);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

// Delete a case (soft delete by updating status)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, just return success (would need proper implementation)
    res.json({ success: true, message: "Case closed successfully" });
  } catch (error) {
    console.error("Case deletion error:", error);
    res.status(500).json({ error: "Failed to close case" });
  }
});

export default router;