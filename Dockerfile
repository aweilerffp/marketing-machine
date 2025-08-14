# Marketing Machine - Production Dockerfile
FROM node:18-alpine AS base

# Install dependencies for building
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install --frozen-lockfile
RUN cd backend && npm install --frozen-lockfile --production
RUN cd frontend && npm install --frozen-lockfile

# Build frontend
FROM base AS frontend-builder
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
FROM base AS backend-builder
COPY backend ./backend
WORKDIR /app/backend

# Production image
FROM node:18-alpine AS production

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

WORKDIR /app

# Copy backend application
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend ./backend
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules

# Copy built frontend
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Copy root package.json for scripts
COPY --chown=nodejs:nodejs package*.json ./

# Set permissions
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node backend/src/health-check.js || exit 1

# Start application
CMD ["npm", "run", "start:production"]