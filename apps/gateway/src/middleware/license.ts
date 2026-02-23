import { Context, Next } from 'hono';

// License validation middleware
// Checks if the gateway license is active and valid before processing requests
export const licenseMiddleware = async (c: Context, next: Next) => {
  const licenseService = c.get('licenseService');

  if (!licenseService) {
    return c.json({ error: 'License service not initialized' }, 500);
  }

  try {
    // Check if license is active
    const isLicenseActive = licenseService.isLicenseActive();

    if (!isLicenseActive) {
      return c.json({
        error: 'License inactive or invalid',
        message: 'Please contact support to validate your license'
      }, 403);
    }

    await next();
  } catch (error: any) {
    return c.json({
      error: 'License validation failed',
      message: error.message
    }, 403);
  }
};

// Public routes that don't require license validation
export const publicRoutes = [
  '/health',
  '/admin'
];
