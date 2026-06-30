---
description: "Guided bug diagnosis with domain context for offline sync, GPS, evidence, and auth issues"
---

# Fix Bug

Diagnose and fix a bug in the FullScanField app.

## Input
- **Bug description**: ${input:bug:Describe the bug}
- **Package**: ${input:package:Where is the bug? (mobile/server/unknown)}
- **Steps to reproduce**: ${input:steps:How to reproduce (if known)}

## Diagnosis Process

1. **Identify the area**: determine which layer is affected
   - Mobile: screen, navigation, service, hook, offline queue, native module
   - Server: route, controller, service, DAO, middleware

2. **Check common FullScanField-specific issues**:
   - **Offline sync**: is the sync queue stuck? Check retry logic and network state
   - **GPS**: permissions denied? Location service not started? Geo-fence radius too strict?
   - **Camera**: permission denied? Vision camera frame processor crash?
   - **Auth**: token expired? Refresh flow broken? Biometric prompt failing?
   - **Evidence upload**: file too large? Hash mismatch? Multer config issue?
   - **Database**: migration not run? Foreign key constraint? WAL lock?

3. **Fix**: apply the fix following project conventions

4. **Test**: write or update tests to prevent regression

## Rules
- Never suppress errors to "fix" them
- If the root cause is unclear, add logging before changing logic
- Check both mobile and server if the bug involves API communication
