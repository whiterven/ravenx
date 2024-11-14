# RavenIV Chat Application - Deployment Guide

## Project Structure
```
raveniv-chat/
├── app.py              # Flask backend
├── index.html          # Frontend interface
├── requirements.txt    # Python dependencies
├── .env               # Environment variables
└── .gitignore         # Git ignore file
```

## Local Development Setup

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

4. Start the Flask server:
```bash
python app.py
```

5. Open index.html in your browser or serve it using a simple HTTP server:
```bash
python -m http.server 8000
```

## Vercel Deployment

1. Create a new Vercel project:
```bash
npm install -g vercel
vercel login
```

2. Create `vercel.json` in your project root:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.py"
    }
  ]
}
```

3. Set up environment variables in Vercel:
- Go to your project settings
- Add GEMINI_API_KEY to the environment variables

4. Deploy:
```bash
vercel
```

## Key Features

1. Real-time chat with Gemini AI
2. File upload support:
   - Images
   - PDFs
   - Audio files
   - Video files
3. Markdown rendering for bot responses
4. File preview capability
5. Error handling and display
6. Session management
7. Responsive design
8. Loading states and indicators

## Security Notes

1. Always keep your GEMINI_API_KEY secret
2. Add rate limiting for production
3. Implement user authentication if needed
4. Add input validation and sanitization
5. Secure file uploads with proper validation

## Troubleshooting

1. If files aren't uploading:
   - Check file size limits
   - Verify MIME types
   - Check temporary directory permissions

2. If chat isn't connecting:
   - Verify API key is set
   - Check CORS settings
   - Verify network connectivity

3. If deployment fails:
   - Check Vercel logs
   - Verify environment variables
   - Check Python version compatibility