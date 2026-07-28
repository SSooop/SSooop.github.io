import { expect, test, type Page } from '@playwright/test';

async function expectPageHealthy(page: Page, path: string, heading: string | RegExp) {
  const browserErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    browserErrors.push(error.message);
  });

  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `${path} should return a successful status`).toBe(true);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();

  expect(browserErrors, `${path} should not emit browser errors`).toEqual([]);
}

test.describe('production smoke test', () => {
  test('root redirects to the English homepage', async ({ page }) => {
    await expectPageHealthy(page, '/', 'Alex Su');
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test('English homepage renders core navigation', async ({ page }) => {
    await expectPageHealthy(page, '/en/', 'Alex Su');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: '[P01] IntelliPharma Insights' })).toBeVisible();
  });

  test('Chinese homepage renders core navigation', async ({ page }) => {
    await expectPageHealthy(page, '/zh/', 'Alex Su');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: '[P01] 智药深瞳' })).toBeVisible();
  });

  test('English blog index renders posts', async ({ page }) => {
    await expectPageHealthy(page, '/en/blog/', 'IntelliPharma Insights');
    const postList = page.getByRole('region', { name: 'Blog posts' });
    await expect(postList).toBeVisible();
    await expect(postList.getByRole('link', { name: /^Read / }).first()).toBeVisible();
  });

  test('Chinese blog index renders posts', async ({ page }) => {
    await expectPageHealthy(page, '/zh/blog/', '智药深瞳');
    const postList = page.getByRole('region', { name: '文章列表' });
    await expect(postList).toBeVisible();
    await expect(postList.getByRole('link', { name: /^阅读《/ }).first()).toBeVisible();
  });

  test('English article page renders article body', async ({ page }) => {
    await expectPageHealthy(
      page,
      '/en/blog/2026/ai-agent-biopharma-labor/en/',
      /Rethinking Mental Labor/
    );
    await expect(page.locator('[itemprop="articleBody"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Switch to Chinese language' })).toHaveAttribute(
      'href',
      '/zh/blog/2026/ai-agent-biopharma-labor/cn'
    );
    await expect(page.getByText('FR', { exact: true })).toHaveCount(0);
    await expect(page.getByText('RU', { exact: true })).toHaveCount(0);
  });

  test('Chinese article page renders article body', async ({ page }) => {
    await expectPageHealthy(page, '/zh/blog/2026/ai-agent-biopharma-labor/cn/', /新说脑力劳动/);
    await expect(page.locator('[itemprop="articleBody"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Switch to English language' })).toHaveAttribute(
      'href',
      '/en/blog/2026/ai-agent-biopharma-labor/en'
    );
  });

  test('article routes do not mix site and content languages', async ({ request }) => {
    const chineseArticleInEnglishSite = await request.get(
      '/en/blog/2026/ai-agent-biopharma-labor/cn/'
    );
    expect(chineseArticleInEnglishSite.status()).toBe(404);

    const englishArticleInChineseSite = await request.get(
      '/zh/blog/2026/ai-agent-biopharma-labor/en/'
    );
    expect(englishArticleInChineseSite.status()).toBe(404);
  });

  test('curated related posts lead and fill to three items', async ({ page }) => {
    await expectPageHealthy(
      page,
      '/zh/blog/2026/no-silver-bullet-scientific-intelligence/cn/',
      /没有银弹/
    );

    const articleBody = page.locator('[itemprop="articleBody"]');
    await expect(articleBody).not.toContainText('往期相关');

    const relatedLinks = page.locator('aside[aria-label="Related posts"] > div > a');
    await expect(relatedLinks).toHaveCount(3);
    await expect(relatedLinks.nth(0)).toHaveAttribute(
      'href',
      '/zh/blog/2026/why-ai-drug-discovery-is-not-alphago/cn'
    );
    await expect(relatedLinks.nth(1)).toHaveAttribute(
      'href',
      '/zh/blog/2026/predicting-pharma-innovation/cn'
    );
  });

  test('robots and sitemap endpoints are published', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain('Sitemap: https://ssooop.github.io/sitemap-index.xml');

    const sitemap = await request.get('/sitemap-index.xml');
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain('https://ssooop.github.io/sitemap-main.xml');
  });
});
