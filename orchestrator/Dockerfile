# orchestrator/Dockerfile
FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /app

# Install deps first for caching
COPY package*.json ./
RUN npm ci

# Browsers (base has them, keep for safety)
RUN npx playwright install --with-deps chromium webkit

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production
RUN npx tsc

# Expose (Render provides $PORT; server uses process.env.PORT || 3001)
EXPOSE 3001

# Headless in cloud
ENV BROWSER_HEADED=false \
    BROWSER_ENGINE=chromium \
    BROWSER_DEVTOOLS=false

CMD ["node", "dist/index.js"]
