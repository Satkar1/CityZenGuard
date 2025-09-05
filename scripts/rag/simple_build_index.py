#!/usr/bin/env python3
"""
Simple index builder that works without external dependencies.
Creates a basic knowledge base from legal documents and IPC dataset.
"""

import os
import json
import csv
import re
from pathlib import Path

def load_ipc_dataset():
    """Load and process the IPC dataset."""
    ipc_file = "ipc_dataset.csv"
    documents = []
    
    if not os.path.exists(ipc_file):
        print(f"Warning: {ipc_file} not found. Skipping IPC dataset.")
        return documents
    
    try:
        with open(ipc_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Create comprehensive document from IPC section
                doc_text = f"""IPC Section {row['section_number']}: {row['section_title']}

Description: {row['description']}

Example Use Cases: {row['example_use_cases']}

Punishment: {row['punishment']}"""
                
                documents.append({
                    "id": f"ipc_section_{row['section_number']}",
                    "text": doc_text,
                    "title": f"IPC Section {row['section_number']}: {row['section_title']}",
                    "source": "IPC Dataset",
                    "section": row['section_number'],
                    "category": "IPC"
                })
        
        print(f"Loaded {len(documents)} documents from IPC dataset")
        return documents
    except Exception as e:
        print(f"Error loading IPC dataset: {e}")
        return []

def load_legal_documents():
    """Load legal documents from data/legal/ directory."""
    legal_dir = Path("data/legal")
    documents = []
    
    if not legal_dir.exists():
        print("Warning: data/legal directory not found")
        return documents
    
    for file_path in legal_dir.glob("*.md"):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Split content into chunks
            chunks = split_text_into_chunks(content, max_length=800, overlap=50)
            
            for i, chunk in enumerate(chunks):
                doc_id = f"{file_path.stem}_chunk_{i}"
                documents.append({
                    "id": doc_id,
                    "text": chunk,
                    "title": f"{file_path.stem.replace('_', ' ').title()} - Part {i+1}",
                    "source": file_path.name,
                    "category": "Legal Guide"
                })
        
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
    
    print(f"Loaded {len(documents)} chunks from legal documents")
    return documents

def split_text_into_chunks(text, max_length=800, overlap=50):
    """Split text into overlapping chunks."""
    # Simple sentence-based chunking
    sentences = re.split(r'[.!?]+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        if len(current_chunk) + len(sentence) + 1 <= max_length:
            if current_chunk:
                current_chunk += ". " + sentence
            else:
                current_chunk = sentence
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Add overlap
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + ". " + sentence
            else:
                current_chunk = sentence
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

def main():
    """Main function to build the simple knowledge base."""
    print("Building simple legal knowledge base...")
    
    # Load all documents
    documents = []
    documents.extend(load_ipc_dataset())
    documents.extend(load_legal_documents())
    
    if not documents:
        print("No documents found to index!")
        return
    
    print(f"Total documents to index: {len(documents)}")
    
    # Create directory
    os.makedirs("server/rag", exist_ok=True)
    
    # Create docstore
    docstore = {str(i): doc for i, doc in enumerate(documents)}
    
    with open("server/rag/docstore.json", 'w', encoding='utf-8') as f:
        json.dump(docstore, f, indent=2, ensure_ascii=False)
    
    # Create a simple keyword index for fallback search
    keyword_index = {}
    for i, doc in enumerate(documents):
        # Extract keywords from text
        words = re.findall(r'\w+', doc['text'].lower())
        words.extend(re.findall(r'\w+', doc['title'].lower()))
        
        for word in words:
            if len(word) > 2:  # Skip short words
                if word not in keyword_index:
                    keyword_index[word] = []
                if i not in keyword_index[word]:
                    keyword_index[word].append(i)
    
    with open("server/rag/keyword_index.json", 'w', encoding='utf-8') as f:
        json.dump(keyword_index, f, indent=2)
    
    # Print statistics
    print("\n=== Dataset Statistics ===")
    print(f"Total documents: {len(documents)}")
    
    categories = {}
    for doc in documents:
        cat = doc.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    for category, count in categories.items():
        print(f"{category}: {count} documents")
    
    # Average text length
    avg_length = sum(len(doc['text']) for doc in documents) / len(documents)
    print(f"Average document length: {avg_length:.0f} characters")
    print(f"Total keywords in index: {len(keyword_index)}")
    
    print("\nSimple index built successfully!")

if __name__ == "__main__":
    main()