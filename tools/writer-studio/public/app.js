import { buildPublicationPackage, PUBLICATION_PLATFORMS } from './publication-package.js';

const state = {
  columns: [],
  drafts: [],
  ideas: [],
  invalidIdeaRecords: [],
  ideaStatuses: [],
  ideaCounts: {},
  activeColumnId: 'intellipharma',
  activeId: '',
  mode: 'writing',
  language: 'cn',
  section: 'outline',
  content: '',
  workspace: null,
  ideaFilter: 'active',
  editingIdeaId: '',
  ideaFormDirty: false,
  ideasRequestSequence: 0,
  sessionToken: '',
  dirty: false,
  loading: false,
  saveTimer: null,
  syncTimer: null,
  toastTimer: null,
  publicationPackage: null,
  publicationRequestSequence: 0,
  baseHash: '',
  editRevision: 0,
  saveInFlight: null,
  saveConflict: null,
  documentLoadSequence: 0,
  documentLoadsInFlight: 0,
};

const sectionLabels = {
  article: '文章正文',
  outline: '文章提纲',
  style: '本篇风格指南',
};

const stageLabels = {
  ideation: '构思与研究',
  outline: '提纲',
  draft: '初稿',
  polish: '润色',
  ready: '定稿',
};

const elements = Object.fromEntries(
  [
    'draft-list',
    'draft-count',
    'column-select',
    'idea-count',
    'new-idea-button',
    'document-path',
    'document-title',
    'save-status',
    'save-button',
    'sync-status',
    'stage-list',
    'draft-skill-button',
    'validate-button',
    'publication-package-button',
    'publish-button',
    'writing-topbar',
    'writing-stage-bar',
    'writing-editor-toolbar',
    'empty-state',
    'writing-area',
    'ideas-workspace',
    'ideas-column-code',
    'ideas-column-title',
    'ideas-column-description',
    'idea-form',
    'idea-form-title',
    'save-idea-button',
    'cancel-idea-edit',
    'idea-status-filter',
    'ideas-list',
    'editor',
    'editor-label',
    'editor-stats',
    'preview',
    'preview-label',
    'asset-panel',
    'asset-summary',
    'asset-grid',
    'asset-input',
    'upload-button',
    'new-draft-button',
    'new-draft-dialog',
    'new-draft-form',
    'new-draft-column',
    'close-dialog',
    'cancel-dialog',
    'result-dialog',
    'result-title',
    'result-content',
    'close-result',
    'confirm-result',
    'skill-dialog',
    'skill-command',
    'close-skill',
    'copy-skill',
    'confirm-skill',
    'publication-package-dialog',
    'close-publication-package',
    'publication-platform',
    'publication-language',
    'publication-format',
    'publication-guidance',
    'publication-title',
    'publication-canonical',
    'publication-count',
    'publication-preview-label',
    'publication-rich-preview',
    'publication-plain-preview',
    'publication-assets',
    'publication-asset-count',
    'publication-asset-list',
    'publication-warnings',
    'open-publication-platform',
    'copy-publication-title',
    'copy-publication-link',
    'copy-publication-plain',
    'copy-publication-main',
    'toast',
  ].map((id) => [
    id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
    document.querySelector(`#${id}`),
  ])
);

