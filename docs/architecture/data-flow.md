# Diagrammes de Flux - NovaConnect

## 1. Authentification Multi-Rôle

```mermaid
sequenceDiagram
    participant User
    participant Web/Mobile
    participant SupabaseAuth
    participant Database
    participant RouteGuard

    User->>Web/Mobile: Email + Password
    Web/Mobile->>SupabaseAuth: POST /auth/v1/token?grant_type=password
    SupabaseAuth->>Database: SELECT * FROM auth.users WHERE email = ?
    Database-->>SupabaseAuth: User Record
    SupabaseAuth->>Database: Verify password hash
    SupabaseAuth-->>Web/Mobile: { access_token, refresh_token, expires_in }

    Web/Mobile->>Database: SELECT * FROM user_profiles WHERE user_id = auth.uid()
    Database-->>Web/Mobile: { role, school_id, ... }
    Web/Mobile->>RouteGuard: Navigate to dashboard
    RouteGuard->>Database: Check user role and permissions
    Database-->>RouteGuard: Permissions granted
    RouteGuard-->>User: Render Dashboard
```

## 2. Présence Prof + QR → Fusion

```mermaid
sequenceDiagram
    participant Prof
    participant Élève
    participant Web
    participant Supabase
    participant NotificationService

    Note over Prof,Élève: Teacher marks attendance
    Prof->>Web: POST /api/attendance/sessions
    Web->>Supabase: INSERT INTO attendance_sessions (...)
    Supabase-->>Web: Session created
    Prof->>Web: POST /api/attendance/mark (student-1: present)
    Web->>Supabase: INSERT INTO attendance_records (student_id, status, source: teacher)
    Supabase-->>Web: Attendance marked

    Note over Prof,Élève: Student scans QR
    Élève->>Web: Scan QR code
    Web->>Supabase: POST /api/attendance/qr/validate
    Supabase-->>Web: QR valid
    Web->>Supabase: INSERT INTO attendance_records (student_id, status: present, source: qr)

    Note over Prof,Élève: Merge attendance
    Supabase->>Supabase: Detect duplicate (same student, same session)
    Supabase->>Supabase: Apply merge_strategy (teacher_wins)
    Supabase->>Supabase: UPDATE attendance_records SET final_status = ?
    Supabase->>NotificationService: Trigger notification
    NotificationService-->>Élève: Push + Email: "Présence enregistrée"
```

## 3. Notes: Saisie → Validation → Publication → Notification

```mermaid
sequenceDiagram
    participant Prof
    participant Admin
    participant Web
    participant Supabase
    participant NotificationService

    Note over Prof: Teacher enters grades
    Prof->>Web: POST /api/grades (student: student-1, score: 15)
    Web->>Supabase: INSERT INTO grades (status: draft)
    Supabase-->>Web: Grade created (draft)
    Prof->>Web: POST /api/grades/grade-1/submit
    Web->>Supabase: UPDATE grades SET status = submitted
    Supabase-->>Web: Grade submitted

    Note over Admin: Admin validates
    Admin->>Web: GET /api/grades/pending
    Web->>Supabase: SELECT * FROM grades WHERE status = submitted
    Supabase-->>Web: List of pending grades
    Admin->>Web: POST /api/grades/validate (grade_ids: [grade-1])
    Web->>Supabase: UPDATE grades SET status = approved
    Supabase-->>Web: Grades approved

    Note over Admin: Admin publishes
    Admin->>Web: POST /api/grades/publish (grade_ids: [grade-1])
    Web->>Supabase: UPDATE grades SET status = published, published_at = NOW()
    Supabase->>NotificationService: Trigger notification
    NotificationService-->>Prof: Email: "Notes publiées"
    NotificationService-->>Élève: Push + Email: "Nouvelle note disponible"
```

## 4. Paiement → Blocage Documents → Override Admin

```mermaid
sequenceDiagram
    participant Admin
    participant Élève
    participant Web
    participant Supabase
    participant DocumentService

    Note over Admin: Admin creates payment schedule
    Admin->>Web: POST /api/payments/schedules
    Web->>Supabase: INSERT INTO payment_schedules (...)
    Web->>Supabase: INSERT INTO payment_installments (3 installments)
    Supabase-->>Web: Schedule created

    Note over Élève: Student tries to download bulletin
    Élève->>Web: GET /bulletins/download
    Web->>Supabase: SELECT * FROM payment_installments WHERE student_id = ? AND paid = false
    Supabase-->>Web: Unpaid installments found
    Web->>Supabase: SELECT document_access_policy FROM schools
    Supabase-->>Web: Policy: BLOCKED
    Web-->>Élève: 403 Forbidden: "Paiements requis"

    Note over Admin: Admin overrides
    Admin->>Web: POST /api/documents/access/override
    Web->>Supabase: UPDATE document_access_logs SET access_granted = true, justification = ?
    Supabase->>DocumentService: Trigger audit log
    DocumentService-->>Supabase: Audit log created
    Web-->>Admin: "Accès autorisé"
    Élève->>Web: GET /bulletins/download
    Web-->>Élève: PDF Bulletin
```

