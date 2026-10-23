# HERMES.md

Hermes-agent playbook for `mobile-automation-lab`.

- **Letters used:** `A` = audit (read-only), `I` = install (npm/appium), `V` = verify (run + checks), `R` = report.
- **Stopped for user input only when:** a real USB device appears, a download approval is required, or destructive cleanup is unavoidable.
- **Disk watch:** macOS 12.7 (Intel) — measure `df -BG /Users/t` before/after installs. 2.7 GiB free is tight; Wdio+devDeps install ≈ 0.5 GiB. Do not force downloads.

## Routine vs. needed questions

- Routine (do silently): project scaffolding, config, tests, npm i, lint/type check.
- Needed (ask): physical phone connection + USB debugging approval; download approval for any APK.
