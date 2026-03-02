#!/bin/bash
set -a
source .env 2>/dev/null || true
set +a

echo "🎬 Cinema Graph Agent — Backend"
echo "Memgraph: ${MEMGRAPH_URI:-bolt://localhost:7687}"
echo "Gemini: $([ -n "$GEMINI_API_KEY" ] && echo 'configured ✓' || echo 'NOT SET ✗')"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
