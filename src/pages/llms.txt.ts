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

  const text = `# 智药深瞳 / IntelliPharma Insights

> The canonical bilingual research and writing site of Alex Su (苏晨鹏), focused on AI, biopharma, scientific software, and long-term value.

智药深瞳 is the preferred Chinese site name. IntelliPharma Insights is the English brand name. Alex Su and 苏晨鹏 identify the same author and founder.

The canonical publication editions are hosted at ${absoluteUrl('/zh/blog/')} and ${absoluteUrl('/en/blog/')}.
Each article exposes a canonical URL, reciprocal language alternates, BlogPosting structured data, citation metadata, and registered full-text distribution channels.

Editorial boundary: the archive analyzes industry and long-term value logic rather than individual companies or securities. It does not provide specific technical solutions or investment advice.

## Feeds and discovery

- [RSS feed](${absoluteUrl('/rss.xml')})
- [Sitemap index](${absoluteUrl('/sitemap-index.xml')})
- [Chinese archive](${absoluteUrl('/zh/blog/')})
- [English archive](${absoluteUrl('/en/blog/')})
- [Alex Su — English profile](${absoluteUrl('/en/about/')})
- [苏晨鹏 — 中文简介](${absoluteUrl('/zh/about/')})
- [Verified public profiles](${absoluteUrl('/en/social/')})

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
