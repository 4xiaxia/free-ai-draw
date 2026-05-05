import {
  applyTextCase,
  applyFontSchemeToCanvas,
  setFillColor,
  setFillColorOpacity,
  setElementPosition,
  setElementGradient,
  setElementGradientAngle,
  setElementGradientColor,
  setElementGradientPreset,
  setElementGradientType,
  setElementImageFill,
  setElementShadow,
  setElementShadowProperty,
  setElementSize,
  setStrokeColor,
  setStrokeColorOpacity,
  setStrokeWidth,
  setSelectedShape,
  setRectangleCornerRadius,
  setTextAlign,
  setTextFontFamily,
  setTextFontWeight,
  setTextLetterSpacing,
  setTextLineHeight,
  setTextScript,
  toggleTextMark,
} from './property';
import { Alignment, PropertyTransforms } from '@plait/common';
import {
  getCurrentFill,
  getCurrentStrokeColor,
  isClosedElement,
} from '../utils/property';
import {
  applyOpacityToHex,
  hexAlphaToOpacity,
  isFullyOpaque,
  isNoColor,
  isValidColor,
  removeHexAlpha,
} from '../utils/color';

const mockGetSelectedElements = jest.fn();
const mockSetNode = jest.fn();
const mockSetFontFamily = jest.fn();
const mockSetTextMarks = jest.fn();
const mockSetTextAlign = jest.fn();
const mockFindPath = jest.fn();

const patchNodeAtPath = (
  children: Record<string, unknown>[],
  path: number[],
  patch: Record<string, unknown>
) => {
  const [index, ...rest] = path;
  if (index === undefined) {
    return;
  }
  if (rest.length === 0) {
    Object.assign(children[index]!, patch);
    return;
  }
  const target = children[index] as Record<string, unknown>;
  const nestedChildren = target['children'] as Record<string, unknown>[];
  patchNodeAtPath(nestedChildren, rest, patch);
};

jest.mock('@plait/common', () => ({
  Alignment: {
    left: 'left',
    center: 'center',
    right: 'right',
  },
  PropertyTransforms: {
    setFillColor: jest.fn(),
    setStrokeColor: jest.fn(),
  },
}));

jest.mock('@plait/core', () => ({
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  isNullOrUndefined: (value: unknown) => value === null || value === undefined,
  Path: {},
  PlaitBoard: {
    findPath: (...args: unknown[]) => mockFindPath(...args),
  },
  PlaitElement: {},
  RectangleClient: {
    getRectangleByPoints: (points: Array<[number, number]>) => {
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
  },
  Transforms: {
    setNode: (...args: unknown[]) => mockSetNode(...args),
  },
}));

jest.mock('@plait/draw', () => ({
  BasicShapes: {
    rectangle: 'rectangle',
    roundRectangle: 'roundRectangle',
  },
  getMemorizeKey: jest.fn(),
  isDrawElementsIncludeText: (elements: Array<Record<string, unknown>>) =>
    elements.some((element) => Boolean(element.text)),
  PlaitDrawElement: {
    isDrawElement: (element: Record<string, unknown>) =>
      ['geometry', 'image'].includes(String(element.type || '')),
    isShapeElement: (element: Record<string, unknown>) =>
      element.type === 'geometry' && Boolean(element.shape),
    isImage: (element: Record<string, unknown>) => element.type === 'image',
    isText: (element: Record<string, unknown>) => element.shape === 'text',
  },
}));

jest.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: () => false,
  },
}));

jest.mock('@plait/text-plugins', () => ({
  DEFAULT_FONT_SIZE: 16,
  TextTransforms: {
    setTextColor: jest.fn(),
    setFontSize: jest.fn(),
    setFontFamily: (...args: unknown[]) => mockSetFontFamily(...args),
    setTextMarks: (...args: unknown[]) => mockSetTextMarks(...args),
    setTextAlign: (...args: unknown[]) => mockSetTextAlign(...args),
  },
}));