async function api(url, options, allowTokenRefresh = true) {
  const method = options?.method || 'GET';
  const headers = { 'Content-Type': 'application/json', ...(options?.headers || {}) };
  if (method !== 'GET' && state.sessionToken) {
    headers['X-Writer-Studio-Token'] = state.sessionToken;
  }
  const response = await fetch(url, {
    ...options,
    headers,
  });
  const payload = await response.json();
  if (
    !response.ok &&
    response.status === 403 &&
    method !== 'GET' &&
    allowTokenRefresh &&
    /session token/i.test(payload.error || '')
  ) {
    const stateResponse = await fetch('/api/state', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (stateResponse.ok) {
      const refreshedState = await stateResponse.json();
      state.sessionToken = refreshedState.sessionToken;
      return api(url, options, false);
    }
  }
  if (!response.ok) {
    const error = new Error(payload.error || '请求失败');
    error.payload = payload;
    throw error;
  }
  return payload;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function markdownToHtml(source, stripFrontmatter = true) {
  const body = stripFrontmatter ? source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') : source;
  const lines = body.split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let list = null;
  let rawBlock = [];
  let rawDepth = 0;

  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    output.push(
      `<${list.type}>${list.items
        .map((item) => `<li>${inlineMarkdown(item)}</li>`)
        .join('')}</${list.type}>`
    );
    list = null;
  };
  const flushRaw = () => {
    if (!rawBlock.length) return;
    output.push(
      `<div class="mdx-note"><strong>MDX 组件</strong><pre>${escapeHtml(
        rawBlock.join('\n')
      )}</pre></div>`
    );
    rawBlock = [];
    rawDepth = 0;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (rawDepth > 0 || /^<\/?[A-Za-z]/.test(trimmed)) {
      flushParagraph();
      flushList();
      rawBlock.push(line);
      rawDepth += (trimmed.match(/<[A-Za-z][^>]*>/g) || []).length;
      rawDepth -= (trimmed.match(/<\/[A-Za-z][^>]*>/g) || []).length;
      if (rawDepth <= 0 && /<\/[A-Za-z][^>]*>/.test(trimmed)) flushRaw();
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      output.push('<hr>');
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      list ||= { type, items: [] };
      list.items.push((bullet || ordered)[1]);
      continue;
    }
    const quote = trimmed.match(/^>\s*(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      output.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  flushRaw();
  return output.join('\n');
}

function frontmatterMetadata(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
  const scalar = (key) =>
    frontmatter
      .match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, '') || '';
  return {
    title: scalar('title'),
    date: scalar('date'),
    description: scalar('description'),
  };
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2400);
}

function articlePreviewDocument(metadata, article) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>
    :root{color:#4a4845;background:#fbfaf7;font-family:Georgia,'Microsoft YaHei',serif}
    body{max-width:720px;margin:0 auto;padding:54px 44px 100px;line-height:1.9}
    .meta{margin-bottom:42px;padding-bottom:30px;border-bottom:1px solid #ded8d1}
    h1{margin:0 0 14px;font-size:34px;line-height:1.28;font-weight:500;letter-spacing:-.02em}
    .date{color:#8b847c;font:11px ui-monospace,monospace;letter-spacing:.08em}
    .description{color:#777069;font:14px/1.7 ui-sans-serif,system-ui;margin-top:16px}
    article{font-size:17px} article h1{font-size:30px;margin-top:2.2em} article h2{font-size:25px;margin-top:2em}
    article h3{font-size:20px;margin-top:1.8em} p{margin:1.25em 0} strong{color:#383633}
    code{padding:2px 5px;border-radius:4px;background:#ece7e1;font:14px ui-monospace,monospace}
    a{color:#526e77} blockquote{margin:1.6em 0;padding:2px 0 2px 22px;border-left:3px solid #9cafb7;color:#6f6963}
    hr{margin:42px 0;border:0;border-top:1px solid #ded8d1} li{margin:.5em 0}
    .mdx-note{margin:28px 0;padding:14px;border:1px dashed #b8a492;border-radius:8px;background:#f4efe9;color:#756c64;font:11px ui-monospace,monospace}
    .mdx-note pre{overflow:auto;white-space:pre-wrap;margin:8px 0 0}
  </style></head><body><header class="meta"><h1>${escapeHtml(
    metadata.title || '无标题文章'
  )}</h1><div class="date">${escapeHtml(metadata.date)}</div><p class="description">${escapeHtml(
    metadata.description
  )}</p></header><article>${article}</article></body></html>`;
}

function updatePreview() {
  elements.assetPanel.classList.toggle('hidden', state.section !== 'article');
  elements.preview.classList.remove('hidden');
  const metadata =
    state.section === 'article'
      ? frontmatterMetadata(state.content)
      : { title: sectionLabels[state.section], date: '', description: state.activeId };
  elements.preview.srcdoc = articlePreviewDocument(
    metadata,
    markdownToHtml(state.content, state.section === 'article')
  );
}

function updateStats() {
  const body =
    state.section === 'article'
      ? state.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
      : state.content.trim();
  const chinese = (body.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (body.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  elements.editorStats.textContent = `${chinese + words} 字 · ${body.length} 字符`;
}

function currentDraft() {
  return state.drafts.find((draft) => draft.id === state.activeId);
}

function currentColumn() {
  return state.columns.find((column) => column.id === state.activeColumnId);
}

function columnDrafts() {
  return state.drafts.filter((draft) => draft.columnId === state.activeColumnId);
}

function setTabState(tab, selected) {
  tab.classList.toggle('active', selected);
  tab.setAttribute('aria-selected', String(selected));
  tab.tabIndex = selected ? 0 : -1;
}

function updateWritingPanelLabel() {
  const sectionTab = [...document.querySelectorAll('.section-tab')].find(
    (tab) => tab.dataset.section === state.section
  );
  const languageTab =
    state.section === 'article'
      ? [...document.querySelectorAll('.language-tab')].find(
          (tab) => tab.dataset.language === state.language
        )
      : null;
  elements.writingArea.setAttribute(
    'aria-labelledby',
    ['writing-mode-tab', sectionTab?.id, languageTab?.id].filter(Boolean).join(' ')
  );
}

function enableTabKeyboardNavigation(tablist) {
  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].filter(
      (tab) => !tab.disabled && !tab.hidden
    );
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0 || !tabs.length) return;
    event.preventDefault();
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  });
}

function renderColumnControls() {
  const options = state.columns
    .map(
      (column) =>
        `<option value="${escapeHtml(column.id)}">${escapeHtml(column.code)} · ${escapeHtml(
          column.name
        )}</option>`
    )
    .join('');
  elements.columnSelect.innerHTML = options;
  elements.columnSelect.value = state.activeColumnId;
  elements.newDraftColumn.innerHTML = state.columns
    .map(
      (column) =>
        `<option value="${escapeHtml(column.id)}" ${
          column.capabilities.drafts ? '' : 'disabled'
        }>${escapeHtml(column.code)} · ${escapeHtml(column.name)}${
          column.capabilities.drafts ? '' : '（先使用 Ideas）'
        }</option>`
    )
    .join('');
  const column = currentColumn();
  const ideaCount = state.ideaCounts[state.activeColumnId] || 0;
  elements.ideaCount.textContent = String(ideaCount);
  elements.newDraftButton.disabled = !column?.capabilities.drafts;
  elements.newDraftButton.textContent = column?.capabilities.drafts
    ? '＋ 新建文章草稿'
    : '本栏目先从 Ideas 开始';
  elements.ideasColumnCode.textContent = `${column?.code || ''} / IDEAS INBOX`;
  elements.ideasColumnTitle.textContent = column?.name || 'Ideas';
  elements.ideasColumnDescription.textContent =
    column?.description || '先记录未经打磨的判断，再决定如何写作。';
}

function renderDraftList() {
  const drafts = columnDrafts();
  elements.draftCount.textContent = String(drafts.length);
  elements.draftList.innerHTML = drafts
    .map(
      (draft) => `<button class="draft-item ${
        draft.id === state.activeId ? 'active' : ''
      }" data-id="${escapeHtml(draft.id)}" type="button">
        <strong>${escapeHtml(draft.title)}</strong>
        <span class="draft-meta"><span>${escapeHtml(draft.date)}</span>${draft.languages
          .map((language) => `<span class="language-badge">${language}</span>`)
          .join('')}<span>${escapeHtml(stageLabels[draft.stage] || draft.stage || '构思')}</span>${
          draft.assetCount ? `<span>${draft.assetCount} 图</span>` : ''
        }</span>
      </button>`
    )
    .join('');
  if (!drafts.length) {
    elements.draftList.innerHTML =
      '<div class="ideas-empty">这个栏目还没有固定格式的写作任务。先把碎片放入 Ideas，再决定章节或文章结构。</div>';
  }
}

function renderStages() {
  if (!state.workspace) {
    elements.stageList.innerHTML = '';
    return;
  }
  const taskMetadataReady =
    !state.workspace.taskMetadata || state.workspace.taskMetadata.status === 'ready';
  const activeIndex = state.workspace.stages.findIndex(
    (stage) => stage.id === state.workspace.task.stage
  );
  elements.stageList.innerHTML = state.workspace.stages
    .map(
      (stage, index) =>
        `<button class="stage-button ${index < activeIndex ? 'done' : ''} ${
          index === activeIndex ? 'active' : ''
        }" data-stage="${stage.id}" type="button" ${taskMetadataReady ? '' : 'disabled'}>${escapeHtml(
          stage.label
        )}</button>`
    )
    .join('');
}

function renderAssets() {
  const assets = state.workspace?.assets || [];
  elements.assetSummary.textContent = `${assets.length} 张 · 上传与插入`;
  if (!assets.length) {
    elements.assetGrid.innerHTML =
      '<div class="asset-empty">还没有图片。让 Codex 把生成或整理好的图片保存到本任务的 <code>images/</code>，或点击“上传图片”。</div>';
    return;
  }
  elements.assetGrid.innerHTML = assets
    .map(
      (asset) => `<article class="asset-card">
        <img src="/api/drafts/${encodeURIComponent(state.activeId)}/assets/${encodeURIComponent(
          asset.name
        )}" alt="${escapeHtml(asset.name)}" />
        <div class="asset-card-body"><strong>${escapeHtml(
          asset.name
        )}</strong><button data-insert-asset="${escapeHtml(
          asset.name
        )}" type="button">插入当前正文</button></div>
      </article>`
    )
    .join('');
}

function ideaStatusLabel(status) {
  return state.ideaStatuses.find((item) => item.id === status)?.label || status;
}

function renderIdeas() {
  const filtered = state.ideas.filter((idea) => {
    if (state.ideaFilter === 'all') return true;
    if (state.ideaFilter === 'active') return idea.status !== 'archived';
    return idea.status === state.ideaFilter;
  });
  const invalidNotice = state.invalidIdeaRecords.length
    ? `<div class="ideas-warning">检测到 ${state.invalidIdeaRecords.length} 条无法读取的 Idea 记录。原文件已保留且没有被改写，请在本地检查其 JSON 结构。</div>`
    : '';
  if (!filtered.length) {
    elements.ideasList.innerHTML = `${invalidNotice}<div class="ideas-empty">这里还没有符合当前筛选条件的 Idea。先记录一句问题、一条判断，或两个原本没有被连接起来的概念。</div>`;
    return;
  }
  const statusOptions = (selected) =>
    state.ideaStatuses
      .map(
        (status) =>
          `<option value="${escapeHtml(status.id)}" ${
            status.id === selected ? 'selected' : ''
          }>${escapeHtml(status.label)}</option>`
      )
      .join('');
  elements.ideasList.innerHTML = `${invalidNotice}${filtered
    .map((idea) => {
      const title = idea.title || idea.body.split(/\r?\n/)[0].slice(0, 44) || '未命名想法';
      const updated = new Date(idea.updatedAt).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
      });
      return `<article class="idea-card ${idea.status === 'archived' ? 'archived' : ''}" data-idea-id="${escapeHtml(
        idea.id
      )}">
        <div class="idea-card-header"><h4>${escapeHtml(title)}</h4><time datetime="${escapeHtml(
          idea.updatedAt
        )}">${escapeHtml(updated)}</time></div>
        <p class="idea-card-body">${escapeHtml(idea.body)}</p>
        ${
          idea.tags.length
            ? `<div class="idea-tags">${idea.tags
                .map((tag) => `<span class="idea-tag">${escapeHtml(tag)}</span>`)
                .join('')}</div>`
            : ''
        }
        ${
          idea.sourceUrl
            ? `<a class="idea-source" href="${escapeHtml(
                idea.sourceUrl
              )}" target="_blank" rel="noopener noreferrer">${escapeHtml(idea.sourceUrl)}</a>`
            : ''
        }
        <div class="idea-card-footer">
          <div class="idea-card-actions">
            <select data-idea-status="${escapeHtml(idea.id)}" aria-label="${escapeHtml(
              title
            )}的状态">${statusOptions(idea.status)}</select>
            <button data-edit-idea="${escapeHtml(idea.id)}" type="button">编辑</button>
          </div>
          ${
            idea.targetDate
              ? `<span class="idea-target-date">目标 ${escapeHtml(idea.targetDate)}</span>`
              : `<span class="idea-target-date">${escapeHtml(ideaStatusLabel(idea.status))}</span>`
          }
        </div>
      </article>`;
    })
    .join('')}`;
}

