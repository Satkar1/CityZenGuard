import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { analyzeLegalContent } from "./gemini";

interface QAPair {
  question: string;
  answer: string;
  category: string;
  original_question: string;
}

interface ModelPrediction {
  answer: string;
  confidence: number;
  category: string;
  source: 'trained_model' | 'gemini_ai' | 'fallback';
}

interface ModelMetadata {
  training_date: string;
  num_qa_pairs: number;
  num_categories: number;
  feature_count: number;
  model_version: string;
}

export class MLLegalAssistant {
  private modelPath: string;
  private qaPairs: QAPair[] = [];
  private categories: string[] = [];
  private metadata: ModelMetadata | null = null;
  private isModelLoaded: boolean = false;
  private confidenceThreshold: number = 0.3;

  constructor() {
    this.modelPath = path.join(process.cwd(), 'server', 'models');
    this.loadModel();
  }

  /**
   * Load the trained model and data
   */
  private async loadModel(): Promise<void> {
    try {
      // Check if model files exist
      const qaPath = path.join(this.modelPath, 'qa_pairs.json');
      const categoriesPath = path.join(this.modelPath, 'categories.json');
      const metadataPath = path.join(this.modelPath, 'metadata.json');

      if (!fs.existsSync(qaPath) || !fs.existsSync(categoriesPath) || !fs.existsSync(metadataPath)) {
        console.log("Model files not found. Trained model will be unavailable.");
        return;
      }

      // Load Q&A pairs
      const qaData = fs.readFileSync(qaPath, 'utf-8');
      this.qaPairs = JSON.parse(qaData);

      // Load categories
      const categoriesData = fs.readFileSync(categoriesPath, 'utf-8');
      this.categories = JSON.parse(categoriesData);

      // Load metadata
      const metadataData = fs.readFileSync(metadataPath, 'utf-8');
      this.metadata = JSON.parse(metadataData);

      this.isModelLoaded = true;
      console.log(`✅ ML Legal Model loaded: ${this.qaPairs.length} Q&A pairs, ${this.categories.length} categories`);
      console.log(`📅 Training date: ${this.metadata?.training_date}`);
      
    } catch (error) {
      console.error("Error loading ML model:", error);
      this.isModelLoaded = false;
    }
  }

  /**
   * Predict answer using Python ML model
   */
  private async predictWithML(question: string): Promise<ModelPrediction | null> {
    return new Promise((resolve) => {
      if (!this.isModelLoaded) {
        resolve(null);
        return;
      }

      // Create Python script to run prediction
      const pythonScript = `
import joblib
import json
import sys
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer
import re

# Initialize preprocessing tools
try:
    stop_words = set(stopwords.words('english'))
    stemmer = PorterStemmer()
except:
    # Fallback if NLTK data not available
    stop_words = set()
    stemmer = PorterStemmer()

def preprocess_text(text):
    text = str(text).lower()
    text = re.sub(r'[^\\w\\s]', ' ', text)
    text = re.sub(r'\\s+', ' ', text).strip()
    
    try:
        tokens = word_tokenize(text)
        tokens = [stemmer.stem(token) for token in tokens 
                 if token not in stop_words and len(token) > 2]
        return ' '.join(tokens)
    except:
        # Fallback tokenization
        tokens = text.split()
        return ' '.join([token for token in tokens if len(token) > 2])

try:
    # Load model components
    vectorizer = joblib.load('${this.modelPath}/vectorizer.pkl')
    classifier = joblib.load('${this.modelPath}/classifier.pkl')
    question_vectors = joblib.load('${this.modelPath}/question_vectors.pkl')
    
    with open('${this.modelPath}/qa_pairs.json', 'r', encoding='utf-8') as f:
        qa_pairs = json.load(f)
    
    # Process input question
    question = "${question.replace(/"/g, '\\"')}"
    processed_question = preprocess_text(question)
    
    # Vectorize question
    question_vector = vectorizer.transform([processed_question])
    
    # Calculate similarities
    similarities = cosine_similarity(question_vector, question_vectors).flatten()
    
    # Find best match
    best_match_idx = np.argmax(similarities)
    best_similarity = float(similarities[best_match_idx])
    
    # Get category prediction
    predicted_category = classifier.predict(question_vector)[0]
    
    # Prepare result
    result = {
        "confidence": best_similarity,
        "category": predicted_category,
        "answer": qa_pairs[best_match_idx]["answer"] if best_similarity > 0.3 else "",
        "original_question": qa_pairs[best_match_idx]["original_question"] if best_similarity > 0.3 else ""
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        "confidence": 0.0,
        "category": "error", 
        "answer": "",
        "error": str(e)
    }
    print(json.dumps(error_result))
`;

      // Write temporary Python script
      const tempScriptPath = path.join(this.modelPath, 'temp_predict.py');
      fs.writeFileSync(tempScriptPath, pythonScript);

      // Execute Python script
      const pythonProcess = spawn('python', [tempScriptPath], {
        cwd: this.modelPath
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim());
            
            if (result.confidence >= this.confidenceThreshold) {
              resolve({
                answer: result.answer,
                confidence: result.confidence,
                category: result.category,
                source: 'trained_model'
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            console.error("Error parsing ML prediction result:", e);
            resolve(null);
          }
        } else {
          console.error("Python ML prediction failed:", errorOutput);
          resolve(null);
        }
      });

      // Set timeout
      setTimeout(() => {
        pythonProcess.kill();
        resolve(null);
      }, 10000); // 10 second timeout
    });
  }

