# Functional Requirements

**Document ID:** FRD-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Product Owner

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

This document defines the functional requirements of the FullScan Mobile Platform.

Functional Requirements describe the behavior that the system shall provide to support the business processes defined in the Business Requirements.

These requirements are implementation independent and describe **what the system shall do**, not **how it shall be implemented**.

---

# 2. Scope

This document covers the complete functionality of the mobile application including:

* Authentication
* Assignment Management
* Verification
* Navigation
* Evidence Collection
* Attachments
* Offline Operations
* Synchronization
* Localization
* Theme Support
* Security
* Audit

---

# 3. References

| Document                         | Purpose            |
| -------------------------------- | ------------------ |
| Vision                           | Product Vision     |
| Business Goals                   | Business Direction |
| Business Objectives              | Business Outcomes  |
| Business Rules                   | Business Policies  |
| Business Workflow                | Business Process   |
| Requirements Traceability Matrix | Traceability       |

---

# 4. Functional Requirement Categories

The functional requirements are organized into the following categories.

| Prefix   | Category                  |
| -------- | ------------------------- |
| FR-AUTH  | Authentication            |
| FR-ASN   | Assignment Management     |
| FR-VER   | Verification              |
| FR-GPS   | Location Services         |
| FR-CAM   | Camera & Evidence         |
| FR-ATT   | Attachments               |
| FR-SYNC  | Offline & Synchronization |
| FR-CONF  | Configuration             |
| FR-LOC   | Localization              |
| FR-THEME | Theme                     |
| FR-SEC   | Security                  |
| FR-AUD   | Audit                     |

---

# 5. Authentication Requirements

---

## FR-AUTH-001

### Requirement Name

User Login

### Description

The system shall allow an authorized Field Executive to authenticate using the credentials issued by the backend administration system.

### Business Rule

* BR-AUTH-001

### Priority

Critical

### Actors

* Field Executive

### Preconditions

* User account exists.
* Device is registered.
* Account is active.

### Expected Behaviour

The system shall:

* Accept username and password.
* Validate credentials.
* Establish an authenticated session.
* Load user profile.
* Download required configuration.
* Display assigned work.

### Acceptance Criteria

* Valid users can successfully log in.
* Invalid credentials are rejected.
* Appropriate localized messages are displayed.

---

## FR-AUTH-002

### Requirement Name

Single Device Authentication

### Description

The system shall ensure that a Field Executive can authenticate only from one registered mobile device.

### Business Rule

* BR-AUTH-002

### Priority

Critical

### Acceptance Criteria

* Login succeeds from the registered device.
* Login is rejected from unregistered devices.
* Appropriate localized messages are displayed.

---

## FR-AUTH-003

### Requirement Name

Biometric Authentication

### Description

The system shall allow the authenticated Field Executive to use the device's biometric authentication mechanism for subsequent logins when enabled.

### Business Rule

* BR-AUTH-004

### Priority

High

### Acceptance Criteria

* Biometric authentication can be enabled or disabled.
* Device authentication succeeds using supported biometric methods.
* Biometric information is never transmitted outside the device.

---

# 6. Assignment Requirements

---

## FR-ASN-001

### Requirement Name

View Pending Assignments

### Description

The system shall display all pending assignments allocated to the authenticated Field Executive.

### Business Rule

* BR-005

### Information Displayed

* Candidate Name
* Verification Type
* Address
* Assigned Date
* Due Date
* Status

### Acceptance Criteria

* Only assigned cases are displayed.
* Assignment information is current or available from offline storage.

---

## FR-ASN-002

### Requirement Name

View Completed Assignments

The system shall display previously completed assignments together with submission status and evidence summary.

---

## FR-ASN-003

### Requirement Name

View Assignment Details

The system shall display complete assignment information including:

* Candidate Information
* Employer
* Verification Type
* Address
* Instructions
* Notes
* Masked Contact Numbers

---

## FR-ASN-004

### Requirement Name

Contact Candidate

The system shall allow the Field Executive to initiate a phone call using the configured primary or secondary contact numbers without revealing the complete phone number.

---

# 7. Verification Requirements

---

## FR-VER-001

The system shall allow the Field Executive to initiate verification for an assigned case.

---

## FR-VER-002

The system shall guide the Field Executive through the configured verification workflow.

---

## FR-VER-003

The system shall prevent submission until all mandatory verification activities have been completed.

---

## FR-VER-004

The system shall allow verification outcomes defined by the configured business workflow.

---

# 8. Location Requirements

---

## FR-GPS-001

The system shall obtain the device's geographic location before collecting location-dependent evidence.

---

## FR-GPS-002

The system shall validate that the Field Executive is within the configured verification area before allowing verification to continue.

---

## FR-GPS-003

The system shall detect mock location activity before allowing verification.

---

## FR-GPS-004

The system shall record latitude, longitude, GPS accuracy, altitude, and timestamp for each evidence capture.

---

# 9. Camera Requirements

## FR-CAM-001
Requirement Name

Live Camera Capture

# Description

The system shall capture photographs using the device camera.

Gallery image selection is prohibited.

# Business Rule
BR-015
# Priority

- Critical

# Acceptance Criteria
- Camera opens successfully.
- Gallery selection is unavailable.
- Only live photographs can be captured.

---

## FR-CAM-002
# Requirement Name

Capture Location Metadata

# Description

The system shall automatically capture location metadata whenever a photograph is taken.

# Business Rule
BR-016
# Priority

- Critical

# Metadata Captured
- Latitude
- Longitude
- GPS Accuracy
- Altitude (when available)
- Date
- Time
-Device Identifier

