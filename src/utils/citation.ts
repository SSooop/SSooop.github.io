export type CitationStyleKey = 'apa' | 'mla' | 'chicago' | 'gbt7714' | 'bibtex' | 'ris' | 'csl';

export interface CitationMeta {
  title: string;
  author: string;
  publicationDate: string;
  url: string;
  language: 'en' | 'zh';
  siteName: string;
}

export interface CitationSource extends CitationMeta {
  id: string;
  authorGiven: string;
  authorFamily: string;
  accessedDate?: string;
}

export interface CitationFormat {
  key: CitationStyleKey;
  label: string;
  value: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
];

function parseIsoDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T00:00:00.000Z`);
}

function dateParts(value: string): { year: number; month: number; day: number } {
  const date = parseIsoDate(value);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatMonthDayYear(value: string): string {
  const { year, month, day } = dateParts(value);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function formatDayMonthYear(value: string): string {
  const { year, month, day } = dateParts(value);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}

function formatIsoDate(value: string): string {
  const { year, month, day } = dateParts(value);
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function formatSlashDate(value: string): string {
  const { year, month, day } = dateParts(value);
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('/');
}

function bibtexKey(source: CitationSource): string {
  const { year } = dateParts(source.publicationDate);
  const slug =
    source.id
      .replace(/\/(cn|en)$/, '')
      .split('/')
      .at(-1) || 'article';
  return `su${year}${slug}`.replace(/[^A-Za-z0-9_:-]/g, '');
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeBibtex(value: string): string {
  return sanitizeSingleLine(value).replace(/[{}]/g, '');
}

function sanitizeRis(value: string): string {
  return sanitizeSingleLine(value).replace(/\r?\n/g, ' ');
}

function cslJson(source: CitationSource): string {
  const issued = dateParts(source.publicationDate);
  const accessed = dateParts(source.accessedDate || formatIsoDate(new Date().toISOString()));

  return JSON.stringify(
    {
      id: source.id,
      type: 'webpage',
      title: source.title,
      author: [{ family: source.authorFamily, given: source.authorGiven }],
      issued: { 'date-parts': [[issued.year, issued.month, issued.day]] },
      accessed: { 'date-parts': [[accessed.year, accessed.month, accessed.day]] },
      publisher: source.siteName,
      URL: source.url,
      language: source.language === 'zh' ? 'zh-CN' : 'en-US',
    },
    null,
    2
  );
}

export function buildCitationFormats(source: CitationSource): CitationFormat[] {
  const publicationYear = dateParts(source.publicationDate).year;
  const publicationDate = formatIsoDate(source.publicationDate);
  const accessedDate = formatIsoDate(source.accessedDate || new Date().toISOString());
  const mlaDate = formatDayMonthYear(source.publicationDate);
  const mlaAccessDate = formatDayMonthYear(accessedDate);
  const chicagoDate = formatMonthDayYear(source.publicationDate);
  const title = sanitizeSingleLine(source.title);
  const risTitle = sanitizeRis(source.title);
  const langLabel = source.language === 'zh' ? 'Chinese' : 'English';

  return [
    {
      key: 'apa',
      label: 'APA',
      value: `${source.authorFamily}, ${source.authorGiven[0]}. (${publicationYear}, ${chicagoDate.replace(
        `, ${publicationYear}`,
        ''
      )}). ${title}. ${source.siteName}. ${source.url}`,
    },
    {
      key: 'mla',
      label: 'MLA',
      value: `${source.authorFamily}, ${source.authorGiven}. "${title}." ${source.siteName}, ${mlaDate}, ${source.url}. Accessed ${mlaAccessDate}.`,
    },
    {
      key: 'chicago',
      label: 'Chicago',
      value: `${source.authorFamily}, ${source.authorGiven}. "${title}." ${source.siteName}. ${chicagoDate}. ${source.url}.`,
    },
    {
      key: 'gbt7714',
      label: 'GB/T 7714',
      value: `${source.authorFamily.toUpperCase()} ${source.authorGiven}. ${title}[EB/OL]. ${source.siteName}, ${publicationDate}[${accessedDate}]. ${source.url}.`,
    },
    {
      key: 'bibtex',
      label: 'BibTeX',
      value: [
        `@online{${bibtexKey(source)},`,
        `  author = {${sanitizeBibtex(`${source.authorFamily}, ${source.authorGiven}`)}},`,
        `  title = {{${sanitizeBibtex(title)}}},`,
        `  year = {${publicationYear}},`,
        `  date = {${publicationDate}},`,
        `  url = {${source.url}},`,
        `  urldate = {${accessedDate}},`,
        `  organization = {${sanitizeBibtex(source.siteName)}},`,
        `  langid = {${source.language === 'zh' ? 'chinese' : 'english'}}`,
        `}`,
      ].join('\n'),
    },
    {
      key: 'ris',
      label: 'RIS',
      value: [
        'TY  - ELEC',
        `TI  - ${risTitle}`,
        `AU  - ${source.authorFamily}, ${source.authorGiven}`,
        `PY  - ${publicationYear}`,
        `DA  - ${formatSlashDate(source.publicationDate)}`,
        `Y2  - ${formatSlashDate(accessedDate)}`,
        `PB  - ${source.siteName}`,
        `UR  - ${source.url}`,
        `LA  - ${langLabel}`,
        'ER  -',
      ].join('\n'),
    },
    {
      key: 'csl',
      label: 'CSL JSON',
      value: cslJson({ ...source, accessedDate }),
    },
  ];
}
