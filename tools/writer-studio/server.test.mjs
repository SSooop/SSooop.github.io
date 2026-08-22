import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { buildPublicationPackage } from './public/publication-package.js';
import { createWriterServer, seedExampleDraft } from './server.mjs';

const temporaryRoots = [];
const sessionTokens = new Map();

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'writer-studio-'));
  temporaryRoots.push(root);
  const article = path.join(root, 'src', 'content', 'blog', '2026', 'latest-article');
  await mkdir(article, { recursive: true });
  const content = `---\ntitle: "原样示例"\ndate: 2026-03-01\ndescription: "示例"\nlang: "zh"\ntranslationKey: "2026/latest-article"\ntranslations:\n  zh: "2026/latest-article/cn"\ncanonical:\n  url: "/zh/blog/2026/latest-article/cn"\n  role: "version_home"\npublications:\n  - platform: "site"\n    mode: "full_text"\n    status: "published"\n---\n\n正文保持不变。\n`;
  await writeFile(path.join(article, 'cn.mdx'), content, 'utf8');
  return { root, content };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function requestWithHost(base, pathname, host) {
  const url = new URL(pathname, base);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Host: host },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      }
    );
    request.on('error', reject);
    request.end();
  });
}

async function writerFetch(base, pathname, options = {}) {
  const method = options.method || 'GET';
  let token = sessionTokens.get(base);
  if (method !== 'GET' && !token) {
    const state = await fetch(`${base}/api/state`);
    token = (await state.json()).sessionToken;
    sessionTokens.set(base, token);
  }
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(method === 'GET' ? {} : { 'X-Writer-Studio-Token': token }),
    },
  });
  if (method === 'GET' && pathname === '/api/state' && response.ok) {
    const payload = await response.clone().json();
    sessionTokens.set(base, payload.sessionToken);
  }
  return response;
}

