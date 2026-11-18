import urllib.request
import json
import sys

try:
    req = urllib.request.urlopen("http://localhost:8000/api/health")
    data = json.loads(req.read().decode("utf-8"))
    
    print(f"API Status:      🟢 Running ({data.get('status')})")
    print(f"Environment:     {data.get('environment')}")
    
    db = data.get("database", {})
    if db.get("configured"):
        print(f"Database:        🟢 Cloud Firestore ({db.get('status')}, Project: {db.get('project')})")
    else:
        print(f"Database:        🟡 In-Memory (Firestore not connected)")
        
    ai = data.get("ai", {})
    if ai.get("configured"):
        print(f"AI Connection:   🟢 Connected (Provider: {ai.get('provider')}, Model: {ai.get('model')}, Temp: {ai.get('temperature')}, Tokens: {ai.get('max_tokens')})")
    else:
        print(f"AI Connection:   🔴 Disconnected / API Key Missing")

except Exception as e:
    print(f"❌ Failed to fetch health status: {e}")
