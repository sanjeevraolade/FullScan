# Constraints

**Document ID:** BAD-010

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Product Owner

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

This document defines the business, technical, security, and operational constraints governing the FullScan Mobile Platform.

Constraints are mandatory limitations that the solution must respect.

---

# 2. Scope

Applies to the mobile application, backend integrations, deployment, and future enhancements.

---

# 3. Business Constraints

### CON-001

No user self-registration.

---

### CON-002

Only one registered device per Field Executive.

---

### CON-003

Camera-only evidence collection.

Gallery image selection is prohibited.

---

### CON-004

Every verification shall be performed at the candidate's physical location.

---

### CON-005

Every verification shall contain mandatory evidence.

---

# 4. Security Constraints

### CON-006

Mock location detection is mandatory.

---

### CON-007

Rooted, jailbroken, or compromised devices shall not be permitted to perform verification.

---

### CON-008

Sensitive information shall not be stored insecurely.

---

### CON-009

Biometric information shall never be transmitted to backend systems.

---

# 5. Functional Constraints

### CON-010

Every captured image shall contain a permanently embedded watermark including:

* Latitude
* Longitude
* Capture Date
* Capture Time

before being stored or uploaded.

---

### CON-011

Only watermarked images shall be stored and uploaded.

---

### CON-012

All user-visible content shall support:

* English
* Hindi
* Telugu

---

### CON-013

Light Theme, Dark Theme, and System Theme shall be supported.

---

### CON-014

Business screens shall support Server-Driven UI wherever applicable.

---

# 6. Technical Constraints

### CON-015

The mobile application shall support offline operation.

---

### CON-016

Pending submissions shall synchronize automatically when connectivity becomes available.

---

### CON-017

Business workflows shall be configurable through backend-managed metadata wherever practical.

---

### CON-018

The application shall support future expansion of attachment document types without redesigning the attachment data model.

---

# 7. Architectural Constraints

### CON-019

Business logic shall remain independent of UI components.

---

### CON-020

Business modules shall not directly access native platform APIs.

---

### CON-021

All implementation shall comply with the approved Governance documents.

---

# 8. Ownership

Constraints are jointly owned by the Product Owner and Solution Architect.

---

# 9. Guiding Philosophy

> Constraints define the boundaries within which the solution is designed and implemented. They protect architectural consistency and business integrity.
