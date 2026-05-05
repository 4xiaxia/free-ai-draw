import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  applyIconLibraryAsset,
  canReplaceSelectionWithIcon,
  ICON_LIBRARY_STORAGE_KEY,
  loadStoredIconLibraryAssets,
} from './icon-library';

const mockGetSelectedElements = jest.fn();
const mockFindPath = jest.fn(() => [0]);
const mockSetNode = jest.fn();
const mockWithNewBatch = jest.fn((_: unknown, fn: () => void) => fn());
const mockInsertImage = jest.fn();
const mockGetElementOfFocusedImage = jest.fn(() => null);
const mockMindIsMindElement = jest.fn(() => false);
const mockMindSetImage = jest.fn();

jest.mock('@plait/common', () => ({
  getElementOfFocusedImage: (...args: unknown[]) =>
    mockGetElementOfFocusedImage(...args),
}));

jest.mock('@plait/core', () => ({
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  idCreator: () => 'generated-id',
  PlaitBoard: {
    findPath: (...args: unknown[]) => mockFindPath(...args),
  },
  PlaitHistoryBoard: {
    withNewBatch: (...args: unknown[]) => mockWithNewBatch(...args),
  },
  Transforms: {
    setNode: (...args: unknown[]) => mockSetNode(...args),
  },
}));

jest.mock('@plait/draw', () => ({
  DrawTransforms: {
    insertImage: (...args: unknown[]) => mockInsertImage(...args),
  },
  PlaitDrawElement: {
    isImage: (value: any) => value?.type === 'image',
    isGeometry: (value: any) => value?.type === 'geometry',
    isText: (value: any) => value?.shape === 'text',
  },
}));

jest.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: (...args: unknown[]) => mockMindIsMindElement(...args),
  },
  MindTransforms: {
    setImage: (...args: unknown[]) => mockMindSetImage(...args),
  },
}));

describe('icon-library', () => {
  beforeEach(() => {
    mockGetSelectedElements.mockReset();
    mockFindPath.mockReset();
    mockSetNode.mockReset();
    mockWithNewBatch.mockReset();
    mockInsertImage.mockReset();
    mockGetElementOfFocusedImage.mockReset();
    mockMindIsMindElement.mockReset();
    mockMindSetImage.mockReset();

    mockFindPath.mockReturnValue([0]);
    mockWithNewBatch.mockImplementation((_: unknown, fn: () => void) => fn());
    mockGetSelectedElements.mockReturnValue([]);
    mockGetElementOfFocusedImage.mockReturnValue(null);
    mockMindIsMindElement.mockReturnValue(false);

    localStorage.clear();
  });

  it('遇到损坏的本地图标库缓存时应返回空数组', () => {
    localStorage.setItem(ICON_LIBRARY_STORAGE_KEY, '{broken');

    expect(loadStoredIconLibraryAssets()).toEqual([]);
  });

  it('没有可替换目标时应插入新图标', () => {
    const board = {} as any;

    applyIconLibraryAsset(board, {
      id: 'icon-1',
      name: 'database',
      dataUrl: 'data:image/svg+xml;base64,aaa',
      thumbnailDataUrl: 'data:image/svg+xml;base64,aaa',
      mimeType: 'image/svg+xml',
      kind: 'svg',
      source: 'local',
      size: 128,
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
      favorite: false,
      isSubject: false,
      width: 240,
      height: 120,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mockInsertImage).toHaveBeenCalledWith(
      board,
      expect.objectContaining({
        url: 'data:image/svg+xml;base64,aaa',
        width: 240,
        height: 120,
      })
    );
  });

  it('选中流程图节点时应原位替换为图标', () => {
    const selectedElement = {
      id: 'shape-1',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [120, 60],
      ],
      fill: '#fff',
      strokeColor: '#333',
    };
    const board = { children: [selectedElement] } as any;

    mockGetSelectedElements.mockReturnValue([selectedElement]);

    applyIconLibraryAsset(board, {
      id: 'icon-2',
      name: 'server',
      dataUrl: 'data:image/svg+xml;base64,bbb',
      thumbnailDataUrl: 'data:image/svg+xml;base64,bbb',
      mimeType: 'image/svg+xml',
      kind: 'svg',
      source: 'local',
      size: 128,
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
      favorite: false,
      isSubject: false,
      width: 64,
      height: 64,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mockInsertImage).not.toHaveBeenCalled();

    expect(mockWithNewBatch).toHaveBeenCalledTimes(1);
    expect(mockSetNode).toHaveBeenCalledWith(
      board,
      expect.objectContaining({
        type: 'image',
        url: 'data:image/svg+xml;base64,bbb',
        points: [
          [0, 0],
          [120, 60],
        ],
        shape: undefined,
        text: undefined,
        fill: undefined,
      }),
      [0]
    );
    expect(mockInsertImage).not.toHaveBeenCalled();
  });

  it('选中思维导图节点时应复用节点图片能力', () => {
    const selectedMind = {
      id: 'mind-1',
      type: 'mind-node',
    };
    const board = {} as any;

    mockGetSelectedElements.mockReturnValue([selectedMind]);
    mockMindIsMindElement.mockReturnValue(true);

    applyIconLibraryAsset(board, {
      id: 'icon-3',
      name: 'brain',
      dataUrl: 'data:image/svg+xml;base64,ccc',
      thumbnailDataUrl: 'data:image/svg+xml;base64,ccc',
      mimeType: 'image/svg+xml',
      kind: 'svg',
      source: 'local',
      size: 128,
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
      favorite: false,
      isSubject: false,
      width: 128,
      height: 64,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mockMindSetImage).toHaveBeenCalledWith(
      board,
      selectedMind,
      expect.objectContaining({
        url: 'data:image/svg+xml;base64,ccc',
        width: 240,
        height: 120,
      })
    );
  });

  it('只有单个非文本几何节点或图片节点时才允许替换', () => {
    mockGetSelectedElements.mockReturnValue([
      { id: 'shape-1', type: 'geometry', shape: 'rectangle' },
    ]);
    expect(canReplaceSelectionWithIcon({} as any)).toBe(true);

    mockGetSelectedElements.mockReturnValue([
      { id: 'text-1', type: 'geometry', shape: 'text' },
    ]);
    expect(canReplaceSelectionWithIcon({} as any)).toBe(false);

    mockGetSelectedElements.mockReturnValue([
      { id: 'shape-1', type: 'geometry', shape: 'rectangle' },
      { id: 'shape-2', type: 'geometry', shape: 'rectangle' },
    ]);
    expect(canReplaceSelectionWithIcon({} as any)).toBe(false);
  });
});
