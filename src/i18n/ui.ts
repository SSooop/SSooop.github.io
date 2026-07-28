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
    'blog.subtitle': 'Technology, philosophy of science, and the long-term logic of AI × biopharma',
    'blog.description':
      'IntelliPharma Insights follows the technological evolution of AI and biopharma through the lens of philosophy of science. Drawing on bioengineering, software engineering, AI and blockchain, economics, and management, it examines the underlying logic of industry and long-term value. The column analyzes value logic rather than individual companies or securities; its technology-driven essays do not present specific technical solutions; and all views are personal perspectives, not investment advice.',
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
    'blog.subtitle': '以技术与科学哲学，理解 AI × 制药的长期价值逻辑',
    'blog.description':
      '智药深瞳聚焦 AI 与制药产业的技术演化，以科学哲学为主线，交叉分析生物工程、软件工程、AI 与区块链、经济学与管理学，理解产业演化与长期价值的底层逻辑。栏目只分析价值逻辑，不分析具体企业或个股；文章为技术驱动的科学哲学讨论，不涉及具体技术方案；所有内容仅代表个人观点，不构成投资建议。',
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
