import urllib.request
import json
import os

api_key = "'" + os.environ.get("Gemini_API_KEY", "") + "'"
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"

try:
    req = urllib.request.urlopen(url)
    data = json.loads(req.read().decode('utf-8'))
    for model in data.get('models', []):
        print(model.get('name'))
except Exception as e:
    print(e)
