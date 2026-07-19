/**
 * Internationalization (i18n) configuration with TypeScript support
 */

export const ui = {
  en: {
    'home.name': 'Alex Su',
    'home.title': 'AI Systems for Biology',
    'home.location': 'BEIJING, CHINA',
    'home.focus': 'AI × BIOLOGY',
    'home.latest': 'Latest Notes',
    'home.fig': 'FIG. 01',
    'home.image': 'Image',
    'nav.about': 'About Me',
    'nav.blog': 'IntelliPharma Insights',
    'nav.projects': 'Projects',
    'nav.economics': 'Economics',
    'nav.gaia': 'Gaia Project',
    'nav.social': 'Social Media',
    'footer.share': 'Share',
    'footer.scan': 'Scan to share',
    'meta.title': 'Alex Su | Digital Space',
    'meta.desc': 'Alex Su - Personal Website',
    'blog.transmissions': 'Transmissions',
    'blog.subtitle': 'Thoughts on AI, Design, and Future',
    'blog.read': 'READ TRANSMISSION',
    'action.scan': 'Scan to Follow',
    'action.read': 'Read',
    'action.connect': 'Connect',
    'action.follow': 'Follow',
    'action.viewProfile': 'View Profile',
    'action.viewCode': 'View Code',
  },
  zh: {
    'home.name': '苏晨鹏',
    'home.title': '面向生命科学研究的 AI 系统构建者',
    'home.location': '中国，北京',
    'home.focus': 'AI × 生物学',
    'home.latest': '最新文章',
    'home.fig': '图. 01',
    'home.image': '图像',
    'nav.about': '关于我',
    'nav.blog': '智药深瞳',
    'nav.projects': '项目',
    'nav.economics': '经济学',
    'nav.gaia': '盖亚计划',
    'nav.social': '社交网络',
    'footer.share': '分享',
    'footer.scan': '扫码分享',
    'meta.title': '苏晨鹏 | 数字空间',
    'meta.desc': '苏晨鹏 - 个人网站',
    'blog.transmissions': '文章',
    'blog.subtitle': '记录 AI、生物医药、产品与科学软件中的长期问题',
    'blog.read': '阅读文章',
    'action.scan': '扫码关注',
    'action.read': '阅读',
    'action.connect': '联系',
    'action.follow': '关注',
    'action.viewProfile': '查看主页',
    'action.viewCode': '查看代码',
  },
} as const;

export type SupportedLocale = keyof typeof ui;
export type TranslationKey = keyof typeof ui.en;

/**
 * Returns a translation function for the specified locale
 * @param lang - The locale to use ('en' or 'zh')
 * @returns A function that takes a translation key and returns the translated string
 */
export function useTranslations(lang: SupportedLocale) {
  return function t<Key extends TranslationKey>(key: Key, fallback?: string): string {
    const translation = ui[lang][key];
    if (translation) return translation as string;
    // Fallback to English if translation not found
    const englishTranslation = ui.en[key];
    if (englishTranslation) return englishTranslation as string;
    // Return fallback or key if no translation found
    return fallback || (key as string);
  };
}
