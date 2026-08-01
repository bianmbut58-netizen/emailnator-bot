# syntax=docker/dockerfile:1

# Node LTS base (Debian slim) — the bot is a Node.js app (node-telegram-bot-api)
FROM node:20-slim

# ...but it also shells out to Python (cloudscraper) to bypass Cloudflare,
# so Python 3 + pip are required at runtime too (see src/emailnator.py)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Persistent storage directory (SQLite DB). Railway mounts a volume here —
# see railway.toml comments. Local dev can override with DATA_DIR.
ENV DATA_DIR=/data
RUN mkdir -p /data

# Install Node dependencies (package-lock.json keeps builds reproducible)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Python dependencies (cloudscraper).
# --break-system-packages is required on Debian 12 (bookworm) for pip installs
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production

# The bot runs Telegram long-polling — a long-lived process, no HTTP server.
# The token comes from the TELEGRAM_BOT_TOKEN env var (set in Railway Variables).
CMD ["node", "bot.js"]
