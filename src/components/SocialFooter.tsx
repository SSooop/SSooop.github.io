import React, { useState } from 'react';
import * as FaIcons from 'react-icons/fa';
import * as SiIcons from 'react-icons/si';
import type { IconType } from 'react-icons';
import { shareLinks } from '../config/share';
import { ui, type SupportedLocale, type TranslationKey } from '../i18n/ui';
import QRCode from './QRCode';

interface SocialFooterProps {
  lang?: SupportedLocale;
  t?: (key: TranslationKey) => string;
}

type ToastState = string | null;
type QRState = string | null;

export default function SocialFooter({ lang = 'en' }: SocialFooterProps): React.ReactElement {
  const [showQR, setShowQR] = useState<QRState>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Icon Mapping
  const getIcon = (name: string): IconType | null => {
    const icon =
      (FaIcons as Record<string, IconType>)[name] || (SiIcons as Record<string, IconType>)[name];
    return icon || null;
  };

  const handleShare = (e: React.MouseEvent, link: (typeof shareLinks)[0]) => {
    e.preventDefault();
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const pageTitle = typeof document !== 'undefined' ? document.title : '';

    if (link.method === 'qr') {
      setShowQR(showQR === link.name ? null : link.name);
    } else if (link.method === 'copy') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(currentUrl).then(() => {
          setToast(lang === 'zh' ? '链接已复制' : 'Link copied to clipboard!');
          setTimeout(() => setToast(null), 2000);
        });
      } else {
        setToast(lang === 'zh' ? '当前浏览器不支持复制' : 'Clipboard not supported!');
        setTimeout(() => setToast(null), 2000);
      }
    } else if (link.method === 'href' && link.urlTemplate) {
      const shareUrl = link.urlTemplate
        .replace('{url}', encodeURIComponent(currentUrl))
        .replace('{title}', encodeURIComponent(pageTitle));
      if (typeof window !== 'undefined') {
        window.open(shareUrl, '_blank', 'width=600,height=400');
      }
    }
  };

  const t = (key: TranslationKey): string => ui[lang][key] || ui['en'][key];

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="bg-site-neutral-hover fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transform rounded-full px-6 py-2 font-mono text-sm text-white shadow-lg md:bottom-24">
          {toast}
        </div>
      )}

      {/* QR Popup */}
      {showQR && (
        <div
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transform rounded-lg border border-gray-200 bg-white p-4 shadow-xl md:bottom-24"
          onClick={() => setShowQR(null)}
        >
          <QRCode
            value={typeof window !== 'undefined' ? window.location.href : ''}
            size={192}
            alt={lang === 'zh' ? `${showQR} 分享二维码` : `${showQR} share QR Code`}
            className="flex justify-center"
          />
          <p className="mt-2 text-center text-xs text-gray-500">{t('footer.scan')}</p>
        </div>
      )}

      {/* Share Footer */}
      <footer className="border-t border-[color:var(--atlas-line)] bg-[color:var(--color-morandi-bg)] py-6">
        <div className="container mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
          <span className="text-atlas-ink/55 shrink-0 font-mono text-[10px] tracking-[0.16em] uppercase">
            {t('footer.share')}
          </span>
          <div className="flex flex-wrap items-center gap-1 border-l border-[color:var(--atlas-line)] pl-3">
            {shareLinks.map((link) => {
              const Icon = getIcon(link.icon);
              return (
                <button
                  key={link.name}
                  onClick={(e) => handleShare(e, link)}
                  className={`text-atlas-ink/55 hover:bg-atlas-ink flex h-8 w-8 shrink-0 items-center justify-center transition-colors hover:text-white ${
                    showQR === link.name ? 'bg-atlas-ink text-white' : ''
                  }`}
                  aria-label={lang === 'zh' ? `分享到 ${link.name}` : `Share on ${link.name}`}
                  title={lang === 'zh' ? `分享到 ${link.name}` : `Share on ${link.name}`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </footer>
    </>
  );
}