afterEach(async () => {
  sessionTokens.clear();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

test('seeds the newest article without changing its bytes', async () => {
  const { root, content } = await fixture();
  const id = await seedExampleDraft(root);
  assert.equal(id, '2026/latest-article');
  assert.equal(
    await readFile(path.join(root, '.drafts', 'blog', '2026', 'latest-article', 'cn.mdx'), 'utf8'),
    content
  );
});

test('lists, reads, edits, and validates a local draft', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const stateResponse = await writerFetch(base, '/api/state');
  const state = await stateResponse.json();
  assert.equal(state.drafts[0].id, '2026/latest-article');
  assert.equal(state.columns.length, 3);
  assert.equal(state.drafts[0].columnId, 'intellipharma');

  const encodedId = encodeURIComponent('2026/latest-article');
  const draftResponse = await writerFetch(base, `/api/drafts/${encodedId}?lang=cn`);
  const draft = await draftResponse.json();
  assert.match(draft.content, /正文保持不变/);

  const updated = draft.content.replace('正文保持不变。', 'Codex 协作后的正文。');
  const saveResponse = await writerFetch(base, `/api/drafts/${encodedId}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: updated, baseHash: draft.hash }),
  });
  assert.equal(saveResponse.status, 200);
  const saved = await saveResponse.json();

  const draftFile = path.join(root, '.drafts', 'blog', '2026', 'latest-article', 'cn.mdx');
  const externalVersion = updated.replace('Codex 协作后的正文。', '外部编辑器写入的正文。');
  await writeFile(draftFile, externalVersion, 'utf8');
  const conflictedResponse = await writerFetch(base, `/api/drafts/${encodedId}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: updated.replace('Codex 协作后的正文。', '浏览器继续写入的正文。'),
      baseHash: saved.hash,
    }),
  });
  assert.equal(conflictedResponse.status, 409);
  const conflict = await conflictedResponse.json();
  assert.equal(await readFile(draftFile, 'utf8'), externalVersion);

  const resolvedResponse = await writerFetch(base, `/api/drafts/${encodedId}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: updated, baseHash: conflict.currentHash }),
  });
  assert.equal(resolvedResponse.status, 200);

  const validationResponse = await writerFetch(base, `/api/drafts/${encodedId}/validate`, {
    method: 'POST',
  });
  const validation = await validationResponse.json();
  assert.equal(validation.ok, true);
});

test('serializes concurrent article and task-document saves against the same base hash', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  const id = encodeURIComponent('2026/latest-article');
  const draft = await (await writerFetch(base, `/api/drafts/${id}?lang=cn`)).json();
  const workspace = await (await writerFetch(base, `/api/drafts/${id}/workspace`)).json();
  const directory = path.join(root, '.drafts', 'blog', '2026', 'latest-article');
  const cases = [
    {
      label: 'article',
      pathname: `/api/drafts/${id}?lang=cn`,
      baseHash: draft.hash,
      file: path.join(directory, 'cn.mdx'),
      contents: [
        draft.content.replace('正文保持不变。', '并发保存版本 A。'),
        draft.content.replace('正文保持不变。', '并发保存版本 B。'),
      ],
    },
    {
      label: 'task document',
      pathname: `/api/drafts/${id}/documents/outline`,
      baseHash: workspace.documents.outline.hash,
      file: path.join(directory, 'outline.md'),
      contents: ['# 文章大纲\n\n并发保存版本 A。\n', '# 文章大纲\n\n并发保存版本 B。\n'],
    },
  ];

  for (const saveCase of cases) {
    const attempts = await Promise.all(
      saveCase.contents.map(async (content) => {
        const response = await writerFetch(base, saveCase.pathname, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, baseHash: saveCase.baseHash }),
        });
        return { content, status: response.status, payload: await response.json() };
      })
    );

    assert.deepEqual(
      attempts.map((attempt) => attempt.status).sort((left, right) => left - right),
      [200, 409],
      saveCase.label
    );
    const winner = attempts.find((attempt) => attempt.status === 200);
    const conflict = attempts.find((attempt) => attempt.status === 409);
    assert.equal(await readFile(saveCase.file, 'utf8'), winner.content, saveCase.label);
    assert.equal(conflict.payload.currentHash, winner.payload.hash, saveCase.label);
  }
});

test('preserves external writes that land after the temporary save and before replacement', async (context) => {
  const { root } = await fixture();
  const directory = path.join(root, '.drafts', 'blog', '2026', 'latest-article');
  const externalWrites = new Map();
  const server = await createWriterServer({
    root,
    testHooks: {
      async afterTemporaryWrite({ target }) {
        if (!externalWrites.has(target)) return;
        const content = externalWrites.get(target);
        externalWrites.delete(target);
        await writeFile(target, content, 'utf8');
      },
    },
  });
  context.after(() => server.close());
  const base = await listen(server);
  const id = encodeURIComponent('2026/latest-article');
  const draft = await (await writerFetch(base, `/api/drafts/${id}?lang=cn`)).json();
  const workspace = await (await writerFetch(base, `/api/drafts/${id}/workspace`)).json();
  const cases = [
    {
      label: 'article',
      pathname: `/api/drafts/${id}?lang=cn`,
      baseHash: draft.hash,
      file: path.join(directory, 'cn.mdx'),
      browserContent: draft.content.replace('正文保持不变。', '浏览器保存版本。'),
      externalContent: draft.content.replace('正文保持不变。', '外部编辑器最后写入。'),
    },
    {
      label: 'task document',
      pathname: `/api/drafts/${id}/documents/outline`,
      baseHash: workspace.documents.outline.hash,
      file: path.join(directory, 'outline.md'),
      browserContent: '# 文章大纲\n\n浏览器保存版本。\n',
      externalContent: '# 文章大纲\n\n外部编辑器最后写入。\n',
    },
  ];

  for (const saveCase of cases) {
    externalWrites.set(saveCase.file, saveCase.externalContent);
    const response = await writerFetch(base, saveCase.pathname, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: saveCase.browserContent,
        baseHash: saveCase.baseHash,
      }),
    });
    const conflict = await response.json();

    assert.equal(response.status, 409, saveCase.label);
    assert.equal(typeof conflict.currentHash, 'string', saveCase.label);
    assert.equal(await readFile(saveCase.file, 'utf8'), saveCase.externalContent, saveCase.label);
    assert.equal(
      (await readdir(directory)).some(
        (entry) => entry.startsWith(`${path.basename(saveCase.file)}.`) && entry.endsWith('.tmp')
      ),
      false,
      saveCase.label
    );
  }
});

test('rejects non-local host headers and invalid draft paths', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  assert.equal(await requestWithHost(base, '/api/state', 'writer.example.com'), 403);

  const invalid = await writerFetch(
    base,
    `/api/drafts/${encodeURIComponent('../secrets')}?lang=cn`
  );
  assert.equal(invalid.status, 404);
});

test('serves the publication package module with the local security headers', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const response = await writerFetch(base, '/publication-package.js');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/javascript/);
  assert.match(await response.text(), /buildPublicationPackage/);
});

test('builds conservative rich and social packages without leaking MDX code', () => {
  const source = `---
title: '发布包示例'
date: 2026-08-02
description: '一段适合作为平台导语的摘要。'
lang: 'zh'
canonical:
  url: '/zh/blog/2026/package-example/cn'
image: ./images/cover.png
imageAlt: '封面说明'
---

import ArticleImage from '../../../../components/blog/ArticleImage.astro';
import chart from './images/chart.svg';

export const rows = [
  { label: '不应泄漏' },
];

# 发布包示例

## 核心判断

这是一段带有 **重点** 和 [站内链接](/zh/blog/2026/other/cn) 的正文。

![提前出现的 Markdown 图片](./images/inline.png)

<ArticleImage
  src={chart}
  alt="图表替代文本"
  caption="图表说明"
  source="作者"
  sourceUrl="https://example.com/source"
/>

$$
x = y + 1
$$
`;
  const rich = buildPublicationPackage({
    source,
    platformId: 'wechat',
    articleId: '2026/package-example',
    language: 'cn',
    published: true,
  });
  assert.equal(rich.metadata.title, '发布包示例');
  assert.equal(rich.assets.length, 3);
  assert.deepEqual(
    rich.assets.map((asset) => [asset.fileName, asset.index]),
    [
      ['cover.png', 0],
      ['inline.png', 1],
      ['chart.svg', 2],
    ]
  );
  assert.match(rich.richHtml, /https:\/\/ssooop\.github\.io\/zh\/blog\/2026\/other\/cn/);
  assert.match(rich.richHtml, /图表说明/);
  assert.match(rich.richHtml, /https:\/\/example\.com\/source/);
  assert.doesNotMatch(rich.richHtml, /export const|不应泄漏|<h2[^>]*>发布包示例/);
  assert.ok(rich.warnings.some((warning) => warning.includes('公式')));

  const social = buildPublicationPackage({
    source,
    platformId: 'x-post',
    articleId: '2026/package-example',
    language: 'cn',
    published: true,
  });
  assert.equal(social.richHtml, '');
  assert.ok(Array.from(social.plainText).length <= 260);
  assert.match(social.plainText, /https:\/\/ssooop\.github\.io/);
});

test('preserves fenced examples and parses rich-image edge cases', () => {
  const source = `---
title: 'Parser edge cases'
date: 2026-08-02
description: 'Parser regression coverage.'
lang: 'en'
canonical:
  url: '/en/blog/2026/parser-edge-cases/en'
---

import ArticleImage from '../../../../components/blog/ArticleImage.astro';
import diagram from './images/diagram.webp';

# Parser edge cases

\`\`\`mdx
import hidden from './images/inside.gif';
export const example = [{ label: 'keep me' }];
<ArticleImage src={hidden} alt="Keep this example" />
<div>Keep this HTML example</div>
\`\`\`

<ArticleImage
  src={diagram}
  alt="James Watt's working engine"
  caption="Watt's diagram"
/>

<Callout>Keep this important callout body.</Callout>

Inline syntax example: \`![Not an asset](./images/not-an-asset.png)\`.

Inline component example: \`<ArticleImage src={diagram} alt="Not a component asset" />\`.

Before ![Animated chart](./images/chart(1).gif "Motion over time") after.
`;
  const result = buildPublicationPackage({
    source,
    platformId: 'linkedin-article',
    articleId: '2026/parser-edge-cases',
    language: 'en',
    published: true,
  });

  assert.match(result.richHtml, /import hidden/);
  assert.match(result.richHtml, /export const example/);
  assert.match(result.richHtml, /Keep this HTML example/);
  assert.match(result.richHtml, /Keep this important callout body/);
  assert.match(result.richHtml, /Not an asset/);
  assert.match(result.richHtml, /Not a component asset/);
  assert.deepEqual(
    result.assets.map((asset) => [asset.fileName, asset.alt, asset.caption]),
    [
      ['diagram.webp', "James Watt's working engine", "Watt's diagram"],
      ['chart(1).gif', 'Animated chart', 'Motion over time'],
    ]
  );
  assert.ok(result.warnings.some((warning) => warning.includes('行内 Markdown 图片')));
  assert.ok(result.warnings.some((warning) => warning.includes('动画效果将丢失')));
  assert.ok(result.warnings.some((warning) => warning.includes('Callout')));

  const xArticle = buildPublicationPackage({
    source,
    platformId: 'x-article',
    articleId: '2026/parser-edge-cases',
    language: 'en',
    published: true,
  });
  assert.equal(xArticle.platform.format, 'rich');
  assert.equal(xArticle.platform.editorUrl, 'https://x.com/compose/articles');
  assert.match(xArticle.richHtml, /Watt&#039;s diagram/);
});

