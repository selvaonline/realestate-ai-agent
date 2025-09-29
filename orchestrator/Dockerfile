# orchestrator/Dockerfile
FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Ensure browsers are available (base image already has them; keep for safety)
RUN npx playwright install --with-deps chromium webkit

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production
RUN npx tsc

# Service port (Render will set $PORT, we use it in index.ts)
EXPOSE 3001

# Headless in cloud; devtools off
ENV BROWSER_HEADED=false \
    BROWSER_ENGINE=chromium \
    BROWSER_DEVTOOLS=false

CMD ["node", "dist/index.js"]
