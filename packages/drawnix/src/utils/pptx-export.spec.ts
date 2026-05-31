import { saveAsPptx } from './pptx-export';

const mockGetSelectedElements = jest.fn();
const mockGetRectangleByElements = jest.fn();
const mockFileSave = jest.fn();
const mockExportBoardToRasterBlob = jest.fn();
const mockGetBackgroundColor = jest.fn();
const mockApplyImageEraseMask = jest.fn();

const mockAddSlide = jest.fn();
const mockDefineLayout = jest.fn();
const mockWrite = jest.fn();
const mockAddShape = jest.fn();
const mockAddText = jest.fn();
const mockAddImage = jest.fn();

const PX_PER_INCH = 96;
const PPTX_SLIDE_WIDTH_IN = 13.333333;
const PPTX_SLIDE_HEIGHT_IN = 7.5;
const PPTX_SLIDE_WIDTH_PX = PPTX_SLIDE_WIDTH_IN * PX_PER_INCH;
const PPTX_SLIDE_HEIGHT_PX = PPTX_SLIDE_HEIGHT_IN * PX_PER_INCH;
const PPTX_SAFE_MARGIN_PX = 48;

const pxToInches = (value: number) => value / PX_PER_INCH;

const expectStandardLayout = () => {
  expect(mockDefineLayout).toHaveBeenCalledWith({
    name: 'DRAWNIX_EXPORT',
    width: PPTX_SLIDE_WIDTH_IN,
    height: PPTX_SLIDE_HEIGHT_IN,
  });
};

const getExportTransform = (bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}) => {
  const scale = Math.min(
    1,
    (PPTX_SLIDE_WIDTH_PX - PPTX_SAFE_MARGIN_PX * 2) / bounds.width,
    (PPTX_SLIDE_HEIGHT_PX - PPTX_SAFE_MARGIN_PX * 2) / bounds.height
  );
  return {
    scale,
    x: (PPTX_SLIDE_WIDTH_PX - bounds.width * scale) / 2,
    y: (PPTX_SLIDE_HEIGHT_PX - bounds.height * scale) / 2,
  };
};

