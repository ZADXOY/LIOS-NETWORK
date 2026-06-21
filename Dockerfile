# Dockerfile for the Last Island chat-service (socket.io)
# Deploys to Railway, Render, Fly.io, or any container host that supports WebSockets.
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY mini-services/chat-service/package.json mini-services/chat-service/bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy the chat-service source
COPY mini-services/chat-service/index.ts ./
COPY mini-services/chat-service/vapid-config.ts ./

# Expose the port (Railway/Render set PORT env, but we default to 3003)
ENV PORT=3003
EXPOSE 3003

# Start the chat-service
CMD ["bun", "index.ts"]
