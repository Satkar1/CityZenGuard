import { env, pipeline, type Pipeline } from '@xenova/transformers';
import type { RetrievedDocument } from '../rag/retriever';

// Configure transformers.js
env.allowLocalModels = false;
env.allowRemoteModels = true;

interface GenerationResponse {
  answer: string;
  confidence: number;
  error?: string;
}

let generatorPipeline: Pipeline | null = null;
let isLoading = false;

async function loadGenerator(): Promise<Pipeline | null> {
  if (generatorPipeline) {
    return generatorPipeline;
  }

  if (isLoading) {
    // Wait for loading to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return generatorPipeline;
  }

  try {
    isLoading = true;
    console.log('Loading text generation model...');
    
    // Use a smaller, faster model for better performance
    generatorPipeline = await pipeline(
      'text2text-generation', 
      'Xenova/flan-t5-small', 
      {
        device: 'cpu',
        dtype: 'fp32'
      }
    );
    
    console.log('Text generation model loaded successfully');
    return generatorPipeline;
  } catch (error) {
    console.error('Failed to load text generation model:', error);
    return null;
  } finally {
    isLoading = false;
  }
}

function buildPrompt(query: string, documents: RetrievedDocument[]): string {
  const context = documents
    .map((doc, index) => `[${index + 1}] ${doc.title}\n${doc.text}`)
    .join('\n\n');

  return `You are a legal assistant for Indian law. Answer the question based on the provided legal documents.

Context:
${context}

Question: ${query}

Instructions:
- Give a clear, accurate answer based on the provided legal documents
- Mention relevant IPC sections, procedures, or legal provisions
- If the information is not in the documents, say so clearly
- Keep the answer concise but comprehensive
- Use simple language that citizens can understand

Answer:`;
}

function fallbackResponse(query: string, documents: RetrievedDocument[]): GenerationResponse {
  // Simple rule-based fallback when model unavailable
  const queryLower = query.toLowerCase();
  
  // Check if documents contain relevant information
  if (documents.length === 0) {
    return {
      answer: "I don't have enough information to answer your question. Please try asking about specific IPC sections, FIR filing, bail procedures, or other legal topics covered in our knowledge base.",
      confidence: 0.3
    };
  }

  // Extract key information from documents
  const relevantDoc = documents[0];
  let answer = '';

  if (queryLower.includes('section') && relevantDoc.text.includes('Section')) {
    answer = `Based on the legal documents, here's what I found: ${relevantDoc.text.slice(0, 400)}...`;
  } else if (queryLower.includes('fir') || queryLower.includes('file')) {
    answer = `To file an FIR: ${relevantDoc.text.slice(0, 400)}...`;
  } else if (queryLower.includes('bail')) {
    answer = `Regarding bail procedures: ${relevantDoc.text.slice(0, 400)}...`;
  } else {
    answer = `Based on the legal information: ${relevantDoc.text.slice(0, 400)}...`;
  }

  return {
    answer: answer + '\n\n*This is a simplified response. For detailed legal advice, please consult a qualified lawyer.*',
    confidence: 0.6
  };
}

export async function generateAnswer(
  query: string, 
  documents: RetrievedDocument[]
): Promise<GenerationResponse> {
  try {
    const generator = await loadGenerator();
    
    if (!generator) {
      console.warn('Text generation model not available, using fallback');
      return fallbackResponse(query, documents);
    }

    const prompt = buildPrompt(query, documents);
    
    // Limit prompt length to prevent memory issues
    const maxPromptLength = 1000;
    const truncatedPrompt = prompt.length > maxPromptLength 
      ? prompt.slice(0, maxPromptLength) + '...\n\nAnswer:'
      : prompt;

    console.log('Generating answer with model...');
    
    const result = await generator(truncatedPrompt, {
      max_new_tokens: 200,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9
    }) as any;

    let answer = '';
    if (Array.isArray(result)) {
      answer = result[0]?.generated_text || '';
    } else if (result?.generated_text) {
      answer = result.generated_text;
    } else {
      throw new Error('Unexpected model response format');
    }

    // Clean up the answer
    answer = answer.replace(truncatedPrompt, '').trim();
    
    if (!answer) {
      return fallbackResponse(query, documents);
    }

    // Add disclaimer
    answer += '\n\n*Please note: This is general legal information. For specific legal advice, consult a qualified lawyer.*';

    return {
      answer,
      confidence: 0.8
    };

  } catch (error) {
    console.error('Error generating answer:', error);
    return fallbackResponse(query, documents);
  }
}

// Utility function to check if the model is ready
export function isModelReady(): boolean {
  return generatorPipeline !== null;
}

// Utility function to warm up the model
export async function warmUpModel(): Promise<void> {
  console.log('Warming up text generation model...');
  try {
    await loadGenerator();
    if (generatorPipeline) {
      // Generate a small test response to warm up the model
      await generatorPipeline('What is law? Answer:', {
        max_new_tokens: 10,
        temperature: 0.7
      });
      console.log('Model warmed up successfully');
    }
  } catch (error) {
    console.error('Error warming up model:', error);
  }
}