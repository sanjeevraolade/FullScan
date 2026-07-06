# File System Service

File read/write operations for local storage.

## Responsibility

- File creation and deletion
- Directory management
- File size and existence checks
- Temp file management
- Evidence file storage

## Rules

- Must handle storage space limitations gracefully.
- File paths must be platform-agnostic where possible.