async function refreshIdeas() {
  const requestedColumnId = state.activeColumnId;
  const requestSequence = ++state.ideasRequestSequence;
  const payload = await api(`/api/ideas?column=${encodeURIComponent(requestedColumnId)}`);
  if (
    requestSequence !== state.ideasRequestSequence ||
    requestedColumnId !== state.activeColumnId
  ) {
    return false;
  }
  state.ideas = payload.ideas;
  state.invalidIdeaRecords = payload.invalidRecords || [];
  state.ideaStatuses = payload.statuses;
  elements.ideaStatusFilter.innerHTML = [
    '<option value="active">未归档</option>',
    '<option value="all">全部</option>',
    ...state.ideaStatuses.map(
      (status) => `<option value="${escapeHtml(status.id)}">${escapeHtml(status.label)}</option>`
    ),
  ].join('');
  elements.ideaStatusFilter.value = state.ideaFilter;
  renderIdeas();
  return true;
}

function resetIdeaForm() {
  state.editingIdeaId = '';
  state.ideaFormDirty = false;
  elements.ideaForm.reset();
  elements.ideaFormTitle.textContent = '记录一个想法';
  elements.saveIdeaButton.textContent = '存入 Ideas';
  elements.cancelIdeaEdit.classList.add('hidden');
}

function startEditingIdea(id) {
  if (!confirmDiscardIdeaForm()) return;
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea) return;
  state.editingIdeaId = id;
  const form = elements.ideaForm.elements;
  form.title.value = idea.title;
  form.body.value = idea.body;
  form.sourceUrl.value = idea.sourceUrl;
  form.tags.value = idea.tags.join(', ');
  form.targetDate.value = idea.targetDate;
  state.ideaFormDirty = false;
  elements.ideaFormTitle.textContent = '编辑这个想法';
  elements.saveIdeaButton.textContent = '保存修改';
  elements.cancelIdeaEdit.classList.remove('hidden');
  elements.ideaForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.body.focus();
}

function confirmDiscardIdeaForm() {
  if (!state.ideaFormDirty) return true;
  return confirm('当前 Idea 还没有保存。确认放弃这些改动吗？');
}

