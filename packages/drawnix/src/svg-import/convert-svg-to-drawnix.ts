import type { PlaitElement, Point } from '@plait/core';
import {
  ArrowLineMarkerType,
  ArrowLineShape,
  BasicShapes,
  createArrowLineElement,
  createGeometryElementWithText,
  createVectorLineElement,
  VectorLineShape,
} from '@plait/draw';
import type { SvgAssetPackage } from './parse-svg-package';
import {
  normalizeFontFamilyStack,
  resolveFontFamilyForRole,
  splitFontFamilyCandidates,
} from '../constants/font';
import {
  buildSvgTextFragmentDataUrl,
  type SvgTextFragmentMetadata,
} from '../scene-import/text-fragment';

type CssStyleMap = Record<string, string>;

export interface SvgImportedTextMetadata {
  source: 'svg-import';
  importMode: 'native' | 'fragment';
  sourceFontFamily?: string;
  sourceFontSize: number;
  sourceAnchor?: 'start' | 'middle' | 'end';
  sourceBaseline?: string;
  sourceRotation: number;
  textRole: string;
  isPlaceholder: boolean;
}

type SvgImportedElement = PlaitElement & {
  id: string;
  svgImportMetadata?: SvgImportedTextMetadata;
};

interface SvgImportTextItem {
  id: string;
  sourceOrder: number;
  sourceSubOrder?: number;
  text: string;
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
  sourceLeft: number;
  sourceTop: number;
  sourceWidth: number;
  sourceHeight: number;
  fontSize: number;
  lineHeight?: number;
  fontFamily?: string;
  resolvedFontFamily?: string;
  hasExplicitFontFamily?: boolean;
  textAnchor: 'start' | 'middle' | 'end';
  dominantBaseline?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  letterSpacing?: number;
  opacity?: number;
  rotation: number;
  textRole: string;
  hasEmoji: boolean;
  hasDecorativeSymbol: boolean;
  hasTspan: boolean;
  hasTransform: boolean;
  hasComplexTransform: boolean;
  textLength?: number;
  lengthAdjust?: string;
  classList: string[];
  fontFamilies: string[];
  importMode: 'native' | 'fragment';
  node: SVGTextElement;
}

interface SvgImportArrowItem {
  id: string;
  sourceOrder: number;
  sourceSubOrder?: number;
  points: Point[];
  strokeColor?: string;
  strokeWidth?: number;
  sourceMarker?: string;
  targetMarker?: string;
}

