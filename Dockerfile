FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY . /app

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -e . \
 && pip install --no-cache-dir gunicorn

ENV GARDENMAP_STORAGE=json \
    JSON_PALETTE_PATH=/data/plants.json \
    JSON_DATA_PATH=/data/garden.json \
    SQLITE_DB_PATH=/data/gardenmap.sqlite

EXPOSE 5000

# Serve Flask app via gunicorn on all interfaces
CMD ["gunicorn", "-b", "0.0.0.0:5000", "gardenmap:app"]
