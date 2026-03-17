#!/bin/bash
# AI Agent Office — start both backend and frontend

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Starting AI Agent Office"

# Backend
cd "$ROOT"
if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r backend/requirements.txt
else
  source .venv/bin/activate
fi

# Copy .env.example to .env if missing
if [ ! -f ".env" ]; then
  echo "No .env found — copying .env.example. Fill in your credentials."
  cp .env.example .env
fi

echo "==> Starting FastAPI backend on :8000"
PYTHONPATH="$ROOT" uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
echo "==> Starting React frontend on :5173"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
