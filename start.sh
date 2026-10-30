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
    if [ -n "$BACKEND_PID" ]; then
        kill -TERM $BACKEND_PID 2>/dev/null || true
        pkill -P $BACKEND_PID 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill -TERM $FRONTEND_PID 2>/dev/null || true
        pkill -P $FRONTEND_PID 2>/dev/null || true
    fi
    echo "✅ All services stopped."
    exit 0
}

# Register the cleanup function to be called on the EXIT signal
trap cleanup SIGINT SIGTERM EXIT

# Find Python 3.10+
find_python() {
    for cmd in python3.12 python3.11 python3.10 python3; do
        if command -v "$cmd" >/dev/null 2>&1; then
            version=$("$cmd" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)
            if [ -n "$version" ]; then
                major=$(echo "$version" | cut -d. -f1)
                minor=$(echo "$version" | cut -d. -f2)
                if [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; then
                    command -v "$cmd"
                    return 0
                fi
            fi
        fi
    done
    return 1
}

# Ensure Backend venv exists and has a valid Python interpreter
if [ ! -d "apps/api/venv" ] || [ ! -x "apps/api/venv/bin/python" ] || ! apps/api/venv/bin/python --version >/dev/null 2>&1 || [ ! -x "apps/api/venv/bin/uvicorn" ]; then
    echo "⚠️  Backend virtual environment is missing or invalid. Initializing..."
    PYTHON_EXEC=$(find_python)
    if [ -z "$PYTHON_EXEC" ]; then
        echo "❌ Error: Python 3.10 or newer is required but was not found."
        exit 1
    fi
    echo "Using Python: $PYTHON_EXEC ($($PYTHON_EXEC --version))"
    "$PYTHON_EXEC" -m venv --clear apps/api/venv
    apps/api/venv/bin/pip install --upgrade pip --quiet
    apps/api/venv/bin/pip install -r apps/api/requirements.txt
fi

# Ensure frontend dependencies are installed
if [ ! -d "apps/web/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd apps/web && npm install && cd ../..
fi

# 1. Start the Backend
echo "📦 Starting Backend API (FastAPI)..."
source apps/api/venv/bin/activate
PYTHONPATH=. apps/api/venv/bin/uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload &
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
apps/api/venv/bin/python -c "
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
