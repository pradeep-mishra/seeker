# Dockerfile
# Multi-stage build for Seeker File Browser

# ============================================
# Stage 1: Build the client (Vite/React)
# Use Node.js because Bun has cross-compilation issues under emulation
# ============================================
FROM node:20-alpine AS client-builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with npm
RUN npm ci

# Copy source code (only what's needed for client build)
COPY . .

# Build client with Vite
RUN npm run build:client

# ============================================
# Stage 2: Production image
# ============================================
FROM oven/bun:1.3-alpine AS runner
	
WORKDIR /app

# Install runtime dependencies for sharp
# Only install runtime libraries, not dev/build packages
RUN apk add --no-cache \
	vips \
	wget

# Define non-root user UID and GID
ENV UID=1000
ENV GID=1000

# Use existing user/group with UID/GID 1000 if they exist, otherwise create them
RUN EXISTING_GROUP=$(getent group $GID 2>/dev/null | cut -d: -f1 || echo "") && \
    EXISTING_USER=$(getent passwd $UID 2>/dev/null | cut -d: -f1 || echo "") && \
    if [ -z "$EXISTING_GROUP" ]; then \
      addgroup -g $GID user; \
      GROUP_NAME=user; \
    else \
      GROUP_NAME="$EXISTING_GROUP"; \
    fi && \
    if [ -z "$EXISTING_USER" ]; then \
      adduser -D -u $UID -G $GROUP_NAME user; \
      USER_NAME=user; \
    else \
      USER_NAME="$EXISTING_USER"; \
      # Ensure user is in the correct group
      addgroup $USER_NAME $GROUP_NAME 2>/dev/null || true; \
    fi && \
    echo "$USER_NAME" > /app/.docker_user && \
    echo "$GROUP_NAME" > /app/.docker_group

# Copy package files (using numeric UID/GID since COPY doesn't support variables)
COPY --chown=$UID:$GID package.json bun.lock* ./

# Install with build dependencies temporarily, then remove them
RUN apk add --no-cache --virtual .build-deps \
    build-base \
    python3 \
    vips-dev \
    fftw-dev && \
    bun install --frozen-lockfile --production && \
    apk del .build-deps


# Copy built client from Node.js build stage (using numeric UID/GID)
COPY --chown=$UID:$GID --from=client-builder /app/dist/client ./dist/client

# Copy server source directly from context (we run from source with Bun)
COPY --chown=$UID:$GID ./src/server ./src/server
COPY --chown=$UID:$GID ./tsconfig.json ./

# Create config directory and set ownership using actual user/group
RUN USER_NAME=$(cat /app/.docker_user) && \
    GROUP_NAME=$(cat /app/.docker_group) && \
    mkdir -p /config /data && \
    chown -R $USER_NAME:$GROUP_NAME /config /data

# Set default environment variables
# These can be overridden via docker-compose.yml or docker run -e flags
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CONFIG_PATH=/config
ENV DEFAULT_MOUNT=/data

# Expose port
EXPOSE 3000

# Create volumes
VOLUME ["/config", "/data"]

# Switch to non-root user (USER command uses numeric UID since it doesn't support variables)
# The actual user name is stored in /app/.docker_user for reference
USER $UID
	
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["bun", "run", "src/server/index.ts"]
	