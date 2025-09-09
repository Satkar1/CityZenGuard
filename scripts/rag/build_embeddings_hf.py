#!/usr/bin/env python3
"""
scripts/rag/build_embeddings_hf.py
- Reads files under data/legal/* (txt, md, csv, pdf, docx)
- Chunk texts, generate embeddings locally using sentence-transformers
- Writes server/rag/docstore.json and server/rag/embeddings.json
"""

import os
import json
import glob
import csv
from pathlib import Path

# Extra imports for file parsing
from PyPDF2 import PdfReader
import docx  # python-docx
from sentence_transformers import SentenceTransformer

# -----------------------------
# Config
# -----------------------------
ROOT = Path(__file__).resolve().parents[2]  # CityZenGuard/
DATA_DIR = ROOT / "data" / "legal"
OUT_DIR = ROOT / "server" / "rag"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Use a strong embedding model locally
USER_MODEL = os.environ.get(
    "HUGGINGFACE_EMBEDDING_MODEL",
    "BAAI/bge-base-en-v1.5"  # default local model
)
FALLBACK_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

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


def batch_embed_local(texts, model_name, batch_size=8):
    """Generate embeddings locally using sentence-transformers"""
    print(f"[INFO] Loading model {model_name} locally...")
    model = SentenceTransformer(model_name)
    embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        print(f"[INFO] Embedding batch {i}-{i+len(batch)} (size {len(batch)})...")
        vecs = model.encode(batch, show_progress_bar=False, convert_to_numpy=True).tolist()
        embeddings.extend(vecs)

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
            docstore[str(doc_id)] = {
                "id": doc_id,
                "title": fname,
                "text": chunk,
                "source": fname,
            }
            texts.append(chunk)
            doc_id += 1

    print(f"[INFO] [build_embeddings] Prepared {len(texts)} chunks from {len(documents)} files")
    if len(texts) == 0:
        print("[INFO] [build_embeddings] No texts found — exiting")
        return

    try:
        embeddings = batch_embed_local(texts, USER_MODEL, batch_size=8)
    except Exception as e:
        print(f"[ERROR] Primary model {USER_MODEL} failed: {e}")
        print(f"[INFO] Falling back to {FALLBACK_MODEL}...")
        embeddings = batch_embed_local(texts, FALLBACK_MODEL, batch_size=8)

    if len(embeddings) != len(texts):
        print(f"[WARNING] embeddings length {len(embeddings)} != texts {len(texts)}")

    # write outputs
    docstore_path = OUT_DIR / "docstore.json"
    embeddings_path = OUT_DIR / "embeddings.json"
    with open(docstore_path, "w", encoding="utf-8") as f:
        json.dump(docstore, f, ensure_ascii=False, indent=2)
    with open(embeddings_path, "w", encoding="utf-8") as f:
        json.dump(embeddings, f, ensure_ascii=False)

    print(
        f"[INFO] [build_embeddings] Wrote docstore ({docstore_path}) and embeddings ({embeddings_path}), total chunks: {len(docstore)})"
    )


if __name__ == "__main__":
    main()
