# syntax=docker/dockerfile:1

# Node 22 LTS base (Debian slim) — required by better-sqlite3@13 (engines: node>=22).
# Node 22 ships prebuilt binaries for better-sqlite3, so npm ci downloads them
# instead of compiling with node-gyp (which needs make — not in slim images).
# Node 20 is EOL (April 2026), so 22 also keeps the image supported.
FROM node:22-slim

# ...but it also shells out to Python (cloudscraper) to bypass Cloudflare,
# so Python 3 + pip are required at runtime too (see src/emailnator.py)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Persistent storage directory (SQLite DB) — same pattern as 9router-v3.
# The app writes its database here, so when a Railway volume is attached at
# /data (dashboard or `railway volume add --mount-path /data`) data survives
# redeploys. NOTE: do NOT add `VOLUME /data` here — Railway BANS the VOLUME
# keyword in Dockerfiles and the build will fail. Local dev can override
# DATA_DIR (default: ./data).
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
