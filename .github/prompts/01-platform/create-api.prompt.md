# Create API Prompt

## Purpose

Create a backend API integration for the FullScan Mobile Platform.

The generated implementation must follow the Integration Architecture.

---

# Before Starting

Review:

- API Contracts
- Integration Instructions
- Security Instructions
- Engineering Standards

Determine whether an API already exists.

Never duplicate endpoints.

---

# API Principles

API Clients are responsible only for communication.

Business logic belongs elsewhere.

Repositories consume APIs.

UI never consumes APIs directly.

---

# Generate

Generate:

ApiClient.ts

Request.ts

Response.ts

Mapper.ts (if required)

Tests

Index

Only generate required files.

---

# API Design

Use:

Axios

HTTPS

Strong Typing

Typed Responses

Never expose raw JSON outside the Integration Layer.

---

# Authentication

Support:

Access Token

Device Registration

Session Validation

Never hardcode credentials.

---

# Error Handling

Convert transport errors into typed API errors.

Avoid exposing HTTP implementation details.

---

# Logging

Log:

Request

Response Metadata

Retry

Failure

Never log:

Tokens

Passwords

Sensitive payloads

---

# Performance

Support:

Cancellation

Timeouts

Retries

Avoid duplicate requests.

---

# Testing

Generate:

Success

Failure

Timeout

Unauthorized

Network Failure

Retry

---

# Completion Checklist

✓ Strong Typing

✓ Secure

✓ Testable

✓ Repository Ready

✓ Logging

✓ Error Handling

✓ Architecture compliant