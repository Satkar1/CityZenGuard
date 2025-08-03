#!/usr/bin/env python3
"""
Setup script to prepare the environment and train the legal AI model
Run this script with your CSV file to train the model
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

def setup_environment():
    """Setup the Python environment and install required packages"""
    print("🔧 Setting up Python environment...")
    
    try:
        # Install required packages
        packages = ["pandas", "scikit-learn", "numpy", "joblib"]
        for package in packages:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print("✅ Environment setup complete!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Environment setup failed: {e}")
        return False

def create_sample_csv():
    """Create a sample CSV file for demonstration"""
    import pandas as pd
    
    sample_data = [
        {
            "question": "How to file an FIR?",
            "answer": "An FIR (First Information Report) can be filed at any police station. Visit the nearest police station with relevant documents and details of the incident. You can also file online FIR for certain types of crimes through your state police website.",
            "category": "FIR"
        },
        {
            "question": "What are my rights during arrest?",
            "answer": "During arrest, you have the right to remain silent, right to know the reason for arrest, right to have a lawyer present, right to be produced before magistrate within 24 hours, and right to inform someone about your arrest.",
            "category": "Rights"
        },
        {
            "question": "How to apply for bail?",
            "answer": "Bail can be applied through police bail for minor offenses or court bail by filing application before magistrate. You need to submit bail application with grounds, surety details, and undertaking.",
            "category": "Bail"
        },
        {
            "question": "What is domestic violence law?",
            "answer": "The Protection of Women from Domestic Violence Act 2005 provides protection to women from domestic violence. It includes physical, emotional, sexual, verbal and economic abuse. Victims can file complaints and get protection orders.",
            "category": "Women Rights"
        },
        {
            "question": "How to file consumer complaint?",
            "answer": "Consumer complaints can be filed at District Forum (disputes up to ₹1 crore), State Commission (₹1 crore to ₹10 crore), or National Commission (above ₹10 crore). File within 2 years with required documents.",
            "category": "Consumer Rights"
        }
    ]
    
    df = pd.DataFrame(sample_data)
    sample_path = "sample_legal_data.csv"
    df.to_csv(sample_path, index=False)
    print(f"📝 Created sample CSV file: {sample_path}")
    return sample_path

def train_model(csv_path):
    """Train the legal AI model using the provided CSV"""
    print(f"🎯 Training model with data from: {csv_path}")
    
    # Check if CSV file exists
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return False
    
    # Run the training script
    training_script = Path("ml_training/train_legal_model.py")
    if not training_script.exists():
        print(f"❌ Training script not found: {training_script}")
        return False
    
    try:
        # Create a custom training script with the CSV path
        custom_script = f"""
import sys
import os
sys.path.append('{os.getcwd()}')
sys.path.append('{os.getcwd()}/ml_training')

# Import the training class
from ml_training.train_legal_model import LegalModelTrainer

def main():
    trainer = LegalModelTrainer(csv_path='{csv_path}')
    
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
    
    print("\\n=== Training Complete ===")
    print("Model is ready for integration with the legal chatbot!")
    return True

if __name__ == "__main__":
    main()
"""
        
        # Write and run the custom script
        custom_script_path = "temp_train.py"
        with open(custom_script_path, 'w') as f:
            f.write(custom_script)
        
        # Run training script
        result = subprocess.run(
            [sys.executable, custom_script_path],
            capture_output=True,
            text=True
        )
        
        # Clean up
        if os.path.exists(custom_script_path):
            os.remove(custom_script_path)
        
        if result.returncode == 0:
            print("✅ Model training completed successfully!")
            print(result.stdout)
            return True
        else:
            print("❌ Model training failed!")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Training error: {e}")
        return False

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Setup and train legal AI model")
    parser.add_argument("--csv", help="Path to CSV file with training data")
    parser.add_argument("--setup-only", action="store_true", help="Only setup environment")
    parser.add_argument("--sample", action="store_true", help="Create and use sample data")
    
    args = parser.parse_args()
    
    print("=== Legal AI Model Training Setup ===")
    
    # Setup environment
    if not setup_environment():
        print("❌ Setup failed. Please check your Python installation.")
        return False
    
    if args.setup_only:
        print("✅ Environment setup complete. Run with --csv to train model.")
        return True
    
    # Determine CSV path
    csv_path = None
    if args.sample:
        csv_path = create_sample_csv()
    elif args.csv:
        csv_path = args.csv
    else:
        # Look for common CSV file names
        possible_files = [
            "enhanced_labeled.csv",
            "attached_assets/enhanced_labeled.csv",
            "legal_data.csv",
            "training_data.csv"
        ]
        
        for file_path in possible_files:
            if os.path.exists(file_path):
                csv_path = file_path
                print(f"📁 Found CSV file: {csv_path}")
                break
        
        if not csv_path:
            print("❌ No CSV file found. Use --csv to specify path or --sample to create sample data.")
            return False
    
    # Train model
    success = train_model(csv_path)
    
    if success:
        print("\n🎉 Setup complete! Your legal AI chatbot is ready to use.")
        print("The model will now provide intelligent responses based on your training data.")
        print("Questions not covered by the model will fall back to Gemini AI.")
    else:
        print("\n❌ Training failed. Please check the error messages above.")
    
    return success

if __name__ == "__main__":
    main()
