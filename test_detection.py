#!/usr/bin/env python3
import requests
import json

# Test the detection endpoint
def test_detection():
    # You can test with any image file
    # For now, let's just test if the endpoint is working
    
    url = "http://localhost:8000/health"
    response = requests.get(url)
    print(f"Health check: {response.status_code} - {response.json()}")
    
    # Test chat endpoint
    chat_url = "http://localhost:8000/chat"
    chat_data = {
        "messages": [
            {"role": "user", "content": "Hello, can you describe how to efficiently organize 5 boxes that are 20cm x 50cm each?"}
        ],
        "context": {
            "boxes": [],
            "route": "warehouse A to warehouse B", 
            "vehicle": "van"
        }
    }
    
    chat_response = requests.post(chat_url, json=chat_data)
    print(f"Chat test: {chat_response.status_code}")
    if chat_response.status_code == 200:
        result = chat_response.json()
        print(f"AI Response: {result['reply']}")
        if result.get('audio_url'):
            print(f"Audio URL: {result['audio_url']}")
    else:
        print(f"Chat error: {chat_response.text}")

if __name__ == "__main__":
    test_detection()