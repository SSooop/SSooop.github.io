import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const distRoot = path.join(root, 'dist');
const args = process.argv.slice(2);
const shouldCheckExternal = args.includes('--external');
const siteUrl = new URL(process.env.SITE_URL || 'https://ssooop.github.io');
const reportPath = readOption('--report', path.join(root, '.reports/external-links.json'));
const markdownReportPath = readOption('--markdown-report', reportPath.replace(/\.json$/i, '.md'));
const scannedExtensions = new Set(['.html', '.xml', '.txt']);
const linkAttributes = ['href', 'src', 'poster', 'action'];

function readOption(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] || fallback;
}

function walk(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && scannedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function displayPath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function routePathForDistFile(file) {
  if (!file.startsWith('dist/')) {
    return file;
  }

  const rel = file.slice('dist/'.length);

  if (rel === 'index.html') {
    return '/';
  }

  if (rel.endsWith('/index.html')) {
    return `/${rel.slice(0, -'index.html'.length)}`;
  }

  return `/${rel}`;
}

function unique(values) {
  return [...new Set(values)].sort();
}

function publicPathForFile(filePath) {
  const rel = path.relative(distRoot, filePath).replace(/\\/g, '/');

  if (rel === 'index.html') {
    return '/';
  }

  if (rel.endsWith('/index.html')) {
    return `/${rel.slice(0, -'index.html'.length)}`;
  }

  return `/${rel}`;
}

function normalizeRef(value) {
  return value.trim().replace(/&amp;/g, '&');
}

function isIgnorableRef(value) {
  return !value || value.startsWith('#') || /^(data|mailto|tel|javascript):/i.test(value);
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return match ? normalizeRef(match[1]) : undefined;
}

function collectReferences(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const publicPath = publicPathForFile(filePath);
  const refs = [];
  const tagPattern = /<([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g;
  let tagMatch;

  while ((tagMatch = tagPattern.exec(text))) {
    const tag = tagMatch[0];
    const rel = getAttribute(tag, 'rel')?.toLowerCase() || '';

    if (/\b(preconnect|dns-prefetch)\b/.test(rel)) {
      continue;
    }

    for (const attr of linkAttributes) {
      const ref = getAttribute(tag, attr);

      if (!ref || isIgnorableRef(ref)) {
        continue;
      }

      refs.push({
        ref,
        filePath,
        publicPath,
        kind: attr,
      });
    }
  }

  const locPattern = /<loc>([^<]+)<\/loc>/g;
  let locMatch;
  while ((locMatch = locPattern.exec(text))) {
    const ref = normalizeRef(locMatch[1]);
    if (!isIgnorableRef(ref)) {
      refs.push({
        ref,
        filePath,
        publicPath,
        kind: 'sitemap-loc',
      });
    }
  }

  const sitemapPattern = /^Sitemap:\s*(\S+)/gim;
  let sitemapMatch;
  while ((sitemapMatch = sitemapPattern.exec(text))) {
    const ref = normalizeRef(sitemapMatch[1]);
    if (!isIgnorableRef(ref)) {
      refs.push({
        ref,
        filePath,
        publicPath,
        kind: 'robots-sitemap',
      });
    }
  }

  return refs;
}

function toUrl(ref, publicPath) {
  if (ref.startsWith('//')) {
    return new URL(`https:${ref}`);
  }

  try {
    return new URL(ref, `${siteUrl.origin}${publicPath}`);
  } catch {
    return undefined;
  }
}

function isInternalUrl(url) {
  return url.origin === siteUrl.origin;
}

function candidatesForPath(pathname) {
  let cleanPath;

  try {
    cleanPath = decodeURIComponent(pathname);
  } catch {
    cleanPath = pathname;
  }

  const withoutLeadingSlash = cleanPath.replace(/^\/+/, '');

  if (cleanPath === '/') {
    return [path.join(distRoot, 'index.html')];
  }

  if (cleanPath.endsWith('/')) {
    return [path.join(distRoot, withoutLeadingSlash, 'index.html')];
  }

  return [
    path.join(distRoot, withoutLeadingSlash),
    path.join(distRoot, withoutLeadingSlash, 'index.html'),
    path.join(distRoot, `${withoutLeadingSlash}.html`),
  ];
}

function existsInsideDist(candidate) {
  const resolved = path.resolve(candidate);
  return resolved.startsWith(distRoot) && fs.existsSync(resolved);
}

function checkInternalReferences(references) {
  const errors = [];
  let checked = 0;

  for (const reference of references) {
    const url = toUrl(reference.ref, reference.publicPath);

    if (!url || !isInternalUrl(url)) {
      continue;
    }

    checked += 1;

    const candidates = candidatesForPath(url.pathname);
    if (!candidates.some(existsInsideDist)) {
      errors.push({
        ...reference,
        target: url.pathname,
      });
    }
  }

  return { checked, errors };
}

function uniqueExternalReferences(references) {
  const refsByUrl = new Map();

  for (const reference of references) {
    const url = toUrl(reference.ref, reference.publicPath);

    if (!url || isInternalUrl(url)) {
      continue;
    }

    const key = url.href;
    const existing = refsByUrl.get(key) || {
      url: key,
      sources: [],
    };

    existing.sources.push({
      file: displayPath(reference.filePath),
      kind: reference.kind,
      ref: reference.ref,
    });

    refsByUrl.set(key, existing);
  }

  return [...refsByUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}

async function probeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const headers = {
    'user-agent': 'SSooop.github.io link audit (+https://ssooop.github.io)',
  };

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers,
    });

    if ([403, 405].includes(response.status)) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers,
      });
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'request_failed',
      statusText: error instanceof Error ? error.message : 'request failed',
      finalUrl: url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classifyProbe(result) {
  if (result.ok) {
    return 'ok';
  }

  if ([404, 410].includes(result.status)) {
    return 'broken';
  }

  return 'needs_review';
}