test('falls back to trusted site images, including SVG, for a seeded published draft', async (context) => {
  const { root } = await fixture();
  const images = path.join(root, 'src', 'content', 'blog', '2026', 'latest-article', 'images');
  await mkdir(images, { recursive: true });
  await writeFile(
    path.join(images, 'Ontology_Simple.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    'utf8'
  );

  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  const id = encodeURIComponent('2026/latest-article');
  const workspace = await (await writerFetch(base, `/api/drafts/${id}/workspace`)).json();
  assert.deepEqual(
    workspace.assets.map((asset) => [asset.name, asset.origin]),
    [['Ontology_Simple.svg', 'site']]
  );

  const response = await writerFetch(base, `/api/drafts/${id}/assets/Ontology_Simple.svg`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/svg+xml');
  assert.match(response.headers.get('content-security-policy'), /sandbox/);
});

test('rejects normalized image-name collisions without changing the first upload', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  const id = encodeURIComponent('2026/latest-article');
  const firstBytes = Buffer.from('first image');

  const first = await writerFetch(base, `/api/drafts/${id}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '中文 图片.PNG', base64: firstBytes.toString('base64') }),
  });
  assert.equal(first.status, 201);
  assert.equal((await first.json()).asset.name, '中文-图片.png');

  const collision = await writerFetch(base, `/api/drafts/${id}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '中文　图片.png',
      base64: Buffer.from('second image').toString('base64'),
    }),
  });
  assert.equal(collision.status, 409);
  assert.deepEqual(
    await readFile(
      path.join(root, '.drafts', 'blog', '2026', 'latest-article', 'images', '中文-图片.png')
    ),
    firstBytes
  );
});