async function setMode(mode) {
  if (!['writing', 'ideas'].includes(mode)) return;
  if (state.mode === 'writing' && mode !== 'writing' && !(await saveCurrent())) return false;
  if (state.mode === 'ideas' && mode !== 'ideas' && !confirmDiscardIdeaForm()) return false;
  if (state.mode === 'ideas' && mode !== 'ideas') resetIdeaForm();
  state.mode = mode;
  document.querySelectorAll('.studio-mode-tab').forEach((tab) => {
    const selected = tab.dataset.mode === mode;
    setTabState(tab, selected);
  });
  const ideasMode = mode === 'ideas';
  elements.writingTopbar.classList.toggle('hidden', ideasMode);
  elements.writingStageBar.classList.toggle('hidden', ideasMode);
  elements.writingEditorToolbar.classList.toggle('hidden', ideasMode);
  elements.ideasWorkspace.classList.toggle('hidden', !ideasMode);
  if (ideasMode) {
    elements.emptyState.classList.add('hidden');
    elements.writingArea.classList.add('hidden');
    await refreshIdeas();
    return true;
  }
  if (state.activeId && currentDraft()?.columnId === state.activeColumnId) {
    elements.emptyState.classList.add('hidden');
    elements.writingArea.classList.remove('hidden');
  } else {
    elements.emptyState.classList.remove('hidden');
    elements.writingArea.classList.add('hidden');
    const column = currentColumn();
    elements.documentPath.textContent = `.drafts/ideas/${state.activeColumnId}/`;
    elements.documentTitle.textContent = column?.name || 'Writer Studio';
    elements.saveStatus.textContent = '等待写作任务';
    elements.syncStatus.textContent = '当前栏目尚无固定格式';
    elements.stageList.innerHTML = '';
    elements.saveButton.disabled = true;
    elements.draftSkillButton.disabled = true;
    elements.validateButton.disabled = true;
    elements.publicationPackageButton.disabled = true;
    elements.publishButton.disabled = true;
    elements.publishButton.textContent = '发布到站点';
    elements.emptyState.querySelector('h2').textContent = column?.capabilities.drafts
      ? '在浏览器里安静地写作'
      : `${column?.name || '这个栏目'}先从 Ideas 生长`;
    elements.emptyState.querySelector('p').textContent = column?.capabilities.drafts
      ? '选择左侧草稿，或者创建一篇新文章。Codex 对文件的修改会在这里自动显示。'
      : '这里暂不强行套用博客文章格式。先记录灵感、证据和问题，等书稿或研究结构稳定后再建立正式发布适配器。';
  }
  return true;
}

async function refreshState() {
  const payload = await api('/api/state');
  state.sessionToken = payload.sessionToken;
  state.columns = payload.columns;
  state.drafts = payload.drafts;
  state.ideaCounts = payload.ideaCounts || {};
  if (!state.columns.some((column) => column.id === state.activeColumnId)) {
    state.activeColumnId = state.columns[0]?.id || 'intellipharma';
  }
  renderColumnControls();
  renderDraftList();
}

async function refreshWorkspace(id = state.activeId) {
  if (!id) return null;
  const workspace = await api(`/api/drafts/${encodeURIComponent(id)}/workspace`);
  if (id !== state.activeId) return null;
  state.workspace = workspace;
  renderStages();
  renderAssets();
  return workspace;
}

function setEditorContent(content, pathLabel, hash = '') {
  state.content = content;
  state.baseHash = hash;
  state.editRevision += 1;
  state.saveConflict = null;
  state.dirty = false;
  elements.editor.value = content;
  elements.documentPath.textContent = pathLabel;
  elements.editorLabel.textContent = sectionLabels[state.section];
  elements.previewLabel.textContent = '阅读预览';
  elements.saveStatus.textContent = '已载入';
  elements.saveButton.textContent = '保存';
  elements.saveButton.disabled = false;
  updateStats();
  updatePreview();
}

async function loadSection(section, options = {}) {
  if (!state.activeId) return false;
  const requestSequence = ++state.documentLoadSequence;
  const requestedId = state.activeId;
  const requestedLanguage = options.language || state.language;
  state.documentLoadsInFlight += 1;
  elements.editor.readOnly = true;
  elements.writingArea.setAttribute('aria-busy', 'true');
  try {
    if (!options.skipSave && !(await saveCurrent())) return false;
    if (requestSequence !== state.documentLoadSequence || requestedId !== state.activeId) {
      return false;
    }

    let payload;
    let taskDocument;
    if (section === 'article') {
      payload = await api(
        `/api/drafts/${encodeURIComponent(requestedId)}?lang=${requestedLanguage}`
      );
    } else {
      const workspace = await refreshWorkspace(requestedId);
      if (!workspace) return false;
      taskDocument = workspace.documents[section];
    }

    if (requestSequence !== state.documentLoadSequence || requestedId !== state.activeId) {
      return false;
    }
    state.section = section;
    if (section === 'article') state.language = requestedLanguage;
    document.querySelectorAll('.section-tab').forEach((tab) => {
      setTabState(tab, tab.dataset.section === section);
    });
    document.querySelectorAll('.language-tab').forEach((tab) => {
      setTabState(tab, tab.dataset.language === state.language);
    });
    document.querySelector('.language-tabs').classList.toggle('hidden', section !== 'article');
    updateWritingPanelLabel();

    if (section === 'article') {
      setEditorContent(
        payload.content,
        `.drafts/blog/${requestedId}/${requestedLanguage}.mdx`,
        payload.hash
      );
      elements.documentTitle.textContent = payload.metadata.title || requestedId;
    } else {
      setEditorContent(
        taskDocument.content,
        `.drafts/blog/${requestedId}/${taskDocument.file}`,
        taskDocument.hash
      );
    }
    return true;
  } finally {
    state.documentLoadsInFlight -= 1;
    if (state.documentLoadsInFlight === 0) {
      elements.editor.readOnly = false;
      elements.writingArea.removeAttribute('aria-busy');
    }
  }
}

async function loadDraft(id, preferredLanguage = state.language) {
  if (state.loading) return;
  state.loading = true;
  try {
    if (!(await saveCurrent())) return false;
    const selectedDraft = state.drafts.find((draft) => draft.id === id);
    if (selectedDraft?.columnId && selectedDraft.columnId !== state.activeColumnId) {
      state.activeColumnId = selectedDraft.columnId;
      renderColumnControls();
    }
    state.activeId = id;
    const draft = currentDraft();
    state.language = draft?.languages.includes(preferredLanguage)
      ? preferredLanguage
      : draft?.languages[0] || 'cn';
    const workspace = await refreshWorkspace(id);
    if (!workspace) return false;
    const entrySection = ['draft', 'polish', 'ready'].includes(workspace.task.stage)
      ? 'article'
      : 'outline';
    elements.documentTitle.textContent = draft?.title || id;
    elements.emptyState.classList.add('hidden');
    elements.writingArea.classList.remove('hidden');
    elements.validateButton.disabled = false;
    elements.draftSkillButton.disabled = false;
    elements.publicationPackageButton.disabled = false;
    elements.saveButton.disabled = false;
    elements.publishButton.disabled = Boolean(draft?.published);
    elements.publishButton.textContent = draft?.published ? '站点已有版本' : '发布到站点';
    document.querySelectorAll('.language-tab').forEach((tab) => {
      const selected = tab.dataset.language === state.language;
      setTabState(tab, selected);
      tab.disabled = !draft?.languages.includes(tab.dataset.language);
    });
    updateWritingPanelLabel();
    renderDraftList();
    await loadSection(entrySection, { skipSave: true });
    elements.syncStatus.textContent =
      state.workspace.taskMetadata && state.workspace.taskMetadata.status !== 'ready'
        ? 'task.json 异常；阶段更新已锁定，原文件仍保留'
        : '已连接 Codex 文件协作';
    return true;
  } finally {
    state.loading = false;
  }
}

