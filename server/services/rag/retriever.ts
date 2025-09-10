import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Polyfill __dirname for ESM builds
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const HF_EMBED_MODEL =
  process.env.HUGGINGFACE_EMBEDDING_MODEL ||
  "sentence-transformers/all-MiniLM-L6-v2";

// ✅ Ensure paths resolve inside server/rag
const RAG_DIR = path.join(__dirname, "..", "..", "rag");

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
    const docstorePath = path.join(RAG_DIR, "docstore.json");
    const embeddingsPath = path.join(RAG_DIR, "embeddings.json");

    if (fs.existsSync(docstorePath)) {
      const raw = fs.readFileSync(docstorePath, "utf-8");
      docstore = JSON.parse(raw);
      console.log(
        `[RAG] Loaded docstore (${Object.keys(docstore).length} docs) from ${docstorePath}`
      );
    } else {
      console.warn(`[RAG] docstore.json not found at ${docstorePath}`);
    }

    if (fs.existsSync(embeddingsPath)) {
      const rawEmb = fs.readFileSync(embeddingsPath, "utf-8");
      embeddings = JSON.parse(rawEmb);
      console.log(
        `[RAG] Loaded embeddings (${embeddings.length} vectors) from ${embeddingsPath}`
      );
    } else {
      console.warn(`[RAG] embeddings.json not found at ${embeddingsPath}`);
    }
  } catch (err) {
    console.error("[RAG] Failed to load index:", err);
  }
}

loadIndex();

// simple cosine similarity helper
function cosine(a: number[], b: number[]) {
  try {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length && i < b.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  } catch {
    return 0;
  }
}

async function getQueryEmbedding(queryText: string): Promise<number[] | null> {
  try {
    if (!HF_TOKEN) {
      console.warn("[RAG] No HF token configured; cannot call HF embeddings");
      return null;
    }

    const model = HF_EMBED_MODEL;
    const url = `https://api-inference.huggingface.co/models/${model}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: queryText }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[RAG] HF embedding failed (status ${res.status}): ${txt}`);
      return null;
    }

    const out = await res.json();
    if (Array.isArray(out) && Array.isArray(out[0])) {
      return out[0] as number[];
    }
    if (Array.isArray(out) && typeof out[0] === "number") {
      return out as number[];
    }
    return null;
  } catch (err) {
    console.warn("[RAG] getQueryEmbedding error:", err);
    return null;
  }
}

export async function retrieveRelevantDocs(queryText: string, topK = 3) {
  if (!embeddings || embeddings.length === 0 || Object.keys(docstore).length === 0) {
    console.warn("[RAG] Empty index, returning empty results");
    return [];
  }

  const qEmb = await getQueryEmbedding(queryText);

  if (!qEmb) {
    console.warn("[RAG] HF embeddings failed for query; using keyword fallback");
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
