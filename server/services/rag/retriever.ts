// server/services/rag/retriever.ts
import fs from "fs";
import path from "path";

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const HF_EMBED_MODEL = process.env.HUGGINGFACE_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
const RAG_DIR = path.join(__dirname, "..", "..", "rag"); // server/rag

if (!HF_TOKEN) {
  console.warn("HUGGINGFACE_API_TOKEN not set — retriever will fail if embeddings endpoint is called.");
}

type DocItem = {
  id: number;
  title: string;
  text: string;
  source?: string;
};

let docstore: Record<string, DocItem> = {};
let embeddings: number[][] = [];

/** Load docstore + embeddings.json at startup */
function loadIndex() {
  try {
    const docPath = path.join(RAG_DIR, "docstore.json");
    const embPath = path.join(RAG_DIR, "embeddings.json"); // JSON array of arrays
    if (fs.existsSync(docPath)) {
      docstore = JSON.parse(fs.readFileSync(docPath, "utf8"));
    } else {
      console.warn("docstore.json not found at", docPath);
    }

    if (fs.existsSync(embPath)) {
      embeddings = JSON.parse(fs.readFileSync(embPath, "utf8"));
    } else {
      console.warn("embeddings.json not found at", embPath);
    }
  } catch (err) {
    console.error("Failed to load RAG index files:", err);
  }
}

loadIndex();

/** call Hugging Face feature-extraction pipeline for embeddings */
async function getQueryEmbedding(queryText: string): Promise<number[] | null> {
  if (!HF_TOKEN) return null;

  const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_EMBED_MODEL}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: queryText }),
    });

    if (!res.ok) {
      console.error("HF embedding call failed", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    // HF returns [ [ ... ] ] for single input sometimes. Normalize:
    const emb = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : json;
    return emb as number[];
  } catch (err) {
    console.error("Error calling HF embeddings:", err);
    return null;
  }
}

/** cosine similarity */
function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(v: number[]) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}
function cosine(a: number[], b: number[]) {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

/** Find top-k documents by cosine similarity to query */
export async function retrieveTopK(queryText: string, topK = 3) {
  // If we don't have precomputed embeddings, fallback to simple keyword match
  if (!embeddings || embeddings.length === 0) {
    // basic keyword fallback
    const qwords = new Set(queryText.toLowerCase().match(/\w+/g) || []);
    const results: Array<{ id: number; score: number; title: string; text: string; source?: string }> = [];

    for (const key of Object.keys(docstore)) {
      const doc = docstore[key];
      const dwords = new Set((doc.text || "").toLowerCase().match(/\w+/g) || []);
      const inter = [...qwords].filter(x => dwords.has(x)).length;
      const union = new Set([...qwords, ...dwords]).size || 1;
      const score = inter / union;
      results.push({ id: parseInt(key, 10), score, title: doc.title, text: doc.text.slice(0, 800), source: doc.source });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  const qEmb = await getQueryEmbedding(queryText);
  if (!qEmb) {
    // fallback to basic keyword if HF embeddings fail
    console.warn("HF embeddings failed, using keyword fallback");
    const qwords = new Set(queryText.toLowerCase().match(/\w+/g) || []);
    const results: Array<{ id: number; score: number; title: string; text: string; source?: string }> = [];
    for (const key of Object.keys(docstore)) {
      const doc = docstore[key];
      const dwords = new Set((doc.text || "").toLowerCase().match(/\w+/g) || []);
      const inter = [...qwords].filter(x => dwords.has(x)).length;
      const union = new Set([...qwords, ...dwords]).size || 1;
      const score = inter / union;
      results.push({ id: parseInt(key, 10), score, title: doc.title, text: doc.text.slice(0, 800), source: doc.source });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // compute similarity against each stored embedding
  const scored: Array<{ id: number; score: number; title: string; text: string; source?: string }> = [];
  for (let i = 0; i < embeddings.length && i < Object.keys(docstore).length; i++) {
    const emb = embeddings[i];
    if (!emb) continue;
    const score = cosine(qEmb, emb);
    const doc = docstore[String(i)];
    if (doc) {
      scored.push({ id: i, score, title: doc.title, text: doc.text.slice(0, 800), source: doc.source });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
