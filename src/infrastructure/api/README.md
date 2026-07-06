# API

REST communication layer — HTTP client, interceptors, and API configuration.

## Responsibility

- API client configuration
- Request/response interceptors
- Authentication header injection
- Error response mapping
- Retry policies
- Base URL management

## Rules

- All backend communication goes through this layer.
- Never make raw HTTP calls from features or engines.
- Must handle token refresh transparently.
