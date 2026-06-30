# Software Requirements Specification (SRS)

## 1. Purpose
FullScanFieldApp digitizes physical background verification by ensuring every verification is performed at the candidate's actual location with tamper-proof evidence.

## 2. Scope
Mobile application for Field Executives + REST API backend for assignment management, evidence storage, and reporting.

## 3. Functional Requirements

### 3.1 Authentication
- FR-01: Field Executives log in with email/password
- FR-02: Biometric authentication required before accessing assignments
- FR-03: JWT-based session with auto-refresh
- FR-04: Role-based access (field_executive, admin, employer)

### 3.2 Assignment Management
- FR-05: Field Executives see list of assigned verifications
- FR-06: Admins create and assign verifications
- FR-07: Employers submit verification requests
- FR-08: Assignment includes candidate name, address, and GPS coordinates
- FR-09: Assignment status tracking (pending, in_progress, completed, rejected)

### 3.3 Evidence Collection
- FR-10: Capture photo with embedded GPS + timestamp watermark
- FR-11: GPS must be within geo-fence of assignment location (200m default)
- FR-12: Photo hashed (SHA-256) immediately after capture
- FR-13: Evidence stored locally when offline
- FR-14: Automatic sync when connectivity restored

### 3.4 Verification Report
- FR-15: Field Executive submits verification report with evidence
- FR-16: Report includes candidate identity confirmation, observations, evidence references
- FR-17: Reports viewable by admin and employer

### 3.5 Offline Support
- FR-18: App functions without network for evidence collection
- FR-19: Sync queue with retry logic
- FR-20: Visual indicator of sync status

## 4. Non-Functional Requirements

- NFR-01: Evidence upload < 30 seconds on 3G connection
- NFR-02: App launch to assignment list < 3 seconds
- NFR-03: Support 500+ concurrent Field Executives
- NFR-04: 99.9% API uptime
- NFR-05: Evidence integrity verifiable at any time via hash
- NFR-06: HTTPS only; no plain HTTP
- NFR-07: iOS 15+ and Android 8.0+ support