function isCurrentDocument(snapshot) {
  return (
    state.activeId === snapshot.id &&
    state.section === snapshot.section &&
    (snapshot.section !== 'article' || state.language === snapshot.language)
  );
}

async function saveSnapshot(manual) {
  const snapshot = {
    id: state.activeId,
    section: state.section,
    language: state.language,
    content: elements.editor.value,
    revision: state.editRevision,
    baseHash: state.baseHash,
  };
  elements.saveStatus.textContent = manual ? '正在手动保存…' : '正在自动保存…';
  try {
    let result;
    if (snapshot.section === 'article') {
      result = await api(
        `/api/drafts/${encodeURIComponent(snapshot.id)}?lang=${snapshot.language}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content: snapshot.content, baseHash: snapshot.baseHash }),
        }
      );
    } else {
      result = await api(
        `/api/drafts/${encodeURIComponent(snapshot.id)}/documents/${snapshot.section}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content: snapshot.content, baseHash: snapshot.baseHash }),
        }
      );
    }
    if (isCurrentDocument(snapshot)) {
      state.baseHash = result.hash;
      state.content = snapshot.content;
      state.dirty =
        state.editRevision !== snapshot.revision || elements.editor.value !== snapshot.content;
      elements.saveStatus.textContent = state.dirty
        ? '保存期间出现新改动，继续保存…'
        : manual
          ? '已手动保存'
          : '已自动保存';
    }
    return true;
  } catch (error) {
    if (isCurrentDocument(snapshot) && error.payload?.currentHash) {
      state.saveConflict = { currentHash: error.payload.currentHash };
      state.dirty = true;
      elements.saveButton.textContent = '解决冲突';
      elements.saveStatus.textContent = '保存冲突：磁盘已有新版本，当前输入仍保留';
      showToast('Codex 或外部编辑器已修改此文件；浏览器内容没有覆盖磁盘');
    } else if (isCurrentDocument(snapshot)) {
      elements.saveStatus.textContent = `保存失败：${error.message}`;
    }
    return false;
  }
}

async function saveCurrent(options = {}) {
  const manual = Boolean(options.manual);
  if (!state.activeId) return true;

  if (state.saveConflict) {
    if (!manual) return false;
    const overwrite = confirm(
      'Codex 或外部编辑器已在磁盘写入新版本。\n\n确定：用当前浏览器内容覆盖该版本。\n取消：保持两边内容不变，先手动复制并比较。'
    );
    if (!overwrite) return false;
    state.baseHash = state.saveConflict.currentHash;
    state.saveConflict = null;
    elements.saveButton.textContent = '保存';
  }

  if (state.saveInFlight) {
    const saved = await state.saveInFlight;
    if (!saved) return false;
    if (state.dirty) return saveCurrent(options);
    if (manual) {
      elements.saveStatus.textContent = '内容已保存';
      showToast('当前内容已经保存');
    }
    return true;
  }

  if (!state.dirty) {
    if (manual) {
      elements.saveStatus.textContent = '内容已保存';
      showToast('当前内容已经保存');
    }
    return true;
  }

  const operation = saveSnapshot(manual);
  state.saveInFlight = operation;
  const saved = await operation;
  if (state.saveInFlight === operation) state.saveInFlight = null;
  if (!saved) return false;
  if (state.dirty) return saveCurrent(options);

  await Promise.allSettled([refreshState(), refreshWorkspace()]);
  if (manual) showToast('当前文件已手动保存');
  return true;
}

