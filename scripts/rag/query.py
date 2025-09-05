#!/usr/bin/env python3
"""
Query script for retrieving relevant documents from the RAG index.
Can be called from Node.js server to get top-k relevant documents.
"""

import sys
import json
import numpy as np
import os
from pathlib import Path

def setup_imports():
    """Try to import required packages."""
    try:
        from sentence_transformers import SentenceTransformer
        import faiss
        return SentenceTransformer, faiss, True
    except ImportError:
        return None, None, False

def load_basic_index():
    """Load basic numpy-based index."""
    try:
        embeddings = np.load("server/rag/embeddings.npy")
        with open("server/rag/docstore.json", 'r', encoding='utf-8') as f:
            docstore = json.load(f)
        return embeddings, docstore, True
    except Exception as e:
        print(f"Error loading basic index: {e}", file=sys.stderr)
        return None, None, False

def load_faiss_index():
    """Load FAISS index."""
    SentenceTransformer, faiss, has_transformers = setup_imports()
    
    if not has_transformers:
        return None, None, None, False
    
    try:
        index = faiss.read_index("server/rag/index.faiss")
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        with open("server/rag/docstore.json", 'r', encoding='utf-8') as f:
            docstore = json.load(f)
        
        return index, model, docstore, True
    except Exception as e:
        print(f"Error loading FAISS index: {e}", file=sys.stderr)
        return None, None, None, False

def create_basic_query_embedding(query_text, vocab_file="server/rag/vocab.json"):
    """Create basic embedding for query when transformers not available."""
    import re
    from collections import Counter
    
    # This is a simplified approach - in practice, you'd want to save vocabulary
    # For now, return a dummy embedding that will use simple text matching
    words = re.findall(r'\w+', query_text.lower())
    return np.array([1.0] * 384)  # Dummy embedding

def search_basic_index(query_text, embeddings, docstore, top_k=3):
    """Search using basic cosine similarity."""
    # Simple keyword matching approach when embeddings not available
    import re
    
    query_words = set(re.findall(r'\w+', query_text.lower()))
    scores = []
    
    for i, doc_id in enumerate(docstore.keys()):
        doc = docstore[doc_id]
        doc_words = set(re.findall(r'\w+', doc['text'].lower()))
        
        # Simple Jaccard similarity
        intersection = len(query_words.intersection(doc_words))
        union = len(query_words.union(doc_words))
        
        if union > 0:
            score = intersection / union
        else:
            score = 0.0
        
        scores.append((score, int(doc_id)))
    
    # Sort by score descending
    scores.sort(reverse=True)
    
    results = []
    for score, doc_idx in scores[:top_k]:
        doc = docstore[str(doc_idx)]
        results.append({
            "id": doc_idx,
            "score": float(score),
            "title": doc["title"],
            "text": doc["text"][:500] + "..." if len(doc["text"]) > 500 else doc["text"],
            "source": doc["source"]
        })
    
    return results

def search_faiss_index(query_text, index, model, docstore, top_k=3):
    """Search using FAISS index."""
    # Encode query
    query_embedding = model.encode([query_text])
    
    # Normalize for cosine similarity
    import faiss
    faiss.normalize_L2(query_embedding)
    
    # Search
    scores, indices = index.search(query_embedding.astype('float32'), top_k)
    
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:  # FAISS returns -1 for empty results
            continue
            
        doc = docstore[str(idx)]
        results.append({
            "id": int(idx),
            "score": float(score),
            "title": doc["title"],
            "text": doc["text"][:500] + "..." if len(doc["text"]) > 500 else doc["text"],
            "source": doc["source"]
        })
    
    return results

def main():
    """Main query function."""
    if len(sys.argv) < 2:
        print("Usage: python query.py <query_text> [top_k]", file=sys.stderr)
        sys.exit(1)
    
    query_text = sys.argv[1]
    top_k = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    
    # Try FAISS first, fall back to basic
    index, model, docstore, faiss_success = load_faiss_index()
    
    if faiss_success:
        results = search_faiss_index(query_text, index, model, docstore, top_k)
    else:
        embeddings, docstore, basic_success = load_basic_index()
        if basic_success:
            results = search_basic_index(query_text, embeddings, docstore, top_k)
        else:
            results = [{"error": "No index available"}]
    
    # Output JSON
    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()