function sourceCandidatesForRenderedFile(file) {
  const blogMatch = file.match(/^dist\/(?:en|zh)\/blog\/(\d{4})\/([^/]+)\/(cn|en)\/index\.html$/);
  if (blogMatch) {
    return [`src/content/blog/${blogMatch[1]}/${blogMatch[2]}/${blogMatch[3]}.mdx`];
  }

  if (/^dist\/(?:en|zh)\/blog\/index\.html$/.test(file)) {
    return ['src/pages/[lang]/blog/index.astro'];
  }

  const localizedPageMatch = file.match(/^dist\/(?:en|zh)\/([^/]+)\/index\.html$/);
  if (localizedPageMatch) {
    return [`src/pages/[lang]/${localizedPageMatch[1]}.astro`];
  }

  if (/^dist\/(?:en|zh)\/index\.html$/.test(file)) {
    return ['src/pages/[lang]/index.astro'];
  }

  if (file === 'dist/index.html') {
    return ['src/pages/index.astro'];
  }

  return [file];
}

function candidateSourceFiles(result) {
  return unique(result.sources.flatMap((source) => sourceCandidatesForRenderedFile(source.file)));
}

function renderedRoutes(result) {
  return unique(result.sources.map((source) => routePathForDistFile(source.file)));
}

function reviewAction(result) {
  if (result.category === 'broken') {
    return 'Fix URL, replace source, or remove the reference.';
  }

  if ([401, 403, 429, 999].includes(result.status)) {
    return 'Open manually; likely auth, bot protection, or rate limiting.';
  }

  return 'Open manually; verify whether the platform blocks automated probes.';
}

