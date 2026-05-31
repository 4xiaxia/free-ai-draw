import type { PlaitElement, Point } from '@plait/core';
import {
  ArrowLineMarkerType,
  ArrowLineShape,
  BasicShapes,
  createArrowLineElement,
  createGeometryElementWithText,
} from '@plait/draw';
import { unzipSync } from 'fflate';
import type { SvgImportSummary } from '../svg-import/convert-svg-to-drawnix';
import {
  normalizeFontFamilyStack,
  resolveFontFamilyForRole,
} from '../constants/font';
import {
  buildSceneTextFragmentDataUrl,
  type SceneTextFragmentMetadata,
} from './text-fragment';

export type SceneElementKind =
  | 'text'
  | 'shape'
  | 'image'
  | 'connector'
  | 'group'
  | 'fragment'
  | 'frame';

export interface SceneAsset {
  id: string;
  kind: 'image' | 'font';
  path: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface SceneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneTextElement {
  id: string;
  kind: 'text';
  text: string;
  sourceText?: string;
  layout: SceneBounds & {
    anchor: 'start' | 'middle' | 'end';
    baseline: string;
    rotation: number;
    wrapMode: string;
  };
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight?: string | number;
    fontStyle?: string;
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    lineHeight?: number;
    letterSpacing?: number;
    opacity?: number;
  };
  editing?: {
    mode: string;
  };
  metadata?: {
    textRole?: string;
    classList?: string[];
    hasEmoji?: boolean;
    hasDecorativeSymbol?: boolean;
    hasTspan?: boolean;
    hasTransform?: boolean;
    fontFamilies?: string[];
    textLength?: number;
    lengthAdjust?: string;
  };
  runs?: Array<{
    text: string;
    style?: Partial<SceneTextElement['style']>;
    layout?: {
      x?: number;
      y?: number;
      dx?: number;
      dy?: number;
    };
  }>;
}

export interface SceneShapeElement {
  id: string;
  kind: 'shape' | 'frame';
  shapeType?:
    | 'rectangle'
    | 'round-rectangle'
    | 'ellipse'
    | 'diamond'
    | 'text'
    | 'triangle'
    | 'parallelogram'
    | 'trapezoid'
    | 'pentagon'
    | 'hexagon'
    | 'octagon'
    | 'left-arrow'
    | 'right-arrow'
    | 'cross'
    | 'pentagon-arrow'
    | 'process-arrow'
    | 'two-way-arrow'
    | 'comment'
    | 'round-comment'
    | 'star'
    | 'cloud';
  bounds: SceneBounds;
  cornerRadius?: number;
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
  };
}

export interface SceneImageElement {
  id: string;
  kind: 'image';
  assetRef: string;
  layout: SceneBounds;
}

export interface SceneConnectorElement {
  id: string;
  kind: 'connector';
  routing: {
    shape: 'straight' | 'polyline' | 'elbow';
    points: Point[];
  };
  style: {
    stroke: string;
    strokeWidth: number;
    startMarker?: 'none' | 'arrow';
    endMarker?: 'none' | 'arrow';
  };
}

export type SceneElement =
  | SceneTextElement
  | SceneShapeElement
  | SceneImageElement
  | SceneConnectorElement
  | {
      id: string;
      kind: Exclude<
        SceneElementKind,
        'text' | 'shape' | 'frame' | 'image' | 'connector'
      >;
    };

export interface SceneDocument {
  type: 'drawnix-scene';
  version: string;
  assets: SceneAsset[];
  elements: SceneElement[];
}

export interface SceneImportResult {
  elements: PlaitElement[];
  summary: SvgImportSummary;
  meta: {
    kind: 'scene';
    sceneVersion: string;
    assetCount: number;
    elementCount: number;
  };
}

const emptySummary = (): SvgImportSummary => ({
  textCount: 0,
  arrowCount: 0,
  rectCount: 0,
  componentCount: 0,
  ignoredBackgroundCount: 0,
  warnings: [],
});

const normalizePath = (value: string) => value.replace(/\\/g, '/');

const getBaseName = (value: string) => {
  const normalized = normalizePath(value);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
};

const inferMimeType = (fileName: string) => {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg'))
    return 'image/jpeg';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
};

