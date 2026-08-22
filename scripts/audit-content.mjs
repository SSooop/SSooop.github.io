import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const blogRoot = path.join(root, 'src/content/blog');
const publicRoot = path.join(root, 'public');
const shouldCheckNetwork = process.argv.includes('--network');

const legacyFields = ['relatedPost', 'wechatLink', 'mediumLink'];
const allowedPlatforms = new Set(['site', 'wechat', 'xueqiu', 'medium', 'x', 'linkedin']);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const expectedFileLang = {
  cn: 'zh',
  en: 'en',
};
const expectedTranslationSuffix = {
  zh: 'cn',
  en: 'en',
};
const localImageExtensionPattern = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const handwrittenArticleShellPatterns = [
  {
    pattern: /致读者与\s*AI Agent|To readers and AI agents/i,
    message: 'hand-written article summary must be rendered by the article template',
  },
  {
    pattern: /阅读时间约|Reading time:/i,
    message: 'hand-written reading time must be rendered by the article template',
  },
  {
    pattern: /AI友好声明|AI-Friendly (?:Statement|Notice)/i,
    message: 'hand-written AI statement must be rendered by the article template',
  },
  {
    pattern:
      /mp\.weixin\.qq\.com|公众号：智药深瞳|WeChat Official Account: IntelliPharma Insights/i,
    message:
      'WeChat serialization links and labels belong in publication metadata, not article body',
  },
  {
    pattern:
      /^(?:#{1,6}\s*)?(?:往期相关|往期文章|相关阅读|相关文章|延伸阅读|Related (?:Posts|Articles|Reading)|Previous (?:Posts|Articles)|Further Reading)\s*[：:]?\s*$/im,
    message: 'related article lists belong in related frontmatter, not the article body',
  },
];

const errors = [];
const warnings = [];

function addError(file, message) {
  errors.push(`${file}: ${message}`);
}

function addWarning(file, message) {
  warnings.push(`${file}: ${message}`);
}

function walk(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function splitFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);

  if (!match) {
    return { frontmatter: '', body: text };
  }

  return {
    frontmatter: match[1].replace(/\r\n/g, '\n'),
    body: text.slice(match[0].length),
  };
}

function parseScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return match ? unquote(match[1].trim()) : undefined;
}

function unquote(value) {
  if (!value) return value;
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseIndentedMap(frontmatter, key) {
  const lines = frontmatter.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  const map = {};

  if (start === -1) return map;

  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ')) break;

    const match = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      map[match[1]] = unquote(match[2]);
    }
  }

  return map;
}

function parseIndentedList(frontmatter, key) {
  const lines = frontmatter.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  const values = [];

  if (start === -1) return values;

  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ')) break;

    const match = line.match(/^\s{2}-\s+(.*)$/);
    if (match) {
      values.push(unquote(match[1]));
    }
  }

  return values;
}

function parsePublications(frontmatter) {
  const lines = frontmatter.split('\n');
  const start = lines.findIndex((line) => line.trim() === 'publications:');
  const publications = [];
  let current = null;

  if (start === -1) return publications;

  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ')) break;

    const itemMatch = line.match(/^\s{2}-\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (itemMatch) {
      current = { [itemMatch[1]]: unquote(itemMatch[2]) };
      publications.push(current);
      continue;
    }

    const fieldMatch = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (fieldMatch && current) {
      current[fieldMatch[1]] = unquote(fieldMatch[2]);
    }
  }

  return publications;
}

function isPlaceholderUrl(value = '') {
  return value.includes('xxxxx') || value.endsWith('/...') || value.includes('@alexsu/...');
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isIgnorableAssetRef(value) {
  return (
    !value ||
    value.startsWith('#') ||
    value.startsWith('data:') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:')
  );
}

function stripUrlDecoration(value) {
  return value.trim().split(/\s+/)[0].replace(/^<|>$/g, '');
}

function collectLocalImageRefs(body) {
  const refs = [];
  const markdownImagePattern = /!\[[^\]]*]\(([^)]+)\)/g;
  const srcPattern = /\bsrc=["']([^"']+)["']/g;
  let match;

  while ((match = markdownImagePattern.exec(body))) {
    refs.push(stripUrlDecoration(match[1]));
  }

  while ((match = srcPattern.exec(body))) {
    refs.push(stripUrlDecoration(match[1]));
  }

  return refs.filter((ref) => !isIgnorableAssetRef(ref) && !isExternalUrl(ref));
}

function collectExternalImageRefs(body) {
  const refs = [];
  const markdownImagePattern = /!\[[^\]]*]\(([^)]+)\)/g;
  const srcPattern = /\bsrc=["']([^"']+)["']/g;
  let match;

  while ((match = markdownImagePattern.exec(body))) {
    refs.push(stripUrlDecoration(match[1]));
  }

  while ((match = srcPattern.exec(body))) {
    refs.push(stripUrlDecoration(match[1]));
  }

  return refs.filter((ref) => !isIgnorableAssetRef(ref) && isExternalUrl(ref));
}

