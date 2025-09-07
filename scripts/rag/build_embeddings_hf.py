#!/usr/bin/env python3
"""
scripts/rag/build_embeddings_hf.py
- Reads files under data/legal/*
- Chunk texts, call HF feature-extraction API in small batches with retries
- Writes server/rag/docstore.json and server/rag/embeddings.json
"""
import os
import json
import glob
import time
import requests
from pathlib import Path

# -----------------------------
# Config
# -----------------------------
ROOT = Path(__file__).resolve().parents[2]  # CityZenGuard/
DATA_DIR = ROOT / "data" / "legal"
OUT_DIR = ROOT / "server" / "rag"
OUT_DIR.mkdir(parents=True, exist_ok=True)

HF_TOKEN = os.environ.get("HF_API_TOKEN")
USER_MODEL = os.environ.get("HUGGINGFACE_EMBEDDING_MODEL", "BAAI/bge-small-en")
FALLBACK_MODEL = "intfloat/e5-small"


if not HF_TOKEN:
    raise RuntimeError("HF_API_TOKEN not set")

HEADERS = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}

# always hit feature-extraction pipeline
def make_url(model_name: str) -> str:
    return f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_name}"


# -----------------------------
# Helpers
# -----------------------------
def chunk_text(text, max_chars=1000, overlap=200):
    text = text.replace("\r", "")
    parts = []
    i = 0
    while i < len(text):
        part = text[i:i+max_chars]
        parts.append(part)
        i += max_chars - overlap
    return parts


def batch_embed(texts, model, batch_size=8, timeout=60, retries=4, backoff=5):
    """Send texts to HF inference API in batches"""
    embeddings = []
    url = make_url(model)

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        attempt = 0
        while attempt < retries:
            try:
                print(f"[INFO] Embedding batch {i}-{i+len(batch)} (size {len(batch)}) with {model}...")
                res = requests.post(url, headers=HEADERS, json={"inputs": batch}, timeout=timeout)

                if res.status_code == 200:
                    out = res.json()
                    # normalize shape
                    if isinstance(out, list) and isinstance(out[0], list):
                        embeddings.extend(out)
                    else:
                        embeddings.extend(out if isinstance(out, list) else [out])
                    time.sleep(0.5)
                    break

                else:
                    print(f"[WARNING] HF embedding failed (status {res.status_code}): {res.text[:200]}")
                    attempt += 1
                    time.sleep(backoff * attempt)

            except requests.exceptions.ReadTimeout:
                print(f"[WARNING] Timeout for batch {i}-{i+len(batch)}, retrying...")
                attempt += 1
                time.sleep(backoff * attempt)

            except Exception as e:
                print(f"[ERROR] Unexpected error embedding batch {i}-{i+len(batch)}: {e}")
                attempt += 1
                time.sleep(backoff * attempt)
        else:
            raise RuntimeError(f"Embedding batch {i}-{i+len(batch)} failed after {retries} retries")

    return embeddings


# -----------------------------
# Main
# -----------------------------
def main():
    files = sorted(glob.glob(str(DATA_DIR / "*.*")))
    docstore = {}
    texts = []

    doc_id = 0
    for fpath in files:
        title = Path(fpath).name
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read().strip()
        if not content:
            continue
        chunks = chunk_text(content, max_chars=1000, overlap=200)
        for chunk in chunks:
            docstore[str(doc_id)] = {"id": doc_id, "title": title, "text": chunk, "source": title}
            texts.append(chunk)
            doc_id += 1

    print(f"[build_embeddings] Prepared {len(texts)} chunks from {len(files)} files")
    if len(texts) == 0:
        print("[build_embeddings] No texts found — exiting")
        return

    try:
        embeddings = batch_embed(texts, USER_MODEL, batch_size=8)
    except Exception as e:
        print(f"[ERROR] Primary model {USER_MODEL} failed: {e}")
        print(f"[INFO] Falling back to {FALLBACK_MODEL}...")
        embeddings = batch_embed(texts, FALLBACK_MODEL, batch_size=8)

    if len(embeddings) != len(texts):
        print(f"[WARNING] embeddings length {len(embeddings)} != texts {len(texts)}")

    # write outputs
    docstore_path = OUT_DIR / "docstore.json"
    embeddings_path = OUT_DIR / "embeddings.json"
    with open(docstore_path, "w", encoding="utf-8") as f:
        json.dump(docstore, f, ensure_ascii=False, indent=2)
    with open(embeddings_path, "w", encoding="utf-8") as f:
        json.dump(embeddings, f, ensure_ascii=False)

    print(f"[build_embeddings] Wrote docstore ({docstore_path}) and embeddings ({embeddings_path}), total chunks: {len(docstore)}")


if __name__ == "__main__":
    main()
