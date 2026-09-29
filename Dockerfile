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

# Expose default Render web service port
ENV PORT=10000
ENV PYTHON_VERSION=3.11.9
ENV YOLO_CONFIG_DIR=/tmp/Ultralytics
EXPOSE 10000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# Launch uvicorn
CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
