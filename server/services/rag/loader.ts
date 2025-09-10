import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

// Polyfill __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

export interface Document {
  id: string;
  text: string;
  title: string;
  source: string;
  category?: string;
  section?: string;
}

export interface Docstore {
  [key: string]: Document;
}

let cachedDocstore: Docstore | null = null;

export function loadDocstore(): Docstore {
  if (cachedDocstore) {
    return cachedDocstore;
  }

  // ✅ Ensure path resolves under server/rag
  const docstorePath = join(__dirname, "..", "..", "rag", "docstore.json");

  if (!existsSync(docstorePath)) {
    console.warn(
      `[RAG] docstore.json not found at ${docstorePath}. Please run: python3 scripts/rag/build_embeddings_hf.py`
    );
    return {};
  }

  try {
    const docstoreData = readFileSync(docstorePath, "utf-8");
    cachedDocstore = JSON.parse(docstoreData);
    console.log(
      `[RAG] Loaded docstore with ${Object.keys(cachedDocstore).length} documents`
    );
    return cachedDocstore;
  } catch (error) {
    console.error("[RAG] Error loading docstore:", error);
    return {};
  }
}

export function getDocumentById(id: string): Document | null {
  const docstore = loadDocstore();
  return docstore[id] || null;
}

export function getDocumentsByIds(ids: string[]): Document[] {
  const docstore = loadDocstore();
  return ids.map((id) => docstore[id]).filter(Boolean);
}
