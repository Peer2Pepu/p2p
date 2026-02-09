# NSFW Moderation Service

Simple Python FastAPI service for NSFW image detection.

## Quick Start

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the service:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. **Test it:**
   Open http://localhost:8000/health in your browser. You should see:
   ```json
   {"status":"ok","model":"Falconsai/nsfw_image_detection","block_threshold":0.9}
   ```

## First Run

The first time you run it, it will download the ML model (~500MB). This happens automatically and takes a few minutes. Be patient!

## Configuration

Set environment variables before running:

```bash
# Windows PowerShell
$env:BLOCK_THRESHOLD="0.90"
$env:BLUR_THRESHOLD="0.70"
uvicorn main:app --host 0.0.0.0 --port 8000

# Windows CMD
set BLOCK_THRESHOLD=0.90
set BLUR_THRESHOLD=0.70
uvicorn main:app --host 0.0.0.0 --port 8000

# Linux/Mac
BLOCK_THRESHOLD=0.90 BLUR_THRESHOLD=0.70 uvicorn main:app --host 0.0.0.0 --port 8000
```

Or create a `.env` file (requires python-dotenv package).

## Keep It Running

The service needs to stay running while your Next.js app is running. Keep the terminal window open, or run it in the background.
