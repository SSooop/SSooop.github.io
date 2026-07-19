/**
 * Main Sitemap Endpoint
 *
 * Generates and serves the main sitemap for core pages
 */

import { absoluteUrl } from '../config/site';

function generateSitemapXML(
  entries: Array<{
    url: string;
    lastModified?: Date;
    changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
  }>
): string {
  const urls = entries
    .map((entry) => {
      let urlXML = `  <url>\n`;
      urlXML += `    <loc>${entry.url}</loc>\n`;
      if (entry.lastModified) {
        urlXML += `    <lastmod>${entry.lastModified.toISOString()}</lastmod>\n`;
      }
      if (entry.changeFrequency) {
        urlXML += `    <changefreq>${entry.changeFrequency}</changefreq>\n`;
      }
      if (entry.priority !== undefined) {
        urlXML += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
      }
      urlXML += `  </url>`;
      return urlXML;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function GET() {
  const entries = [
    {
      url: absoluteUrl('/en/'),
      changeFrequency: 'weekly' as const,
      priority: 1.0,
    },
    {
      url: absoluteUrl('/zh/'),
      changeFrequency: 'weekly' as const,
      priority: 1.0,
    },
    {
      url: absoluteUrl('/en/about'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/about'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/projects'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/projects'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/economics-after-ai'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/economics-after-ai'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/gaia-project'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/gaia-project'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/social'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/social'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/blog'),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: absoluteUrl('/zh/blog'),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
  ];

  const sitemap = generateSitemapXML(entries);

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
