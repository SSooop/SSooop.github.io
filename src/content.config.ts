import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const translationPathSchema = z.string().regex(/^\d{4}\/[^/]+\/(cn|en)$/);

const publicationSchema = z.object({
  platform: z.enum(['site', 'wechat', 'xueqiu', 'medium', 'x', 'linkedin']),
  mode: z.literal('full_text'),
  status: z.enum(['published', 'planned']),
  url: z.string().url().optional(),
  access: z.enum(['url', 'qr_or_account']).optional(),
  account: z.string().optional(),
});

const blogCollection = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '**/*.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ''),
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        date: z.date(),
        updated: z.date().optional(),
        description: z.string(),
        lang: z.enum(['en', 'zh']),
        translationKey: z.string().regex(/^\d{4}\/[^/]+$/),
        translations: z.object({
          zh: translationPathSchema.optional(),
          en: translationPathSchema.optional(),
        }),
        related: z
          .array(z.string().regex(/^\d{4}\/[^/]+$/))
          .max(3)
          .optional(),
        canonical: z.object({
          url: z.string().regex(/^\/(en|zh)\/blog\/\d{4}\/[^/]+\/(cn|en)$/),
          role: z.literal('version_home'),
        }),
        publications: z.array(publicationSchema).min(1),
        keywords: z.array(z.string()).optional(),
        image: image().optional(),
        imageAlt: z.string().optional(),
        imageCaption: z.string().optional(),
        imageSource: z.string().optional(),
        imageSourceUrl: z.string().url().optional(),
        imagePosition: z.enum(['top', 'center', 'bottom']).optional(),
      })
      .superRefine((entry, context) => {
        if (entry.updated && entry.updated < entry.date) {
          context.addIssue({
            code: 'custom',
            path: ['updated'],
            message: 'updated must not be earlier than date',
          });
        }
      }),
});

export const collections = {
  blog: blogCollection,
};
