# Login with Device Binding/Restriction

## Overview

Device binding is a security feature that prevents unauthorized access by restricting user accounts to specific devices. When a user logs in from a device for the first time, that device becomes bound to their account. Subsequent login attempts from different devices are blocked, preventing credential theft and unauthorized access.

**Status:** ✅ Implemented and working
**Date Implemented:** August 31, 2024

---

## Feature Requirements

### Business Rules

1. **One Device Per User**: A single user account can only be logged in from ONE device
2. **One User Per Device**: A single device can only be bound to ONE user account
3. **Bidirectional Validation**: Both directions are enforced simultaneously
4. **Admin Reset Only**: Device binding can only be changed by administrators via backend database manipulation
5. **Complete Device Information**: Full device details are captured and stored for audit purposes

### Security Benefits

- Prevents credential theft exploitation
- Detects unauthorized access attempts
- Creates audit trail of device changes
- Protects Field Executives from device compromise

---

## Implementation Details

### Server-Side (FullScanServer)

#### Database Schema

**Migration:** `012_add_device_binding.sql`

```sql
ALTER TABLE field_executives ADD COLUMN device_id TEXT;
ALTER TABLE field_executives ADD COLUMN device_details TEXT;
CREATE INDEX idx_field_executives_device_id ON field_executives(device_id);
```

**Columns Added:**
- `device_id` (TEXT): Unique identifier of the bound device
- `device_details` (TEXT): JSON object containing complete device information

#### Types & Interfaces

**File:** `src/types/auth.types.ts`

```typescript
export interface DeviceDetails {
  readonly deviceName: string;      // e.g., "Samsung Galaxy S21"
  readonly model: string;            // e.g., "SM-G991B"
  readonly brand: string;            // e.g., "Samsung"
  readonly osVersion: string;        // e.g., "13.0"
  readonly appVersion: string;       // e.g., "0.0.1"
  readonly systemName: string;       // e.g., "Android"
  readonly uniqueId: string;         // Device unique identifier
}

export interface LoginInput {
  readonly username: string;
  readonly password: string;
  readonly deviceId: string;         // NEW: Device identifier
  readonly deviceDetails: DeviceDetails;  // NEW: Full device info
}
```

#### Request Validation

**File:** `src/routes/schemas/auth.schema.ts`

```typescript
export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
    deviceId: z.string().min(1).max(500),           // Required
    deviceDetails: z.object({
      deviceName: z.string().max(255),
      model: z.string().max(255),
      brand: z.string().max(255),
      osVersion: z.string().max(255),
      appVersion: z.string().max(255),
      systemName: z.string().max(255),
      uniqueId: z.string().max(500),
    }),
  }),
  // ... other validation
});
```

#### Login Validation Logic

**File:** `src/services/auth.service.ts`

**Process:**

1. **Validate Credentials**
   - Check username exists
   - Verify password hash matches
   - Throw 401 if either fails

2. **Validate Device ID Required**
   - Check deviceId is provided and non-empty
   - Throw 400 if missing

3. **Check Cross-Device Binding** (Device → User)
   - Query if this deviceId is already bound to a user
   - If bound to a DIFFERENT user → Throw 403 error
   - Error message: "This device is already bound to [user name]. Please contact admin..."

4. **Check Cross-User Binding** (User → Device)
   - Check if this user is already bound to a different device
   - If yes → Throw 403 error
   - Error message: "This account is already logged in from [device name]. Please contact admin..."

5. **Store Device Binding** (First Login or Device Update)
   - If user has no device binding OR device changed:
   - Call `updateFieldExecutiveDeviceBinding(userId, deviceId, deviceDetailsJSON)`
   - Store device_id and device_details in database

6. **Issue Token**
   - Create JWT token with fieldExecutiveId
   - Token expiry: 12 hours
   - Return token + field executive data

#### Data Access Layer

**File:** `src/db/field-executive.dao.ts`

