# Create Repository Prompt

> Follow **00-prompt-execution-rules.md** before executing this prompt.

## Purpose

Create a Repository for the FullScan Mobile Platform.

Repositories provide a clean abstraction between the Runtime Platform and backend integrations.

Repositories hide transport details and expose domain models.

---

# Before Starting

Review:

- Architecture
- Runtime
- API Contracts
- Integration Instructions

Determine whether an existing repository can be extended.

Avoid duplicate repositories.

---

# Repository Principles

Repositories shall:

- Hide API implementation
- Return Domain Models
- Perform Mapping
- Coordinate data retrieval
- Remain independently testable

Repositories must never expose DTOs.

---

# Generate

Generate:

Repository.ts

Repository.interface.ts

Mapper.ts

Tests

Index

Only generate required artifacts.

---

# Responsibilities

Repository responsibilities:

Call API

↓

Map DTO

↓

Return Domain Model

↓

Handle Errors

Repositories should never:

Contain UI logic

Contain Workflow logic

Contain Validation

---

# Mapping

Separate mapping into dedicated mappers.

Avoid manual mapping inside business code.

---

# Error Handling

Return typed domain errors.

Avoid exposing HTTP errors.

---

# Offline

Determine whether repository should:

Read Local Cache

Read Remote API

Coordinate with Synchronization

Respect Offline First.

---

# Logging

Log:

Repository Call

Mapping Failure

Cache Miss

Retry

Never log sensitive business data.

---

# Performance

Avoid:

Repeated Mapping

Duplicate API Calls

Repeated Object Creation

Reuse existing repositories whenever possible.

---

# Testing

Generate:

Repository Tests

Mapper Tests

Offline Tests

Error Tests

---

# Documentation

If new domain models are introduced:

Recommend documentation updates.

---

# Completion Checklist

✓ Domain Models returned

✓ DTOs hidden

✓ Mapper separated

✓ Testable

✓ Logging

✓ Offline support

✓ Architecture compliant