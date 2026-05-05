import { test, expect } from '@playwright/test';

const enterBoard = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: '打开空白画布 →' }).click();
  await expect(page).toHaveURL(/#board$/);
};

const clearBrowserStorage = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.evaluate(async () => {
    window.localStorage.clear();
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .map((database) => database.name)
          .filter((name): name is string => Boolean(name))
          .map((name) => indexedDB.deleteDatabase(name))
      );
    }
  });
};

test('has title', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/XAI Board/);
  await expect(
    page.getByRole('button', { name: '打开空白画布 →' })
  ).toBeVisible();

  await page.getByRole('button', { name: '打开空白画布 →' }).click();
  await expect(page).toHaveURL(/#board$/);
  await expect(page.getByRole('button', { name: '素材库' })).toBeVisible();
});

test('素材库上传 SVG 和 PNG 后刷新仍可复用', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    '持久化上传 smoke 只需在桌面 Chromium 跑一遍'
  );

  const svgSource =
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#2563eb"/></svg>';
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lOGrLwAAAABJRU5ErkJggg==';

  await clearBrowserStorage(page);
  await enterBoard(page);
  await page.getByRole('button', { name: '素材库' }).click();

  const dataTransfer = await page.evaluateHandle(
    ({ pngBase64, svgSource }) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([svgSource], 'e2e-material.svg', {
          type: 'image/svg+xml',
        })
      );
      const pngBytes = Uint8Array.from(atob(pngBase64), (char) =>
        char.charCodeAt(0)
      );
      transfer.items.add(
        new File([pngBytes], 'e2e-texture.png', { type: 'image/png' })
      );
      return transfer;
    },
    { pngBase64, svgSource }
  );
  await page
    .locator('.icon-library-panel__main')
    .dispatchEvent('drop', { dataTransfer });

  await expect(page.getByRole('button', { name: 'e2e-material' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'e2e-texture' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: '素材库' })).toBeVisible();
  await page.getByRole('button', { name: '素材库' }).click();
  await expect(page.getByRole('button', { name: 'e2e-material' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'e2e-texture' })).toBeVisible();
});

test('基础导出菜单暴露 PNG、SVG、JPG 入口', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    '导出菜单 smoke 只需在桌面 Chromium 跑一遍'
  );

  await enterBoard(page);
  await page.getByLabel('菜单').click();
  await page.getByTestId('image-export-button').click();

  await expect(page.getByRole('button', { name: 'SVG' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PNG' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'JPG' })).toBeVisible();
});
