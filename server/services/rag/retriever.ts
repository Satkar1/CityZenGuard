// server/services/rag/retriever.ts
import fs from "fs";
import path from "path";
import { pipeline } from "@xenova/transformers"; // ✅ local HF models in JS

// ✅ Resolve relative to project root
const RAG_DIR = path.join(process.cwd(), "server", "rag");

type DocItem = {
  id: number;
  title: string;
  text: string;
  source?: string;
};

let docstore: Record<string, DocItem> = {};
let embeddings: number[][] = [];

// ---------------- Load Index ----------------
function loadIndex() {
  try {
    const docstorePath = path.join(RAG_DIR, "docstore.json");
    const embeddingsPath = path.join(RAG_DIR, "embeddings.json");

    if (fs.existsSync(docstorePath)) {
      const raw = fs.readFileSync(docstorePath, "utf-8");
      docstore = JSON.parse(raw);
      console.log(`[RAG] Loaded docstore (${Object.keys(docstore).length} docs)`);
    } else {
      console.warn(`[RAG] docstore.json not found at ${docstorePath}`);
    }

    if (fs.existsSync(embeddingsPath)) {
      const rawEmb = fs.readFileSync(embeddingsPath, "utf-8");
      embeddings = JSON.parse(rawEmb);
      console.log(`[RAG] Loaded embeddings (${embeddings.length} vectors)`);
    } else {
      console.warn(`[RAG] embeddings.json not found at ${embeddingsPath}`);
    }
  } catch (err) {
    console.error("[RAG] Failed to load index:", err);
  }
}

loadIndex();

// ---------------- Cosine Similarity ----------------
function cosine(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------------- Local Query Embedding ----------------
let embedder: any = null;
const LOCAL_EMBED_MODEL =
  process.env.HUGGINGFACE_EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";

async function getQueryEmbedding(queryText: string): Promise<number[]> {
  if (!embedder) {
    console.log(`[RAG] Loading local embedder: ${LOCAL_EMBED_MODEL} ...`);
    embedder = await pipeline("feature-extraction", LOCAL_EMBED_MODEL);
  }
  const out = await embedder(queryText, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

// ---------------- Main Retrieval ----------------
export async function retrieveRelevantDocs(queryText: string, topK = 3) {
  if (!embeddings || embeddings.length === 0 || Object.keys(docstore).length === 0) {
    console.warn("[RAG] Empty index, returning empty results");
    return [];
  }

  let qEmb: number[];
  try {
    qEmb = await getQueryEmbedding(queryText);
  } catch (err) {
    console.warn("[RAG] Local embeddings failed, fallback to keyword search:", err);
    qEmb = [];
  }

  if (!qEmb || qEmb.length === 0) {
    // fallback keyword search
    const qwords = new Set(queryText.toLowerCase().match(/\w+/g) || []);
    const results: Array<{
      id: number;
      score: number;
      title: string;
      text: string;
      source?: string;
    }> = [];
    for (const key of Object.keys(docstore)) {
      const doc = docstore[key];
      const dwords = new Set((doc.text || "").toLowerCase().match(/\w+/g) || []);
      const inter = [...qwords].filter((x) => dwords.has(x)).length;
      const union = new Set([...qwords, ...dwords]).size || 1;
      const score = inter / union;
      results.push({
        id: parseInt(key, 10),
        score,
        title: doc.title,
        text: doc.text.slice(0, 800),
        source: doc.source,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  const scored: Array<{
    id: number;
    score: number;
    title: string;
    text: string;
    source?: string;
  }> = [];
  for (let i = 0; i < embeddings.length && i < Object.keys(docstore).length; i++) {
    const emb = embeddings[i];
    if (!emb) continue;
    const score = cosine(qEmb, emb as number[]);
    const doc = docstore[String(i)];
    if (doc) {
      scored.push({
        id: i,
        score,
        title: doc.title,
        text: doc.text.slice(0, 800),
        source: doc.source,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export const retrieveTopK = retrieveRelevantDocs;
