import { idCreator } from '@plait/core';
import { IMAGE_MIME_TYPES } from '../constants';
import { getDataURL, parseFileContents } from '../data/blob';
import { loadHTMLImageElement } from '../data/image';
import type { AssetLibraryItem, AssetLibraryKind } from './types';

export const SUPPORTED_ASSET_EXTENSIONS = [
  'svg',
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const;

export const SUPPORTED_ASSET_MIME_TYPES = [
  IMAGE_MIME_TYPES.svg,
  IMAGE_MIME_TYPES.png,
  IMAGE_MIME_TYPES.jpg,
  IMAGE_MIME_TYPES.webp,
] as const;

export const MAX_ASSET_FILE_SIZE = 8 * 1024 * 1024;

export const ASSET_LIBRARY_SOFT_LIMIT = 48 * 1024 * 1024;

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  svg: IMAGE_MIME_TYPES.svg,
  png: IMAGE_MIME_TYPES.png,
  jpg: IMAGE_MIME_TYPES.jpg,
  jpeg: IMAGE_MIME_TYPES.jpg,
  webp: IMAGE_MIME_TYPES.webp,
};

const RISKY_SVG_ELEMENTS = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
];

export const getAssetExtension = (name: string) => {
  const match = /\.([^.]+)$/.exec(name.toLowerCase());
  return match?.[1] || '';
};

export const getAssetMimeType = (file: File) => {
  return file.type || EXTENSION_TO_MIME_TYPE[getAssetExtension(file.name)] || '';
};

export const isSupportedAssetFile = (file: File) => {
  const mimeType = getAssetMimeType(file);
  if ((SUPPORTED_ASSET_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return true;
  }
  return (SUPPORTED_ASSET_EXTENSIONS as readonly string[]).includes(
    getAssetExtension(file.name)
  );
};

export const getAssetKind = (mimeType: string): AssetLibraryKind => {
  return mimeType === IMAGE_MIME_TYPES.svg ? 'svg' : 'image';
};

export const formatAssetFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }
  if (size < 1024) {
    return `${Math.round(size)} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

export const sanitizeAssetName = (name: string) => {
  const normalized = name.replace(/\.[^.]+$/, '').trim();
  return normalized || 'asset';
};

const removeExternalReference = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.startsWith('#') ||
    normalized.startsWith('data:') ||
    normalized === ''
  ) {
    return false;
  }
  return normalized.includes('://') || normalized.startsWith('//');
};

const sanitizeSvgWithParser = (svgText: string) => {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, 'image/svg+xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid SVG');
  }

  RISKY_SVG_ELEMENTS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => element.remove());
  });

  document.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (
        (name === 'href' || name === 'xlink:href' || name === 'src') &&
        removeExternalReference(value)
      ) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (name === 'style' && /url\s*\(\s*['"]?(https?:|\/\/)/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return new XMLSerializer().serializeToString(document.documentElement);
};

const sanitizeSvgFallback = (svgText: string) => {
  return svgText
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(?:href|xlink:href|src)\s*=\s*(['"])(?:https?:|\/\/).*?\1/gi, '');
};

export const sanitizeSvgSource = (svgText: string) => {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return sanitizeSvgFallback(svgText);
  }
  return sanitizeSvgWithParser(svgText);
};

export const svgSourceToDataUrl = (svgText: string) => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
};

const readImageSize = async (dataUrl: string) => {
  try {
    const image = await loadHTMLImageElement(dataUrl as any);
    return {
      width: image.width,
      height: image.height,
    };
  } catch {
    return {
      width: undefined,
      height: undefined,
    };
  }
};

export const createAssetLibraryItemFromFile = async (
  file: File
): Promise<AssetLibraryItem> => {
  if (!isSupportedAssetFile(file)) {
    throw new Error('Unsupported asset type');
  }
  if (file.size > MAX_ASSET_FILE_SIZE) {
    throw new Error('Asset file is too large');
  }

  const mimeType = getAssetMimeType(file);
  const kind = getAssetKind(mimeType);
  const dataUrl =
    kind === 'svg'
      ? svgSourceToDataUrl(sanitizeSvgSource(await parseFileContents(file)))
      : await getDataURL(file);
  const size = await readImageSize(dataUrl);
  const now = new Date().toISOString();

  return {
    id: idCreator(),
    name: sanitizeAssetName(file.name),
    mimeType,
    kind,
    source: 'local',
    size: file.size,
    createdAt: now,
    updatedAt: now,
    tags: [],
    favorite: false,
    isSubject: false,
    dataUrl,
    thumbnailDataUrl: dataUrl,
    ...size,
  };
};

export const createAssetLibraryItemsFromFiles = async (files: File[]) => {
  const results = await Promise.allSettled(
    files.map((file) => createAssetLibraryItemFromFile(file))
  );
  return results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );
};

export const getAssetLibraryUsage = (assets: AssetLibraryItem[]) => {
  return assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
};

export const dataUrlToBlob = (dataUrl: string) => {
  const [metadata, payload] = dataUrl.split(',');
  const mimeType = /^data:([^;]+)/.exec(metadata)?.[1] || 'application/octet-stream';
  const binary = metadata.includes(';base64')
    ? atob(payload)
    : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};
