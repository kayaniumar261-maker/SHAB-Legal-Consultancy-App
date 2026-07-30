#!/usr/bin/env bash
set -euo pipefail

PORT="${SHAB_DEV_PORT:-5173}"
LOG_FILE="${SHAB_VITE_LOG:-/tmp/shab-vite.log}"
PID_FILE="${SHAB_VITE_PID:-/tmp/shab-vite.pid}"

is_healthy() {
  curl -fsS --max-time 2 "http://127.0.0.1:${PORT}" >/dev/null 2>&1
}

if is_healthy; then
  echo "SHAB dev server already healthy on port ${PORT}."
  exit 0
fi

# Kill a stale/unhealthy listener if one exists.
if lsof -ti TCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Restarting unhealthy process on port ${PORT}..."
  lsof -ti TCP:"${PORT}" -sTCP:LISTEN | xargs -r kill || true
  sleep 1
fi

rm -f "${PID_FILE}"

nohup npm run dev -- --host 0.0.0.0 --port "${PORT}" \
  >"${LOG_FILE}" 2>&1 &

echo $! > "${PID_FILE}"

# Wait until Vite actually responds, not merely opens the port.
for _ in $(seq 1 30); do
  if is_healthy; then
    echo "SHAB dev server ready on port ${PORT}."
    exit 0
  fi

  sleep 1
done

echo "SHAB dev server failed to start."
echo "----- Vite log -----"
tail -n 80 "${LOG_FILE}" || true
exit 1