jest.mock('../utils/color', () => ({
  applyOpacityToHex: jest.fn(),
  hexAlphaToOpacity: jest.fn(),
  isFullyOpaque: jest.fn(),
  isNoColor: jest.fn(),
  isValidColor: jest.fn(),
  removeHexAlpha: jest.fn(),
}));

jest.mock('../utils/property', () => ({
  getCurrentFill: jest.fn(),
  getCurrentStrokeColor: jest.fn(),
  isClosedElement: jest.fn(),
}));

describe('property font family transforms', () => {
  beforeEach(() => {
    mockGetSelectedElements.mockReset();
    mockSetNode.mockReset();
    mockSetFontFamily.mockReset();
    mockSetTextMarks.mockReset();
    mockSetTextAlign.mockReset();
    mockFindPath.mockReset();
    mockSetNode.mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        patch: Record<string, unknown>,
        path: number[]
      ) => {
        patchNodeAtPath(board.children, path, patch);
      }
    );
    mockFindPath.mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        element: Record<string, unknown>
      ) => [board.children.indexOf(element)]
    );
    (PropertyTransforms.setFillColor as jest.Mock).mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        _color: unknown,
        options: {
          callback: (element: Record<string, unknown>, path: number[]) => void;
        }
      ) => {
        mockGetSelectedElements(board).forEach(
          (element: Record<string, unknown>) => {
            options.callback(element, [board.children.indexOf(element)]);
          }
        );
      }
    );
    (PropertyTransforms.setStrokeColor as jest.Mock).mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        _color: unknown,
        options: {
          callback: (element: Record<string, unknown>, path: number[]) => void;
        }
      ) => {
        mockGetSelectedElements(board).forEach(
          (element: Record<string, unknown>) => {
            options.callback(element, [board.children.indexOf(element)]);
          }
        );
      }
    );
    (isClosedElement as jest.Mock).mockReturnValue(true);
  });

  it('updates both native text leaves and svg-import fragments when setting a font family', () => {
    const nativeText = {
      id: 'native',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [
          {
            text: 'Hello',
            'font-family': 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        ],
      },
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        'font-family': 'Arial, sans-serif',
        fontSize: 16,
      },
      textProperties: {
        fontFamily: 'Arial, sans-serif',
        'font-family': 'Arial, sans-serif',
        'font-size': '16',
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'native',
        sourceFontSize: 16,
        sourceRotation: 0,
        textRole: 'title',
        isPlaceholder: false,
      },
    } as any;
    const fragmentText = {
      id: 'fragment',
      type: 'image',
      url: 'data:image/svg+xml;charset=utf-8,old',
      sceneImportMetadata: {
        kind: 'text-fragment',
        source: 'svg-import',
        sourceElementId: 'fragment',
        sourceText: 'Caption',
        text: 'Caption',
        textRole: 'annotation',
        classList: [],
        hasEmoji: false,
        hasDecorativeSymbol: false,
        hasTspan: false,
        hasTransform: false,
        fontFamilies: [],
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
          fill: '#111111',
        },
        layout: {
          width: 120,
          height: 24,
        },
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'fragment',
        sourceFontSize: 12,
        sourceRotation: 0,
        textRole: 'annotation',
        isPlaceholder: false,
      },
    } as any;
    const board = {
      children: [nativeText, fragmentText],
    } as any;

    mockGetSelectedElements.mockReturnValue([nativeText, fragmentText]);

    setTextFontFamily(board, 'Georgia, serif');

    expect(mockSetFontFamily).toHaveBeenCalled();
    expect(nativeText.textStyle.fontFamily).toContain('Georgia');
    expect(nativeText.textProperties.fontFamily).toContain('Georgia');
    expect(nativeText.textProperties['font-family']).toContain('Georgia');
    expect(nativeText.text.children[0]['font-family']).toContain('Georgia');
    expect(fragmentText.sceneImportMetadata.style.fontFamily).toContain(
      'Georgia'
    );
    expect(decodeURIComponent(fragmentText.url)).toContain('Georgia');
  });

  it('applies the current font scheme across the whole canvas by text role', () => {
    const nativeTitle = {
      id: 'title',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [{ text: 'Title', 'font-family': 'Arial, sans-serif' }],
      },
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        'font-family': 'Arial, sans-serif',
        fontSize: 18,
      },
      textProperties: {
        fontFamily: 'Arial, sans-serif',
        'font-family': 'Arial, sans-serif',
        'font-size': '18',
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'native',
        sourceFontSize: 18,
        sourceRotation: 0,
        textRole: 'title',
        isPlaceholder: false,
      },
    } as any;
    const plainText = {
      id: 'plain',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [{ text: 'Body', 'font-family': 'Arial, sans-serif' }],
      },
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        'font-family': 'Arial, sans-serif',
        fontSize: 14,
      },
      textProperties: {
        fontFamily: 'Arial, sans-serif',
        'font-family': 'Arial, sans-serif',
        'font-size': '14',
      },
    } as any;
    const fragmentAnnotation = {
      id: 'annotation',
      type: 'image',
      url: 'data:image/svg+xml;charset=utf-8,old',
      sceneImportMetadata: {
        kind: 'text-fragment',
        source: 'svg-import',
        sourceElementId: 'annotation',
        sourceText: '(note)',
        text: '(note)',
        textRole: 'annotation',
        classList: [],
        hasEmoji: false,
        hasDecorativeSymbol: false,
        hasTspan: false,
        hasTransform: false,
        fontFamilies: [],
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
          fill: '#111111',
        },
        layout: {
          width: 160,
          height: 28,
        },
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'fragment',
        sourceFontSize: 12,
        sourceRotation: 0,
        textRole: 'annotation',
        isPlaceholder: false,
      },
    } as any;
    const board = {
      children: [nativeTitle, plainText, fragmentAnnotation],
    } as any;

    applyFontSchemeToCanvas(board, {
      title: '"Times New Roman", serif',
      annotation: 'Georgia, serif',
      plain: 'Verdana, sans-serif',
    });

    expect(nativeTitle.textStyle.fontFamily).toContain('Times New Roman');
    expect(nativeTitle.textStyle.fontSize).toBe(18);
    expect(nativeTitle.textProperties.fontFamily).toContain('Times New Roman');
    expect(nativeTitle.text.children[0]['font-family']).toContain(
      'Times New Roman'
    );

    expect(plainText.textStyle.fontFamily).toContain('Verdana');
    expect(plainText.textProperties.fontFamily).toContain('Verdana');
    expect(plainText.text.children[0]['font-family']).toContain('Verdana');

    expect(fragmentAnnotation.sceneImportMetadata.style.fontFamily).toContain(
      'Georgia'
    );
    expect(decodeURIComponent(fragmentAnnotation.url)).toContain('Georgia');
  });
});

