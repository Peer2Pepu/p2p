# NSFW Image Moderation Setup

This guide explains how to set up NSFW image moderation for market creation.

## Overview

The moderation system uses a **local ML model** (no external AI API needed). It runs a Python FastAPI service that analyzes images before they're uploaded to IPFS.

## Architecture

1. **User uploads image** → Frontend checks image
2. **Frontend calls** → `/api/moderate-image` (Next.js API route)
3. **Next.js API calls** → Python moderation service (localhost:8000)
4. **Python service** → Uses local ML model to classify image
5. **If blocked** → Upload is rejected
6. **If allowed** → Image proceeds to IPFS upload

## Setup Steps

### 1. Set Up Python Moderation Service

Create a new directory for the Python service:

```bash
mkdir moderation-service
cd moderation-service
```

Create `requirements.txt`:
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
pillow==10.1.0
transformers==4.35.0
torch==2.1.0
numpy==1.24.3
```

Create `main.py` (use the code from the Pastebin you shared)

Install dependencies:
```bash
pip install -r requirements.txt
```

Start the service:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The service will be available at `http://localhost:8000`

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# Moderation service URL (default: http://localhost:8000)
MODERATION_SERVICE_URL=http://localhost:8000

# Enable/disable moderation (default: enabled)
NEXT_PUBLIC_ENABLE_MODERATION=true

# Behavior when moderation service is down:
# - "true" = allow images (fail-open)
# - "false" = block images (fail-closed, default)
MODERATION_FAIL_OPEN=false
NEXT_PUBLIC_MODERATION_FAIL_OPEN=false
```

### 3. Optional: Adjust Moderation Thresholds

In your Python service, you can adjust thresholds via environment variables:

```env
BLOCK_THRESHOLD=0.90    # Block if NSFW >= 90%
BLUR_THRESHOLD=0.70     # Blur if NSFW >= 70% (currently not used in market creation)
```

## How It Works

### Decision Flow

1. **NSFW Score ≥ 90%** → **BLOCK** (reject upload)
2. **NSFW Score ≥ 70%** → **BLUR** (currently allows, but logs warning)
3. **NSFW Score < 70%** → **ALLOW** (proceed with upload)

### For GIFs

- Samples multiple frames (first, middle, last, plus evenly spaced)
- Takes **maximum NSFW score** across all frames (conservative)
- If any frame is flagged, the entire GIF is blocked

## Testing

### Test the Python Service Directly

```bash
curl -X POST "http://localhost:8000/moderate" \
  -F "file=@test-image.jpg" \
  -F "return_blur=0"
```

### Test from Next.js

The moderation is automatically integrated into the market creation flow. When a user tries to create a market:

1. Image is checked first
2. If blocked → Error message shown, upload prevented
3. If allowed → Image proceeds to IPFS upload

## Troubleshooting

### Moderation Service Not Running

- **Fail-Open Mode** (`MODERATION_FAIL_OPEN=true`): Images are allowed if service is down
- **Fail-Closed Mode** (default): Images are blocked if service is down

### Model Download

The first time you run the service, it will download the ML model (~500MB). This happens automatically via Hugging Face transformers.

### Performance

- First request: ~5-10 seconds (model loading)
- Subsequent requests: ~1-2 seconds per image
- GIFs: ~2-5 seconds (depends on number of frames sampled)

## Production Deployment

For production, you should:

1. **Run the Python service** as a separate service (Docker, systemd, etc.)
2. **Update `MODERATION_SERVICE_URL`** to point to your production service
3. **Set `MODERATION_FAIL_OPEN=false`** for strict moderation
4. **Monitor the service** for availability

### Docker Example

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Cost

**Free!** No external API costs. The model runs locally on your server.

The only costs are:
- Server resources (CPU/RAM for running the model)
- Storage for the model (~500MB)
