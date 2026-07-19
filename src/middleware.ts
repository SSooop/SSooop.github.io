/**
 * Middleware for security headers
 * Implements Content Security Policy and other security best practices
 */

import { defineMiddleware } from 'astro:middleware';

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https:",
  "frame-src 'self' https://www.youtube.com https://youtube.com",
  "media-src 'self' https: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ');

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Content Security Policy
  response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);

  // Other security headers
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Platform-specific headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  return response;
});
