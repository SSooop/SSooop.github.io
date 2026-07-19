/**
 * Environment variable type definitions
 * Astro will automatically inline these variables in client-side code
 */

interface ImportMetaEnv {
  readonly SITE_URL?: string;
  readonly PUBLIC_BASE?: string;
  readonly GOOGLE_ANALYTICS_ID?: string;
  readonly PLAUSIBLE_ANALYTICS_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
