# Networking Service

HTTP client and request/response pipeline.

## Responsibility

- HTTP method wrappers (GET, POST, PUT, DELETE)
- Request serialization
- Response deserialization
- Timeout handling
- Certificate pinning

## Rules

- All communication must use HTTPS.
- Must support request cancellation.
- Must provide upload/download progress callbacks.
