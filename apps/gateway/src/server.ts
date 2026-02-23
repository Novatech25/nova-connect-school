import { Hono } from 'hono';
import { serve } from 'bun';
import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Database } from './db/bun-sqlite.js';
import { runMigrations } from './db/migrate.js';

// Import services
import { LicenseService } from './services/license.js';
import { MdnsService } from './services/mdns.js';
import { EventLogService } from './services/event-log.js';
import { SyncEngine } from './services/sync-engine.js';
import { loadLicenseConfig, loadLicenseFromFile } from './config/license.js';

// Import routes
import authRoutes from './routes/auth.js';
import attendanceRoutes from './routes/attendance.js';
import gradesRoutes from './routes/grades.js';
import lessonLogsRoutes from './routes/lesson-logs.js';
import paymentsRoutes from './routes/payments.js';
import scheduleRoutes from './routes/schedule.js';
import syncRoutes from './routes/sync.js';
import adminRoutes from './routes/admin.js';
import studentsRoutes from './routes/students.js';
import parentsRoutes from './routes/parents.js';
import studentParentRelationsRoutes from './routes/student-parent-relations.js';
import enrollmentsRoutes from './routes/enrollments.js';
import paymentExemptionsRoutes from './routes/payment-exemptions.js';
import reportCardsRoutes from './routes/report-cards.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';
import { rlsMiddleware } from './middleware/rls.js';
import { licenseMiddleware } from './middleware/license.js';
import { corsAndSecurityMiddleware } from './middleware/security.js';
import { defaultRateLimit } from './middleware/rate-limit.js';

const app = new Hono();
const PORT = process.env.PORT || 3001;
const DATA_PATH = process.env.DATABASE_PATH || './data';

// CORS and Security middleware
app.use('*', corsAndSecurityMiddleware);
// Global Rate Limiting (100 req/min)
app.use('*', defaultRateLimit);

// Global Error Handler
app.onError((err, c) => {
  console.error('❌ Server Error:', err);
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, 500);
});

// Not Found Handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    message: `Route not found: ${c.req.method} ${c.req.path}`
  }, 404);
});

// Ensure data directory exists
if (!existsSync(DATA_PATH)) {
  mkdirSync(DATA_PATH, { recursive: true });
}

console.log('Starting NovaConnect Gateway LAN...');

// Get school ID from environment, license file, or SQLite table
async function getSchoolId(): Promise<string> {
  // 1. Check environment variable first
  const schoolId = process.env.SCHOOL_ID;
  if (schoolId) {
    return schoolId;
  }

  // 2. Try to load from license file using config
  const config = loadLicenseConfig();
  if (config.licenseFile) {
    const license = loadLicenseFromFile(config.licenseFile);
    if (license) {
      return license.schoolId;
    }
  }

  // 3. Fallback: try to find license in SQLite databases
  // Look for any .db files in data directory and check for gateway_license table
  const dataDir = DATA_PATH;
  if (existsSync(dataDir)) {
    const files = require('fs').readdirSync(dataDir);
    const dbFiles = files.filter((f: string) => f.endsWith('.db'));

    for (const dbFile of dbFiles) {
      try {
        const dbPath = join(dataDir, dbFile);
        const tempDb = new Database(dbPath, { readonly: true });

        // Check if gateway_license table exists and has a license
        const license = tempDb.prepare('SELECT school_id FROM gateway_license WHERE id = 1').get() as any;

        tempDb.close();

        if (license && license.school_id) {
          return license.school_id;
        }
      } catch (error) {
        // Continue to next file
        continue;
      }
    }
  }

  throw new Error('School ID not found. Please set SCHOOL_ID environment variable, activate a license with: bun run activate --license=XXX --school=YYY');
}

// Initialize Gateway
async function initializeGateway() {
  const schoolId = await getSchoolId();

  // Initialize database
  const dbPath = join(DATA_PATH, `${schoolId}.db`);
  const db = new Database(dbPath);

  // Configure database
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  console.log('Database migrations applied');

  // Initialize services
  const licenseService = new LicenseService(db);
  const eventLog = new EventLogService(db);
  const syncEngine = new SyncEngine(db, eventLog);

  // Validate license
  try {
    await licenseService.validateLicense();
    const license = licenseService.getLicenseInfo();
    console.log(`License validated: ${license.school_id}`);
  } catch (error: any) {
    console.error('License validation failed:', error.message);
    console.error('Please run: bun run activate --license=XXX --school=YYY');
    throw error;
  }

  // Start mDNS service
  const mdnsService = new MdnsService(PORT as number, schoolId);
  mdnsService.start();

  // Start sync engine
  syncEngine.start(30000); // Sync every 30 seconds

  // Store services in app context
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('licenseService', licenseService);
    c.set('eventLog', eventLog);
    c.set('syncEngine', syncEngine);
    c.set('schoolId', schoolId);
    await next();
    return c.res;
  });

  return { licenseService, mdnsService, syncEngine, schoolId };
}

// Start server
initializeGateway().then(({ licenseService, mdnsService, syncEngine, schoolId }) => {
  // Public routes
  app.get('/health', (c) => {
    const db = c.get('db');
    const schools = db.prepare('SELECT COUNT(*) as count FROM schools').get() as any;
    return c.json({
      status: 'ok',
      schoolId: schoolId,
      timestamp: new Date().toISOString(),
      schoolsCount: schools.count
    });
  });

  // Admin web interface
  app.get('/admin', (c) => {
    const htmlPath = join(import.meta.dir, './admin-ui/index.html');
    return c.html(require('fs').readFileSync(htmlPath, 'utf-8'));
  });

  // Public auth routes (no authentication required)
  app.route('/api/auth', authRoutes);

  // API routes with authentication and RLS
  // Admin routes are exempt from auth/RLS/license for local-only access
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/admin')) {
      await next();
      return c.res;
    }

    await authMiddleware(c, async () => {
      await rlsMiddleware(c, async () => {
        await licenseMiddleware(c, next);
      });
    });
    return c.res;
  });

  // Route registration
  app.route('/api/attendance', attendanceRoutes);
  app.route('/api/grades', gradesRoutes);
  app.route('/api/lesson-logs', lessonLogsRoutes);
  app.route('/api/payments', paymentsRoutes);
  app.route('/api/payment-exemptions', paymentExemptionsRoutes);
  app.route('/api/students', studentsRoutes);
  app.route('/api/parents', parentsRoutes);
  app.route('/api/student-parent-relations', studentParentRelationsRoutes);
  app.route('/api/enrollments', enrollmentsRoutes);
  app.route('/api', reportCardsRoutes);
  app.route('/api/schedule', scheduleRoutes);
  app.route('/api/sync', syncRoutes);
  app.route('/api/admin', adminRoutes);

  // Start HTTP server
  serve({
    port: PORT,
    fetch: app.fetch,
  });

  console.log(`\nNovaConnect Gateway started successfully!`);
  console.log(`\nAdmin interface: http://localhost:${PORT}/admin`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
  console.log(`mDNS service: _novaconnect._tcp.local`);
  console.log(`School ID: ${schoolId}`);
  console.log(`\nReady to serve requests!\n`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down gracefully...');
    mdnsService.stop();
    syncEngine.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nShutting down gracefully...');
    mdnsService.stop();
    syncEngine.stop();
    process.exit(0);
  });

}).catch((error) => {
  console.error('Failed to start Gateway:', error);
  process.exit(1);
});
