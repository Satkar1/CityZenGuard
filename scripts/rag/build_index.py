#!/usr/bin/env python3
"""
Build FAISS index for legal knowledge base using IPC dataset and legal documents.
"""

import os
import json
import pandas as pd
import numpy as np
from pathlib import Path
import re
import hashlib

def setup_imports():
    """Try to import required packages, fall back to basic functionality if not available."""
    try:
        from sentence_transformers import SentenceTransformer
        import faiss
        return SentenceTransformer, faiss, True
    except ImportError:
        print("Warning: sentence-transformers or faiss not available. Using basic text processing.")
        return None, None, False

def load_ipc_dataset():
    """Load and process the IPC dataset."""
    ipc_file = "ipc_dataset.csv"
    if not os.path.exists(ipc_file):
        print(f"Warning: {ipc_file} not found. Skipping IPC dataset.")
        return []
    
    try:
        df = pd.read_csv(ipc_file)
        documents = []
        
        for _, row in df.iterrows():
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

def create_basic_embeddings(documents):
    """Create basic TF-IDF style embeddings when transformers not available."""
    from collections import Counter
    import math
    
    # Simple word-based vectorization
    all_words = set()
    doc_words = []
    
    for doc in documents:
        words = re.findall(r'\w+', doc['text'].lower())
        doc_words.append(words)
        all_words.update(words)
    
    vocab = list(all_words)
    vocab_size = len(vocab)
    word_to_idx = {word: i for i, word in enumerate(vocab)}
    
    # Create TF-IDF vectors
    embeddings = []
    
    for words in doc_words:
        word_counts = Counter(words)
        tf_vector = np.zeros(vocab_size)
        
        for word, count in word_counts.items():
            if word in word_to_idx:
                tf = count / len(words)  # Term frequency
                # Simple approximation of IDF
                tf_vector[word_to_idx[word]] = tf
        
        embeddings.append(tf_vector)
    
    return np.array(embeddings)

def build_basic_index(embeddings, documents):
    """Build a basic similarity index when FAISS not available."""
    # Normalize embeddings for cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1  # Avoid division by zero
    normalized_embeddings = embeddings / norms
    
    # Save as numpy array for retrieval
    os.makedirs("server/rag", exist_ok=True)
    np.save("server/rag/embeddings.npy", normalized_embeddings)
    
    # Create docstore
    docstore = {str(i): doc for i, doc in enumerate(documents)}
    
    with open("server/rag/docstore.json", 'w', encoding='utf-8') as f:
        json.dump(docstore, f, indent=2, ensure_ascii=False)
    
    print(f"Built basic index with {len(documents)} documents")
    return normalized_embeddings

def build_faiss_index(model, documents):
    """Build FAISS index with sentence transformers."""
    # Extract texts for embedding
    texts = [doc['text'] for doc in documents]
    
    print("Generating embeddings...")
    embeddings = model.encode(texts, show_progress_bar=True)
    
    # Create FAISS index
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
    
    # Normalize embeddings for cosine similarity
    faiss.normalize_L2(embeddings)
    
    # Add to index
    index.add(embeddings.astype('float32'))
    
    # Save index
    os.makedirs("server/rag", exist_ok=True)
    faiss.write_index(index, "server/rag/index.faiss")
    
    # Save embeddings for debugging
    np.save("server/rag/embeddings.npy", embeddings)
    
    # Create docstore
    docstore = {str(i): doc for i, doc in enumerate(documents)}
    
    with open("server/rag/docstore.json", 'w', encoding='utf-8') as f:
        json.dump(docstore, f, indent=2, ensure_ascii=False)
    
    print(f"Built FAISS index with {len(documents)} documents, dimension {dimension}")
    return embeddings

def main():
    """Main function to build the RAG index."""
    print("Building legal knowledge base index...")
    
    # Import packages
    SentenceTransformer, faiss, has_transformers = setup_imports()
    
    # Load all documents
    documents = []
    documents.extend(load_ipc_dataset())
    documents.extend(load_legal_documents())
    
    if not documents:
        print("No documents found to index!")
        return
    
    print(f"Total documents to index: {len(documents)}")
    
    # Build index
    if has_transformers and SentenceTransformer and faiss:
        try:
            print("Using sentence-transformers with FAISS...")
            model = SentenceTransformer('all-MiniLM-L6-v2')
            embeddings = build_faiss_index(model, documents)
        except Exception as e:
            print(f"Error with transformers/FAISS: {e}")
            print("Falling back to basic indexing...")
            embeddings = create_basic_embeddings(documents)
            build_basic_index(embeddings, documents)
    else:
        print("Using basic TF-IDF indexing...")
        embeddings = create_basic_embeddings(documents)
        build_basic_index(embeddings, documents)
    
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
    
    print("\nIndex built successfully!")

if __name__ == "__main__":
    main()