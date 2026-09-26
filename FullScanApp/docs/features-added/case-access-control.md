# Case Access Control Based on Status

## Overview

Implemented status-based access control for case details viewing and editing. Users can now view case information with different permission levels depending on the case's current status (bucket).

## Feature Description

### Case Status Buckets

Cases flow through four status buckets, each with different access rules:

| Bucket | Visibility | Editability | Action |
|--------|-----------|-------------|--------|
| **new** | Case info + location only | View-only | Accept button |
| **pending** | All sections visible | Full editing | Submit button |
| **beyondTat** | All sections visible | Full editing | Submit button |
| **completed** | All sections visible | Read-only | Alert message |

### User Flow

#### 1. New Case (Awaiting Acceptance)
- **What's shown**: Only case information section and location section
- **Hidden sections**: Masked calls, instructions, verification outcome, residence details, photo evidence
- **Action button**: "Accept" button
- **Confirmation**: Dialog asks "Are you sure you want to accept this case?" before proceeding
- **After acceptance**: Case moves to 'pending' status and all sections become visible and editable

#### 2. Pending Case (In Progress)
- **What's shown**: All sections visible
- **Editability**: All form fields are fully editable
- **Action button**: "Submit Verification Report" button
- **Status after submit**: Case moves to 'completed' status

#### 3. TAT Case (Beyond SLA)
- **What's shown**: All sections visible
- **Editability**: All form fields are fully editable (same as pending)
- **Action button**: "Submit Verification Report" button
- **Status after submit**: Case moves to 'completed' status

#### 4. Completed Case (Verified)
- **What's shown**: All sections visible for review
- **Editability**: All form fields are disabled and read-only
- **Calling**: Masked numbers stay visible, but Call Primary / Call Secondary are disabled
- **Drafts**: A leftover local draft is never restored — the submitted values are shown
- **Action button**: "This case is read-only and cannot be edited" alert message
- **Status**: Cannot be modified further — `useCaseDetails` also refuses `submit` and `saveDraft`
  for a read-only case, so a stray call can't resubmit it
- **Geo-fence**: Not applied (validation is Pending-only), so a completed case can be reviewed anywhere

## Implementation Details

### Files Modified

#### 1. **src/features/cases/utils/case-access-control.ts**
Core utility functions for access control logic:
- `isReadOnlyCaseBucket(bucket)` - Returns true only for 'completed' cases
- `isNewCaseBucket(bucket)` - Returns true for 'new' cases
- `shouldShowDetailFormSections(bucket)` - Returns false for 'new' cases, true for others
- `getReadOnlyReasonKey(bucket)` - Returns localization key for read-only explanations

#### 2. **src/features/cases/hooks/use-case-details.ts**
Enhanced hook with new computed properties:
- `isNewCase` - Boolean flag indicating if case is in 'new' bucket
- `shouldShowDetailFormSections` - Boolean flag for rendering form sections
- `acceptCase(onAccepted)` - Callback to accept a new case via `acceptCaseApi()`

After acceptance, the hook is refreshed to get the updated case status from the server.

#### 3. **src/features/cases/screens/case-details-screen.tsx**
Updated screen rendering logic:
- Conditionally renders masked calls and instructions only for non-new cases
- Conditionally renders verification outcome, residence, and photo sections based on `shouldShowDetailFormSections`
- Shows "Accept" button with confirmation dialog for new cases
- Shows "Submit" button for pending/TAT cases
- Shows read-only alert for completed cases

Confirmation dialog prevents accidental acceptance:
- Displays: "Are you sure you want to accept this case? Once accepted, you will be able to view and edit all case details."
- Two buttons: Cancel (dismiss) and Accept (proceed)
- Dialog available in English, Hindi, and Telugu

#### 4. **src/features/cases/components/form-*.tsx** (text-field, textarea-field, select-field)
Added `isDisabled` prop to form components:
- When disabled: Fields appear with reduced opacity (0.6)
- When disabled: Text inputs have `editable={false}`
- When disabled: Selects cannot be interacted with

#### 5. **src/features/cases/components/case-*.tsx** (verification-outcome, verified-residence, photo-evidence, photo-gallery)
Enhanced section components with conditional disabling:
- Pass `isReadOnly` flag from parent screen
- All interactive elements (fields, buttons, selects) respect read-only state
- Visual feedback provided through opacity changes

#### 6. **Localization files** (en/hi/te)
Added translations for new UI elements:
- `caseDetails.readOnly.message` - Read-only alert message
- `caseDetails.acceptConfirmation.message` - Confirmation dialog message
- `caseList.actions.cancel` - Cancel button label

### Repository Integration

Uses existing `acceptCaseApi()` from `src/repositories/case-repository.ts`:
- Calls `PATCH /cases/{caseId}/accept`
- Moves case from 'new' to 'pending' bucket
- Returns updated case with new bucket status

## Testing

Added comprehensive test coverage in `src/features/cases/hooks/use-case-details.test.ts`:
- Verifies new cases hide detail form sections
- Verifies pending cases show all sections and are editable
- Verifies TAT cases show all sections and are editable
- Verifies completed cases show all sections but are read-only

## Accessibility

- All buttons have `accessibilityLabel` for screen readers
- Confirmation dialog uses semantic AlertDialog components
- Read-only status is visually indicated through opacity and disabled states
- Form labels remain visible even when fields are disabled

## Edge Cases Handled

1. **Rapid clicks on Accept**: Button disabled during submission via `isSubmitting` flag
2. **Network failure during acceptance**: Error state shown, case remains in 'new' bucket
3. **Concurrent modifications**: Case detail refreshed after acceptance to get server's authoritative state
4. **Offline scenarios**: Not applicable - acceptance requires server communication

## Localization

Feature supports three languages out of the box:
- English (en)
- Hindi (hi)
- Telugu (te)

All user-facing strings are properly localized, including:
- Section titles
- Button labels
- Confirmation messages
- Status explanations