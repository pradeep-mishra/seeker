# Dockerfile
# Multi-stage build for Seeker File Browser

# ============================================
# Stage 1: Build the application
# ============================================
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build client
RUN bun run build:client

# ============================================
# Stage 2: Production image
# ============================================
FROM oven/bun:1.3-alpine AS runner
	
WORKDIR /app

# Install runtime dependencies for sharp
RUN apk add --no-cache \
	vips-dev \
	fftw-dev \
	build-base \
	python3

# Define non-root user UID and GID
ENV UID=1000
ENV GID=1000

# Create user group and user
RUN addgroup -g $GID user && \
    adduser -D -u $UID -G user user


# Copy package files
COPY --chown=user:user package.json bun.lock* ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production


# Copy built client from builder
COPY --from=builder /app/dist/client ./dist/client

# Copy server source (we run from source with Bun)
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/tsconfig.json ./

# Create config directory
RUN mkdir -p /config /data && chown -R user:user /config /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CONFIG_PATH=/config

# Expose port
EXPOSE 3000

# Create volumes
VOLUME ["/config", "/data"]

# Switch to non-root user
USER user
	
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["bun", "run", "src/server/index.ts"]
	