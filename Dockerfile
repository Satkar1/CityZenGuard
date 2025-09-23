# Multi-stage Dockerfile for Render deployment with Node.js + Python

# Stage 1: Build the application
FROM node:20-bullseye AS builder

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./

# Install Node.js dependencies
RUN npm install --legacy-peer-deps


# Copy source code
COPY . .

# Install Python dependencies
COPY scripts/rag/requirements.txt scripts/rag/
RUN python3 -m pip install --user -r scripts/rag/requirements.txt

# Build the RAG index
RUN python3 scripts/rag/build_index.py

# Build the application
RUN npm run build

# Stage 2: Production image
FROM node:20-bullseye-slim

# Install Python runtime
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python dependencies installation
COPY scripts/rag/requirements.txt scripts/rag/
RUN python3 -m pip install --user -r scripts/rag/requirements.txt

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/data ./data
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built RAG index
COPY --from=builder /app/server/rag ./server/rag

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
