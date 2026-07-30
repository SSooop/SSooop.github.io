/**
 * Structured Data Generators
 *
 * Helper functions to generate schema.org JSON-LD data
 * for various content types on the website
 */

import type {
  WebSiteSchema,
  PersonSchema,
  BlogPostingSchema,
  BreadcrumbListSchema,
  OrganizationSchema,
  WebPageSchema,
  EntityReference,
} from '../types/schema';
import { SITE, absoluteUrl } from '../config/site';

export const ENTITY_IDS = {
  website: absoluteUrl('/#website'),
  person: absoluteUrl('/#alex-su'),
  publisher: absoluteUrl('/#intellipharma-insights'),
} as const;

function entityReference(
  type: 'WebSite' | 'Person' | 'Organization',
  id: string,
  name?: string,
  url?: string
): EntityReference {
  return {
    '@type': type,
    '@id': id,
    ...(name ? { name } : {}),
    ...(url ? { url } : {}),
  };
}

/**
 * Generate WebSite schema for the main site
 */
export function generateWebSiteSchema(): WebSiteSchema {
  return {
    '@id': ENTITY_IDS.website,
    '@type': 'WebSite',
    name: SITE.name,
    alternateName: [...SITE.alternateNames],
    url: absoluteUrl('/'),
    description:
      '智药深瞳（IntelliPharma Insights）是 Alex Su（苏晨鹏）的双语研究与写作网站，关注 AI、生物医药、科学软件与长期价值。',
    author: { '@id': ENTITY_IDS.person },
    creator: { '@id': ENTITY_IDS.person },
    publisher: { '@id': ENTITY_IDS.publisher },
    inLanguage: ['zh-CN', 'en'],
  };
}

/**
 * Generate Person schema for Alex Su
 */
export function generatePersonSchema(lang: 'en' | 'zh' = 'en'): PersonSchema {
  const isEn = lang === 'en';

  return {
    '@id': ENTITY_IDS.person,
    '@type': 'Person',
    name: SITE.authorName,
    alternateName: SITE.authorNameZh,
    url: absoluteUrl(`/${lang}/about/`),
    jobTitle: isEn ? 'AI-native Scientist and Engineer' : 'AI 原生科学家与工程师',
    description: isEn
      ? 'Alex Su (苏晨鹏) builds AI-native research systems and writes about AI, biopharma, scientific software, and long-term value through IntelliPharma Insights.'
      : '苏晨鹏（Alex Su）构建 AI 原生科研系统，并通过智药深瞳写作 AI、生物医药、科学软件与长期价值。',
    sameAs: [
      'https://github.com/SSooop',
      'https://x.com/ChenpengSu',
      'https://www.linkedin.com/in/alexsuhelixon/',
      'https://scholar.google.com/citations?user=msA1c98AAAAJ&hl=en',
    ],
    knowsAbout: isEn
      ? [
          'Artificial Intelligence',
          'AI Drug Discovery',
          'Biopharmaceutical Industry',
          'Scientific Software',
          'Bioengineering',
          'Philosophy of Science',
          'Software Engineering',
          'Economics',
        ]
      : [
          '人工智能',
          'AI 药物发现',
          '生物医药产业',
          '科学软件',
          '生物工程',
          '科学哲学',
          '软件工程',
          '经济学',
        ],
    inLanguage: isEn ? 'en' : 'zh-CN',
  };
}

/**
 * Generate Organization schema for the site publisher
 */
export function generateOrganizationSchema(lang: 'en' | 'zh' = 'en'): OrganizationSchema {
  const isEn = lang === 'en';

  return {
    '@id': ENTITY_IDS.publisher,
    '@type': 'Organization',
    name: SITE.nameEn,
    alternateName: [SITE.name, 'IntelliPharma Insight'],
    url: absoluteUrl(`/${lang}/blog/`),
    description: isEn
      ? 'A bilingual publication by Alex Su about AI, biopharma, scientific software, and long-term value.'
      : '苏晨鹏创办的双语研究与写作品牌，关注 AI、生物医药、科学软件与长期价值。',
    founder: entityReference(
      'Person',
      ENTITY_IDS.person,
      SITE.authorName,
      absoluteUrl(`/${lang}/about/`)
    ),
    inLanguage: isEn ? 'en' : 'zh-CN',
  };
}

export function generateSiteIdentityGraph(): Record<string, unknown> {
  return {
    '@graph': [
      generateWebSiteSchema(),
      generateOrganizationSchema('zh'),
      generatePersonSchema('zh'),
    ],
  };
}

export function generateWebPageSchema(page: {
  title: string;
  description: string;
  url: string;
  lang: 'en' | 'zh';
}): WebPageSchema {
  const fullUrl = absoluteUrl(page.url);

  return {
    '@id': `${fullUrl}#webpage`,
    '@type': 'WebPage',
    name: page.title,
    url: fullUrl,
    description: page.description,
    inLanguage: page.lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': ENTITY_IDS.website },
    author: entityReference(
      'Person',
      ENTITY_IDS.person,
      SITE.authorName,
      absoluteUrl(`/${page.lang}/about/`)
    ),
    publisher: entityReference(
      'Organization',
      ENTITY_IDS.publisher,
      SITE.nameEn,
      absoluteUrl(`/${page.lang}/blog/`)
    ),
  };
}

