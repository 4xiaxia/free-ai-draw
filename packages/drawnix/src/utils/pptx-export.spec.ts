import { saveAsPptx } from './pptx-export';

const mockGetSelectedElements = jest.fn();
const mockGetRectangleByElements = jest.fn();
const mockFileSave = jest.fn();
const mockExportBoardToRasterBlob = jest.fn();
const mockGetBackgroundColor = jest.fn();

const mockAddSlide = jest.fn();
const mockDefineLayout = jest.fn();
const mockWrite = jest.fn();
const mockAddShape = jest.fn();
const mockAddText = jest.fn();
const mockAddImage = jest.fn();

jest.mock('@plait/core', () => ({
  getSelectedElements: (...args: unknown[]) =>
    mockGetSelectedElements(...args),
  getRectangleByElements: (...args: unknown[]) =>
    mockGetRectangleByElements(...args),
}));

jest.mock('../data/filesystem', () => ({
  fileSave: (...args: unknown[]) => mockFileSave(...args),
}));

jest.mock('./common', () => ({
  exportBoardToRasterBlob: (...args: unknown[]) =>
    mockExportBoardToRasterBlob(...args),
}));

jest.mock('./color', () => ({
  getBackgroundColor: (...args: unknown[]) => mockGetBackgroundColor(...args),
}));

jest.mock('pptxgenjs', () => {
  return jest.fn().mockImplementation(() => ({
    defineLayout: mockDefineLayout,
    addSlide: mockAddSlide,
    write: mockWrite,
  }));
});

