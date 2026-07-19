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
} from '../types/schema';
import { SITE, absoluteUrl } from '../config/site';

/**
 * Generate WebSite schema for the main site
 */
export function generateWebSiteSchema(lang: 'en' | 'zh' = 'en'): WebSiteSchema {
  const isEn = lang === 'en';

  return {
    '@type': 'WebSite',
    name: isEn ? 'Alex Su - Digital Space' : 'Alex Su - 数字空间',
    url: SITE.url,
    description: isEn
      ? 'Personal website of Alex Su - Exploring the intersection of technology, philosophy, and digital culture.'
      : 'Alex Su 的个人网站 - 探索技术、哲学和数字文化的交叉领域。',
    alternateName: isEn ? 'Alex Su' : 'Alex Su (苏)',
    inLanguage: lang,
    potentialAction: {
      '@type': 'SearchAction',
      target: absoluteUrl(`/${lang}/blog/?q={search_term_string}`),
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate Person schema for Alex Su
 */
export function generatePersonSchema(lang: 'en' | 'zh' = 'en'): PersonSchema {
  const isEn = lang === 'en';

  return {
    '@type': 'Person',
    name: 'Alex Su',
    url: absoluteUrl(`/${lang}/`),
    jobTitle: isEn ? 'Software Engineer & Digital Creator' : '软件工程师与数字创作者',
    description: isEn
      ? 'Alex Su is a software engineer exploring the intersection of technology, philosophy, and digital culture.'
      : 'Alex Su 是一名软件工程师，探索技术、哲学和数字文化的交叉领域。',
    email: 'mailto:contact@alexsu.dev',
    sameAs: [
      'https://github.com/ssooop',
      'https://x.com/ChenpengSu',
      'https://linkedin.com/in/alexsu-dev',
    ],
    knowsAbout: isEn
      ? [
          'Software Engineering',
          'Artificial Intelligence',
          'Digital Philosophy',
          'Web Development',
          'Pharmaceutical Sciences',
          'Generative AI',
          'Chinese Philosophy',
        ]
      : ['软件工程', '人工智能', '数字哲学', 'Web 开发', '制药科学', '生成式 AI', '中国哲学'],
    inLanguage: lang,
  };
}

/**
 * Generate Organization schema for the site publisher
 */
export function generateOrganizationSchema(): OrganizationSchema {
  return {
    '@type': 'Organization',
    name: 'Alex Su',
    url: SITE.url,
    description: 'Personal website and blog',
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
}): BlogPostingSchema {
  const isEn = post.lang === 'en';
  const fullUrl = absoluteUrl(post.url || `/${post.lang}/blog/${post.slug}`);

  return {
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: fullUrl,
    image: post.image || absoluteUrl('/og-image.png'),
    datePublished: post.date.toISOString(),
    dateModified: post.modifiedDate?.toISOString() || post.date.toISOString(),
    inLanguage: post.lang,
    author: generatePersonSchema(post.lang),
    publisher: generateOrganizationSchema(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': fullUrl,
    },
    genre: isEn ? 'Technology' : '科技',
    articleSection: isEn ? 'Technology & Philosophy' : '科技与哲学',
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
