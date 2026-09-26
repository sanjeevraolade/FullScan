🚀 Sprint 0 – Platform Bootstrap

We'll work in small milestones, each ending with a clean Git commit.

Sprint 0
│
├── Milestone 1  Bootstrap React Native Project
├── Milestone 2  Install & Configure Dependencies
├── Milestone 3  Create Repository Structure
├── Milestone 4  Configure Development Tooling
├── Milestone 5  Core Infrastructure
├── Milestone 6  Runtime Skeleton
└── Milestone 7  First Bootable Application

Each milestone should:

Compile successfully
Pass linting
Be committed separately
Be reviewed before moving to the next milestone
Milestone 1 — Bootstrap React Native Project
Goal

Create a clean React Native project.

Nothing more.

No dependencies.

No architecture.

No folders.

No runtime.

Use React Native CLI

Avoid Expo.

npx @react-native-community/cli@latest init FullScan

(or whatever the latest recommended CLI command is at the time you start)

Commit
Initial React Native Bootstrap
Milestone 2 — Install Dependencies

Don't create code.

Only install packages.

Group them logically.

Core
react
react-native
typescript
Navigation
@react-navigation/native
@react-navigation/native-stack
@react-navigation/drawer
react-native-screens
react-native-safe-area-context
react-native-gesture-handler
State
zustand
redux
redux-saga
UI
@gluestack-ui/themed
@gluestack-ui/config
react-native-svg
react-native-reanimated
react-native-vector-icons
Forms
react-hook-form
Networking
axios
Storage
react-native-mmkv
Camera
react-native-vision-camera
Localization
i18next
react-i18next
Device
@react-native-community/netinfo

react-native-permissions

react-native-device-info
Testing
jest

@testing-library/react-native

detox
Development
eslint

prettier

husky

lint-staged

Commit.

Milestone 3 — Repository Structure ⭐

This is where we start using GitHub Copilot.

Your prompt to Copilot

Generate ONLY the project folder structure for the FullScan Mobile Platform.

Follow all documentation in .github/ and docs/.

Create folders only.

Create placeholder README.md files describing each folder.

Do not implement code.

Do not generate business features.

Do not generate runtime implementation.

Review the result.

Commit.

Milestone 4 — Development Tooling

Configure only:

TypeScript

ESLint

Prettier

Jest

Husky

lint-staged

Metro

Babel

No Runtime.

No Features.

Commit.

Milestone 5 — Core Infrastructure

Generate only:

Logger

Configuration

Theme

Localization

Each should contain:

Interface

Implementation

Types

Tests

README

Minimal implementation only.

Commit.

Milestone 6 — Runtime Skeleton

Generate:

VerificationRuntimeEngine

WorkflowEngine

DynamicFormEngine

WidgetRegistry

ValidationEngine

ConfigurationEngine

AttachmentEngine

SynchronizationEngine

LocalizationEngine

ThemeEngine

Each should contain only:

initialize()

dispose()

No implementation.

Commit.

Milestone 7 — First Boot

Application should only do:

Start

↓

Logger

↓

Configuration

↓

Theme

↓

Localization

↓

Welcome Screen

Nothing else.

If you see a Welcome screen, Sprint 0 is complete.

How I suggest we work together

I think this is where I can provide the most value.

For every milestone, we'll follow this workflow:

Step 1

I generate the Copilot prompt.

↓

Step 2

You run it in VS Code.

↓

Step 3

You commit the generated code.

↓

Step 4

You share the generated structure or code (or any issues).

↓

Step 5

I'll review it like your Solution Architect + Reviewer, suggest improvements, and then we'll move to the next milestone.