async function syncFromDisk() {
  if (
    state.mode !== 'writing' ||
    !state.activeId ||
    state.dirty ||
    state.loading ||
    state.documentLoadsInFlight
  )
    return;
  try {
    const previousStage = state.workspace?.task?.stage;
    await refreshWorkspace();
    let incoming;
    let incomingHash;
    if (state.section === 'article') {
      incoming = await api(
        `/api/drafts/${encodeURIComponent(state.activeId)}?lang=${state.language}`
      );
      incomingHash = incoming.hash;
      incoming = incoming.content;
    } else {
      incomingHash = state.workspace.documents[state.section].hash;
      incoming = state.workspace.documents[state.section].content;
    }
    if (incoming !== state.content) {
      setEditorContent(incoming, elements.documentPath.textContent, incomingHash);
      showToast('已载入 Codex 或外部软件写入的新内容');
    }
    if (previousStage !== state.workspace.task.stage) renderStages();
    elements.syncStatus.textContent = `已同步 ${new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    elements.syncStatus.textContent = '等待重新连接';
  }
}

function showResult(title, payload) {
  elements.resultTitle.textContent = title;
  if (payload.ok && !payload.warnings?.length) {
    elements.resultContent.innerHTML =
      '<div class="result-success">文章结构检查通过，可以继续写作或发布。</div>';
  } else {
    const sections = [];
    if (payload.errors?.length) {
      sections.push(
        `<section class="result-section"><h3>需要修正</h3><ul>${payload.errors
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></section>`
      );
    }
    if (payload.warnings?.length) {
      sections.push(
        `<section class="result-section"><h3>提醒</h3><ul>${payload.warnings
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></section>`
      );
    }
    elements.resultContent.innerHTML =
      sections.join('') ||
      `<div class="result-success">${escapeHtml(payload.message || '操作完成。')}</div>`;
  }
  elements.resultDialog.showModal();
}

async function uploadAsset(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  await api(`/api/drafts/${encodeURIComponent(state.activeId)}/assets`, {
    method: 'POST',
    body: JSON.stringify({ name: file.name, base64: btoa(binary) }),
  });
  await refreshWorkspace();
  renderAssets();
  showToast(`已保存图片 ${file.name}`);
}

async function insertAsset(name) {
  if (!(await loadSection('article'))) return;
  const editor = elements.editor;
  const insertion = `\n\n![${name.replace(/\.[^.]+$/, '')}](./images/${name})\n\n`;
  const start = editor.selectionStart;
  editor.value = `${editor.value.slice(0, start)}${insertion}${editor.value.slice(editor.selectionEnd)}`;
  editor.selectionStart = editor.selectionEnd = start + insertion.length;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.focus();
  showToast('图片引用已插入正文，请补充准确的 alt 与 caption');
}

function publicationPreviewDocument(packageData) {
  const language = elements.publicationLanguage.value;
  return `<!doctype html><html lang="${language === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><style>
    body{margin:0;padding:30px;background:#fff;color:#3f3d3a}
    @media(max-width:640px){body{padding:20px}}
  </style></head><body>${packageData.richHtml}</body></html>`;
}

async function copyPlainText(value) {
  if (!value) throw new Error('没有可以复制的内容');
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Older embedded browsers can expose the async API while denying it.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-10000px';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('浏览器未允许剪贴板访问');
}

async function copyRichText(html, plainText) {
  if (!html) {
    await copyPlainText(plainText);
    return;
  }
  if (navigator.clipboard?.write && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch {
      // Fall through to a selection copy for browsers with partial ClipboardItem support.
    }
  }

  const container = document.createElement('div');
  container.contentEditable = 'true';
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.innerHTML = html;
  document.body.append(container);
  const range = document.createRange();
  range.selectNodeContents(container);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const copied = document.execCommand('copy');
  selection.removeAllRanges();
  container.remove();
  if (!copied) throw new Error('浏览器未允许富文本剪贴板访问');
}

async function imageBlobAsPng(blob) {
  if (blob.type === 'image/png') return blob;
  let bitmap;
  let objectUrl = '';
  try {
    bitmap = await window.createImageBitmap(blob);
  } catch {
    objectUrl = URL.createObjectURL(blob);
    bitmap = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('浏览器无法读取这张图片'));
      image.src = objectUrl;
    });
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width || bitmap.naturalWidth;
  canvas.height = bitmap.height || bitmap.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建图片转换画布');
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (png) => (png ? resolve(png) : reject(new Error('图片转换失败'))),
      'image/png',
      1
    );
  });
}

async function copyPublicationImage(fileName) {
  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    throw new Error('当前浏览器不支持复制图片，请从文章图片面板手动上传');
  }
  const response = await fetch(
    `/api/drafts/${encodeURIComponent(state.activeId)}/assets/${encodeURIComponent(fileName)}`
  );
  if (!response.ok) throw new Error('本地任务中找不到这张图片');
  const png = await imageBlobAsPng(await response.blob());
  await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': png })]);
}

function renderPublicationPackage() {
  const packageData = state.publicationPackage;
  if (!packageData) return;
  const rich = packageData.platform.format === 'rich';
  elements.publicationFormat.textContent = rich ? '富文本 HTML' : '纯文本';
  elements.publicationFormat.dataset.format = packageData.platform.format;
  elements.publicationGuidance.textContent = packageData.platform.guidance;
  elements.publicationTitle.textContent = packageData.metadata.title || '未填写标题';
  elements.publicationCanonical.textContent = packageData.metadata.canonicalUrl || '尚无原文链接';
  elements.copyPublicationLink.disabled = !packageData.metadata.canonicalUrl;
  elements.copyPublicationTitle.disabled = !packageData.metadata.title;
  elements.copyPublicationPlain.disabled = !packageData.plainText;
  elements.copyPublicationMain.disabled = !packageData.plainText;
  if (packageData.metadata.canonicalUrl) {
    elements.publicationCanonical.href = packageData.metadata.canonicalUrl;
  } else {
    elements.publicationCanonical.removeAttribute('href');
  }
  elements.publicationCount.textContent = `${packageData.characterCount} 字符`;
  elements.publicationPreviewLabel.textContent = rich ? '正文（不含标题）' : '完整发布文案';
  elements.copyPublicationMain.textContent = packageData.platform.actionLabel;
  elements.copyPublicationPlain.textContent = rich ? '复制纯文本' : '复制备用纯文本';
  elements.openPublicationPlatform.href = packageData.platform.editorUrl;
  elements.openPublicationPlatform.textContent = packageData.platform.editorLabel;

  elements.publicationRichPreview.classList.toggle('hidden', !rich);
  elements.publicationPlainPreview.classList.toggle('hidden', rich);
  if (rich) {
    elements.publicationRichPreview.srcdoc = publicationPreviewDocument(packageData);
  } else {
    elements.publicationRichPreview.srcdoc = '';
    elements.publicationPlainPreview.value = packageData.plainText;
  }

  const workspaceAssets = new Set((state.workspace?.assets || []).map((asset) => asset.name));
  elements.publicationAssets.classList.toggle('hidden', !packageData.assets.length);
  elements.publicationAssetCount.textContent = `${packageData.assets.length} 张`;
  elements.publicationAssetList.innerHTML = packageData.assets
    .map((asset) => {
      const exists = asset.fileName && workspaceAssets.has(asset.fileName);
      const url = exists
        ? `/api/drafts/${encodeURIComponent(state.activeId)}/assets/${encodeURIComponent(
            asset.fileName
          )}`
        : '';
      const kind = asset.kind === 'cover' ? '封面' : `正文 ${asset.index}`;
      const description = asset.caption || asset.alt || asset.fileName || '未识别图片';
      return `<article class="publication-asset-item">
        ${
          exists
            ? `<img src="${url}" alt="${escapeHtml(description)}">`
            : '<div class="publication-asset-missing" aria-hidden="true">缺图</div>'
        }
        <div><span>${escapeHtml(kind)}</span><strong>${escapeHtml(description)}</strong><small>${escapeHtml(
          asset.fileName || 'MDX 中未解析出文件名'
        )}</small></div>
        <button class="button secondary" data-copy-publication-image="${escapeHtml(
          asset.fileName
        )}" type="button" ${exists ? '' : 'disabled'}>${exists ? '复制图片' : '需手动补充'}</button>
      </article>`;
    })
    .join('');

  elements.publicationWarnings.classList.toggle('hidden', !packageData.warnings.length);
  elements.publicationWarnings.innerHTML = packageData.warnings.length
    ? `<strong>发布前复核</strong><ul>${packageData.warnings
        .map((warning) => `<li>${escapeHtml(warning)}</li>`)
        .join('')}</ul>`
    : '';
}

function setPublicationPackageLoading() {
  state.publicationPackage = null;
  elements.publicationFormat.textContent = '正在生成';
  elements.publicationFormat.dataset.format = 'loading';
  elements.publicationGuidance.textContent = '正在从本地文章生成目标平台版本……';
  elements.publicationTitle.textContent = '—';
  elements.publicationCanonical.textContent = '—';
  elements.publicationCanonical.removeAttribute('href');
  elements.publicationCount.textContent = '0 字符';
  elements.publicationRichPreview.srcdoc = '';
  elements.publicationPlainPreview.value = '';
  elements.publicationAssets.classList.add('hidden');
  elements.publicationAssetList.innerHTML = '';
  elements.publicationWarnings.classList.add('hidden');
  elements.publicationWarnings.innerHTML = '';
  elements.openPublicationPlatform.removeAttribute('href');
  elements.openPublicationPlatform.textContent = '打开平台编辑器';
  elements.copyPublicationTitle.disabled = true;
  elements.copyPublicationLink.disabled = true;
  elements.copyPublicationPlain.disabled = true;
  elements.copyPublicationMain.disabled = true;
}

async function refreshPublicationPackage() {
  const requestSequence = ++state.publicationRequestSequence;
  const language = elements.publicationLanguage.value;
  const platformId = elements.publicationPlatform.value;
  setPublicationPackageLoading();
  try {
    const payload = await api(
      `/api/drafts/${encodeURIComponent(state.activeId)}?lang=${encodeURIComponent(language)}`
    );
    if (requestSequence !== state.publicationRequestSequence) return;
    state.publicationPackage = buildPublicationPackage({
      source: payload.content,
      platformId,
      articleId: state.activeId,
      language,
      published: Boolean(currentDraft()?.published),
    });
    const availableAssets = new Set((state.workspace?.assets || []).map((asset) => asset.name));
    const missingAssets = state.publicationPackage.assets.filter(
      (asset) => !asset.fileName || !availableAssets.has(asset.fileName)
    );
    if (missingAssets.length) {
      state.publicationPackage.warnings.push(
        `${missingAssets.length} 张图片未在草稿或已发布文章目录中找到，不能一键复制。`
      );
    }
    renderPublicationPackage();
  } catch (error) {
    showToast(`发布包生成失败：${error.message}`);
  }
}

async function openPublicationPackage() {
  if (!state.activeId || !(await saveCurrent())) return;
  await refreshWorkspace();
  elements.publicationPlatform.innerHTML = PUBLICATION_PLATFORMS.map(
    (platform) =>
      `<option value="${escapeHtml(platform.id)}">${escapeHtml(platform.label)}</option>`
  ).join('');
  const defaultPlatformId = state.language === 'en' ? 'medium' : 'wechat';
  elements.publicationPlatform.value = defaultPlatformId;
  elements.publicationLanguage.innerHTML = (currentDraft()?.languages || [])
    .map(
      (language) =>
        `<option value="${escapeHtml(language)}">${language === 'cn' ? '中文' : 'English'}</option>`
    )
    .join('');
  const preferredLanguage = PUBLICATION_PLATFORMS.find(
    (platform) => platform.id === defaultPlatformId
  )?.defaultLanguage;
  elements.publicationLanguage.value = currentDraft()?.languages.includes(preferredLanguage)
    ? preferredLanguage
    : state.language;
  elements.publicationPackageDialog.showModal();
  await refreshPublicationPackage();
}

elements.draftList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-id]');
  if (button && (await setMode('writing'))) await loadDraft(button.dataset.id);
});

elements.columnSelect.addEventListener('change', async () => {
  const previousColumnId = state.activeColumnId;
  const nextColumnId = elements.columnSelect.value;
  if (state.mode === 'ideas' && !confirmDiscardIdeaForm()) {
    elements.columnSelect.value = previousColumnId;
    return;
  }
  if (state.mode === 'writing' && !(await saveCurrent())) {
    elements.columnSelect.value = previousColumnId;
    return;
  }
  if (state.mode === 'ideas') resetIdeaForm();
  state.activeColumnId = nextColumnId;
  state.activeId = '';
  state.workspace = null;
  renderColumnControls();
  renderDraftList();
  if (state.mode === 'ideas') {
    resetIdeaForm();
    await refreshIdeas();
    return;
  }
  const [draft] = columnDrafts();
  if (draft) await loadDraft(draft.id);
  else await setMode('writing');
});

document.querySelectorAll('.studio-mode-tab').forEach((tab) => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

elements.newIdeaButton.addEventListener('click', async () => {
  if (await setMode('ideas')) elements.ideaForm.elements.body.focus();
});

elements.ideaStatusFilter.addEventListener('change', () => {
  state.ideaFilter = elements.ideaStatusFilter.value;
  renderIdeas();
});

elements.ideasList.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-idea-status]');
  if (!select) return;
  try {
    await api(`/api/ideas/${encodeURIComponent(select.dataset.ideaStatus)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: select.value }),
    });
    await refreshIdeas();
    await refreshState();
    showToast(`Idea 状态已更新为 ${select.options[select.selectedIndex].textContent}`);
  } catch (error) {
    showToast(`状态更新失败：${error.message}`);
  }
});

