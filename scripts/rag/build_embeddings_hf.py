#!/usr/bin/env python3
# scripts/rag/build_embeddings_hf.py
import os, json, glob, requests, math, time
from pathlib import Path

HF_TOKEN = os.environ.get("HF_API_TOKEN")
EMBED_MODEL = os.environ.get("HUGGINGFACE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
ROOT = Path(__file__).resolve().parents[2]  # CityZenGuard/
DATA_DIR = ROOT / "data" / "legal"
OUT_DIR = ROOT / "server" / "rag"
OUT_DIR.mkdir(parents=True, exist_ok=True)

if not HF_TOKEN:
    raise RuntimeError("HF_API_TOKEN not set")

headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}
embed_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{EMBED_MODEL}"

def chunk_text(text, max_chars=1000, overlap=200):
    text = text.replace("\r","")
    parts = []
    i = 0
    while i < len(text):
        part = text[i:i+max_chars]
        parts.append(part)
        i += max_chars - overlap
    return parts

docstore = {}
embeddings = []

doc_files = sorted(glob.glob(str(DATA_DIR / "*.*")))
doc_id = 0
for fpath in doc_files:
    title = os.path.basename(fpath)
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
    chunks = chunk_text(content, max_chars=1000, overlap=200)
    for chunk in chunks:
        # get embedding
        payload = {"inputs": chunk}
        r = requests.post(embed_url, headers=headers, json=payload, timeout=60)
        if not r.ok:
            print("Embedding failed:", r.status_code, r.text)
            raise SystemExit(1)
        emb = r.json()
        if isinstance(emb, list) and isinstance(emb[0], list):
            emb = emb[0]
        docstore[str(doc_id)] = {"id": doc_id, "title": title, "text": chunk, "source": title}
        embeddings.append(emb)
        doc_id += 1
        time.sleep(0.2)  # be gentle with rate limits

# write outputs
with open(OUT_DIR / "docstore.json", "w", encoding="utf-8") as f:
    json.dump(docstore, f, ensure_ascii=False, indent=2)
with open(OUT_DIR / "embeddings.json", "w", encoding="utf-8") as f:
    json.dump(embeddings, f, ensure_ascii=False)
print("Wrote", len(docstore), "chunks to", OUT_DIR)
