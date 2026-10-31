# Node 18 reached end of life in April 2025; 22 is the current LTS.
FROM node:22-alpine

# Non-root runtime user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only package manifests first for efficient caching
COPY package*.json ./

# Install production deps
RUN npm ci --omit=dev

# Copy rest of repository
COPY . .

ENV NODE_ENV=production
# Do not bake secrets into the image — pass them at runtime via docker run / compose / CI secrets

EXPOSE 8080

USER appuser
CMD ["node", "src/index.js"]
