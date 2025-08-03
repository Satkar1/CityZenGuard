#!/usr/bin/env python3
"""
Legal Question-Answer Model Training Script
Trains a machine learning model on legal Q&A data for intelligent responses
"""

import pandas as pd
import numpy as np
import joblib
import json
import os
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import re
import string

# Simple text processing without NLTK dependency
def simple_tokenize(text):
    """Simple tokenization without NLTK"""
    # Remove punctuation and convert to lowercase
    text = text.lower().translate(str.maketrans('', '', string.punctuation))
    return text.split()

# Simple stopwords list
STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
    'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
    'while', 'of', 'at', 'by', 'for', 'with', 'through', 'during', 'before', 'after',
    'above', 'below', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
    'further', 'then', 'once'
}

class LegalModelTrainer:
    def __init__(self, csv_path='../attached_assets/enhanced_labeled.csv'):
        self.csv_path = csv_path
        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=2,
            max_df=0.95
        )
        self.classifier = RandomForestClassifier(
            n_estimators=200,
            max_depth=20,
            random_state=42,
            class_weight='balanced'
        )
        self.stop_words = STOPWORDS
        self.qa_pairs = []
        self.categories = []
        
    def preprocess_text(self, text):
        """Advanced text preprocessing for legal content"""
        if pd.isna(text):
            return ""
            
        # Convert to lowercase
        text = str(text).lower()
        
        # Remove special characters but keep legal terms
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove extra whitespaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Simple tokenization
        tokens = simple_tokenize(text)
        
        # Remove stopwords and short words
        tokens = [token for token in tokens 
                 if token not in self.stop_words and len(token) > 2]
        
        return ' '.join(tokens)
    
    def load_data(self):
        """Load and preprocess the CSV data"""
        try:
            print(f"Loading data from {self.csv_path}")
            
            # Try different possible column names
            df = pd.read_csv(self.csv_path)
            print(f"Data shape: {df.shape}")
            print(f"Columns: {list(df.columns)}")
            
            # Detect column names automatically
            question_col = None
            answer_col = None
            category_col = None
            
            for col in df.columns:
                col_lower = col.lower()
                if any(keyword in col_lower for keyword in ['question', 'query', 'q', 'input']):
                    question_col = col
                elif any(keyword in col_lower for keyword in ['answer', 'response', 'reply', 'a', 'output']):
                    answer_col = col
                elif any(keyword in col_lower for keyword in ['category', 'label', 'class', 'type']):
                    category_col = col
            
            # Fallback to first few columns if auto-detection fails
            if not question_col:
                question_col = df.columns[0]
            if not answer_col:
                answer_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]
            if not category_col and len(df.columns) > 2:
                category_col = df.columns[2]
            
            print(f"Using columns - Question: {question_col}, Answer: {answer_col}, Category: {category_col}")
            
            # Clean and prepare data
            df_clean = df.dropna(subset=[question_col, answer_col])
            
            for idx, row in df_clean.iterrows():
                question = self.preprocess_text(row[question_col])
                answer = str(row[answer_col])
                category = str(row[category_col]) if category_col else "general"
                
                if question and answer:
                    self.qa_pairs.append({
                        'question': question,
                        'answer': answer,
                        'category': category,
                        'original_question': str(row[question_col])
                    })
            
            print(f"Loaded {len(self.qa_pairs)} Q&A pairs")
            
            # Extract unique categories
            self.categories = list(set([qa['category'] for qa in self.qa_pairs]))
            print(f"Categories found: {self.categories}")
            
            return True
            
        except Exception as e:
            print(f"Error loading data: {e}")
            return False
    
    def train_similarity_model(self):
        """Train TF-IDF based similarity model"""
        if not self.qa_pairs:
            print("No data loaded. Please load data first.")
            return False
        
        print("Training similarity model...")
        
        # Prepare questions for vectorization
        questions = [qa['question'] for qa in self.qa_pairs]
        
        # Fit vectorizer
        self.question_vectors = self.vectorizer.fit_transform(questions)
        
        print(f"Vectorization complete. Feature shape: {self.question_vectors.shape}")
        return True
    
    def train_classification_model(self):
        """Train classification model for categorization"""
        if not self.qa_pairs:
            print("No data loaded. Please load data first.")
            return False
        
        print("Training classification model...")
        
        # Prepare data for classification
        X = [qa['question'] for qa in self.qa_pairs]
        y = [qa['category'] for qa in self.qa_pairs]
        
        # Vectorize questions
        X_vectorized = self.vectorizer.transform(X)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_vectorized, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train classifier
        self.classifier.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.classifier.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"Classification accuracy: {accuracy:.3f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        
        return True
    
    def save_model(self, model_dir='../server/models'):
        """Save trained model and data"""
        os.makedirs(model_dir, exist_ok=True)
        
        # Save vectorizer
        joblib.dump(self.vectorizer, f'{model_dir}/vectorizer.pkl')
        
        # Save classifier
        joblib.dump(self.classifier, f'{model_dir}/classifier.pkl')
        
        # Save Q&A pairs
        with open(f'{model_dir}/qa_pairs.json', 'w', encoding='utf-8') as f:
            json.dump(self.qa_pairs, f, ensure_ascii=False, indent=2)
        
        # Save categories
        with open(f'{model_dir}/categories.json', 'w') as f:
            json.dump(self.categories, f, indent=2)
        
        # Save question vectors
        joblib.dump(self.question_vectors, f'{model_dir}/question_vectors.pkl')
        
        # Save metadata
        metadata = {
            'training_date': datetime.now().isoformat(),
            'num_qa_pairs': len(self.qa_pairs),
            'num_categories': len(self.categories),
            'feature_count': self.question_vectors.shape[1],
            'model_version': '1.0'
        }
        
        with open(f'{model_dir}/metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Model saved to {model_dir}")
        return True
    
    def test_model(self, test_questions=None):
        """Test the trained model with sample questions"""
        if test_questions is None:
            test_questions = [
                "How to file FIR?",
                "What are my rights during arrest?",
                "How to apply for bail?",
                "What is domestic violence law?",
                "How to file consumer complaint?"
            ]
        
        print("\n=== Model Testing ===")
        
        for question in test_questions:
            processed_question = self.preprocess_text(question)
            
            # Get similarity scores
            question_vector = self.vectorizer.transform([processed_question])
            similarities = cosine_similarity(question_vector, self.question_vectors).flatten()
            
            # Find best match
            best_match_idx = np.argmax(similarities)
            best_similarity = similarities[best_match_idx]
            
            # Get category prediction
            predicted_category = self.classifier.predict(question_vector)[0]
            
            print(f"\nQuestion: {question}")
            print(f"Similarity Score: {best_similarity:.3f}")
            print(f"Predicted Category: {predicted_category}")
            
            if best_similarity > 0.3:  # Threshold for good match
                best_answer = self.qa_pairs[best_match_idx]['answer']
                print(f"Answer: {best_answer[:200]}...")
            else:
                print("Answer: No good match found - would use Gemini AI")

def main():
    """Main training function"""
    print("=== Legal AI Model Training ===")
    
    trainer = LegalModelTrainer()
    
    # Load data
    if not trainer.load_data():
        print("Failed to load data. Please check CSV file path and format.")
        return False
    
    # Train models
    if not trainer.train_similarity_model():
        print("Failed to train similarity model.")
        return False
    
    if not trainer.train_classification_model():
        print("Failed to train classification model.")
        return False
    
    # Test model
    trainer.test_model()
    
    # Save model
    if not trainer.save_model():
        print("Failed to save model.")
        return False
    
    print("\n=== Training Complete ===")
    print("Model is ready for integration with the legal chatbot!")
    return True

if __name__ == "__main__":
    main()
