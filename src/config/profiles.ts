/**
 * Social media profiles configuration
 */

export interface SocialProfile {
  /** Display name of the platform */
  name: string;
  /** Description or tagline */
  desc: string;
  /** URL to the profile. Omit when the surface uses an in-page QR code. */
  url?: string;
  /** Icon component name from react-icons */
  icon: string;
  /** Call-to-action text */
  action: string;
  /** Tailwind CSS color class */
  color: string;
}

export const profiles: SocialProfile[] = [
  {
    name: 'WeChat',
    desc: 'Thinking Daily / 公众号',
    icon: 'FaWeixin',
    action: 'Scan to Follow',
    color: 'text-[#07C160]',
  },
  {
    name: 'LinkedIn',
    desc: 'Connect professionally',
    url: 'https://www.linkedin.com/in/alexsuhelixon/',
    icon: 'FaLinkedin',
    action: 'Connect',
    color: 'text-[#0077b5]',
  },
  {
    name: 'X',
    desc: 'Follow for updates',
    url: 'https://x.com/ChenpengSu',
    icon: 'SiX',
    action: 'Follow',
    color: 'text-black dark:text-white',
  },
  {
    name: 'Google Scholar',
    desc: 'Academic Work',
    url: 'https://scholar.google.com/citations?user=msA1c98AAAAJ&hl=en',
    icon: 'FaGraduationCap',
    action: 'View Profile',
    color: 'text-[#4285F4]',
  },
  {
    name: 'GitHub',
    desc: 'Codebase & Projects',
    url: 'https://github.com/SSooop',
    icon: 'FaGithub',
    action: 'View Code',
    color: 'text-black dark:text-white',
  },
];