function markdownEscape(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function markdownLink(url) {
  return `[open](<${url.replace(/[<>]/g, '')}>)`;
}

function markdownList(values) {
  return values.map((value) => `\`${value}\``).join('<br>');
}

function renderResultTable(results) {
  if (results.length === 0) {
    return 'None.\n';
  }

  const rows = [
    '| Status | URL | Action | Source candidates | Rendered routes |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const result of results) {
    rows.push(
      `| ${[
        `\`${markdownEscape(result.status)}\``,
        markdownLink(result.url),
        markdownEscape(reviewAction(result)),
        markdownList(candidateSourceFiles(result)),
        markdownList(renderedRoutes(result)),
      ].join(' | ')} |`
    );
  }

  return `${rows.join('\n')}\n`;
}

function writeMarkdownReport(results, generatedAt) {
  const broken = results.filter((result) => result.category === 'broken');
  const needsReview = results.filter((result) => result.category === 'needs_review');
  const ok = results.filter((result) => result.category === 'ok');
  const lines = [
    '# External Link Audit',
    '',
    `Generated at: ${generatedAt}`,
    `Site: ${siteUrl.origin}`,
    '',
    '## Summary',
    '',
    `- OK: ${ok.length}`,
    `- Needs manual review: ${needsReview.length}`,
    `- Broken: ${broken.length}`,
    '',
    '## Broken Links',
    '',
    renderResultTable(broken),
    '## Needs Manual Review',
    '',
    renderResultTable(needsReview),
    '## Notes',
    '',
    '- `broken` means the probe received a hard missing response such as 404 or 410.',
    '- `needs_review` covers authentication blocks, bot protection, rate limits, and transient probe failures.',
    '- Source candidates are inferred from rendered `dist/` paths; confirm the exact line before editing.',
    '',
  ];

  fs.mkdirSync(path.dirname(markdownReportPath), { recursive: true });
  fs.writeFileSync(markdownReportPath, `${lines.join('\n')}\n`);
}

async function checkExternalReferences(references) {
  const externalReferences = uniqueExternalReferences(references);
  const results = [];

  for (const reference of externalReferences) {
    const probe = await probeUrl(reference.url);
    results.push({
      ...reference,
      ...probe,
      category: classifyProbe(probe),
    });
  }

  return results;
}

function writeReport(results) {
  const generatedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt,
        siteUrl: siteUrl.origin,
        totals: {
          ok: results.filter((result) => result.category === 'ok').length,
          needsReview: results.filter((result) => result.category === 'needs_review').length,
          broken: results.filter((result) => result.category === 'broken').length,
        },
        results,
      },
      null,
      2
    )}\n`
  );
  writeMarkdownReport(results, generatedAt);
}

if (!fs.existsSync(distRoot)) {
  console.error('dist/ does not exist. Run pnpm build before link checks.');
  process.exit(1);
}

const files = walk(distRoot);
const references = files.flatMap(collectReferences);

if (shouldCheckExternal) {
  const results = await checkExternalReferences(references);
  const broken = results.filter((result) => result.category === 'broken');
  const needsReview = results.filter((result) => result.category === 'needs_review');

  writeReport(results);

  console.log(`Checked ${results.length} unique external URLs.`);
  console.log(`Report written to ${displayPath(reportPath)}.`);
  console.log(`Markdown report written to ${displayPath(markdownReportPath)}.`);

  if (needsReview.length > 0) {
    console.log(`\nNeeds manual review (${needsReview.length}):`);
    for (const result of needsReview) {
      console.log(`  - ${result.status} ${result.url}`);
    }
  }

  if (broken.length > 0) {
    console.error(`\nBroken external links (${broken.length}):`);
    for (const result of broken) {
      console.error(`  - ${result.status} ${result.url}`);
    }
    process.exit(1);
  }

  console.log('\nExternal link audit completed.');
} else {
  const { checked, errors } = checkInternalReferences(references);

  console.log(`Checked ${checked} internal references across ${files.length} built files.`);

  if (errors.length > 0) {
    console.error(`\nBroken internal references (${errors.length}):`);
    for (const error of errors) {
      console.error(
        `  - ${displayPath(error.filePath)} ${error.kind} "${error.ref}" -> ${error.target}`
      );
    }
    process.exit(1);
  }

  console.log('\nInternal link check passed.');
}
