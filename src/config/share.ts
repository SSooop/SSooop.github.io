/**
 * Share links configuration for social media sharing
 */

export type ShareMethod = 'qr' | 'copy' | 'href';

export interface ShareLink {
  /** Display name of the platform */
  name: string;
  /** Icon component name from react-icons */
  icon: string;
  /** Method of sharing */
  method: ShareMethod;
  /** URL template for href method (replaces {url} and {title}) */
  urlTemplate?: string;
  /** Tailwind CSS color class for hover state */
  color: string;
}

export const shareLinks: ShareLink[] = [
  {
    name: 'WeChat',
    icon: 'FaWeixin',
    method: 'qr',
    color: 'hover:text-[#07C160]',
  },
  {
    name: 'LinkedIn',
    icon: 'FaLinkedin',
    method: 'href',
    urlTemplate: 'https://www.linkedin.com/sharing/share-offsite/?url={url}',
    color: 'hover:text-[#0077b5]',
  },
  {
    name: 'X',
    icon: 'SiX',
    method: 'href',
    urlTemplate: 'https://twitter.com/intent/tweet?url={url}&text={title}',
    color: 'hover:text-black dark:hover:text-white',
  },
  {
    name: 'RedNote',
    icon: 'SiXiaohongshu',
    method: 'copy',
    color: 'hover:text-[#FF2442]',
  },
  {
    name: 'Weibo',
    icon: 'SiSinaweibo',
    method: 'href',
    urlTemplate: 'http://service.weibo.com/share/share.php?url={url}&title={title}',
    color: 'hover:text-[#E6162D]',
  },
  {
    name: 'Medium',
    icon: 'SiMedium',
    method: 'href',
    urlTemplate: 'https://medium.com/p/new-story?url={url}&title={title}',
    color: 'hover:text-black dark:hover:text-white',
  },
  {
    name: 'Facebook',
    icon: 'FaFacebook',
    method: 'href',
    urlTemplate: 'https://www.facebook.com/sharer/sharer.php?u={url}',
    color: 'hover:text-[#1877F2]',
  },
  {
    name: 'QQ',
    icon: 'SiQq',
    method: 'href',
    urlTemplate: 'http://connect.qq.com/widget/shareqq/index.html?url={url}&summary={title}',
    color: 'hover:text-[#12B7F5]',
  },
  {
    name: 'Telegram',
    icon: 'FaTelegram',
    method: 'href',
    urlTemplate: 'https://t.me/share/url?url={url}&text={title}',
    color: 'hover:text-[#0088cc]',
  },
];
