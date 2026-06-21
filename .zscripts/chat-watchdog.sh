#!/bin/bash
while true; do
  if ! pgrep -f "node.*chat-service/index" > /dev/null 2>&1; then
    cd /home/z/my-project/mini-services/chat-service
    node --experimental-strip-types index.ts >> /home/z/my-project/.zscripts/chat-service.log 2>&1
    echo "[watchdog] service exited, restarting in 2s..." >> /home/z/my-project/.zscripts/chat-service.log
    sleep 2
  else
    sleep 5
  fi
done
