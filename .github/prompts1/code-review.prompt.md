---
description: "Security and architecture checklist code review for FullScanField"
---

# Code Review

Review code changes against FullScanField's security and architecture standards.

## Input
- **Files to review**: ${input:files:File paths or describe the change}

## Review Areas

### 1. Security (Critical)
- No secrets hardcoded
- Input validation on all endpoints
- Parameterized DB queries
- File upload restrictions enforced
- Auth middleware on protected routes
- No sensitive data in plain storage (mobile)
- Error responses don't leak internals

### 2. Architecture
- Business logic in services, not controllers/screens
- Data access through DAOs, not raw queries
- Screens are thin — logic in hooks/services
- Proper layer separation maintained

### 3. Offline-First (Mobile)
- Feature works without network
- Sync queue handles the data submission
- UI doesn't block on network calls

### 4. Evidence Integrity
- Photos hashed after capture
- GPS validated before evidence submission
- Watermark applied correctly
- Geo-fence checked server-side

### 5. Code Quality
- TypeScript strict — no unnecessary `any`
- Tests cover the change
- Naming follows conventions
- No unused imports or dead code

## Output Format
List findings as:
- **[CRITICAL]** — must fix before merge (security, data loss)
- **[SUGGESTION]** — improvement, not blocking
- **[PRAISE]** — good pattern worth highlighting
