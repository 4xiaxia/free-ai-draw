import { describe, expect, it, jest } from '@jest/globals';

import {
  dataUrlToBlob,
  formatAssetFileSize,
  getAssetKind,
  isSupportedAssetFile,
  sanitizeSvgSource,
} from './utils';

jest.mock('@plait/core', () => ({
  idCreator: () => 'asset-id',
}));

jest.mock('../data/blob', () => ({
  getDataURL: jest.fn(),
  parseFileContents: (file: File) => file.text(),
}));

jest.mock('../data/image', () => ({
  loadHTMLImageElement: jest.fn(),
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
      isSupportedAssetFile(new File([''], 'movie.mp4', { type: 'video/mp4' }))
    ).toBe(false);
  });

  it('根据 MIME 类型区分 SVG 和普通图片', () => {
    expect(getAssetKind('image/svg+xml')).toBe('svg');
    expect(getAssetKind('image/png')).toBe('image');
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
});