test('preserves malformed task metadata when the server initializes workspaces', async (context) => {
  const { root, content } = await fixture();
  const directory = path.join(root, '.drafts', 'blog', '2026', 'broken-task');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'cn.mdx'), content, 'utf8');
  const malformed = '{"stage":"draft",\n';
  await writeFile(path.join(directory, 'task.json'), malformed, 'utf8');

  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  const state = await (await writerFetch(base, '/api/state')).json();
  const id = encodeURIComponent('2026/broken-task');
  const workspace = await (await writerFetch(base, `/api/drafts/${id}/workspace`)).json();

  assert.equal(await readFile(path.join(directory, 'task.json'), 'utf8'), malformed);
  assert.equal(state.drafts.find((draft) => draft.id === '2026/broken-task').stage, 'ideation');
  assert.equal(workspace.taskMetadata.status, 'malformed');
  assert.equal(workspace.taskMetadata.diagnostic.code, 'MALFORMED_TASK_METADATA');

  const stageUpdate = await writerFetch(base, `/api/drafts/${id}/task`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'draft' }),
  });
  assert.equal(stageUpdate.status, 422);
  assert.equal((await stageUpdate.json()).details.code, 'MALFORMED_TASK_METADATA');
  assert.equal(await readFile(path.join(directory, 'task.json'), 'utf8'), malformed);
});

test('detects task-document conflicts and requires an explicit new base hash', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  const id = encodeURIComponent('2026/latest-article');
  const workspace = await (await writerFetch(base, `/api/drafts/${id}/workspace`)).json();
  const outlineFile = path.join(root, '.drafts', 'blog', '2026', 'latest-article', 'outline.md');
  const externalVersion = '# 文章大纲\n\n外部编辑器版本。\n';
  await writeFile(outlineFile, externalVersion, 'utf8');

  const conflictResponse = await writerFetch(base, `/api/drafts/${id}/documents/outline`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '# 文章大纲\n\n浏览器版本。\n',
      baseHash: workspace.documents.outline.hash,
    }),
  });
  assert.equal(conflictResponse.status, 409);
  const conflict = await conflictResponse.json();
  assert.equal(await readFile(outlineFile, 'utf8'), externalVersion);

  const resolved = await writerFetch(base, `/api/drafts/${id}/documents/outline`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '# 文章大纲\n\n浏览器版本。\n',
      baseHash: conflict.currentHash,
    }),
  });
  assert.equal(resolved.status, 200);
});

