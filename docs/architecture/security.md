# Sécurité - NovaConnect

## Overview

NovaConnect implémente une stratégie de sécurité en profondeur (defense in depth) pour protéger les données sensibles des élèves, familles, et établissements scolaires.

## 1. Row-Level Security (RLS)

### Stratégie par Table

#### Tables Sensibles avec RLS

```sql
-- Écoles
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access" ON schools
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "school_admin_own_school" ON schools
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.school_id = schools.id
      AND user_roles.role = 'school_admin'
    )
  );

-- Utilisateurs
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_users" ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "school_admin_school_users" ON users
  FOR SELECT
  TO authenticated
  USING (
    users.school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('school_admin', 'teacher', 'accountant')
    )
  );

-- Notes
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_assigned_classes" ON grades
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_class_assignments
      WHERE teacher_class_assignments.teacher_id = auth.uid()
      AND teacher_class_assignments.class_id = grades.class_id
    )
  );

CREATE POLICY "students_own_grades" ON grades
  FOR SELECT
  TO authenticated
  USING (
    grades.student_id = auth.uid()
    AND grades.status = 'published'
  );

CREATE POLICY "parents_children_grades" ON grades
  FOR SELECT
  TO authenticated
  USING (
    grades.student_id IN (
      SELECT student_id FROM parent_student_relationships
      WHERE parent_id = auth.uid()
    )
    AND grades.status = 'published'
  );
```

### Helpers RLS