describe('saveAsPptx', () => {
  const slide = {
    addShape: mockAddShape,
    addText: mockAddText,
    addImage: mockAddImage,
    background: undefined as any,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-26T12:00:00Z'));
    mockGetSelectedElements.mockReset();
    mockGetRectangleByElements.mockReset();
    mockFileSave.mockReset();
    mockExportBoardToRasterBlob.mockReset();
    mockGetBackgroundColor.mockReset();
    mockAddSlide.mockReset();
    mockDefineLayout.mockReset();
    mockWrite.mockReset();
    mockAddShape.mockReset();
    mockAddText.mockReset();
    mockAddImage.mockReset();

    mockAddSlide.mockReturnValue(slide);
    mockWrite.mockResolvedValue(
      new Blob(['pptx'], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
    );
    mockFileSave.mockResolvedValue({ fileHandle: null });
    mockGetSelectedElements.mockReturnValue([]);
    mockGetBackgroundColor.mockReturnValue('#F7F8FB');
    mockExportBoardToRasterBlob.mockResolvedValue(
      new Blob(['png'], { type: 'image/png' })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exports native geometry and text elements into a pptx slide', async () => {
    const rectangle = {
      id: 'shape-1',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [96, 48],
      ],
      fill: '#DBEAFE',
      strokeColor: '#111111',
      strokeWidth: 2,
      text: '',
    };
    const text = {
      id: 'text-1',
      type: 'geometry',
      shape: 'text',
      points: [
        [96, 0],
        [192, 48],
      ],
      text: {
        type: 'paragraph',
        children: [
          {
            text: '标题',
            color: '#222222',
          },
        ],
      },
      textProperties: {
        'font-size': '24',
        'font-family': 'Arial',
        color: '#222222',
      },
    };
    const board = {
      children: [rectangle, text],
    } as any;

    mockGetRectangleByElements.mockImplementation((_board, elements) => {
      const first = elements[0];
      if (elements.length === 2) {
        return { x: 0, y: 0, width: 192, height: 48 };
      }
      if (first.id === 'shape-1') {
        return { x: 0, y: 0, width: 96, height: 48 };
      }
      return { x: 96, y: 0, width: 96, height: 48 };
    });

    await saveAsPptx(board, 'demo');

    expect(mockDefineLayout).toHaveBeenCalledWith({
      name: 'DRAWNIX_EXPORT',
      width: 2,
      height: 0.5,
    });
    expect(slide.background).toEqual({ color: 'F7F8FB' });
    expect(mockAddShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        x: 0,
        y: 0,
        w: 1,
        h: 0.5,
      })
    );
    expect(mockAddText).toHaveBeenCalledWith(
      '标题',
      expect.objectContaining({
        x: 1,
        y: 0,
        w: 1,
        h: 0.5,
        fontFace: 'Arial',
      })
    );
    expect(mockWrite).toHaveBeenCalledWith({
      outputType: 'blob',
      compression: true,
    });
    expect(mockFileSave).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        name: 'demo',
        extension: 'pptx',
      })
    );
  });

  it('falls back unsupported line shapes to a padded image export', async () => {
    const arrow = {
      id: 'arrow-1',
      type: 'arrow-line',
      shape: 'elbow',
      points: [
        [10, 20],
        [60, 20],
        [60, 50],
      ],
      source: { marker: 'none' },
      target: { marker: 'arrow' },
      strokeColor: '#333333',
      strokeWidth: 2,
    };
    const board = {
      children: [arrow],
    } as any;

    mockGetRectangleByElements.mockImplementation((_board, elements) => {
      if (elements.length === 1 && elements[0].id === 'arrow-1') {
        return { x: 10, y: 20, width: 50, height: 30 };
      }
      return { x: 10, y: 20, width: 50, height: 30 };
    });

    await saveAsPptx(board, 'fallback');

    expect(mockExportBoardToRasterBlob).toHaveBeenCalledWith(board, {
      elements: [arrow],
      fillStyle: 'transparent',
    });
    expect(mockAddImage).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 0,
        y: 0,
        w: 90 / 96,
        h: 70 / 96,
      })
    );
  });

  it('uses the raw element frame for rotated geometry placement while keeping rendered bounds for slide size', async () => {
    const rotated = {
      id: 'rotated-1',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [100, 120],
        [220, 180],
      ],
      angle: 30,
      fill: '#DBEAFE',
      strokeColor: '#111111',
      strokeWidth: 2,
      text: '',
    };
    const board = {
      children: [rotated],
    } as any;

    mockGetRectangleByElements.mockImplementation((_board, elements) => {
      if (elements.length === 1 && elements[0].id === 'rotated-1') {
        return { x: 80, y: 100, width: 180, height: 120 };
      }
      return { x: 80, y: 100, width: 180, height: 120 };
    });

    await saveAsPptx(board, 'rotated');

    expect(mockDefineLayout).toHaveBeenCalledWith({
      name: 'DRAWNIX_EXPORT',
      width: 120 / 96,
      height: 60 / 96,
    });
    expect(mockAddShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        x: 0,
        y: 0,
        w: 120 / 96,
        h: 60 / 96,
        rotate: 30,
      })
    );
  });

  it('does not let a rotated native image enlarge slide bounds and shift unrelated elements', async () => {
    const rectangle = {
      id: 'shape-1',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [100, 100],
        [220, 180],
      ],
      fill: '#DBEAFE',
      strokeColor: '#111111',
      strokeWidth: 2,
      text: '',
    };
    const rotatedImage = {
      id: 'pin-1',
      type: 'image',
      url: 'data:image/png;base64,ZmFrZQ==',
      points: [
        [300, 100],
        [340, 140],
      ],
      angle: 35,
    };
    const board = {
      children: [rectangle, rotatedImage],
    } as any;

    mockGetRectangleByElements.mockImplementation((_board, elements) => {
      if (elements.length === 1 && elements[0].id === 'shape-1') {
        return { x: 100, y: 100, width: 120, height: 80 };
      }
      if (elements.length === 1 && elements[0].id === 'pin-1') {
        return { x: 285, y: 85, width: 70, height: 70 };
      }
      return { x: 90, y: 90, width: 265, height: 90 };
    });

    await saveAsPptx(board, 'native-image-bounds');

    expect(mockDefineLayout).toHaveBeenCalledWith({
      name: 'DRAWNIX_EXPORT',
      width: 240 / 96,
      height: 80 / 96,
    });
    expect(mockAddShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        x: 0,
        y: 0,
        w: 120 / 96,
        h: 80 / 96,
      })
    );
    expect(mockAddImage).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 200 / 96,
        y: 0,
        w: 40 / 96,
        h: 40 / 96,
        sizing: {
          type: 'contain',
          w: 40 / 96,
          h: 40 / 96,
        },
        rotate: 35,
      })
    );
  });
});