const arrayBufferToBase64 = (input: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < input.length; index += chunkSize) {
    binary += String.fromCharCode(...input.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const toDataUrl = (bytes: Uint8Array, fileName: string, mimeType?: string) => {
  const resolvedMimeType = mimeType || inferMimeType(fileName);
  return `data:${resolvedMimeType};base64,${arrayBufferToBase64(bytes)}`;
};

const readFileAsUint8Array = async (file: File) => {
  const fileWithArrayBuffer = file as File & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  if (typeof fileWithArrayBuffer.arrayBuffer === 'function') {
    return new Uint8Array(await fileWithArrayBuffer.arrayBuffer());
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error('无法读取 ZIP 文件'));
        return;
      }
      resolve(new Uint8Array(result));
    };
    reader.onerror = () => {
      reject(reader.error || new Error('无法读取 ZIP 文件'));
    };
    reader.readAsArrayBuffer(file);
  });
};

const decodeUtf8 = async (input: Uint8Array) => {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(input);
  }
  let output = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < input.length; index += chunkSize) {
    output += String.fromCharCode(...input.subarray(index, index + chunkSize));
  }
  return output;
};

const resolveShapeType = (shapeType?: string) => {
  switch (shapeType) {
    case 'round-rectangle':
      return BasicShapes.roundRectangle;
    case 'ellipse':
      return BasicShapes.ellipse;
    case 'diamond':
      return BasicShapes.diamond;
    case 'triangle':
      return BasicShapes.triangle;
    case 'parallelogram':
      return BasicShapes.parallelogram;
    case 'trapezoid':
      return BasicShapes.trapezoid;
    case 'pentagon':
      return BasicShapes.pentagon;
    case 'hexagon':
      return BasicShapes.hexagon;
    case 'octagon':
      return BasicShapes.octagon;
    case 'left-arrow':
      return BasicShapes.leftArrow;
    case 'right-arrow':
      return BasicShapes.rightArrow;
    case 'cross':
      return BasicShapes.cross;
    case 'pentagon-arrow':
      return BasicShapes.pentagonArrow;
    case 'process-arrow':
      return BasicShapes.processArrow;
    case 'two-way-arrow':
      return BasicShapes.twoWayArrow;
    case 'comment':
      return BasicShapes.comment;
    case 'round-comment':
      return BasicShapes.roundComment;
    case 'star':
      return BasicShapes.star;
    case 'cloud':
      return BasicShapes.cloud;
    case 'text':
      return BasicShapes.text;
    case 'rectangle':
    default:
      return BasicShapes.rectangle;
  }
};

const resolveSceneTextFontFamily = (
  element: SceneTextElement,
  options?: { preferSourceFontFamily?: boolean }
) => {
  if (options?.preferSourceFontFamily) {
    const sourceFamilies = (element.metadata?.fontFamilies || []).filter(
      Boolean
    );
    return normalizeFontFamilyStack(
      sourceFamilies.length
        ? sourceFamilies.join(', ')
        : element.style.fontFamily
    );
  }
  return resolveFontFamilyForRole(
    element.metadata?.textRole,
    element.style.fontFamily,
    element.metadata?.fontFamilies
  );
};

const buildTextElement = (
  element: SceneTextElement,
  options?: { preferSourceFontFamily?: boolean }
) => {
  const resolvedFontFamily = resolveSceneTextFontFamily(element, options);
  const align =
    element.layout.anchor === 'middle'
      ? 'center'
      : element.layout.anchor === 'end'
      ? 'right'
      : 'left';
  // Preserve scene-provided fontSize for fidelity; avoid hard minimums that distort imports.
  const fontSize =
    typeof element.style.fontSize === 'number' && element.style.fontSize > 0
      ? element.style.fontSize
      : 16;
  const isItalic =
    String(element.style.fontStyle || '').toLowerCase() === 'italic';
  const numericWeight =
    typeof element.style.fontWeight === 'number'
      ? element.style.fontWeight
      : Number.parseFloat(String(element.style.fontWeight || ''));
  const isBold =
    String(element.style.fontWeight || '').toLowerCase() === 'bold' ||
    (Number.isFinite(numericWeight) && numericWeight >= 600);
  const next = createGeometryElementWithText(
    BasicShapes.text,
    [
      [element.layout.x, element.layout.y],
      [
        element.layout.x + element.layout.width,
        element.layout.y + element.layout.height,
      ],
    ],
    element.text,
    {
      autoSize: false,
      fill: 'transparent',
      strokeColor: 'transparent',
      textStyle: {
        align,
        fontSize,
        'font-size': String(fontSize),
        color: element.style.fill,
        fontFamily: resolvedFontFamily,
        'font-family': resolvedFontFamily,
        fontWeight: element.style.fontWeight,
        fontStyle: element.style.fontStyle,
        lineHeight:
          typeof element.style.lineHeight === 'number'
            ? element.style.lineHeight
            : undefined,
        'line-height':
          typeof element.style.lineHeight === 'number'
            ? String(element.style.lineHeight)
            : undefined,
        letterSpacing:
          typeof element.style.letterSpacing === 'number'
            ? element.style.letterSpacing
            : undefined,
        'letter-spacing':
          typeof element.style.letterSpacing === 'number'
            ? String(element.style.letterSpacing)
            : undefined,
        opacity:
          typeof element.style.opacity === 'number'
            ? element.style.opacity
            : undefined,
      },
    } as any,
    {
      align,
      color: element.style.fill,
      bold: isBold || undefined,
      italic: isItalic || undefined,
      'font-size': String(fontSize),
      fontFamily: resolvedFontFamily,
      'font-family': resolvedFontFamily,
      fontWeight: element.style.fontWeight,
      fontStyle: element.style.fontStyle,
      'line-height':
        typeof element.style.lineHeight === 'number'
          ? String(element.style.lineHeight)
          : undefined,
      'letter-spacing':
        typeof element.style.letterSpacing === 'number'
          ? String(element.style.letterSpacing)
          : undefined,
      opacity:
        typeof element.style.opacity === 'number'
          ? String(element.style.opacity)
          : undefined,
    } as any
  ) as PlaitElement & { id: string };
  next.id = element.id;
  if (element.layout.rotation) {
    (next as any).angle = element.layout.rotation;
  }
  return next;
};

