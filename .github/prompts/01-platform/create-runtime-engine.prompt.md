# Create Runtime Engine Prompt

> Follow **00-prompt-execution-rules.md** before executing this prompt.

## Purpose

Create a new Runtime Engine for the FullScan Runtime Platform.

Runtime Engines are the core building blocks of the platform.

Every Runtime Engine must have a single responsibility and integrate seamlessly with the existing Runtime Architecture.

---

# Before Starting

Review:

## Documentation

- docs/04-Architecture/
- docs/05-Runtime/
- docs/06-Contracts/

## GitHub Workspace

- PROJECT_CONTEXT.md
- PROJECT_GLOSSARY.md
- Runtime Instructions
- Engineering Standards
- Runtime Engineer Agent

The Runtime Architecture is frozen.

Do not redesign existing runtime behavior.

---

# Determine Responsibility

Before generating code determine:

- What responsibility does this engine own?
- Does another Runtime Engine already own it?
- Can an existing Runtime Engine be extended instead?

Never duplicate engine responsibilities.

---

# Runtime Principles

Every Runtime Engine shall:

- Have one responsibility
- Be configuration-driven
- Be independently testable
- Support Offline First
- Be reusable
- Be loosely coupled
- Hide implementation details

---

# Generate

Generate only the required artifacts.

Typical Runtime Engine structure:

RuntimeEngine.ts

RuntimeEngine.interface.ts

RuntimeEngine.types.ts

RuntimeEngine.constants.ts

RuntimeEngine.test.ts

index.ts

---

# Dependencies

Runtime Engines may depend on:

- Contracts
- Logger
- Configuration Engine
- Runtime Context

Avoid depending directly on:

- UI
- Screens
- Widgets
- Navigation

---

# Runtime Context

Determine whether the Runtime Context should be:

- Read
- Updated
- Observed

Avoid duplicated runtime state.

---

# Logging

Use LoggerService.

Log:

- Initialize
- Execute
- Complete
- Error

Never use console.log().

---

# Error Handling

Handle:

- Invalid Configuration
- Missing Runtime Data
- Unexpected Runtime Failures

Return structured errors.

Avoid uncaught exceptions.

---

# Performance

Prefer:

Lazy Initialization

Caching

Efficient Memory Usage

Avoid repeated parsing.

---

# Testing

Generate tests for:

- Initialization
- Execution
- Error Handling
- Edge Cases
- Invalid Configuration

---

# Documentation

If the Runtime Platform changes:

Recommend updates to Runtime documentation.

---

# Completion Checklist

✓ Single Responsibility

✓ Runtime Context respected

✓ Configuration-driven

✓ Offline First

✓ Logger integrated

✓ Testable

✓ Strong Typing

✓ Architecture compliant