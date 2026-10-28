#!/bin/bash
# Starts the FRONTLINE server and a public Cloudflare link, keeps the Mac awake
# while the link is up, and prints the link to share. Safe to run again: it
# restarts anything already running.
cd "$(dirname "$0")"
mkdir -p logs

pkill -f "fps-game/server.py|python3 server.py" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1

nohup python3 server.py > logs/server.log 2>&1 < /dev/null &
disown
nohup tools/cloudflared tunnel --no-autoupdate --protocol http2 --url http://localhost:3000 > logs/tunnel.log 2>&1 < /dev/null &
disown

echo "Starting… (takes a few seconds)"
for _ in $(seq 1 60); do
  grep -q "Registered tunnel connection" logs/tunnel.log && break
  sleep 0.5
done

nohup caffeinate -is -w "$(pgrep -f 'cloudflared tunnel' | head -1)" > /dev/null 2>&1 < /dev/null &
disown

LINK=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" logs/tunnel.log | head -1)
if [ -n "$LINK" ]; then
  echo ""
  echo "  FRONTLINE is live. Share this link:"
  echo "  $LINK"
  echo ""
else
  echo "Could not start the public link. See logs/tunnel.log"
fi