const buildTextFragmentMetadata = (
  element: SceneTextElement,
  options?: { preferSourceFontFamily?: boolean }
): SceneTextFragmentMetadata => ({
  kind: 'text-fragment',
  source: 'scene-import',
  sceneElementId: element.id,
  sourceText: element.sourceText || element.text,
  text: element.text,
  textRole: element.metadata?.textRole || 'plain',
  classList: element.metadata?.classList || [],
  hasEmoji: Boolean(element.metadata?.hasEmoji),
  hasDecorativeSymbol: Boolean(element.metadata?.hasDecorativeSymbol),
  hasTspan: Boolean(element.metadata?.hasTspan),
  hasTransform: Boolean(element.metadata?.hasTransform),
  fontFamilies: element.metadata?.fontFamilies || [],
  style: {
    fontFamily: resolveSceneTextFontFamily(element, options),
    fontSize: element.style.fontSize,
    fontWeight: element.style.fontWeight,
    fontStyle: element.style.fontStyle,
    fill: element.style.fill,
    stroke: element.style.stroke,
    strokeWidth: element.style.strokeWidth,
    lineHeight: element.style.lineHeight,
    letterSpacing: element.style.letterSpacing,
    opacity: element.style.opacity,
  },
  layout: {
    anchor: element.layout.anchor,
    baseline: element.layout.baseline,
    rotation: element.layout.rotation,
    width: element.layout.width,
    height: element.layout.height,
  },
  textLength: element.metadata?.textLength,
  lengthAdjust: element.metadata?.lengthAdjust,
  runs: element.runs || [],
});

const buildTextFragmentElement = (
  element: SceneTextElement,
  options?: { preferSourceFontFamily?: boolean }
) => {
  const fragmentMetadata = buildTextFragmentMetadata(element, options);
  return {
    id: element.id,
    type: 'image',
    url: buildSceneTextFragmentDataUrl(fragmentMetadata),
    points: [
      [element.layout.x, element.layout.y],
      [
        element.layout.x + element.layout.width,
        element.layout.y + element.layout.height,
      ],
    ],
    sceneImportMetadata: fragmentMetadata,
  } as unknown as PlaitElement;
};

const getSceneElementLayerPriority = (element: SceneElement) => {
  const metadata = (element as any).metadata || {};
  const semanticRole = metadata.semanticRole;
  if (element.kind === 'shape' || element.kind === 'frame') {
    if (semanticRole === 'background') {
      return 0;
    }
    if (semanticRole === 'frame' || semanticRole === 'container') {
      return 1;
    }
    return 2;
  }
  if (element.kind === 'connector') {
    return 3;
  }
  if (element.kind === 'text') {
    return 4;
  }
  if (element.kind === 'image') {
    return 5;
  }
  return 6;
};

const sortSceneElementsForRender = (elements: SceneElement[]) => {
  return [...elements].sort((left, right) => {
    const leftPriority = getSceneElementLayerPriority(left);
    const rightPriority = getSceneElementLayerPriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    const leftZIndex = (left as any).zIndex ?? 0;
    const rightZIndex = (right as any).zIndex ?? 0;
    return leftZIndex - rightZIndex;
  });
};

