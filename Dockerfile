# Start from a small, official Python image that works on Google Cloud Run.
FROM python:3.12-slim

# Keep logs immediate and stop Python from creating unnecessary cache files.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Put the website in one clear folder inside the cloud container.
WORKDIR /app

# Install libraries before copying the rest so later deployments build faster.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only files allowed by .gcloudignore into the container.
COPY . .

# Gunicorn is the production web server. Cloud Run provides the PORT value.
# One worker avoids two processes writing to the same SQLite file at once.
CMD exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 8 --timeout 300 app:app
