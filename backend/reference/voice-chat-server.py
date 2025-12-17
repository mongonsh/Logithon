from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import anthropic
from elevenlabs import ElevenLabs
import os
import uuid
import base64

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize clients
claude_client = anthropic.Anthropic()
elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# Directory for audio files
AUDIO_DIR = "audio_output"
os.makedirs(AUDIO_DIR, exist_ok=True)

# Japanese female voice - Use "Yuki" or similar Japanese voice from ElevenLabs
# You can find Japanese voices at https://elevenlabs.io/voice-library
JAPANESE_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "XrExE9yKIg1WjnnlVkGX")  # Default to a Japanese voice

# IT Support System Prompt
IT_SUPPORT_SYSTEM_PROMPT = """あなたは「サクラ」という名前の社内ITサポートアシスタントです。日本語で丁寧に対応してください。

You are "Sakura" (さくら), a friendly and professional internal IT support voice assistant for our company. You speak in a warm, helpful Japanese operator style - polite, patient, and reassuring.

## Your Personality:
- Speak in a warm, professional Japanese customer service style
- Use polite expressions like "かしこまりました" (certainly), "少々お待ちください" (please wait a moment)
- Be patient and reassuring, especially when users are frustrated
- Always confirm understanding before providing solutions
- End conversations with encouraging phrases

## Your Capabilities - Common IT Issues You Can Help With:

### 1. PC Performance Issues (PCの動作が遅い・フリーズ)
- Frozen PC / unresponsive applications
- Slow performance
- High CPU/memory usage
- Recommend: Task Manager (Ctrl+Shift+Esc), restart, clear temp files

### 2. Dropbox Issues (Dropbox同期・権限の問題)
- Sync not working
- Permission requests ("Please add Dropbox permission")
- Storage full
- Selective sync settings
- Steps: Check Dropbox icon status, preferences, account storage, firewall settings

### 3. Email Issues - Thunderbird (Thunderbirdメール問題)
- Cannot receive emails
- Cannot send emails
- Account configuration
- IMAP/POP3/SMTP settings
- SSL/TLS certificate issues
- Steps: Check server settings, internet connection, account credentials

### 4. Network Issues (ネットワーク問題)
- Cannot connect to internet
- VPN connection problems
- Printer not found on network
- Steps: Check Wi-Fi, restart router, ipconfig commands

### 5. Password & Account Issues (パスワード・アカウント問題)
- Forgot password
- Account locked
- Multi-factor authentication issues
- Redirect to IT admin for password resets

### 6. Software Issues (ソフトウェア問題)
- Application won't start
- Crash errors
- Update failures
- License/activation issues

## Response Guidelines:
1. Greet warmly and ask for their name if first interaction
2. Listen carefully and confirm the issue
3. Provide step-by-step instructions clearly
4. Use simple language - avoid technical jargon
5. Offer to escalate to human IT staff if needed
6. Keep responses concise (2-4 sentences for voice)
7. IMPORTANT: Format for speech - no markdown, bullets, or special characters
8. If issue is complex, break into small steps and confirm each one

## Important Notes:
- For security issues or data breaches, escalate immediately
- Never ask for passwords
- Suggest creating IT ticket for hardware issues
- Business hours: 9:00-18:00 JST

Begin each conversation warmly, like a professional Japanese operator would."""


@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests - get response from Claude and convert to speech"""
    try:
        data = request.json
        user_message = data.get('message', '')
        history = data.get('history', [])

        if not user_message:
            return jsonify({'error': 'No message provided'}), 400

        # Prepare messages for Claude
        messages = []
        for msg in history[:-1]:  # Exclude the last message (current one)
            messages.append({
                'role': msg['role'],
                'content': msg['content']
            })

        # Add current message
        messages.append({
            'role': 'user',
            'content': user_message
        })

        # Get response from Claude
        response = claude_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=IT_SUPPORT_SYSTEM_PROMPT,
            messages=messages
        )

        assistant_response = response.content[0].text

        # Generate audio using ElevenLabs with Japanese voice
        audio_url = None
        try:
            audio = elevenlabs_client.text_to_speech.convert(
                voice_id=JAPANESE_VOICE_ID,
                text=assistant_response,
                model_id="eleven_multilingual_v2",
                voice_settings={
                    "stability": 0.5,
                    "similarity_boost": 0.8,
                    "style": 0.4,
                    "use_speaker_boost": True
                }
            )

            # Save audio file
            audio_filename = f"{uuid.uuid4()}.mp3"
            audio_path = os.path.join(AUDIO_DIR, audio_filename)

            with open(audio_path, 'wb') as f:
                for chunk in audio:
                    f.write(chunk)

            audio_url = f"http://localhost:5000/audio/{audio_filename}"

        except Exception as e:
            print(f"ElevenLabs error (continuing without audio): {e}")
            # Continue without audio if ElevenLabs fails

        return jsonify({
            'response': assistant_response,
            'audio_url': audio_url
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    """Serve audio files"""
    audio_path = os.path.join(AUDIO_DIR, filename)
    if os.path.exists(audio_path):
        return send_file(audio_path, mimetype='audio/mpeg')
    return jsonify({'error': 'Audio not found'}), 404


@app.route('/voices', methods=['GET'])
def list_voices():
    """List available ElevenLabs voices"""
    try:
        response = elevenlabs_client.voices.get_all()
        voices = [{'name': v.name, 'voice_id': v.voice_id} for v in response.voices]
        return jsonify({'voices': voices})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print("=" * 50)
    print("Voice Chat Server")
    print("=" * 50)
    print(f"Server running at http://localhost:5000")
    print(f"Open voice-chat.html in your browser to start chatting")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)
