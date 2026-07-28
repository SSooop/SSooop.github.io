import { getCollection, type CollectionEntry } from 'astro:content';
import { absoluteUrl } from '../config/site';

type BlogPost = CollectionEntry<'blog'>;

export async function GET() {
  const posts = (await getCollection('blog')).sort(
    (a: BlogPost, b: BlogPost) => b.data.date.valueOf() - a.data.date.valueOf()
  );
  const articleIndex = posts
    .map(
      (post: BlogPost) =>
        `- [${post.data.title}](${absoluteUrl(post.data.canonical.url)}): ${post.data.description}`
    )
    .join('\n');

  const text = `# IntelliPharma Insights / 智药深瞳

> A bilingual archive of technology-driven essays examining AI and biopharma through philosophy of science, bioengineering, software engineering, economics, and management.

The canonical editions are hosted at ${absoluteUrl('/en/blog')} and ${absoluteUrl('/zh/blog')}.
Each article exposes a canonical URL, reciprocal language alternates, BlogPosting structured data, citation metadata, and registered full-text distribution channels.

Editorial boundary: the archive analyzes industry and long-term value logic rather than individual companies or securities. It does not provide specific technical solutions or investment advice.

## Feeds and discovery

- [RSS feed](${absoluteUrl('/rss.xml')})
- [Sitemap index](${absoluteUrl('/sitemap-index.xml')})
- [English archive](${absoluteUrl('/en/blog')})
- [Chinese archive](${absoluteUrl('/zh/blog')})

## Articles

${articleIndex}
`;

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
