import { getSelectedElements, PlaitBoard, PlaitElement } from '@plait/core';
import { idCreator } from '@plait/core';
import { IMAGE_MIME_TYPES, MIME_TYPES } from '../constants';
import { getDataURL, parseFileContents } from '../data/blob';
import { loadHTMLImageElement } from '../data/image';
import {
  createBoardSnapshot,
  isValidDrawnixData,
  normalizeDrawnixData,
  serializeBoardSnapshot,
} from '../data/snapshot';
import type { DrawnixExportedData } from '../data/types';
import { boardToImage } from '../utils/common';
import type { AssetLibraryItem, AssetLibraryKind } from './types';

export const SUPPORTED_ASSET_EXTENSIONS = [
  'svg',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'drawnix',
] as const;

export const SUPPORTED_ASSET_MIME_TYPES = [
  IMAGE_MIME_TYPES.svg,
  IMAGE_MIME_TYPES.png,
  IMAGE_MIME_TYPES.jpg,
  IMAGE_MIME_TYPES.webp,
  MIME_TYPES.drawnix,
] as const;

export const MAX_ASSET_FILE_SIZE = 8 * 1024 * 1024;

export const ASSET_LIBRARY_SOFT_LIMIT = 48 * 1024 * 1024;

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  svg: IMAGE_MIME_TYPES.svg,
  png: IMAGE_MIME_TYPES.png,
  jpg: IMAGE_MIME_TYPES.jpg,
  jpeg: IMAGE_MIME_TYPES.jpg,
  webp: IMAGE_MIME_TYPES.webp,
  drawnix: MIME_TYPES.drawnix,
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
  const extension = getAssetExtension(file.name);
  return EXTENSION_TO_MIME_TYPE[extension] || file.type || '';
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
  if (mimeType === MIME_TYPES.drawnix) {
    return 'drawnix';
  }
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
    .replace(
      /\s(?:href|xlink:href|src)\s*=\s*(['"])(?:https?:|\/\/).*?\1/gi,
      ''
    );
};

export const sanitizeSvgSource = (svgText: string) => {
  if (
    typeof DOMParser === 'undefined' ||
    typeof XMLSerializer === 'undefined'
  ) {
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

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getDrawnixElementKind = (element: PlaitElement) => {
  const candidate = element as { type?: unknown; shape?: unknown };
  return String(candidate.type || candidate.shape || 'element');
};

const getDrawnixElementSummary = (elements: PlaitElement[]) => {
  const counts = new Map<string, number>();
  const visit = (element: PlaitElement) => {
    const kind = getDrawnixElementKind(element);
    counts.set(kind, (counts.get(kind) || 0) + 1);
    if (Array.isArray(element.children)) {
      element.children.forEach((child) => visit(child));
    }
  };
  elements.forEach((element) => visit(element));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kind, count]) => `${kind} x ${count}`)
    .join(' / ');
};

const createDrawnixThumbnailDataUrl = (
  data: DrawnixExportedData,
  name: string
) => {
  const width = 280;
  const height = 180;
  const elementCount = data.elements.length;
  const summary = getDrawnixElementSummary(data.elements) || 'empty board';
  const safeName = escapeSvgText(name);
  const safeSummary = escapeSvgText(summary);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="18" fill="#f7f8fb"/>
  <rect x="22" y="18" width="236" height="144" rx="14" fill="#fff" stroke="#d0d5dd"/>
  <path d="M42 50h116M42 74h196M42 98h164" stroke="#d0d5dd" stroke-width="6" stroke-linecap="round"/>
  <rect x="42" y="116" width="72" height="24" rx="12" fill="#111827"/>
  <text x="78" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#fff">${elementCount} items</text>
  <text x="42" y="36" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#111827">${safeName}</text>
  <text x="42" y="154" font-family="Arial, sans-serif" font-size="10" fill="#667085">${safeSummary}</text>
</svg>`;
  return svgSourceToDataUrl(svg);
};

export const createDrawnixDataUrl = (serialized: string) => {
  return `data:${MIME_TYPES.drawnix};charset=utf-8,${encodeURIComponent(
    serialized
  )}`;
};

export const parseDrawnixFile = async (file: File) => {
  const contents = await parseFileContents(file);
  const parsed = JSON.parse(contents);
  if (!isValidDrawnixData(parsed)) {
    throw new Error('Invalid Drawnix file');
  }
  return normalizeDrawnixData(parsed);
};

export const createAssetLibraryItemFromDrawnixData = (
  data: DrawnixExportedData,
  options: {
    name: string;
    size?: number;
    thumbnailDataUrl?: string;
  }
): AssetLibraryItem => {
  const serialized = serializeBoardSnapshot(data);
  const now = new Date().toISOString();
  const name = sanitizeAssetName(options.name);
  return {
    id: idCreator(),
    name,
    mimeType: MIME_TYPES.drawnix,
    kind: 'drawnix',
    source: 'local',
    size: options.size ?? new Blob([serialized]).size,
    createdAt: now,
    updatedAt: now,
    tags: [],
    favorite: false,
    isSubject: false,
    width: 280,
    height: 180,
    elementCount: data.elements.length,
    dataUrl: createDrawnixDataUrl(serialized),
    thumbnailDataUrl:
      options.thumbnailDataUrl || createDrawnixThumbnailDataUrl(data, name),
  };
};

export const createAssetLibraryItemFromBoardSelection = async (
  board: PlaitBoard,
  name = `selection-${new Date().getTime()}`
) => {
  const selectedElements = getSelectedElements(board);
  if (!selectedElements.length) {
    throw new Error('No selection');
  }
  const elements = JSON.parse(
    JSON.stringify(selectedElements)
  ) as PlaitElement[];
  const data = createBoardSnapshot(board, {
    elements,
    exportScope: 'selection',
    embeddedIn: 'drawnix',
  });
  let thumbnailDataUrl: string | undefined;
  try {
    thumbnailDataUrl = await boardToImage(board, {
      elements: selectedElements,
      ratio: 1,
      fillStyle: '#ffffff',
    });
  } catch {
    thumbnailDataUrl = createDrawnixThumbnailDataUrl(data, name);
  }
  return createAssetLibraryItemFromDrawnixData(data, {
    name,
    thumbnailDataUrl,
  });
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
  if (kind === 'drawnix') {
    const data = await parseDrawnixFile(file);
    return createAssetLibraryItemFromDrawnixData(data, {
      name: file.name,
      size: file.size,
    });
  }
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
  const mimeType =
    /^data:([^;]+)/.exec(metadata)?.[1] || 'application/octet-stream';
  if (!metadata.includes(';base64')) {
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};
