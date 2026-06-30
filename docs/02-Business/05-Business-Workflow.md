# Business Workflow

**Document ID:** BW-001
**Document Version:** 1.0
**Status:** Approved
**Owner:** Product Owner
**Reviewed By:** Solution Architect
**Last Updated:** 29-Jun-2026


---

# Purpose

This document describes the end-to-end business workflow of the field verification process.

It focuses on the business process and responsibilities rather than application screens or technical implementation.

The workflow remains valid regardless of the technology used to execute it.

---

# Business Workflow Overview

```text
Employer
    │
    ▼
Submit Verification Request
    │
    ▼
Operations Executive
    │
Create Assignment
    │
Assign Field Executive
    │
    ▼
Field Executive
    │
Accept Assignment
    │
Travel to Candidate Location
    │
Meet Candidate
    │
Perform Verification
    │
Collect Evidence
    │
Submit Verification
    │
    ▼
Quality Assurance
    │
Review Verification
    │
Approve / Reject
    │
    ▼
Employer Receives Final Report
```

---

# Workflow Stages

## Stage 1 – Verification Request

The employer submits a request to perform background verification.

The request contains:

* Candidate Information
* Address
* Employer Details
* Verification Type
* Due Date
* Special Instructions

---

## Stage 2 – Assignment Creation

The Operations Executive creates a verification assignment.

Responsibilities include:

* Validate request.
* Assign priority.
* Allocate Field Executive.
* Schedule verification.

---

## Stage 3 – Assignment Acceptance

The assigned Field Executive accepts the assignment.

Acceptance indicates responsibility for completing the verification within the defined SLA.

---

## Stage 4 – Phone Call

The Field Executive will make phone call.

The objective is to perform make phone call before start to location

Every Candiate will have two numbers Primary and Secondary

This mobile numbers must be masked, not shown to FE (Field Executive)

The First attempt would be on primary number, if no response on primary number, can try on secondary number

---

## Stage 5 – Travel to Candidate Location

The Field Executive travels to the candidate's address.

The objective is to perform physical verification at the actual location.

---

## Stage 6 – Identity Verification

The Field Executive verifies:

* Candidate Identity
* Address
* Supporting Information
* Required Business Details

The exact verification steps depend on the client-specific workflow.

---

## Stage 7 – Evidence Collection

Evidence is collected to support the verification.

Examples include:

* Candidate Photograph
* GPS Coordinates
* Timestamp
* Verification Notes
* Supporting Documents
* Future Attachments

Evidence should be sufficient for independent review.

---

## Stage 8 – Verification Submission

The completed verification is submitted.

Submission includes:

* Verification Result
* Evidence
* Attachments
* Executive Information
* Device Information
* Location Metadata

If connectivity is unavailable, submission is queued for synchronization.

---

## Stage 9 – Quality Review

Quality Assurance reviews the submitted verification.

Review includes:

* Evidence completeness.
* Verification quality.
* Business rule compliance.
* Supporting documentation.

The submission may be:

* Approved
* Returned for correction
* Rejected

---

## Stage 10 – Client Delivery

Approved verification reports are delivered to the employer.

The employer uses the report for business decision-making.

---

# Exceptional Scenarios

The workflow supports business exceptions including:

* Candidate unavailable.
* Incorrect address.
* Address not traceable.
* Verification refused.
* Safety concerns.
* Incomplete documentation.
* Internet unavailable.

Each exception is recorded as part of the verification outcome.

---

# Business Rules

The workflow enforces the following principles:

* Every assignment is assigned to one Field Executive.
* Verification should be performed at the candidate location.
* Evidence must accompany every verification.
* Verification results must be reviewable.
* Every completed verification is auditable.
* Offline operation must not prevent completion of field activities.

---

# Success Criteria

A verification workflow is considered complete when:

* Verification activities are finished.
* Required evidence has been collected.
* Verification has been submitted.
* Quality review is complete.
* Final report is available to the employer.

---

# Relationship to the Mobile Application

The mobile application is an execution tool for the Field Executive.

It enables:

* Assignment management
* Evidence collection
* Secure authentication
* Offline operation
* Verification submission

The mobile application does not define the business workflow; it implements it through the Verification Runtime Engine.

---

# Business Workflow Principle

> **The business workflow defines *what* must happen.**

> **The Verification Runtime Engine defines *how* the workflow is executed on the mobile device.**

This separation ensures that business processes remain stable while allowing the mobile platform to evolve independently.
