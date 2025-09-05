import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertFirSchema } from "../../shared/schema";
import { mlLegalAssistant } from "../services/ml-legal-assistant";

const router = Router();

const firPredictionSchema = z.object({
  incidentDescription: z.string().min(10),
  incidentType: z.string().min(1),
  location: z.string().min(1)
});

// Predict IPC sections based on incident description
router.post("/predict-sections", async (req, res) => {
  try {
    const { incidentDescription, incidentType, location } = firPredictionSchema.parse(req.body);
    
    // Create a legal query for section prediction
    const query = `What IPC sections apply to this incident: ${incidentDescription} of type ${incidentType} at ${location}`;
    
    let predictedSections: string[] = [];
    let confidence = 0;

    try {
      // Use ML model to predict sections
      const mlResult = await mlLegalAssistant.generateResponse(query);
      
      // Extract IPC sections from the response (simple regex matching)
      const sectionMatches = mlResult.match(/(\d{2,3}[A-Z]?)/g) || [];
      predictedSections = Array.from(new Set(sectionMatches)); // Remove duplicates
      confidence = 0.8;

      // If no sections found or low confidence, provide common sections based on incident type
      if (predictedSections.length === 0 || confidence < 0.6) {
        predictedSections = getCommonSections(incidentType);
        confidence = 0.7;
      }
    } catch (error) {
      console.error("IPC prediction error:", error);
      // Fallback to common sections
      predictedSections = getCommonSections(incidentType);
      confidence = 0.5;
    }

    res.json({
      predictedSections,
      confidence,
      suggestions: getSectionDescriptions(predictedSections)
    });
  } catch (error) {
    console.error("Section prediction error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Section prediction failed" });
  }
});

// Create a new FIR
router.post("/", async (req, res) => {
  try {
    const firData = insertFirSchema.parse(req.body);
    
    const fir = await storage.createFir(firData);
    
    res.status(201).json(fir);
  } catch (error) {
    console.error("FIR creation error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid FIR data", details: error.errors });
    }
    res.status(500).json({ error: "FIR creation failed" });
  }
});

// Get all FIRs for a police officer
router.get("/officer/:officerId", async (req, res) => {
  try {
    const { officerId } = req.params;
    const firs = await storage.getFirsByOfficerId(officerId);
    
    res.json(firs);
  } catch (error) {
    console.error("FIRs fetch error:", error);
    res.status(500).json({ error: "Failed to fetch FIRs" });
  }
});

// Get FIR by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const firs = await storage.getFirsByOfficerId(id); // Use existing method
    
    if (!firs || firs.length === 0) {
      return res.status(404).json({ error: "FIR not found" });
    }
    
    res.json(firs[0]); // Return first FIR for now
  } catch (error) {
    console.error("FIR fetch error:", error);
    res.status(500).json({ error: "Failed to fetch FIR" });
  }
});

// Update FIR status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = z.object({ status: z.string() }).parse(req.body);
    
    const updatedFir = await storage.updateFir(id, { status });
    
    if (!updatedFir) {
      return res.status(404).json({ error: "FIR not found" });
    }
    
    res.json(updatedFir);
  } catch (error) {
    console.error("FIR update error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid status data" });
    }
    res.status(500).json({ error: "FIR update failed" });
  }
});

// Generate FIR PDF
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const firs = await storage.getFirsByOfficerId(id);
    
    if (!firs || firs.length === 0) {
      return res.status(404).json({ error: "FIR not found" });
    }
    
    const fir = firs[0];
    
    // Generate a simple PDF placeholder response for now
    const pdfContent = `FIR Document\n\nFIR Number: ${fir.firNumber || `FIR-${fir.id}`}\nIncident: ${fir.incidentType}\nLocation: ${fir.location}\nDate: ${fir.incidentDate}`;
    const pdfBuffer = Buffer.from(pdfContent, 'utf-8');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FIR_${fir.firNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

// Helper function to get common IPC sections based on incident type
function getCommonSections(incidentType: string): string[] {
  const sectionMap: Record<string, string[]> = {
    'theft': ['378', '379', '380'],
    'assault': ['319', '320', '322', '324'],
    'murder': ['300', '302', '304'],
    'robbery': ['390', '392', '394'],
    'fraud': ['406', '420', '465'],
    'domestic_violence': ['498A', '323', '506'],
    'cybercrime': ['66', '66C', '66D'], // IT Act sections
    'property_damage': ['425', '426', '427'],
    'kidnapping': ['363', '365', '366'],
    'sexual_assault': ['354', '376', '509'],
    'default': ['156', '107', '149'] // General sections
  };
  
  return sectionMap[incidentType.toLowerCase()] || sectionMap.default;
}

// Helper function to get section descriptions
function getSectionDescriptions(sections: string[]): Array<{section: string, description: string}> {
  const descriptions: Record<string, string> = {
    '378': 'Theft - Dishonestly taking movable property',
    '379': 'Punishment for theft',
    '380': 'Theft in dwelling house',
    '319': 'Hurt - Causing bodily pain',
    '320': 'Grievous hurt',
    '322': 'Voluntarily causing hurt',
    '324': 'Voluntarily causing hurt by dangerous weapons',
    '300': 'Murder definition',
    '302': 'Punishment for murder',
    '304': 'Punishment for culpable homicide not amounting to murder',
    '390': 'Robbery definition',
    '392': 'Punishment for robbery',
    '394': 'Voluntarily causing hurt in committing robbery',
    '406': 'Punishment for criminal breach of trust',
    '420': 'Cheating and dishonestly inducing delivery of property',
    '465': 'Punishment for forgery',
    '498A': 'Husband or relative of husband subjecting woman to cruelty',
    '323': 'Punishment for voluntarily causing hurt',
    '506': 'Punishment for criminal intimidation',
    '66': 'Computer related offences (IT Act)',
    '66C': 'Identity theft (IT Act)',
    '66D': 'Cheating by personation using computer resource (IT Act)',
    '425': 'Mischief definition',
    '426': 'Punishment for mischief',
    '427': 'Mischief causing damage',
    '363': 'Punishment for kidnapping',
    '365': 'Kidnapping or abducting with intent to cause wrongful confinement',
    '366': 'Kidnapping, abducting or inducing woman to compel marriage',
    '354': 'Assault or criminal force to woman with intent to outrage modesty',
    '376': 'Punishment for rape',
    '509': 'Word, gesture or act intended to insult modesty of woman',
    '156': 'Police officer\'s power to investigate cognizable case',
    '107': 'Abetment of thing',
    '149': 'Every member of unlawful assembly guilty of offence'
  };
  
  return sections.map(section => ({
    section,
    description: descriptions[section] || 'Section description not available'
  }));
}

export default router;
