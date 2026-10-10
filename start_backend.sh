#!/usr/bin/env bash
# MethXAI Fusion - Complete Backend Startup Script
# Automatically frees port 8000, checks Ollama AI, and launches FastAPI server

set -e

# Get workspace directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "🚀 Starting MethXAI Fusion Backend Ecosystem"
echo "============================================================"

# 1. Clean up port 8000 if occupied
echo "🔍 Cleaning up any existing process on port 8000..."
lsof -t -i:8000 | xargs kill -9 2>/dev/null || true
sleep 1

# 2. Check & start Ollama AI LLM service if needed
echo "🤖 Checking local Ollama LLM service (http://127.0.0.1:11434)..."
if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "⚙️  Ollama service offline. Starting 'ollama serve' in background..."
  ollama serve >/dev/null 2>&1 &
  sleep 3
else
  echo "✅ Local Ollama AI service is online!"
fi

# 3. Check virtualenv & dependencies
if [ ! -f "$SCRIPT_DIR/backend/venv/bin/uvicorn" ]; then
  echo "❌ Backend virtualenv missing or incomplete. Creating environment..."
  python3 -m venv "$SCRIPT_DIR/backend/venv"
  "$SCRIPT_DIR/backend/venv/bin/pip" install fastapi "uvicorn[standard]" websockets pydantic requests
fi

echo "============================================================"
echo "🌐 FastAPI Server starting at:"
echo "   - Local Host: http://localhost:8000"
echo "   - Network IP: http://10.155.26.85:8000"
echo "   - WebSocket:  ws://10.155.26.85:8000/ws"
echo "============================================================"

# 4. Launch FastAPI Server
exec "$SCRIPT_DIR/backend/venv/bin/uvicorn" backend.main:app --host 0.0.0.0 --port 8000 --reload