## 5. Sync Offline: Queue → Push Cloud → Pull Cloud → Conflict Resolution

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Queue
    participant Cloud
    participant ConflictResolver

    Note over User: Offline mode
    User->>App: Mark attendance
    App->>Queue: ADD { id: op-1, resource: attendance, action: create, synced: false }
    Queue-->>App: Queued (1 pending)

    Note over User: Back online
    App->>Queue: GET all operations WHERE synced = false
    Queue-->>App: [op-1, op-2, op-3]
    App->>Cloud: POST /api/sync/push [{ op-1, op-2, op-3 }]
    Cloud->>Cloud: Process operations
    Cloud-->>App: { pushed: 3, failed: 0 }
    App->>Queue: UPDATE operations SET synced = true

    App->>Cloud: POST /api/sync/pull { since: last_sync, resources: [attendance, grades] }
    Cloud->>Cloud: SELECT * FROM attendance WHERE updated_at > last_sync
    Cloud-->>App: { attendance: [...], grades: [...] }
    App->>App: Merge local + remote data

    App->>ConflictResolver: Detect conflicts?
    ConflictResolver->>ConflictResolver: Check resource type
    alt Payment conflict
        ConflictResolver->>ConflictResolver: Strategy: append-only
        ConflictResolver-->>App: Merge (keep both)
    else Grade conflict
        ConflictResolver->>ConflictResolver: Strategy: versioning
        ConflictResolver-->>App: Notify admin (manual resolution)
    else Attendance conflict
        ConflictResolver->>ConflictResolver: Strategy: merge (teacher_wins)
        ConflictResolver-->>App: Apply teacher status
    end

    App->>Queue: UPDATE queue stats
    Queue-->>App: { pending: 0, synced: 3 }
    App-->>User: "Synchronisation terminée"
```

## 6. Gateway LAN Discovery and Failover

```mermaid
sequenceDiagram
    participant Browser
    participant mDNS
    participant GatewayLAN
    participant Cloud

    Note over Browser: App starts
    Browser->>mDNS: Browse for novaconnect-gateway.local
    mDNS-->>Browser: Found gateway at 192.168.1.100

    Browser->>GatewayLAN: GET /health
    GatewayLAN-->>Browser: 200 OK (latency: 50ms)

    Browser->>Browser: Check latency < 200ms? YES
    Browser->>GatewayLAN: POST /api/sync/pull
    GatewayLAN-->>Browser: Local data (fast)

    Note over GatewayLAN: Gateway offline
    GatewayLAN->>Browser: Connection timeout
    Browser->>Browser: Gateway unreachable
    Browser->>Cloud: Failover to cloud
    Cloud-->>Browser: Data from Supabase

    Browser->>Browser: Switch mode: LAN → Cloud
    Browser-->>User: "Mode Cloud activé"

    Note over GatewayLAN: Gateway back online
    GatewayLAN->>mDNS: Announce presence
    mDNS-->>Browser: Gateway detected
    Browser->>GatewayLAN: GET /health
    GatewayLAN-->>Browser: 200 OK (latency: 50ms)
    Browser->>Browser: Check latency < 200ms? YES
    Browser->>GatewayLAN: POST /api/sync/pull
    Browser->>Browser: Switch mode: Cloud → LAN
    Browser-->>User: "Mode LAN activé"
```

## 7. Présence QR avec Validation Anti-Fraude

```mermaid
sequenceDiagram
    participant Élève
    participant Mobile
    participant Supabase
    participant EdgeFunction

    Élève->>Mobile: Open camera
    Mobile->>Mobile: Scan QR code
    Mobile->>Mobile: Decode QR data (session_id, timestamp, signature)

    Mobile->>Supabase: POST /api/attendance/qr/validate { session_id, signature, timestamp }
    Supabase->>EdgeFunction: Invoke validate-qr-attendance

    EdgeFunction->>EdgeFunction: Verify HMAC signature
    EdgeFunction->>EdgeFunction: Check timestamp (max age: 5 min)
    EdgeFunction->>EdgeFunction: Verify session exists
    EdgeFunction->>EdgeFunction: Check student enrolled in session class
    EdgeFunction->>EdgeFunction: Check not already marked

    alt Signature invalid
        EdgeFunction-->>Supabase: Error: "QR invalide"
        Supabase-->>Mobile: 400 Bad Request
        Mobile-->>Élève: "Code QR invalide"
    else Timestamp expired
        EdgeFunction-->>Supabase: Error: "QR expiré"
        Supabase-->>Mobile: 400 Bad Request
        Mobile-->>Élève: "Code QR expiré"
    else Already marked
        EdgeFunction-->>Supabase: Error: "Déjà marqué"
        Supabase-->>Mobile: 409 Conflict
        Mobile-->>Élève: "Présence déjà enregistrée"
    else Valid
        EdgeFunction->>Supabase: INSERT INTO attendance_records (student_id, session_id, status: present, source: qr)
        Supabase-->>Mobile: 201 Created
        Mobile-->>Élève: "Présence validée ✓"
    end
