# Use slim Python base
FROM python:3.11-slim AS base

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y build-essential git

# Copy Python requirements
COPY requirements.txt .

# Install Python deps
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy rag service code and embeddings
COPY rag_service /app/rag_service
COPY embeddings.pkl /app/embeddings.pkl

# Start FastAPI/Flask app
CMD ["python", "rag_service/app.py"]
