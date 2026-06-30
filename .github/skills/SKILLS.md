# FullScan AI Skills

## Purpose

This document defines the core capabilities of the AI development workspace for the FullScan Mobile Platform.

Unlike Instructions, which define engineering standards, and Agents, which define engineering roles, Skills represent reusable capabilities that GitHub Copilot should consistently apply when generating, reviewing, or improving the project.

These skills should be considered available throughout the entire codebase.

---

# Skill Philosophy

AI should behave like a senior member of the FullScan engineering team.

Every implementation should:

- Follow the documented architecture
- Respect Runtime ownership
- Prefer configuration over hardcoding
- Build reusable platform capabilities
- Produce maintainable code

---

# Platform Skills

## Runtime Platform

Understands:

- Runtime Architecture
- Verification Runtime Engine
- Workflow Engine
- Dynamic Form Engine
- Widget Registry
- Validation Engine
- Configuration Engine
- Attachment Engine
- Synchronization Engine
- Localization Engine
- Theme Engine

Always respects Runtime boundaries.

---

## Configuration-Driven Development

Able to:

- Extend configuration
- Avoid hardcoded business logic
- Build configuration-driven features
- Design reusable runtime capabilities

Always prefers configuration before implementation.

---

## Server-Driven UI

Able to:

- Generate configuration-driven screens
- Generate runtime-rendered forms
- Register widgets
- Bind runtime data
- Integrate with Widget Registry

Avoids manually building configurable screens.

---

## Offline-First Development

Able to:

- Design offline workflows
- Queue synchronization
- Persist runtime state
- Handle retries
- Recover after application restart

Never assumes network availability.

---

# Mobile Development Skills

## React Native

Able to:

- Build enterprise-grade React Native applications
- Follow Clean Architecture
- Build reusable components
- Optimize rendering
- Support accessibility

---

## Widget Development

Able to:

- Create reusable widgets
- Integrate Widget Registry
- Support runtime binding
- Support localization
- Support theming
- Support accessibility

Widgets never contain business logic.

---

## Screen Development

Able to:

- Build reusable screens
- Integrate Runtime Context
- Display runtime data
- Support Dynamic Form Engine
- Support navigation

Screens never own business workflows.

---

## Theme Development

Able to:

- Use Gluestack UI
- Apply Theme Engine
- Support Light Theme
- Support Dark Theme
- Support runtime theme switching

Never hardcodes styling.

---

## Localization

Able to:

- Localize all user-visible content
- Support English
- Support Hindi
- Support Telugu
- Support future languages

Never hardcodes text.

---

# Integration Skills

## API Development

Able to:

- Create API clients
- Handle authentication
- Implement retries
- Handle timeouts
- Translate transport errors

Never exposes transport details outside the Integration Layer.

---

## Repository Development

Able to:

- Build repositories
- Map DTOs to Domain Models
- Hide backend implementation
- Support Offline First
- Coordinate caching

Repositories never expose DTOs.

---

## State Management

Able to:

- Determine the correct owner of state
- Use Runtime Context appropriately
- Use Zustand for application state
- Avoid duplicated state

Always keeps business state outside UI components.

---

# Quality Skills

## Testing

Able to generate:

- Unit Tests
- Component Tests
- Integration Tests
- End-to-End Test Scenarios

Always considers:

- Happy Path
- Edge Cases
- Error Handling
- Offline Scenarios

---

## Code Review

Able to review:

- Architecture
- Engineering Standards
- Runtime Boundaries
- Security
- Performance
- Accessibility
- Testing
- Documentation

Provides actionable recommendations.

---

## Performance Optimization

Able to identify:

- Unnecessary renders
- Memory allocations
- Duplicate processing
- Expensive operations
- Inefficient state updates

Optimizes without compromising readability.

---

## Security

Able to implement:

- Secure Storage
- Authentication
- Permission Handling
- HTTPS
- Sensitive Data Protection
- Mock Location Detection
- Root/Jailbreak Awareness

Never compromises security for convenience.

---

# Engineering Skills

## Clean Architecture

Always follows:

- SOLID
- Clean Architecture
- Separation of Concerns
- Composition over Inheritance

---

## Engineering Standards

Consistently applies:

- Coding Standards
- Naming Conventions
- Repository Standards
- Definition of Done

Maintains consistency across the project.

---

## Documentation

Able to:

- Keep documentation synchronized
- Recommend documentation updates
- Improve technical documentation
- Generate architecture documentation

Documentation should evolve with implementation.

---

# Collaboration Skills

AI should understand the responsibilities of each engineering role.

## Solution Architect

Provides:

- Architecture
- Design Reviews
- Technical Decisions

---

## Runtime Engineer

Provides:

- Runtime Platform
- Workflow
- Configuration
- Validation
- Synchronization

---

## Mobile Engineer

Provides:

- UI
- Widgets
- Screens
- Theme
- Localization

---

## Integration Engineer

Provides:

- APIs
- Repositories
- DTOs
- Mapping

---

## QA Engineer

Provides:

- Test Strategy
- Automation
- Quality Assurance

---

## Reviewer

Provides:

- Code Reviews
- Architecture Validation
- Engineering Governance

---

# Working Principles

Before generating any implementation:

1. Understand the business requirement.
2. Review applicable documentation.
3. Identify reusable platform capabilities.
4. Select the appropriate engineering role.
5. Apply relevant instruction files.
6. Generate only what is required.
7. Validate architecture compliance.
8. Recommend documentation updates if necessary.

---

# Guiding Principle

The AI workspace exists to help build and evolve the FullScan Mobile Platform as a maintainable, scalable, configuration-driven, and offline-first enterprise application.

Every implementation should strengthen the platform rather than introduce feature-specific shortcuts.

Build reusable platform capabilities.

Protect the architecture.

Deliver production-quality software.