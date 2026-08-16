import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import { requireColumn } from './columns.mjs';

export const IDEA_STATUSES = [
  { id: 'inbox', label: '收件箱' },
  { id: 'developing', label: '继续发展' },
  { id: 'planned', label: '已排期' },
  { id: 'drafted', label: '已进入写作' },
  { id: 'archived', label: '已归档' },
];

const ideaStatusIds = new Set(IDEA_STATUSES.map((status) => status.id));
const ideaIdPattern = /^\d{8}t\d{6}-[a-f0-9]{8}$/;
const ideaUpdateQueues = new Map();

function ideaRoot(root) {
  return path.join(root, '.drafts', 'ideas');
}

function ideaDirectory(root, columnId) {
  requireColumn(columnId);
  return path.join(ideaRoot(root), columnId);
}

function ideaFile(root, columnId, id) {
  if (!ideaIdPattern.test(id)) {
    const error = new Error('Invalid idea id.');
    error.status = 400;
    throw error;
  }
  return path.join(ideaDirectory(root, columnId), `${id}.json`);
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function timestamp() {
  return new Date().toISOString();
}

function createIdeaId() {
  const date = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '');
  return `${date.toLowerCase()}-${randomUUID().replaceAll('-', '').slice(0, 8)}`;
}

function normalizeText(value, name, limit, { required = false } = {}) {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) {
    const error = new Error(`${name} is required.`);
    error.status = 400;
    throw error;
  }
  if (normalized.length > limit) {
    const error = new Error(`${name} is too long.`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[,，]/);
  const tags = [...new Set(source.map((item) => String(item).trim()).filter(Boolean))];
  if (tags.length > 12 || tags.some((tag) => tag.length > 40)) {
    const error = new Error('Ideas support at most 12 tags, each no longer than 40 characters.');
    error.status = 400;
    throw error;
  }
  return tags;
}

function normalizeSourceUrl(value) {
  const sourceUrl = normalizeText(value, 'Source URL', 2_048);
  if (!sourceUrl) return '';
  try {
    const parsed = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.href;
  } catch {
    const error = new Error('Source URL must be an HTTP or HTTPS URL.');
    error.status = 400;
    throw error;
  }
}

function normalizeTargetDate(value) {
  const targetDate = normalizeText(value, 'Target date', 10);
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    const error = new Error('Target date must use YYYY-MM-DD.');
    error.status = 400;
    throw error;
  }
  return targetDate;
}

function normalizeStatus(value, fallback = 'inbox') {
  const status = String(value || fallback);
  if (!ideaStatusIds.has(status)) {
    const error = new Error('Invalid idea status.');
    error.status = 400;
    throw error;
  }
  return status;
}

function normalizedIdeaInput(input, current = {}) {
  return {
    title: normalizeText(input.title ?? current.title, 'Idea title', 200),
    body: normalizeText(input.body ?? current.body, 'Idea body', 20_000, { required: true }),
    tags: normalizeTags(input.tags ?? current.tags),
    sourceUrl: normalizeSourceUrl(input.sourceUrl ?? current.sourceUrl),
    targetDate: normalizeTargetDate(input.targetDate ?? current.targetDate),
    status: normalizeStatus(input.status, current.status),
  };
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

async function readIdeaFile(file, expected = {}) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('record must be a JSON object');
    }
    if (parsed.schemaVersion !== 1) throw new Error('unsupported schema version');
    if (expected.id && parsed.id !== expected.id) throw new Error('id does not match its filename');
    if (expected.columnId && parsed.columnId !== expected.columnId) {
      throw new Error('columnId does not match its directory');
    }
    requireColumn(parsed.columnId);
    if (!ideaIdPattern.test(parsed.id)) throw new Error('invalid stored idea id');
    if (!validTimestamp(parsed.createdAt) || !validTimestamp(parsed.updatedAt)) {
      throw new Error('createdAt or updatedAt is invalid');
    }
    const revision = parsed.revision ?? 1;
    if (!Number.isInteger(revision) || revision < 1) throw new Error('revision is invalid');
    return {
      idea: {
        schemaVersion: 1,
        id: parsed.id,
        columnId: parsed.columnId,
        revision,
        ...normalizedIdeaInput(parsed),
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
      },
      error: '',
    };
  } catch (error) {
    return {
      idea: null,
      error: error instanceof Error ? error.message : 'record is unreadable',
    };
  }
}

