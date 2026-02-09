import os
import io
import hashlib
from typing import Tuple
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageFilter, UnidentifiedImageError
import numpy as np

# Optional: simple CLIP-based nsfw classifier using transformers (binary nsfw score)
from transformers import AutoProcessor, AutoModelForImageClassification

BLOCK_THRESHOLD = float(os.getenv("BLOCK_THRESHOLD", "0.90"))
BLUR_THRESHOLD = float(os.getenv("BLUR_THRESHOLD", "0.70"))
MAX_GIF_FRAMES = int(os.getenv("MAX_GIF_FRAMES", "16"))
FRAME_SAMPLE_STRIDE = int(os.getenv("FRAME_SAMPLE_STRIDE", "2"))

MODEL_NAME = os.getenv("NSFW_MODEL", "Falconsai/nsfw_image_detection")

app = FastAPI(title="NSFW Moderation Service", version="0.1.0")

# Add CORS middleware to allow requests from Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your Next.js domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processor = AutoProcessor.from_pretrained(MODEL_NAME)
model = AutoModelForImageClassification.from_pretrained(MODEL_NAME)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def classify_image(img: Image.Image) -> dict:
    """Return unified {'nsfw': x, 'sfw': y} probabilities.

    For models like Falconsai/nsfw_image_detection with multi-class labels:
      Expected labels (case-insensitive): drawings, hentai, neutral, porn, sexy
      We'll define:
        explicit_nsfw = hentai + porn + sexy
        sfw = drawings + neutral
      If other labels or a binary (nsfw/sfw) model is used, adapt accordingly.
    """
    if img.mode != "RGB":
        img = img.convert("RGB")
    inputs = processor(images=img, return_tensors="pt")
    with np.errstate(all="ignore"):
        outputs = model(**inputs)
    probs = outputs.logits.softmax(dim=-1).detach().cpu().numpy()[0]
    id2label = {i: str(l).lower() for i, l in model.config.id2label.items()}
    label_probs = {id2label[i]: float(probs[i]) for i in range(len(probs))}

    if os.getenv("NSFW_DEBUG", "0") == "1":
        print(f"[NSFW_DEBUG] Model label_probs: {label_probs}")

    # Heuristic grouping
    nsfw_keywords = ["nsfw", "porn", "hentai", "sexy", "explicit", "adult", "erotic"]
    sfw_keywords = ["sfw", "neutral", "drawing", "drawings", "benign", "safe"]

    # Binary direct
    if "nsfw" in label_probs and "sfw" in label_probs:
        return {"nsfw": label_probs["nsfw"], "sfw": label_probs["sfw"], "raw": label_probs}

    nsfw_sum = 0.0
    sfw_sum = 0.0
    other_sum = 0.0
    for k, v in label_probs.items():
        if any(w in k for w in nsfw_keywords):
            nsfw_sum += v
        elif any(w in k for w in sfw_keywords):
            sfw_sum += v
        else:
            other_sum += v

    # Distribute ambiguous labels (other) proportionally 50/50
    if other_sum > 0:
        nsfw_sum += other_sum * 0.5
        sfw_sum += other_sum * 0.5

    total = nsfw_sum + sfw_sum
    if total <= 0:
        # degenerate fallback
        return {"nsfw": 0.0, "sfw": 1.0, "raw": label_probs}

    nsfw_norm = nsfw_sum / total
    sfw_norm = sfw_sum / total

    if os.getenv("NSFW_DEBUG", "0") == "1":
        print(f"[NSFW_DEBUG] grouped nsfw={nsfw_norm:.4f} (raw nsfw_sum={nsfw_sum:.4f}, sfw_sum={sfw_sum:.4f})")

    return {"nsfw": nsfw_norm, "sfw": sfw_norm, "raw": label_probs}


def aggregate(prob_list):
    # Take max nsfw across frames, min sfw (conservative)
    nsfw = max(p['nsfw'] for p in prob_list)
    sfw = min(p['sfw'] for p in prob_list)
    return {'nsfw': nsfw, 'sfw': sfw}


def decide(probs):
    nsfw = probs['nsfw']
    if nsfw >= BLOCK_THRESHOLD:
        return {'action': 'block', 'reason': 'nsfw>=block_threshold', 'score': nsfw}
    if nsfw >= BLUR_THRESHOLD:
        return {'action': 'blur', 'reason': 'nsfw>=blur_threshold', 'score': nsfw}
    return {'action': 'allow', 'reason': 'below_thresholds', 'score': nsfw}


def blur_image(img: Image.Image) -> Image.Image:
    # Full-image strong blur
    return img.filter(ImageFilter.GaussianBlur(radius=32))


def iter_gif_frames(img: Image.Image):
    try:
        i = 0
        while True:
            img.seek(i)
            frame = img.convert('RGB')
            yield frame
            i += 1
    except EOFError:
        return


@app.post("/moderate")
async def moderate(file: UploadFile = File(...), return_blur: int = Query(0, ge=0, le=1)):
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    file_hash = sha256_bytes(raw)

    try:
        img = Image.open(io.BytesIO(raw))
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    mime = Image.MIME.get(img.format, 'application/octet-stream')

    probs_list = []
    if img.format == 'GIF':
        # Determine total frames
        try:
            total_frames = 0
            while True:
                img.seek(total_frames)
                total_frames += 1
        except EOFError:
            pass
        # Select indices: first, middle, last plus evenly spaced
        if total_frames == 0:
            probs_list.append(classify_image(img.convert('RGB')))
        else:
            wanted = set()
            wanted.add(0)
            wanted.add(total_frames - 1)
            wanted.add(total_frames // 2)
            # Evenly spaced picks
            picks = min(MAX_GIF_FRAMES, total_frames)
            for i in range(picks):
                idx = int(i * (total_frames - 1) / max(picks - 1, 1))
                wanted.add(idx)
            # Apply stride hint too (FRAME_SAMPLE_STRIDE) by filtering
            final_indices = sorted([i for i in wanted if i % FRAME_SAMPLE_STRIDE == 0])
            if not final_indices:
                final_indices = sorted(wanted)
            # Limit to MAX_GIF_FRAMES
            final_indices = final_indices[:MAX_GIF_FRAMES]
            if os.getenv("NSFW_DEBUG", "0") == "1":
                print(f"[NSFW_DEBUG] GIF total_frames={total_frames} sampled_indices={final_indices}")
            for idx in final_indices:
                try:
                    img.seek(idx)
                    frame = img.convert('RGB')
                    probs_list.append(classify_image(frame))
                except EOFError:
                    break
    else:
        probs_list.append(classify_image(img))

    # Aggregate only over normalized nsfw/sfw
    agg_probs = aggregate([{ 'nsfw': p['nsfw'], 'sfw': p['sfw']} for p in probs_list])
    decision = decide(agg_probs)

    response = {
        'ok': True,
        'hash': file_hash,
        'mime': mime,
        'probabilities': agg_probs,
        'raw_frame_probs': [p.get('raw') for p in probs_list if 'raw' in p],
        'decision': decision,
        'blurred': False
    }

    if decision['action'] == 'blur' and return_blur == 1:
        blurred = blur_image(img)
        buf = io.BytesIO()
        # Save as PNG to avoid GIF complexities
        blurred.save(buf, format='PNG')
        response['blurred'] = True
        response['blurred_base64'] = buf.getvalue().hex()  # hex to avoid base64 libs; decode in Node

    return JSONResponse(response)


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "block_threshold": BLOCK_THRESHOLD}
