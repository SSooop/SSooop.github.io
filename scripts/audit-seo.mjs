import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, 'dist');
const issues = [];

if (!fs.existsSync(distRoot)) {
  console.error('SEO audit requires a production build. Run `pnpm build` first.');
  process.exit(1);
}

function collectHtmlFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collectHtmlFiles(filePath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(filePath);
    }
  }

  return files;
}

function collectStructuredData(value, filePath, websiteDefinitions) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredData(item, filePath, websiteDefinitions));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (value['@type'] === 'WebSite' && value.name && value.url) {
    websiteDefinitions.add(filePath);
  }

  Object.values(value).forEach((item) => collectStructuredData(item, filePath, websiteDefinitions));
}

const htmlFiles = collectHtmlFiles(distRoot);
const pagesByCanonical = new Map();
const websiteDefinitions = new Set();
let jsonLdCount = 0;

for (const filePath of htmlFiles) {
  const relativePath = path.relative(projectRoot, filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(
    (match) => match[1]
  );
  const alternates = Object.fromEntries(
    [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ])
  );

  if (canonicals.length !== 1) {
    issues.push(`${relativePath}: expected one canonical URL, found ${canonicals.length}`);
  } else if (pagesByCanonical.has(canonicals[0])) {
    issues.push(`${relativePath}: duplicate canonical URL ${canonicals[0]}`);
  } else {
    pagesByCanonical.set(canonicals[0], { filePath, alternates });
  }

  const alternateKeys = Object.keys(alternates).sort();
  if (alternateKeys.join(',') !== 'en,x-default,zh') {
    issues.push(
      `${relativePath}: expected en, zh, and x-default hreflang links; found ${alternateKeys.join(', ')}`
    );
  }

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    jsonLdCount += 1;

    try {
      collectStructuredData(JSON.parse(match[1]), filePath, websiteDefinitions);
    } catch (error) {
      issues.push(`${relativePath}: invalid JSON-LD (${error.message})`);
    }
  }

  if (html.includes('/og-image.png')) {
    issues.push(`${relativePath}: references the removed placeholder OG image`);
  }

  for (const match of html.matchAll(/<meta property="og:image" content="([^"]+)"/g)) {
    const imageUrl = new URL(match[1]);
    const localImagePath = path.join(distRoot, imageUrl.pathname);

    if (!fs.existsSync(localImagePath)) {
      issues.push(`${relativePath}: local OG image does not exist (${imageUrl.pathname})`);
    }
  }
}

for (const [canonical, page] of pagesByCanonical) {
  const relativePath = path.relative(projectRoot, page.filePath);

  for (const langCode of ['en', 'zh', 'x-default']) {
    if (!pagesByCanonical.has(page.alternates[langCode])) {
      issues.push(
        `${relativePath}: ${langCode} alternate is not a canonical page (${page.alternates[langCode]})`
      );
    }
  }

  const englishPage = pagesByCanonical.get(page.alternates.en);
  if (englishPage && JSON.stringify(englishPage.alternates) !== JSON.stringify(page.alternates)) {
    issues.push(`${relativePath}: hreflang cluster is not reciprocal for ${canonical}`);
  }
}

for (const sitemapName of ['sitemap-main.xml', 'sitemap-blog.xml']) {
  const sitemapPath = path.join(distRoot, sitemapName);
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');

  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    if (!pagesByCanonical.has(match[1])) {
      issues.push(`${sitemapName}: URL is not a page canonical (${match[1]})`);
    }
  }
}

const rootPath = path.join(distRoot, 'index.html');
const rootHtml = fs.readFileSync(rootPath, 'utf8');
if (/http-equiv=["']refresh|window\.location|location\.href/i.test(rootHtml)) {
  issues.push('dist/index.html: root language entry must not depend on a client-side redirect');
}

if (websiteDefinitions.size !== 1 || !websiteDefinitions.has(rootPath)) {
  issues.push(
    `WebSite structured data must have one full definition at dist/index.html; found ${[
      ...websiteDefinitions,
    ]
      .map((filePath) => path.relative(projectRoot, filePath))
      .join(', ')}`
  );
}

if (issues.length > 0) {
  console.error(`SEO audit failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(
  `SEO audit passed: ${htmlFiles.length} canonical pages, ${jsonLdCount} JSON-LD blocks, reciprocal hreflang clusters, and aligned sitemaps.`
);
