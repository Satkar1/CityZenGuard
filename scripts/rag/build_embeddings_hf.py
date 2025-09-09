#!/usr/bin/env python3
"""
Build embeddings for documents in the RAG system.
This script prepares chunks from documents and generates embeddings using
the Hugging Face Inference API (or fallback to a secondary model).
"""

import os
import json
import time
import requests
from pathlib import Path

# === Configuration ===
DOCS_DIR = Path("data/legal")
RAG_DIR = Path("server/rag")
DOCSTORE_FILE = RAG_DIR / "docstore.json"
EMBEDDINGS_FILE = RAG_DIR / "embeddings.json"

HF_API_TOKEN = os.environ.get("HF_API_TOKEN")
PRIMARY_MODEL = os.environ.get("HUGGINGFACE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
FALLBACK_MODEL = "BAAI/bge-base-en-v1.5"

HEADERS = {"Authorization": f"Bearer {HF_API_TOKEN}"} if HF_API_TOKEN else {}


# === Helpers ===
def log(msg: str):
    print(f"[INFO] {msg}", flush=True)


def read_documents():
    """Read all documents from DOCS_DIR."""
    docs = []
    for path in DOCS_DIR.glob("*.txt"):
        text = path.read_text(encoding="utf-8").strip()
        docs.append({"id": path.name, "text": text})
    return docs


def chunk_text(text, max_len=500):
    """Simple chunking of text into fixed-size pieces."""
    words = text.split()
    for i in range(0, len(words), max_len):
        yield " ".join(words[i : i + max_len])


def embed_batch(model: str, batch: list[str]) -> list[list[float]]:
    """Send a batch of sentences to Hugging Face Inference API for embeddings."""
    url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model}"
    payload = {"inputs": batch}  # ✅ FIXED: was "sentences", should be "inputs"
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=60)

    if resp.status_code != 200:
        raise RuntimeError(f"HF embedding failed (status {resp.status_code}): {resp.text}")

    return resp.json()


def build_embeddings():
    docs = read_documents()
    chunks = []
    for doc in docs:
        for chunk in chunk_text(doc["text"]):
            chunks.append({"doc_id": doc["id"], "text": chunk})

    log(f"[build_embeddings] Prepared {len(chunks)} chunks from {len(docs)} files")

    embeddings = []
    batch_size = 8

    try:
        for i in range(0, len(chunks), batch_size):
            batch = [c["text"] for c in chunks[i : i + batch_size]]
            log(f"Embedding batch {i}-{i+len(batch)} (size {len(batch)}) with {PRIMARY_MODEL}...")
            for attempt in range(4):
                try:
                    vecs = embed_batch(PRIMARY_MODEL, batch)
                    break
                except Exception as e:
                    log(f"Warning:  HF embedding failed ({e}), retry {attempt+1}/4")
                    time.sleep(2)
            else:
                raise RuntimeError(f"Primary model {PRIMARY_MODEL} failed: Embedding batch {i}-{i+len(batch)} failed after 4 retries")

            for j, vec in enumerate(vecs):
                embeddings.append({"text": batch[j], "embedding": vec, "doc_id": chunks[i + j]["doc_id"]})

    except Exception as primary_err:
        log(f"Error:  {primary_err}")
        log(f"[INFO] Falling back to {FALLBACK_MODEL}...")

        for i in range(0, len(chunks), batch_size):
            batch = [c["text"] for c in chunks[i : i + batch_size]]
            log(f"Embedding batch {i}-{i+len(batch)} (size {len(batch)}) with {FALLBACK_MODEL}...")
            vecs = embed_batch(FALLBACK_MODEL, batch)
            for j, vec in enumerate(vecs):
                embeddings.append({"text": batch[j], "embedding": vec, "doc_id": chunks[i + j]["doc_id"]})

    # Ensure RAG directory exists
    RAG_DIR.mkdir(parents=True, exist_ok=True)

    # Save docstore (original text chunks)
    with open(DOCSTORE_FILE, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

    # Save embeddings
    with open(EMBEDDINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(embeddings, f, indent=2)

    log(f"[build_embeddings] Wrote docstore ({DOCSTORE_FILE}) and embeddings ({EMBEDDINGS_FILE}), total chunks: {len(chunks)})")


if __name__ == "__main__":
    build_embeddings()
