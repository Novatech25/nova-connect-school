import * as Sentry from '@sentry/bun';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  beforeSend(event, hint) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
    }

    if (event.user) {
      event.user.email = undefined;
      event.user.ip_address = undefined;
    }

    return event;
  },
});
