import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_COLUMN_ID, listColumns, requireColumn } from './columns.mjs';
import {
  createIdea,
  IDEA_STATUSES,
  listIdeas,
  listIdeasWithDiagnostics,
  updateIdea,
} from './idea-store.mjs';
import {
  ensureTaskWorkspace,
  publishTaskAssets,
  readTaskWorkspace,
  saveTaskAsset,
  TASK_DOCUMENTS,
  taskAssetPath,
  updateTaskStage,
} from './task-workspace.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(moduleDir, '../..');
const defaultPublicDir = path.join(moduleDir, 'public');
const draftIdPattern = /^\d{4}\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const languagePattern = /^(cn|en)$/;
const maxBodyBytes = 12 * 1024 * 1024;
const fileMutationQueues = new Map();

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; frame-ancestors 'none'; connect-src 'self'; base-uri 'none'; form-action 'self'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function atomicWriteText(file, content, expectedHash, afterTemporaryWrite) {
  const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, content, 'utf8');
    await afterTemporaryWrite?.({ target: file, temporary });
    const current = await readFile(file, 'utf8');
    const currentHash = contentHash(current);
    if (currentHash !== expectedHash) return { conflict: true, currentHash };
    await rename(temporary, file);
    return { saved: true, hash: contentHash(content) };
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function serializeFileMutation(file, mutation) {
  const key = path.resolve(file);
  const previous = fileMutationQueues.get(key) ?? Promise.resolve();
  const result = previous.catch(() => {}).then(mutation);
  const settled = result.then(
    () => undefined,
    () => undefined
  );
  fileMutationQueues.set(key, settled);

  try {
    return await result;
  } finally {
    if (fileMutationQueues.get(key) === settled) fileMutationQueues.delete(key);
  }
}

function hasWriteConflict(current, input) {
  return input.baseHash !== contentHash(current) && input.content !== current;
}

function isMutatingRequest(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '');
}

function hasValidLocalOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === 'http:' &&
      /^(127\.0\.0\.1|localhost)$/i.test(parsed.hostname) &&
      parsed.host === request.headers.host
    );
  } catch {
    return false;
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = match?.[1] ?? '';
  const scalar = (key) => {
    const value = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    if (!value) return '';
    return value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2');
  };

  return {
    title: scalar('title'),
    date: scalar('date'),
    description: scalar('description'),
    lang: scalar('lang'),
    translationKey: scalar('translationKey'),
    canonicalUrl:
      frontmatter.match(/^canonical:\s*\r?\n\s+url:\s*["']?([^"'\r\n]+)["']?/m)?.[1] ?? '',
    body: match ? content.slice(match[0].length) : content,
    hasFrontmatter: Boolean(match),
  };
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function hasPlanningContent(content) {
  return Boolean(
    content
      .replace(/^#{1,6}\s+.*$/gm, '')
      .replace(/^>.*$/gm, '')
      .replace(/<!--[^]*?-->/g, '')
      .trim()
  );
}

async function readBody(request) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text || '{}');
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
}

function safeDraftId(value) {
  const decoded = decodeURIComponent(value || '');
  if (!draftIdPattern.test(decoded)) {
    const error = new Error('Invalid draft id.');
    error.status = 400;
    throw error;
  }
  return decoded;
}

function safeLanguage(value) {
  if (!languagePattern.test(value || '')) {
    const error = new Error('Language must be cn or en.');
    error.status = 400;
    throw error;
  }
  return value;
}

function draftDirectory(root, id) {
  return path.join(root, '.drafts', 'blog', ...id.split('/'));
}

function contentDirectory(root, id) {
  return path.join(root, 'src', 'content', 'blog', ...id.split('/'));
}