elements.ideasList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-idea]');
  if (button) startEditingIdea(button.dataset.editIdea);
});

elements.ideaForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(elements.ideaForm));
  payload.columnId = state.activeColumnId;
  try {
    if (state.editingIdeaId) {
      await api(`/api/ideas/${encodeURIComponent(state.editingIdeaId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      showToast('Idea 已保存');
    } else {
      await api('/api/ideas', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Idea 已进入收件箱');
    }
    resetIdeaForm();
    await refreshIdeas();
    await refreshState();
  } catch (error) {
    showToast(`Idea 保存失败：${error.message}`);
  }
});

elements.ideaForm.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    elements.ideaForm.requestSubmit();
  }
});

elements.ideaForm.addEventListener('input', () => {
  state.ideaFormDirty = true;
});

elements.cancelIdeaEdit.addEventListener('click', resetIdeaForm);

elements.editor.addEventListener('input', () => {
  state.content = elements.editor.value;
  state.editRevision += 1;
  state.dirty = true;
  elements.saveStatus.textContent = '尚未保存';
  updateStats();
  updatePreview();
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveCurrent, 700);
});

elements.saveButton.addEventListener('click', async () => {
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  await saveCurrent({ manual: true });
});

document.addEventListener('keydown', async (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  await saveCurrent({ manual: true });
});

document.querySelectorAll('.section-tab').forEach((tab) => {
  tab.addEventListener('click', () => loadSection(tab.dataset.section));
});

document.querySelectorAll('.language-tab').forEach((tab) => {
  tab.addEventListener('click', async () => {
    await loadSection('article', { language: tab.dataset.language });
  });
});

document.querySelectorAll('.view-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    elements.writingArea.classList.remove('write-view', 'preview-view');
    if (tab.dataset.view !== 'split') {
      elements.writingArea.classList.add(`${tab.dataset.view}-view`);
    }
  });
});

elements.stageList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-stage]');
  if (!button || !state.activeId) return;
  try {
    const payload = await api(`/api/drafts/${encodeURIComponent(state.activeId)}/task`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: button.dataset.stage }),
    });
    state.workspace.task = payload.task;
    renderStages();
    await refreshState();
    showToast(`任务阶段已更新为 ${button.textContent}`);
  } catch (error) {
    showToast(`阶段更新失败：${error.message}`);
  }
});

elements.draftSkillButton.addEventListener('click', async () => {
  if (!(await saveCurrent())) return;
  const command = state.workspace.skills.draft.command;
  elements.skillCommand.textContent = command;
  elements.skillDialog.showModal();
});

elements.publicationPackageButton.addEventListener('click', openPublicationPackage);

elements.publicationPlatform.addEventListener('change', async () => {
  const platform = PUBLICATION_PLATFORMS.find(
    (candidate) => candidate.id === elements.publicationPlatform.value
  );
  if (currentDraft()?.languages.includes(platform?.defaultLanguage)) {
    elements.publicationLanguage.value = platform.defaultLanguage;
  }
  await refreshPublicationPackage();
});

elements.publicationLanguage.addEventListener('change', refreshPublicationPackage);

elements.copyPublicationTitle.addEventListener('click', async () => {
  try {
    await copyPlainText(state.publicationPackage?.metadata.title || '');
    showToast('文章标题已复制');
  } catch (error) {
    showToast(`复制失败：${error.message}`);
  }
});

elements.copyPublicationLink.addEventListener('click', async () => {
  try {
    await copyPlainText(state.publicationPackage?.metadata.canonicalUrl || '');
    showToast('原文链接已复制');
  } catch (error) {
    showToast(`复制失败：${error.message}`);
  }
});

elements.copyPublicationPlain.addEventListener('click', async () => {
  try {
    await copyPlainText(state.publicationPackage?.plainText || '');
    showToast('纯文本发布内容已复制');
  } catch (error) {
    showToast(`复制失败：${error.message}`);
  }
});

elements.copyPublicationMain.addEventListener('click', async () => {
  const packageData = state.publicationPackage;
  if (!packageData) return;
  try {
    if (packageData.platform.format === 'rich') {
      await copyRichText(packageData.richHtml, packageData.plainText);
      showToast('带排版正文已复制；请粘贴到平台编辑器并复核图片位置');
    } else {
      await copyPlainText(packageData.plainText);
      showToast('平台发布文案已复制');
    }
  } catch (error) {
    showToast(`复制失败：${error.message}`);
  }
});

elements.publicationAssetList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy-publication-image]');
  if (!button || button.disabled) return;
  try {
    button.disabled = true;
    await copyPublicationImage(button.dataset.copyPublicationImage);
    showToast(`图片 ${button.dataset.copyPublicationImage} 已复制为 PNG`);
  } catch (error) {
    showToast(`图片复制失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
});

elements.copySkill.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(elements.skillCommand.textContent);
    showToast('Skill 调用已复制，可粘贴到当前 Codex 任务');
  } catch {
    showToast('浏览器未允许剪贴板访问，请手动复制上方 Skill 调用');
  }
});

