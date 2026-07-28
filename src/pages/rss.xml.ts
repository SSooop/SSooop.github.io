import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE, absoluteUrl } from '../config/site';

type BlogPost = CollectionEntry<'blog'>;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const posts = (await getCollection('blog')).sort(
    (a: BlogPost, b: BlogPost) => b.data.date.valueOf() - a.data.date.valueOf()
  );
  const latestDate = posts[0]?.data.date ?? new Date();
  const items = posts
    .map((post: BlogPost) => {
      const url = absoluteUrl(post.data.canonical.url);

      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${post.data.date.toUTCString()}</pubDate>
      <description>${escapeXml(post.data.description)}</description>
      <language>${post.data.lang === 'zh' ? 'zh-CN' : 'en-US'}</language>
    </item>`;
    })
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>IntelliPharma Insights / 智药深瞳</title>
    <link>${escapeXml(SITE.url)}</link>
    <description>Technology-driven essays on AI, biopharma, and philosophy of science.</description>
    <language>en-US</language>
    <lastBuildDate>${latestDate.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
