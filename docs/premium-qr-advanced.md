# Premium QR Attendance - Advanced Features

## Overview

The Premium QR Attendance module provides advanced QR code functionality for NovaConnect, including:

- **Rapid QR Rotation**: Automatic rotation every 30-600 seconds
- **Device Fingerprinting**: Track and identify student devices
- **Anomaly Detection**: Automatic detection of suspicious activities
- **Enhanced Security**: HMAC-SHA256 signatures with dedicated premium secrets
- **Real-time Monitoring**: Live attendance tracking and QR management
- **Fraud Prevention**: Multi-device tracking and impossible location detection

## Table of Contents

1. [Activation](#activation)
2. [Configuration](#configuration)
3. [Usage](#usage)
4. [Security](#security)
5. [Troubleshooting](#troubleshooting)
6. [API Reference](#api-reference)

---

## Activation

### Requirements

- **License**: Premium or Enterprise license
- **Module**: `qr_advanced` must be enabled in school settings
- **Environment Variables**: `QR_PREMIUM_SECRET` must be configured

### Enabling the Module

1. Navigate to **Settings > QR Premium** in the admin dashboard
2. Verify your license status is Active
3. Click "Enable Premium QR Module"
4. Configure the specific features you want to use

### License Verification

The system automatically verifies:
- License type (Premium/Enterprise)
- License status (Active)
- License expiration date
- Module enablement in school settings

---

## Configuration

### Class QR Codes

**Settings**:
- **Enable Class QR Codes**: Generate unique QR codes for each class
- **Rotation Interval**: 30-600 seconds (default: 60s)
- **Rotation Mode**: Automatic (scheduled) or Manual

**How it works**:
1. Admin generates a QR code for a specific class
2. QR code is valid for the configured rotation interval
3. After expiration, QR automatically rotates (new token/signature)
4. Students scan the QR to mark attendance
5. System validates enrollment, location, and device fingerprint

### Student Card QR Codes

**Settings**:
- **Enable Card QR Codes**: Use QR codes on student ID cards
- **Device Binding**: Limit card usage to a single device
- **Validity Period**: 1 month to 2 years

**How it works**:
1. Generate student cards with embedded QR codes
2. QR includes student ID, card ID, and expiration timestamp
3. Students scan their card to mark attendance
4. Optional: Device binding links card to first device that scans it

### Anomaly Detection

**Settings**:
- **Enable Anomaly Detection**: Automatically detect suspicious activities
- **Max Devices per Student**: 1-5 devices (default: 2)
- **Detection Types**:
  - Multiple devices: Student using >2 devices in 24h
  - Rapid scans: Multiple scans within 5 minutes
  - Impossible location: Scans from physically impossible locations
  - Signature mismatch: Invalid QR signatures
  - Expired reuse: Scanning expired QR codes
  - Device binding violation: Card used from unauthorized device

**Severity Levels**:
- **Low**: Informational, likely false positive
- **Medium**: Suspicious, worth investigating
- **High**: Likely fraud, requires attention
- **Critical**: Definite fraud, immediate action required

---

## Usage

### For School Administrators

#### Generate Class QR Code

1. Navigate to **Attendance > QR Classes**
2. Find the desired class
3. Click "Generate" or "View QR"
4. QR code is displayed with countdown timer
5. Project in classroom for students to scan

#### Monitor Anomalies

1. Navigate to **Attendance > Anomalies**
2. View all detected anomalies with severity levels
3. Click "View" on an anomaly to see details
4. Add resolution notes and mark as resolved
5. System sends notifications for high/critical anomalies

#### Configure Settings

1. Navigate to **Settings > QR Premium**
2. Adjust rotation intervals, detection thresholds
3. Enable/disable specific features
4. Save settings (takes effect immediately)

### For Teachers

#### Display QR in Class

1. Navigate to **Attendance > QR Display > [Class Name]**
2. Click "Fullscreen" for projection mode
3. QR auto-rotates when expired
4. View real-time count of present students

#### Manage QR Manually

1. Click "Rotate Now" to force rotation
2. Click "Pause" to temporarily disable rotation
3. Click "Generate New" to create fresh QR code
4. Click "Download" to save QR as PNG/PDF

### For Students

#### Scan QR Code

1. Open NovaConnect mobile app
2. Navigate to **Attendance > Scan**
3. Position QR code within camera frame
4. Wait for scan confirmation (✓ Success or ✗ Failed)
5. System records attendance with device fingerprint

#### View Scan History

1. In scanner, click "View History"
2. See last 10 scans with status
3. Tap each scan for details

---

## Security

### HMAC-SHA256 Signatures

Every QR code includes a cryptographic signature:

```
token = schoolId:classId:timestamp:nonce:generationCount
signature = HMAC-SHA256(token, QR_PREMIUM_SECRET)
```

**Verification Process**:
1. Student scans QR code
2. Edge Function verifies signature using secret
3. Invalid signatures are rejected immediately
4. All signature validations are logged

**Secrets**:
- `QR_SIGNING_SECRET`: Used for standard QR codes
- `QR_PREMIUM_SECRET`: Used for premium QR codes (different secret for enhanced security)

### Device Fingerprinting

Device information collected:
- Platform (iOS/Android)
- Device model
- OS version
- Screen resolution
- Timezone
- Unique device ID (stored locally)

**Fingerprint Generation**:
```typescript
fingerprint = SHA-256(
  platform + "|" +
  model + "|" +
  osVersion + "|" +
  screenResolution + "|" +
  timezone
)
```

**Privacy Note**:
- Device info is used solely for fraud detection
- No personal identifiers are stored
- Fingerprints are one-way hashes (cannot be reversed)

### Rate Limiting

**Default Limits**:
- Standard QR: 1 scan per 15 minutes
- Premium QR: 1 scan per session (stricter)

**Customization**:
Can be adjusted per school in settings (not recommended below 1 minute)

### Audit Trail

All premium QR operations are logged:
- QR generation (who, when, which class)
- QR rotation (automatic/manual, reason)
- Scan attempts (success/failure, device info)
- Anomalies detected (type, severity, context)
- Resolutions (who resolved, notes)

Audit logs are stored in `audit_logs` table and retained per school policy.

---

## Troubleshooting

### Issue: QR Code Not Generating

**Symptoms**: "Generate" button doesn't work or shows error

**Causes**:
- License is inactive or expired
- Module not enabled in school settings
- User lacks admin/supervisor role

**Solutions**:
1. Check license status in Settings
2. Verify `qr_advanced` is in `enabled_modules`
3. Ensure user has proper permissions

### Issue: Students Cannot Scan QR

**Symptoms**: Scan fails with error message

**Common Errors**:

**"Signature QR invalide"**:
- QR code was tampered with
- Wrong QR type (e.g., scanning class QR with basic scanner)
- Edge to Edge Function: Regenerate QR code

**"Ce code QR a expiré"**:
- QR code expired (rotation interval elapsed)
- Time sync issue on student device
- Solution: Wait for auto-rotation or force manual rotation

**"Vous n'êtes pas inscrit dans cette classe"**:
- Student not enrolled in the class
- Wrong class QR code displayed
- Solution: Verify enrollment, display correct QR

**"Veuillez vous connecter au Wi-Fi de l'école"**:
- Wi-Fi validation enabled but not on school network
- Solution: Connect to school Wi-Fi or disable Wi-Fi validation

### Issue: Too Many False Positive Anomalies

**Symptoms**: Legitimate scans marked as suspicious

**Causes**:
- Students legitimately using multiple devices (phone + tablet)
- Rapid scans due to QR rotation
- Max devices setting too low

**Solutions**:
1. Adjust `maxDevicesPerStudent` to 3-4
2. Review anomalies and mark false positives as resolved
3. Consider disabling specific anomaly types if not needed

### Issue: QR Rotation Not Working

**Symptoms**: QR not rotating automatically

**Causes**:
- Cron job not configured
- Edge Function not deployed
- Rotation mode set to Manual

**Solutions**:
1. Check rotation mode setting (should be "automatic")
2. Verify Edge Function `rotate-class-qr-codes` is deployed
3. Configure cron job or external scheduler (see deployment guide)

### Issue: High Memory Usage on Database

**Symptoms**: Slow queries, database performance issues

**Causes**:
- Too many old QR codes and rotation history
- Device fingerprints accumulating
- Anomaly detection generating many records

**Solutions**:
1. Set up periodic cleanup job (archive old records)
2. Add indexes on `qr_class_codes.expires_at`
3. Partition tables by date if very large
4. Monitor query performance with Supabase dashboard

---

## API Reference

### Edge Functions

#### generate-class-qr-premium

**Endpoint**: `POST /functions/v1/generate-class-qr-premium`

**Auth**: Bearer token (user must be admin/supervisor)

**Request**:
```typescript
{
  schoolId: string
  classId: string
  campusId?: string
  rotationIntervalSeconds: number // 30-600
}
```

**Response**:
```typescript
{
  qrCodeId: string
  qrData: string // base64 encoded token+signature
  expiresAt: string // ISO datetime
  rotationIntervalSeconds: number
  classId: string
  generatedAt: string // ISO datetime
}
```

**Errors**:
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (not admin/supervisor)
- `400`: Bad request (invalid params)
- `402`: Premium license required

---

#### rotate-class-qr-codes

**Endpoint**: `POST /functions/v1/rotate-class-qr-codes`

**Auth**: Service role key only

**Request**: (empty body, auth via header)

**Response**:
```typescript
{
  rotatedCount: number
  rotatedQrCodes: Array<{
    qrCodeId: string
    classId: string
    oldToken: string
    newToken: string
    rotatedAt: string
  }>
  errors: string[]
}
```

**Usage**: Called by cron job every 30 seconds or external scheduler

---

#### validate-qr-scan (modified for premium)

**Endpoint**: `POST /functions/v1/validate-qr-scan`

**Auth**: Bearer token (student)

**Request**:
```typescript
{
  token: string
  signature: string
  latitude?: number
  longitude?: number
  wifiSsid?: string
  deviceInfo?: {
    deviceId?: string
    platform: string
    appVersion: string
    model?: string
    osVersion?: string
    screenResolution?: string
    timezone?: string
  }
}
```

**Response (Success)**:
```typescript
{
  success: true
  attendanceRecordId: string
  message: "Présence enregistrée avec succès"
}
```

**Response (Failure)**:
```typescript
{
  success: false
  error: 'expired_qr' | 'invalid_signature' | 'wrong_class' | ...
  message: string
}
```

**Premium Features**:
- Detects premium QR by token format
- Validates with `QR_PREMIUM_SECRET`
- Processes device fingerprinting
- Runs anomaly detection
- Logs with premium metadata

---

### Database Tables

#### qr_class_codes

Stores premium QR codes for classes with rapid rotation.

**Key Columns**:
- `qr_token`: Unique token (schoolId:classId:timestamp:nonce:count)
- `signature`: HMAC-SHA256 signature
- `expires_at`: When QR expires
- `rotation_interval_seconds`: Auto-rotation interval
- `generation_count`: Number of times this QR has been regenerated

**Indexes**:
- `class_id`, `expires_at`, `is_active`, `school_id`

---

#### qr_scan_device_fingerprints

Stores device fingerprints for fraud detection.

**Key Columns**:
- `device_fingerprint`: SHA-256 hash of device attributes
- `device_info`: JSON with platform, model, OS, etc.
- `scan_count`: Number of times this device has scanned
- `is_suspicious`: Flagged for suspicious activity

**Indexes**:
- `device_fingerprint` (unique), `student_id`, `is_suspicious`

---

#### qr_scan_anomalies

Stores detected anomalies and fraud attempts.

**Key Columns**:
- `anomaly_type`: Type of anomaly (enum)
- `severity`: Low/medium/high/critical
- `detected_at`: When anomaly was detected
- `resolution`: Admin notes if resolved
- `reviewed_by`: User who resolved it

**Indexes**:
- `anomaly_type`, `severity`, `detected_at`, `student_id`

---

#### qr_rotation_history

Audit trail of QR code rotations.

**Key Columns**:
- `old_token`: Previous QR token
- `new_token`: New QR token
- `rotation_reason`: scheduled/manual/security_breach
- `rotated_at`: When rotation occurred

**Indexes**:
- `qr_code_id`, `rotated_at`

---

### Helper Functions

#### checkPremiumFeature()

Check if school has access to premium feature.

```typescript
await checkPremiumFeature(schoolId, 'qr_advanced')
// Returns: true/false
```

#### validatePremiumFeature()

Validate premium feature access with detailed error.

```typescript
await validatePremiumFeature(schoolId, 'qr_advanced')
// Returns: { valid: boolean, error?: string }
```

#### getLicenseStatus()

Get license information.

```typescript
await getLicenseStatus(schoolId)
// Returns: {
//   hasLicense: boolean,
//   isActive: boolean,
//   licenseType: string | null,
//   expiresAt: string | null,
//   daysRemaining: number
// }
```

---

## Deployment Checklist

- [ ] Run database migrations
- [ ] Set `QR_PREMIUM_SECRET` environment variable
- [ ] Deploy Edge Functions (generate, rotate, validate, notify)
- [ ] Configure cron job or external scheduler for rotation
- [ ] Test QR generation and scanning
- [ ] Verify anomaly detection works
- [ ] Test admin interfaces (settings, management, monitoring)
- [ ] Test mobile app scanner
- [ ] Set up monitoring for rotation job
- [ ] Configure cleanup jobs for old data
- [ ] Document custom settings for school

---

## Support

For issues or questions:
1. Check this documentation
2. Review error logs in Supabase dashboard
3. Check anomaly detection for patterns
4. Contact NovaConnect support with:
   - School ID
   - License type
   - Error messages/screenshots
   - Steps to reproduce

---

**Version**: 1.0.0
**Last Updated**: 2025-02-02
**Module**: Premium QR Attendance
**License Required**: Premium or Enterprise