```

## 8. Génération Bulletin de Notes

```mermaid
sequenceDiagram
    participant Admin
    participant Web
    participant Supabase
    participant EdgeFunction
    participant Storage

    Admin->>Web: GET /students/student-1/bulletin
    Web->>Supabase: SELECT * FROM grades WHERE student_id = student-1 AND status = published
    Web->>Supabase: SELECT * FROM students WHERE id = student-1
    Web->>Supabase: SELECT * FROM schools WHERE id = school-1
    Supabase-->>Web: Data fetched

    Web->>EdgeFunction: POST /generate-report-card { student_id, trimester }
    EdgeFunction->>EdgeFunction: Calculate average (weighted)
    EdgeFunction->>EdgeFunction: Determine ranking
    EdgeFunction->>EdgeFunction: Assign mention (Excellent, Bien, etc.)
    EdgeFunction->>EdgeFunction: Generate appreciation text
    EdgeFunction->>Storage: Upload PDF to Storage
    Storage-->>EdgeFunction: URL: /storage/bulletins/student-1-t1.pdf
    EdgeFunction-->>Web: { report_card_id, pdf_url }

    Web->>Supabase: INSERT INTO report_cards (student_id, pdf_url, average, ranking, mention)
    Supabase-->>Web: Report card created
    Web-->>Admin: Show bulletin with download button
    Admin->>Storage: GET /bulletins/student-1-t1.pdf
    Storage-->>Admin: PDF file
```

## 9. Notification Multi-Canal

```mermaid
sequenceDiagram
    participant Trigger
    participant Supabase
    participant NotificationService
    participant EmailProvider
    participant PushProvider
    participant SMSProvider

    Trigger->>Supabase: INSERT INTO notifications (user_id, type, title, body)
    Supabase->>Supabase: Trigger notify_new_record
    Supabase->>NotificationService: POST /send-notification

    NotificationService->>Supabase: SELECT * FROM notification_preferences WHERE user_id = ?
    Supabase-->>NotificationService: { email: true, push: true, sms: false }

    NotificationService->>NotificationService: Check user channels
    NotificationService->>EmailProvider: Send email (SMTP/SendGrid)
    EmailProvider-->>NotificationService: Email sent
    NotificationService->>Supabase: UPDATE notifications SET status: sent, channels: ['email']

    NotificationService->>PushProvider: Send push (Expo/Firebase)
    PushProvider-->>NotificationService: Push delivered
    NotificationService->>Supabase: UPDATE notifications SET channels: ['email', 'push']

    NotificationService-->>Supabase: 200 OK
    Supabase->>Supabase: UPDATE notifications SET status: delivered
```

## 10. Sync Bidirectionnelle Gateway ↔ Cloud

```mermaid
sequenceDiagram
    participant Gateway
    participant Queue
    participant Cloud
    participant ConflictResolver

    Note over Gateway: Local operations (offline)
    Gateway->>Queue: ADD { resource: attendance, action: create, data: {...} }
    Queue-->>Gateway: Queued (pending)

    Note over Gateway: Sync interval (every 30s)
    Gateway->>Queue: GET pending operations
    Queue-->>Gateway: [op-1, op-2]

    Gateway->>Cloud: POST /api/sync/push [{ op-1, op-2 }]
    Cloud->>Cloud: Apply operations to Supabase
    Cloud-->>Gateway: { pushed: 2, failed: 0 }
    Gateway->>Queue: UPDATE operations SET synced = true

    Gateway->>Cloud: POST /api/sync/pull { since: last_sync }
    Cloud->>Cloud: Fetch changes from Supabase
    Cloud-->>Gateway: { attendance: [...], grades: [...], ... }

    Gateway->>ConflictResolver: Detect conflicts?
    alt Conflict detected
        ConflictResolver->>ConflictResolver: Apply strategy per resource type
        ConflictResolver-->>Gateway: Resolved data
    else No conflict
        ConflictResolver-->>Gateway: Merge data directly
    end

    Gateway->>Gateway: Update local database
    Gateway->>Gateway: Emit event: sync_complete
    Gateway-->>User: "Synchronisation terminée"
```

## Conclusion

Ces diagrammes illustrent les flux critiques de NovaConnect :
- Authentification sécurisée multi-rôle
- Présence avec fusion prof/QR
- Cycle de vie des notes
- Gestion des paiements et blocages
- Synchronisation offline
- Découverte et basculement Gateway LAN
- Validation anti-fraude QR
- Génération de bulletins
- Notifications multi-canal
- Sync bidirectionnelle

Chaque flux est optimisé pour :
- Performance (latency minimale)
- Fiabilité (retry, error handling)
- Scalabilité (async, queues)
- Sécurité (validation, audit)
- UX (feedback utilisateur, notifications)
