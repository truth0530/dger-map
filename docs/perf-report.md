# Performance Report

This document tracks page-level performance metrics before and after major optimizations.

## How To Measure

1) Start the app in production mode:

```
npm run build
npm run start
```

2) Run Lighthouse in an incognito window or use the CLI.

Recommended pages:
- `/`
- `/severe`

3) Take at least 3 runs per page and record the average.

## Lighthouse CLI (Optional)

If you want CLI runs, use the commands below while the app is running on port 3000.

```
npx lighthouse http://localhost:3000 --preset=desktop --only-categories=performance
npx lighthouse http://localhost:3000/severe --preset=desktop --only-categories=performance
```

Tip: run each command 3 times and record the average.

## Record Template

Date:
Commit/Tag:
Environment: (local/prod, device, network)

| Page | Runs | LCP (ms) | TTI (ms) | CLS | Notes |
|---|---:|---:|---:|---:|---|
| / |  |  |  |  |  |
| /severe |  |  |  |  |  |