jest.mock('@plait/core', () => ({
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
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

jest.mock('./image-erase', () => ({
  applyImageEraseMask: (...args: unknown[]) => mockApplyImageEraseMask(...args),
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
    mockApplyImageEraseMask.mockReset();
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
    mockApplyImageEraseMask.mockImplementation((sourceUrl) =>
      Promise.resolve(sourceUrl)
    );
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

    const transform = getExportTransform({
      x: 0,
      y: 0,
      width: 192,
      height: 48,
    });
    expectStandardLayout();
    expect(slide.background).toEqual({ color: 'F7F8FB' });
    expect(mockAddShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        x: pxToInches(transform.x),
        y: pxToInches(transform.y),
        w: 1,
        h: 0.5,
      })
    );
    expect(mockAddText).toHaveBeenCalledWith(
      '标题',
      expect.objectContaining({
        x: pxToInches(transform.x + 96),
        y: pxToInches(transform.y),
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
        x: pxToInches(
          getExportTransform({ x: -10, y: 0, width: 90, height: 70 }).x
        ),
        y: pxToInches(
          getExportTransform({ x: -10, y: 0, width: 90, height: 70 }).y
        ),
        w: 90 / 96,
        h: 70 / 96,
      })
    );
  });

  it('uses rendered bounds as slide origin while placing rotated geometry by its raw frame', async () => {
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

    const transform = getExportTransform({
      x: 80,
      y: 100,
      width: 180,
      height: 120,
    });
    expectStandardLayout();
    expect(mockAddShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        x: pxToInches(transform.x + 20),
        y: pxToInches(transform.y + 20),
        w: 120 / 96,
        h: 60 / 96,
        rotate: 30,
      })
    );
  });

  it('preserves visual relative positions when native images have rotated rendered bounds', async () => {
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
      return { x: 100, y: 85, width: 255, height: 95 };
    });

    await saveAsPptx(board, 'native-image-bounds');

    const transform = getExportTransform({
      x: 100,
      y: 85,
      width: 255,
      height: 95,
    });
    expectStandardLayout();
    expect(mockAddShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        x: pxToInches(transform.x),
        y: pxToInches(transform.y + 15),
        w: 120 / 96,
        h: 80 / 96,
      })
    );
    expect(mockAddImage).toHaveBeenCalledWith(
      expect.objectContaining({
        x: pxToInches(transform.x + 200),
        y: pxToInches(transform.y + 15),
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

  it('rasterizes text-bearing geometry as one image to avoid PPT text metric drift', async () => {
    const labeledRectangle = {
      id: 'label-1',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [40, 60],
        [180, 100],
      ],
      fill: '#FFFFFF',
      strokeColor: '#111111',
      strokeWidth: 1,
      text: {
        type: 'paragraph',
        children: [{ text: 'Prompt\nOptimization' }],
      },
      textProperties: {
        'font-size': '12',
      },
    };
    const board = {
      children: [labeledRectangle],
    } as any;

    mockGetRectangleByElements.mockImplementation((_board, elements) => {
      if (elements.length === 1 && elements[0].id === 'label-1') {
        return { x: 40, y: 60, width: 140, height: 40 };
      }
      return { x: 40, y: 60, width: 140, height: 40 };
    });

    await saveAsPptx(board, 'text-shape');

    expect(mockExportBoardToRasterBlob).toHaveBeenCalledWith(board, {
      elements: [labeledRectangle],
      fillStyle: 'transparent',
    });
    expect(mockAddShape).not.toHaveBeenCalled();
    expect(mockAddText).not.toHaveBeenCalled();
    expect(mockAddImage).toHaveBeenCalledWith(
      expect.objectContaining({
        x: pxToInches(
          getExportTransform({ x: 20, y: 40, width: 180, height: 80 }).x
        ),
        y: pxToInches(
          getExportTransform({ x: 20, y: 40, width: 180, height: 80 }).y
        ),
        w: 180 / 96,
        h: 80 / 96,
      })
    );
  });

  it('scales oversized board content into a standard widescreen pptx slide', async () => {
    const oversizedRectangle = {
      id: 'large-1',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [4000, 2000],
      ],
      fill: '#FFFFFF',
      strokeColor: '#111111',
      strokeWidth: 4,
      text: '',
    };
    const board = {
      children: [oversizedRectangle],
    } as any;

    mockGetRectangleByElements.mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 4000,
      height: 2000,
    }));

    await saveAsPptx(board, 'oversized');

    const transform = getExportTransform({
      x: 0,
      y: 0,
      width: 4000,
      height: 2000,
    });
    expect(transform.scale).toBeLessThan(1);
    expectStandardLayout();
    expect(mockAddShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        x: pxToInches(transform.x),
        y: pxToInches(transform.y),
        w: pxToInches(4000 * transform.scale),
        h: pxToInches(2000 * transform.scale),
        line: expect.objectContaining({
          width: 1,
        }),
      })
    );
  });

  it('exports erased images with the composited erase mask result', async () => {
    const erasedImage = {
      id: 'image-1',
      type: 'image',
      url: 'data:image/png;base64,original',
      points: [
        [0, 0],
        [96, 96],
      ],
      eraseMask: {
        version: 1,
        strokes: [{ points: [[0.5, 0.5]], radius: 0.1 }],
      },
    };
    const board = {
      children: [erasedImage],
    } as any;

    mockApplyImageEraseMask.mockResolvedValue('data:image/png;base64,masked');
    mockGetRectangleByElements.mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 96,
      height: 96,
    }));

    await saveAsPptx(board, 'erased-image');

    expect(mockApplyImageEraseMask).toHaveBeenCalledWith(
      'data:image/png;base64,original',
      erasedImage.eraseMask
    );
    expect(mockAddImage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: 'data:image/png;base64,masked',
        x: pxToInches(
          getExportTransform({ x: 0, y: 0, width: 96, height: 96 }).x
        ),
        y: pxToInches(
          getExportTransform({ x: 0, y: 0, width: 96, height: 96 }).y
        ),
        w: 1,
        h: 1,
      })
    );
  });
});
