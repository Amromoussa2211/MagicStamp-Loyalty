# APKs

Place your Android application packages here.

## App file (capability `appium:app`)

The `APP_FILE` env var passed to Wdio points to this folder. Every APK you drop
in here must be a real Android package (`.apk`) for your target device.

| What you do | What you edit |
| --- | --- |
| Point Wdio at the folder | `APP_FILE=apks/app-debug.apk npx wdio run wdio.conf.ts` |
| Name the APK you ran | keep the real `.apk` filename in `apks/` |

## Naming convention (optional but recommended)

```
apks/
  app-debug.apk          # your local debug build
  app-release-2.1.0.apk  # versioned release build
  app-1.5.3.apk          # signed release APK
```

Files in `apks/` are **git-ignored** because they can be megabytes/gigabytes and are
built off repository source. The CI workflow downloads the APK from a URL you set,
so you do not commit binaries at all — you only commit the workflow + config.

## Where to get APK files

* **Local:** `flutter build apk --debug` → `build/app/outputs/flutter-debug/flutter_apk/app-debug.apk`
* **Android Studio:** Build → Build Bundle(s) / APK(s) → Build APK(s)
* **CI/download:** `curl -L -o apks/app.apk $APK_DOWNLOAD_URL`

## Quick check

```bash
apks/ $ ls -la
total 124
-rw-r--r--  4 t staff  51.2M Oct 23 10:30 app-debug-1.0.0.apk
```