describe('setRectangleCornerRadius', () => {
  beforeEach(() => {
    mockGetSelectedElements.mockReset();
    mockSetNode.mockReset();
    mockFindPath.mockReset();
    mockSetNode.mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        patch: Record<string, unknown>,
        path: number[]
      ) => {
        patchNodeAtPath(board.children, path, patch);
      }
    );
    mockFindPath.mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        element: Record<string, unknown>
      ) => [board.children.indexOf(element)]
    );
    (isClosedElement as jest.Mock).mockReturnValue(true);
    (getCurrentFill as jest.Mock).mockImplementation(
      (_board: unknown, element: Record<string, unknown>) =>
        element.fill || '#FFFFFF'
    );
    (getCurrentStrokeColor as jest.Mock).mockImplementation(
      (_board: unknown, element: Record<string, unknown>) =>
        element.strokeColor || '#000000'
    );
    (isValidColor as jest.Mock).mockImplementation(
      (value: unknown) => Boolean(value) && value !== 'none'
    );
    (isNoColor as jest.Mock).mockImplementation(
      (value: unknown) => value === 'none'
    );
    (isFullyOpaque as jest.Mock).mockImplementation(
      (opacity: number) => opacity === 100
    );
    (hexAlphaToOpacity as jest.Mock).mockImplementation((value: string) =>
      /^#[0-9a-f]{8}$/i.test(value) ? 50 : 100
    );
    (removeHexAlpha as jest.Mock).mockImplementation((value: string) => {
      if (typeof value === 'string' && value.includes('@')) {
        return value.split('@')[0].toUpperCase();
      }
      if (/^#[0-9a-f]{8}$/i.test(value)) {
        return value.slice(0, 7).toUpperCase();
      }
      return typeof value === 'string' ? value.toUpperCase() : value;
    });
    (applyOpacityToHex as jest.Mock).mockImplementation(
      (value: string, opacity: number) => `${value}@${opacity}`
    );
  });

  it('为 rectangle 设置正数圆角后应转成 roundRectangle', () => {
    const rectangle = {
      id: 'rect-1',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [120, 60],
      ],
    } as any;
    const board = {
      children: [rectangle],
    } as any;

    mockGetSelectedElements.mockReturnValue([rectangle]);

    setRectangleCornerRadius(board, 18);

    expect(rectangle.shape).toBe('roundRectangle');
    expect(rectangle.radius).toBe(18);
  });

  it('为 roundRectangle 设置 0 后应转回 rectangle', () => {
    const rectangle = {
      id: 'rect-2',
      type: 'geometry',
      shape: 'roundRectangle',
      radius: 16,
      points: [
        [0, 0],
        [120, 60],
      ],
    } as any;
    const board = {
      children: [rectangle],
    } as any;

    mockGetSelectedElements.mockReturnValue([rectangle]);

    setRectangleCornerRadius(board, 0);

    expect(rectangle.shape).toBe('rectangle');
    expect(rectangle.radius).toBe(0);
  });

  it('圆角应按短边的一半进行钳制', () => {
    const rectangle = {
      id: 'rect-3',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [80, 20],
      ],
    } as any;
    const board = {
      children: [rectangle],
    } as any;

    mockGetSelectedElements.mockReturnValue([rectangle]);

    setRectangleCornerRadius(board, 50);

    expect(rectangle.shape).toBe('roundRectangle');
    expect(rectangle.radius).toBe(10);
  });

  it('多选多个矩形类图元时应统一应用并按各自尺寸钳制', () => {
    const rectangle = {
      id: 'rect-4',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [120, 60],
      ],
    } as any;
    const roundRectangle = {
      id: 'rect-5',
      type: 'geometry',
      shape: 'roundRectangle',
      radius: 8,
      points: [
        [0, 0],
        [40, 24],
      ],
    } as any;
    const board = {
      children: [rectangle, roundRectangle],
    } as any;

    mockGetSelectedElements.mockReturnValue([rectangle, roundRectangle]);

    setRectangleCornerRadius(board, 20);

    expect(rectangle.shape).toBe('roundRectangle');
    expect(rectangle.radius).toBe(20);
    expect(roundRectangle.shape).toBe('roundRectangle');
    expect(roundRectangle.radius).toBe(12);
  });

  it('混入非矩形图元时只处理矩形类目标', () => {
    const rectangle = {
      id: 'rect-6',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [100, 60],
      ],
    } as any;
    const ellipse = {
      id: 'ellipse-1',
      type: 'geometry',
      shape: 'ellipse',
      points: [
        [0, 0],
        [100, 60],
      ],
    } as any;
    const board = {
      children: [rectangle, ellipse],
    } as any;

    mockGetSelectedElements.mockReturnValue([rectangle, ellipse]);

    setRectangleCornerRadius(board, 14);

    expect(rectangle.shape).toBe('roundRectangle');
    expect(rectangle.radius).toBe(14);
    expect(ellipse.shape).toBe('ellipse');
    expect(ellipse.radius).toBeUndefined();
  });
});

