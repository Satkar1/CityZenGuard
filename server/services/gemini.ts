import { GoogleGenAI } from "@google/genai";

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "default_key" 
});

export async function analyzeLegalContent(query: string): Promise<string> {
  try {
    const systemPrompt = `You are an AI legal assistant for the Indian legal system. 
    Provide helpful, accurate legal information while being clear that you are not providing legal advice.
    Focus on:
    - Indian laws and procedures
    - Court processes and requirements
    - Legal rights and obligations
    - FIR filing procedures
    - Case status explanations
    
    Always remind users to consult with qualified legal professionals for specific legal advice.
    Be concise but comprehensive in your responses.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: query,
    });

    return response.text || "I apologize, but I'm unable to process your query at the moment. Please try again or consult with a legal professional for assistance.";
  } catch (error) {
    console.error("Error analyzing legal content:", error);
    return "I'm experiencing technical difficulties. Please try again later or contact a legal professional for immediate assistance.";
  }
}

export interface LegalSection {
  section: string;
  title: string;
  description: string;
  applicable: boolean;
}

export async function suggestLegalSections(description: string, incidentType: string): Promise<LegalSection[]> {
  try {
    const systemPrompt = `You are an AI assistant specialized in Indian Penal Code (IPC) and legal sections.
    Based on the incident description and type, suggest relevant IPC sections that may apply.
    
    Analyze the incident carefully and suggest the most appropriate legal sections.
    Consider factors like:
    - Nature of the crime
    - Severity of the incident
    - Applicable laws under IPC
    - Additional relevant acts if applicable
    
    Respond with JSON in this exact format:
    [
      {
        "section": "IPC Section XXX",
        "title": "Brief title of the section",
        "description": "Brief description of what this section covers",
        "applicable": true
      }
    ]`;

    const prompt = `Incident Type: ${incidentType}
    
    Incident Description: ${description}
    
    Please suggest relevant IPC sections for this incident.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              section: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              applicable: { type: "boolean" }
            },
            required: ["section", "title", "description", "applicable"]
          }
        }
      },
      contents: prompt,
    });

    const rawJson = response.text;
    
    if (rawJson) {
      const sections: LegalSection[] = JSON.parse(rawJson);
      return sections.filter(section => section.applicable);
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Error suggesting legal sections:", error);
    
    // Fallback suggestions based on incident type
    const fallbackSections: LegalSection[] = [];
    
    switch (incidentType.toLowerCase()) {
      case "theft":
        fallbackSections.push(
          {
            section: "IPC Section 378",
            title: "Theft",
            description: "Whoever, intending to take dishonestly any movable property out of the possession of any person...",
            applicable: true
          },
          {
            section: "IPC Section 379",
            title: "Punishment for theft",
            description: "Whoever commits theft shall be punished with imprisonment of either description...",
            applicable: true
          }
        );
        break;
        
      case "assault":
        fallbackSections.push(
          {
            section: "IPC Section 319",
            title: "Hurt",
            description: "Whoever causes bodily pain, disease or infirmity to any person is said to cause hurt",
            applicable: true
          },
          {
            section: "IPC Section 322",
            title: "Voluntarily causing grievous hurt",
            description: "Whoever voluntarily causes hurt, if the hurt which he intends to cause or knows himself to be likely to cause is grievous hurt...",
            applicable: true
          }
        );
        break;
        
      case "fraud":
        fallbackSections.push(
          {
            section: "IPC Section 420",
            title: "Cheating and dishonestly inducing delivery of property",
            description: "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property...",
            applicable: true
          },
          {
            section: "IPC Section 406",
            title: "Punishment for criminal breach of trust",
            description: "Whoever commits criminal breach of trust shall be punished with imprisonment...",
            applicable: true
          }
        );
        break;
        
      case "cybercrime":
        fallbackSections.push(
          {
            section: "IT Act Section 66",
            title: "Computer related offences",
            description: "If any person, dishonestly or fraudulently, does any act referred to in section 43...",
            applicable: true
          },
          {
            section: "IT Act Section 66C",
            title: "Identity theft",
            description: "Whoever, fraudulently or dishonestly make use of the electronic signature, password or any other unique identification feature...",
            applicable: true
          }
        );
        break;
        
      default:
        fallbackSections.push(
          {
            section: "IPC Section 149",
            title: "Every member of unlawful assembly guilty of offence committed in prosecution of common object",
            description: "If an offence is committed by any member of an unlawful assembly in prosecution of the common object...",
            applicable: true
          }
        );
    }
    
    return fallbackSections;
  }
}

export async function generateLegalSummary(firData: any): Promise<string> {
  try {
    const systemPrompt = `You are an AI assistant that generates professional legal summaries for FIR documents.
    Create a concise, formal summary based on the provided FIR data.
    The summary should be suitable for official legal documentation.`;

    const prompt = `Generate a professional legal summary for the following FIR:
    
    Incident Type: ${firData.incidentType}
    Location: ${firData.location}
    Date: ${firData.incidentDate}
    Time: ${firData.incidentTime}
    Description: ${firData.description}
    Victim: ${firData.victimName}
    Legal Sections: ${firData.legalSections?.join(', ') || 'To be determined'}
    
    Provide a formal legal summary in 2-3 paragraphs.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: prompt,
    });

    return response.text || "Summary generation failed. Please review the FIR details manually.";
  } catch (error) {
    console.error("Error generating legal summary:", error);
    return "Unable to generate summary at this time. Please review the FIR details manually.";
  }
}
