const DEFAULT_SITE_URL = 'https://ssooop.github.io';
const DEFAULT_BASE_PATH = '/';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') {
    return '/';
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

export const SITE = {
  name: '智药深瞳',
  nameEn: 'IntelliPharma Insights',
  alternateNames: ['IntelliPharma Insights', 'IntelliPharma Insight', 'ssooop.github.io'],
  authorName: 'Alex Su',
  authorNameZh: '苏晨鹏',
  repositoryName: 'SSooop.github.io',
  url: trimTrailingSlash(import.meta.env.SITE_URL || DEFAULT_SITE_URL),
  base: normalizeBasePath(import.meta.env.PUBLIC_BASE || DEFAULT_BASE_PATH),
  defaultLocale: 'en',
  supportedLocales: ['en', 'zh'],
} as const;

export function withBasePath(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (SITE.base === '/') {
    return normalizedPath;
  }

  if (normalizedPath === '/') {
    return `${SITE.base}/`;
  }

  return `${SITE.base}${normalizedPath}`;
}

export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${SITE.url}${withBasePath(path)}`;
}
