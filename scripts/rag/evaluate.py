#!/usr/bin/env python3
"""
Evaluation script for RAG system.
Tests retrieval accuracy on hand-crafted Q/A pairs.
"""

import json
import sys
import subprocess
from pathlib import Path

# Hand-crafted evaluation Q/A pairs
EVAL_QA_PAIRS = [
    {
        "question": "What is the punishment for theft under IPC?",
        "expected_keywords": ["section 378", "section 379", "imprisonment", "3 years", "fine"],
        "category": "IPC"
    },
    {
        "question": "How to file an FIR?",
        "expected_keywords": ["police station", "section 154", "jurisdiction", "written", "copy"],
        "category": "FIR Filing"
    },
    {
        "question": "What is anticipatory bail?",
        "expected_keywords": ["section 438", "pre-arrest", "sessions court", "high court", "conditions"],
        "category": "Bail"
    },
    {
        "question": "What is IPC Section 420?",
        "expected_keywords": ["cheating", "dishonestly", "7 years", "fine", "property"],
        "category": "IPC"
    },
    {
        "question": "What are the rights of an accused person?",
        "expected_keywords": ["legal representation", "bail", "self-incrimination", "fair trial", "appeal"],
        "category": "Rights"
    },
    {
        "question": "How long does police custody last?",
        "expected_keywords": ["15 days", "magistrate", "judicial custody", "24 hours"],
        "category": "Custody"
    },
    {
        "question": "What is the difference between bailable and non-bailable offenses?",
        "expected_keywords": ["right to bail", "court discretion", "police grant", "serious crimes"],
        "category": "Bail"
    },
    {
        "question": "What is IPC Section 302?",
        "expected_keywords": ["murder", "death", "life imprisonment", "intention", "knowledge"],
        "category": "IPC"
    },
    {
        "question": "How to appeal a court decision?",
        "expected_keywords": ["higher court", "time limit", "30 days", "legal errors", "judgment"],
        "category": "Appeal"
    },
    {
        "question": "What are cognizable offenses?",
        "expected_keywords": ["arrest without warrant", "police", "serious crimes", "murder", "theft"],
        "category": "Criminal Procedure"
    }
]

def query_rag_system(question, top_k=3):
    """Query the RAG system using the query script."""
    try:
        result = subprocess.run([
            "python3", "scripts/rag/query.py", question, str(top_k)
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            print(f"Error querying RAG: {result.stderr}")
            return []
    except Exception as e:
        print(f"Exception querying RAG: {e}")
        return []

def evaluate_retrieval(results, expected_keywords):
    """Evaluate if retrieved results contain expected keywords."""
    if not results:
        return 0.0, []
    
    found_keywords = []
    all_text = " ".join([doc.get("text", "") + " " + doc.get("title", "") for doc in results]).lower()
    
    for keyword in expected_keywords:
        if keyword.lower() in all_text:
            found_keywords.append(keyword)
    
    accuracy = len(found_keywords) / len(expected_keywords)
    return accuracy, found_keywords

def main():
    """Run evaluation."""
    print("Evaluating RAG System")
    print("=" * 50)
    
    # Check if index exists
    if not Path("server/rag/docstore.json").exists():
        print("Error: RAG index not found. Please run build_index.py first.")
        sys.exit(1)
    
    results = []
    total_score = 0
    
    for i, qa in enumerate(EVAL_QA_PAIRS, 1):
        print(f"\n{i}. Question: {qa['question']}")
        print(f"   Category: {qa['category']}")
        
        # Query RAG system
        rag_results = query_rag_system(qa["question"])
        
        if not rag_results or "error" in rag_results[0]:
            print(f"   ❌ RAG query failed")
            accuracy = 0.0
            found_keywords = []
        else:
            # Evaluate retrieval
            accuracy, found_keywords = evaluate_retrieval(rag_results, qa["expected_keywords"])
            
        print(f"   Accuracy: {accuracy:.2f} ({len(found_keywords)}/{len(qa['expected_keywords'])} keywords found)")
        print(f"   Found keywords: {found_keywords}")
        
        if rag_results and "error" not in rag_results[0]:
            print(f"   Top result: {rag_results[0].get('title', 'N/A')}")
        
        results.append({
            "question": qa["question"],
            "category": qa["category"],
            "accuracy": accuracy,
            "found_keywords": found_keywords,
            "expected_keywords": qa["expected_keywords"],
            "top_result": rag_results[0].get("title", "N/A") if rag_results and "error" not in rag_results[0] else "N/A"
        })
        
        total_score += accuracy
    
    # Summary
    average_accuracy = total_score / len(EVAL_QA_PAIRS)
    
    print("\n" + "=" * 50)
    print("EVALUATION SUMMARY")
    print("=" * 50)
    print(f"Total questions: {len(EVAL_QA_PAIRS)}")
    print(f"Average accuracy: {average_accuracy:.2f}")
    
    # Category breakdown
    categories = {}
    for result in results:
        cat = result["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(result["accuracy"])
    
    print("\nCategory Breakdown:")
    for category, scores in categories.items():
        avg_score = sum(scores) / len(scores)
        print(f"  {category}: {avg_score:.2f} ({len(scores)} questions)")
    
    # Top/Bottom performers
    results.sort(key=lambda x: x["accuracy"], reverse=True)
    
    print(f"\nBest performing questions:")
    for result in results[:3]:
        print(f"  • {result['question']} - {result['accuracy']:.2f}")
    
    print(f"\nWorst performing questions:")
    for result in results[-3:]:
        print(f"  • {result['question']} - {result['accuracy']:.2f}")
    
    # Recommendations
    print("\nRecommendations:")
    if average_accuracy < 0.5:
        print("  • Low accuracy suggests need for better chunking or more comprehensive knowledge base")
    if average_accuracy < 0.7:
        print("  • Consider adding more legal documents or improving keyword coverage")
    if average_accuracy > 0.8:
        print("  • Good performance! Consider expanding evaluation set")
    
    return average_accuracy

if __name__ == "__main__":
    main()