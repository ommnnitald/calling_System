# Multi-stage production Dockerfile for StreamCall
# Stage 1: Build client and server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json and workspace package.json files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies including devDependencies
RUN npm ci

# Copy full source tree
COPY server/ ./server/
COPY client/ ./client/

# Build client SPA and compile server TypeScript
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_CLIENT=true
ENV PORT=5000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci --omit=dev

# Copy compiled server and client dist from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Create directory for recorded meeting files
RUN mkdir -p /app/server/recordings && chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