test('protects mutations with a session token and same-origin check', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  const state = await (await writerFetch(base, '/api/state')).json();

  const missingToken = await fetch(`${base}/api/ideas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columnId: 'economics-after-ai', body: '未授权写入' }),
  });
  assert.equal(missingToken.status, 403);

  const crossOrigin = await fetch(`${base}/api/ideas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://example.com',
      'X-Writer-Studio-Token': state.sessionToken,
    },
    body: JSON.stringify({ columnId: 'economics-after-ai', body: '跨站写入' }),
  });
  assert.equal(crossOrigin.status, 403);

  const taskFile = path.join(root, '.drafts', 'blog', '2026', 'latest-article', 'task.json');
  await writeFile(taskFile, '{ deliberately invalid task metadata\n', 'utf8');
  const stateRead = await writerFetch(base, '/api/state');
  assert.equal(stateRead.status, 200);
  assert.equal(await readFile(taskFile, 'utf8'), '{ deliberately invalid task metadata\n');
});

test('captures, filters, and develops private ideas across columns', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const createdResponse = await writerFetch(base, '/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      columnId: 'economics-after-ai',
      title: '增长循环',
      body: 'AI 生产率怎样重新进入社会再生产？',
      tags: '增长, 待验证',
      sourceUrl: 'https://example.com/source',
      targetDate: '2026-08-18',
    }),
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).idea;
  assert.equal(created.status, 'inbox');
  assert.deepEqual(created.tags, ['增长', '待验证']);

  const listed = await (await writerFetch(base, '/api/ideas?column=economics-after-ai')).json();
  assert.equal(listed.ideas.length, 1);
  assert.equal(listed.statuses.length, 5);

  const updatedResponse = await writerFetch(base, `/api/ideas/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'developing', body: `${created.body}\n补充一条连接。` }),
  });
  const updated = (await updatedResponse.json()).idea;
  assert.equal(updated.status, 'developing');
  assert.match(updated.body, /补充一条连接/);
  assert.match(
    await readFile(
      path.join(root, '.drafts', 'ideas', 'economics-after-ai', `${created.id}.json`),
      'utf8'
    ),
    /增长循环/
  );

  const [bodyUpdate, statusUpdate] = await Promise.all([
    writerFetch(base, `/api/ideas/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: `${updated.body}\n并发补充正文。` }),
    }),
    writerFetch(base, `/api/ideas/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    }),
  ]);
  assert.equal(bodyUpdate.status, 200);
  assert.equal(statusUpdate.status, 200);
  const afterConcurrentUpdates = await (
    await writerFetch(base, '/api/ideas?column=economics-after-ai')
  ).json();
  assert.equal(afterConcurrentUpdates.ideas[0].status, 'planned');
  assert.match(afterConcurrentUpdates.ideas[0].body, /并发补充正文/);
  assert.equal(afterConcurrentUpdates.ideas[0].revision, 4);
});

test('surfaces malformed idea records without disabling the inbox', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  const id = '20260802t000000-deadbeef';
  const directory = path.join(root, '.drafts', 'ideas', 'economics-after-ai');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.json`), '{}\n', 'utf8');

  const response = await writerFetch(base, '/api/ideas?column=economics-after-ai');
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.ideas, []);
  assert.equal(payload.invalidRecords.length, 1);
  assert.equal(payload.invalidRecords[0].id, id);
  assert.equal((await writerFetch(base, '/api/state')).status, 200);

  const updateResponse = await writerFetch(base, `/api/ideas/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'archived' }),
  });
  assert.equal(updateResponse.status, 422);
});

test('does not force book and research columns into the blog article adapter', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const response = await writerFetch(base, '/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      columnId: 'economics-after-ai',
      title: '不应成为博客',
      year: '2026',
      date: '2026-08-02',
      slug: 'not-a-blog',
    }),
  });
  assert.equal(response.status, 400);
  await assert.rejects(
    readFile(path.join(root, '.drafts', 'blog', '2026', 'not-a-blog', 'cn.mdx'))
  );
});

test('deletes a local draft and keeps unknown deletions harmless', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const missingToken = await fetch(
    `${base}/api/drafts/${encodeURIComponent('2026/latest-article')}`,
    {
      method: 'DELETE',
    }
  );
  assert.equal(missingToken.status, 403);

  const id = encodeURIComponent('2026/latest-article');
  const directory = path.join(root, '.drafts', 'blog', '2026', 'latest-article');
  const before = await writerFetch(base, `/api/drafts/${id}?lang=cn`);
  assert.equal(before.status, 200);
  assert.equal((await readdir(directory)).length > 0, true);

  const deleteResponse = await writerFetch(base, `/api/drafts/${id}`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await deleteResponse.json(), { id: '2026/latest-article' });

  const after = await writerFetch(base, `/api/drafts/${id}?lang=cn`);
  assert.equal(after.status, 404);
  await assert.rejects(() => readdir(directory), /ENOENT/);

  const unknown = await writerFetch(base, `/api/drafts/${encodeURIComponent('2026/not-a-draft')}`, {
    method: 'DELETE',
  });
  assert.equal(unknown.status, 404);
});

test('creates a bilingual draft and publishes it without overwriting content', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const createResponse = await writerFetch(base, '/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '双语草稿',
      description: '本地写作示例',
      date: '2026-07-11',
      year: '2026',
      slug: 'bilingual-draft',
    }),
  });
  assert.equal(createResponse.status, 201);

  const id = encodeURIComponent('2026/bilingual-draft');
  const stateResponse = await writerFetch(base, '/api/state');
  const state = await stateResponse.json();
  const created = state.drafts.find((draft) => draft.id === '2026/bilingual-draft');
  assert.deepEqual(created.languages, ['cn', 'en']);

  const workspaceResponse = await writerFetch(base, `/api/drafts/${id}/workspace`);
  const workspace = await workspaceResponse.json();
  assert.equal(workspace.task.stage, 'ideation');
  assert.equal(workspace.task.schemaVersion, 2);
  assert.equal(workspace.task.columnId, 'intellipharma');
  assert.match(workspace.documents.references.content, /构思与研究记录/);
  assert.match(workspace.documents.style.content, /本篇风格指南/);
  assert.equal(workspace.skills.draft.command, '$draft-from-outline 2026/bilingual-draft');
  assert.equal('prompt' in workspace, false);
  assert.equal('brief' in workspace.documents, false);
  assert.equal('images' in workspace.documents, false);

  const referencesResponse = await writerFetch(base, `/api/drafts/${id}/documents/references`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '# 构思与研究记录\n\n- URL: https://example.com\n',
      baseHash: workspace.documents.references.hash,
    }),
  });
  assert.equal(referencesResponse.status, 200);

  const styleResponse = await writerFetch(base, `/api/drafts/${id}/documents/style`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '# 本篇风格指南\n\n克制、连续行文。\n',
      baseHash: workspace.documents.style.hash,
    }),
  });
  assert.equal(styleResponse.status, 200);
  const refreshedWorkspace = await (await writerFetch(base, `/api/drafts/${id}/workspace`)).json();
  assert.match(refreshedWorkspace.documents.style.content, /克制、连续行文/);

  const stageResponse = await writerFetch(base, `/api/drafts/${id}/task`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'outline' }),
  });
  const stage = await stageResponse.json();
  assert.equal(stage.task.stage, 'outline');

  const imageResponse = await writerFetch(base, `/api/drafts/${id}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'inline-01.png',
      base64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    }),
  });
  assert.equal(imageResponse.status, 201);

  const servedImage = await writerFetch(base, `/api/drafts/${id}/assets/inline-01.png`);
  assert.equal(servedImage.headers.get('content-type'), 'image/png');

  const publishResponse = await writerFetch(base, `/api/drafts/${id}/publish`, {
    method: 'POST',
  });
  assert.equal(publishResponse.status, 201);
  assert.equal(
    await readFile(
      path.join(root, 'src', 'content', 'blog', '2026', 'bilingual-draft', 'cn.mdx'),
      'utf8'
    ),
    await readFile(path.join(root, '.drafts', 'blog', '2026', 'bilingual-draft', 'cn.mdx'), 'utf8')
  );
  assert.equal(
    (
      await readFile(
        path.join(
          root,
          'src',
          'content',
          'blog',
          '2026',
          'bilingual-draft',
          'images',
          'inline-01.png'
        )
      )
    ).length > 0,
    true
  );

  const secondPublish = await writerFetch(base, `/api/drafts/${id}/publish`, { method: 'POST' });
  assert.equal(secondPublish.status, 409);
});