describe('基础属性面板 transforms', () => {
  beforeEach(() => {
    mockGetSelectedElements.mockReset();
    mockSetNode.mockReset();
    mockSetTextMarks.mockReset();
    mockSetTextAlign.mockReset();
    mockFindPath.mockReset();
    mockSetNode.mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        patch: Record<string, unknown>,
        path: number[]
      ) => {
        patchNodeAtPath(board.children, path, patch);
      }
    );
    mockFindPath.mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        element: Record<string, unknown>
      ) => [board.children.indexOf(element)]
    );
  });

  it('切换选中图形时只更新普通 shape，不处理文本和图片', () => {
    const rectangle = {
      id: 'rect',
      type: 'geometry',
      shape: 'rectangle',
    } as any;
    const text = {
      id: 'text',
      type: 'geometry',
      shape: 'text',
    } as any;
    const image = {
      id: 'image',
      type: 'image',
    } as any;
    const board = {
      children: [rectangle, text, image],
    } as any;

    mockGetSelectedElements.mockReturnValue([rectangle, text, image]);

    setSelectedShape(board, 'ellipse');

    expect(rectangle.shape).toBe('ellipse');
    expect(text.shape).toBe('text');
    expect(image.shape).toBeUndefined();
  });

  it('文本样式和对齐应委托给 TextTransforms', () => {
    const board = { children: [] } as any;

    toggleTextMark(board, 'bold');
    setTextAlign(board, Alignment.right);

    expect(mockSetTextMarks).toHaveBeenCalledWith(board, 'bold');
    expect(mockSetTextAlign).toHaveBeenCalledWith(board, 'right');
  });

  it('填充和描边颜色都应保留并更新各自透明度', () => {
    const rectangle = {
      id: 'rect-color',
      type: 'geometry',
      shape: 'rectangle',
      fill: '#11223380',
      strokeColor: '#44556680',
    } as any;
    const board = { children: [rectangle] } as any;
    mockGetSelectedElements.mockReturnValue([rectangle]);

    setFillColor(board, '#AABBCC');
    setStrokeColor(board, '#DDEEFF');
    expect(rectangle.fill).toBe('#AABBCC@50');
    expect(rectangle.strokeColor).toBe('#DDEEFF@50');

    setFillColorOpacity(board, 72);
    setStrokeColorOpacity(board, 35);
    expect(rectangle.fill).toBe('#AABBCC@72');
    expect(rectangle.strokeColor).toBe('#DDEEFF@35');
  });

  it('扩展文本属性应同步写入 native text 和 text-fragment', () => {
    const nativeText = {
      id: 'native-text',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [{ text: 'Alpha', fontWeight: '400' }],
      },
      textStyle: {},
      textProperties: {},
    } as any;
    const fragmentText = {
      id: 'fragment-text',
      type: 'image',
      url: 'data:image/svg+xml;charset=utf-8,old',
      sceneImportMetadata: {
        kind: 'text-fragment',
        source: 'svg-import',
        sourceElementId: 'fragment-text',
        sourceText: 'Beta',
        text: 'Beta',
        textRole: 'plain',
        classList: [],
        hasEmoji: false,
        hasDecorativeSymbol: false,
        hasTspan: false,
        hasTransform: false,
        fontFamilies: [],
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 14,
        },
        layout: {
          width: 80,
          height: 30,
        },
      },
    } as any;
    const board = { children: [nativeText, fragmentText] } as any;

    mockGetSelectedElements.mockReturnValue([nativeText, fragmentText]);

    setTextFontWeight(board, '700');
    setTextLineHeight(board, 1.8);
    setTextLetterSpacing(board, 3);
    setTextScript(board, 'superscript');

    expect(nativeText.textStyle.fontWeight).toBe('700');
    expect(nativeText.textProperties['line-height']).toBe('1.8');
    expect(nativeText.text.children[0]['letter-spacing']).toBe('3');
    expect(nativeText.text.children[0].baselineShift).toBe('super');
    expect(fragmentText.sceneImportMetadata.style.fontWeight).toBe('700');
    expect(fragmentText.sceneImportMetadata.style.lineHeight).toBe(1.8);
    expect(fragmentText.sceneImportMetadata.style.letterSpacing).toBe(3);
    expect(fragmentText.sceneImportMetadata.style.baselineShift).toBe('super');
    expect(decodeURIComponent(fragmentText.url)).toContain('baseline-shift');
  });

  it('大小写转换和尺寸位置变更应只影响用户主动选中的元素', () => {
    const text = {
      id: 'text-case',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [{ text: 'hello world' }],
      },
      points: [
        [10, 20],
        [110, 70],
      ],
    } as any;
    const rectangle = {
      id: 'rect-case',
      type: 'geometry',
      shape: 'rectangle',
      strokeWidth: 1,
      points: [
        [0, 0],
        [100, 50],
      ],
    } as any;
    const board = { children: [text, rectangle] } as any;

    mockGetSelectedElements.mockReturnValue([text]);
    applyTextCase(board, 'uppercase');
    setElementPosition(board, { x: 20 });
    setElementSize(board, { width: 200 });

    mockGetSelectedElements.mockReturnValue([rectangle]);
    setStrokeWidth(board, 6);
    setElementShadow(board, true);
    setElementShadowProperty(board, 'color', '#111827');
    setElementShadowProperty(board, 'offsetX', -4);
    setElementShadowProperty(board, 'offsetY', 10);
    setElementShadowProperty(board, 'blur', 22);
    setElementGradient(board, true);
    setElementGradientType(board, 'radial');
    setElementGradientColor(board, 'from', '#F8FAFC');
    setElementGradientColor(board, 'to', '#2563EB');
    setElementGradientAngle(board, 135);
    expect(rectangle.gradient).toMatchObject({
      type: 'radial',
      from: '#F8FAFC',
      to: '#2563EB',
      angle: 135,
    });

    setElementGradientPreset(board, {
      type: 'linear',
      from: '#E0F2FE',
      to: '#7C3AED',
      angle: 721,
    });
    expect(rectangle.gradient).toEqual({
      type: 'linear',
      from: '#E0F2FE',
      to: '#7C3AED',
      angle: 1,
    });

    setElementImageFill(board, {
      dataUrl: 'data:image/png;base64,AAA=',
      name: 'texture',
      mimeType: 'image/png',
    });

    expect(text.text.children[0].text).toBe('HELLO WORLD');
    expect(text.points[0]).toEqual([20, 20]);
    expect(text.points[1]).toEqual([220, 70]);
    expect(rectangle.strokeWidth).toBe(6);
    expect(rectangle.shadow).toMatchObject({
      color: '#111827',
      offsetX: -4,
      offsetY: 10,
      blur: 22,
    });
    expect(rectangle.gradient).toBeNull();
    expect(rectangle.imageFill).toMatchObject({
      dataUrl: 'data:image/png;base64,AAA=',
      name: 'texture',
      mimeType: 'image/png',
    });
    expect(rectangle.points[1]).toEqual([100, 50]);
  });

  it('锁定比例缩放时应按单轴尺寸同步另一轴', () => {
    const rectangle = {
      id: 'rect-ratio',
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [0, 0],
        [100, 50],
      ],
    } as any;
    const board = { children: [rectangle] } as any;
    mockGetSelectedElements.mockReturnValue([rectangle]);

    setElementSize(board, { width: 200 }, { lockAspectRatio: true });

    expect(rectangle.points[1]).toEqual([200, 100]);
  });

  it('1000 元素级选区可以完成基础位置与尺寸编辑 smoke', () => {
    const elements = Array.from({ length: 1000 }, (_, index) => ({
      id: `rect-${index}`,
      type: 'geometry',
      shape: 'rectangle',
      points: [
        [index, index],
        [index + 100, index + 50],
      ],
    })) as any[];
    const board = { children: elements } as any;
    mockGetSelectedElements.mockReturnValue(elements);

    setElementPosition(board, { x: 20 });
    setElementSize(board, { width: 160 }, { lockAspectRatio: true });

    expect(elements).toHaveLength(1000);
    expect(elements[0].points).toEqual([
      [20, 0],
      [180, 80],
    ]);
    expect(elements[999].points).toEqual([
      [20, 999],
      [180, 1079],
    ]);
  });
});
