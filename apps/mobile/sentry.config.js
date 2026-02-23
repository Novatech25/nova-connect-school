import * as Sentry from "@sentry/react-native";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "";
const ENVIRONMENT = process.env.APP_ENV || "development";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  tracesSampleRate: ENVIRONMENT === "production" ? 0.2 : 1.0,

  // Set sampling rate for profiling
  profilesSampleRate: ENVIRONMENT === "production" ? 0.2 : 1.0,

  // Enable automatic error tracking
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,

  // Performance monitoring
  integrations: [
    new Sentry.ReactNativeTracing({
      tracingOrigins: ["localhost", "api.novaconnect.com", /^\//],
    }),
    new Sentry.ReactNativeProfilingIntegration(),
  ],

  // Filter errors
  beforeSend(event, hint) {
    // Don't send errors from development
    if (__DEV__) {
      return null;
    }

    // Filter out specific error types
    if (event.exception) {
      const error = hint.originalException;
      if (
        error instanceof Error &&
        (error.message.includes("Network request failed") ||
          error.message.includes("Timeout"))
      ) {
        // Don't report network errors - they're handled elsewhere
        return null;
      }
    }

    return event;
  },

  // Attach user information
  beforeSend(event) {
    // Add user context if available
    const userId = event.user?.id;
    if (userId) {
      event.tags = {
        ...event.tags,
        user_id: userId,
      };
    }

    // Add app version
    event.tags = {
      ...event.tags,
      app_version: Constants.expoConfig?.version || "unknown",
    };

    return event;
  },

  // Context configuration
  initialScope: {
    tags: {
      platform: "mobile",
      app: "novaconnect-mobile",
    },
  },

  // Enable debug in development
  debug: __DEV__,

  // Attach stack traces
  attachStacktrace: true,

  // Enable native crash reporting
  enableNative: true,

  // Performance monitoring
  enableOutOfMemoryTracking: true,

  // ANR (Application Not Responding) detection
  enableAnrDetection: true,
  anrDetectionInterval: 5000,

  // Enable automatic performance monitoring for React Navigation
  enableAutoPerformanceTracing: true,

  // Max breadcrumb count
  maxBreadcrumbs: 100,
});

// Export Sentry for use in the app
export default Sentry;
