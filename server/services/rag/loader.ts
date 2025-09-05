import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

  const docstorePath = join(process.cwd(), 'server/rag/docstore.json');
  
  if (!existsSync(docstorePath)) {
    console.warn('Docstore not found. Please run: python3 scripts/rag/build_index.py');
    return {};
  }

  try {
    const docstoreData = readFileSync(docstorePath, 'utf-8');
    cachedDocstore = JSON.parse(docstoreData);
    console.log(`Loaded docstore with ${Object.keys(cachedDocstore).length} documents`);
    return cachedDocstore;
  } catch (error) {
    console.error('Error loading docstore:', error);
    return {};
  }
}

export function getDocumentById(id: string): Document | null {
  const docstore = loadDocstore();
  return docstore[id] || null;
}

export function getDocumentsByIds(ids: string[]): Document[] {
  const docstore = loadDocstore();
  return ids.map(id => docstore[id]).filter(Boolean);
}