test('migrates legacy stages and notes without deleting old task files', async (context) => {
  const { root, content } = await fixture();
  const directory = path.join(root, '.drafts', 'blog', '2026', 'legacy-workflow');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'cn.mdx'), content, 'utf8');
  await writeFile(
    path.join(directory, 'task.json'),
    `${JSON.stringify({ id: '2026/legacy-workflow', title: '旧工作流', stage: 'research' })}\n`,
    'utf8'
  );
  const legacyBrief = '# 文章简报\n\n## 核心命题\n\n保留这条作者判断。\n';
  const legacyResearch = '# 研究资料\n\n## 来源与摘记\n\nhttps://example.com/source\n';
  const legacyImages = '# 图片计划\n\n不要删除这份旧计划。\n';
  await writeFile(path.join(directory, 'brief.md'), legacyBrief, 'utf8');
  await writeFile(path.join(directory, 'research.md'), legacyResearch, 'utf8');
  await writeFile(path.join(directory, 'image-plan.md'), legacyImages, 'utf8');

  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);
  await writerFetch(base, '/api/state');

  const workspaceResponse = await writerFetch(
    base,
    `/api/drafts/${encodeURIComponent('2026/legacy-workflow')}/workspace`
  );
  const workspace = await workspaceResponse.json();
  assert.equal(workspace.task.stage, 'ideation');
  assert.match(workspace.documents.references.content, /保留这条作者判断/);
  assert.match(workspace.documents.references.content, /https:\/\/example.com\/source/);
  assert.match(workspace.documents.style.content, /本篇风格指南/);
  assert.equal(await readFile(path.join(directory, 'brief.md'), 'utf8'), legacyBrief);
  assert.equal(await readFile(path.join(directory, 'research.md'), 'utf8'), legacyResearch);
  assert.equal(await readFile(path.join(directory, 'image-plan.md'), 'utf8'), legacyImages);
});