const buildShapeElement = (element: SceneShapeElement) => {
  const next = createGeometryElementWithText(
    resolveShapeType(element.shapeType),
    [
      [element.bounds.x, element.bounds.y],
      [
        element.bounds.x + element.bounds.width,
        element.bounds.y + element.bounds.height,
      ],
    ],
    '',
    {
      fill: element.style.fill,
      strokeColor: element.style.stroke,
      strokeWidth: element.style.strokeWidth,
    } as any
  ) as PlaitElement & { id: string };
  next.id = element.id;
  if (element.cornerRadius) {
    (next as any).radius = element.cornerRadius;
  }
  return next;
};

const buildImageElement = (element: SceneImageElement, assetUrl: string) => {
  return {
    id: element.id,
    type: 'image',
    url: assetUrl,
    points: [
      [element.layout.x, element.layout.y],
      [
        element.layout.x + element.layout.width,
        element.layout.y + element.layout.height,
      ],
    ],
  } as unknown as PlaitElement;
};

const buildConnectorElement = (element: SceneConnectorElement) => {
  const points = element.routing.points;
  const next = createArrowLineElement(
    element.routing.shape === 'elbow'
      ? ArrowLineShape.elbow
      : ArrowLineShape.straight,
    [points[0]!, points[points.length - 1]!] as [Point, Point],
    {
      marker:
        element.style.startMarker === 'arrow'
          ? ArrowLineMarkerType.arrow
          : ArrowLineMarkerType.none,
    } as any,
    {
      marker:
        element.style.endMarker === 'arrow'
          ? ArrowLineMarkerType.arrow
          : ArrowLineMarkerType.none,
    } as any,
    undefined,
    {
      strokeColor: element.style.stroke,
      strokeWidth: element.style.strokeWidth,
    }
  ) as PlaitElement & { id: string; points?: Point[] };
  next.id = element.id;
  if (points.length > 2) {
    next.points = points;
  }
  return next;
};

export const compileSceneToDrawnix = (
  scene: SceneDocument,
  assetUrlMap: Map<string, string> = new Map(),
  options?: { preserveSourceOrder?: boolean; preferSourceFontFamily?: boolean }
) => {
  const summary = emptySummary();
  const elements: PlaitElement[] = [];
  const warnings: string[] = [];
  const sourceElements = options?.preserveSourceOrder
    ? scene.elements
    : sortSceneElementsForRender(scene.elements);

  for (const element of sourceElements) {
    switch (element.kind) {
      case 'text':
        if (element.editing?.mode === 'svg-fragment-text') {
          elements.push(buildTextFragmentElement(element, options));
          summary.componentCount += 1;
        } else {
          elements.push(buildTextElement(element, options));
        }
        summary.textCount += 1;
        break;
      case 'shape':
      case 'frame':
        elements.push(buildShapeElement(element));
        summary.rectCount += 1;
        break;
      case 'image': {
        const url = assetUrlMap.get(element.assetRef);
        if (!url) {
          warnings.push(`缺少图片资源: ${element.assetRef}`);
          break;
        }
        elements.push(buildImageElement(element, url));
        summary.componentCount += 1;
        break;
      }
      case 'connector':
        elements.push(buildConnectorElement(element));
        summary.arrowCount += 1;
        break;
      default:
        warnings.push(`暂未导入元素类型: ${element.kind}`);
        break;
    }
  }

  summary.warnings = warnings;
  return { elements, summary };
};

export const importScenePackage = async (
  file: File
): Promise<SceneImportResult> => {
  const archive = unzipSync(await readFileAsUint8Array(file));
  const entryNames = Object.keys(archive).map((entry) => normalizePath(entry));
  const sceneEntry = entryNames.find(
    (entry) => getBaseName(entry) === 'scene.json'
  );

  if (!sceneEntry) {
    throw new Error('ZIP 中未找到 scene.json');
  }

  const sceneBytes = archive[sceneEntry];
  if (!sceneBytes) {
    throw new Error('无法读取 scene.json');
  }

  const scene = JSON.parse(await decodeUtf8(sceneBytes)) as SceneDocument;
  if (scene.type !== 'drawnix-scene' || !Array.isArray(scene.elements)) {
    throw new Error('scene.json 格式无效');
  }

  const assetUrlMap = new Map<string, string>();
  for (const asset of scene.assets || []) {
    if (asset.kind !== 'image') {
      continue;
    }
    const normalizedPath = normalizePath(asset.path);
    const assetBytes = archive[normalizedPath];
    if (!assetBytes) {
      continue;
    }
    assetUrlMap.set(
      asset.id,
      toDataUrl(assetBytes, normalizedPath, asset.mimeType)
    );
  }

  const { elements, summary } = compileSceneToDrawnix(scene, assetUrlMap);
  return {
    elements,
    summary,
    meta: {
      kind: 'scene',
      sceneVersion: scene.version,
      assetCount: (scene.assets || []).length,
      elementCount: (scene.elements || []).length,
    },
  };
};