async function newestArticle(root) {
  const blogRoot = path.join(root, 'src', 'content', 'blog');
  const years = (await readdir(blogRoot, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory()
  );
  const candidates = [];

  for (const year of years) {
    const yearRoot = path.join(blogRoot, year.name);
    const articles = (await readdir(yearRoot, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory()
    );
    for (const article of articles) {
      const articleRoot = path.join(yearRoot, article.name);
      for (const language of ['cn', 'en']) {
        const file = path.join(articleRoot, `${language}.mdx`);
        if (!(await exists(file))) continue;
        const content = await readFile(file, 'utf8');
        const metadata = parseFrontmatter(content);
        if (metadata.date) {
          candidates.push({
            date: metadata.date,
            id: `${year.name}/${article.name}`,
            directory: articleRoot,
          });
        }
      }
    }
  }

  return candidates.sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

export async function seedExampleDraft(root = defaultRoot) {
  const draftRoot = path.join(root, '.drafts', 'blog');
  await mkdir(draftRoot, { recursive: true });
  const existingYears = (await readdir(draftRoot, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory()
  );
  for (const year of existingYears) {
    const articles = await readdir(path.join(draftRoot, year.name), { withFileTypes: true });
    for (const article of articles.filter((entry) => entry.isDirectory())) {
      const directory = path.join(draftRoot, year.name, article.name);
      if (
        (await exists(path.join(directory, 'cn.mdx'))) ||
        (await exists(path.join(directory, 'en.mdx')))
      ) {
        return null;
      }
    }
  }

  const latest = await newestArticle(root);
  if (!latest) return null;

  const target = draftDirectory(root, latest.id);
  await mkdir(target, { recursive: true });
  for (const language of ['cn', 'en']) {
    const source = path.join(latest.directory, `${language}.mdx`);
    if (await exists(source)) {
      await copyFile(source, path.join(target, `${language}.mdx`));
    }
  }
  return latest.id;
}

async function listDrafts(root, options = {}) {
  const draftsRoot = path.join(root, '.drafts', 'blog');
  if (options.initialize) await mkdir(draftsRoot, { recursive: true });
  const results = [];
  const years = (
    await readdir(draftsRoot, { withFileTypes: true }).catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    })
  ).filter((entry) => entry.isDirectory());

  for (const year of years) {
    const yearRoot = path.join(draftsRoot, year.name);
    const articles = (await readdir(yearRoot, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory()
    );
    for (const article of articles) {
      const id = `${year.name}/${article.name}`;
      const languages = [];
      let primary = null;
      let modifiedAt = 0;
      for (const language of ['cn', 'en']) {
        const file = path.join(yearRoot, article.name, `${language}.mdx`);
        if (!(await exists(file))) continue;
        languages.push(language);
        const content = await readFile(file, 'utf8');
        primary ||= parseFrontmatter(content);
        modifiedAt = Math.max(modifiedAt, (await stat(file)).mtimeMs);
      }
      if (options.initialize) await ensureTaskWorkspace(root, id, primary || {});
      const workspace = await readTaskWorkspace(root, id);
      modifiedAt = Math.max(
        modifiedAt,
        ...Object.values(workspace.documents)
          .filter((document) => hasPlanningContent(document.content))
          .map((document) => document.modifiedAt),
        ...workspace.assets.map((asset) => asset.modifiedAt),
        Date.parse(workspace.task.updatedAt || '') || 0
      );
      results.push({
        id,
        title: primary?.title || article.name,
        date: primary?.date || year.name,
        languages,
        modifiedAt,
        published: await exists(contentDirectory(root, id)),
        stage: workspace.task.stage,
        columnId: workspace.task.columnId || DEFAULT_COLUMN_ID,
        assetCount: workspace.assets.length,
      });
    }
  }

  return results.sort((left, right) => right.modifiedAt - left.modifiedAt);
}

function articleTemplate({ title, date, description, language, id }) {
  const [year, slug] = id.split('/');
  const locale = language === 'cn' ? 'zh' : 'en';
  return (
    `---\n` +
    `title: ${JSON.stringify(title)}\n` +
    `date: ${date}\n` +
    `description: ${JSON.stringify(description)}\n` +
    `lang: ${JSON.stringify(locale)}\n` +
    `translationKey: ${JSON.stringify(id)}\n` +
    `translations:\n` +
    `  zh: ${JSON.stringify(`${year}/${slug}/cn`)}\n` +
    `  en: ${JSON.stringify(`${year}/${slug}/en`)}\n` +
    `canonical:\n` +
    `  url: ${JSON.stringify(`/${locale}/blog/${year}/${slug}/${language}`)}\n` +
    `  role: "version_home"\n` +
    `publications:\n` +
    `  - platform: "site"\n` +
    `    mode: "full_text"\n` +
    `    status: "published"\n` +
    `---\n\n` +
    `# ${title}\n\n`
  );
}

function validateDraftContent(id, language, content) {
  const metadata = parseFrontmatter(content);
  const expectedLocale = language === 'cn' ? 'zh' : 'en';
  const expectedCanonical = `/${expectedLocale}/blog/${id}/${language}`;
  const errors = [];
  const warnings = [];

  if (!metadata.hasFrontmatter) errors.push('缺少 frontmatter。');
  if (!metadata.title) errors.push('缺少 title。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) errors.push('date 必须使用 YYYY-MM-DD。');
  if (!metadata.description) errors.push('缺少 description。');
  if (metadata.lang !== expectedLocale) errors.push(`lang 应为 ${expectedLocale}。`);
  if (metadata.translationKey !== id) errors.push(`translationKey 应为 ${id}。`);
  if (metadata.canonicalUrl !== expectedCanonical) {
    errors.push(`canonical.url 应为 ${expectedCanonical}。`);
  }
  if (!metadata.body.trim()) warnings.push('正文目前为空。');
  if (/!\[[^\]]*]\((?!https?:|\/|\.\/images\/)/.test(metadata.body)) {
    warnings.push('检测到未放在 ./images/ 下的相对图片引用。');
  }

  return { errors, warnings, metadata };
}

async function validateDraft(root, id) {
  const directory = draftDirectory(root, id);
  const results = {};
  const aggregateErrors = [];
  const aggregateWarnings = [];

  for (const language of ['cn', 'en']) {
    const file = path.join(directory, `${language}.mdx`);
    if (!(await exists(file))) {
      aggregateWarnings.push(`缺少 ${language}.mdx。`);
      continue;
    }
    const content = await readFile(file, 'utf8');
    results[language] = validateDraftContent(id, language, content);
    aggregateErrors.push(...results[language].errors.map((message) => `${language}: ${message}`));
    aggregateWarnings.push(
      ...results[language].warnings.map((message) => `${language}: ${message}`)
    );
  }

  return {
    ok: aggregateErrors.length === 0,
    errors: aggregateErrors,
    warnings: aggregateWarnings,
    results,
  };
}

async function publishDraft(root, id) {
  const validation = await validateDraft(root, id);
  if (!validation.ok) {
    const error = new Error('Draft validation failed.');
    error.status = 422;
    error.details = validation;
    throw error;
  }

  const source = draftDirectory(root, id);
  const target = contentDirectory(root, id);
  if (await exists(target)) {
    const error = new Error('The article already exists in site content.');
    error.status = 409;
    throw error;
  }

  await mkdir(target, { recursive: true });
  try {
    for (const language of ['cn', 'en']) {
      const file = path.join(source, `${language}.mdx`);
      if (await exists(file)) await copyFile(file, path.join(target, `${language}.mdx`));
    }
    await publishTaskAssets(root, id, target);
    await runContentAudit(root);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }

  return { target: path.relative(root, target).replace(/\\/g, '/') };
}

async function runContentAudit(root) {
  const script = path.join(root, 'scripts', 'audit-content.mjs');
  if (!(await exists(script))) return;

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const error = new Error('Content audit failed; the published copy was rolled back.');
      error.status = 422;
      error.details = { errors: output.trim().split(/\r?\n/).slice(-12) };
      reject(error);
    });
  });
}

