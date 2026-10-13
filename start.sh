#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "============================================================"
echo "    🚀 Starting Octa AI Activity Platform"
echo "============================================================"

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ All services stopped."
    exit 0
}

# Register the cleanup function to be called on the EXIT signal
trap cleanup SIGINT SIGTERM EXIT

# 1. Start the Backend
echo "📦 Starting Backend API (FastAPI)..."
source apps/api/venv/bin/activate
PYTHONPATH=. uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. Start the Frontend
echo "🌐 Starting Frontend Web (Next.js)..."
cd apps/web
npm run dev &
FRONTEND_PID=$!
cd ../..

# 3. Wait for Backend to be ready and perform Health Check
echo "⏳ Waiting for API to become healthy..."

MAX_RETRIES=15
RETRY_COUNT=0
HEALTH_URL="http://localhost:8000/api/health"

while ! curl -s $HEALTH_URL > /dev/null; do
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Error: Backend API did not start within 30 seconds."
        exit 1
    fi
done

echo "============================================================"
echo "    ✅ System Health Report"
echo "============================================================"

# Use python to parse and display the JSON beautifully
source apps/api/venv/bin/activate
python3 -c "
import urllib.request
import json
import sys

try:
    req = urllib.request.urlopen('$HEALTH_URL')
    data = json.loads(req.read().decode('utf-8'))
    
    print(f'API Status:      🟢 Running ({data.get(\"status\")})')
    print(f'Environment:     {data.get(\"environment\")}')
    
    excel = data.get('excel', {})
    if excel.get('configured') and excel.get('initialized'):
        print(f'Excel Storage:   🟢 Configured and Initialized')
    else:
        print(f'Excel Storage:   🔴 Not initialized')
        
    ai = data.get('ai', {})
    if ai.get('configured'):
        print('AI Connection:   🟢 Connected (Provider: {}, Model: {}, Temp: {}, Tokens: {})'.format(
            ai.get('provider'), ai.get('model'), ai.get('temperature'), ai.get('max_tokens')
        ))
    else:
        print(f'AI Connection:   🔴 Disconnected / API Key Missing')

except Exception as e:
    print(f'❌ Failed to fetch health status: {e}')
"

echo "============================================================"
echo "    🚀 Ready!"
echo "    Frontend is running at: http://localhost:3000"
echo "    Backend API is at:      http://localhost:8000"
echo "    Press Ctrl+C to stop all services."
echo "============================================================"

# Wait for background processes so the script doesn't exit immediately
wait $BACKEND_PID $FRONTEND_PID
