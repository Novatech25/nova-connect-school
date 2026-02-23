import { Hono } from 'hono';
import { getSchoolId } from '../middleware/rls.js';

const app = new Hono();

// Trigger manual sync
app.post('/trigger', async (c) => {
  const syncEngine = c.get('syncEngine');

  try {
    await syncEngine.syncNow();
    return c.json({ success: true, message: 'Sync completed' });
  } catch (error: any) {
    return c.json({ error: 'Sync failed', message: error.message }, 500);
  }
});

// Get sync status
app.get('/status', async (c) => {
  const syncEngine = c.get('syncEngine');

  const status = syncEngine.getStatus();
  return c.json(status);
});

// Get unsynced events count
app.get('/pending', async (c) => {
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);

  const events = eventLog.getUnsyncedEvents(1000);
  return c.json({
    count: events.length,
    events: events.slice(0, 100) // Return first 100 for preview
  });
});

// Retry failed sync events
app.post('/retry', async (c) => {
  const eventLog = c.get('eventLog');

  const count = eventLog.retryFailedEvents();
  return c.json({
    success: true,
    message: `${count} events queued for retry`,
    count
  });
});

// Cleanup old synced events
app.post('/cleanup', async (c) => {
  const eventLog = c.get('eventLog');
  const daysToKeep = parseInt(c.req.query('days') || '30');

  const count = eventLog.cleanup(daysToKeep);
  return c.json({
    success: true,
    message: `Cleaned up ${count} old events`,
    count
  });
});

export default app;