test('rolls back the site copy when the repository content audit fails', async (context) => {
  const { root } = await fixture();
  const scripts = path.join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(path.join(scripts, 'audit-content.mjs'), 'process.exit(1);\n', 'utf8');
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  await writerFetch(base, '/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '回滚草稿',
      description: '审计失败时不留下正式文章',
      date: '2026-07-11',
      year: '2026',
      slug: 'rollback-draft',
    }),
  });

  const id = encodeURIComponent('2026/rollback-draft');
  const publishResponse = await writerFetch(base, `/api/drafts/${id}/publish`, {
    method: 'POST',
  });
  assert.equal(publishResponse.status, 422);
  await assert.rejects(
    readFile(path.join(root, 'src', 'content', 'blog', '2026', 'rollback-draft', 'cn.mdx'))
  );
});

test('lists, reads, edits, and validates a published site article directly', async (context) => {
  const { root, content } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const listResponse = await writerFetch(base, '/api/site-articles');
  const list = await listResponse.json();
  assert.equal(list.articles.length, 1);
  assert.equal(list.articles[0].id, '2026/latest-article');
  assert.deepEqual(list.articles[0].languages, ['cn']);
  assert.equal(list.articles[0].hasDraft, true);

  const id = encodeURIComponent('2026/latest-article');
  const articleResponse = await writerFetch(base, `/api/site-articles/${id}?lang=cn`);
  const article = await articleResponse.json();
  assert.equal(article.content, content);
  assert.deepEqual(article.assets, []);

  const updated = content.replace('正文保持不变。', '直接修订正式版本。');
  const saveResponse = await writerFetch(base, `/api/site-articles/${id}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: updated, baseHash: article.hash }),
  });
  assert.equal(saveResponse.status, 200);
  assert.equal(
    await readFile(
      path.join(root, 'src', 'content', 'blog', '2026', 'latest-article', 'cn.mdx'),
      'utf8'
    ),
    updated
  );
  assert.equal(
    await readFile(path.join(root, '.drafts', 'blog', '2026', 'latest-article', 'cn.mdx'), 'utf8'),
    content
  );

  const staleResponse = await writerFetch(base, `/api/site-articles/${id}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: updated.replace('直接修订正式版本。', '基于过期版本的修改。'),
      baseHash: article.hash,
    }),
  });
  assert.equal(staleResponse.status, 409);

  const validationResponse = await writerFetch(base, `/api/site-articles/${id}/validate`, {
    method: 'POST',
  });
  const validation = await validationResponse.json();
  assert.equal(validation.ok, true);
});

