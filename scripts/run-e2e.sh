#!/usr/bin/env bash
set -u

mkdir -p logs screenshots diagnostics allure-results

# تجميع الـ diagnostics في الآخر مهما حصل (الـ emulator بيتقفل بعد الـ step)
collect() {
  adb logcat -d > diagnostics/logcat.log 2>&1 || true
  adb shell screencap -p /sdcard/final.png 2>/dev/null && adb pull /sdcard/final.png diagnostics/final-screen.png 2>/dev/null || true
  cp -r screenshots diagnostics/ 2>/dev/null || true
  cp -r logs diagnostics/ 2>/dev/null || true
}
trap collect EXIT

adb devices
adb install -r apks/app-release.apk

nohup npx appium --relaxed-security --log-timestamp > logs/appium.log 2>&1 &

for i in {1..30}; do
  if curl -s localhost:4723/status | grep -q '"ready":true'; then
    echo "Appium ready"
    break
  fi
  sleep 2
done

# تشغيل عادي: process واحدة لكل الـ specs
npx wdio run ./wdio.ci.conf.js
RESULT=$?

# بديل لو عايز نفس سلوك اللوكال (process لكل spec): امسح السطرين اللي فوق وفك ده
# RESULT=0
# for f in test/specs/*.spec.js; do
#   npx wdio run ./wdio.ci.conf.js --spec "$f" || RESULT=1
# done

exit $RESULT