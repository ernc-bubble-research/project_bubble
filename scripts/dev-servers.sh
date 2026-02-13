#!/usr/bin/env bash
# dev-servers.sh — Start API gateway + web dev servers for browser testing
# Usage: ./scripts/dev-servers.sh [start|stop|status]
#
# Guarantees:
#   - Kills ALL existing processes on :3000 and :4200 first
#   - API gateway on :3000 (binds to *, NestJS default)
#   - Web on :4200 bound to 0.0.0.0 (required for Docker browser access)
#   - Waits until both ports are LISTEN before returning
#   - Prints ready URL for Docker browser: http://host.docker.internal:4200
#   - Admin credentials: admin@bubble.io / Admin123!

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_LOG="/tmp/bubble-api-gateway.log"
WEB_LOG="/tmp/bubble-web.log"

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  Killing processes on :${port} (PIDs: ${pids//$'\n'/, })"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
}

stop_servers() {
  echo "Stopping dev servers..."
  kill_port 3000
  kill_port 4200
  pkill -f "nx serve" 2>/dev/null || true
  sleep 1
  echo "Done."
}

status_servers() {
  local api_up=false web_up=false
  lsof -i :3000 2>/dev/null | grep -q LISTEN && api_up=true
  lsof -i :4200 2>/dev/null | grep -q LISTEN && web_up=true
  echo "API gateway (:3000): $( $api_up && echo 'UP' || echo 'DOWN' )"
  echo "Web (:4200):         $( $web_up && echo 'UP' || echo 'DOWN' )"
  if $api_up && $web_up; then
    echo ""
    echo "Docker browser URL: http://host.docker.internal:4200"
    echo "Admin login: admin@bubble.io / Admin123!"
  fi
}

start_servers() {
  echo "=== Bubble Dev Servers ==="
  echo ""

  # Step 1: Kill anything on our ports
  echo "[1/4] Cleaning up existing processes..."
  kill_port 3000
  kill_port 4200
  pkill -f "nx serve" 2>/dev/null || true
  sleep 2

  # Verify ports are free
  if lsof -i :3000 -i :4200 2>/dev/null | grep -q LISTEN; then
    echo "ERROR: Ports still in use after cleanup. Manual intervention needed."
    lsof -i :3000 -i :4200 2>/dev/null | grep LISTEN
    exit 1
  fi

  # Step 2: Start servers
  echo "[2/4] Starting API gateway (port 3000)..."
  cd "$PROJECT_ROOT"
  npx nx serve api-gateway >"$API_LOG" 2>&1 &
  local api_pid=$!

  echo "[2/4] Starting web frontend (port 4200, host 0.0.0.0)..."
  npx nx serve web --host 0.0.0.0 >"$WEB_LOG" 2>&1 &
  local web_pid=$!

  # Step 3: Wait for both to be ready (max 60s)
  echo "[3/4] Waiting for servers to be ready..."
  local elapsed=0
  local max_wait=60
  local api_ready=false
  local web_ready=false

  while [ $elapsed -lt $max_wait ]; do
    $api_ready || { lsof -i :3000 2>/dev/null | grep -q LISTEN && api_ready=true && echo "  API gateway ready (${elapsed}s)"; }
    $web_ready || { lsof -i :4200 2>/dev/null | grep -q LISTEN && web_ready=true && echo "  Web frontend ready (${elapsed}s)"; }

    if $api_ready && $web_ready; then
      break
    fi

    # Check if processes died
    if ! kill -0 $api_pid 2>/dev/null && ! $api_ready; then
      echo "ERROR: API gateway process died. Check $API_LOG"
      tail -5 "$API_LOG"
      exit 1
    fi
    if ! kill -0 $web_pid 2>/dev/null && ! $web_ready; then
      echo "ERROR: Web frontend process died. Check $WEB_LOG"
      tail -5 "$WEB_LOG"
      exit 1
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  if ! $api_ready || ! $web_ready; then
    echo "ERROR: Timeout after ${max_wait}s."
    $api_ready || echo "  API gateway NOT ready. Log: $API_LOG"
    $web_ready || echo "  Web frontend NOT ready. Log: $WEB_LOG"
    exit 1
  fi

  # Step 4: Print success
  echo "[4/4] Both servers ready!"
  echo ""
  echo "  Docker browser URL: http://host.docker.internal:4200"
  echo "  Local browser URL:  http://localhost:4200"
  echo "  Admin login:        admin@bubble.io / Admin123!"
  echo "  Impersonate:        Dashboard → Manage → Impersonate"
  echo ""
  echo "  API log: $API_LOG"
  echo "  Web log: $WEB_LOG"
  echo "  Stop:    ./scripts/dev-servers.sh stop"
}

case "${1:-start}" in
  start)  start_servers ;;
  stop)   stop_servers ;;
  status) status_servers ;;
  *)      echo "Usage: $0 [start|stop|status]"; exit 1 ;;
esac
