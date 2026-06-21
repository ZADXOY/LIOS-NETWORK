#!/bin/bash
# Launches the chat-service mini-service as a detached daemon that survives
# the calling shell's exit. Safe to re-run; old instance is killed first.

set -e

SERVICE_DIR="/home/z/my-project/mini-services/chat-service"
LOG_FILE="/home/z/my-project/.zscripts/mini-service-chat-service.log"
PID_FILE="/home/z/my-project/.zscripts/mini-service-chat-service.pid"

mkdir -p "$(dirname "$LOG_FILE")"

# Kill existing instance if any
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing chat-service (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# Also kill any lingering bun --hot index.ts processes
pkill -f "bun --hot index.ts" 2>/dev/null || true
sleep 0.5

cd "$SERVICE_DIR"

# Make sure deps are installed
bun install --silent 2>/dev/null || true

# Start the service detached from this shell
# Double-fork via setsid + nohup + & + disown
nohup setsid bun run dev >"$LOG_FILE" 2>&1 < /dev/null &
PID=$!
disown 2>/dev/null || true

# Wait briefly and verify it's running
sleep 3

if kill -0 "$PID" 2>/dev/null; then
  echo "$PID" > "$PID_FILE"
  echo "Chat service started (PID $PID)"
  echo "Log: $LOG_FILE"
else
  echo "ERROR: chat service failed to start"
  echo "=== Log output ==="
  cat "$LOG_FILE" 2>/dev/null
  exit 1
fi

# Verify port is listening (retry for up to 5s)
for i in 1 2 3 4 5; do
  if ss -tlnp 2>/dev/null | grep -q ":3003 " ; then
    echo "Port 3003 is listening"
    exit 0
  fi
  sleep 1
done

echo "WARNING: port 3003 not yet listening after 5s"
echo "=== Log output ==="
cat "$LOG_FILE" 2>/dev/null
exit 0