elements.validateButton.addEventListener('click', async () => {
  if (!(await saveCurrent())) return;
  try {
    const result = await api(`/api/drafts/${encodeURIComponent(state.activeId)}/validate`, {
      method: 'POST',
    });
    showResult('文章检查结果', result);
  } catch (error) {
    showResult('检查失败', { errors: [error.message] });
  }
});

elements.publishButton.addEventListener('click', async () => {
  if (!confirm('确认把正文和文章图片复制到正式站点内容目录吗？')) return;
  if (!(await saveCurrent())) return;
  try {
    const result = await api(`/api/drafts/${encodeURIComponent(state.activeId)}/publish`, {
      method: 'POST',
    });
    showResult('已发布到站点目录', { ok: true, message: `已写入 ${result.target}` });
    await refreshState();
    await loadDraft(state.activeId);
  } catch (error) {
    showResult('暂时不能发布', error.payload?.details || { errors: [error.message] });
  }
});

elements.uploadButton.addEventListener('click', () => elements.assetInput.click());
elements.assetInput.addEventListener('change', async () => {
  const [file] = elements.assetInput.files;
  if (!file) return;
  try {
    await uploadAsset(file);
  } catch (error) {
    showToast(`图片上传失败：${error.message}`);
  } finally {
    elements.assetInput.value = '';
  }
});

elements.assetGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-insert-asset]');
  if (button) insertAsset(button.dataset.insertAsset);
});

function openNewDraftDialog() {
  if (!currentColumn()?.capabilities.drafts) {
    showToast('这个栏目尚未固定发布格式，请先记录 Idea');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  elements.newDraftForm.elements.year.value = today.slice(0, 4);
  elements.newDraftForm.elements.date.value = today;
  elements.newDraftColumn.value = state.activeColumnId;
  elements.newDraftDialog.showModal();
  elements.newDraftForm.elements.title.focus();
}

elements.newDraftButton.addEventListener('click', openNewDraftDialog);
elements.closeDialog.addEventListener('click', () => elements.newDraftDialog.close());
elements.cancelDialog.addEventListener('click', () => elements.newDraftDialog.close());
elements.closeResult.addEventListener('click', () => elements.resultDialog.close());
elements.confirmResult.addEventListener('click', () => elements.resultDialog.close());
elements.closeSkill.addEventListener('click', () => elements.skillDialog.close());
elements.confirmSkill.addEventListener('click', () => elements.skillDialog.close());
elements.closePublicationPackage.addEventListener('click', () =>
  elements.publicationPackageDialog.close()
);

elements.newDraftForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.mode === 'ideas' && !confirmDiscardIdeaForm()) return;
  const discardIdeaAfterCreate = state.mode === 'ideas';
  const input = Object.fromEntries(new FormData(elements.newDraftForm));
  try {
    const result = await api('/api/drafts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    elements.newDraftDialog.close();
    elements.newDraftForm.reset();
    state.activeColumnId = input.columnId;
    await refreshState();
    if (discardIdeaAfterCreate) resetIdeaForm();
    if (await setMode('writing')) await loadDraft(result.id, 'cn');
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener('focus', syncFromDisk);
state.syncTimer = setInterval(syncFromDisk, 2800);

document.querySelectorAll('[role="tablist"]').forEach(enableTabKeyboardNavigation);

await refreshState();
const [initialDraft] = columnDrafts();
if (initialDraft) await loadDraft(initialDraft.id);
else await setMode('writing');