  /**
   * Check if question is legal-related
   */
  private isLegalQuestion(question: string): boolean {
    const legalKeywords = [
      'legal', 'law', 'court', 'judge', 'lawyer', 'attorney', 'advocate',
      'fir', 'police', 'crime', 'criminal', 'arrest', 'bail', 'case',
      'rights', 'constitution', 'ipc', 'crpc', 'property', 'marriage',
      'divorce', 'consumer', 'cyber', 'women', 'child', 'domestic',
      'violence', 'dowry', 'harassment', 'fraud', 'theft', 'assault',
      'compensation', 'complaint', 'magistrate', 'session', 'supreme'
    ];

    const lowercaseQuestion = question.toLowerCase();
    return legalKeywords.some(keyword => lowercaseQuestion.includes(keyword));
  }

  /**
   * Generate response using trained model + Gemini fallback
   */
  async generateResponse(question: string): Promise<string> {
    try {
      // First, try the trained ML model
      const mlPrediction = await this.predictWithML(question);
      
      if (mlPrediction && mlPrediction.confidence >= this.confidenceThreshold) {
        console.log(`✅ ML Model Response (confidence: ${mlPrediction.confidence.toFixed(3)})`);
        
        return `${mlPrediction.answer}\n\n**Source:** Trained Legal AI Model (Confidence: ${(mlPrediction.confidence * 100).toFixed(1)}%)\n**Category:** ${mlPrediction.category}\n\n**Disclaimer:** This response is from our trained legal AI model. For specific legal advice, please consult a qualified lawyer.`;
      }

      // If ML model doesn't have a good answer, check if it's a legal question
      if (this.isLegalQuestion(question)) {
        console.log("🤖 Using Gemini AI for legal question");
        
        try {
          const geminiResponse = await analyzeLegalContent(question);
          return `${geminiResponse}\n\n**Source:** AI Assistant (Gemini)\n\n**Note:** This response is AI-generated for questions not covered in our trained model. For specific legal matters, please consult a qualified legal professional.`;
        } catch (error) {
          console.error("Gemini AI error:", error);
          return this.getFallbackResponse();
        }
      } else {
        // Non-legal question
        return "I specialize in legal assistance. Please ask questions related to Indian law, legal procedures, rights, or legal documentation. For general questions, you may want to consult a general-purpose assistant.";
      }

    } catch (error) {
      console.error("Error in ML Legal Assistant:", error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Fallback response when all methods fail
   */
  private getFallbackResponse(): string {
    return "I apologize, but I'm unable to process your query at the moment. For immediate legal assistance, please:\n\n1. Contact a qualified legal professional\n2. Visit the nearest legal aid center\n3. Call legal helpline numbers\n4. Consult with a lawyer\n\nFor emergency legal matters, contact local authorities or emergency services.";
  }

  /**
   * Get model statistics
   */
  getModelStats(): any {
    return {
      isLoaded: this.isModelLoaded,
      qaPairCount: this.qaPairs.length,
      categories: this.categories,
      metadata: this.metadata,
      confidenceThreshold: this.confidenceThreshold
    };
  }

  /**
   * Train new model with provided CSV data
   */
  async trainNewModel(csvPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log("🎯 Starting ML model training...");
      
      const pythonScript = path.join(process.cwd(), 'ml_training', 'train_legal_model.py');
      
      const trainingProcess = spawn('python', [pythonScript], {
        cwd: path.join(process.cwd(), 'ml_training'),
        env: { ...process.env, CSV_PATH: csvPath }
      });

      let output = '';
      let errorOutput = '';

      trainingProcess.stdout.on('data', (data) => {
        const text = data.toString();
        console.log(text);
        output += text;
      });

      trainingProcess.stderr.on('data', (data) => {
        const text = data.toString();
        console.error(text);
        errorOutput += text;
      });

      trainingProcess.on('close', (code) => {
        if (code === 0) {
          console.log("✅ Model training completed successfully!");
          this.loadModel(); // Reload the new model
          resolve(true);
        } else {
          console.error("❌ Model training failed:", errorOutput);
          resolve(false);
        }
      });
    });
  }
}

// Export singleton instance
export const mlLegalAssistant = new MLLegalAssistant();
