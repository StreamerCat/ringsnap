
# Rollback Plan

You are currently on the branch `feat/mvp-finalization`. Your changes to the dashboard and email functions are present but **uncommitted**.

## Option 1: Save your work (Recommended)
To save these changes to the new branch:
```bash
git add .
git commit -m "feat: MVP finalization (Dashboard V1, Emails)"
```

## Option 2: Rollback / Discard Changes
If you wish to discard all changes and return to the state of `feature/error-handling-ux`:
> **WARNING:** This will permanently delete the uncommitted changes to Dashboard and Email functions.

1. Switch back to the previous branch:
   ```bash
   git checkout feature/error-handling-ux
   ```
2. Reset the working directory to the last commit:
   ```bash
   git reset --hard HEAD
   git clean -fd
   ```
