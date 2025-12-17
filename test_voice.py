import requests
import json
import time

def test_chat():
    url = "http://localhost:8000/chat"
    payload = {
        "messages": [
            {"role": "user", "content": "Hello, this is a test for the new voice ID."}
        ],
        "context": {}
    }
    
    print(f"Sending request to {url}...")
    try:
        start_time = time.time()
        response = requests.post(url, json=payload)
        end_time = time.time()
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Response Data:")
            print(json.dumps(data, indent=2))
            
            if data.get("audio_url"):
                audio_url = f"http://localhost:8000{data['audio_url']}"
                print(f"Checking audio URL: {audio_url}")
                audio_resp = requests.head(audio_url)
                print(f"Audio URL Status: {audio_resp.status_code}")
                if audio_resp.status_code == 200:
                    print("SUCCESS: Audio file generated and accessible.")
                else:
                    print("FAILURE: Audio file not accessible.")
            else:
                print("WARNING: No audio_url in response. (Check if ElevenLabs key is set)")
        else:
            print(f"Error: {response.text}")
            
        print(f"Time taken: {end_time - start_time:.2f}s")
        
    except Exception as e:
        print(f"Exception during test: {e}")

if __name__ == "__main__":
    test_chat()