function resolveLocalImage(filePath, ref) {
  if (ref.startsWith('/')) {
    return path.join(publicRoot, ref.slice(1));
  }

  return path.resolve(path.dirname(filePath), ref);
}

async function probeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
    }

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error ? error.message : 'request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

const files = walk(blogRoot);
const records = new Map();
const ids = new Set();

for (const filePath of files) {
  const rel = path.relative(blogRoot, filePath).replace(/\\/g, '/');
  const id = rel.replace(/\.(md|mdx)$/, '');
  const parts = id.split('/');
  const displayPath = path.relative(root, filePath);
  const { frontmatter, body } = splitFrontmatter(filePath);

  ids.add(id);

  const record = {
    filePath,
    displayPath,
    id,
    translationKey: parseScalar(frontmatter, 'translationKey'),
    lang: parseScalar(frontmatter, 'lang'),
    date: parseScalar(frontmatter, 'date'),
    updated: parseScalar(frontmatter, 'updated'),
    translations: parseIndentedMap(frontmatter, 'translations'),
    related: parseIndentedList(frontmatter, 'related'),
    canonical: parseIndentedMap(frontmatter, 'canonical'),
    publications: parsePublications(frontmatter),
    image: parseScalar(frontmatter, 'image'),
    imageAlt: parseScalar(frontmatter, 'imageAlt'),
    imageCaption: parseScalar(frontmatter, 'imageCaption'),
    imageSource: parseScalar(frontmatter, 'imageSource'),
    body,
    parts,
  };

  records.set(id, record);
}

const availableTranslationKeys = new Set(
  [...records.values()].map((record) => record.translationKey)
);

