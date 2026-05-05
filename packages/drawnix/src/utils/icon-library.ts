import { getElementOfFocusedImage } from '@plait/common';
import {
  getSelectedElements,
  PlaitBoard,
  PlaitHistoryBoard,
  Point,
  Transforms,
} from '@plait/core';
import { DrawTransforms, PlaitDrawElement } from '@plait/draw';
import { MindElement, MindTransforms } from '@plait/mind';
import { IMAGE_MIME_TYPES } from '../constants';
import { fileOpen } from '../data/filesystem';
import type { AssetLibraryItem } from '../asset-library/types';
import { createAssetLibraryItemsFromFiles } from '../asset-library/utils';

export type IconLibraryAsset = AssetLibraryItem;

export const ICON_LIBRARY_STORAGE_KEY = 'drawnix-icon-library-assets';
export const DEFAULT_ICON_INSERT_MAX_SIDE = 520;
export const DEFAULT_ICON_INSERT_MIN_SIDE = 120;

const normalizeDimension = (
  value: unknown,
  fallback = DEFAULT_ICON_INSERT_MAX_SIDE
) => {
  const dimension = Number(value);
  return Number.isFinite(dimension) && dimension > 0 ? dimension : fallback;
};

const clonePoints = (points: Point[] | undefined) => {
  if (!points) {
    return undefined;
  }
  return points.map((point) => [point[0], point[1]] as Point);
};

const buildInsertedImageItem = (asset: IconLibraryAsset) => {
  const width = normalizeDimension(asset.width);
  const height = normalizeDimension(asset.height);
  const maxSide = Math.max(width, height);
  const minSide = Math.min(width, height);

  let scale = 1;
  if (maxSide > DEFAULT_ICON_INSERT_MAX_SIDE) {
    scale = DEFAULT_ICON_INSERT_MAX_SIDE / maxSide;
  } else if (minSide < DEFAULT_ICON_INSERT_MIN_SIDE) {
    scale = DEFAULT_ICON_INSERT_MIN_SIDE / minSide;
  }

  return {
    url: asset.dataUrl,
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const getSingleSelectedElement = (board: PlaitBoard) => {
  const selectedElements = getSelectedElements(board);
  if (selectedElements.length > 1) {
    return null;
  }
  return selectedElements[0] || getElementOfFocusedImage(board) || null;
};

export const isReplaceableDrawElement = (element: unknown) => {
  if (PlaitDrawElement.isImage(element)) {
    return true;
  }
  return (
    PlaitDrawElement.isGeometry(element) && !PlaitDrawElement.isText(element)
  );
};

export const canReplaceSelectionWithIcon = (board: PlaitBoard) => {
  const selectedElement = getSingleSelectedElement(board);
  if (!selectedElement) {
    return false;
  }
  if (MindElement.isMindElement(board, selectedElement)) {
    return true;
  }
  return isReplaceableDrawElement(selectedElement);
};

export const loadStoredIconLibraryAssets = () => [] as IconLibraryAsset[];

export const saveStoredIconLibraryAssets = (_assets: IconLibraryAsset[]) => {};

export const pickIconLibraryFiles = async () => {
  return fileOpen<true>({
    description: 'Assets',
    extensions: ['svg', 'png', 'jpg', 'webp'] as (keyof typeof IMAGE_MIME_TYPES)[],
    multiple: true,
  });
};

export const loadIconLibraryAssetsFromFiles = async (files: File[]) => {
  return createAssetLibraryItemsFromFiles(files);
};

export const replaceDrawElementWithIcon = (
  board: PlaitBoard,
  element: { points?: Point[]; angle?: number } & Record<string, unknown>,
  asset: IconLibraryAsset
) => {
  const path = PlaitBoard.findPath(board, element as any);
  const patch = {
    type: 'image' as const,
    url: asset.dataUrl,
    points: clonePoints(element.points),
    angle: typeof element.angle === 'number' ? element.angle : 0,
    shape: undefined,
    text: undefined,
    texts: undefined,
    fill: undefined,
    strokeColor: undefined,
    strokeWidth: undefined,
    strokeStyle: undefined,
    opacity: undefined,
    rows: undefined,
    columns: undefined,
    cells: undefined,
  };

  PlaitHistoryBoard.withNewBatch(board, () => {
    Transforms.setNode(board, patch, path);
  });
};

export const applyIconLibraryAsset = (
  board: PlaitBoard,
  asset: IconLibraryAsset
) => {
  const selectedElement = getSingleSelectedElement(board);
  const imageItem = buildInsertedImageItem(asset);

  if (selectedElement && MindElement.isMindElement(board, selectedElement)) {
    MindTransforms.setImage(board, selectedElement as any, imageItem);
    return 'replace' as const;
  }

  if (selectedElement && isReplaceableDrawElement(selectedElement)) {
    replaceDrawElementWithIcon(board, selectedElement, asset);
    return 'replace' as const;
  }

  DrawTransforms.insertImage(board, imageItem);
  return 'insert' as const;
};
