# Naming Conventions

**Document Version:** 1.0

**Status:** Approved

---

# Purpose

This document defines the naming conventions for the FullScan Mobile Platform.

Consistent naming improves:

* Readability
* Discoverability
* Maintainability
* Developer Productivity
* AI-assisted Development
* Code Reviews

Naming conventions are mandatory throughout the repository.

---

# General Principles

Names should be:

* Descriptive
* Consistent
* Predictable
* Unambiguous
* Business-oriented

Avoid abbreviations unless they are widely understood (e.g., GPS, API, OCR).

Names should describe **what something is**, not **how it is implemented**.

---

# Folder Naming

Folders use:

* lowercase
* kebab-case when multiple words are required

Examples:

```text
authentication
verification
attachments
runtime
workflow
localization
theme
mock-server
```

Avoid:

```text
Auth
VerifyModule
RuntimeEngine
MyFolder
```

---

# File Naming

File names use **PascalCase** for exported classes/components and **kebab-case** or **dot suffixes** for configuration files where appropriate.

---

# Screen Naming

Format

```text
<Feature>Screen.tsx
```

Examples

```text
LoginScreen.tsx

DashboardScreen.tsx

AssignmentListScreen.tsx

AssignmentDetailsScreen.tsx

VerificationScreen.tsx

SettingsScreen.tsx
```

Never

```text
Screen1.tsx

Verify.tsx

Main.tsx
```

---

# Component Naming

Format

```text
<ComponentName>.tsx
```

Examples

```text
AssignmentCard.tsx

StatusBadge.tsx

CandidateHeader.tsx

LocationBanner.tsx
```

---

# Widget Naming

Widgets always end with **Widget**.

Examples

```text
TextWidget.tsx

DropdownWidget.tsx

CameraWidget.tsx

SignatureWidget.tsx

AttachmentWidget.tsx

TimelineWidget.tsx
```

This clearly distinguishes runtime widgets from reusable UI components.

---

# Hook Naming

Hooks begin with **use**.

Examples

```text
useLocation.ts

useAssignments.ts

useCamera.ts

useLocalization.ts

useOfflineQueue.ts

useWorkflow.ts
```

---

# Store Naming

Stores use:

```text
<feature>.store.ts
```

Examples

```text
authentication.store.ts

assignment.store.ts

workflow.store.ts

theme.store.ts

session.store.ts
```

---

# Repository Naming

Repositories end with **Repository**.

Examples

```text
AssignmentRepository.ts

AuthenticationRepository.ts

ConfigurationRepository.ts
```

Interfaces:

```text
IAssignmentRepository.ts

IAuthenticationRepository.ts
```

---

# Service Naming

Services end with **Service**.

Examples

```text
CameraService.ts

LocationService.ts

SyncService.ts

LoggingService.ts

WorkflowService.ts
```

---

# Engine Naming

Platform engines end with **Engine**.

Examples

```text
WorkflowEngine.ts

ValidationEngine.ts

LocalizationEngine.ts

SyncEngine.ts

AttachmentEngine.ts

ConfigurationEngine.ts
```

---

# Manager Naming

Managers coordinate multiple services.

Examples

```text
SessionManager.ts

QueueManager.ts

PluginManager.ts

NavigationManager.ts
```

---

# Factory Naming

Factories end with **Factory**.

Examples

```text
WidgetFactory.ts

ValidatorFactory.ts

RuleFactory.ts
```

---

# Registry Naming

Registries end with **Registry**.

Examples

```text
WidgetRegistry.ts

PluginRegistry.ts

ValidatorRegistry.ts
```

---

# Validator Naming

Validators end with **Validator**.

Examples

```text
GPSValidator.ts

LocationValidator.ts

AttachmentValidator.ts

WorkflowValidator.ts
```

---

# Rule Naming

Rules end with **Rule**.

Examples

```text
GeoFenceRule.ts

PhotoRequiredRule.ts

DistanceRule.ts
```

---

# Model Naming

Business models use singular nouns.

Examples

```text
Assignment.ts

Candidate.ts

Attachment.ts

Workflow.ts

Verification.ts
```

Avoid plural model names.

---

# Interface Naming

Interfaces begin with **I**.

Examples

```text
IAssignmentRepository

ILogger

IWidget

IRuntimePlugin
```

---

# Enum Naming

Enums use PascalCase.

Members use PascalCase.

Example

```typescript
enum VerificationStatus {

    Pending,

    Verified,

    UTV,

    Insufficient

}
```

---

# Constants

Constants use:

```text
UPPER_SNAKE_CASE
```

Examples

```typescript
MAX_IMAGE_SIZE

GPS_THRESHOLD

DEFAULT_LANGUAGE

DEFAULT_THEME
```

---

# Variable Naming

Variables use camelCase.

Examples

```typescript
candidateName

assignmentId

workflowDefinition

currentLocation
```

Avoid:

```typescript
a

temp

obj

x
```

unless within very small local scopes.

---

# Function Naming

Functions use verbs.

Examples

```typescript
loadAssignments()

validateLocation()

capturePhoto()

submitVerification()

downloadConfiguration()

syncOfflineQueue()
```

---

# Boolean Naming

Boolean variables should read naturally.

Examples

```typescript
isAuthenticated

isOnline

isRequired

hasPermission

canSubmit

shouldSynchronize
```

Avoid:

```typescript
flag

status

value
```

---

# Event Naming

Events use the past tense.

Examples

```text
PhotoCaptured

VerificationSubmitted

AssignmentAccepted

SyncCompleted

LocationValidated
```

---

# API Endpoint Naming

Use REST conventions.

Examples

```text
GET /assignments

GET /assignments/{id}

POST /verification

GET /configuration

GET /master-data

POST /attachments
```

Avoid verbs in endpoint names where possible.

---

# Translation Key Naming

Use hierarchical keys.

Examples

```text
auth.login

auth.logout

dashboard.title

assignment.address

verification.status

errors.network

validation.required

common.submit
```

Do not use free-form keys.

---

# JSON Property Naming

JSON properties use camelCase.

Examples

```json
{
  "assignmentId": "",
  "candidateName": "",
  "verificationStatus": "",
  "documentType": ""
}
```

---

# Configuration File Naming

Configuration files use kebab-case.

Examples

```text
verification-definition.json

dashboard-layout.json

workflow-definition.json

theme-config.json
```

---

# Test Naming

Tests mirror production files.

Examples

```text
AssignmentRepository.test.ts

WorkflowEngine.test.ts

LocationValidator.test.ts

CameraWidget.test.tsx
```

---

# Markdown Documentation Naming

Documents begin with an ordering prefix.

Examples

```text
01-Vision.md

02-Business-Problem.md

03-Business-Goals.md

04-Architecture.md
```

This ensures a predictable reading order.

---

# ADR Naming

Architecture Decision Records use:

```text
ADR-001-Runtime-Architecture.md

ADR-002-Offline-First.md

ADR-003-Localization.md
```

Never rename existing ADRs.

---

# GitHub Copilot Documents

Use descriptive names.

Examples

```text
architecture.instructions.md

runtime.instructions.md

workflow.agent.md

build-widget.skill.md
```

---

# Naming Checklist

Before introducing any new artifact, verify:

* Is the name descriptive?
* Is it consistent with existing conventions?
* Does it clearly communicate responsibility?
* Can another developer locate it without explanation?
* Does it follow the project naming standard?

If the answer to any question is "No", rename the artifact before committing.

---

# Naming Philosophy

> **Every name should communicate intent.**

> **A developer should be able to predict where something lives and what it does based solely on its name.**

> **Consistency is more valuable than personal preference.**
