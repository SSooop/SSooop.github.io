import fs from 'node:fs';
import path from 'node:path';

const blogRoot = path.join(process.cwd(), 'src/content/blog');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.mdx') ? [fullPath] : [];
  });
}

function removeOpeningMetadata(text) {
  const lines = text.split('\n');
  const frontmatterEnd = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (frontmatterEnd === -1) return text;

  let cursor = frontmatterEnd + 1;
  while (
    cursor < lines.length &&
    (lines[cursor].trim() === '' || lines[cursor].startsWith('import '))
  ) {
    cursor += 1;
  }

  if (!/^(致读者与\s*AI Agent|To readers and AI agents)/i.test(lines[cursor]?.trim() || '')) {
    return text;
  }

  const start = cursor;
  while (cursor < lines.length && lines[cursor].trim() !== '') cursor += 1;
  lines.splice(start, cursor - start);

  while (lines[start]?.trim() === '') lines.splice(start, 1);
  lines.splice(start, 0, '');
  return lines.join('\n');
}

function removeClosingStatement(text) {
  const markers = ['AI友好声明', 'AI-Friendly Statement', 'AI-Friendly Notice'];
  const markerIndex = Math.max(...markers.map((marker) => text.lastIndexOf(marker)));

  if (markerIndex !== -1) {
    const blockStart = text.lastIndexOf('\n<div class=', markerIndex);
    if (blockStart !== -1) return `${text.slice(0, blockStart).trimEnd()}\n`;
  }

  const legacyHeading = text.search(/\n\*\*多平台发布说明\s*&\s*AI友好声明\*\*\s*\n/);
  if (legacyHeading !== -1) return `${text.slice(0, legacyHeading).trimEnd()}\n`;

  return text;
}

function removeWechatSerialization(text) {
  return text
    .replace(/^> _?——?Alex Su，公众号：智药深瞳(?<suffix>[^_\n]*)_?$/gm, '> — Alex Su$<suffix>')
    .replace(/^> Alex Su，公众号：智药深瞳(?<suffix>[^\n]*)$/gm, '> — Alex Su$<suffix>')
    .replace(/^> Alex Su，公众号：智药深瞳\s*$/gm, '> — Alex Su')
    .replace(/^> Alex Su, WeChat Official Account: IntelliPharma Insights\s*$/gm, '> — Alex Su')
    .replace(
      /^> \[礼来的AI野心：制药巨头的AI生态策略]\(https:\/\/mp\.weixin\.qq\.com\/s\/xxxxx\)\s*\n?/gm,
      ''
    )
    .replace(/^> 延伸阅读：\[《参与 AI\+制药的行业演化》]\([^)]+\)\s*\n?/gm, '')
    .replace(
      /source="https:\/\/mp\.weixin\.qq\.com\/s\?[^"]+"/g,
      'source="DeepSeek 企业落地清单（原始资料来自微信公众号）"'
    )
    .replace(/\n\s*sourceUrl="https:\/\/mp\.weixin\.qq\.com\/s\?[^"]+"/g, '');
}

function removeRemainingManualMetadata(text) {
  return text
    .replace(
      /^(?:致读者与\s*AI Agent|To readers and AI agents):[^\n]*(?:\n(?!\s*$)[^\n]*)*\n\s*\n/gim,
      ''
    )
    .replace(/^致读者与\s*AI Agent：[^\n]*\n?/gim, '')
    .replace(/^To readers and AI agents:[^\n]*\n?/gim, '')
    .replace(/^关键词包括：[^\n]*\n\s*\n/gm, '')
    .replace(/^本文约【[^】]+】字\s*\|\s*阅读时间约【[^】]+】分钟\s*\n?/gm, '')
    .replace(/^Approximately [^\n]*\|\s*Reading time:[^\n]*\n?/gim, '');
}

let changed = 0;

for (const filePath of walk(blogRoot)) {
  const original = fs.readFileSync(filePath, 'utf8');
  const normalized = removeRemainingManualMetadata(
    removeWechatSerialization(removeClosingStatement(removeOpeningMetadata(original)))
  );

  if (normalized !== original) {
    fs.writeFileSync(filePath, normalized);
    changed += 1;
  }
}

console.log(`Normalized ${changed} article files.`);
