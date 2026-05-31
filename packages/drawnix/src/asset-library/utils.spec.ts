import { describe, expect, it, jest } from '@jest/globals';

import {
  createAssetLibraryItemFromFile,
  dataUrlToBlob,
  formatAssetFileSize,
  getAssetKind,
  isSupportedAssetFile,
  sanitizeSvgSource,
} from './utils';

let mockFileContents = '';

const readBlobText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

jest.mock('@plait/core', () => ({
  idCreator: () => 'asset-id',
}));

jest.mock('../data/blob', () => ({
  getDataURL: jest.fn(),
  parseFileContents: () => Promise.resolve(mockFileContents),
}));

jest.mock('../data/image', () => ({
  loadHTMLImageElement: jest.fn(),
}));

jest.mock('../utils/common', () => ({
  boardToImage: jest.fn(),
}));

describe('asset-library utils', () => {
  it('识别支持的素材格式', () => {
    expect(
      isSupportedAssetFile(new File([''], 'diagram.svg', { type: '' }))
    ).toBe(true);
    expect(
      isSupportedAssetFile(new File([''], 'image.webp', { type: 'image/webp' }))
    ).toBe(true);
    expect(
      isSupportedAssetFile(new File([''], 'component.drawnix', { type: '' }))
    ).toBe(true);
    expect(
      isSupportedAssetFile(new File([''], 'movie.mp4', { type: 'video/mp4' }))
    ).toBe(false);
  });

  it('根据 MIME 类型区分 SVG 和普通图片', () => {
    expect(getAssetKind('image/svg+xml')).toBe('svg');
    expect(getAssetKind('image/png')).toBe('image');
    expect(getAssetKind('application/vnd.drawnix+json')).toBe('drawnix');
  });

  it('从 .drawnix 文件创建画板素材并生成缩略图', async () => {
    mockFileContents = JSON.stringify({
      type: 'drawnix',
      version: 2,
      source: 'web',
      elements: [
        {
          id: 'shape-1',
          type: 'geometry',
          points: [
            [0, 0],
            [120, 80],
          ],
        },
      ],
      viewport: { zoom: 1 },
    });
    const file = new File([mockFileContents], 'component.drawnix', {
      type: '',
    });

    const asset = await createAssetLibraryItemFromFile(file);

    expect(asset).toEqual(
      expect.objectContaining({
        id: 'asset-id',
        name: 'component',
        kind: 'drawnix',
        mimeType: 'application/vnd.drawnix+json',
        elementCount: 1,
      })
    );
    expect(asset.dataUrl).toContain('data:application/vnd.drawnix+json');
    expect(asset.thumbnailDataUrl).toContain('data:image/svg+xml');
  });

  it('清理 SVG 中的脚本、事件和外部引用', () => {
    const sanitized = sanitizeSvgSource(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><image href="https://example.com/a.png" onload="x()"/><rect onclick="x()" width="10" height="10"/></svg>'
    );

    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onload');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('https://example.com');
  });

  it('格式化素材文件大小', () => {
    expect(formatAssetFileSize(0)).toBe('0 B');
    expect(formatAssetFileSize(1024)).toBe('1.0 KB');
    expect(formatAssetFileSize(2 * 1024 * 1024)).toBe('2.00 MB');
  });

  it('将 data url 转回 Blob', async () => {
    const blob = dataUrlToBlob('data:text/plain;charset=utf-8,hello');

    expect(blob.type).toBe('text/plain');
    expect(blob.size).toBe(5);
  });

  it('将包含中文的 data url 转回 UTF-8 Blob', async () => {
    const blob = dataUrlToBlob(
      `data:application/json;charset=utf-8,${encodeURIComponent(
        '{"text":"中文"}'
      )}`
    );

    expect(await readBlobText(blob)).toBe('{"text":"中文"}');
  });
});