export function generateProfilePageSchema(
  lang: 'en' | 'zh',
  title: string,
  description: string
): Record<string, unknown> {
  const url = absoluteUrl(`/${lang}/about/`);

  return {
    '@id': `${url}#profile`,
    '@type': 'ProfilePage',
    name: title,
    url,
    description,
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': ENTITY_IDS.website },
    mainEntity: generatePersonSchema(lang),
  };
}

export function generateBlogCollectionSchema(
  lang: 'en' | 'zh',
  posts: Array<{ title: string; url: string }>
): Record<string, unknown> {
  const isEn = lang === 'en';
  const url = absoluteUrl(`/${lang}/blog/`);

  return {
    '@id': `${url}#collection`,
    '@type': 'CollectionPage',
    name: isEn ? SITE.nameEn : SITE.name,
    alternateName: isEn ? SITE.name : SITE.nameEn,
    url,
    description: isEn
      ? 'The English article archive of IntelliPharma Insights by Alex Su.'
      : '苏晨鹏创办的智药深瞳中文文章档案。',
    inLanguage: isEn ? 'en' : 'zh-CN',
    isPartOf: { '@id': ENTITY_IDS.website },
    about: [
      entityReference(
        'Organization',
        ENTITY_IDS.publisher,
        SITE.nameEn,
        absoluteUrl(`/${lang}/blog/`)
      ),
      entityReference('Person', ENTITY_IDS.person, SITE.authorName, absoluteUrl(`/${lang}/about/`)),
    ],
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: post.title,
        url: absoluteUrl(post.url),
      })),
    },
  };
}

/**
 * Generate BlogPosting schema for a blog post
 */
export function generateBlogPostingSchema(post: {
  title: string;
  description: string;
  slug: string;
  url?: string;
  date: Date;
  modifiedDate?: Date;
  lang: 'en' | 'zh';
  image?: string;
  keywords?: string[];
  wordCount?: number;
  sameAs?: string[];
}): BlogPostingSchema {
  const isEn = post.lang === 'en';
  const fullUrl = absoluteUrl(post.url || `/${post.lang}/blog/${post.slug}`);

  return {
    '@id': `${fullUrl}#article`,
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: fullUrl,
    image: post.image,
    datePublished: post.date.toISOString(),
    dateModified: post.modifiedDate?.toISOString() || post.date.toISOString(),
    inLanguage: post.lang === 'zh' ? 'zh-CN' : 'en',
    author: entityReference(
      'Person',
      ENTITY_IDS.person,
      SITE.authorName,
      absoluteUrl(`/${post.lang}/about/`)
    ),
    publisher: entityReference(
      'Organization',
      ENTITY_IDS.publisher,
      SITE.nameEn,
      absoluteUrl(`/${post.lang}/blog/`)
    ),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': fullUrl,
    },
    isPartOf: { '@id': ENTITY_IDS.website },
    copyrightHolder: entityReference(
      'Person',
      ENTITY_IDS.person,
      SITE.authorName,
      absoluteUrl(`/${post.lang}/about/`)
    ),
    genre: isEn ? 'AI and biopharma analysis' : 'AI 与生物医药分析',
    articleSection: isEn ? SITE.nameEn : SITE.name,
    keywords: post.keywords,
    wordCount: post.wordCount,
    sameAs: post.sameAs?.length ? post.sameAs : undefined,
  };
}

/**
 * Generate BreadcrumbList schema for a page path
 */
export function generateBreadcrumbSchema(
  breadcrumbs: Array<{ name: string; path?: string }>,
  lang: 'en' | 'zh' = 'en'
): BreadcrumbListSchema {
  const itemListElement = breadcrumbs.map((crumb, index) => ({
    '@type': 'ListItem' as const,
    position: index + 1,
    name: crumb.name,
    item: crumb.path ? absoluteUrl(`/${lang}${crumb.path}`) : undefined,
  }));

  return {
    '@type': 'BreadcrumbList',
    itemListElement,
    numberOfItems: breadcrumbs.length,
  };
}

/**
 * Generate breadcrumbs for a blog post
 */
export function getBlogBreadcrumbs(
  postTitle: string,
  lang: 'en' | 'zh'
): Array<{ name: string; path?: string }> {
  const homeLabel = lang === 'en' ? 'Home' : '首页';
  const blogLabel = lang === 'en' ? 'Blog' : '博客';

  return [{ name: homeLabel, path: '/' }, { name: blogLabel, path: '/blog' }, { name: postTitle }];
}

/**
 * Generate breadcrumbs for a page
 */
export function getPageBreadcrumbs(
  pageName: string,
  lang: 'en' | 'zh'
): Array<{ name: string; path?: string }> {
  const homeLabel = lang === 'en' ? 'Home' : '首页';

  return [{ name: homeLabel, path: '/' }, { name: pageName }];
}