```typescript
// Find field executive by device ID
export function findFieldExecutiveByDeviceId(deviceId: string): 
  FieldExecutiveRow | undefined

// Update device binding information
export function updateFieldExecutiveDeviceBinding(
  id: string,
  deviceId: string,
  deviceDetails: string
): void
```

#### Error Responses

| Status | Error | Scenario |
|--------|-------|----------|
| 401 | Invalid username or password | Credentials don't match |
| 400 | Device ID is required | deviceId not provided or empty |
| 403 | This device is already bound to [user] | Device bound to different user |
| 403 | This account is already logged in from [device] | User bound to different device |

---

### Client-Side (FullScanApp)

#### Device Information Collection

**File:** `src/infrastructure/device/index.ts`

```typescript
export interface DeviceInfo {
  readonly deviceName: string;
  readonly model: string;
  readonly brand: string;
  readonly osVersion: string;
  readonly appVersion: string;
  readonly systemName: string;
  readonly uniqueId: string;
}

// Collect all device information
export async function getDeviceInfo(): Promise<DeviceInfo>

// Get unique device identifier
export async function getDeviceId(): Promise<string>
```

**Data Source:** `react-native-device-info` library (v15.0.2)

#### Login Request

**File:** `src/repositories/authentication-repository.ts`

```typescript
export async function login(credentials: LoginCredentials): Promise<void> {
  // Collect device info
  const deviceId = await getDeviceId();
  const deviceInfo = await getDeviceInfo();

  // Build request payload
  const loginRequest: LoginRequest = {
    username: credentials.username,
    password: credentials.password,
    deviceId,
    deviceDetails: deviceInfo,
  };

  // Send to server
  const response = await apiClient.post<ApiEnvelope<LoginResponseDto>>(
    '/auth/login',
    loginRequest
  );

  // Store token on success
  const { token } = response.data.data;
  await TokenStorageService.saveToken(token);
}
```

#### Error Handling

**File:** `src/features/authentication/types/login-form.types.ts`

```typescript
export type LoginErrorKey = 
  | 'invalidCredentials'
  | 'network'
  | 'serverUnavailable'
  | 'deviceMismatch';  // NEW
```

**File:** `src/features/authentication/hooks/use-login-form.ts`

```typescript
function resolveLoginErrorKey(error: unknown): LoginErrorKey {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status === 401
      ? 'invalidCredentials'
      : status === 403
      ? 'deviceMismatch'      // NEW: Map HTTP 403
      : status !== undefined && status >= 500
      ? 'serverUnavailable'
      : 'network';
  }
  return 'network';
}
```

#### Localization

**English** (`src/localization/en/common.json`)
```json
"login.errors.deviceMismatch": "This account is already logged in from another device. Please contact your administrator to change device binding."
```

**Hindi** (`src/localization/hi/common.json`)
```json
"login.errors.deviceMismatch": "यह खाता पहले से ही किसी दूसरे डिवाइस से लॉगिन है। कृपया डिवाइस बाइंडिंग बदलने के लिए अपने व्यवस्थापक से संपर्क करें।"
```

**Telugu** (`src/localization/te/common.json`)
```json
"login.errors.deviceMismatch": "ఈ ఖాతా ఇప్పటికే మరొక పరికరం నుండి లాగిన్ చేయబడింది. దయచేసి పరికరం బైండింగ్‌ని మార్చడానికి మీ నిర్వాహకుడిని సంప్రదించండి."
```

---

## Workflow Examples

### Scenario 1: First Login (Device A, User fe001)

```
Request:
{
  "username": "fe001",
  "password": "password123",
  "deviceId": "device-a-uuid",
  "deviceDetails": {
    "deviceName": "Samsung Galaxy S21",
    "model": "SM-G991B",
    "brand": "Samsung",
    "osVersion": "13.0",
    "appVersion": "0.0.1",
    "systemName": "Android",
    "uniqueId": "device-a-uuid"
  }
}

Server Processing:
1. ✅ Username/password valid
2. ✅ No other user bound to device-a-uuid
3. ✅ No other device bound to fe001
4. ✅ Store device binding: fe001 → device-a-uuid
5. ✅ Issue token

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "fieldExecutive": { "id": "fe-001", "name": "Amit Verma", ... }
  }
}
```

