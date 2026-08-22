/**
 * Blog Sitemap Endpoint
 *
 * Generates and serves the sitemap for all blog posts
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import { absoluteUrl } from '../config/site';

type BlogPost = CollectionEntry<'blog'>;

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
  const posts = await getCollection('blog');

  const entries = posts.map((post: BlogPost) => ({
    url: absoluteUrl(post.data.canonical.url),
    lastModified: post.data.updated ?? post.data.date,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const sitemap = generateSitemapXML(entries);

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
