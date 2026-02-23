export const logger = {
  info: (message: string, meta?: object) => {
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ level: 'info', message, meta }));
    } else {
      console.log(message, meta);
    }
  },

  warn: (message: string, meta?: object) => {
    if (process.env.NODE_ENV === 'production') {
      console.warn(JSON.stringify({ level: 'warn', message, meta }));
    } else {
      console.warn(message, meta);
    }
  },

  error: (message: string, error?: Error, meta?: object) => {
    if (process.env.NODE_ENV === 'production') {
      console.error(JSON.stringify({
        level: 'error',
        message,
        error: error?.message,
        stack: error?.stack,
        meta,
      }));

      // Send to Sentry in production
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          contexts: { meta: meta as any },
        });
      }
    } else {
      console.error(message, error, meta);
    }
  },
};
