FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y build-essential git && \
    pip install --upgrade pip && pip install -r requirements.txt

COPY rag_service /app
COPY embeddings.pkl /app/embeddings.pkl

ENV PYTHONUNBUFFERED=1
ENV PORT=8000
CMD ["uvicorn", "query_api:app", "--host", "0.0.0.0", "--port", "8000"]
