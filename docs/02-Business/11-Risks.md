# Risks

**Document ID:** BAD-011

**Document Version:** 1.0

**Status:** Approved

**Owner:** Product Owner

**Reviewed By:** Solution Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

This document identifies known business and technical risks associated with the FullScan Mobile Platform.

The objective is to proactively identify potential issues and define mitigation strategies.

---

# 2. Scope

Covers business, operational, technical, security, and project risks.

---

# 3. Risk Assessment Matrix

| Impact | Description                                                   |
| ------ | ------------------------------------------------------------- |
| High   | Significant effect on business operations or product delivery |
| Medium | Manageable impact requiring mitigation                        |
| Low    | Minor impact with limited business disruption                 |

---

# 4. Business Risks

### RISK-001

**Risk:** Incorrect or incomplete candidate information.

**Impact:** High

**Mitigation:** Validate mandatory fields before assignment creation.

---

### RISK-002

**Risk:** Candidate unavailable during visit.

**Impact:** Medium

**Mitigation:** Support configurable verification outcomes such as "Candidate Not Available."

---

### RISK-003

**Risk:** Fraudulent verification attempts.

**Impact:** High

**Mitigation:** GPS validation, live camera capture, watermarking, device integrity checks, and audit logging.

---

# 5. Technical Risks

### RISK-004

**Risk:** Poor network connectivity.

**Impact:** High

**Mitigation:** Offline-first architecture with automatic synchronization.

---

### RISK-005

**Risk:** GPS signal unavailable or inaccurate.

**Impact:** High

**Mitigation:** Validate GPS accuracy before evidence collection and notify the user when thresholds are not met.

---

### RISK-006

**Risk:** Camera or device hardware failure.

**Impact:** Medium

**Mitigation:** Provide localized error messages and prevent incomplete submissions.

---

# 6. Security Risks

### RISK-007

**Risk:** Use of mock location applications.

**Impact:** High

**Mitigation:** Detect and block mock location usage; record audit events.

---

### RISK-008

**Risk:** Compromised devices (rooted/jailbroken).

**Impact:** High

**Mitigation:** Perform device integrity checks before verification.

---

### RISK-009

**Risk:** Unauthorized account sharing.

**Impact:** High

**Mitigation:** Enforce single-device registration and secure authentication.

---

# 7. Operational Risks

### RISK-010

**Risk:** Large synchronization backlog.

**Impact:** Medium

**Mitigation:** Background synchronization with retry and queue management.

---

### RISK-011

**Risk:** Future business changes requiring application redesign.

**Impact:** Medium

**Mitigation:** Use configurable workflows, Server-Driven UI, and extensible attachment models.

---

# 8. Project Risks

### RISK-012

**Risk:** Scope expansion during development.

**Impact:** Medium

**Mitigation:** Follow Architecture Decision Records (ADRs) and prioritize approved backlog items.

---

### RISK-013

**Risk:** Insufficient automated testing.

**Impact:** High

**Mitigation:** Enforce the Definition of Done and maintain comprehensive unit, integration, and end-to-end test coverage.

---

# 9. Ownership

The Product Owner is responsible for monitoring business risks.

The Solution Architect is responsible for monitoring technical and architectural risks.

The Engineering Team is responsible for implementing mitigation strategies.

---

# 10. Guiding Philosophy

> Risks cannot always be eliminated, but they can be identified early, monitored continuously, and mitigated through sound architecture, disciplined engineering, and proactive operational practices.
