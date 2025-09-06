// server/services/rag/retriever.ts
import fs from "fs";
import path from "path";

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const HF_EMBED_MODEL = process.env.HUGGINGFACE_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
const RAG_DIR = path.join(__dirname, "..", "..", "rag"); // server/rag

type DocItem = {
  id: number;
  title: string;
  text: string;
  source?: string;
};

let docstore: Record<string, DocItem> = {};
let embeddings: number[][] = [];

function loadIndex() {
  try {
    const docPath = path.join(RAG_DIR, "docstore.json");
    const embPath = path.join(RAG_DIR, "embeddings.json");
    if (fs.existsSync(docPath)) {
      docstore = JSON.parse(fs.readFileSync(docPath, "utf8"));
    } else {
      console.warn("retriever: docstore.json not found at", docPath);
    }

    if (fs.existsSync(embPath)) {
      embeddings = JSON.parse(fs.readFileSync(embPath, "utf8"));
    } else {
      console.warn("retriever: embeddings.json not found at", embPath);
    }

    console.log(`[retriever] Loaded docstore (${Object.keys(docstore).length}) and embeddings (${embeddings.length})`);
  } catch (err) {
    console.error("retriever: Failed to load RAG files:", err);
  }
}

loadIndex();

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
    const emb = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : json;
    return emb as number[];
  } catch (err) {
    console.error("Error calling HF embeddings:", err);
    return null;
  }
}

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

export async function retrieveTopK(queryText: string, topK = 3) {
  if (!embeddings || embeddings.length === 0) {
    // simple keyword fallback
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
    console.warn("HF embeddings failed for query; using keyword fallback");
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

  const scored: Array<{ id: number; score: number; title: string; text: string; source?: string }> = [];
  for (let i = 0; i < embeddings.length && i < Object.keys(docstore).length; i++) {
    const emb = embeddings[i];
    if (!emb) continue;
    const score = cosine(qEmb, emb as number[]);
    const doc = docstore[String(i)];
    if (doc) {
      scored.push({ id: i, score, title: doc.title, text: doc.text.slice(0, 800), source: doc.source });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