```sql
-- Helper: Récupérer school_id de l'utilisateur
CREATE OR REPLACE FUNCTION get_current_user_school_id()
RETURNS uuid AS $$
  SELECT school_id FROM user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: Vérifier si super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: Vérifier permission
CREATE OR REPLACE FUNCTION has_permission(required_role text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = required_role
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

## 2. Audit Logging

### Triggers Automatiques

```sql
-- Trigger sur schools
CREATE OR REPLACE FUNCTION audit_school_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_record json;
BEGIN
  user_record := (SELECT row_to_json(user_profiles) FROM user_profiles WHERE user_id = auth.uid());

  INSERT INTO audit_logs (
    user_id,
    school_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    'school',
    COALESCE(NEW.id, OLD.id),
    row_to_json(OLD),
    row_to_json(NEW),
    current_setting('request.headers')::json->>'x-forwarded-for',
    current_setting('request.headers')::json->>'user-agent'
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER school_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON schools
  FOR EACH ROW EXECUTE FUNCTION audit_school_changes();

-- Similar triggers sur:
-- - users
-- - grades
-- - payments
-- - attendance_records
-- - report_cards
```

### Fonctions Manuelles

```sql
-- Log connexion
CREATE OR REPLACE FUNCTION log_login()
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    school_id,
    action,
    resource_type,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    get_current_user_school_id(),
    'login',
    'session',
    current_setting('request.headers')::json->>'x-forwarded-for',
    current_setting('request.headers')::json->>'user-agent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log export
CREATE OR REPLACE FUNCTION log_export(
  resource_type text,
  resource_ids text[],
  export_format text
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    school_id,
    action,
    resource_type,
    resource_id,
    new_data,
    ip_address
  ) VALUES (
    auth.uid(),
    get_current_user_school_id(),
    'export',
    resource_type,
    resource_ids[1],
    jsonb_build_object('format', export_format, 'count', array_length(resource_ids, 1)),
    current_setting('request.headers')::json->>'x-forwarded-for'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log validation
CREATE OR REPLACE FUNCTION log_validation(
  resource_type text,
  resource_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    school_id,
    action,
    resource_type,
    resource_id
  ) VALUES (
    auth.uid(),
    get_current_user_school_id(),
    'validate',
    resource_type,
    resource_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 3. Authentification

### JWT Supabase

```typescript
// Structure du JWT
{
  "aud": "authenticated",
  "role": "authenticated",
  "exp": 1705339200, // 15 min
  "sub": "user-uuid",
  "email": "user@example.com",
  "phone": "",
  "user_metadata": {
    "full_name": "Jean Dupont",
    "avatar_url": "..."
  },
  "app_metadata": {
    "role": "teacher",
    "school_id": "school-uuid",
    "provider": "email"
  }
}
```

### Refresh Token Rotation

```typescript
// Supabase Auth implémente automatiquement:
// 1. Access token courte durée (15 min)
// 2. Refresh token longue durée (30 days)
// 3. Rotation à chaque refresh
// 4. Révocation ancien refresh token

// Flow:
User Login → access_token + refresh_token
↓
15 min later → Refresh using refresh_token
↓
New access_token + new refresh_token
Old refresh_token revoked
```

### Expiration

```typescript
// Client-side check
async function checkTokenExpiry() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    // Redirect to login
    return;
  }

  const expiresAt = data.session.expires_at! * 1000;
  const now = Date.now();

  if (now > expiresAt) {
    // Token expired, refresh
    await supabase.auth.refreshSession();
  }
}
```

## 4. Géolocalisation

### Validation GPS

```sql
-- Fonction de validation
CREATE OR REPLACE FUNCTION validate_geolocation(
  user_id uuid,
  latitude float,
  longitude float,
  school_id uuid
)
RETURNS TABLE (valid boolean, distance float) AS $$
DECLARE
  school_lat float;
  school_long float;
  max_radius float := 200; -- 200m
  calculated_distance float;
BEGIN
  -- Récupérer coords école
  SELECT latitude, longitude INTO school_lat, school_long
  FROM schools
  WHERE id = school_id;

  -- Calculer distance (Haversine formula)
  calculated_distance := calculate_distance(
    latitude, longitude,
    school_lat, school_long
  );

  RETURN QUERY SELECT
    (calculated_distance <= max_radius)::boolean,
    calculated_distance;
END;
$$ LANGUAGE plpgsql;
```

### Contrainte Wi-Fi

```typescript
// Vérification connexion Wi-Fi école
async function validateSchoolWiFi(
  connectedSSID: string,
  schoolWiFiSSIDs: string[]
): Promise<boolean> {
  return schoolWiFiSSIDs.includes(connectedSSID);
}

// Utilisation
const isValidLocation = await validateGeolocation(lat, long) ||
                        await validateSchoolWiFi(wifiSSID);
```

## 5. QR Signatures

### HMAC Signature

```typescript
import crypto from 'crypto';

function generateQRSignature(
  qrData: any,
  secret: string
): string {
  const payload = JSON.stringify(qrData);
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function validateQRSignature(
  qrData: any,
  signature: string,
  secret: string
): boolean {
  const computed = generateQRSignature(qrData, secret);
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  );
}
```

### Rotation QR Secret

```typescript
// Rotation journalière
function rotateQRSecret(schoolId: string): QRSecret {
  const newSecret = crypto.randomBytes(32).toString('hex');
  const previousSecret = getCurrentSecret(schoolId);

  updateSecret(schoolId, {
    secret: newSecret,
    previousSecret,
    rotatedAt: new Date(),
  });

  return {
    secret: newSecret,
    previousSecret,
    rotatedAt: new Date(),
  };
}

// Validation avec tolérance transition
function validateWithTransition(
  qrData: any,
  signature: string,
  currentSecret: string,
  previousSecret: string
): boolean {
  return validateQRSignature(qrData, signature, currentSecret) ||
         validateQRSignature(qrData, signature, previousSecret);
}
```

### Anti-Fraude

```typescript
// Vérifications anti-fraude
const checks = {
  // 1. Signature valide
  signature: validateQRSignature(qrData, signature, secret),

  // 2. Timestamp non expiré
  timestamp: Date.now() - qrData.timestamp < 5 * 60 * 1000, // 5 min

  // 3. Session existe
  sessionExists: await checkSessionExists(qrData.sessionId),

  // 4. Élève inscrit dans la classe
  enrollment: await checkStudentEnrollment(
    qrData.studentId,
    qrData.classId
  ),

  // 5. Pas déjà marqué présent
  notAlreadyMarked: !(await checkAttendanceExists(
    qrData.studentId,
    qrData.sessionId
  )),
};

const isValid = Object.values(checks).every(Boolean);
```

## 6. Protection Données

### Chiffrement Transit

```nginx
# Headers de sécurité HTTP
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

### Chiffrement Repos

```sql
-- Supabase chiffre automatiquement:
-- - Database au repos (AES-256)
-- - Backups chiffrés
-- - Connections SSL/TLS obligatoires

-- Passwords hashés (bcrypt)
SELECT password_hash FROM auth.users
-- Never store plain text passwords
```

### Secrets Management

```bash
# .env.local (jamais commité)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SENTRY_DSN=https://xxx@sentry.io/xxx
GATEWAY_LICENSE_SECRET=xxx

# Production: utiliser Vault ou AWS Secrets Manager
```

## 7. Rate Limiting

### Supabase API

```typescript
// Edge Function: Rate limiter
Deno.serve(async (req) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';

  const { data: rateLimit, error } = await supabase
    .from('rate_limits')
    .select('requests_count, window_start')
    .eq('ip_address', ip)
    .single();

  const maxRequests = 100; // par heure
  const windowMs = 60 * 60 * 1000;

  if (rateLimit) {
    const elapsed = Date.now() - rateLimit.window_start;

    if (elapsed > windowMs) {
      // Reset window
      await supabase
        .from('rate_limits')
        .update({ requests_count: 1, window_start: Date.now() })
        .eq('ip_address', ip);
    } else {
      if (rateLimit.requests_count >= maxRequests) {
        return new Response('Too many requests', { status: 429 });
      }

      await supabase
        .from('rate_limits')
        .update({ requests_count: rateLimit.requests_count + 1 })
        .eq('ip_address', ip);
    }
  } else {
    // First request
    await supabase
      .from('rate_limits')
      .insert({
        ip_address: ip,
        requests_count: 1,
        window_start: Date.now(),
      });
  }

  // Process request...
});
```

### Gateway API

```typescript
// Rate limiter avec token bucket
import { Ratelimit } from "@unkey/ratelimit";

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.tokenBucket({
    refillRate: 10, // 10 tokens par seconde
    interval: "1s",
    capacity: 100, // Max 100 tokens
  }),
  analytics: true,
});

