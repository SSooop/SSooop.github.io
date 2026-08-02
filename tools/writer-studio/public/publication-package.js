const SITE_ORIGIN = 'https://ssooop.github.io';

export const PUBLICATION_PLATFORMS = [
  {
    id: 'wechat',
    label: '微信公众号',
    format: 'rich',
    defaultLanguage: 'cn',
    actionLabel: '复制带排版正文',
    guidance: '复制正文后粘贴到图文编辑器；标题和图片请使用下方独立按钮补齐。',
    editorUrl: 'https://mp.weixin.qq.com/',
    editorLabel: '打开公众号后台',
  },
  {
    id: 'xueqiu',
    label: '雪球长文',
    format: 'rich',
    defaultLanguage: 'cn',
    actionLabel: '复制带排版正文',
    guidance: '适合粘贴到雪球长文编辑器；发布前检查链接、图片位置和免责声明。',
    editorUrl: 'https://xueqiu.com/',
    editorLabel: '打开雪球',
  },
  {
    id: 'medium',
    label: 'Medium',
    format: 'rich',
    defaultLanguage: 'en',
    actionLabel: '复制带排版正文',
    guidance: '已上线文章优先使用 Medium Import；剪贴板正文适合草稿或 Import 后修订。',
    editorUrl: 'https://medium.com/p/import',
    editorLabel: '打开 Medium Import',
  },
  {
    id: 'linkedin-article',
    label: 'LinkedIn 长文',
    format: 'rich',
    defaultLanguage: 'en',
    actionLabel: '复制带排版正文',
    guidance: '粘贴到 LinkedIn Article 编辑器后，再设置封面、标题与原文链接。',
    editorUrl: 'https://www.linkedin.com/article/new/',
    editorLabel: '打开 LinkedIn 长文',
  },
  {
    id: 'x-article',
    label: 'X Article',
    format: 'rich',
    defaultLanguage: 'en',
    actionLabel: '复制带排版正文',
    guidance: '适合粘贴到 X Article 编辑器；发布前检查标题、图片、链接与排版。',
    editorUrl: 'https://x.com/compose/articles',
    editorLabel: '打开 X Article',
  },
  {
    id: 'linkedin-post',
    label: 'LinkedIn 动态',
    format: 'plain',
    defaultLanguage: 'en',
    actionLabel: '复制发布文案',
    guidance: '动态不接收富文本；这里生成标题、导语和回站链接组成的精简文案。',
    editorUrl: 'https://www.linkedin.com/feed/',
    editorLabel: '打开 LinkedIn',
  },
  {
    id: 'x-post',
    label: 'X 帖子',
    format: 'plain',
    defaultLanguage: 'en',
    actionLabel: '复制发布文案',
    guidance: '生成一条长度保守的引流帖；可与 X Article 配合发布，引导读者阅读全文。',
    editorUrl: 'https://x.com/compose/post',
    editorLabel: '打开 X 发帖',
  },
];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function unquote(value = '') {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function scalar(frontmatter, key) {
  return unquote(frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1] || '');
}

function nestedScalar(frontmatter, parent, key) {
  const section = frontmatter.match(
    new RegExp(`^${parent}:\\s*\\r?\\n([\\s\\S]*?)(?=^[^ \\t\\r\\n]|\\s*$)`, 'm')
  )?.[1];
  return unquote(section?.match(new RegExp(`^[ \\t]+${key}:\\s*(.+)$`, 'm'))?.[1] || '');
}

function absoluteUrl(value, siteOrigin = SITE_ORIGIN) {
  if (!value) return '';
  try {
    return new URL(value, siteOrigin).href;
  } catch {
    return value;
  }
}

function extractArticle(source, articleId, language, siteOrigin) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = match?.[1] || '';
  const canonicalPath = nestedScalar(frontmatter, 'canonical', 'url');
  const fallbackPath = articleId
    ? `/${language === 'en' ? 'en' : 'zh'}/blog/${articleId}/${language}`
    : '';
  return {
    body: match ? source.slice(match[0].length) : source,
    metadata: {
      title: scalar(frontmatter, 'title'),
      date: scalar(frontmatter, 'date'),
      description: scalar(frontmatter, 'description'),
      canonicalUrl: absoluteUrl(canonicalPath || fallbackPath, siteOrigin),
      cover: scalar(frontmatter, 'image'),
      coverAlt: scalar(frontmatter, 'imageAlt'),
      coverCaption: scalar(frontmatter, 'imageCaption'),
      coverSource: scalar(frontmatter, 'imageSource'),
      coverSourceUrl: scalar(frontmatter, 'imageSourceUrl'),
    },
  };
}

