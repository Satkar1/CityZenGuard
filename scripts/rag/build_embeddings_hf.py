#!/usr/bin/env python3
"""
scripts/rag/build_embeddings_hf.py
- Reads files under data/legal/* (txt, md, csv, pdf, docx)
- Chunk texts, call HF feature-extraction API in small batches with retries
- Writes server/rag/docstore.json and server/rag/embeddings.json
"""

import os
import json
import glob
import time
import csv
import requests
from pathlib import Path

# Extra imports for file parsing
from PyPDF2 import PdfReader
import docx  # python-docx

# -----------------------------
# Config
# -----------------------------
ROOT = Path(__file__).resolve().parents[2]  # CityZenGuard/
DATA_DIR = ROOT / "data" / "legal"
OUT_DIR = ROOT / "server" / "rag"
OUT_DIR.mkdir(parents=True, exist_ok=True)

HF_TOKEN = os.environ.get("HF_API_TOKEN")
USER_MODEL = os.environ.get("HUGGINGFACE_EMBEDDING_MODEL", "sentence-transformers/paraphrase-MiniLM-L3-v2")
FALLBACK_MODEL = "sentence-transformers/paraphrase-mpnet-base-v2"


if not HF_TOKEN:
    raise RuntimeError("HF_API_TOKEN not set")

HEADERS = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}

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

def load_documents(data_dir=DATA_DIR):
    docs = []
    for path in glob.glob(str(data_dir / "*")):
        fname = os.path.basename(path)

        # TXT / MD
        if fname.endswith(".txt") or fname.endswith(".md"):
            with open(path, "r", encoding="utf-8") as f:
                docs.append((fname, f.read()))

        # CSV
        elif fname.endswith(".csv"):
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    text = f"Section {row.get('section_number')}: {row.get('section_title')}\n"
                    text += f"Description: {row.get('description')}\n"
                    if row.get("example_use_cases"):
                        text += f"Examples: {row.get('example_use_cases')}\n"
                    if row.get("punishment"):
                        text += f"Punishment: {row.get('punishment')}\n"
                    docs.append((fname, text))

        # PDF
        elif fname.endswith(".pdf"):
            reader = PdfReader(path)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            docs.append((fname, text))

        # DOCX
        elif fname.endswith(".docx"):
            doc = docx.Document(path)
            text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
            docs.append((fname, text))

    return docs

def batch_embed(texts, model, batch_size=8, timeout=60, retries=4, backoff=5):
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
    documents = load_documents(DATA_DIR)
    docstore = {}
    texts = []

    doc_id = 0
    for fname, content in documents:
        if not content.strip():
            continue
        chunks = chunk_text(content, max_chars=1000, overlap=200)
        for chunk in chunks:
            docstore[str(doc_id)] = {"id": doc_id, "title": fname, "text": chunk, "source": fname}
            texts.append(chunk)
            doc_id += 1

    print(f"[INFO] [build_embeddings] Prepared {len(texts)} chunks from {len(documents)} files")
    if len(texts) == 0:
        print("[INFO] [build_embeddings] No texts found — exiting")
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

    print(f"[INFO] [build_embeddings] Wrote docstore ({docstore_path}) and embeddings ({embeddings_path}), total chunks: {len(docstore)})")

if __name__ == "__main__":
    main()
