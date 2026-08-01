/**
 * Sitemap Generation Script
 *
 * Generates multiple sitemaps for the website:
 * - sitemap-main.xml: Core pages (home, about, projects, economics, gaia, social)
 * - sitemap-blog.xml: All blog posts
 * - sitemap-ai.xml: AI-optimized priority content
 * - sitemap-index.xml: Main sitemap index
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import { absoluteUrl } from '../config/site';

type BlogPost = CollectionEntry<'blog'>;

interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * Generate XML sitemap from entries
 */
function generateSitemapXML(entries: SitemapEntry[]): string {
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

/**
 * Generate sitemap index XML
 */
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

/**
 * Generate main sitemap (core pages)
 */
export async function generateMainSitemap(): Promise<string> {
  const entries: SitemapEntry[] = [
    {
      url: absoluteUrl('/en/'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: absoluteUrl('/zh/'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: absoluteUrl('/en/about'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/about'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/projects'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/projects'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/economics-after-ai'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/economics-after-ai'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/economics-after-ai/a-map-of-economics'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/zh/economics-after-ai/a-map-of-economics'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/en/gaia-project'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/gaia-project'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/social'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/zh/social'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/en/blog'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/zh/blog'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  return generateSitemapXML(entries);
}

/**
 * Generate blog sitemap (all blog posts)
 */
export async function generateBlogSitemap(): Promise<string> {
  const posts = await getCollection('blog');

  const entries: SitemapEntry[] = posts.map((post: BlogPost) => ({
    url: absoluteUrl(`/${post.data.lang}/blog/${post.id}`),
    lastModified: post.data.date,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return generateSitemapXML(entries);
}

/**
 * Generate AI-optimized sitemap (high priority content for AI crawlers)
 */
export async function generateAISitemap(): Promise<string> {
  const posts = await getCollection('blog');

  // Add prioritization logic here when high-signal content markers exist.
  const aiPrioritizedPosts = posts;

  const entries: SitemapEntry[] = [
    // Home pages (highest priority for AI)
    {
      url: absoluteUrl('/en/'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: absoluteUrl('/zh/'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // All blog posts (comprehensive content)
    ...aiPrioritizedPosts.map((post: BlogPost) => ({
      url: absoluteUrl(`/${post.data.lang}/blog/${post.id}`),
      lastModified: post.data.date,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
  ];

  return generateSitemapXML(entries);
}

/**
 * Generate sitemap index
 */
export async function generateSitemapIndex(): Promise<string> {
  const lastModified = new Date();

  return generateSitemapIndexXML([
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
}
