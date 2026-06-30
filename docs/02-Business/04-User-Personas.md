# User Personas

**Document Version:** 1.0

**Status:** Approved

---

# Purpose

This document defines the primary users of the FullScan Mobile Platform.

Understanding user personas ensures that business processes, application workflows, security decisions, and user experience are designed around real operational needs.

The platform supports multiple types of users, each with distinct responsibilities and expectations.

---

# Persona Overview

| Persona                   | Primary Responsibility                    | Uses Mobile App |
| ------------------------- | ----------------------------------------- | --------------- |
| Employer / Client         | Requests background verification          | No              |
| Operations Executive      | Creates and assigns verification requests | No              |
| Field Executive           | Performs physical verification            | Yes             |
| Operations Manager        | Monitors verification progress            | No              |
| System Administrator      | Manages users and configuration           | No              |
| Quality Assurance Officer | Reviews submitted verification evidence   | No              |

The **Field Executive** is the primary user of the mobile application.

---

# Persona 1 – Employer / Client

## Description

Organizations requesting verification services for candidates.

Examples include:

* Corporate Employers
* Banking Institutions
* Insurance Companies
* Recruitment Agencies
* Government Organizations

---

## Responsibilities

* Submit verification requests.
* Monitor verification progress.
* Review completed verification reports.
* Make business decisions based on submitted evidence.

---

## Goals

* Receive trustworthy verification reports.
* Reduce fraudulent verification.
* Improve turnaround time.
* Increase confidence in verification evidence.

---

## Pain Points

* Fake field visits.
* Inconsistent reports.
* Delayed verification.
* Lack of auditability.

---

# Persona 2 – Operations Executive

## Description

Responsible for receiving verification requests and assigning them to Field Executives.

---

## Responsibilities

* Register verification requests.
* Allocate assignments.
* Track pending work.
* Reassign cases when necessary.

---

## Goals

* Efficient assignment distribution.
* Balanced workload.
* Timely completion.

---

## Pain Points

* Manual assignment tracking.
* Delayed field updates.
* Limited visibility into field activities.

---

# Persona 3 – Field Executive

## Description

The primary mobile application user.

Field Executives travel to candidate locations and perform physical verification.

---

## Responsibilities

* Authenticate securely.
* View assigned cases.
* Navigate to candidate locations.
* Verify candidate information.
* Capture photographs.
* Capture supporting evidence.
* Submit verification.
* Complete assigned work within SLA.

---

## Goals

* Simple user experience.
* Reliable offline operation.
* Fast data entry.
* Minimal manual work.
* Successful synchronization.

---

## Pain Points

* Poor network connectivity.
* GPS issues.
* Device battery limitations.
* Frequent travel.
* Large daily workloads.

---

## Mobile Application Usage

Field Executives use the mobile application to:

* Login
* View assignments
* View assignment details
* Navigate to location
* Capture evidence
* Submit verification
* Synchronize offline data

The application is optimized primarily for this persona.

---

# Persona 4 – Operations Manager

## Description

Responsible for monitoring verification activities across multiple Field Executives.

---

## Responsibilities

* Monitor assignment progress.
* Review operational performance.
* Escalate delays.
* Ensure SLA compliance.

---

## Goals

* Improve operational efficiency.
* Increase productivity.
* Reduce verification delays.

---

# Persona 5 – Quality Assurance Officer

## Description

Reviews submitted verification reports before final delivery to the client.

---

## Responsibilities

* Review evidence.
* Validate report completeness.
* Verify compliance with business rules.
* Request corrections where required.

---

## Goals

* Improve verification quality.
* Ensure evidence authenticity.
* Maintain reporting standards.

---

# Persona 6 – System Administrator

## Description

Responsible for platform administration.

---

## Responsibilities

* Manage users.
* Register devices.
* Configure workflows.
* Configure document types.
* Manage system settings.

---

## Goals

* Maintain platform availability.
* Ensure security.
* Configure business workflows without application releases.

---

# Primary Persona

The application is primarily designed for the **Field Executive**.

All user experience decisions should prioritize:

* Simplicity
* Speed
* Offline capability
* Reliability
* Security

---

# Secondary Personas

The platform indirectly supports:

* Operations Teams
* Managers
* Administrators
* Employers

through backend systems and reporting capabilities.

---

# Persona Summary

| Persona                   | Priority             |
| ------------------------- | -------------------- |
| Field Executive           | Primary              |
| Operations Executive      | High                 |
| Operations Manager        | Medium               |
| Quality Assurance Officer | Medium               |
| System Administrator      | Medium               |
| Employer / Client         | External Stakeholder |

---

# Design Principle

The FullScan Mobile application exists to maximize the productivity, security, and efficiency of the **Field Executive** while providing trustworthy verification evidence for all other stakeholders.
