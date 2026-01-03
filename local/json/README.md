# Local JSON Workspace

This folder is for local-only JSON files you want to move between macOS and Windows
(e.g., analysis outputs, API snapshots, secrets/redacted exports). It is intentionally
ignored by Git via `*.json` in `.gitignore`.

Recommended structure:

- local/json/exports/        # one-off exports or backups
- local/json/analysis/       # analysis results
- local/json/snapshots/      # runtime snapshots
- local/json/secrets/        # credentials or sensitive JSON (keep local only)

Naming convention:

- <area>_<date>_<short-desc>.json
- Example: `analysis_2025-01-03_emergency-messages.json`

Cross-machine transfer:

- Zip just `local/json/` and move it to the Windows machine.
- Unzip into the same path in the repo to keep tooling/scripts consistent.
