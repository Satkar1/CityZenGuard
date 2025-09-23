# rag_service/query_api.py
import os
import re
import pickle
import traceback
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Request
from pydantic import BaseModel
from dotenv import load_dotenv
import numpy as np
from sentence_transformers import SentenceTransformer
from google import genai
from google.genai.types import GenerateContentConfig

load_dotenv()

# config
EMB_FILE = os.getenv("EMB_FILE", "embeddings.pkl")
API_SECRET = os.getenv("RAG_INTERNAL_KEY", "replace_with_secret")  # verify callers
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_KEY:
    raise RuntimeError("GEMINI_API_KEY not set in env")

# load data and models
with open(EMB_FILE, "rb") as f:
    df, embeddings = pickle.load(f)

embedder = SentenceTransformer("all-MiniLM-L6-v2")
client = genai.Client(api_key=GEMINI_KEY)

app = FastAPI(title="RAG service - CityZenGuard")

class QueryIn(BaseModel):
    question: str
    # optionally include conversation metadata, user_id etc.

class QueryOut(BaseModel):
    answer: str
    source: str  # "kb" or "web"

def safe_generate(prompt: str, temperature: float = 0.2) -> str:
    try:
        resp = client.models.generate_content(
            model="models/gemini-1.5-flash",
            contents=prompt,
            config=GenerateContentConfig(temperature=temperature),
        )
        return resp.text.strip()
    except Exception as e:
        text = str(e)
        # detect quota or resource exhausted
        if "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
            return "ERROR: Gemini quota exceeded"
        # return a controlled error
        return f"ERROR: {text}"

def direct_section_lookup(query: str) -> Optional[str]:
    m = re.search(r"(?:ipc|section)\s*(\d+)", query.lower())
    if m:
        sec = m.group(1)
        hits = df[df["title"].str.contains(
            rf"(?:^|\b)(?:Section|IPC)\s*{sec}(?:\b|$)",
            case=False, na=False, regex=True)]
        if not hits.empty:
            return "\n\n".join(hits["title"] + " - " + hits["content"])
    return None

def search_embeddings(query: str, top_k: int = 5):
    q_emb = embedder.encode([query], convert_to_numpy=True)[0]
    scores = np.dot(embeddings, q_emb) / (
        np.linalg.norm(embeddings, axis=1) * np.linalg.norm(q_emb)
    )
    top_idx = np.argsort(scores)[::-1][:top_k]
    return [(df.iloc[i]["title"], df.iloc[i]["content"], float(scores[i])) for i in top_idx]

def build_kb_prompt(context: str, query: str) -> str:
    return f"""
You are a legal assistant. Use the knowledge base context provided below.

Rules:
- If the context contains a legal answer, explain it clearly in simple language.
- If context is EMPTY/irrelevant, do NOT say 'I will search' — only reply 'Not found in knowledge base.'
- If context is insufficient, you may expand using general legal knowledge but prioritize the KB.

Context:
{context}

Query:
{query}
"""

def build_web_prompt(query: str) -> str:
    return f"""
You are a legal assistant.

Rules:
1. If the query is NOT legal, reply exactly: "Not a legal question."
2. If the query IS legal, provide a clear, accurate legal explanation in simple language. Use external knowledge if needed.

Query:
{query}
"""

@app.post("/api/query", response_model=QueryOut)
async def query_endpoint(payload: QueryIn, x_internal_key: Optional[str] = Header(None)):
    # Simple internal auth
    if API_SECRET and x_internal_key != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    q = payload.question.strip()
    try:
        # 1) direct section lookup
        direct_ctx = direct_section_lookup(q)
        if direct_ctx:
            prompt = build_kb_prompt(direct_ctx, q)
            ans = safe_generate(prompt, temperature=0.1)
            # if safe_generate returns quota error, return that as helpful message
            if ans.startswith("ERROR:"):
                raise HTTPException(status_code=503, detail=ans)
            return {"answer": ans, "source": "kb"}

        # 2) embedding search
        results = search_embeddings(q, top_k=5)
        best_title, best_content, best_score = results[0]
        # if score low, fallback to web mode and let Gemini decide if legal or not
        if best_score < 0.40:
            prompt = build_web_prompt(q)
            ans = safe_generate(prompt, temperature=0.3)
            if ans.startswith("ERROR:"):
                raise HTTPException(status_code=503, detail=ans)
            return {"answer": ans, "source": "web"}

        # 3) KB-mode: send top-k as context
        context = "\n\n".join([f"{t} - {c}" for t, c, s in results])
        prompt = build_kb_prompt(context, q)
        ans = safe_generate(prompt, temperature=0.15)
        if ans.startswith("ERROR:"):
            raise HTTPException(status_code=503, detail=ans)

        # If Gemini returns a 'Not found' message, fallback to web
        if "Not found in knowledge base" in ans or len(ans.split()) < 5:
            prompt = build_web_prompt(q)
            ans2 = safe_generate(prompt, temperature=0.3)
            if ans2.startswith("ERROR:"):
                raise HTTPException(status_code=503, detail=ans2)
            return {"answer": ans2, "source": "web"}

        return {"answer": ans, "source": "kb"}

    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")
