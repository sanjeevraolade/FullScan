---
applyTo: "**/*.{ts,tsx}"
---

# Coding Standards

## TypeScript
- Strict mode enabled (`"strict": true` in tsconfig.json)
- No `any` types without explicit justification comment
- Prefer `interface` over `type` for object shapes
- Use `readonly` for properties that shouldn't be reassigned
- Exhaustive switch statements with `never` default case

## Naming
- **Files**: kebab-case (`sync-queue.ts`, `assignment-card.tsx`)
- **Components**: PascalCase (`AssignmentCard`, `EvidenceViewer`)
- **Functions/variables**: camelCase (`getAssignment`, `isOnline`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`, `GEO_FENCE_RADIUS`)
- **Types/Interfaces**: PascalCase with descriptive names (`Assignment`, `EvidenceMetadata`)
- **Enums**: PascalCase name, PascalCase members (`VerificationStatus.Completed`)

## Formatting
- ESLint + Prettier enforced
- 2-space indentation
- Single quotes for strings
- Trailing commas in multiline
- Max line length: 100 characters
- Semicolons required

## Imports
- Group imports: external packages → internal modules → relative files
- Use path aliases where configured (`@/services`, `@/components`)
- No circular dependencies

## Error Handling
- Never swallow errors silently
- Use typed error classes (`AppError` with status code)
- Return meaningful error messages to callers
- Log errors with context (pino on server, console on mobile dev)