interface SvgImportEllipseItem {
  id: string;
  sourceOrder: number;
  sourceSubOrder?: number;
  points: Point[];
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

interface SvgImportVectorLineItem {
  id: string;
  sourceOrder: number;
  sourceSubOrder?: number;
  points: Point[];
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

interface SvgImportImageItem {
  id: string;
  sourceOrder: number;
  sourceSubOrder?: number;
  url: string;
  points: Point[];
}

interface SvgImportRectItem {
  id: string;
  sourceOrder: number;
  sourceSubOrder?: number;
  points: Point[];
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
}

export interface SvgImportSummary {
  textCount: number;
  arrowCount: number;
  rectCount: number;
  componentCount: number;
  ignoredBackgroundCount: number;
  warnings: string[];
}

export interface SvgImportResult {
  elements: PlaitElement[];
  summary: SvgImportSummary;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_STROKE = '#231F20';
const DEFAULT_STROKE_WIDTH = 2;

interface SvgMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY_MATRIX: SvgMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
};

const multiplyMatrices = (left: SvgMatrix, right: SvgMatrix): SvgMatrix => {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
};

const applyMatrixToPoint = (point: Point, matrix: SvgMatrix): Point => {
  const [x, y] = point;
  return [
    matrix.a * x + matrix.c * y + matrix.e,
    matrix.b * x + matrix.d * y + matrix.f,
  ];
};

const matrixToTransform = (matrix: SvgMatrix) =>
  `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;

const buildTranslateMatrix = (tx = 0, ty = 0): SvgMatrix => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: tx,
  f: ty,
});

const buildScaleMatrix = (sx = 1, sy = sx): SvgMatrix => ({
  a: sx,
  b: 0,
  c: 0,
  d: sy,
  e: 0,
  f: 0,
});

const buildRotateMatrix = (angleDeg = 0, cx = 0, cy = 0): SvgMatrix => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rotation: SvgMatrix = {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: 0,
    f: 0,
  };
  if (!cx && !cy) {
    return rotation;
  }
  return multiplyMatrices(
    buildTranslateMatrix(cx, cy),
    multiplyMatrices(rotation, buildTranslateMatrix(-cx, -cy))
  );
};

const buildSkewXMatrix = (angleDeg = 0): SvgMatrix => ({
  a: 1,
  b: 0,
  c: Math.tan((angleDeg * Math.PI) / 180),
  d: 1,
  e: 0,
  f: 0,
});

const buildSkewYMatrix = (angleDeg = 0): SvgMatrix => ({
  a: 1,
  b: Math.tan((angleDeg * Math.PI) / 180),
  c: 0,
  d: 1,
  e: 0,
  f: 0,
});

const parseTransformAttribute = (value: string | null | undefined): SvgMatrix => {
  if (!value) {
    return IDENTITY_MATRIX;
  }

  const matches = value.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g);
  let result = IDENTITY_MATRIX;

  for (const match of matches) {
    const name = (match[1] || '').trim();
    const numbers = (match[2] || '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((item) => Number.parseFloat(item))
      .filter((item) => Number.isFinite(item));
    let next = IDENTITY_MATRIX;

    switch (name) {
      case 'matrix':
        if (numbers.length === 6) {
          next = {
            a: numbers[0]!,
            b: numbers[1]!,
            c: numbers[2]!,
            d: numbers[3]!,
            e: numbers[4]!,
            f: numbers[5]!,
          };
        }
        break;
      case 'translate':
        next = buildTranslateMatrix(numbers[0] || 0, numbers[1] || 0);
        break;
      case 'scale':
        next = buildScaleMatrix(numbers[0] ?? 1, numbers[1] ?? numbers[0] ?? 1);
        break;
      case 'rotate':
        next = buildRotateMatrix(numbers[0] || 0, numbers[1] || 0, numbers[2] || 0);
        break;
      case 'skewX':
        next = buildSkewXMatrix(numbers[0] || 0);
        break;
      case 'skewY':
        next = buildSkewYMatrix(numbers[0] || 0);
        break;
      default:
        next = IDENTITY_MATRIX;
        break;
    }

    result = multiplyMatrices(next, result);
  }

  return result;
};

const getAccumulatedTransform = (node: Element, root: SVGSVGElement): SvgMatrix => {
  const chain: Element[] = [];
  let current: Element | null = node;
  while (current) {
    chain.unshift(current);
    if (current === root) {
      break;
    }
    current = current.parentElement;
  }

  return chain.reduce((matrix, element) => {
    return multiplyMatrices(matrix, parseTransformAttribute(element.getAttribute('transform')));
  }, IDENTITY_MATRIX);
};

const transformBounds = (
  bounds: { x: number; y: number; width: number; height: number },
  matrix: SvgMatrix
) => {
  const corners = [
    applyMatrixToPoint([bounds.x, bounds.y], matrix),
    applyMatrixToPoint([bounds.x + bounds.width, bounds.y], matrix),
    applyMatrixToPoint([bounds.x, bounds.y + bounds.height], matrix),
    applyMatrixToPoint([bounds.x + bounds.width, bounds.y + bounds.height], matrix),
  ];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
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
};

const parseNumber = (value: string | null | undefined, fallback = 0) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeColor = (value: string | null | undefined) => {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized || normalized === 'none') {
    return undefined;
  }
  return normalized;
};

const parseInlineStyle = (value: string | null | undefined): CssStyleMap => {
  if (!value) {
    return {};
  }

  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<CssStyleMap>((styles, item) => {
      const [key, rawValue] = item.split(':');
      if (!key || !rawValue) {
        return styles;
      }
      styles[key.trim()] = rawValue.trim();
      return styles;
    }, {});
};

const parseClassStyles = (root: SVGSVGElement) => {
  const styles: Record<string, CssStyleMap> = {};
  const styleNodes = Array.from(root.querySelectorAll('style'));

  for (const styleNode of styleNodes) {
    const content = styleNode.textContent || '';
    const matches = content.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g);

    for (const match of matches) {
      const className = match[1]?.trim();
      const declarations = match[2]?.trim();
      if (!className || !declarations) {
        continue;
      }
      styles[className] = {
        ...(styles[className] || {}),
        ...parseInlineStyle(declarations),
      };
    }
  }

  return styles;
};

const resolveStyle = (
  element: Element,
  classStyles: Record<string, CssStyleMap>
): CssStyleMap => {
  const resolved: CssStyleMap = {};
  const classNames = (element.getAttribute('class') || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const className of classNames) {
    Object.assign(resolved, classStyles[className] || {});
  }

  Object.assign(resolved, parseInlineStyle(element.getAttribute('style')));

  for (const attr of [
    'fill',
    'stroke',
    'stroke-width',
    'font-size',
    'font-family',
    'font-weight',
    'font-style',
    'letter-spacing',
    'text-anchor',
    'dominant-baseline',
    'opacity',
    'textLength',
    'lengthAdjust',
  ]) {
    const value = element.getAttribute(attr);
    if (value) {
      resolved[attr] = value;
    }
  }

  return resolved;
};

const roundMetric = (value: number) => Math.round(value * 100) / 100;

const buildNodeOrderMap = (root: SVGSVGElement) => {
  return new Map(
    Array.from(root.querySelectorAll('*')).map((node, index) => [node, index] as const)
  );
};

const getNodeOrder = (node: Element, nodeOrderMap: Map<Element, number>) => {
  return nodeOrderMap.get(node) ?? Number.MAX_SAFE_INTEGER;
};

const normalizePlaceholderLabel = (value: string) =>
  value.replace(/[^a-z0-9]/gi, '').toUpperCase();

const GENERIC_FONT_FAMILY_TOKENS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'emoji',
  'math',
  'fangsong',
]);

const hasSpecificFontFamily = (fontFamilies: string[]) => {
  return fontFamilies.some((family) => {
    const normalized = family.replace(/^['"]|['"]$/g, '').trim().toLowerCase();
    return normalized.length > 0 && !GENERIC_FONT_FAMILY_TOKENS.has(normalized);
  });
};

const resolveSvgImportFontFamily = (
  role: string | undefined,
  explicitFontFamily?: string,
  availableSourceFamilies?: string[]
) => {
  const sourceFamilies = (availableSourceFamilies || []).filter(Boolean);
  if (hasSpecificFontFamily(sourceFamilies)) {
    return normalizeFontFamilyStack(sourceFamilies.join(', '));
  }
  return resolveFontFamilyForRole(role, explicitFontFamily, availableSourceFamilies);
};

const estimateDrawnixTextBounds = (
  text: string,
  fontSize: number,
  letterSpacing = 0,
  lineHeight?: number
) => {
  const safeText = text || ' ';
  const spacingWidth = Math.max(safeText.length - 1, 0) * letterSpacing;
  return {
    width: Math.max(safeText.length * fontSize * 0.52 + spacingWidth, fontSize * 0.75),
    height: Math.max(lineHeight || fontSize * 1.2, 1),
  };
};

const measureDrawnixTextBoundsByDom = (
  text: string,
  options: {
    fontSize: number;
    fontFamily?: string;
    fontWeight?: string | number;
    fontStyle?: string;
    letterSpacing?: number;
    lineHeight?: number;
  }
) => {
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  const mount = document.createElement('div');
  mount.setAttribute(
    'style',
    [
      'position:fixed',
      'left:-10000px',
      'top:-10000px',
      'visibility:hidden',
      'pointer-events:none',
      'white-space:pre',
      'display:inline-block',
      'padding:0',
      'margin:0',
      'line-height:1',
    ].join(';')
  );

  const span = document.createElement('span');
  span.textContent = text || ' ';
  span.style.whiteSpace = 'pre';
  span.style.display = 'inline-block';
  span.style.fontSize = `${options.fontSize}px`;
  span.style.fontFamily = normalizeFontFamilyStack(options.fontFamily);
  span.style.fontWeight = options.fontWeight ? String(options.fontWeight) : '400';
  span.style.fontStyle = options.fontStyle || 'normal';
  if (typeof options.lineHeight === 'number' && Number.isFinite(options.lineHeight)) {
    span.style.lineHeight = `${options.lineHeight}px`;
  }
  if (typeof options.letterSpacing === 'number' && Number.isFinite(options.letterSpacing)) {
    span.style.letterSpacing = `${options.letterSpacing}px`;
  }
  mount.appendChild(span);
  document.body.appendChild(mount);

  try {
    const rect = span.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    return null;
  } finally {
    mount.remove();
  }
};

const computeTextBoundsFromMeasuredSize = (
  anchorPoint: Point,
  measured: { width: number; height: number },
  options: {
    fontSize: number;
    textAnchor: 'start' | 'middle' | 'end';
    dominantBaseline?: string;
  }
) => {
  let left = anchorPoint[0];
  if (options.textAnchor === 'middle') {
    left -= measured.width / 2;
  } else if (options.textAnchor === 'end') {
    left -= measured.width;
  }
  let top = anchorPoint[1] - measured.height;
  switch (options.dominantBaseline) {
    case 'middle':
    case 'central':
      top = anchorPoint[1] - measured.height / 2;
      break;
    case 'hanging':
    case 'text-top':
      top = anchorPoint[1];
      break;
    case 'text-bottom':
    case 'text-after-edge':
      top = anchorPoint[1] - measured.height;
      break;
    default:
      top = anchorPoint[1] - Math.max(options.fontSize, measured.height * 0.85);
      break;
  }
  return {
    x: left,
    y: top,
    width: measured.width,
    height: measured.height,
  };
};

const withNativeTextPadding = (
  measured: { width: number; height: number },
  options: { fontSize: number; textLength: number }
) => {
  const horizontalPadding = roundMetric(
    Math.max(6, options.fontSize * 0.24, Math.min(18, options.textLength * 0.6))
  );
  const verticalPadding = roundMetric(Math.max(2, options.fontSize * 0.12));
  return {
    width: measured.width + horizontalPadding * 2,
    height: measured.height + verticalPadding * 2,
  };
};

const expandBoundsToContain = (
  base: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number }
) => {
  const minX = Math.min(base.x, target.x);
  const minY = Math.min(base.y, target.y);
  const maxX = Math.max(base.x + base.width, target.x + target.width);
  const maxY = Math.max(base.y + base.height, target.y + target.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const getElementChain = (element: Element, stopAt?: Element | null) => {
  const chain: Element[] = [];
  let current: Element | null = element;
  while (current) {
    chain.unshift(current);
    if (stopAt && current === stopAt) {
      break;
    }
    current = current.parentElement;
  }
  return chain;
};

const resolveInheritedTextStyle = (
  element: Element,
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>
) => {
  return getElementChain(element, root).reduce<CssStyleMap>((resolved, current) => {
    return {
      ...resolved,
      ...resolveStyle(current, classStyles),
    };
  }, {});
};

const resolveInheritedStyle = (
  element: Element,
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>
) => {
  return getElementChain(element, root).reduce<CssStyleMap>((resolved, current) => {
    return {
      ...resolved,
      ...resolveStyle(current, classStyles),
    };
  }, {});
};

const isApproximately = (left: number, right: number, tolerance = 0.01) =>
  Math.abs(left - right) <= tolerance;

const normalizeRotation = (value: number) => {
  let next = roundMetric(value);
  while (next <= -180) {
    next += 360;
  }
  while (next > 180) {
    next -= 360;
  }
  return next;
};

const resolveTextRotation = (matrix: SvgMatrix) => {
  const scaleX = Math.hypot(matrix.a, matrix.b);
  const scaleY = Math.hypot(matrix.c, matrix.d);
  const orthogonal = isApproximately(matrix.a * matrix.c + matrix.b * matrix.d, 0, 0.02);
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const rotation = normalizeRotation((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
  const canUseNative =
    orthogonal &&
    isApproximately(scaleX, 1, 0.02) &&
    isApproximately(scaleY, 1, 0.02) &&
    determinant > 0;
  return {
    rotation,
    hasTransform:
      !isApproximately(matrix.a, 1) ||
      !isApproximately(matrix.b, 0) ||
      !isApproximately(matrix.c, 0) ||
      !isApproximately(matrix.d, 1) ||
      !isApproximately(matrix.e, 0) ||
      !isApproximately(matrix.f, 0),
    hasComplexTransform: !canUseNative,
    canUseNative,
  };
};

const containsEmoji = (value: string) => {
  try {
    return /\p{Extended_Pictographic}/u.test(value);
  } catch {
    return false;
  }
};

const containsDecorativeSymbol = (value: string) =>
  /[◆◇■□▲△●○★☆→←↑↓◀▶]/.test(value);

const resolveTextRole = (
  text: string,
  options: {
    fontSize: number;
    fontWeight?: string | number;
    hasEmoji?: boolean;
    hasDecorativeSymbol?: boolean;
  }
) => {
  if (options.hasEmoji) {
    return 'emoji';
  }
  if (options.hasDecorativeSymbol) {
    return 'decorative-symbol';
  }
  if (/^\(.*\)$/.test(text.trim())) {
    return 'annotation';
  }
  const numericWeight =
    typeof options.fontWeight === 'number'
      ? options.fontWeight
      : Number.parseFloat(String(options.fontWeight || ''));
  if (options.fontSize >= 16 || (Number.isFinite(numericWeight) && numericWeight >= 600)) {
    return 'title';
  }
  return 'body';
};

const isVisibleStroke = (stroke?: string, strokeWidth?: number) => {
  return Boolean(
    stroke &&
      stroke !== 'none' &&
      stroke !== 'transparent' &&
      (typeof strokeWidth !== 'number' || strokeWidth > 0)
  );
};

const computeNativeTextFit = (
  nativeBounds: { x: number; y: number; width: number; height: number },
  sourceBounds: { x: number; y: number; width: number; height: number },
  rotation = 0
) => {
  const nativeRect = rotation
    ? transformBounds(nativeBounds, buildRotateMatrix(rotation, nativeBounds.x + nativeBounds.width / 2, nativeBounds.y + nativeBounds.height / 2))
    : nativeBounds;
  const actualBounds = {
    width: nativeRect.width,
    height: nativeRect.height,
    centerX: nativeRect.x + nativeRect.width / 2,
    centerY: nativeRect.y + nativeRect.height / 2,
  };
  const expectedBounds = {
    width: sourceBounds.width,
    height: sourceBounds.height,
    centerX: sourceBounds.x + sourceBounds.width / 2,
    centerY: sourceBounds.y + sourceBounds.height / 2,
  };
  return {
    widthError: Math.abs(actualBounds.width - expectedBounds.width),
    heightError: Math.abs(actualBounds.height - expectedBounds.height),
    centerError: Math.hypot(
      actualBounds.centerX - expectedBounds.centerX,
      actualBounds.centerY - expectedBounds.centerY
    ),
  };
};

const fitsNativeTextThreshold = (
  nativeBounds: { x: number; y: number; width: number; height: number },
  sourceBounds: { x: number; y: number; width: number; height: number },
  rotation = 0
) => {
  const fit = computeNativeTextFit(nativeBounds, sourceBounds, rotation);
  return (
    fit.widthError <= Math.max(4, nativeBounds.width * 0.05) &&
    fit.heightError <= Math.max(3, nativeBounds.height * 0.08) &&
    fit.centerError <= 2
  );
};

const getRootViewport = (root: SVGSVGElement) => {
  const viewBox = root.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map((item) => Number.parseFloat(item));
    if (parts.length === 4 && parts.every((item) => Number.isFinite(item))) {
      const [, , width, height] = parts;
      return { width, height };
    }
  }

  return {
    width: parseNumber(root.getAttribute('width'), 800),
    height: parseNumber(root.getAttribute('height'), 600),
  };
};

const isWhiteLike = (value: string | undefined) => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '#fff'
    || normalized === '#ffffff'
    || normalized === 'white'
    || normalized === 'rgb(255,255,255)'
    || normalized === 'rgb(255, 255, 255)';
};

const isBackgroundRect = (
  element: Element,
  rootWidth: number,
  rootHeight: number,
  resolvedStyle: CssStyleMap
) => {
  if (element.tagName.toLowerCase() !== 'rect') {
    return false;
  }

  const widthAttr = element.getAttribute('width') || '';
  const heightAttr = element.getAttribute('height') || '';
  const x = parseNumber(element.getAttribute('x'));
  const y = parseNumber(element.getAttribute('y'));
  const width = widthAttr.includes('%') ? rootWidth : parseNumber(widthAttr);
  const height = heightAttr.includes('%') ? rootHeight : parseNumber(heightAttr);
  const fill = normalizeColor(resolvedStyle['fill'] || element.getAttribute('fill'));

  return width >= rootWidth * 0.95
    && height >= rootHeight * 0.95
    && Math.abs(x) < 20
    && Math.abs(y) < 20
    && isWhiteLike(fill);
};

const tokenizePath = (d: string) => d.match(/[MLHVQZmlhvqz]|-?\d*\.?\d+/g) || [];

const isSimplePath = (d: string) => /^[\s,0-9.\-MLHVQmlhvqzZ]+$/.test(d.trim());

const hasDiagonalArrowHead = (d: string) => /l-?\d+\.?\d*,-?\d+\.?\d*/i.test(d)
  || /m-?\d+\.?\d*,-?\d+\.?\d*/i.test(d);

const buildSvgImportMetadata = (
  item: SvgImportTextItem,
  importMode: SvgImportedTextMetadata['importMode']
): SvgImportedTextMetadata => ({
  source: 'svg-import',
  importMode,
  sourceFontFamily: item.fontFamily,
  sourceFontSize: item.fontSize,
  sourceAnchor: item.textAnchor,
  sourceBaseline: item.dominantBaseline,
  sourceRotation: item.rotation,
  textRole: item.textRole,
  isPlaceholder: false,
});

const buildSvgTextFragmentMetadata = (item: SvgImportTextItem): SvgTextFragmentMetadata => ({
  kind: 'text-fragment',
  source: 'svg-import',
  sourceElementId: item.id,
  sourceText: item.text,
  text: item.text,
  textRole: item.textRole,
  classList: item.classList,
  hasEmoji: item.hasEmoji,
  hasDecorativeSymbol: item.hasDecorativeSymbol,
  hasTspan: item.hasTspan,
  hasTransform: item.hasTransform,
  fontFamilies: item.fontFamilies,
  style: {
    fontFamily: item.resolvedFontFamily,
    fontSize: item.fontSize,
    fontWeight: item.fontWeight,
    fontStyle: item.fontStyle,
    fill: item.fill,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
    lineHeight: item.lineHeight,
    letterSpacing: item.letterSpacing,
    opacity: item.opacity,
  },
  layout: {
    anchor: item.textAnchor,
    baseline: item.dominantBaseline,
    rotation: item.rotation,
    width: item.sourceWidth,
    height: item.sourceHeight,
  },
  textLength: item.textLength,
  lengthAdjust: item.lengthAdjust,
});

const buildTextElement = (item: SvgImportTextItem): SvgImportedElement => {
  if (item.importMode === 'fragment') {
    const fragmentMetadata = buildSvgTextFragmentMetadata(item);
    return {
      id: item.id,
      type: 'image',
      url: buildSvgTextFragmentDataUrl(fragmentMetadata),
      points: [
        [item.sourceLeft, item.sourceTop],
        [item.sourceLeft + item.sourceWidth, item.sourceTop + item.sourceHeight],
      ],
      sceneImportMetadata: fragmentMetadata,
      svgImportMetadata: buildSvgImportMetadata(item, 'fragment'),
    } as unknown as SvgImportedElement;
  }

  const fontFamily =
    item.resolvedFontFamily || resolveSvgImportFontFamily(item.textRole, item.fontFamily, item.fontFamilies);
  const align =
    item.textAnchor === 'middle' ? 'center' : item.textAnchor === 'end' ? 'right' : 'left';
  const lineHeight =
    typeof item.lineHeight === 'number' && Number.isFinite(item.lineHeight)
      ? item.lineHeight
      : undefined;
  const isItalic = String(item.fontStyle || '').toLowerCase() === 'italic';
  const numericWeight =
    typeof item.fontWeight === 'number'
      ? item.fontWeight
      : Number.parseFloat(String(item.fontWeight || ''));
  const isBold =
    String(item.fontWeight || '').toLowerCase() === 'bold'
    || (Number.isFinite(numericWeight) && numericWeight >= 600);

  const element = createGeometryElementWithText(
    BasicShapes.text,
    [
      [item.left, item.top],
      [item.left + item.width, item.top + item.height],
    ],
    item.text,
    {
      autoSize: false,
      fill: 'transparent',
      strokeColor: 'transparent',
      textStyle: {
        align,
        fontSize: item.fontSize,
        'font-size': String(item.fontSize),
        color: item.fill || '#000000',
        fontFamily,
        'font-family': fontFamily,
        fontWeight: item.fontWeight,
        fontStyle: item.fontStyle,
        lineHeight,
        'line-height':
          typeof lineHeight === 'number' ? String(lineHeight) : undefined,
        letterSpacing: item.letterSpacing,
        'letter-spacing':
          typeof item.letterSpacing === 'number' ? String(item.letterSpacing) : undefined,
        opacity: item.opacity,
      },
    } as any,
    {
      align,
      color: item.fill || '#000000',
      bold: isBold || undefined,
      italic: isItalic || undefined,
      'font-size': String(item.fontSize),
      fontFamily,
      'font-family': fontFamily,
      fontWeight: item.fontWeight,
      fontStyle: item.fontStyle,
      'line-height':
        typeof lineHeight === 'number' ? String(lineHeight) : undefined,
      'letter-spacing':
        typeof item.letterSpacing === 'number' ? String(item.letterSpacing) : undefined,
      opacity: item.opacity,
    } as any
  ) as SvgImportedElement;

  element.id = item.id;
  if (item.rotation) {
    (element as any).angle = item.rotation;
  }
  element.svgImportMetadata = buildSvgImportMetadata(item, 'native');
  return element;
};

const buildArrowElement = (item: SvgImportArrowItem) => {
  const element = createArrowLineElement(
    ArrowLineShape.straight,
    item.points as [Point, Point],
    { marker: item.sourceMarker || ArrowLineMarkerType.none } as any,
    { marker: item.targetMarker || ArrowLineMarkerType.arrow } as any,
    undefined,
    {
      strokeColor: item.strokeColor || DEFAULT_STROKE,
      strokeWidth: item.strokeWidth || DEFAULT_STROKE_WIDTH,
    }
  ) as PlaitElement & { id: string };

  if (item.points.length > 2) {
    (element as any).points = item.points;
  }

  element.id = item.id;
  return element;
};

const buildEllipseElement = (item: SvgImportEllipseItem) => {
  const element = createGeometryElementWithText(
    BasicShapes.ellipse,
    item.points as [Point, Point],
    '',
    {
      fill: item.fill || 'transparent',
      strokeColor: item.strokeColor || 'transparent',
      strokeWidth: item.strokeWidth || 0,
    } as any
  ) as PlaitElement & { id: string };

  element.id = item.id;
  return element;
};

const buildVectorLineElement = (item: SvgImportVectorLineItem) => {
  const element = createVectorLineElement(VectorLineShape.straight, item.points, {
    fill: item.fill,
    strokeColor: item.strokeColor || DEFAULT_STROKE,
    strokeWidth: item.strokeWidth ?? DEFAULT_STROKE_WIDTH,
  }) as PlaitElement & { id: string };

  element.id = item.id;
  return element;
};

const buildRectElement = (item: SvgImportRectItem) => {
  const shape = (item.rx || 0) > 0 || (item.ry || 0) > 0 
    ? BasicShapes.roundRectangle 
    : BasicShapes.rectangle;

  const element = createGeometryElementWithText(
    shape,
    item.points as [Point, Point],
    '',
    {
      fill: item.fill || 'transparent',
      strokeColor: item.strokeColor || 'transparent',
      strokeWidth: item.strokeWidth || 0,
    } as any
  ) as PlaitElement & { id: string };

  if (item.rx || item.ry) {
    // If it's a rounded rectangle, try to set the corner radius if supported
    // The exact property depends on Plait geometry implementation, usually 'radius' or 'cornerRadius'
    // This provides a fallback.
    (element as any).radius = Math.max(item.rx || 0, item.ry || 0);
  }

  element.id = item.id;
  return element;
};

const buildImageElement = (item: SvgImportImageItem) => {
  return {
    id: item.id,
    type: 'image',
    url: item.url,
    points: item.points,
  } as unknown as PlaitElement;
};

const serializeSvgNodes = (
  root: SVGSVGElement,
  nodes: Element[],
  width: number,
  height: number,
  viewBox = { x: 0, y: 0, width, height }
) => {
  const nextRoot = document.createElementNS(SVG_NS, 'svg');
  nextRoot.setAttribute('xmlns', SVG_NS);
  nextRoot.setAttribute('width', `${width}`);
  nextRoot.setAttribute('height', `${height}`);
  nextRoot.setAttribute(
    'viewBox',
    `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
  );

