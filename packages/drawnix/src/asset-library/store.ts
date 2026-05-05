import localforage from 'localforage';
import type { AssetLibraryItem } from './types';
import { getAssetKind } from './utils';

const ASSET_LIBRARY_STORAGE_KEY = 'drawnix-asset-library-assets-v1';
const LEGACY_ICON_LIBRARY_STORAGE_KEY = 'drawnix-icon-library-assets';

type LegacyIconAsset = {
  id: string;
  name: string;
  url: string;
  width?: number;
  height?: number;
  createdAt: number;
};

const isAssetLibraryItem = (value: unknown): value is AssetLibraryItem => {
  const asset = value as AssetLibraryItem | null;
  return (
    !!asset &&
    typeof asset.id === 'string' &&
    typeof asset.name === 'string' &&
    typeof asset.mimeType === 'string' &&
    typeof asset.dataUrl === 'string' &&
    typeof asset.createdAt === 'string'
  );
};

const isLegacyIconAsset = (value: unknown): value is LegacyIconAsset => {
  const asset = value as LegacyIconAsset | null;
  return (
    !!asset &&
    typeof asset.id === 'string' &&
    typeof asset.name === 'string' &&
    typeof asset.url === 'string' &&
    typeof asset.createdAt === 'number'
  );
};

const inferMimeTypeFromDataUrl = (dataUrl: string) => {
  const match = /^data:([^;,]+)/.exec(dataUrl);
  return match?.[1] || 'image/png';
};

const migrateLegacyIconAsset = (asset: LegacyIconAsset): AssetLibraryItem => {
  const mimeType = inferMimeTypeFromDataUrl(asset.url);
  const createdAt = new Date(asset.createdAt).toISOString();
  return {
    id: asset.id,
    name: asset.name,
    mimeType,
    kind: getAssetKind(mimeType),
    source: 'local',
    size: Math.round((asset.url.length * 3) / 4),
    createdAt,
    updatedAt: createdAt,
    tags: [],
    favorite: false,
    isSubject: false,
    width: asset.width,
    height: asset.height,
    dataUrl: asset.url,
    thumbnailDataUrl: asset.url,
  };
};

const readLegacyAssets = () => {
  if (typeof localStorage === 'undefined') {
    return [] as AssetLibraryItem[];
  }
  const raw = localStorage.getItem(LEGACY_ICON_LIBRARY_STORAGE_KEY);
  if (!raw) {
    return [] as AssetLibraryItem[];
  }
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isLegacyIconAsset).map(migrateLegacyIconAsset);
  } catch {
    return [];
  }
};

export const loadAssetLibraryItems = async () => {
  const stored = await localforage.getItem<unknown>(ASSET_LIBRARY_STORAGE_KEY);
  if (Array.isArray(stored)) {
    return stored.filter(isAssetLibraryItem);
  }
  const migrated = readLegacyAssets();
  if (migrated.length) {
    await localforage.setItem(ASSET_LIBRARY_STORAGE_KEY, migrated);
  }
  return migrated;
};

export const saveAssetLibraryItems = async (assets: AssetLibraryItem[]) => {
  await localforage.setItem(ASSET_LIBRARY_STORAGE_KEY, assets);
};

export const clearAssetLibraryItems = async () => {
  await localforage.removeItem(ASSET_LIBRARY_STORAGE_KEY);
};

export { ASSET_LIBRARY_STORAGE_KEY };
