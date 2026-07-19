const state = {
  drafts: [],
  activeId: '',
  language: 'cn',
  section: 'outline',
  content: '',
  workspace: null,
  dirty: false,
  loading: false,
  saveTimer: null,
  syncTimer: null,
  toastTimer: null,
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
    'document-path',
    'document-title',
    'save-status',
    'save-button',
    'sync-status',
    'stage-list',
    'draft-skill-button',
    'validate-button',
    'publish-button',
    'empty-state',
    'writing-area',
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
    'toast',
  ].map((id) => [
    id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
    document.querySelector(`#${id}`),
  ])
);

async function api(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const payload = await response.json();
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

function renderDraftList() {
  elements.draftCount.textContent = String(state.drafts.length);
  elements.draftList.innerHTML = state.drafts
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
}

function renderStages() {
  if (!state.workspace) {
    elements.stageList.innerHTML = '';
    return;
  }
  const activeIndex = state.workspace.stages.findIndex(
    (stage) => stage.id === state.workspace.task.stage
  );
  elements.stageList.innerHTML = state.workspace.stages
    .map(
      (stage, index) =>
        `<button class="stage-button ${index < activeIndex ? 'done' : ''} ${
          index === activeIndex ? 'active' : ''
        }" data-stage="${stage.id}" type="button">${escapeHtml(stage.label)}</button>`
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

async function refreshState() {
  const payload = await api('/api/state');
  state.drafts = payload.drafts;
  renderDraftList();
}

async function refreshWorkspace() {
  state.workspace = await api(`/api/drafts/${encodeURIComponent(state.activeId)}/workspace`);
  renderStages();
  renderAssets();
}

function setEditorContent(content, pathLabel) {
  state.content = content;
  state.dirty = false;
  elements.editor.value = content;
  elements.documentPath.textContent = pathLabel;
  elements.editorLabel.textContent = sectionLabels[state.section];
  elements.previewLabel.textContent = '阅读预览';
  elements.saveStatus.textContent = '已载入';
  elements.saveButton.disabled = false;
  updateStats();
  updatePreview();
}

async function loadSection(section, options = {}) {
  if (!state.activeId) return;
  if (!options.skipSave) await saveCurrent();
  state.section = section;
  document.querySelectorAll('.section-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.section === section);
  });
  const languageTabs = document.querySelector('.language-tabs');
  languageTabs.classList.toggle('hidden', section !== 'article');

  if (section === 'article') {
    const payload = await api(
      `/api/drafts/${encodeURIComponent(state.activeId)}?lang=${state.language}`
    );
    setEditorContent(payload.content, `.drafts/blog/${state.activeId}/${state.language}.mdx`);
    elements.documentTitle.textContent = payload.metadata.title || state.activeId;
  } else {
    await refreshWorkspace();
    const document = state.workspace.documents[section];
    setEditorContent(document.content, `.drafts/blog/${state.activeId}/${document.file}`);
  }
}

async function loadDraft(id, preferredLanguage = state.language) {
  if (state.loading) return;
  state.loading = true;
  try {
    await saveCurrent();
    state.activeId = id;
    const draft = currentDraft();
    state.language = draft?.languages.includes(preferredLanguage)
      ? preferredLanguage
      : draft?.languages[0] || 'cn';
    await refreshWorkspace();
    const entrySection = ['draft', 'polish', 'ready'].includes(state.workspace.task.stage)
      ? 'article'
      : 'outline';
    elements.documentTitle.textContent = draft?.title || id;
    elements.emptyState.classList.add('hidden');
    elements.writingArea.classList.remove('hidden');
    elements.validateButton.disabled = false;
    elements.draftSkillButton.disabled = false;
    elements.saveButton.disabled = false;
    elements.publishButton.disabled = Boolean(draft?.published);
    elements.publishButton.textContent = draft?.published ? '站点已有版本' : '发布到站点';
    document.querySelectorAll('.language-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.language === state.language);
      tab.disabled = !draft?.languages.includes(tab.dataset.language);
    });
    renderDraftList();
    await loadSection(entrySection, { skipSave: true });
    elements.syncStatus.textContent = '已连接 Codex 文件协作';
  } finally {
    state.loading = false;
  }
}

async function saveCurrent(options = {}) {
  const manual = Boolean(options.manual);
  if (!state.activeId) return false;
  if (!state.dirty) {
    if (manual) {
      elements.saveStatus.textContent = '内容已保存';
      showToast('当前内容已经保存');
    }
    return true;
  }
  const content = elements.editor.value;
  elements.saveStatus.textContent = manual ? '正在手动保存…' : '正在自动保存…';
  try {
    if (state.section === 'article') {
      await api(`/api/drafts/${encodeURIComponent(state.activeId)}?lang=${state.language}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
    } else {
      await api(`/api/drafts/${encodeURIComponent(state.activeId)}/documents/${state.section}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
    }
    state.content = content;
    state.dirty = false;
    elements.saveStatus.textContent = manual ? '已手动保存' : '已自动保存';
    if (manual) showToast('当前文件已手动保存');
    await refreshState();
    await refreshWorkspace();
    return true;
  } catch (error) {
    elements.saveStatus.textContent = `保存失败：${error.message}`;
    return false;
  }
}

async function syncFromDisk() {
  if (!state.activeId || state.dirty || state.loading) return;
  try {
    const previousStage = state.workspace?.task?.stage;
    await refreshWorkspace();
    let incoming;
    if (state.section === 'article') {
      incoming = await api(
        `/api/drafts/${encodeURIComponent(state.activeId)}?lang=${state.language}`
      );
      incoming = incoming.content;
    } else {
      incoming = state.workspace.documents[state.section].content;
    }
    if (incoming !== state.content) {
      setEditorContent(incoming, elements.documentPath.textContent);
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
  await loadSection('article');
  const editor = elements.editor;
  const insertion = `\n\n![${name.replace(/\.[^.]+$/, '')}](./images/${name})\n\n`;
  const start = editor.selectionStart;
  editor.value = `${editor.value.slice(0, start)}${insertion}${editor.value.slice(editor.selectionEnd)}`;
  editor.selectionStart = editor.selectionEnd = start + insertion.length;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.focus();
  showToast('图片引用已插入正文，请补充准确的 alt 与 caption');
}

elements.draftList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-id]');
  if (button) loadDraft(button.dataset.id);
});

elements.editor.addEventListener('input', () => {
  state.content = elements.editor.value;
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
    await saveCurrent();
    state.language = tab.dataset.language;
    document.querySelectorAll('.language-tab').forEach((item) => {
      item.classList.toggle('active', item.dataset.language === state.language);
    });
    await loadSection('article', { skipSave: true });
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
  const payload = await api(`/api/drafts/${encodeURIComponent(state.activeId)}/task`, {
    method: 'PATCH',
    body: JSON.stringify({ stage: button.dataset.stage }),
  });
  state.workspace.task = payload.task;
  renderStages();
  await refreshState();
  showToast(`任务阶段已更新为 ${button.textContent}`);
});

elements.draftSkillButton.addEventListener('click', async () => {
  await saveCurrent();
  const command = state.workspace.skills.draft.command;
  elements.skillCommand.textContent = command;
  elements.skillDialog.showModal();
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
  await saveCurrent();
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
  await saveCurrent();
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
  const today = new Date().toISOString().slice(0, 10);
  elements.newDraftForm.elements.year.value = today.slice(0, 4);
  elements.newDraftForm.elements.date.value = today;
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

elements.newDraftForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(elements.newDraftForm));
  try {
    const result = await api('/api/drafts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    elements.newDraftDialog.close();
    elements.newDraftForm.reset();
    await refreshState();
    await loadDraft(result.id, 'cn');
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener('focus', syncFromDisk);
state.syncTimer = setInterval(syncFromDisk, 2800);

await refreshState();
if (state.drafts[0]) await loadDraft(state.drafts[0].id);
