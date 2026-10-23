#!/usr/bin/env bash
# Combined: start Appium -> run tests -> generate Allure report
# Usage: APP_FILE=apks/app-debug.apk ./scripts/run-android-e2e.sh

set -e

APP_FILE="${APP_FILE:-}"
DEVICE_NAME="${DEVICE_NAME:-Android Device}"
APPIUM_PORT="${APPIUM_PORT:-4723}"
APPIUM_LOG="/tmp/appium-e2e.log"
APPIUM_PID=""

cleanup() {
  if [ -n "$APPIUM_PID" ] && kill -0 "$APPIUM_PID" 2>/dev/null; then
    kill "$APPIUM_PID" 2>/dev/null || true
    wait "$APPIUM_PID" 2>/dev/null || true
    echo "[cleanup] Appium stopped (pid $APPIUM_PID)"
  fi
}
trap cleanup EXIT INT TERM

echo "==> Starting Appium on port $APPIUM_PORT..."
appium --port "$APPIUM_PORT" > "$APPIUM_LOG" 2>&1 &
APPIUM_PID=$!

# Wait for Appium to be ready (max ~60s)
READY=0
for i in $(seq 1 30); do
  if curl -s "http://localhost:$APPIUM_PORT/status" > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: Appium did not become ready in 60s"
  echo "--- Appium log tail ---"
  tail -20 "$APPIUM_LOG"
  exit 1
fi
echo "[ok] Appium is up (pid $APPIUM_PID)"

# Point WDIo at the APK
if [ -n "$APP_FILE" ]; then
  echo "==> APP_FILE=$APP_FILE"
  export APP_FILE
fi

# Run the test suite
echo "==> Running WebdriverIO tests..."
npm run test:android
WDIO_EXIT=$?

if [ $WDIO_EXIT -ne 0 ]; then
  echo "ERROR: Wdio tests failed (exit $WDIO_EXIT)"
  exit $WDIO_EXIT
fi

# Generate the Allure report
echo "==> Generating Allure report..."
npm run allure:report

echo "==> Done."
echo "Report: allure-report/index.html"
