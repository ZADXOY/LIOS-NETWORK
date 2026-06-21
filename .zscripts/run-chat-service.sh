#!/bin/bash
# Wrapper that keeps the chat-service running, restarting if it crashes.

SERVICE_DIR="/home/z/my-project/mini-services/chat-service"
LOG_FILE="/home/z/my-project/.zscripts/mini-service-chat-service.log"
PID_FILE="/home/z/my-project/.zscripts/mini-service-chat-service.pid"

mkdir -p "$(dirname "$LOG_FILE")"

# Kill existing instances
pkill -f "bun.*index.ts" 2>/dev/null || true
sleep 1

cd "$SERVICE_DIR"

# Write the PID of this wrapper to the PID file
echo $$ > "$PID_FILE"

# Loop: start the service, wait for it, restart if it dies
while true; do
  echo "[wrapper] starting chat-service at $(date)" >> "$LOG_FILE"
  bun index.ts >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
  echo "[wrapper] chat-service exited with code $EXIT_CODE at $(date), restarting in 2s..." >> "$LOG_FILE"
  sleep 2
done
