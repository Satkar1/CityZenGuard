#!/usr/bin/env python3
"""
Simple query script that works without external dependencies.
"""

import sys
import json
import re
import os

def load_docstore():
    """Load the docstore."""
    try:
        with open("server/rag/docstore.json", 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        return {}

def simple_search(query, docstore, top_k=3):
    """Simple keyword-based search."""
    query_words = set(re.findall(r'\w+', query.lower()))
    scores = []
    
    for doc_id, doc in docstore.items():
        doc_text = (doc['text'] + ' ' + doc['title']).lower()
        doc_words = set(re.findall(r'\w+', doc_text))
        
        # Jaccard similarity
        intersection = len(query_words.intersection(doc_words))
        union = len(query_words.union(doc_words))
        
        if union > 0:
            score = intersection / union
        else:
            score = 0.0
        
        # Boost for exact phrase matches
        if query.lower() in doc_text:
            score += 0.3
        
        # Boost for IPC sections
        if 'section' in query.lower() and doc.get('category') == 'IPC':
            score += 0.2
        
        scores.append({
            "id": int(doc_id),
            "score": score,
            "title": doc["title"],
            "text": doc["text"][:300] + "..." if len(doc["text"]) > 300 else doc["text"],
            "source": doc["source"]
        })
    
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores[:top_k]

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 simple_query.py <query>")
        sys.exit(1)
    
    query = sys.argv[1]
    docstore = load_docstore()
    
    if not docstore:
        print(json.dumps([{"error": "No docstore found"}]))
        return
    
    results = simple_search(query, docstore)
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()