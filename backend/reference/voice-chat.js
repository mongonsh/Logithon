const chatMessages = document.getElementById('chatMessages');
const micButton = document.getElementById('micButton');
const voiceIndicator = document.getElementById('voiceIndicator');
const status = document.getElementById('status');
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');

let recognition = null;
let isRecording = false;
let conversationHistory = [];
let currentAudio = null;

// Initialize Speech Recognition
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
        recognition = new SpeechRecognition();
    } else {
        status.textContent = 'Speech recognition not supported in this browser';
        micButton.disabled = true;
        return;
    }

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isRecording = true;
        micButton.classList.add('recording');
        voiceIndicator.classList.add('active');
        status.textContent = 'Listening...';
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (interimTranscript) {
            status.textContent = `Hearing: "${interimTranscript}"`;
        }

        if (finalTranscript) {
            sendMessage(finalTranscript);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        status.textContent = `Error: ${event.error}`;
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
}

function startRecording() {
    if (recognition && !isRecording) {
        recognition.start();
    }
}

function stopRecording() {
    isRecording = false;
    micButton.classList.remove('recording');
    voiceIndicator.classList.remove('active');
    if (recognition) {
        recognition.stop();
    }
}

function addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

function addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loadingMessage';
    loadingDiv.innerHTML = `
        <div class="message-content">
            <div class="loading">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingMessage() {
    const loading = document.getElementById('loadingMessage');
    if (loading) {
        loading.remove();
    }
}

async function sendMessage(text) {
    if (!text.trim()) return;

    // Stop any playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Add user message to UI
    addMessage(text, 'user');
    status.textContent = 'Claude is thinking...';
    addLoadingMessage();

    // Add to conversation history
    conversationHistory.push({ role: 'user', content: text });

    try {
        // Call backend API
        const response = await fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: text,
                history: conversationHistory
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get response');
        }

        const data = await response.json();
        removeLoadingMessage();

        // Add assistant message to UI
        const messageDiv = addMessage(data.response, 'assistant');

        // Add to conversation history
        conversationHistory.push({ role: 'assistant', content: data.response });

        // Play audio response if available
        if (data.audio_url) {
            status.textContent = 'Claude is speaking...';
            messageDiv.querySelector('.message-content').classList.add('speaking');

            currentAudio = new Audio(data.audio_url);
            currentAudio.onended = () => {
                status.textContent = 'Click the microphone to speak';
                messageDiv.querySelector('.message-content').classList.remove('speaking');
            };
            currentAudio.onerror = () => {
                status.textContent = 'Audio playback failed';
                messageDiv.querySelector('.message-content').classList.remove('speaking');
            };
            currentAudio.play();
        } else {
            status.textContent = 'Click the microphone to speak';
        }

    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage();
        addMessage('Sorry, there was an error. Please try again.', 'assistant');
        status.textContent = 'Error occurred. Click microphone to try again.';
    }
}

// Event Listeners
micButton.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

sendButton.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        sendMessage(text);
        textInput.value = '';
    }
});

textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const text = textInput.value.trim();
        if (text) {
            sendMessage(text);
            textInput.value = '';
        }
    }
});

// Initialize
initSpeechRecognition();
