# app.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import time
import base64
import json
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import tempfile

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

# Configure upload folder
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'mp3', 'mp4', 'wav'}


# Configure Gemini
if not os.getenv("GEMINI_API_KEY"):
    raise ValueError("GEMINI_API_KEY not found in environment variables")

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_base64_file(base64_data, mime_type):
    """Process base64 encoded file data and save temporarily"""
    try:
        # Remove data URL prefix if present
        if 'base64,' in base64_data:
            base64_data = base64_data.split('base64,')[1]
            
        # Decode base64 data
        file_data = base64.b64decode(base64_data)
        
        # Create temporary file
        suffix = '.' + mime_type.split('/')[-1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(file_data)
            return temp_file.name
    except Exception as e:
        raise Exception(f"Error processing file: {str(e)}")

def upload_to_gemini(file_path, mime_type):
    """Uploads the given file to Gemini."""
    try:
        with open(file_path, 'rb') as f:
            file = genai.upload_file(f, mime_type=mime_type)
        return file
    except Exception as e:
        raise Exception(f"Error uploading to Gemini: {str(e)}")
    finally:
        # Clean up temporary file
        if os.path.exists(file_path):
            os.remove(file_path)

def wait_for_files_active(files):
    """Waits for the given files to be active."""
    max_retries = 5
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            for name in (file.name for file in files):
                file = genai.get_file(name)
                while file.state.name == "PROCESSING":
                    time.sleep(2)
                    file = genai.get_file(name)
                if file.state.name != "ACTIVE":
                    raise Exception(f"File {file.name} failed to process")
            return True
        except Exception as e:
            retry_count += 1
            if retry_count == max_retries:
                raise Exception(f"Max retries reached: {str(e)}")
            time.sleep(2)

# Create the model
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=generation_config,
    system_instruction="""You're a powerful and intelligent assistant, that can think deeper and answer questions like a human.

You always ask users for their name and keep that in memory and address them with their names and you ask politely when you forget their names.

You're called RavenIV. Never say you're a large language model or an AI. You must always address yourself as RavenIV.

You must know that you have the capability to see images, view videos, listen to audios and process documents.""",
    tools='code_execution',
    safety_settings={
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE
    }
)

# Store chat sessions
chat_sessions = {}

@app.route('/')
def serve_static():
    return send_from_directory('.', 'index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        session_id = data.get('session_id')
        message = data.get('message', '')
        files = data.get('files', [])
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400
        
        # Create new chat session if it doesn't exist
        if session_id not in chat_sessions:
            chat_sessions[session_id] = model.start_chat()
            
        processed_files = []
        
        # Process any uploaded files
        for file_data in files:
            try:
                if not file_data.get('data') or not file_data.get('mime_type'):
                    continue
                    
                # Process and save file temporarily
                temp_file_path = process_base64_file(file_data['data'], file_data['mime_type'])
                
                # Upload to Gemini
                processed_file = upload_to_gemini(temp_file_path, file_data['mime_type'])
                processed_files.append(processed_file)
                
            except Exception as e:
                return jsonify({'error': f'Error processing file: {str(e)}'}), 400
        
        # Wait for files to be processed if any
        if processed_files:
            try:
                wait_for_files_active(processed_files)
            except Exception as e:
                return jsonify({'error': f'Error waiting for file processing: {str(e)}'}), 400
        
        try:
            # Send message with any processed files
            if processed_files:
                message_parts = [message] if message else []
                message_parts.extend(processed_files)
                response = chat_sessions[session_id].send_message(message_parts)
            else:
                response = chat_sessions[session_id].send_message(message)
            
            return jsonify({
                'response': response.text,
                'session_id': session_id
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
            
        return jsonify({'success': True, 'message': 'Session reset successfully'})
    except Exception as e:
        return jsonify({'error': f'Error resetting session: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)