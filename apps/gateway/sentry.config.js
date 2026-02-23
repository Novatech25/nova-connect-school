const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

const SENTRY_DSN = process.env.SENTRY_DSN || "";
const ENVIRONMENT = process.env.NODE_ENV || "development";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,

  // Performance monitoring
  tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,

  // Profiling
  profilesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,

  // Integrations
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    nodeProfilingIntegration(),
  ],

  // Attach request data to events
  requestDataProvider: (request) => {
    return {
      headers: request.headers,
      method: request.method,
      url: request.url,
      query: request.query,
      body: request.body,
    };
  },

  // Filter errors
  beforeSend(event, hint) {
    // Don't send errors from development
    if (process.env.NODE_ENV === "development") {
      return null;
    }

    // Filter out specific error types
    if (event.exception) {
      const error = hint.originalException;
      if (error) {
        // Don't report expected operational errors
        if (
          error.message?.includes("Validation failed") ||
          error.message?.includes("Not found") ||
          error.message?.includes("Unauthorized")
        ) {
          return null;
        }
      }
    }

    return event;
  },

  // Attach user information
  beforeSend(event) {
    if (event.user) {
      event.tags = {
        ...event.tags,
        user_id: event.user.id,
        user_role: event.user.role,
      };
    }

    // Add service info
    event.tags = {
      ...event.tags,
      service: "novaconnect-gateway",
      service_version: process.env.APP_VERSION || "unknown",
    };

    return event;
  },

  // Context configuration
  initialScope: {
    tags: {
      service: "novaconnect-gateway",
      layer: "api-gateway",
    },
  },

  // Enable debug in development
  debug: process.env.NODE_ENV === "development",

  // Attach stack traces
  attachStacktrace: true,

  // Performance monitoring
  maxBreadcrumbs: 100,

  // Transaction sampling
  tracePropagationTargets: [
    "localhost",
    "api.novaconnect.com",
    /^\//,
  ],
});

// Performance monitoring middleware
function setupPerformanceMonitoring(app) {
  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());

  // Tracing handler creates a transaction for every request
  app.use(Sentry.Handlers.tracingHandler());

  // The error handler must be before any other error middleware
  app.use(Sentry.Handlers.errorHandler());
}

module.exports = { Sentry, setupPerformanceMonitoring };