for (const record of records.values()) {
  const {
    displayPath,
    id,
    parts,
    translationKey,
    lang,
    date,
    updated,
    translations,
    related,
    canonical,
    publications,
  } = record;

  if (parts.length !== 3 || !expectedFileLang[parts[2]]) {
    addError(displayPath, `unexpected content id "${id}"; expected YYYY/slug/cn or YYYY/slug/en`);
    continue;
  }

  for (const field of legacyFields) {
    if (new RegExp(`^${field}:`, 'm').test(splitFrontmatter(record.filePath).frontmatter)) {
      addError(displayPath, `legacy field "${field}" must be removed`);
    }
  }

  const expectedLang = expectedFileLang[parts[2]];
  const expectedKey = `${parts[0]}/${parts[1]}`;
  const expectedCanonical = `/${expectedLang}/blog/${id}`;

  if (lang !== expectedLang) {
    addError(displayPath, `lang "${lang}" does not match file suffix "${parts[2]}"`);
  }

  if (translationKey !== expectedKey) {
    addError(displayPath, `translationKey "${translationKey}" should be "${expectedKey}"`);
  }

  if (related.length > 3) {
    addError(displayPath, 'related must contain no more than three translation keys');
  }

  for (const relatedKey of related) {
    if (relatedKey === translationKey) {
      addError(displayPath, 'related must not reference the current article');
    } else if (!availableTranslationKeys.has(relatedKey)) {
      addError(displayPath, `related points to missing translation group "${relatedKey}"`);
    }
  }

  for (const duplicate of related.filter((key, index) => related.indexOf(key) !== index)) {
    addError(displayPath, `related contains duplicate translation key "${duplicate}"`);
  }

  if (translations[expectedLang] !== id) {
    addError(displayPath, `translations.${expectedLang} must point to itself (${id})`);
  }

  for (const [locale, targetId] of Object.entries(translations)) {
    if (!['zh', 'en'].includes(locale)) {
      addError(displayPath, `unsupported translation locale "${locale}"`);
      continue;
    }

    if (!ids.has(targetId)) {
      addError(displayPath, `translations.${locale} points to missing post "${targetId}"`);
      continue;
    }

    if (!targetId.endsWith(`/${expectedTranslationSuffix[locale]}`)) {
      addError(displayPath, `translations.${locale} points to a non-${locale} post "${targetId}"`);
    }

    const target = records.get(targetId);
    if (target && target.translationKey !== translationKey) {
      addError(displayPath, `translations.${locale} points outside its translationKey group`);
    }
  }

  for (const locale of ['zh', 'en']) {
    const expectedTarget = `${translationKey}/${expectedTranslationSuffix[locale]}`;
    if (ids.has(expectedTarget) && translations[locale] !== expectedTarget) {
      addError(displayPath, `translations.${locale} should be "${expectedTarget}"`);
    }
  }

  if (canonical.url !== expectedCanonical) {
    addError(displayPath, `canonical.url "${canonical.url}" should be "${expectedCanonical}"`);
  }

  if (canonical.role !== 'version_home') {
    addError(displayPath, 'canonical.role must be "version_home"');
  }

  if (updated !== undefined) {
    if (!isoDatePattern.test(updated)) {
      addError(displayPath, `updated "${updated}" must use YYYY-MM-DD`);
    } else if (isoDatePattern.test(date) && updated < date) {
      addError(displayPath, `updated "${updated}" must not be earlier than date "${date}"`);
    }
  }

  if (record.image) {
    if (isExternalUrl(record.image)) {
      addError(displayPath, 'frontmatter image must be a local file under ./images/');
    }

    if (!record.image.startsWith('./images/')) {
      addError(displayPath, `frontmatter image "${record.image}" should use ./images/...`);
    }

    if (!localImageExtensionPattern.test(record.image)) {
      addError(displayPath, `frontmatter image "${record.image}" should be an image file`);
    }

    const resolvedImage = resolveLocalImage(record.filePath, record.image);
    if (!fs.existsSync(resolvedImage)) {
      addError(displayPath, `frontmatter image "${record.image}" does not exist`);
    }

    if (!record.imageAlt) {
      addError(displayPath, 'frontmatter imageAlt is required when image is set');
    }
  }

  if (!record.image && (record.imageAlt || record.imageCaption || record.imageSource)) {
    addWarning(displayPath, 'image metadata is present without a frontmatter image');
  }

  for (const rule of handwrittenArticleShellPatterns) {
    if (rule.pattern.test(record.body)) {
      addError(displayPath, rule.message);
    }
  }

  const sitePublications = publications.filter((publication) => publication.platform === 'site');
  if (sitePublications.length !== 1) {
    addError(displayPath, 'publications must contain exactly one site entry');
  }

  for (const publication of publications) {
    if (!allowedPlatforms.has(publication.platform)) {
      addError(displayPath, `unsupported publication platform "${publication.platform}"`);
    }

    if (publication.mode !== 'full_text') {
      addError(displayPath, `publication ${publication.platform} must use mode "full_text"`);
    }

    if (!['published', 'planned'].includes(publication.status)) {
      addError(displayPath, `publication ${publication.platform} has invalid status`);
    }

    if (publication.url && isPlaceholderUrl(publication.url)) {
      addError(displayPath, `publication ${publication.platform} contains a placeholder URL`);
    }

    if (publication.platform === 'site' && publication.status !== 'published') {
      addError(displayPath, 'site publication must be published');
    }

    if (publication.platform === 'wechat') {
      if (publication.access !== 'qr_or_account') {
        addError(displayPath, 'wechat publication should use access "qr_or_account"');
      }

      if (!publication.account) {
        addError(displayPath, 'wechat publication should include account');
      }
    }
  }

  const duplicatePlatforms = publications
    .map((publication) => publication.platform)
    .filter((platform, index, platforms) => platforms.indexOf(platform) !== index);
  for (const platform of new Set(duplicatePlatforms)) {
    addError(displayPath, `duplicate publication platform "${platform}"`);
  }

  for (const imageRef of collectLocalImageRefs(record.body)) {
    const resolved = resolveLocalImage(record.filePath, imageRef);
    if (!fs.existsSync(resolved)) {
      addError(displayPath, `image reference "${imageRef}" does not exist`);
    }

    if (
      !imageRef.startsWith('/') &&
      !imageRef.startsWith('./images/') &&
      !imageRef.startsWith('images/')
    ) {
      addWarning(displayPath, `local image reference "${imageRef}" should live under ./images/`);
    }
  }

  for (const imageRef of collectExternalImageRefs(record.body)) {
    addWarning(
      displayPath,
      `external image reference "${imageRef}" should be copied into the article images folder`
    );
  }
}

const groups = new Map();
for (const record of records.values()) {
  const group = groups.get(record.translationKey) || [];
  group.push(record);
  groups.set(record.translationKey, group);
}

for (const [translationKey, group] of groups) {
  const locales = new Set(group.map((record) => record.lang));
  if (!locales.has('zh')) {
    addWarning(translationKey, 'missing Chinese version');
  }
  if (!locales.has('en')) {
    addWarning(translationKey, 'missing English version');
  }
}

if (shouldCheckNetwork) {
  for (const record of records.values()) {
    for (const publication of record.publications) {
      if (!publication.url) continue;

      const result = await probeUrl(publication.url);
      if (!result.ok) {
        addWarning(
          record.displayPath,
          `publication URL returned ${result.status}: ${publication.url}`
        );
      }
    }
  }
}

console.log(`Audited ${records.size} content files across ${groups.size} translation groups.`);

if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const warning of warnings) {
    console.log(`  - ${warning}`);
  }
}

if (errors.length > 0) {
  console.error(`\nErrors (${errors.length}):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log('\nContent audit passed.');
