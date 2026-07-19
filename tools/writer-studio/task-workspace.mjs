import { access, cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const TASK_STAGES = [
  { id: 'ideation', label: '构思与研究' },
  { id: 'outline', label: '提纲' },
  { id: 'draft', label: '初稿' },
  { id: 'polish', label: '润色' },
  { id: 'ready', label: '定稿' },
];

export const TASK_DOCUMENTS = {
  references: { file: 'references.md', label: '构思与研究记录', visible: false },
  outline: { file: 'outline.md', label: '文章提纲' },
  style: { file: 'style.md', label: '本篇风格指南' },
};

const legacyStageMap = {
  idea: 'ideation',
  research: 'ideation',
  images: 'draft',
};

const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const imageContentTypes = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const stageIds = new Set(TASK_STAGES.map((stage) => stage.id));

function draftDirectory(root, id) {
  return path.join(root, '.drafts', 'blog', ...id.split('/'));
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function now() {
  return new Date().toISOString();
}

function taskEntryTemplate(id, title) {
  return (
    `# Article task: ${title}\n\n` +
    `- Task ID: \`${id}\`\n` +
    `- Workspace: \`.drafts/blog/${id}/\`\n` +
    `- Research skill: \`$start-article-research ${id}\`\n` +
    `- Drafting skill: \`$draft-from-outline ${id}\`\n\n` +
    `Keep discussion insights and evidence in references.md, write the human-owned structure in ` +
    `outline.md, and tune this article's voice in style.md. Use Writer Studio for review, body editing, ` +
    `images, and publishing.\n`
  );
}

function documentTemplate(key, title) {
  if (key === 'references') {
    return `# 构思与研究记录｜${title}\n\n> 由 \`$start-article-research\` 持续维护。保留作者的原始判断，明确区分事实、推断与待验证问题。\n\n## 核心问题\n\n\n## 作者的关键判断\n\n\n## 讨论中形成的新连接\n\n\n## 证据与来源\n\n<!-- 每条包含：来源、URL、访问日期、支持的命题；不要只堆链接。 -->\n\n## 反例与竞争性解释\n\n\n## 已作出的写作决定\n\n\n## 尚待确认\n\n`;
  }
  if (key === 'outline') {
    return `# 文章提纲｜${title}\n\n## 开篇\n\n\n## 核心论证\n\n\n## 结尾\n\n`;
  }
  return `# 本篇风格指南｜${title}\n\n> 这份文件只约束当前文章，可直接在 Writer Studio 修改。未填写的部分沿用 \`$draft-from-outline\` 内置的全局文风。\n\n## 这篇文章想给人的阅读感受\n\n\n## 叙述者位置与语气\n\n\n## 开篇方式\n\n\n## 论证节奏与篇幅\n\n\n## 术语、比喻与中英文处理\n\n\n## 证据与引用密度\n\n\n## 本篇必须保留的表达\n\n\n## 本篇应避免的写法\n\n`;
}

function normalizeStage(stage) {
  const normalized = legacyStageMap[stage] || stage;
  return stageIds.has(normalized) ? normalized : 'ideation';
}

function meaningfulLegacyContent(content) {
  return content
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^>.*$/gm, '')
    .replace(/<!--[^]*?-->/g, '')
    .trim();
}

async function initialReferences(directory, title) {
  const sections = [];
  for (const [label, fileName] of [
    ['旧版文章简报', 'brief.md'],
    ['旧版研究资料', 'research.md'],
  ]) {
    const file = path.join(directory, fileName);
    if (!(await exists(file))) continue;
    const content = await readFile(file, 'utf8');
    if (meaningfulLegacyContent(content)) sections.push(`## ${label}\n\n${content.trim()}\n`);
  }
  const base = documentTemplate('references', title);
  return sections.length ? `${base}\n## 从旧版工作流迁移的资料\n\n${sections.join('\n')}` : base;
}

export async function ensureTaskWorkspace(root, id, metadata = {}) {
  const directory = draftDirectory(root, id);
  const title = metadata.title || id.split('/')[1];
  await mkdir(path.join(directory, 'images'), { recursive: true });

  const taskFile = path.join(directory, 'task.json');
  if (!(await exists(taskFile))) {
    await writeFile(
      taskFile,
      `${JSON.stringify(
        {
          id,
          title,
          stage: 'ideation',
          createdAt: now(),
          updatedAt: now(),
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  } else {
    try {
      const existingTask = JSON.parse(await readFile(taskFile, 'utf8'));
      const stage = normalizeStage(existingTask.stage);
      if (stage !== existingTask.stage) {
        await writeFile(
          taskFile,
          `${JSON.stringify({ ...existingTask, id, title: existingTask.title || title, stage }, null, 2)}\n`,
          'utf8'
        );
      }
    } catch {
      await writeFile(
        taskFile,
        `${JSON.stringify({ id, title, stage: 'ideation', createdAt: now(), updatedAt: now() }, null, 2)}\n`,
        'utf8'
      );
    }
  }

  const entryFile = path.join(directory, 'TASK.md');
  if (!(await exists(entryFile))) {
    await writeFile(entryFile, taskEntryTemplate(id, title), 'utf8');
  }

  for (const [key, document] of Object.entries(TASK_DOCUMENTS)) {
    const file = path.join(directory, document.file);
    if (!(await exists(file))) {
      await writeFile(
        file,
        key === 'references'
          ? await initialReferences(directory, title)
          : documentTemplate(key, title),
        'utf8'
      );
    }
  }
}

async function readTaskFile(directory) {
  const file = path.join(directory, 'task.json');
  try {
    const task = JSON.parse(await readFile(file, 'utf8'));
    return { ...task, stage: normalizeStage(task.stage) };
  } catch {
    return { stage: 'ideation' };
  }
}

async function listAssets(directory) {
  const imagesDirectory = path.join(directory, 'images');
  await mkdir(imagesDirectory, { recursive: true });
  const entries = await readdir(imagesDirectory, { withFileTypes: true });
  const assets = [];
  for (const entry of entries) {
    const extension = path.extname(entry.name).toLowerCase();
    if (!entry.isFile() || !imageExtensions.has(extension)) continue;
    const file = path.join(imagesDirectory, entry.name);
    const details = await stat(file);
    assets.push({ name: entry.name, size: details.size, modifiedAt: details.mtimeMs });
  }
  return assets.sort((left, right) => left.name.localeCompare(right.name));
}

export async function readTaskWorkspace(root, id) {
  const directory = draftDirectory(root, id);
  const task = await readTaskFile(directory);
  const documents = {};
  for (const [key, document] of Object.entries(TASK_DOCUMENTS)) {
    const file = path.join(directory, document.file);
    const details = await stat(file);
    documents[key] = {
      ...document,
      content: await readFile(file, 'utf8'),
      modifiedAt: details.mtimeMs,
    };
  }
  return {
    task,
    stages: TASK_STAGES,
    documents,
    assets: await listAssets(directory),
    skills: {
      research: {
        name: 'start-article-research',
        command: `$start-article-research ${id}`,
      },
      draft: {
        name: 'draft-from-outline',
        command: `$draft-from-outline ${id}`,
      },
    },
  };
}

export async function writeTaskDocument(root, id, key, content) {
  const document = TASK_DOCUMENTS[key];
  if (!document || typeof content !== 'string') {
    const error = new Error('Invalid task document.');
    error.status = 400;
    throw error;
  }
  await writeFile(path.join(draftDirectory(root, id), document.file), content, 'utf8');
}

export async function updateTaskStage(root, id, stage) {
  if (!stageIds.has(stage)) {
    const error = new Error('Invalid article stage.');
    error.status = 400;
    throw error;
  }
  const directory = draftDirectory(root, id);
  const current = await readTaskFile(directory);
  const task = { ...current, id, stage, updatedAt: now() };
  await writeFile(path.join(directory, 'task.json'), `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  return task;
}

function safeAssetName(value) {
  const name = path
    .basename(String(value || ''))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-');
  const extension = path.extname(name);
  if (!name || name.startsWith('.') || !imageExtensions.has(extension)) {
    const error = new Error('Image must be AVIF, GIF, JPEG, PNG, or WebP.');
    error.status = 400;
    throw error;
  }
  return name;
}

export async function saveTaskAsset(root, id, input) {
  const name = safeAssetName(input.name);
  const bytes = Buffer.from(String(input.base64 || ''), 'base64');
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) {
    const error = new Error('Image must be between 1 byte and 8 MB.');
    error.status = 400;
    throw error;
  }
  const directory = path.join(draftDirectory(root, id), 'images');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), bytes);
  return { name, size: bytes.length };
}

export function taskAssetPath(root, id, value) {
  const name = safeAssetName(value);
  return {
    file: path.join(draftDirectory(root, id), 'images', name),
    contentType: imageContentTypes[path.extname(name).toLowerCase()],
  };
}

export async function publishTaskAssets(root, id, target) {
  const source = path.join(draftDirectory(root, id), 'images');
  const assets = await listAssets(draftDirectory(root, id));
  if (assets.length === 0) return;
  await cp(source, path.join(target, 'images'), {
    recursive: true,
    filter: (file) => {
      const extension = path.extname(file).toLowerCase();
      return extension === '' || imageExtensions.has(extension);
    },
  });
}