### Scenario 2: Same User, Same Device (Device A, User fe001)

```
Request: Same as above

Server Processing:
1. ✅ Username/password valid
2. ✅ Device A already bound to fe001 (same user - OK)
3. ✅ Issue token

Response: Same as above
```

### Scenario 3: Different User, Same Device (Device A, User fe002)

```
Request:
{
  "username": "fe002",
  "password": "password123",
  "deviceId": "device-a-uuid",  // Same device!
  "deviceDetails": { ... }
}

Server Processing:
1. ✅ Username/password valid
2. ❌ Device A already bound to fe001 (different user)
3. Throw 403 error

Response (HTTP 403):
{
  "success": false,
  "error": "This device is already bound to Amit Verma. Please contact admin to change device binding."
}

Client Display:
"This account is already logged in from another device. Please contact your administrator to change device binding."
```

### Scenario 4: Same User, Different Device (Device B, User fe001)

```
Request:
{
  "username": "fe001",
  "password": "password123",
  "deviceId": "device-b-uuid",  // Different device!
  "deviceDetails": { ... }
}

Server Processing:
1. ✅ Username/password valid
2. ✅ No other user bound to device-b-uuid
3. ❌ User fe001 already bound to device-a-uuid (different device)
4. Throw 403 error

Response (HTTP 403):
{
  "success": false,
  "error": "This account is already logged in from Samsung Galaxy S21. Please contact admin to change device binding."
}

Client Display:
"This account is already logged in from another device. Please contact your administrator to change device binding."
```

---

## Admin Operations

### Reset Device Binding

Device binding can ONLY be reset by administrators via backend database operations.

#### SQL Operations

**View Binding:**
```sql
SELECT id, name, username, device_id, device_details 
FROM field_executives 
WHERE device_id IS NOT NULL;
```

**Clear Specific User's Device:**
```sql
UPDATE field_executives 
SET device_id = NULL, device_details = NULL 
WHERE id = 'fe-001';
```

**Clear All Device Bindings:**
```sql
UPDATE field_executives 
SET device_id = NULL, device_details = NULL;
```

**View Device Binding Details:**
```sql
SELECT id, name, username, device_details 
FROM field_executives 
WHERE device_id = 'specific-device-id';
```

#### Important Notes

- Device binding is **NOT** cleared on logout
- Device binding **MUST** be manually reset by admin
- Users cannot self-reset device binding
- This is intentional for security

---

## Testing

### Test Case 1: First Login Success
- **Device:** Any device (Device A)
- **User:** Any user (fe001)
- **Expected:** ✅ Login succeeds, device bound
- **Command:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "fe001",
    "password": "password_hash",
    "deviceId": "uuid-device-a",
    "deviceDetails": { ... }
  }'
```

### Test Case 2: Same User, Same Device
- **Device:** Device A
- **User:** fe001 (same as before)
- **Expected:** ✅ Login succeeds
- **Result:** Works as expected

### Test Case 3: Different User, Same Device
- **Device:** Device A (same physical device)
- **User:** fe002 (different user)
- **Expected:** ❌ Login fails with 403 error
- **Error Message:** "This device is already bound to Amit Verma..."

### Test Case 4: Same User, Different Device
- **Device:** Device B (different device)
- **User:** fe001 (same user)
- **Expected:** ❌ Login fails with 403 error
- **Error Message:** "This account is already logged in from [Device A name]..."

### Test Case 5: Missing Device ID
- **Device:** Any
- **User:** Any
- **Missing:** deviceId field
- **Expected:** ❌ Login fails with 400 error
- **Error Message:** "Device ID is required"

---

## Architecture & Code Files

### Server Files Modified/Created

```
FullScanServer/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 012_add_device_binding.sql     [NEW]
│   │   ├── field-executive.dao.ts              [MODIFIED]
│   │   │   + findFieldExecutiveByDeviceId()
│   │   │   + updateFieldExecutiveDeviceBinding()
│   │   └── connection.ts                       (no changes)
│   ├── types/
│   │   ├── auth.types.ts                       [MODIFIED]
│   │   │   + DeviceDetails interface
│   │   │   + deviceId, deviceDetails in LoginInput
│   │   └── field-executive.types.ts            [MODIFIED]
│   │       + device_id?, device_details? in FieldExecutiveRow
│   ├── services/
│   │   └── auth.service.ts                     [MODIFIED]
│   │       + Device binding validation logic
│   ├── routes/
│   │   └── schemas/
│   │       └── auth.schema.ts                  [MODIFIED]
│   │           + deviceId, deviceDetails validation
│   └── controllers/
│       └── auth.controller.ts                  (no changes)
└── package.json                                [MODIFIED]
    - Build script now copies migrations
