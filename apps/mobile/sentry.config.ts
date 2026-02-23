import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,

  beforeSend(event, hint) {
    if (event.user) {
      event.user.email = undefined;
      event.user.ip_address = undefined;
    }
    return event;
  },
});
