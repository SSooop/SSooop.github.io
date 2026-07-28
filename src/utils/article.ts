export interface ReadingMetrics {
  units: number;
  minutes: number;
}

function plainTextFromMdx(source: string): string {
  return source
    .replace(/^import[\s\S]*?;\s*$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#{}`*_>|~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getReadingMetrics(source: string, lang: 'en' | 'zh'): ReadingMetrics {
  const text = plainTextFromMdx(source);
  const latinWords = text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g)?.length ?? 0;
  const cjkCharacters =
    text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
  const units =
    lang === 'zh' ? cjkCharacters + latinWords : latinWords + Math.ceil(cjkCharacters / 2);
  const readingRate = lang === 'zh' ? 350 : 220;

  return {
    units,
    minutes: Math.max(1, Math.ceil(units / readingRate)),
  };
}