# Acceptance Criteria
Metadata is captured automatically.
Manual entry is not permitted.
Metadata is associated with the captured image.


## FR-CAM-003
# Requirement Name

Image Watermark

# Description

The system shall permanently embed a configurable watermark onto every captured photograph before the image is stored or uploaded.

The watermark shall become part of the image and shall not be removable by the user.

# Business Rule
- BR-016
- BR-017
# Priority

- Critical

# Actors
- Field Executive
- Preconditions
- Camera permission granted.
- GPS available.
- Valid assignment selected.
# Expected Behaviour

The system shall:

- Capture the photograph.
- Obtain the current GPS location.
- Validate GPS accuracy.
- Generate a watermark.
- Permanently embed the watermark into the image.
- Save only the watermarked image.
- Upload only the watermarked image.

The original non-watermarked image shall not be retained by the application.

# Watermark Content

The watermark shall contain:

- Latitude
- Longitude
- Capture Date
- Capture Time

The architecture shall allow future addition of:

- Assignment ID
- Candidate Name
- Executive ID
- Employer Name
- Verification Type
- Address
- Device ID
- GPS Accuracy
- Application Version
- Custom organization text
- Company Logo (optional)

#Watermark Position

The watermark shall be placed at the bottom of the photograph.

The exact position, alignment, spacing, colors, and layout shall be configurable.

Example Watermark
```text
Lat: 17.385044° N
Long: 78.486671° E
29-Jun-2026 10:35 AM
```

Or

```text
Lat: 17.385044° N | Long: 78.486671° E
29-Jun-2026 10:35 AM
```

# Acceptance Criteria
- Every captured image contains a watermark.
- Latitude and longitude are visible.
- Date and time are visible.
- Watermark is readable.
- Watermark is embedded into the image pixels.
- Original image is not retained.
- Watermark cannot be removed through the application.

#Failure Behaviour

If:

- GPS is unavailable
- GPS accuracy is outside the configured threshold
- Watermark generation fails

The image shall not be accepted as verification evidence.

A localized message shall be displayed to the user.

## FR-CAM-004
# Requirement Name

Photo Association

# Description

The system shall associate every captured photograph with the active assignment.

# Business Rule
BR-020
# Acceptance Criteria
Image linked to Assignment ID.
Image appears under the correct attachment category.
Multiple attachments are supported.

---

# 10. Attachment Requirements

---

## FR-ATT-001

The system shall store verification evidence as a collection of attachments.

---

## FR-ATT-002

The system shall support configurable document types received from the backend.

# Examples include:

- Candidate Photo
- Aadhaar Front
- Aadhaar Back
- PAN Card
- Passport
- Driving License
- Residence Proof
- Employment Proof
- Other Documents

---

## FR-ATT-003

The system shall maintain upload status for each attachment independently.

# Each attachment shall maintain:

- Attachment ID
- Assignment ID
- Document Type
- File Name
- File Path
- Latitude
- Longitude
- GPS Accuracy
- Date & Time
- Device ID
- Upload Status
- File Size
- MIME Type

## FR-ATT-00
Requirement Name

Watermarked Evidence Storage

The system shall persist and upload only the watermarked version of captured images.

The original unwatermarked image shall not be used as verification evidence.

# Business Rule
BR-016
BR-017
# Acceptance Criteria
- Stored image contains the watermark.
- Uploaded image contains the watermark.
- Watermark matches the captured metadata.
- Image integrity is preserved throughout offline storage and synchronization.
- I recommend one additional enhancement

Instead of hardcoding the watermark format, make it server configurable. This aligns with your Server-Driven UI philosophy.

For example, the backend could provide a configuration like:
```json 
{
  "enabled": true,
  "position": "bottom-center",
  "background": "semi-transparent",
  "textColor": "#FFFFFF",
  "fontSize": 14,
  "showLatitude": true,
  "showLongitude": true,
  "showDate": true,
  "showTime": true,
  "showAssignmentId": false,
  "showExecutiveId": false,
  "showCompanyLogo": false
}
```
---

# 11. Offline Requirements

---

## FR-SYNC-001

The system shall allow verification activities while internet connectivity is unavailable.

---

## FR-SYNC-002

The system shall persist pending submissions locally.

---

## FR-SYNC-003

The system shall synchronize pending submissions automatically when connectivity is restored.

---

# 12. Localization Requirements

---

## FR-LOC-001

The system shall support English.

---

## FR-LOC-002

The system shall support Hindi.

---

## FR-LOC-003

The system shall support Telugu.

---

## FR-LOC-004

The system shall localize all user-visible text, validation messages, alerts, and labels.

---

# 13. Theme Requirements

---

## FR-THEME-001

The system shall support Light Theme.

---

## FR-THEME-002

The system shall support Dark Theme.

---

## FR-THEME-003

The system shall support the device's System Theme preference.

---

# 14. Traceability

Every Functional Requirement shall trace to:

* Business Goal
* Business Objective
* Business Rule
* Architecture Component
* Runtime Component
* Test Case

The Requirements Traceability Matrix is the authoritative source for these mappings.

---

# 15. Ownership

Functional Requirements are owned by the Solution Architect and approved by the Product Owner.

---

# 16. Future Enhancements

This document will be extended to include additional requirements for:

* OCR
* Face Matching
* AI-assisted Verification
* Dynamic Plugins
* Configurable Business Rules
* Advanced Reporting

---

# 17. Guiding Philosophy

> Functional Requirements define **what the system shall do**.

> Architecture defines **how the system is designed**.

> Runtime defines **how the platform executes those requirements**.

The FullScan Mobile Platform shall remain configurable, secure, offline-first, and extensible while satisfying every approved Functional Requirement.