function quotedAttribute(source, name) {
  const attribute = source.match(new RegExp(`(?:^|[\\s<])${name}\\s*=\\s*(["'])`));
  if (!attribute) return '';

  const quote = attribute[1];
  const start = (attribute.index || 0) + attribute[0].length;
  let value = '';
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\' && index + 1 < source.length) {
      const escaped = source[index + 1];
      if (escaped === quote || escaped === '\\' || escaped === '"' || escaped === "'") {
        value += escaped;
        index += 1;
        continue;
      }
    }
    if (character === quote) return value;
    value += character;
  }
  return '';
}

function transformOutsideFencedCode(source, transform) {
  const lines = source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
  const output = [];
  let outside = '';
  let fence = null;

  const flushOutside = () => {
    if (!outside) return;
    output.push(transform(outside));
    outside = '';
  };

  for (const line of lines) {
    if (!line) continue;
    const content = line.replace(/(?:\r\n|\n|\r)$/, '');
    if (fence) {
      output.push(line);
      const closing = content.match(/^[ \t]{0,3}(`+|~+)[ \t]*$/);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }

    const opening = content.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (opening) {
      flushOutside();
      fence = { character: opening[1][0], length: opening[1].length };
      output.push(line);
      continue;
    }
    outside += line;
  }
  flushOutside();
  return output.join('');
}

function inlineCodeRanges(source) {
  const ranges = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('`', cursor);
    if (start === -1) break;
    let delimiterLength = 1;
    while (source[start + delimiterLength] === '`') delimiterLength += 1;

    let search = start + delimiterLength;
    let end = -1;
    while (search < source.length) {
      const candidate = source.indexOf('`', search);
      if (candidate === -1) break;
      let candidateLength = 1;
      while (source[candidate + candidateLength] === '`') candidateLength += 1;
      if (candidateLength === delimiterLength) {
        end = candidate + candidateLength;
        break;
      }
      search = candidate + candidateLength;
    }
    if (end === -1) break;
    ranges.push([start, end]);
    cursor = end;
  }
  return ranges;
}

function transformOutsideInlineCode(source, transform) {
  const ranges = inlineCodeRanges(source);
  if (!ranges.length) return transform(source);

  const output = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    output.push(transform(source.slice(cursor, start)), source.slice(start, end));
    cursor = end;
  }
  output.push(transform(source.slice(cursor)));
  return output.join('');
}

function importedAssets(body) {
  const imports = new Map();
  transformOutsideFencedCode(body, (source) => {
    for (const match of source.matchAll(
      /^import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\.\/images\/([^'"]+)['"];?\s*$/gm
    )) {
      imports.set(match[1], match[2]);
    }
    return source;
  });
  return imports;
}

function stripMdxPreamble(body) {
  return transformOutsideFencedCode(body, (source) =>
    source
      .replace(/^import[^\n]*;?\s*$/gm, '')
      .replace(/^export\s+const\s+[\s\S]*?^(?:\];|\};)\s*$/gm, '')
  ).trim();
}

function downgradeRawDivBlocks(body, warnings) {
  const lines = body.split(/\r?\n/);
  const output = [];
  let depth = 0;
  let raw = [];

  const flush = () => {
    const text = raw
      .join('\n')
      .replace(/<\/?(?:div|h[1-6]|p|ul|ol|li|br)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n\n');
    if (text) output.push('', text, '');
    raw = [];
    warnings.add('正文含站点专用 HTML 区块；发布包已保留文字并移除站点样式。');
  };

  for (const line of lines) {
    const opens = (line.match(/<div\b/gi) || []).length;
    const closes = (line.match(/<\/div>/gi) || []).length;
    if (depth > 0 || opens > 0) {
      raw.push(line);
      depth += opens - closes;
      if (depth <= 0) {
        depth = 0;
        flush();
      }
      continue;
    }
    output.push(line);
  }
  if (raw.length) flush();
  return output.join('\n');
}

function preprocessComponents(body, imports, assets, warnings) {
  let bodyImageIndex = 0;
  return transformOutsideFencedCode(body, (source) =>
    transformOutsideInlineCode(source, (plainSource) => {
      const components = plainSource
        .replace(
          /<([A-Z][A-Za-z0-9]*)\b(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^<>"'])*?\/>/g,
          (component, name) => {
            if (name === 'ArticleImage') {
              const variable = component.match(/\bsrc\s*=\s*\{([A-Za-z_$][\w$]*)\}/)?.[1] || '';
              const fileName = imports.get(variable) || '';
              const caption = quotedAttribute(component, 'caption');
              const alt = quotedAttribute(component, 'alt');
              const sourceLabel = quotedAttribute(component, 'source');
              const sourceUrl = quotedAttribute(component, 'sourceUrl');
              bodyImageIndex += 1;
              assets.push({
                kind: 'body',
                index: 0,
                componentId: bodyImageIndex,
                fileName,
                caption,
                alt,
                source: sourceLabel,
                sourceUrl,
              });
              return `\n@@PUBLICATION_ASSET_${bodyImageIndex}@@\n`;
            }

            if (name === 'ArticleDataTable') {
              const caption = quotedAttribute(component, 'caption');
              const sourceLabel = quotedAttribute(component, 'source');
              warnings.add(
                '正文含站点数据表；发布包保留了位置与说明，请在平台编辑器中补充表格或截图。'
              );
              const encodedCaption = encodeURIComponent(caption).replaceAll('_', '%5F');
              const encodedSource = encodeURIComponent(sourceLabel).replaceAll('_', '%5F');
              return `\n@@PUBLICATION_TABLE_${encodedCaption}_${encodedSource}@@\n`;
            }

            warnings.add(`正文含 ${name} 组件；发布包已用人工复核标记替代。`);
            return `\n@@PUBLICATION_COMPONENT_${name}@@\n`;
          }
        )
        .replace(
          /<([A-Z][A-Za-z0-9]*)\b(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^<>"'])*?>/g,
          (_, name) => {
            warnings.add(`正文含 ${name} 组件；发布包已保留组件内文字并添加人工复核标记。`);
            return `\n@@PUBLICATION_COMPONENT_${name}@@\n`;
          }
        )
        .replace(/<\/([A-Z][A-Za-z0-9]*)\s*>/g, (_, name) => {
          warnings.add(`正文含 ${name} 组件；发布包已保留组件内文字并添加人工复核标记。`);
          return '\n';
        });
      return downgradeRawDivBlocks(components, warnings);
    })
  );
}

function normalizeMarkdownLinks(body, siteOrigin) {
  return transformOutsideFencedCode(body, (source) =>
    source.replace(/\[([^\]]+)]\((\/[^\s)]+)\)/g, (_, label, url) => {
      return `[${label}](${absoluteUrl(url, siteOrigin)})`;
    })
  );
}

function codeFence(line) {
  const match = line.match(/^[ \t]{0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  return {
    character: match[1][0],
    length: match[1].length,
    language: match[2].trim(),
  };
}

function closesCodeFence(line, fence) {
  const match = line.match(/^[ \t]{0,3}(`+|~+)[ \t]*$/);
  return Boolean(match && match[1][0] === fence.character && match[1].length >= fence.length);
}

function unescapeMarkdownValue(value) {
  return value.replace(/\\([\\`*{}[\]()#+.!_>~'" -])/g, '$1');
}

function isEscapedMarkdownPosition(source, position) {
  let backslashes = 0;
  for (let index = position - 1; index >= 0 && source[index] === '\\'; index -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function markdownImageCandidateStarts(line) {
  const ranges = inlineCodeRanges(line);
  const starts = [];
  let cursor = 0;
  while (cursor < line.length) {
    const start = line.indexOf('![', cursor);
    if (start === -1) break;
    const insideCode = ranges.some(([rangeStart, rangeEnd]) => {
      return start >= rangeStart && start < rangeEnd;
    });
    if (!insideCode && !isEscapedMarkdownPosition(line, start)) starts.push(start);
    cursor = start + 2;
  }
  return starts;
}

function parseMarkdownImageAt(source, start) {
  if (!source.startsWith('![', start) || isEscapedMarkdownPosition(source, start)) return null;

  let index = start + 2;
  let alt = '';
  for (; index < source.length; index += 1) {
    if (source[index] === '\\' && index + 1 < source.length) {
      alt += source[index] + source[index + 1];
      index += 1;
      continue;
    }
    if (source[index] === ']') break;
    alt += source[index];
  }
  if (source[index] !== ']' || source[index + 1] !== '(') return null;
  index += 2;
  while (/\s/.test(source[index] || '')) index += 1;

  let destination = '';
  if (source[index] === '<') {
    index += 1;
    while (index < source.length && source[index] !== '>') {
      if (source[index] === '\\' && index + 1 < source.length) {
        destination += source[index] + source[index + 1];
        index += 2;
        continue;
      }
      destination += source[index];
      index += 1;
    }
    if (source[index] !== '>') return null;
    index += 1;
  } else {
    let nested = 0;
    while (index < source.length) {
      const character = source[index];
      if (character === '\\' && index + 1 < source.length) {
        destination += character + source[index + 1];
        index += 2;
        continue;
      }
      if (character === '(') {
        nested += 1;
        destination += character;
        index += 1;
        continue;
      }
      if (character === ')') {
        if (nested === 0) break;
        nested -= 1;
        destination += character;
        index += 1;
        continue;
      }
      if (/\s/.test(character) && nested === 0) break;
      destination += character;
      index += 1;
    }
    if (nested !== 0) return null;
  }
  if (!destination) return null;

  const whitespaceStart = index;
  while (/\s/.test(source[index] || '')) index += 1;
  let title = '';
  if (source[index] !== ')') {
    if (index === whitespaceStart) return null;
    const opener = source[index];
    const closer = opener === '(' ? ')' : opener;
    if (opener !== '"' && opener !== "'" && opener !== '(') return null;
    index += 1;
    while (index < source.length && source[index] !== closer) {
      if (source[index] === '\\' && index + 1 < source.length) {
        title += source[index] + source[index + 1];
        index += 2;
        continue;
      }
      title += source[index];
      index += 1;
    }
    if (source[index] !== closer) return null;
    index += 1;
    while (/\s/.test(source[index] || '')) index += 1;
  }
  if (source[index] !== ')') return null;

  return {
    start,
    end: index + 1,
    alt: unescapeMarkdownValue(alt),
    destination: unescapeMarkdownValue(destination),
    title: unescapeMarkdownValue(title),
  };
}

function markdownImagesInLine(line, candidateStarts = markdownImageCandidateStarts(line)) {
  const images = [];
  let consumedThrough = 0;
  for (const start of candidateStarts) {
    if (start < consumedThrough) continue;
    const image = parseMarkdownImageAt(line, start);
    if (image) {
      images.push(image);
      consumedThrough = image.end;
    }
  }
  return images;
}

function markdownAssetFileName(destination) {
  const path = destination.replace(/[?#][\s\S]*$/, '');
  const fileName = path.split('/').pop() || '';
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

function isBlockStart(line, nextLine = '') {
  const trimmed = line.trim();
  return (
    !trimmed ||
    /^#{1,4}\s+/.test(trimmed) ||
    /^---+$/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^[-*+]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed) ||
    Boolean(codeFence(trimmed)) ||
    /^\$\$$/.test(trimmed) ||
    /^@@PUBLICATION_/.test(trimmed) ||
    markdownImageCandidateStarts(trimmed).length > 0 ||
    (/^\|.*\|$/.test(trimmed) && /^\|?[\s:|-]+\|?$/.test(nextLine.trim()))
  );
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseBlocks(body, assets, warnings) {
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let index = 0;
  let bodyImageIndex = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const assetMatch = trimmed.match(/^@@PUBLICATION_ASSET_(\d+)@@$/);
    if (assetMatch) {
      const asset = assets.find((item) => item.componentId === +assetMatch[1]);
      bodyImageIndex += 1;
      if (asset) asset.index = bodyImageIndex;
      blocks.push({ type: 'asset', asset });
      index += 1;
      continue;
    }

    const tableComponent = trimmed.match(/^@@PUBLICATION_TABLE_(.*?)_(.*?)@@$/);
    if (tableComponent) {
      blocks.push({
        type: 'component-table',
        caption: decodeURIComponent(tableComponent[1]),
        source: decodeURIComponent(tableComponent[2]),
      });
      index += 1;
      continue;
    }

    const component = trimmed.match(/^@@PUBLICATION_COMPONENT_(.+)@@$/);
    if (component) {
      blocks.push({ type: 'component', name: component[1] });
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const fence = codeFence(trimmed);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !closesCodeFence(lines[index], fence)) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language: fence.language, text: code.join('\n') });
      continue;
    }

    if (/^\$\$$/.test(trimmed)) {
      const math = [];
      index += 1;
      while (index < lines.length && !/^\$\$$/.test(lines[index].trim())) {
        math.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'math', text: math.join('\n') });
      continue;
    }

    if (/^\|.*\|$/.test(trimmed) && /^\|?[\s:|-]+\|?$/.test((lines[index + 1] || '').trim())) {
      const headers = parseTableRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && /^\|.*\|$/.test(lines[index].trim())) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const markdownImageCandidates = markdownImageCandidateStarts(trimmed);
    const markdownImages = markdownImagesInLine(trimmed, markdownImageCandidates);
    if (markdownImages.length) {
      let cursor = 0;
      for (const image of markdownImages) {
        const before = trimmed.slice(cursor, image.start).trim();
        if (before) blocks.push({ type: 'paragraph', text: before });
        bodyImageIndex += 1;
        const asset = {
          kind: 'body',
          index: bodyImageIndex,
          fileName: markdownAssetFileName(image.destination),
          caption: image.title || image.alt,
          alt: image.alt,
          source: '',
          sourceUrl: '',
        };
        assets.push(asset);
        blocks.push({ type: 'asset', asset });
        cursor = image.end;
      }
      const after = trimmed.slice(cursor).trim();
      if (after) blocks.push({ type: 'paragraph', text: after });
      if (
        markdownImages.length > 1 ||
        markdownImages[0].start !== 0 ||
        markdownImages[markdownImages.length - 1].end !== trimmed.length
      ) {
        warnings.add('正文含行内 Markdown 图片；发布包已将图片拆为独立位置，请发布前检查上下文。');
      }
      if (markdownImageCandidates.length > markdownImages.length) {
        warnings.add('正文含未能完整解析的 Markdown 图片语法；请对照原稿人工检查图片清单。');
      }
      index += 1;
      continue;
    }

    if (markdownImageCandidates.length) {
      warnings.add('正文含未能完整解析的 Markdown 图片语法；请对照原稿人工检查图片清单。');
    }

    if (/^>\s?/.test(trimmed)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const listType = unordered ? 'ul' : 'ol';
      const items = [];
      while (index < lines.length) {
        const candidate = lines[index].trim();
        const match =
          listType === 'ul' ? candidate.match(/^[-*+]\s+(.+)$/) : candidate.match(/^\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: 'list', listType, items });
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length && !isBlockStart(lines[index], lines[index + 1] || '')) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function inlineHtml(value) {
  return escapeHtml(value)
    .replace(
      /`([^`]+)`/g,
      '<code style="padding:2px 5px;border-radius:4px;background:#f1eee9;font-family:ui-monospace,monospace;font-size:.9em">$1</code>'
    )
    .replace(
      /\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" style="color:#526e77;text-decoration:underline">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
}

function inlinePlain(value) {
  return value
    .replace(/!\[([^\]]*)]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '$1（$2）')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function imageLabel(asset) {
  return asset?.caption || asset?.alt || asset?.fileName || '待补图片';
}

function richStyles(platformId) {
  const chinese = platformId === 'wechat' || platformId === 'xueqiu';
  return {
    wrapper: `max-width:720px;margin:0 auto;color:#3f3d3a;font-family:${chinese ? "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif" : "Georgia,'Times New Roman',serif"};font-size:${chinese ? '16px' : '18px'};line-height:${chinese ? '1.9' : '1.72'};word-break:break-word`,
    heading: (level) => {
      const size = level <= 2 ? (chinese ? '22px' : '26px') : chinese ? '18px' : '21px';
      const accent =
        platformId === 'wechat' && level <= 2
          ? 'border-left:4px solid #526e77;padding-left:12px;'
          : '';
      return `margin:2em 0 .8em;${accent}color:#302f2d;font-size:${size};font-weight:700;line-height:1.4`;
    },
    paragraph: 'margin:1.1em 0;color:#3f3d3a;line-height:1.9;text-align:left',
    quote:
      'margin:1.6em 0;padding:12px 18px;border-left:3px solid #8ba2a9;background:#f5f3ef;color:#66615c;line-height:1.8',
    list: 'margin:1.15em 0;padding-left:1.5em;color:#3f3d3a;line-height:1.8',
    asset:
      'margin:1.6em 0;padding:14px 16px;border:1px dashed #aebcc0;background:#f4f7f7;color:#526e77;text-align:center;font-size:14px;line-height:1.65',
  };
}

function richBody(blocks, platformId) {
  const styles = richStyles(platformId);
  const html = blocks
    .map((block) => {
      if (block.type === 'heading') {
        const level = Math.min(Math.max(block.level + 1, 2), 4);
        return `<h${level} style="${styles.heading(block.level)}">${inlineHtml(block.text)}</h${level}>`;
      }
      if (block.type === 'paragraph') {
        return `<p style="${styles.paragraph}">${inlineHtml(block.text)}</p>`;
      }
      if (block.type === 'quote') {
        return `<blockquote style="${styles.quote}">${inlineHtml(block.text)}</blockquote>`;
      }
      if (block.type === 'list') {
        return `<${block.listType} style="${styles.list}">${block.items
          .map((item) => `<li style="margin:.45em 0">${inlineHtml(item)}</li>`)
          .join('')}</${block.listType}>`;
      }
      if (block.type === 'rule') {
        return '<hr style="margin:2.2em 0;border:0;border-top:1px solid #ddd8d1">';
      }
      if (block.type === 'code' || block.type === 'math') {
        return `<pre style="margin:1.4em 0;padding:14px;overflow:auto;background:#f3f0eb;color:#45413d;font:13px/1.65 ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(block.text)}</pre>`;
      }
      if (block.type === 'table') {
        return `<table style="width:100%;margin:1.5em 0;border-collapse:collapse;font-size:14px"><thead><tr>${block.headers
          .map(
            (cell) =>
              `<th style="padding:8px;border:1px solid #d8d2ca;background:#f1eee9;text-align:left">${inlineHtml(cell)}</th>`
          )
          .join('')}</tr></thead><tbody>${block.rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell) =>
                    `<td style="padding:8px;border:1px solid #d8d2ca">${inlineHtml(cell)}</td>`
                )
                .join('')}</tr>`
          )
          .join('')}</tbody></table>`;
      }
      if (block.type === 'asset') {
        const asset = block.asset;
        const sourceUrl = /^https?:\/\//.test(asset?.sourceUrl || '') ? asset.sourceUrl : '';
        const sourceLabel = asset?.source || sourceUrl;
        const source = sourceLabel
          ? `<br><small>来源：${
              sourceUrl
                ? `<a href="${escapeHtml(sourceUrl)}" style="color:#526e77;text-decoration:underline">${escapeHtml(sourceLabel)}</a>`
                : escapeHtml(sourceLabel)
            }</small>`
          : '';
        return `<p style="${styles.asset}">【正文图片 ${asset?.index || ''}：${escapeHtml(imageLabel(asset))}】${source}</p>`;
      }
      if (block.type === 'component-table') {
        const label = block.caption || '站点数据表';
        return `<p style="${styles.asset}">【数据表：${escapeHtml(label)}】${block.source ? `<br><small>来源：${escapeHtml(block.source)}</small>` : ''}</p>`;
      }
      if (block.type === 'component') {
        return `<p style="${styles.asset}">【${escapeHtml(block.name)} 组件：请人工补充】</p>`;
      }
      return '';
    })
    .join('\n');
  return `<section style="${styles.wrapper}">${html}</section>`;
}

function plainBody(blocks) {
  return blocks
    .map((block) => {
      if (block.type === 'heading')
        return `${'#'.repeat(Math.min(block.level, 3))} ${inlinePlain(block.text)}`;
      if (block.type === 'paragraph') return inlinePlain(block.text);
      if (block.type === 'quote') return `> ${inlinePlain(block.text)}`;
      if (block.type === 'list') {
        return block.items
          .map(
            (item, index) =>
              `${block.listType === 'ol' ? `${index + 1}.` : '•'} ${inlinePlain(item)}`
          )
          .join('\n');
      }
      if (block.type === 'rule') return '———';
      if (block.type === 'code' || block.type === 'math') return block.text;
      if (block.type === 'table') {
        return [block.headers, ...block.rows]
          .map((row) => row.map(inlinePlain).join('\t'))
          .join('\n');
      }
      if (block.type === 'asset') {
        const source = block.asset?.source || block.asset?.sourceUrl;
        return `【正文图片 ${block.asset?.index || ''}：${imageLabel(block.asset)}】${source ? `\n来源：${source}${block.asset?.sourceUrl && block.asset.sourceUrl !== source ? `（${block.asset.sourceUrl}）` : ''}` : ''}`;
      }
      if (block.type === 'component-table') return `【数据表：${block.caption || '请人工补充'}】`;
      if (block.type === 'component') return `【${block.name} 组件：请人工补充】`;
      return '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function codePointLength(value) {
  return Array.from(value).length;
}

function truncate(value, maximum) {
  const points = Array.from(value.trim());
  if (points.length <= maximum) return points.join('');
  return `${points
    .slice(0, Math.max(0, maximum - 1))
    .join('')
    .trimEnd()}…`;
}

function firstProse(blocks) {
  return blocks.find((block) => block.type === 'paragraph')?.text || '';
}

function socialCopy(platformId, metadata, blocks, language) {
  const url = metadata.canonicalUrl;
  const title = metadata.title || 'Untitled';
  const description = metadata.description || inlinePlain(firstProse(blocks));
  if (platformId === 'x-post') {
    const suffix = url ? `\n\n${url}` : '';
    const allowance = Math.max(40, 260 - codePointLength(title) - codePointLength(suffix) - 2);
    return `${title}\n\n${truncate(description, allowance)}${suffix}`.trim();
  }
  const lead = inlinePlain(firstProse(blocks));
  const parts = [title, description];
  if (lead && lead !== description) parts.push(truncate(lead, 700));
  if (url)
    parts.push(`${language === 'cn' ? '阅读全文' : 'Read the full bilingual essay'}：${url}`);
  return truncate(parts.filter(Boolean).join('\n\n'), 2800);
}

export function buildPublicationPackage({
  source = '',
  platformId = 'wechat',
  articleId = '',
  language = 'cn',
  published = false,
  siteOrigin = SITE_ORIGIN,
} = {}) {
  const platform =
    PUBLICATION_PLATFORMS.find((candidate) => candidate.id === platformId) ||
    PUBLICATION_PLATFORMS[0];
  const { body, metadata } = extractArticle(source, articleId, language, siteOrigin);
  const imports = importedAssets(body);
  const assets = [];
  if (metadata.cover) {
    assets.push({
      kind: 'cover',
      index: 0,
      fileName: metadata.cover.split('/').pop() || '',
      caption: metadata.coverCaption,
      alt: metadata.coverAlt,
      source: metadata.coverSource,
      sourceUrl: metadata.coverSourceUrl,
    });
  }
  const warnings = new Set();
  const preparedBody = normalizeMarkdownLinks(
    preprocessComponents(stripMdxPreamble(body), imports, assets, warnings),
    siteOrigin
  );
  const blocks = parseBlocks(preparedBody, assets, warnings);
  assets.sort((left, right) => {
    if (left.kind === 'cover') return -1;
    if (right.kind === 'cover') return 1;
    return left.index - right.index;
  });
  if (
    blocks[0]?.type === 'heading' &&
    inlinePlain(blocks[0].text).trim() === metadata.title.trim()
  ) {
    blocks.shift();
  }
  if (blocks.some((block) => block.type === 'math')) {
    warnings.add('正文含公式；发布包保留了 LaTeX 原文，请在目标平台中转成公式图片或重新排版。');
  }
  const bodyText = plainBody(blocks);

  if (assets.length) {
    warnings.add('图片不会随 HTML 自动上传；请按图片清单逐张复制，并替换正文中的图片标记。');
  }
  if (assets.some((asset) => /\.(?:gif|webp)$/i.test(asset.fileName || ''))) {
    warnings.add('GIF 或动态 WebP 在复制到剪贴板时会转换为 PNG，动画效果将丢失。');
  }
  if (!published && metadata.canonicalUrl) {
    warnings.add('这篇文章尚未进入正式站点目录；原文链接可能暂时无法访问。');
  }

  const plainText =
    platform.format === 'plain' ? socialCopy(platform.id, metadata, blocks, language) : bodyText;
  const richHtml = platform.format === 'rich' ? richBody(blocks, platform.id) : '';
  if (platform.id === 'wechat' && richHtml.length > 20_000) {
    warnings.add(
      '带排版 HTML 超过微信公众号草稿接口的 20,000 字符基线；API 接入时需压缩样式或拆分。'
    );
  }
  return {
    platform,
    metadata,
    assets,
    warnings: [...warnings],
    richHtml,
    plainText,
    bodyText,
    characterCount: codePointLength(plainText),
  };
}