function parseDraftRoute(pathname) {
  const match = pathname.match(
    /^\/api\/drafts\/(\d{4}%2F[^/]+|\d{4}\/[^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/i
  );
  if (!match) return null;
  return { id: safeDraftId(match[1]), action: match[2] ?? '', detail: match[3] ?? '' };
}

async function serveStatic(response, publicDir, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!/^(index\.html|app\.js|publication-package\.js|styles\.css)$/.test(requested)) return false;
  const file = path.join(publicDir, requested);
  if (!(await exists(file))) return false;
  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(response);
  return true;
}

export async function createWriterServer(options = {}) {
  const root = options.root || defaultRoot;
  const publicDir = options.publicDir || defaultPublicDir;
  const sessionToken = options.sessionToken || randomBytes(32).toString('base64url');
  const afterTemporaryWrite = options.testHooks?.afterTemporaryWrite;
  await seedExampleDraft(root);
  await listDrafts(root, { initialize: true });

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (
        request.headers.host &&
        !/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(request.headers.host)
      ) {
        sendJson(response, 403, { error: 'Writer Studio is available on localhost only.' });
        return;
      }

      if (isMutatingRequest(request.method)) {
        if (!hasValidLocalOrigin(request)) {
          sendJson(response, 403, { error: 'Writer Studio rejected a cross-origin request.' });
          return;
        }
        if (request.headers['x-writer-studio-token'] !== sessionToken) {
          sendJson(response, 403, { error: 'Writer Studio session token is missing or invalid.' });
          return;
        }
      }

      if (request.method === 'GET' && url.pathname === '/api/state') {
        const ideas = await listIdeas(root);
        const ideaCounts = Object.fromEntries(listColumns().map((column) => [column.id, 0]));
        for (const idea of ideas) ideaCounts[idea.columnId] = (ideaCounts[idea.columnId] || 0) + 1;
        sendJson(response, 200, {
          sessionToken,
          columns: listColumns(),
          drafts: await listDrafts(root),
          ideaCounts,
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/ideas') {
        const columnId = url.searchParams.get('column') || '';
        const ideas = await listIdeasWithDiagnostics(root, columnId);
        sendJson(response, 200, {
          ideas: ideas.ideas,
          statuses: IDEA_STATUSES,
          invalidRecords: ideas.invalidRecords,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/ideas') {
        sendJson(response, 201, { idea: await createIdea(root, await readBody(request)) });
        return;
      }

      const ideaRoute = url.pathname.match(/^\/api\/ideas\/([a-z0-9-]+)$/i);
      if (ideaRoute && request.method === 'PATCH') {
        sendJson(response, 200, {
          idea: await updateIdea(root, ideaRoute[1].toLowerCase(), await readBody(request)),
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/drafts') {
        const input = await readBody(request);
        const column = requireColumn(String(input.columnId || DEFAULT_COLUMN_ID));
        if (!column.capabilities.drafts) {
          sendJson(response, 400, {
            error: 'This column does not have a fixed draft and publication format yet.',
          });
          return;
        }
        const year = String(input.year || '');
        const slug = String(input.slug || '');
        if (!/^\d{4}$/.test(year) || !slugPattern.test(slug)) {
          sendJson(response, 400, { error: 'Year or slug is invalid.' });
          return;
        }
        const id = `${year}/${slug}`;
        const target = draftDirectory(root, id);
        if (await exists(target)) {
          sendJson(response, 409, { error: 'Draft already exists.' });
          return;
        }
        const title = String(input.title || '').trim();
        if (!title) {
          sendJson(response, 400, { error: 'Title is required.' });
          return;
        }
        await mkdir(target, { recursive: true });
        for (const language of ['cn', 'en']) {
          await writeFile(
            path.join(target, `${language}.mdx`),
            articleTemplate({
              title,
              date: String(input.date || new Date().toISOString().slice(0, 10)),
              description: String(input.description || title),
              language,
              id,
            }),
            'utf8'
          );
        }
        await ensureTaskWorkspace(root, id, { title, columnId: column.id });
        sendJson(response, 201, { id });
        return;
      }

      const route = parseDraftRoute(url.pathname);
      if (route && request.method === 'GET' && !route.action) {
        const language = safeLanguage(url.searchParams.get('lang'));
        const file = path.join(draftDirectory(root, route.id), `${language}.mdx`);
        if (!(await exists(file))) {
          sendJson(response, 404, { error: 'Draft language does not exist.' });
          return;
        }
        const content = await readFile(file, 'utf8');
        sendJson(response, 200, {
          id: route.id,
          language,
          content,
          hash: contentHash(content),
          metadata: parseFrontmatter(content),
        });
        return;
      }

      if (route && request.method === 'PUT' && !route.action) {
        const language = safeLanguage(url.searchParams.get('lang'));
        const input = await readBody(request);
        if (typeof input.content !== 'string') {
          sendJson(response, 400, { error: 'Content must be a string.' });
          return;
        }
        if (typeof input.baseHash !== 'string') {
          sendJson(response, 428, { error: 'A base content hash is required.' });
          return;
        }
        const directory = draftDirectory(root, route.id);
        if (!(await exists(directory))) {
          sendJson(response, 404, { error: 'Draft does not exist.' });
          return;
        }
        const file = path.join(directory, `${language}.mdx`);
        const result = await serializeFileMutation(file, async () => {
          const current = await readFile(file, 'utf8');
          if (hasWriteConflict(current, input)) {
            return { conflict: true, currentHash: contentHash(current) };
          }
          return atomicWriteText(file, input.content, contentHash(current), afterTemporaryWrite);
        });
        if (result.conflict) {
          sendJson(response, 409, {
            error: 'Draft changed on disk. The browser copy was not written.',
            currentHash: result.currentHash,
          });
          return;
        }
        sendJson(response, 200, result);
        return;
      }

      if (route && request.method === 'POST' && route.action === 'validate') {
        sendJson(response, 200, await validateDraft(root, route.id));
        return;
      }

      if (route && request.method === 'POST' && route.action === 'publish') {
        sendJson(response, 201, await publishDraft(root, route.id));
        return;
      }

      if (route && request.method === 'GET' && route.action === 'workspace') {
        const workspace = await readTaskWorkspace(root, route.id);
        for (const document of Object.values(workspace.documents)) {
          document.hash = contentHash(document.content);
        }
        sendJson(response, 200, workspace);
        return;
      }

      if (route && request.method === 'PUT' && route.action === 'documents') {
        const input = await readBody(request);
        if (typeof input.content !== 'string') {
          sendJson(response, 400, { error: 'Content must be a string.' });
          return;
        }
        if (typeof input.baseHash !== 'string') {
          sendJson(response, 428, { error: 'A base content hash is required.' });
          return;
        }
        const document = TASK_DOCUMENTS[route.detail];
        if (!document) {
          sendJson(response, 400, { error: 'Invalid task document.' });
          return;
        }
        const file = path.join(draftDirectory(root, route.id), document.file);
        const result = await serializeFileMutation(file, async () => {
          const current = await readFile(file, 'utf8');
          if (hasWriteConflict(current, input)) {
            return { conflict: true, currentHash: contentHash(current) };
          }
          return atomicWriteText(file, input.content, contentHash(current), afterTemporaryWrite);
        });
        if (result.conflict) {
          sendJson(response, 409, {
            error: 'Task document changed on disk. The browser copy was not written.',
            currentHash: result.currentHash,
          });
          return;
        }
        sendJson(response, 200, result);
        return;
      }

      if (route && request.method === 'PATCH' && route.action === 'task') {
        const input = await readBody(request);
        sendJson(response, 200, { task: await updateTaskStage(root, route.id, input.stage) });
        return;
      }

      if (route && request.method === 'POST' && route.action === 'assets' && !route.detail) {
        const input = await readBody(request);
        sendJson(response, 201, { asset: await saveTaskAsset(root, route.id, input) });
        return;
      }

      if (route && request.method === 'GET' && route.action === 'assets' && route.detail) {
        const asset = await taskAssetPath(root, route.id, decodeURIComponent(route.detail));
        if (!(await exists(asset.file))) {
          sendJson(response, 404, { error: 'Image does not exist.' });
          return;
        }
        response.writeHead(200, {
          ...securityHeaders,
          'Content-Security-Policy':
            "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          'Content-Type': asset.contentType,
          'Cache-Control': 'no-store',
        });
        createReadStream(asset.file).pipe(response);
        return;
      }

      if (request.method === 'GET' && (await serveStatic(response, publicDir, url.pathname)))
        return;
      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      sendJson(response, error.status || 500, {
        error: error instanceof Error ? error.message : 'Unexpected error.',
        details: error.details,
      });
    }
  });
}

async function start() {
  const server = await createWriterServer();
  const port = Number(process.env.WRITER_PORT || 4321);
  server.listen(port, '127.0.0.1', () => {
    console.log(`Writer Studio: http://127.0.0.1:${port}`);
    console.log('Drafts and ideas stay local under .drafts/. Press Ctrl+C to stop.');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await start();
}
