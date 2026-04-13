# ===================================
# Multi-stage Dockerfile for Production
# Backend: Fastify + tRPC + PostgreSQL
# ===================================

# Stage 1: Base dependencies
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Stage 2: Dependencies installation
FROM base AS dependencies

# Copy all package.json files
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile --prod=false

# Stage 3: Build
FROM dependencies AS build

# Copy source code
COPY packages/types ./packages/types
COPY apps/backend ./apps/backend
COPY tsconfig.base.json ./

# Build all packages
RUN pnpm --filter @marketmind/types build && \
    pnpm --filter @marketmind/backend build

# Stage 4: Production dependencies
FROM base AS prod-dependencies

# Copy package files
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 5: Production runtime
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

WORKDIR /app

# Copy built application from build stage
COPY --from=build --chown=backend:nodejs /app/packages/types/dist ./packages/types/dist
COPY --from=build --chown=backend:nodejs /app/packages/types/package.json ./packages/types/
COPY --from=build --chown=backend:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=build --chown=backend:nodejs /app/apps/backend/package.json ./apps/backend/

# Copy production node_modules
COPY --from=prod-dependencies --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=prod-dependencies --chown=backend:nodejs /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=prod-dependencies --chown=backend:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy workspace config
COPY --chown=backend:nodejs pnpm-workspace.yaml package.json ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

# Switch to non-root user
USER backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "apps/backend/dist/index.js"]