app.post('/api/*', async (c) => {
  const userId = c.get('userId');
  const { success, limit, reset, remaining } = await ratelimit.limit(userId);

  if (!success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  // Process request...
});
```

## 8. Input Validation

### Zod Schemas

```typescript
import { z } from 'zod';

// Validation grade
const gradeSchema = z.object({
  student_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  score: z.number().min(0).max(20),
  coefficient: z.number().int().min(1).max(10),
  trimester: z.number().int().min(1).max(3),
});

// Validation payment
const paymentSchema = z.object({
  student_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'check', 'transfer', 'mobile_money']),
  reference: z.string().min(3).max(100).optional(),
});

// Utilisation
try {
  const validated = gradeSchema.parse(rawInput);
  // Save to database...
} catch (error) {
  return { error: 'Invalid input', details: error.errors };
}
```

### SQL Injection Prevention

```typescript
// ❌ MAUVAIS - Injection possible
const query = `SELECT * FROM students WHERE name = '${userName}'`;

// ✅ BON - Parameterized query
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('name', userName);

// ✅ BON - Supabase RPC
const { data } = await supabase
  .rpc('get_student_by_name', { user_name: userName });
```

## 9. CORS Configuration

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'https://novaconnect.app',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
        ],
      },
    ];
  },
};
```

## 10. Monitoring Sécurité

### Sentry Security Headers

```typescript
// Sentry init
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  beforeSend(event, hint) {
    // Filtrer données sensibles
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }

    // Anonymiser user data
    if (event.user) {
      event.user.email = undefined; // Ne pas envoyer email
      event.user.ip_address = undefined; // Ne pas envoyer IP
    }

    return event;
  },

  // Sanitize stack traces
  integrations: [
    new Sentry.Integrations.RequestData(),
    new Sentry.Integrations.UserAgent(),
  ],
});
```

### Alertes Sécurité

```yaml
# Alertes configurées dans Sentry
alerts:
  - name: "Authentication Failures Spike"
    condition: "error:message:'Invalid credentials' > 100 in 5m"
    action: "Email + Slack security team"

  - name: "RLS Violation"
    condition: "error:message:'permission denied for table' > 10 in 1m"
    action: "PagerDuty + Immediate investigation"

  - name: "Suspicious Activity"
    condition: "user:login_count > 50 in 1h from same IP"
    action: "Auto-block IP + Email security team"
```

## Checklist Sécurité

### ✔ Avant Production

- [ ] Toutes tables sensibles ont RLS activé
- [ ] Policies testées avec chaque rôle
- [ ] Audit logging activé sur tables critiques
- [ ] HTTPS forcé en production
- [ ] Headers sécurité configurés (CSP, HSTS, X-Frame-Options)
- [ ] Secrets jamais commités (.env dans .gitignore)
- [ ] Rate limiting activé sur API endpoints
- [ ] Input validation (Zod) sur tous les inputs
- [ ] Passwords hashés (bcrypt, cost >= 10)
- [ ] JWT expiration configurée (15 min access, 30 days refresh)
- [ ] CORS restreint aux domaines autorisés
- [ ] Monitoring actif (Sentry)
- [ ] Backups automatiques (Supabase daily)
- [ ] Penetration testing effectué
- [ ] OWASP Top 10 vérifié

## Conclusion

La sécurité de NovaConnect repose sur :
- **RLS**: Isolation multi-tenant au niveau base de données
- **Audit**: Traçabilité complète de toutes les actions
- **Auth**: JWT + refresh token rotation
- **Validation**: Input validation + SQL injection prevention
- **Monitoring**: Alertes temps réel sur anomalies
- **Defense in depth**: Couches multiples de sécurité