  const defsNodes = Array.from(root.querySelectorAll('defs'));
  for (const defs of defsNodes) {
    nextRoot.appendChild(defs.cloneNode(true));
  }

  const styleNodes = Array.from(root.querySelectorAll('style'));
  for (const styleNode of styleNodes) {
    nextRoot.appendChild(styleNode.cloneNode(true));
  }

  for (const node of nodes) {
    const clonedNode = node.cloneNode(true) as Element;
    clonedNode.setAttribute('transform', matrixToTransform(getAccumulatedTransform(node, root)));
    nextRoot.appendChild(clonedNode);
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    new XMLSerializer().serializeToString(nextRoot)
  )}`;
};

const estimateSvgTextBounds = (
  text: string,
  anchorPoint: Point,
  options: {
    fontSize: number;
    fontFamily?: string;
    fontWeight?: string | number;
    fontStyle?: string;
    letterSpacing?: number;
    lineHeight?: number;
    textAnchor: 'start' | 'middle' | 'end';
    dominantBaseline?: string;
    rotation: number;
  }
) => {
  const measured =
    measureDrawnixTextBoundsByDom(text, {
      fontSize: options.fontSize,
      fontFamily: options.fontFamily,
      fontWeight: options.fontWeight,
      fontStyle: options.fontStyle,
      letterSpacing: options.letterSpacing,
      lineHeight: options.lineHeight,
    }) ||
    estimateDrawnixTextBounds(
      text,
      options.fontSize,
      options.letterSpacing,
      options.lineHeight
    );
  const bounds = computeTextBoundsFromMeasuredSize(anchorPoint, measured, {
    fontSize: options.fontSize,
    textAnchor: options.textAnchor,
    dominantBaseline: options.dominantBaseline,
  });
  if (!options.rotation) {
    return bounds;
  }
  const rotationMatrix = buildRotateMatrix(options.rotation, anchorPoint[0], anchorPoint[1]);
  return transformBounds(bounds, rotationMatrix);
};

const shouldSkipPlaceholderText = (
  text: string,
  assetPackage: SvgAssetPackage
) => {
  const normalizedLabel = normalizePlaceholderLabel(text);
  if (!normalizedLabel) {
    return false;
  }
  return Boolean(
    assetPackage.iconBoxMap[normalizedLabel] &&
      assetPackage.componentAssets[assetPackage.iconBoxMap[normalizedLabel]!.iconId]
  );
};

const collectTextNodes = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>,
  assetPackage: SvgAssetPackage,
  nodeOrderMap: Map<Element, number>
) => {
  const texts: SvgImportTextItem[] = [];

  for (const node of Array.from(root.querySelectorAll('text')) as SVGTextElement[]) {
    if (isDefinitionNode(node)) {
      continue;
    }
    const text = (node.textContent || '').trim();
    if (!text || shouldSkipPlaceholderText(text, assetPackage)) {
      continue;
    }

    const style = resolveInheritedTextStyle(node, root, classStyles);
    const transform = getAccumulatedTransform(node, root);
    const rotationInfo = resolveTextRotation(transform);
    let id = node.getAttribute('id');
    if (!id) {
      id = `svg-text-${texts.length + 1}`;
      node.setAttribute('id', id);
    }

    const fontSize = parseNumber(style['font-size'], DEFAULT_FONT_SIZE);
    const anchorPoint = applyMatrixToPoint(
      [parseNumber(node.getAttribute('x')), parseNumber(node.getAttribute('y'))],
      transform
    );
    const rawBBox = measureRawBBoxByDom(root, node);
    const sourceBBox =
      (rawBBox ? transformBounds(rawBBox, transform) : null) ||
      estimateSvgTextBounds(text, anchorPoint, {
        fontSize,
        fontFamily: style['font-family'],
        fontWeight: style['font-weight'],
        fontStyle: style['font-style'],
        letterSpacing: parseNumber(style['letter-spacing'], 0),
        lineHeight: undefined,
        textAnchor:
          style['text-anchor'] === 'middle'
            ? 'middle'
            : style['text-anchor'] === 'end'
              ? 'end'
              : 'start',
        dominantBaseline: style['dominant-baseline'] || undefined,
        rotation: rotationInfo.rotation,
      });
    const sourceWidth = roundMetric(Math.max(1, sourceBBox?.width || fontSize));
    const sourceHeight = roundMetric(Math.max(1, sourceBBox?.height || fontSize));
    const transformedCenter = rawBBox
      ? applyMatrixToPoint(
          [rawBBox.x + rawBBox.width / 2, rawBBox.y + rawBBox.height / 2],
          transform
        )
      : [sourceBBox.x + sourceWidth / 2, sourceBBox.y + sourceHeight / 2];
    const drawBounds =
      rawBBox && rotationInfo.canUseNative && rotationInfo.rotation !== 0
        ? {
            x: transformedCenter[0] - rawBBox.width / 2,
            y: transformedCenter[1] - rawBBox.height / 2,
            width: rawBBox.width,
            height: rawBBox.height,
          }
        : {
            x: sourceBBox.x,
            y: sourceBBox.y,
            width: sourceWidth,
            height: sourceHeight,
          };
    const hasEmoji = containsEmoji(text);
    const hasDecorativeSymbol = containsDecorativeSymbol(text);
    const textRole = resolveTextRole(text, {
      fontSize,
      fontWeight: style['font-weight'],
      hasEmoji,
      hasDecorativeSymbol,
    });
    const sourceFontFamilies = splitFontFamilyCandidates(style['font-family']);
    const resolvedFontFamily = resolveSvgImportFontFamily(
      textRole,
      style['font-family'],
      sourceFontFamilies
    );
    const textAnchor =
      style['text-anchor'] === 'middle'
        ? 'middle'
        : style['text-anchor'] === 'end'
          ? 'end'
          : 'start';
    const dominantBaseline = style['dominant-baseline'] || undefined;
    const measuredNativePreview = measureDrawnixTextBoundsByDom(text, {
      fontSize,
      fontFamily: resolvedFontFamily,
      fontWeight: style['font-weight'],
      fontStyle: style['font-style'],
      letterSpacing: parseNumber(style['letter-spacing'], 0),
      lineHeight: roundMetric(Math.max(rawBBox?.height || sourceHeight, fontSize)),
    });
    const nativePreview =
      measuredNativePreview ||
      estimateDrawnixTextBounds(
        text,
        fontSize,
        parseNumber(style['letter-spacing'], 0),
        roundMetric(Math.max(rawBBox?.height || sourceHeight, fontSize))
      );
    const paddedNativePreview = withNativeTextPadding(nativePreview, {
      fontSize,
      textLength: text.length,
    });
    const baseDrawBounds = drawBounds;
    const expandedDrawBounds =
      measuredNativePreview
        ? rawBBox && rotationInfo.canUseNative && rotationInfo.rotation !== 0
          ? {
              x:
                transformedCenter[0]
                - Math.max(baseDrawBounds.width, paddedNativePreview.width) / 2,
              y:
                transformedCenter[1]
                - Math.max(baseDrawBounds.height, paddedNativePreview.height) / 2,
              width: Math.max(baseDrawBounds.width, paddedNativePreview.width),
              height: Math.max(baseDrawBounds.height, paddedNativePreview.height),
            }
          : expandBoundsToContain(
              baseDrawBounds,
              computeTextBoundsFromMeasuredSize(anchorPoint, paddedNativePreview, {
                fontSize,
                textAnchor,
                dominantBaseline,
              })
            )
        : baseDrawBounds;
    const fitsNativeSourceBounds = fitsNativeTextThreshold(
      baseDrawBounds,
      {
        x: sourceBBox.x,
        y: sourceBBox.y,
        width: sourceWidth,
        height: sourceHeight,
      },
      rotationInfo.rotation
    );
    const item: SvgImportTextItem = {
      id,
      sourceOrder: getNodeOrder(node, nodeOrderMap),
      text,
      x: anchorPoint[0],
      y: anchorPoint[1],
      left: roundMetric(expandedDrawBounds.x),
      top: roundMetric(expandedDrawBounds.y),
      width: roundMetric(Math.max(1, expandedDrawBounds.width)),
      height: roundMetric(Math.max(1, expandedDrawBounds.height)),
      sourceLeft: roundMetric(sourceBBox.x),
      sourceTop: roundMetric(sourceBBox.y),
      sourceWidth,
      sourceHeight,
      fontSize,
      lineHeight: roundMetric(
        Math.max(
          rawBBox?.height || sourceHeight,
          measuredNativePreview?.height || 0,
          fontSize
        )
      ),
      fontFamily: style['font-family'],
      resolvedFontFamily,
      hasExplicitFontFamily: Boolean(style['font-family']?.trim()),
      textAnchor,
      dominantBaseline,
      fill: normalizeColor(style['fill']) || '#000000',
      stroke: normalizeColor(style['stroke']),
      strokeWidth: parseNumber(style['stroke-width'], 0),
      fontWeight: style['font-weight'],
      fontStyle: style['font-style'],
      letterSpacing: parseNumber(style['letter-spacing'], 0),
      opacity: style.opacity ? parseNumber(style.opacity, 1) : undefined,
      rotation: rotationInfo.rotation,
      textRole,
      hasEmoji,
      hasDecorativeSymbol,
      hasTspan: Boolean(node.querySelector('tspan')),
      hasTransform: rotationInfo.hasTransform,
      hasComplexTransform: rotationInfo.hasComplexTransform,
      textLength: node.hasAttribute('textLength')
        ? parseNumber(node.getAttribute('textLength'), 0)
        : undefined,
      lengthAdjust: node.getAttribute('lengthAdjust') || undefined,
      classList: (node.getAttribute('class') || '')
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean),
      fontFamilies: sourceFontFamilies,
      importMode: 'native',
      node,
    };

    const hasVisibleComplexStroke = isVisibleStroke(item.stroke, item.strokeWidth);
    const lacksStableMetrics = !nativePreview || nativePreview.width <= 0 || nativePreview.height <= 0;
    const hasLengthConstraint =
      typeof item.textLength === 'number' && item.textLength > 0
        ? true
        : Boolean(item.lengthAdjust?.trim());
    const shouldFallback =
      item.hasTspan ||
      hasVisibleComplexStroke ||
      item.hasComplexTransform ||
      hasLengthConstraint ||
      lacksStableMetrics ||
      !fitsNativeSourceBounds;

    if (shouldFallback) {
      item.importMode = 'fragment';
    }

    texts.push(item);
  }

  return texts;
};

const extractMainArrowPointsFromPath = (
  d: string,
  options?: { trimShortDiagonalTail?: boolean }
): Point[] => {
  const tokens = tokenizePath(d);
  const points: Point[] = [];
  let command = '';
  let index = 0;
  let x = 0;
  let y = 0;
  let firstSubpathFinished = false;

  const pushPoint = (nextX: number, nextY: number) => {
    x = nextX;
    y = nextY;
    const last = points[points.length - 1];
    if (!last || last[0] !== nextX || last[1] !== nextY) {
      points.push([nextX, nextY]);
    }
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) {
      break;
    }

    if (/^[MLHVQZmlhvqz]$/.test(token)) {
      if ((token === 'm' || token === 'M') && points.length > 1) {
        firstSubpathFinished = true;
      }
      command = token;
      index += 1;
      if (firstSubpathFinished) {
        break;
      }
      continue;
    }

    switch (command) {
      case 'M':
      case 'L':
        pushPoint(Number.parseFloat(token), Number.parseFloat(tokens[index + 1] || '0'));
        index += 2;
        break;
      case 'm':
      case 'l':
        pushPoint(x + Number.parseFloat(token), y + Number.parseFloat(tokens[index + 1] || '0'));
        index += 2;
        break;
      case 'H':
        pushPoint(Number.parseFloat(token), y);
        index += 1;
        break;
      case 'h':
        pushPoint(x + Number.parseFloat(token), y);
        index += 1;
        break;
      case 'V':
        pushPoint(x, Number.parseFloat(token));
        index += 1;
        break;
      case 'v':
        pushPoint(x, y + Number.parseFloat(token));
        index += 1;
        break;
      case 'Q':
        pushPoint(Number.parseFloat(tokens[index + 2] || '0'), Number.parseFloat(tokens[index + 3] || '0'));
        index += 4;
        break;
      case 'q':
        pushPoint(x + Number.parseFloat(tokens[index + 2] || '0'), y + Number.parseFloat(tokens[index + 3] || '0'));
        index += 4;
        break;
      default:
        index += 1;
        break;
    }
  }

  if (options?.trimShortDiagonalTail !== false) {
    while (points.length > 2) {
      const last = points[points.length - 1]!;
      const prev = points[points.length - 2]!;
      const deltaX = Math.abs(last[0] - prev[0]);
      const deltaY = Math.abs(last[1] - prev[1]);
      const isShortTail = Math.max(deltaX, deltaY) <= 12;
      const isDiagonal = deltaX > 0 && deltaY > 0;
      if (!isShortTail && !isDiagonal) {
        break;
      }
      points.pop();
    }
  }

  return points;
};

const classifyPathNode = (node: Element, style: CssStyleMap) => {
  const className = node.getAttribute('class') || '';
  const d = node.getAttribute('d') || '';
  const fill = normalizeColor(style['fill']);

  if (className.includes('fill-arrow')) {
    return 'preserve-arrow' as const;
  }

  if (!className.includes('stroke-main') || !d || !hasDiagonalArrowHead(d)) {
    return 'other' as const;
  }

  if (!fill && isSimplePath(d)) {
    return 'convert-arrow' as const;
  }

  return 'preserve-arrow' as const;
};

const measureRawBBoxByDom = (root: SVGSVGElement, node: Element) => {
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  const mount = document.createElement('div');
  mount.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  const { width, height } = getRootViewport(root);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  for (const styleNode of Array.from(root.querySelectorAll('style'))) {
    svg.appendChild(styleNode.cloneNode(true));
  }
  const clonedNode = node.cloneNode(true) as SVGGraphicsElement;
  clonedNode.removeAttribute('transform');
  svg.appendChild(clonedNode);
  mount.appendChild(svg);
  document.body.appendChild(mount);

  try {
    if (typeof clonedNode.getBBox !== 'function') {
      return null;
    }
    const bbox = clonedNode.getBBox();
    return {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    };
  } catch {
    return null;
  } finally {
    mount.remove();
  }
};

const measureBBoxByDom = (root: SVGSVGElement, node: Element) => {
  const rawBBox = measureRawBBoxByDom(root, node);
  if (!rawBBox) {
    return null;
  }
  return transformBounds(rawBBox, getAccumulatedTransform(node, root));
};

const expandBBox = (
  bbox: { x: number; y: number; width: number; height: number },
  padding: number
) => {
  return {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: bbox.width + padding * 2,
    height: bbox.height + padding * 2,
  };
};

const ensureNodeId = (node: Element, prefix: string, index: number) => {
  let id = node.getAttribute('id');
  if (!id) {
    id = `${prefix}-${index}`;
    node.setAttribute('id', id);
  }
  return id;
};

const isDefinitionNode = (node: Element) => {
  return Boolean(node.closest('defs, style, clipPath, mask, pattern, symbol, marker'));
};

const parsePointList = (value: string) => {
  const numbers = value
    .trim()
    .split(/[\s,]+/)
    .map((item) => Number.parseFloat(item))
    .filter((item) => Number.isFinite(item));
  const points: Point[] = [];
  for (let index = 0; index < numbers.length - 1; index += 2) {
    points.push([numbers[index]!, numbers[index + 1]!]);
  }
  return points;
};

const hasArrowMarker = (node: Element) => {
  return Boolean(node.getAttribute('marker-start') || node.getAttribute('marker-end'));
};

const resolveArrowMarkers = (node: Element) => {
  return {
    sourceMarker: node.getAttribute('marker-start')
      ? ArrowLineMarkerType.arrow
      : ArrowLineMarkerType.none,
    targetMarker: node.getAttribute('marker-end')
      ? ArrowLineMarkerType.arrow
      : ArrowLineMarkerType.none,
  };
};

interface SvgPathSubpath {
  points: Point[];
  closed: boolean;
}

const extractPathSubpaths = (d: string): SvgPathSubpath[] => {
  const tokens = tokenizePath(d);
  const subpaths: SvgPathSubpath[] = [];
  let command = '';
  let index = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let current: Point[] = [];
  let currentClosed = false;

  const pushPoint = (nextX: number, nextY: number) => {
    x = nextX;
    y = nextY;
    const last = current[current.length - 1];
    if (!last || last[0] !== nextX || last[1] !== nextY) {
      current.push([nextX, nextY]);
    }
  };

  const finishSubpath = () => {
    if (current.length >= 2) {
      const first = current[0]!;
      const last = current[current.length - 1]!;
      const closed =
        currentClosed || (first[0] === last[0] && first[1] === last[1]);
      const points =
        closed && (first[0] !== last[0] || first[1] !== last[1])
          ? [...current, first]
          : [...current];
      subpaths.push({ points, closed });
    }
    current = [];
    currentClosed = false;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) {
      break;
    }

    if (/^[MLHVQZmlhvqz]$/.test(token)) {
      if ((token === 'M' || token === 'm') && current.length) {
        finishSubpath();
      }
      command = token;
      index += 1;
      if (token === 'Z' || token === 'z') {
        currentClosed = true;
        if (current.length) {
          pushPoint(startX, startY);
          finishSubpath();
        }
      }
      continue;
    }

    switch (command) {
      case 'M':
      case 'L': {
        const nextX = Number.parseFloat(token);
        const nextY = Number.parseFloat(tokens[index + 1] || '0');
        pushPoint(nextX, nextY);
        if (command === 'M') {
          startX = nextX;
          startY = nextY;
          command = 'L';
        }
        index += 2;
        break;
      }
      case 'm':
      case 'l': {
        const nextX = x + Number.parseFloat(token);
        const nextY = y + Number.parseFloat(tokens[index + 1] || '0');
        pushPoint(nextX, nextY);
        if (command === 'm') {
          startX = nextX;
          startY = nextY;
          command = 'l';
        }
        index += 2;
        break;
      }
      case 'H':
        pushPoint(Number.parseFloat(token), y);
        index += 1;
        break;
      case 'h':
        pushPoint(x + Number.parseFloat(token), y);
        index += 1;
        break;
      case 'V':
        pushPoint(x, Number.parseFloat(token));
        index += 1;
        break;
      case 'v':
        pushPoint(x, y + Number.parseFloat(token));
        index += 1;
        break;
      case 'Q': {
        const nextX = Number.parseFloat(tokens[index + 2] || '0');
        const nextY = Number.parseFloat(tokens[index + 3] || '0');
        pushPoint(nextX, nextY);
        index += 4;
        break;
      }
      case 'q': {
        const nextX = x + Number.parseFloat(tokens[index + 2] || '0');
        const nextY = y + Number.parseFloat(tokens[index + 3] || '0');
        pushPoint(nextX, nextY);
        index += 4;
        break;
      }
      default:
        index += 1;
        break;
    }
  }

  finishSubpath();
  return subpaths;
};

const transformPoints = (points: Point[], matrix: SvgMatrix) => {
  return points.map((point) => applyMatrixToPoint(point, matrix));
};

const collectPackageBoundImages = (
  root: SVGSVGElement,
  componentAssets: SvgAssetPackage['componentAssets'],
  consumedIds: Set<string>,
  nodeOrderMap: Map<Element, number>
) => {
  const items: SvgImportImageItem[] = [];

  for (const node of Array.from(root.querySelectorAll('image[id]'))) {
    if (isDefinitionNode(node)) {
      continue;
    }
    const id = node.getAttribute('id') || '';
    if (!id.startsWith('icon_')) {
      continue;
    }
    const transform = getAccumulatedTransform(node, root);
    const x = parseNumber(node.getAttribute('x'));
    const y = parseNumber(node.getAttribute('y'));
    const width = parseNumber(node.getAttribute('width'));
    const height = parseNumber(node.getAttribute('height'));
    const asset = componentAssets[id];
    const url = asset?.url || node.getAttribute('href') || node.getAttribute('xlink:href') || '';

    if (!url || width <= 0 || height <= 0) {
      continue;
    }

    const bounds = transformBounds({ x, y, width, height }, transform);
    items.push({
      id,
      sourceOrder: getNodeOrder(node, nodeOrderMap),
      url,
      points: [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
      ],
    });
    consumedIds.add(id);
  }

  return items;
};

const collectEllipseNodes = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>,
  nodeOrderMap: Map<Element, number>
) => {
  const ellipses: SvgImportEllipseItem[] = [];

  for (const node of Array.from(root.querySelectorAll('circle, ellipse'))) {
    if (isDefinitionNode(node)) {
      continue;
    }
    const style = resolveInheritedStyle(node, root, classStyles);
    const transform = getAccumulatedTransform(node, root);
    const id = ensureNodeId(node, 'svg-ellipse', ellipses.length + 1);
    const tagName = node.tagName.toLowerCase();

    let x = 0;
    let y = 0;
    let width = 0;
    let height = 0;

    if (tagName === 'circle') {
      const cx = parseNumber(node.getAttribute('cx'));
      const cy = parseNumber(node.getAttribute('cy'));
      const r = parseNumber(node.getAttribute('r'));
      width = r * 2;
      height = r * 2;
      x = cx - r;
      y = cy - r;
    } else {
      const cx = parseNumber(node.getAttribute('cx'));
      const cy = parseNumber(node.getAttribute('cy'));
      const rx = parseNumber(node.getAttribute('rx'));
      const ry = parseNumber(node.getAttribute('ry'));
      width = rx * 2;
      height = ry * 2;
      x = cx - rx;
      y = cy - ry;
    }

    if (width <= 0 || height <= 0) {
      continue;
    }

    const bounds = transformBounds({ x, y, width, height }, transform);
    ellipses.push({
      id,
      sourceOrder: getNodeOrder(node, nodeOrderMap),
      points: [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
      ],
      fill: normalizeColor(style.fill),
      strokeColor: normalizeColor(style.stroke),
      strokeWidth: parseNumber(style['stroke-width'], 0),
    });
    consumedIds.add(id);
  }

  return ellipses;
};

const collectArrowGroupVectorLines = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>,
  nodeOrderMap: Map<Element, number>
) => {
  const vectorLines: SvgImportVectorLineItem[] = [];

  for (const group of Array.from(root.querySelectorAll('g.arrow'))) {
    if (isDefinitionNode(group)) {
      continue;
    }
    const groupId = ensureNodeId(group, 'svg-arrow-group', vectorLines.length + 1);
    const paths = Array.from(group.children).filter(
      (child): child is SVGPathElement => child.tagName.toLowerCase() === 'path'
    );
    let convertedCount = 0;

    for (const path of paths) {
      const d = path.getAttribute('d') || '';
      if (!d || !isSimplePath(d)) {
        continue;
      }
      const subpaths = extractPathSubpaths(d);
      if (!subpaths.length) {
        continue;
      }

      const style = resolveInheritedStyle(path, root, classStyles);
      const transform = getAccumulatedTransform(path, root);
      const pathId = ensureNodeId(path, `${groupId}-path`, convertedCount + 1);

      subpaths.forEach((subpath, index) => {
        const transformedPoints = transformPoints(subpath.points, transform);
        if (transformedPoints.length < 2) {
          return;
        }
        vectorLines.push({
          id: `${pathId}-${index + 1}`,
          sourceOrder: getNodeOrder(path, nodeOrderMap),
          sourceSubOrder: index,
          points: transformedPoints,
          fill: subpath.closed ? normalizeColor(style.fill) : undefined,
          strokeColor: normalizeColor(style.stroke) || normalizeColor(style.fill) || DEFAULT_STROKE,
          strokeWidth: parseNumber(style['stroke-width'], subpath.closed ? 1 : DEFAULT_STROKE_WIDTH),
        });
      });

      convertedCount += 1;
    }

    if (convertedCount > 0) {
      consumedIds.add(groupId);
    }
  }

  return vectorLines;
};

const collectVectorLineItems = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>,
  nodeOrderMap: Map<Element, number>
) => {
  const vectorLines: SvgImportVectorLineItem[] = [];

  for (const node of Array.from(root.querySelectorAll('line, polyline, polygon, path'))) {
    if (isDefinitionNode(node)) {
      continue;
    }
    if (node.closest('g.arrow')) {
      continue;
    }

    const tagName = node.tagName.toLowerCase();
    const hasMarker = !!node.getAttribute('marker-end') || !!node.getAttribute('marker-start');
    const className = node.getAttribute('class') || '';
    if (hasMarker || className.includes('arrow')) {
      continue;
    }

    const id = ensureNodeId(node, 'svg-vector', vectorLines.length + 1);
    const style = resolveInheritedStyle(node, root, classStyles);
    const transform = getAccumulatedTransform(node, root);
    let subpaths: SvgPathSubpath[] = [];

    if (tagName === 'line') {
      subpaths = [
        {
          points: [
            [parseNumber(node.getAttribute('x1')), parseNumber(node.getAttribute('y1'))],
            [parseNumber(node.getAttribute('x2')), parseNumber(node.getAttribute('y2'))],
          ],
          closed: false,
        },
      ];
    } else if (tagName === 'polyline' || tagName === 'polygon') {
      const points = parsePointList(node.getAttribute('points') || '');
      if (tagName === 'polygon' && points.length >= 2) {
        points.push(points[0]!);
      }
      subpaths = points.length >= 2 ? [{ points, closed: tagName === 'polygon' }] : [];
    } else if (tagName === 'path') {
      const d = node.getAttribute('d') || '';
      if (!d || !isSimplePath(d)) {
        continue;
      }
      const classification = classifyPathNode(node, style);
      if (classification === 'convert-arrow' || classification === 'preserve-arrow') {
        continue;
      }
      subpaths = extractPathSubpaths(d);
    }

    const nextItems = subpaths
      .map<SvgImportVectorLineItem | null>((subpath, index) => {
        const transformedPoints = transformPoints(subpath.points, transform);
        if (transformedPoints.length < 2) {
          return null;
        }
        return {
          id: `${id}-${index + 1}`,
          sourceOrder: getNodeOrder(node, nodeOrderMap),
          sourceSubOrder: index,
          points: transformedPoints,
          fill: subpath.closed ? normalizeColor(style.fill) : undefined,
          strokeColor:
            normalizeColor(style.stroke)
            || (subpath.closed ? normalizeColor(style.fill) : undefined)
            || DEFAULT_STROKE,
          strokeWidth: parseNumber(
            style['stroke-width'],
            subpath.closed && !normalizeColor(style.stroke) ? 0 : DEFAULT_STROKE_WIDTH
          ),
        } satisfies SvgImportVectorLineItem;
      })
      .filter((item): item is SvgImportVectorLineItem => item !== null);

    if (nextItems.length) {
      vectorLines.push(...nextItems);
      consumedIds.add(id);
    }
  }

  return vectorLines;
};

const collectArrowItems = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>,
  nodeOrderMap: Map<Element, number>
) => {
  const converted: SvgImportArrowItem[] = [];
  const preserved: SvgImportImageItem[] = [];

  for (const node of Array.from(root.querySelectorAll('line, polyline, path'))) {
    if (isDefinitionNode(node)) {
      continue;
    }
    if (node.closest('g.arrow')) {
      continue;
    }
    const id = ensureNodeId(node, 'svg-arrow', converted.length + preserved.length + 1);
    const tagName = node.tagName.toLowerCase();
    const style = resolveInheritedStyle(node, root, classStyles);
    const transform = getAccumulatedTransform(node, root);
    const sourceOrder = getNodeOrder(node, nodeOrderMap);
    const markerConfig = resolveArrowMarkers(node);

    if (tagName === 'path') {
      const d = node.getAttribute('d') || '';
      if (hasArrowMarker(node) && d && isSimplePath(d)) {
        const points = extractMainArrowPointsFromPath(d, {
          trimShortDiagonalTail: false,
        }).map((point) =>
          applyMatrixToPoint(point, transform)
        );
        if (points.length >= 2) {
          converted.push({
            id,
            sourceOrder,
            points,
            strokeColor: normalizeColor(style.stroke) || DEFAULT_STROKE,
            strokeWidth: parseNumber(style['stroke-width'], DEFAULT_STROKE_WIDTH),
            sourceMarker: markerConfig.sourceMarker,
            targetMarker: markerConfig.targetMarker,
          });
          consumedIds.add(id);
        }
        continue;
      }

      const classification = classifyPathNode(node, style);
      if (classification === 'convert-arrow') {
        const points = extractMainArrowPointsFromPath(d).map((point) =>
          applyMatrixToPoint(point, transform)
        );
        if (points.length >= 2) {
          converted.push({
            id,
            sourceOrder,
            points,
            strokeColor: normalizeColor(style.stroke) || DEFAULT_STROKE,
            strokeWidth: parseNumber(style['stroke-width'], DEFAULT_STROKE_WIDTH),
            sourceMarker: ArrowLineMarkerType.none,
            targetMarker: ArrowLineMarkerType.arrow,
          });
          consumedIds.add(id);
        }
      } else if (classification === 'preserve-arrow') {
        const bbox = measureBBoxByDom(root, node);
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          const strokeWidth = parseNumber(style['stroke-width'], DEFAULT_STROKE_WIDTH);
          const paddedBBox = expandBBox(bbox, Math.max(4, strokeWidth));
          preserved.push({
            id,
            sourceOrder,
            url: serializeSvgNodes(
              root,
              [node],
              paddedBBox.width,
              paddedBBox.height,
              paddedBBox
            ),
            points: [
              [paddedBBox.x, paddedBBox.y],
              [paddedBBox.x + paddedBBox.width, paddedBBox.y + paddedBBox.height],
            ],
          });
          consumedIds.add(id);
        }
      }
      continue;
    }

    const hasMarker = !!node.getAttribute('marker-end') || !!node.getAttribute('marker-start');
    const className = node.getAttribute('class') || '';
    if (!hasMarker && !className.includes('arrow')) {
      continue;
    }

    const points: Point[] = [];
    if (tagName === 'line') {
      points.push(
        applyMatrixToPoint(
          [parseNumber(node.getAttribute('x1')), parseNumber(node.getAttribute('y1'))],
          transform
        ),
        applyMatrixToPoint(
          [parseNumber(node.getAttribute('x2')), parseNumber(node.getAttribute('y2'))],
          transform
        )
      );
    } else if (tagName === 'polyline') {
      const values = (node.getAttribute('points') || '')
        .trim()
        .split(/[\s,]+/)
        .map((item) => Number.parseFloat(item))
        .filter((item) => Number.isFinite(item));
      for (let index = 0; index < values.length - 1; index += 2) {
        points.push(applyMatrixToPoint([values[index]!, values[index + 1]!], transform));
      }
    }

    if (points.length >= 2) {
      converted.push({
        id,
        sourceOrder,
        points,
        strokeColor: normalizeColor(style.stroke) || DEFAULT_STROKE,
        strokeWidth: parseNumber(style['stroke-width'], DEFAULT_STROKE_WIDTH),
        sourceMarker: markerConfig.sourceMarker,
        targetMarker: markerConfig.targetMarker,
      });
      consumedIds.add(id);
    }
  }

  return { converted, preserved };
};

const countIgnoredBackgroundRects = (
  root: SVGSVGElement,
  width: number,
  height: number,
  classStyles: Record<string, CssStyleMap>
) => {
  let ignoredBackgroundCount = 0;

  for (const node of Array.from(root.querySelectorAll('rect'))) {
    if (isDefinitionNode(node)) {
      continue;
    }
    const resolvedStyle = resolveInheritedStyle(node, root, classStyles);
    if (isBackgroundRect(node, width, height, resolvedStyle)) {
      ignoredBackgroundCount += 1;
    }
  }

  return ignoredBackgroundCount;
};

const isRenderableResidualTag = (tagName: string) => {
  return ['path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'image', 'use'].includes(tagName);
};

const hasConsumedAncestor = (node: Element, consumedIds: Set<string>) => {
  let current: Element | null = node.parentElement;
  while (current) {
    const id = current.getAttribute('id');
    if (id && consumedIds.has(id)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const collectResidualFragments = (
  root: SVGSVGElement,
  width: number,
  height: number,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>,
  nodeOrderMap: Map<Element, number>
) => {
  const fragments: SvgImportImageItem[] = [];

  for (const node of Array.from(root.querySelectorAll('*'))) {
    const tagName = node.tagName.toLowerCase();
    if (!isRenderableResidualTag(tagName) || tagName === 'svg') {
      continue;
    }
    if (node.closest('defs, style, clipPath, mask, pattern, symbol')) {
      continue;
    }
    if (tagName === 'rect') {
      const resolvedStyle = resolveInheritedStyle(node, root, classStyles);
      if (isBackgroundRect(node, width, height, resolvedStyle)) {
        continue;
      }
    }

    const id = ensureNodeId(node, 'svg-fragment', fragments.length + 1);
    if (consumedIds.has(id) || hasConsumedAncestor(node, consumedIds)) {
      continue;
    }

    const bbox = measureBBoxByDom(root, node);
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
      continue;
    }
    const style = resolveInheritedStyle(node, root, classStyles);
    const strokeWidth = parseNumber(style['stroke-width'], 1);
    const paddedBBox = expandBBox(bbox, Math.max(2, strokeWidth));
    fragments.push({
      id,
      sourceOrder: getNodeOrder(node, nodeOrderMap),
      url: serializeSvgNodes(root, [node], paddedBBox.width, paddedBBox.height, paddedBBox),
      points: [
        [paddedBBox.x, paddedBBox.y],
        [paddedBBox.x + paddedBBox.width, paddedBBox.y + paddedBBox.height],
      ],
    });
    consumedIds.add(id);
  }

  return fragments;
};

const collectRectNodes = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>,
  width: number,
  height: number,
  nodeOrderMap: Map<Element, number>
) => {
  const rects: SvgImportRectItem[] = [];

  for (const node of Array.from(root.querySelectorAll('rect'))) {
    const resolvedStyle = resolveInheritedStyle(node, root, classStyles);
    if (isBackgroundRect(node, width, height, resolvedStyle)) {
      continue;
    }

    const transform = getAccumulatedTransform(node, root);
    let id = node.getAttribute('id');
    if (!id) {
      id = `svg-rect-${rects.length + 1}`;
      node.setAttribute('id', id);
    }

    const x = parseNumber(node.getAttribute('x'));
    const y = parseNumber(node.getAttribute('y'));
    const w = parseNumber(node.getAttribute('width'));
    const h = parseNumber(node.getAttribute('height'));
    const rx = parseNumber(node.getAttribute('rx'));
    const ry = parseNumber(node.getAttribute('ry'));

    if (w <= 0 || h <= 0) continue;

    const bounds = transformBounds({ x, y, width: w, height: h }, transform);
    rects.push({
      id,
      sourceOrder: getNodeOrder(node, nodeOrderMap),
      points: [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
      ],
      fill: normalizeColor(resolvedStyle['fill']),
      strokeColor: normalizeColor(resolvedStyle['stroke']),
      strokeWidth: parseNumber(resolvedStyle['stroke-width'], 0),
      rx,
      ry,
    });
    consumedIds.add(id);
  }

  return rects;
};

export const convertSvgAssetPackageToDrawnix = (
  assetPackage: SvgAssetPackage
): SvgImportResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(assetPackage.svgText, 'image/svg+xml');
  const root = doc.documentElement as unknown as SVGSVGElement;

  if (!root || root.tagName.toLowerCase() !== 'svg' || root.querySelector('parsererror')) {
    throw new Error('Invalid SVG content');
  }

  const classStyles = parseClassStyles(root);
  const { width, height } = getRootViewport(root);
  const nodeOrderMap = buildNodeOrderMap(root);
  const consumedIds = new Set<string>();
  
  const texts = collectTextNodes(root, classStyles, assetPackage, nodeOrderMap);
  for (const text of texts) {
    consumedIds.add(text.id);
  }

  const rects = collectRectNodes(root, classStyles, consumedIds, width, height, nodeOrderMap);
  const ellipses = collectEllipseNodes(root, classStyles, consumedIds, nodeOrderMap);
  const externalComponents = collectPackageBoundImages(
    root,
    assetPackage.componentAssets,
    consumedIds,
    nodeOrderMap
  );
  const arrowGroups = collectArrowGroupVectorLines(root, classStyles, consumedIds, nodeOrderMap);
  const vectorLines = collectVectorLineItems(root, classStyles, consumedIds, nodeOrderMap);
  const arrowItems = collectArrowItems(root, classStyles, consumedIds, nodeOrderMap);
  const residualFragments = collectResidualFragments(
    root,
    width,
    height,
    classStyles,
    consumedIds,
    nodeOrderMap
  );
  const ignoredBackgroundCount = countIgnoredBackgroundRects(root, width, height, classStyles);
  const warnings: string[] = [];

  if (arrowItems.preserved.length) {
    warnings.push('部分箭头保留为原 SVG 图片形态导入。');
  }
  if (residualFragments.length) {
    warnings.push(`有 ${residualFragments.length} 个复杂图形仍保留为 SVG 片段。`);
  }
  const fragmentTextCount = texts.filter((item) => item.importMode === 'fragment').length;
  if (fragmentTextCount > 0) {
    warnings.push(`有 ${fragmentTextCount} 段复杂文字保留为 SVG 片段。`);
  }
  if (Object.keys(assetPackage.componentAssets).length && !externalComponents.length) {
    warnings.push('未在总 SVG 中匹配到组件占位节点，请检查文件命名规则。');
  }

  const elements: PlaitElement[] = [
    ...rects.map((item) => ({ item, element: buildRectElement(item) })),
    ...ellipses.map((item) => ({ item, element: buildEllipseElement(item) })),
    ...arrowGroups.map((item) => ({ item, element: buildVectorLineElement(item) })),
    ...vectorLines.map((item) => ({ item, element: buildVectorLineElement(item) })),
    ...arrowItems.converted.map((item) => ({ item, element: buildArrowElement(item) })),
    ...residualFragments.map((item) => ({ item, element: buildImageElement(item) })),
    ...externalComponents.map((item) => ({ item, element: buildImageElement(item) })),
    ...arrowItems.preserved.map((item) => ({ item, element: buildImageElement(item) })),
    ...texts.map((item) => ({ item, element: buildTextElement(item) })),
  ]
    .sort((left, right) => {
      return (
        left.item.sourceOrder - right.item.sourceOrder
        || (left.item.sourceSubOrder || 0) - (right.item.sourceSubOrder || 0)
      );
    })
    .map(({ element }) => element);

  return {
    elements,
    summary: {
      textCount: texts.length,
      arrowCount: arrowItems.converted.length,
      rectCount: rects.length,
      componentCount:
        externalComponents.length
        + arrowItems.preserved.length
        + residualFragments.length,
      ignoredBackgroundCount,
      warnings,
    },
  };
};

export const convertSvgToDrawnix = (svgText: string): SvgImportResult => {
  return convertSvgAssetPackageToDrawnix({
    fileName: 'inline.svg',
    svgText,
    componentAssets: {},
    iconBoxMap: {},
  });
};