export async function listIdeasWithDiagnostics(root, columnId = '') {
  const columnIds = columnId
    ? [requireColumn(columnId).id]
    : (await readdir(ideaRoot(root), { withFileTypes: true }).catch(() => []))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((id) => {
          try {
            requireColumn(id);
            return true;
          } catch {
            return false;
          }
        });
  const ideas = [];
  const invalidRecords = [];
  for (const id of columnIds) {
    const directory = ideaDirectory(root, id);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const recordId = entry.name.slice(0, -'.json'.length);
      if (!ideaIdPattern.test(recordId)) continue;
      const result = await readIdeaFile(path.join(directory, entry.name), {
        columnId: id,
        id: recordId,
      });
      if (result.idea) ideas.push(result.idea);
      else invalidRecords.push({ columnId: id, id: recordId, error: result.error });
    }
  }
  return {
    ideas: ideas.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    invalidRecords,
  };
}

export async function listIdeas(root, columnId = '') {
  return (await listIdeasWithDiagnostics(root, columnId)).ideas;
}

export async function createIdea(root, input) {
  const column = requireColumn(String(input.columnId || ''));
  if (!column.capabilities.ideas) {
    const error = new Error('This column does not support ideas.');
    error.status = 400;
    throw error;
  }
  const createdAt = timestamp();
  const idea = {
    schemaVersion: 1,
    id: createIdeaId(),
    columnId: column.id,
    revision: 1,
    ...normalizedIdeaInput(input),
    createdAt,
    updatedAt: createdAt,
  };
  const directory = ideaDirectory(root, column.id);
  await mkdir(directory, { recursive: true });
  await writeFile(ideaFile(root, column.id, idea.id), `${JSON.stringify(idea, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return idea;
}

async function findIdea(root, id) {
  if (!ideaIdPattern.test(id)) {
    const error = new Error('Invalid idea id.');
    error.status = 400;
    throw error;
  }
  const ideasRoot = ideaRoot(root);
  const columns = await readdir(ideasRoot, { withFileTypes: true }).catch(() => []);
  for (const column of columns.filter((entry) => entry.isDirectory())) {
    let file;
    try {
      file = ideaFile(root, column.name, id);
    } catch {
      continue;
    }
    if (await exists(file)) {
      const result = await readIdeaFile(file, { columnId: column.name, id });
      return { file, ...result };
    }
  }
  const error = new Error('Idea does not exist.');
  error.status = 404;
  throw error;
}

async function writeIdeaAtomically(file, idea) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(idea, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  try {
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function serializeIdeaUpdate(id, action) {
  const previous = ideaUpdateQueues.get(id) ?? Promise.resolve();
  const queued = previous.catch(() => {}).then(action);
  ideaUpdateQueues.set(id, queued);
  try {
    return await queued;
  } finally {
    if (ideaUpdateQueues.get(id) === queued) ideaUpdateQueues.delete(id);
  }
}

export async function updateIdea(root, id, input) {
  return serializeIdeaUpdate(id, async () => {
    const found = await findIdea(root, id);
    if (!found.idea) {
      const error = new Error(`Idea file is invalid: ${found.error || 'unknown record error'}.`);
      error.status = 422;
      throw error;
    }
    if (input.revision != null && Number(input.revision) !== found.idea.revision) {
      const error = new Error('Idea changed on disk; reload it before saving again.');
      error.status = 409;
      throw error;
    }
    const idea = {
      ...found.idea,
      ...normalizedIdeaInput(input, found.idea),
      revision: found.idea.revision + 1,
      updatedAt: timestamp(),
    };
    await writeIdeaAtomically(found.file, idea);
    return idea;
  });
}
