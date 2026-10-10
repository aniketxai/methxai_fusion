#!/usr/bin/env bash
# MethXAI Fusion - Start All Stack (Backend + Ollama + Frontend React Dashboard)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "⚡ Starting MethXAI Fusion Full Stack (Backend + Frontend)"
echo "============================================================"

# Trap SIGINT to stop both processes cleanly when user presses Ctrl+C
trap 'echo "Stopping processes..."; kill $(jobs -p) 2>/dev/null || true; exit 0' SIGINT SIGTERM

# 1. Run backend startup script in background
bash "$SCRIPT_DIR/start_backend.sh" &
BACKEND_PID=$!

sleep 3

# 2. Start Frontend React Vite Dashboard
echo "============================================================"
echo "🌐 Starting React Frontend Dashboard..."
echo "============================================================"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

wait
