# Multi-stage build for BorderVision AI (Frontend + FastAPI backend)
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Python runtime stage
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for OpenCV and video handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Copy production frontend build from builder stage
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist ./backend/dist

# Ensure writable directories for Hugging Face user (UID 1000) and root
RUN mkdir -p /app/data /app/backend/data /tmp/Ultralytics && \
    chmod -R 777 /app /tmp

# Expose default port (7860 for Hugging Face Spaces, or dynamic $PORT for Render/Railway)
ENV PORT=7860
ENV PYTHON_VERSION=3.11.9
ENV YOLO_CONFIG_DIR=/tmp/Ultralytics
EXPOSE 7860

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-7860}/health || exit 1

# Launch uvicorn
CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]

