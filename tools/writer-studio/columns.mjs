export const DEFAULT_COLUMN_ID = 'intellipharma';

const columns = [
  {
    id: DEFAULT_COLUMN_ID,
    code: 'P01',
    name: '智药深瞳',
    englishName: 'IntelliPharma Insights',
    description: 'AI、制药产业、科学哲学与长期价值逻辑的双语文章。',
    contentKind: 'bilingual_article',
    status: 'active',
    capabilities: {
      ideas: true,
      drafts: true,
      sitePublish: true,
      distribution: true,
    },
  },
  {
    id: 'economics-after-ai',
    code: 'P02',
    name: 'AI 时代的经济学',
    englishName: 'Economics After AI',
    description: '围绕 AI 生产力、社会再生产与增长循环持续生长的在线书。',
    contentKind: 'book',
    status: 'evolving',
    capabilities: {
      ideas: true,
      drafts: false,
      sitePublish: false,
      distribution: false,
    },
  },
  {
    id: 'gaia-project',
    code: 'P03',
    name: '盖亚计划',
    englishName: 'Gaia Project',
    description: 'AI 蛋白设计、合成生物学与人工生态系统的长期研究构想。',
    contentKind: 'research_project',
    status: 'research',
    capabilities: {
      ideas: true,
      drafts: false,
      sitePublish: false,
      distribution: false,
    },
  },
];

const columnMap = new Map(columns.map((column) => [column.id, column]));

export function listColumns() {
  return columns.map((column) => ({
    ...column,
    capabilities: { ...column.capabilities },
  }));
}

export function getColumn(id) {
  return columnMap.get(id) ?? null;
}

export function requireColumn(id) {
  const column = getColumn(id);
  if (!column) {
    const error = new Error('Unknown Writer Studio column.');
    error.status = 400;
    throw error;
  }
  return column;
}
