from flask import Flask, request, jsonify, send_from_directory
import os
import time
import base64
import json
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv
import tempfile
from datetime import datetime

app = Flask(__name__, static_folder='static')

load_dotenv()

# Configure upload folder for file handling
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'mp3', 'mp4', 'wav'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is required")

try:
    genai.configure(api_key=api_key)
    
    # Enhanced model configuration
    generation_config = {
        "temperature": 0.9,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 32768,
        "stop_sequences": [],
    }

    # System prompt for consistent behavior
    SYSTEM_PROMPT = """You're RavenIV, a powerful and intelligent assistant designed to provide helpful, accurate, and engaging responses. 
    Remember to:
    1. Always greet users by name if known
    2. Maintain context throughout conversations
    3. Provide detailed, well-structured responses
    4. Ask clarifying questions when needed
    5. Be factual and accurate while remaining engaging
    You can process text, images, audio, and handle various file formats."""

    # Initialize the model with enhanced configuration
    model = genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        generation_config=generation_config,
        safety_settings={
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE
        }
    )
    
except Exception as e:
    raise

# Serve static files (HTML, CSS, JS)
@app.route('/')
def serve_app():
    return send_from_directory('static', 'index.html')

# Enhanced session management
class ChatSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.chat = model.start_chat(history=[])
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.message_count = 0
        self.history = []

    def update_activity(self):
        self.last_activity = datetime.now()
        self.message_count += 1

    def add_to_history(self, message, response):
        self.history.append({
            'timestamp': datetime.now().isoformat(),
            'message': message,
            'response': response
        })

chat_sessions = {}

def cleanup_old_sessions():
    """Remove sessions that are inactive for more than 24 hours"""
    current_time = datetime.now()
    for session_id in list(chat_sessions.keys()):
        session = chat_sessions[session_id]
        if (current_time - session.last_activity).total_seconds() > 86400:  # 24 hours
            del chat_sessions[session_id]

@app.route('/api/test', methods=['GET'])
def test():
    """Test endpoint to verify the server is running"""
    return jsonify({
        'status': 'ok',
        'message': 'Server is running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        
        session_id = data.get('session_id')
        message = data.get('message', '')
        files = data.get('files', [])
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400
            
        # Process any files if present
        processed_files = []
        if files:
            for file_data in files:
                if not file_data.get('data') or not file_data.get('mime_type'):
                    continue
                try:
                    file_path = process_file(file_data)
                    processed_files.append(file_path)
                except Exception as e:
                    return jsonify({'error': f'Error processing file: {str(e)}'}), 400

        # Create or get chat session
        if session_id not in chat_sessions:
            try:
                chat_sessions[session_id] = ChatSession(session_id)
            except Exception as e:
                return jsonify({'error': f'Error creating chat session: {str(e)}'}), 500
        
        session = chat_sessions[session_id]
        
        try:
            # Prepare message with files if any
            if processed_files:
                message_parts = [message] if message else []
                message_parts.extend(processed_files)
                response = session.chat.send_message(message_parts)
            else:
                response = session.chat.send_message(message)
            
            # Update session data
            session.update_activity()
            session.add_to_history(message, response.text)
            
            # Clean up old sessions periodically
            if session.message_count % 10 == 0:  # Cleanup every 10 messages
                cleanup_old_sessions()
            
            return jsonify({
                'response': response.text,
                'session_id': session_id,
                'message_count': session.message_count
            })
            
        except Exception as e:
            return jsonify({'error': f'Error generating response: {str(e)}'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/reset', methods=['POST'])
def reset_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if session_id in chat_sessions:
            del chat_sessions[session_id]
            
        return jsonify({
            'success': True,
            'message': 'Session reset successfully',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': f'Error resetting session: {str(e)}'}), 500

def process_file(file_data):
    """Process uploaded file data"""
    try:
        # Remove data URL prefix if present
        if 'base64,' in file_data['data']:
            file_data['data'] = file_data['data'].split('base64,')[1]
            
        # Decode base64 data
        file_bytes = base64.b64decode(file_data['data'])
        
        # Create temporary file
        suffix = '.' + file_data['mime_type'].split('/')[-1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(file_bytes)
            return temp_file.name
    except Exception as e:
        raise

@app.route('/api/session/info', methods=['GET'])
def session_info():
    """Get information about active sessions"""
    session_id = request.args.get('session_id')
    
    if session_id and session_id in chat_sessions:
        session = chat_sessions[session_id]
        return jsonify({
            'session_id': session_id,
            'created_at': session.created_at.isoformat(),
            'last_activity': session.last_activity.isoformat(),
            'message_count': session.message_count
        })
    
    return jsonify({
        'active_sessions': len(chat_sessions),
        'sessions': [{
            'session_id': sid,
            'message_count': session.message_count,
            'last_activity': session.last_activity.isoformat()
        } for sid, session in chat_sessions.items()]
    })
