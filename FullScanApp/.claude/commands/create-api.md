---
description: Scaffold a backend API client (Axios, typed, behind the Integration Layer)
argument-hint: <api-name> — e.g. "AssignmentApi"
---

Create the **$ARGUMENTS** API client for the FullScan Mobile Platform under `src/infrastructure/api/` (or the relevant integration folder).

Load `fullscan-architecture` first; the `integration-engineer` subagent owns this layer — consider delegating to it for anything non-trivial.

## Before creating a new API client

Check the API Contracts under `docs/06-Contracts/` and confirm this endpoint doesn't already have a client. Never duplicate endpoints.

## Principles

API clients only handle communication — no business logic. UI never calls an API client directly; only Repositories consume API clients (`Screen → Repository → API Client → Backend`, never `Screen → Axios`).

## Generate

`ApiClient.ts`, `Request.ts`, `Response.ts`, `Mapper.ts` (if the repository layer needs it), tests, `index.ts` — only what's required.

## Requirements

Axios + HTTPS + strong typing on both request and response — never expose raw JSON outside the Integration Layer. Support access-token auth, device registration, and session validation as applicable; never hardcode credentials. Convert transport errors into typed API errors (e.g. 401 → `AuthenticationExpired`) rather than leaking HTTP details upward. Support cancellation, timeouts, and retries; avoid duplicate in-flight requests.

## Logging

Log request, response metadata, retries, and failures — never tokens, passwords, or sensitive payloads.

## Tests

Cover success, failure, timeout, unauthorized, network failure, and retry behavior.

## Before finishing, confirm

Strongly typed · secure (HTTPS, no hardcoded secrets) · testable · ready for a Repository to consume · logging and error handling in place · architecture compliant.