test('prefills a missing site language, creates it on save, and surfaces sibling audit follow-ups', async (context) => {
  const { root } = await fixture();
  const scripts = path.join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(
    path.join(scripts, 'audit-content.mjs'),
    [
      "console.log('Audited 1 content files across 1 translation groups.');",
      "console.log('\\nErrors (1):');",
      'console.log(\'  - src/content/blog/2026/latest-article/cn.mdx: translations.en should be "2026/latest-article/en"\');',
      'process.exit(1);',
      '',
    ].join('\n'),
    'utf8'
  );
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const id = encodeURIComponent('2026/latest-article');
  const templateResponse = await writerFetch(base, `/api/site-articles/${id}?lang=en`);
  const template = await templateResponse.json();
  assert.equal(template.missing, true);
  assert.match(template.content, /lang: "en"/);
  assert.match(template.content, /\/en\/blog\/2026\/latest-article\/en/);

  const english = template.content.replace('正文保持不变。', 'The direct English edition.');
  const createResponse = await writerFetch(base, `/api/site-articles/${id}?lang=en`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: english, baseHash: template.hash }),
  });
  assert.equal(createResponse.status, 200);
  const created = await createResponse.json();
  assert.equal(created.languageCreated, true);
  assert.ok(created.siblingAuditErrors.length === 1);
  assert.match(created.siblingAuditErrors[0], /translations\.en/);
  assert.equal(
    await readFile(
      path.join(root, 'src', 'content', 'blog', '2026', 'latest-article', 'en.mdx'),
      'utf8'
    ),
    english
  );
});

test('rolls back a site-article save when the saved file itself fails the audit', async (context) => {
  const { root, content } = await fixture();
  const scripts = path.join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(
    path.join(scripts, 'audit-content.mjs'),
    [
      "console.log('Audited 1 content files across 1 translation groups.');",
      "console.log('\\nErrors (1):');",
      "console.log('  - src/content/blog/2026/latest-article/cn.mdx: stub audit rejection');",
      'process.exit(1);',
      '',
    ].join('\n'),
    'utf8'
  );
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const id = encodeURIComponent('2026/latest-article');
  const article = await (await writerFetch(base, `/api/site-articles/${id}?lang=cn`)).json();
  const rejected = await writerFetch(base, `/api/site-articles/${id}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: article.content.replace('正文保持不变。', '不应落盘的修改。'),
      baseHash: article.hash,
    }),
  });
  assert.equal(rejected.status, 422);
  const details = await rejected.json();
  assert.match(details.details.errors[0], /stub audit rejection/);
  assert.equal(
    await readFile(
      path.join(root, 'src', 'content', 'blog', '2026', 'latest-article', 'cn.mdx'),
      'utf8'
    ),
    content
  );
});

test('rejects site saves that break article structure and unknown articles', async (context) => {
  const { root, content } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const id = encodeURIComponent('2026/latest-article');
  const article = await (await writerFetch(base, `/api/site-articles/${id}?lang=cn`)).json();
  const broken = await writerFetch(base, `/api/site-articles/${id}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '# 只有正文，没有 frontmatter\n', baseHash: article.hash }),
  });
  assert.equal(broken.status, 422);
  assert.equal(
    await readFile(
      path.join(root, 'src', 'content', 'blog', '2026', 'latest-article', 'cn.mdx'),
      'utf8'
    ),
    content
  );

  const missing = await writerFetch(
    base,
    `/api/site-articles/${encodeURIComponent('2026/missing')}/validate`,
    {
      method: 'POST',
    }
  );
  assert.equal(missing.status, 404);
});

test('serves and stores site article images inside the published directory', async (context) => {
  const { root } = await fixture();
  const images = path.join(root, 'src', 'content', 'blog', '2026', 'latest-article', 'images');
  await mkdir(images, { recursive: true });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  await writeFile(path.join(images, 'cover.png'), png);

  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const id = encodeURIComponent('2026/latest-article');
  const article = await (await writerFetch(base, `/api/site-articles/${id}?lang=cn`)).json();
  assert.deepEqual(article.assets, ['cover.png']);

  const imageResponse = await writerFetch(base, `/api/site-articles/${id}/assets/cover.png`);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/png');

  const uploadResponse = await writerFetch(base, `/api/site-articles/${id}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'figure.png', base64: png.toString('base64') }),
  });
  assert.equal(uploadResponse.status, 201);
  assert.equal(png.equals(await readFile(path.join(images, 'figure.png'))), true);
  assert.equal(
    (await readdir(path.join(root, '.drafts', 'blog', '2026', 'latest-article'))).length > 0,
    true
  );
});
