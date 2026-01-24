FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# 1. espeak-ng  -> REQUIRED for Kokoro (phoneme generation)
# 2. git        -> REQUIRED to install F5-TTS from GitHub
# 3. libsndfile1 -> REQUIRED for soundfile (saving audio)
# 4. ffmpeg     -> REQUIRED for general audio processing
RUN apt-get update && apt-get install -y \
    espeak-ng \
    git \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
# --no-cache-dir ensures we don't use old broken cached versions of libraries
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port 7860 (Standard for Hugging Face Spaces)
EXPOSE 7860

# Run the app
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
