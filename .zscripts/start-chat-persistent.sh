#!/bin/bash
# Start the chat-service and keep it running with auto-restart
pkill -f "bun.*chat-service/index" 2>/dev/null || true
sleep 1
cd /home/z/my-project/mini-services/chat-service
exec bun index.ts
