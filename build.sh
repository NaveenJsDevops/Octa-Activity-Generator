#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "============================================================"
echo "    🔨 Building Octa AI Activity Platform"
echo "============================================================"

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

# 1. Setup Backend Python Environment
echo "🐍 Setting up Backend environment..."
PYTHON_EXEC=$(find_python)
if [ -z "$PYTHON_EXEC" ]; then
    echo "❌ Error: Python 3.10 or newer is required but was not found."
    exit 1
fi
echo "Using Python: $PYTHON_EXEC ($($PYTHON_EXEC --version))"

if [ ! -d "apps/api/venv" ] || [ ! -x "apps/api/venv/bin/python" ] || ! apps/api/venv/bin/python --version >/dev/null 2>&1; then
    echo "📦 Creating virtual environment in apps/api/venv..."
    "$PYTHON_EXEC" -m venv --clear apps/api/venv
fi

if ! apps/api/venv/bin/python -c "import fastapi, uvicorn, pydantic, pandas, openpyxl, openai, anthropic, ddgs" >/dev/null 2>&1; then
    echo "📦 Installing backend dependencies..."
    apps/api/venv/bin/pip install -r apps/api/requirements.txt
else
    echo "✅ Backend dependencies are already installed."
fi

# 2. Initialize Master Data
echo "📊 Initializing master data and storage..."
PYTHONPATH=. apps/api/venv/bin/python apps/api/scripts/init_master_data.py

# 3. Setup Frontend Environment
echo "🌐 Setting up Frontend (Next.js)..."
if [ ! -d "apps/web/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd apps/web && npm install && cd ../..
fi

echo "🏗️ Building Frontend..."
cd apps/web && npm run build && cd ../..

echo "============================================================"
echo "    ✅ Build complete!"
echo "    Run './start.sh' to start both Backend and Frontend."
echo "============================================================"