```

### Client Files Modified/Created

```
FullScanApp/
├── src/
│   ├── infrastructure/
│   │   └── device/
│   │       └── index.ts                        [MODIFIED]
│   │           + DeviceInfo interface
│   │           + getDeviceInfo() async
│   │           + getDeviceId() async
│   ├── repositories/
│   │   └── authentication-repository.ts        [MODIFIED]
│   │       + DeviceDetails interface
│   │       + LoginRequest interface
│   │       + Device info collection in login()
│   ├── features/
│   │   └── authentication/
│   │       ├── types/
│   │       │   └── login-form.types.ts        [MODIFIED]
│   │       │       + 'deviceMismatch' error key
│   │       └── hooks/
│   │           └── use-login-form.ts          [MODIFIED]
│   │               + Map HTTP 403 to deviceMismatch
│   └── localization/
│       ├── en/
│       │   └── common.json                     [MODIFIED]
│       │       + login.errors.deviceMismatch
│       ├── hi/
│       │   └── common.json                     [MODIFIED]
│       │       + login.errors.deviceMismatch
│       └── te/
│           └── common.json                     [MODIFIED]
│               + login.errors.deviceMismatch
```

---

## Dependencies

**Server:**
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT token generation
- `better-sqlite3` - SQLite database
- `zod` - Request validation

**Client:**
- `react-native-device-info` v15.0.2 - Device information collection
- `axios` - HTTP client
- `react-hook-form` - Form management
- `react-i18next` - Localization

---

## Future Enhancements

1. **Biometric Device Verification**
   - Additional layer using device fingerprinting
   - Detect jailbroken/rooted devices

2. **Device Management UI**
   - Allow users to see bound devices
   - Request device change with admin approval

3. **Device Change History**
   - Audit log of all device binding changes
   - Track who made changes and when

4. **IP Address Tracking**
   - Add IP address to device binding info
   - Flag suspicious IP locations

5. **Time-Based Access Restrictions**
   - Allow device binding change with time window
   - Admin approval workflow

---

## Related Documentation

- [Authentication System](../01-Vision/01-Vision.md)
- [Field Executive Management](../field-executive.md)
- [Device Binding Recovery](spec_device_binding.md) - Admin portal operations

---

## Support & Troubleshooting

### Issue: "Device ID is required" Error
- **Cause:** Client not sending deviceId in login request
- **Solution:** Rebuild client app with updated authentication repository
- **Check:** Verify authentication-repository.ts calls getDeviceId()

### Issue: "This device is already bound to..." Error
- **Cause:** Device already bound to different user
- **Solution:** Admin must reset device binding in database
- **SQL:** `UPDATE field_executives SET device_id = NULL WHERE device_id = 'device-uuid'`

### Issue: "This account is already logged in from..." Error
- **Cause:** User trying to login from different device
- **Solution:** Admin must reset user's device binding
- **SQL:** `UPDATE field_executives SET device_id = NULL WHERE id = 'user-id'`

### Issue: Device Details Not Stored
- **Cause:** Device info collection failed on client
- **Solution:** Check LoggerService logs for device info collection errors
- **Check:** Verify react-native-device-info is properly linked on iOS/Android

---

**Status:** ✅ Production Ready
**Last Updated:** August 31, 2024
