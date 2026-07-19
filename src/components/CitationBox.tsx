import React, { useMemo, useState } from 'react';
import { FaCheck, FaCopy } from 'react-icons/fa';
import {
  buildCitationFormats,
  type CitationSource,
  type CitationStyleKey,
} from '../utils/citation';

interface CitationBoxProps {
  source: CitationSource;
  uiLang?: 'en' | 'zh';
}

const labels = {
  en: {
    title: 'Cite This Article',
    source: 'Source',
    copy: 'Copy',
    copied: 'Copied',
    copyLabel: 'Copy citation',
  },
  zh: {
    title: '引用本文',
    source: '来源',
    copy: '复制',
    copied: '已复制',
    copyLabel: '复制引用',
  },
} as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fallbackCopy(value: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

export default function CitationBox({
  source,
  uiLang = 'en',
}: CitationBoxProps): React.ReactElement {
  const t = labels[uiLang];
  const [activeStyle, setActiveStyle] = useState<CitationStyleKey>('apa');
  const [copied, setCopied] = useState(false);
  const [accessedDate] = useState(todayIso);

  const formats = useMemo(
    () => buildCitationFormats({ ...source, accessedDate }),
    [source, accessedDate]
  );

  const activeFormat = formats.find((format) => format.key === activeStyle) || formats[0];

  async function copyCitation(): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(activeFormat.value);
    } else {
      fallbackCopy(activeFormat.value);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section
      className="border-morandi-accent-2/20 mt-16 border-t pt-8"
      aria-labelledby="cite-heading"
    >
      <div className="border-morandi-accent-2/30 bg-morandi-bg/30 rounded-lg border p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="cite-heading" className="text-morandi-text font-serif text-2xl italic">
              {t.title}
            </h2>
            <p className="text-morandi-text/60 mt-1 font-mono text-xs">
              {t.source}: {source.author} · {new Date(source.publicationDate).getUTCFullYear()} ·{' '}
              {source.siteName}
            </p>
          </div>

          <button
            type="button"
            onClick={copyCitation}
            aria-label={t.copyLabel}
            className="bg-morandi-text inline-flex min-h-10 items-center gap-2 rounded px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-85"
          >
            {copied ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
            <span>{copied ? t.copied : t.copy}</span>
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label={t.title}>
          {formats.map((format) => {
            const selected = format.key === activeStyle;

            return (
              <button
                key={format.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveStyle(format.key)}
                className={`border-morandi-accent-2/30 min-h-9 rounded border px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                  selected
                    ? 'bg-site-neutral-hover text-white'
                    : 'text-morandi-accent-3 hover:bg-site-neutral-surface hover:text-site-neutral-hover'
                }`}
              >
                {format.label}
              </button>
            );
          })}
        </div>

        <pre className="border-morandi-accent-2/20 bg-morandi-bg/60 text-morandi-text/80 max-h-72 overflow-auto rounded border p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
          <code>{activeFormat.value}</code>
        </pre>
      </div>
    </section>
  );
}
