/**
 * Sitemap Index Endpoint
 *
 * Generates and serves the main sitemap index
 */

import { absoluteUrl } from '../config/site';

function generateSitemapIndexXML(sitemaps: Array<{ loc: string; lastModified?: Date }>): string {
  const sitemapEntries = sitemaps
    .map((sitemap) => {
      let xml = `  <sitemap>\n`;
      xml += `    <loc>${sitemap.loc}</loc>\n`;
      if (sitemap.lastModified) {
        xml += `    <lastmod>${sitemap.lastModified.toISOString()}</lastmod>\n`;
      }
      xml += `  </sitemap>`;
      return xml;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
}

export async function GET() {
  const lastModified = new Date();

  const sitemap = generateSitemapIndexXML([
    {
      loc: absoluteUrl('/sitemap-main.xml'),
      lastModified,
    },
    {
      loc: absoluteUrl('/sitemap-blog.xml'),
      lastModified,
    },
    {
      loc: absoluteUrl('/sitemap-ai.xml'),
      lastModified,
    },
  ]);

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
