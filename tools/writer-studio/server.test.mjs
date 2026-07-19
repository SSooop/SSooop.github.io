import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { createWriterServer, seedExampleDraft } from './server.mjs';

const temporaryRoots = [];

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

afterEach(async () => {
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

  const stateResponse = await fetch(`${base}/api/state`);
  const state = await stateResponse.json();
  assert.equal(state.drafts[0].id, '2026/latest-article');

  const encodedId = encodeURIComponent('2026/latest-article');
  const draftResponse = await fetch(`${base}/api/drafts/${encodedId}?lang=cn`);
  const draft = await draftResponse.json();
  assert.match(draft.content, /正文保持不变/);

  const updated = draft.content.replace('正文保持不变。', 'Codex 协作后的正文。');
  const saveResponse = await fetch(`${base}/api/drafts/${encodedId}?lang=cn`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: updated }),
  });
  assert.equal(saveResponse.status, 200);

  const validationResponse = await fetch(`${base}/api/drafts/${encodedId}/validate`, {
    method: 'POST',
  });
  const validation = await validationResponse.json();
  assert.equal(validation.ok, true);
});

test('rejects non-local host headers and invalid draft paths', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  assert.equal(await requestWithHost(base, '/api/state', 'writer.example.com'), 403);

  const invalid = await fetch(`${base}/api/drafts/${encodeURIComponent('../secrets')}?lang=cn`);
  assert.equal(invalid.status, 404);
});

test('creates a bilingual draft and publishes it without overwriting content', async (context) => {
  const { root } = await fixture();
  const server = await createWriterServer({ root });
  context.after(() => server.close());
  const base = await listen(server);

  const createResponse = await fetch(`${base}/api/drafts`, {
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
  const stateResponse = await fetch(`${base}/api/state`);
  const state = await stateResponse.json();
  const created = state.drafts.find((draft) => draft.id === '2026/bilingual-draft');
  assert.deepEqual(created.languages, ['cn', 'en']);

  const workspaceResponse = await fetch(`${base}/api/drafts/${id}/workspace`);
  const workspace = await workspaceResponse.json();
  assert.equal(workspace.task.stage, 'ideation');
  assert.match(workspace.documents.references.content, /构思与研究记录/);
  assert.match(workspace.documents.style.content, /本篇风格指南/);
  assert.equal(workspace.skills.draft.command, '$draft-from-outline 2026/bilingual-draft');
  assert.equal('prompt' in workspace, false);
  assert.equal('brief' in workspace.documents, false);
  assert.equal('images' in workspace.documents, false);

  const referencesResponse = await fetch(`${base}/api/drafts/${id}/documents/references`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '# 构思与研究记录\n\n- URL: https://example.com\n' }),
  });
  assert.equal(referencesResponse.status, 200);

  const styleResponse = await fetch(`${base}/api/drafts/${id}/documents/style`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '# 本篇风格指南\n\n克制、连续行文。\n' }),
  });
  assert.equal(styleResponse.status, 200);
  const refreshedWorkspace = await (await fetch(`${base}/api/drafts/${id}/workspace`)).json();
  assert.match(refreshedWorkspace.documents.style.content, /克制、连续行文/);

  const stageResponse = await fetch(`${base}/api/drafts/${id}/task`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'outline' }),
  });
  const stage = await stageResponse.json();
  assert.equal(stage.task.stage, 'outline');

  const imageResponse = await fetch(`${base}/api/drafts/${id}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'inline-01.png',
      base64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    }),
  });
  assert.equal(imageResponse.status, 201);

  const servedImage = await fetch(`${base}/api/drafts/${id}/assets/inline-01.png`);
  assert.equal(servedImage.headers.get('content-type'), 'image/png');

  const publishResponse = await fetch(`${base}/api/drafts/${id}/publish`, { method: 'POST' });
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

  const secondPublish = await fetch(`${base}/api/drafts/${id}/publish`, { method: 'POST' });
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
  await fetch(`${base}/api/state`);

  const workspaceResponse = await fetch(
    `${base}/api/drafts/${encodeURIComponent('2026/legacy-workflow')}/workspace`
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

  await fetch(`${base}/api/drafts`, {
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
  const publishResponse = await fetch(`${base}/api/drafts/${id}/publish`, { method: 'POST' });
  assert.equal(publishResponse.status, 422);
  await assert.rejects(
    readFile(path.join(root, 'src', 'content', 'blog', '2026', 'rollback-draft', 'cn.mdx'))
  );
});
