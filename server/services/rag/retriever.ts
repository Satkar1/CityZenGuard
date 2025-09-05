import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { loadDocstore, getDocumentsByIds, type Document } from './loader';

export interface RetrievalResult {
  id: number;
  score: number;
  title: string;
  text: string;
  source: string;
}

export interface RetrievedDocument extends Document {
  score: number;
}

// Fallback to basic similarity search when Python/FAISS unavailable
function fallbackTextSearch(query: string, topK: number = 3): RetrievedDocument[] {
  const docstore = loadDocstore();
  const documents = Object.values(docstore);
  
  if (documents.length === 0) {
    return [];
  }

  const queryWords = new Set(
    query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  );

  const scores = documents.map((doc, index) => {
    const docText = (doc.text + ' ' + doc.title).toLowerCase();
    const docWords = new Set(
      docText.replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
    );

    // Calculate Jaccard similarity
    const intersection = new Set([...queryWords].filter(word => docWords.has(word)));
    const union = new Set([...queryWords, ...docWords]);
    const jaccardScore = intersection.size / union.size;

    // Boost score for exact phrase matches
    let phraseBoost = 0;
    if (docText.includes(query.toLowerCase())) {
      phraseBoost = 0.3;
    }

    // Boost score for IPC sections if query mentions section
    let sectionBoost = 0;
    if (query.toLowerCase().includes('section') && doc.category === 'IPC') {
      sectionBoost = 0.2;
    }

    return {
      ...doc,
      score: jaccardScore + phraseBoost + sectionBoost,
      index
    };
  });

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(doc => doc.score > 0);
}

// Query using Python script with FAISS
function queryWithPython(query: string, topK: number = 3): Promise<RetrievedDocument[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = join(process.cwd(), 'scripts/rag/query.py');
    
    if (!existsSync(pythonScript)) {
      console.warn('Python query script not found, using fallback search');
      resolve(fallbackTextSearch(query, topK));
      return;
    }

    let output = '';
    let errorOutput = '';

    const pythonProcess = spawn('python3', [pythonScript, query, topK.toString()], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 8000
    });

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0 && output.trim()) {
        try {
          const results: RetrievalResult[] = JSON.parse(output);
          
          if (results.length > 0 && !results[0].hasOwnProperty('error')) {
            const documents: RetrievedDocument[] = results.map(result => ({
              id: result.id.toString(),
              text: result.text,
              title: result.title,
              source: result.source,
              score: result.score,
              category: 'Retrieved'
            }));
            resolve(documents);
          } else {
            console.warn('Python query returned error, using fallback');
            resolve(fallbackTextSearch(query, topK));
          }
        } catch (parseError) {
          console.warn('Failed to parse Python query results, using fallback:', parseError);
          resolve(fallbackTextSearch(query, topK));
        }
      } else {
        console.warn(`Python query failed (code: ${code}), using fallback. Error: ${errorOutput}`);
        resolve(fallbackTextSearch(query, topK));
      }
    });

    pythonProcess.on('error', (error) => {
      console.warn('Python process error, using fallback:', error.message);
      resolve(fallbackTextSearch(query, topK));
    });

    // Timeout fallback
    setTimeout(() => {
      pythonProcess.kill();
      console.warn('Python query timeout, using fallback');
      resolve(fallbackTextSearch(query, topK));
    }, 8000);
  });
}

export async function retrieveRelevantDocuments(
  query: string, 
  topK: number = 3
): Promise<RetrievedDocument[]> {
  try {
    // Sanitize query
    const sanitizedQuery = query.trim().slice(0, 1000); // Limit query length
    
    if (!sanitizedQuery) {
      return [];
    }

    console.log(`Retrieving documents for query: "${sanitizedQuery}" (top ${topK})`);
    
    const results = await queryWithPython(sanitizedQuery, topK);
    
    console.log(`Retrieved ${results.length} documents with scores:`, 
      results.map(r => ({ title: r.title, score: r.score })));
    
    return results;
  } catch (error) {
    console.error('Error in document retrieval:', error);
    return fallbackTextSearch(query, topK);
  }
}