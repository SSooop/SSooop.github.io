/**
 * Centralized constants for the application
 * All colors, fonts, and metadata defined here with type safety
 */

import { SITE } from './site';

// Color palette (Morandi theme)
export const COLORS = {
  morandiBg: '#EAE5DF',
  morandiText: '#4A4A4A',
  morandiAccent1: '#9CAFB7', // Muted Blue-Grey
  morandiAccent2: '#D6C6B9', // Warm Beige
  morandiAccent3: '#8C8681', // Taupe
  morandiAccent4: '#B5A89F', // Muted Brown
  siteNeutralHover: '#6F6A66',
  trackIntellipharma: '#7F9BA7',
  trackEconomics: '#9A8F72',
  trackGaia: '#7F8F6F',
} as const;

// Font families
export const FONTS = {
  serif: "'Playfair Display', serif",
  mono: "'JetBrains Mono', monospace",
  sans: "'Inter', sans-serif",
} as const;

// Metadata
export const METADATA = {
  defaultTitle: {
    en: 'IntelliPharma Insights | Alex Su on AI & Biopharma',
    zh: '智药深瞳｜苏晨鹏的 AI 制药与生命科学研究',
  },
  defaultDescription: {
    en: 'Alex Su (苏晨鹏) writes IntelliPharma Insights, a bilingual research archive on AI, biopharma, scientific software, and long-term value.',
    zh: '智药深瞳是苏晨鹏（Alex Su）的双语研究与写作网站，聚焦 AI、生物医药、科学软件与长期价值。',
  },
  author: 'Alex Su (苏晨鹏)',
  siteUrl: SITE.url,
} as const;

// Animation durations (in ms)
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Breakpoints (for reference, Tailwind handles most)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Social colors (for icons)
export const SOCIAL_COLORS = {
  wechat: '#07C160',
  linkedin: '#0077b5',
  x: '#000000',
  facebook: '#1877F2',
  telegram: '#0088cc',
  qq: '#12B7F5',
  weibo: '#E6162D',
  rednote: '#FF2442',
  googleScholar: '#4285F4',
  github: '#000000',
} as const;

export type ColorKey = keyof typeof COLORS;
export type FontKey = keyof typeof FONTS;
export type SocialColorKey = keyof typeof SOCIAL_COLORS;
