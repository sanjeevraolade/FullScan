---
applyTo: "**/*.{ts,tsx}"
---

# Security Instructions

## Secrets & Credentials
- Never hardcode API keys, tokens, or passwords
- All secrets from environment variables (`.env` files, never committed)
- Verify `.gitignore` includes `.env*` patterns
- Mobile: store JWT in `react-native-keychain`, never `AsyncStorage`

## Input Validation
- Server: validate ALL inputs with zod schemas before processing
- Reject unexpected fields — use `.strict()` on zod schemas
- Sanitize string inputs to prevent XSS
- Parameterized queries only — never interpolate user input into SQL

## File Uploads
- Restrict to `image/*` MIME types
- Validate file magic bytes, not just extension
- Max size: 10MB per file
- Store outside web root; serve via authenticated endpoint

## Authentication
- JWT access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- bcrypt for password hashing (min 12 rounds)
- Rate limit login: 5 attempts per minute per IP

## Evidence Tamper Protection
- Hash photos (SHA-256) immediately after capture on device
- Server re-hashes uploaded file and compares with submitted hash
- GPS coordinates validated server-side against assignment geo-fence
- Reject evidence if device timestamp deviates > 5 minutes from server time

## Error Responses
- Never expose stack traces, file paths, or SQL errors to client
- Use generic error messages with error codes
- Log full details server-side only
