import { randomUUID } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_COLUMN_ID, requireColumn } from './columns.mjs';

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

const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const uploadImageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const imageContentTypes = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const stageIds = new Set(TASK_STAGES.map((stage) => stage.id));
const taskFileQueues = new Map();

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

async function atomicWriteTextFile(target, content) {
  const directory = path.dirname(target);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

async function withTaskFileQueue(taskFile, operation) {
  const previous = taskFileQueues.get(taskFile) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  taskFileQueues.set(taskFile, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (taskFileQueues.get(taskFile) === current) taskFileQueues.delete(taskFile);
  }
}

function parseTaskFile(content) {
  let task;
  try {
    task = JSON.parse(content);
  } catch (cause) {
    const error = new Error('task.json contains invalid JSON.', { cause });
    error.code = 'MALFORMED_TASK_METADATA';
    throw error;
  }
  if (!task || Array.isArray(task) || typeof task !== 'object') {
    const error = new TypeError('task.json must contain a JSON object.');
    error.code = 'MALFORMED_TASK_METADATA';
    throw error;
  }
  return task;
}

function taskFileFailure(error, task = { stage: 'ideation' }) {
  const missing = error?.code === 'ENOENT';
  const malformed = error?.code === 'MALFORMED_TASK_METADATA';
  const status = missing ? 'missing' : malformed ? 'malformed' : 'unreadable';
  const code = missing
    ? 'MISSING_TASK_METADATA'
    : malformed
      ? 'MALFORMED_TASK_METADATA'
      : 'UNREADABLE_TASK_METADATA';
  const message = missing
    ? 'task.json is missing.'
    : malformed
      ? 'task.json is invalid; the original file was preserved.'
      : 'task.json could not be read; the original file was preserved.';
  return {
    status,
    task,
    diagnostic: {
      code,
      message,
      cause:
        error?.cause instanceof Error
          ? error.cause.message
          : error instanceof Error
            ? error.message
            : String(error),
    },
  };
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
  const columnId = requireColumn(metadata.columnId || DEFAULT_COLUMN_ID).id;
  const fallbackTask = {
    schemaVersion: 2,
    id,
    title,
    columnId,
    contentKind: 'bilingual_article',
    stage: 'ideation',
  };
  await mkdir(path.join(directory, 'images'), { recursive: true });

  const taskFile = path.join(directory, 'task.json');
  const result = await withTaskFileQueue(taskFile, async () => {
    let content;
    try {
      content = await readFile(taskFile, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') {
        const task = {
          ...fallbackTask,
          createdAt: now(),
          updatedAt: now(),
        };
        await atomicWriteTextFile(taskFile, `${JSON.stringify(task, null, 2)}\n`);
        return { status: 'created', task };
      }
      return taskFileFailure(error, fallbackTask);
    }

    let existingTask;
    try {
      existingTask = parseTaskFile(content);
    } catch (error) {
      return taskFileFailure(error, fallbackTask);
    }

    const stage = normalizeStage(existingTask.stage);
    const task = {
      ...existingTask,
      schemaVersion: 2,
      id,
      title: existingTask.title || title,
      columnId: existingTask.columnId || columnId,
      contentKind: existingTask.contentKind || 'bilingual_article',
      stage,
    };
    const migrated =
      stage !== existingTask.stage ||
      existingTask.schemaVersion !== 2 ||
      !existingTask.columnId ||
      !existingTask.contentKind;
    if (migrated) {
      await atomicWriteTextFile(taskFile, `${JSON.stringify(task, null, 2)}\n`);
    }
    return { status: migrated ? 'migrated' : 'ready', task };
  });

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

  return result;
}

async function readTaskFile(directory, includeState = false) {
  const taskFile = path.join(directory, 'task.json');
  let state;
  try {
    const task = parseTaskFile(await readFile(taskFile, 'utf8'));
    state = { status: 'ready', task: { ...task, stage: normalizeStage(task.stage) } };
  } catch (error) {
    state = taskFileFailure(error);
  }
  return includeState ? state : state.task;
}

export async function listAssets(directory, fallbackDirectory = '') {
  const assets = new Map();
  for (const [sourceDirectory, origin] of [
    [directory, 'draft'],
    [fallbackDirectory, 'site'],
  ]) {
    if (!sourceDirectory) continue;
    const imagesDirectory = path.join(sourceDirectory, 'images');
    const entries = await readdir(imagesDirectory, { withFileTypes: true }).catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) {
      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || !imageExtensions.has(extension) || assets.has(entry.name)) continue;
      const file = path.join(imagesDirectory, entry.name);
      const details = await stat(file);
      assets.set(entry.name, {
        name: entry.name,
        size: details.size,
        modifiedAt: details.mtimeMs,
        origin,
      });
    }
  }
  return [...assets.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function readTaskWorkspace(root, id) {
  const directory = draftDirectory(root, id);
  const siteDirectory = path.join(root, 'src', 'content', 'blog', ...id.split('/'));
  const taskState = await readTaskFile(directory, true);
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
    task: taskState.task,
    taskMetadata: {
      status: taskState.status,
      ...(taskState.diagnostic ? { diagnostic: taskState.diagnostic } : {}),
    },
    stages: TASK_STAGES,
    documents,
    assets: await listAssets(directory, siteDirectory),
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
  const directory = draftDirectory(root, id);
  const target = path.join(directory, document.file);
  await atomicWriteTextFile(target, content);
}

export async function updateTaskStage(root, id, stage) {
  if (!stageIds.has(stage)) {
    const error = new Error('Invalid article stage.');
    error.status = 400;
    throw error;
  }
  const directory = draftDirectory(root, id);
  const taskFile = path.join(directory, 'task.json');
  return withTaskFileQueue(taskFile, async () => {
    const current = await readTaskFile(directory, true);
    if (current.status !== 'ready') {
      const error = new Error(
        current.status === 'malformed'
          ? 'Article stage cannot be updated because task.json is invalid. Repair task.json and try again.'
          : 'Article stage cannot be updated because task.json is missing or unreadable.'
      );
      error.status = 422;
      error.details = current.diagnostic;
      throw error;
    }
    const task = { ...current.task, id, stage, updatedAt: now() };
    await atomicWriteTextFile(taskFile, `${JSON.stringify(task, null, 2)}\n`);
    return task;
  });
}

function safeAssetName(value, allowedExtensions = imageExtensions, normalize = false) {
  const basename = path.basename(String(value || '')).normalize('NFC');
  const candidate = normalize ? basename.toLocaleLowerCase('en-US') : basename;
  const originalExtension = path.extname(candidate);
  const extension = originalExtension.toLowerCase();
  if (!candidate || !allowedExtensions.has(extension)) {
    const error = new Error('Image must be AVIF, GIF, JPEG, PNG, or WebP.');
    error.status = 400;
    throw error;
  }
  const stem = candidate
    .slice(0, -originalExtension.length)
    .replace(/[^\p{L}\p{M}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  if (candidate.startsWith('.') || !/[\p{L}\p{N}]/u.test(stem)) {
    const error = new Error('Image filename must contain at least one letter or number.');
    error.status = 400;
    throw error;
  }
  return `${stem}${normalize ? extension : originalExtension}`;
}

export async function saveTaskAsset(root, id, input) {
  const directory = path.join(draftDirectory(root, id), 'images');
  await mkdir(directory, { recursive: true });
  return saveImageAsset(directory, input);
}

export async function saveSiteAsset(root, id, input) {
  const directory = path.join(siteDirectory(root, id), 'images');
  await mkdir(directory, { recursive: true });
  return saveImageAsset(directory, input);
}

async function saveImageAsset(directory, input) {
  const name = safeAssetName(input.name, uploadImageExtensions, true);
  const bytes = Buffer.from(String(input.base64 || ''), 'base64');
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) {
    const error = new Error('Image must be between 1 byte and 8 MB.');
    error.status = 400;
    throw error;
  }
  try {
    await writeFile(path.join(directory, name), bytes, { flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      const conflict = new Error(`Image already exists: ${name}`);
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
  return { name, size: bytes.length };
}

function siteDirectory(root, id) {
  return path.join(root, 'src', 'content', 'blog', ...id.split('/'));
}

export function siteAssetPath(root, id, value) {
  const name = safeAssetName(value);
  const file = path.join(siteDirectory(root, id), 'images', name);
  return {
    file,
    contentType: imageContentTypes[path.extname(name).toLowerCase()],
  };
}

export async function taskAssetPath(root, id, value) {
  const name = safeAssetName(value);
  const draftFile = path.join(draftDirectory(root, id), 'images', name);
  const siteFile = path.join(root, 'src', 'content', 'blog', ...id.split('/'), 'images', name);
  return {
    file: (await exists(draftFile)) ? draftFile : siteFile,
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
