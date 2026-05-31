import {
  getRectangleByElements,
  getSelectedElements,
  PlaitBoard,
  PlaitElement,
} from '@plait/core';
import pptxgen from 'pptxgenjs';
import { fileSave } from '../data/filesystem';
import { exportBoardToRasterBlob } from './common';
import { getBackgroundColor } from './color';
import { applyImageEraseMask } from './image-erase';

const PX_PER_INCH = 96;
const PX_TO_PT = 72 / PX_PER_INCH;
const DEFAULT_SLIDE_WIDTH_PX = 960;
const DEFAULT_SLIDE_HEIGHT_PX = 540;
const FALLBACK_PADDING_PX = 20;
const PPTX_SLIDE_WIDTH_IN = 13.333333;
const PPTX_SLIDE_HEIGHT_IN = 7.5;
const PPTX_SLIDE_WIDTH_PX = PPTX_SLIDE_WIDTH_IN * PX_PER_INCH;
const PPTX_SLIDE_HEIGHT_PX = PPTX_SLIDE_HEIGHT_IN * PX_PER_INCH;
const PPTX_SAFE_MARGIN_PX = 48;

type RectangleLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextStyleInfo = {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  valign?: 'top' | 'middle' | 'bottom';
};

type ExportPlacement =
  | {
      mode: 'native-rect';
      rect: RectangleLike;
    }
  | {
      mode: 'native-line';
      start: [number, number];
      end: [number, number];
      rect: RectangleLike;
    }
  | {
      mode: 'fallback-image';
      rect: RectangleLike;
    };

type SlideTransform = {
  bounds: RectangleLike;
  scale: number;
  offsetX: number;
  offsetY: number;
};

const pxToInches = (value: number) => value / PX_PER_INCH;

const pxToPoints = (value: number) => Math.max(1, value * PX_TO_PT);

const getSlideTransform = (bounds: RectangleLike): SlideTransform => {
  const availableWidth = Math.max(
    1,
    PPTX_SLIDE_WIDTH_PX - PPTX_SAFE_MARGIN_PX * 2
  );
  const availableHeight = Math.max(
    1,
    PPTX_SLIDE_HEIGHT_PX - PPTX_SAFE_MARGIN_PX * 2
  );
  const scale = Math.min(
    1,
    availableWidth / Math.max(1, bounds.width),
    availableHeight / Math.max(1, bounds.height)
  );
  const contentWidth = bounds.width * scale;
  const contentHeight = bounds.height * scale;
  return {
    bounds,
    scale,
    offsetX: (PPTX_SLIDE_WIDTH_PX - contentWidth) / 2,
    offsetY: (PPTX_SLIDE_HEIGHT_PX - contentHeight) / 2,
  };
};

const transformX = (value: number, transform: SlideTransform) =>
  transform.offsetX + (value - transform.bounds.x) * transform.scale;

const transformY = (value: number, transform: SlideTransform) =>
  transform.offsetY + (value - transform.bounds.y) * transform.scale;

const transformSize = (value: number, transform: SlideTransform) =>
  value * transform.scale;

const transformRect = (
  rect: RectangleLike,
  transform: SlideTransform
): RectangleLike => ({
  x: transformX(rect.x, transform),
  y: transformY(rect.y, transform),
  width: transformSize(rect.width, transform),
  height: transformSize(rect.height, transform),
});

const transformPoint = (
  point: [number, number],
  transform: SlideTransform
): [number, number] => [
  transformX(point[0], transform),
  transformY(point[1], transform),
];

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const clampTransparency = (opacity?: number) => {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) {
    return undefined;
  }
  return Math.max(0, Math.min(100, Math.round((1 - opacity) * 100)));
};

const normalizeHexColor = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'none' || trimmed === 'transparent') {
    return undefined;
  }
  const hexMatched = trimmed.match(/^#?([0-9a-fA-F]{3,8})$/);
  if (hexMatched) {
    const normalized = hexMatched[1].toUpperCase();
    if (normalized.length === 3 || normalized.length === 6) {
      return normalized;
    }
    if (normalized.length === 4) {
      return normalized.slice(0, 3);
    }
    if (normalized.length === 8) {
      return normalized.slice(0, 6);
    }
  }
  const rgbMatched = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (rgbMatched) {
    return [rgbMatched[1], rgbMatched[2], rgbMatched[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return undefined;
};

const getOpacityFromColor = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  const hexMatched = trimmed.match(/^#?([0-9a-fA-F]{4}|[0-9a-fA-F]{8})$/);
  if (hexMatched) {
    const hex = hexMatched[1];
    const alphaHex =
      hex.length === 4 ? hex.slice(3) + hex.slice(3) : hex.slice(6);
    return parseInt(alphaHex, 16) / 255;
  }
  const rgbaMatched = trimmed.match(
    /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*([\d.]+)\s*\)$/i
  );
  if (rgbaMatched) {
    const alpha = Number(rgbaMatched[1]);
    return Number.isFinite(alpha) ? alpha : undefined;
  }
  return undefined;
};

const buildFillProps = (fill?: string, opacity?: number) => {
  const color = normalizeHexColor(fill);
  if (!color) {
    return { color: 'FFFFFF', transparency: 100, type: 'solid' as const };
  }
  const transparency = clampTransparency(
    typeof opacity === 'number' ? opacity : getOpacityFromColor(fill)
  );
  return {
    color,
    ...(transparency !== undefined ? { transparency } : {}),
  };
};

const buildLineProps = (
  stroke?: string,
  strokeWidth?: number,
  opacity?: number,
  scale = 1,
  extras?: Record<string, unknown>
) => {
  const color = normalizeHexColor(stroke) || '111827';
  const transparency = clampTransparency(
    typeof opacity === 'number' ? opacity : getOpacityFromColor(stroke)
  );
  return {
    color,
    width: pxToPoints((strokeWidth ?? 1) * scale),
    ...(transparency !== undefined ? { transparency } : {}),
    ...extras,
  };
};

const extractRectangleFromPoints = (points: unknown): RectangleLike | null => {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  const pairs = points.filter(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number'
  );
  if (pairs.length === 0) {
    return null;
  }
  const xs = pairs.map((point) => point[0]);
  const ys = pairs.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const getElementFrameRectangle = (element: PlaitElement): RectangleLike => {
  return (
    extractRectangleFromPoints((element as Record<string, unknown>).points) || {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    }
  );
};

const getElementRenderedRectangle = (
  board: PlaitBoard,
  element: PlaitElement
): RectangleLike => {
  const rect = getRectangleByElements(
    board,
    [element],
    true
  ) as RectangleLike | null;
  if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
    return {
      x: rect.x,
      y: rect.y,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  }
  return getElementFrameRectangle(element);
};

const getElementsRenderedRectangle = (
  board: PlaitBoard,
  elements: PlaitElement[]
): RectangleLike | null => {
  const rect = getRectangleByElements(
    board,
    elements,
    true
  ) as RectangleLike | null;
  if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
    return {
      x: rect.x,
      y: rect.y,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  }
  return null;
};

const extractTextContent = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }
  if (Array.isArray(record.children)) {
    const childTexts = record.children
      .map((child) => extractTextContent(child))
      .filter((text) => text.length > 0);
    const containsParagraphs = record.children.some(
      (child) =>
        child &&
        typeof child === 'object' &&
        (child as Record<string, unknown>).type === 'paragraph'
    );
    return childTexts.join(containsParagraphs ? '\n' : '');
  }
  return '';
};

const findFirstTextLeaf = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record;
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      const matched = findFirstTextLeaf(child);
      if (matched) {
        return matched;
      }
    }
  }
  return null;
};

const resolveTextStyle = (element: Record<string, unknown>): TextStyleInfo => {
  const textProperties =
    element.textProperties && typeof element.textProperties === 'object'
      ? (element.textProperties as Record<string, unknown>)
      : {};
  const textStyle =
    element.textStyle && typeof element.textStyle === 'object'
      ? (element.textStyle as Record<string, unknown>)
      : {};
  const leaf = findFirstTextLeaf(element.text);
  const fontWeight =
    textProperties['fontWeight'] ??
    textProperties['font-weight'] ??
    textStyle['fontWeight'] ??
    textStyle['font-weight'] ??
    leaf?.['fontWeight'] ??
    leaf?.['font-weight'];
  const fontStyle =
    textProperties['fontStyle'] ??
    textProperties['font-style'] ??
    textStyle['fontStyle'] ??
    textStyle['font-style'] ??
    leaf?.['fontStyle'] ??
    leaf?.['font-style'];
  const textAlign =
    textProperties['textAlign'] ??
    textProperties['text-align'] ??
    textStyle['textAlign'] ??
    textStyle['text-align'] ??
    leaf?.['textAlign'] ??
    leaf?.['text-align'];
  const verticalAlign =
    textProperties['verticalAlign'] ??
    textProperties['vertical-align'] ??
    textStyle['verticalAlign'] ??
    textStyle['vertical-align'] ??
    leaf?.['verticalAlign'] ??
    leaf?.['vertical-align'];
  const fontWeightNumber = toNumber(fontWeight);
  return {
    fontFamily:
      (textProperties['font-family'] as string) ||
      (textProperties.fontFamily as string) ||
      (textStyle['font-family'] as string) ||
      (textStyle.fontFamily as string) ||
      (leaf?.['font-family'] as string) ||
      (leaf?.fontFamily as string),
    fontSize:
      toNumber(textProperties['font-size']) ||
      toNumber(textProperties.fontSize) ||
      toNumber(textStyle['font-size']) ||
      toNumber(textStyle.fontSize) ||
      toNumber(leaf?.['font-size']) ||
      toNumber(leaf?.fontSize),
    color:
      (textProperties.color as string) ||
      (textProperties.fill as string) ||
      (textStyle.color as string) ||
      (textStyle.fill as string) ||
      (leaf?.color as string) ||
      (leaf?.fill as string),
    lineHeight:
      toNumber(textProperties['line-height']) ||
      toNumber(textStyle['line-height']) ||
      toNumber(leaf?.['line-height']),
    letterSpacing:
      toNumber(textProperties['letter-spacing']) ||
      toNumber(textStyle['letter-spacing']) ||
      toNumber(leaf?.['letter-spacing']),
    bold:
      (typeof fontWeight === 'string' && fontWeight.toLowerCase() === 'bold') ||
      (typeof fontWeightNumber === 'number' && fontWeightNumber >= 600),
    italic:
      (typeof fontStyle === 'string' && fontStyle.toLowerCase() === 'italic') ||
      false,
    align:
      typeof textAlign === 'string' &&
      ['left', 'center', 'right', 'justify'].includes(textAlign)
        ? (textAlign as 'left' | 'center' | 'right' | 'justify')
        : undefined,
    valign:
      typeof verticalAlign === 'string' &&
      ['top', 'middle', 'bottom'].includes(verticalAlign)
        ? (verticalAlign as 'top' | 'middle' | 'bottom')
        : undefined,
  };
};

const mapGeometryShape = (element: Record<string, unknown>) => {
  const shape = element.shape;
  if (shape === 'rectangle') {
    return typeof element.radius === 'number' && element.radius > 0
      ? 'roundRect'
      : 'rect';
  }
  if (shape === 'ellipse') {
    return 'ellipse';
  }
  if (shape === 'diamond') {
    return 'diamond';
  }
  if (shape === 'triangle') {
    return 'triangle';
  }
  if (shape === 'parallelogram') {
    return 'parallelogram';
  }
  return null;
};

const getExportPlacement = (
  board: PlaitBoard,
  element: PlaitElement
): ExportPlacement => {
  const rawElement = element as Record<string, unknown>;
  const frameRect = getElementFrameRectangle(element);
  const renderedRect = getElementRenderedRectangle(board, element);
  const text = extractTextContent(rawElement.text).trim();

  if (rawElement.type === 'image' && typeof rawElement.url === 'string') {
    return {
      mode: 'native-rect',
      rect: frameRect,
    };
  }

  if (rawElement.type === 'geometry') {
    if (rawElement.shape !== 'text' && text) {
      return {
        mode: 'fallback-image',
        rect: {
          x: renderedRect.x - FALLBACK_PADDING_PX,
          y: renderedRect.y - FALLBACK_PADDING_PX,
          width: renderedRect.width + FALLBACK_PADDING_PX * 2,
          height: renderedRect.height + FALLBACK_PADDING_PX * 2,
        },
      };
    }
    if (rawElement.shape === 'text' || mapGeometryShape(rawElement)) {
      return {
        mode: 'native-rect',
        rect: frameRect,
      };
    }
    return {
      mode: 'fallback-image',
      rect: {
        x: renderedRect.x - FALLBACK_PADDING_PX,
        y: renderedRect.y - FALLBACK_PADDING_PX,
        width: renderedRect.width + FALLBACK_PADDING_PX * 2,
        height: renderedRect.height + FALLBACK_PADDING_PX * 2,
      },
    };
  }

  if (rawElement.type === 'arrow-line' || rawElement.type === 'vector-line') {
    const points = Array.isArray(rawElement.points)
      ? (rawElement.points as [number, number][])
      : [];
    if (points.length === 2) {
      const [start, end] = points;
      return {
        mode: 'native-line',
        start,
        end,
        rect: {
          x: Math.min(start[0], end[0]),
          y: Math.min(start[1], end[1]),
          width: Math.max(1, Math.abs(end[0] - start[0])),
          height: Math.max(1, Math.abs(end[1] - start[1])),
        },
      };
    }
    return {
      mode: 'fallback-image',
      rect: {
        x: renderedRect.x - FALLBACK_PADDING_PX,
        y: renderedRect.y - FALLBACK_PADDING_PX,
        width: renderedRect.width + FALLBACK_PADDING_PX * 2,
        height: renderedRect.height + FALLBACK_PADDING_PX * 2,
      },
    };
  }

  return {
    mode: 'fallback-image',
    rect: {
      x: renderedRect.x - FALLBACK_PADDING_PX,
      y: renderedRect.y - FALLBACK_PADDING_PX,
      width: renderedRect.width + FALLBACK_PADDING_PX * 2,
      height: renderedRect.height + FALLBACK_PADDING_PX * 2,
    },
  };
};

const readBlobAsDataUrl = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('无法读取 PPTX 导出图片资源'));
    };
    reader.onerror = () => {
      reject(reader.error || new Error('无法读取 PPTX 导出图片资源'));
    };
    reader.readAsDataURL(blob);
  });
};

const addNativeText = (
  slide: any,
  element: Record<string, unknown>,
  rect: RectangleLike,
  transform: SlideTransform,
  text: string
) => {
  const textStyle = resolveTextStyle(element);
  const mappedRect = transformRect(rect, transform);
  slide.addText(text, {
    x: pxToInches(mappedRect.x),
    y: pxToInches(mappedRect.y),
    w: pxToInches(mappedRect.width),
    h: pxToInches(mappedRect.height),
    margin: 0,
    isTextBox: true,
    fit: 'shrink',
    color: normalizeHexColor(textStyle.color) || '111827',
    fontFace: textStyle.fontFamily,
    fontSize: pxToPoints((textStyle.fontSize || 16) * transform.scale),
    bold: textStyle.bold,
    italic: textStyle.italic,
    align: textStyle.align || (element.shape === 'text' ? 'left' : 'center'),
    valign: textStyle.valign || (element.shape === 'text' ? 'top' : 'middle'),
    rotate: toNumber(element.angle) || 0,
    ...(textStyle.lineHeight
      ? { lineSpacing: pxToPoints(textStyle.lineHeight * transform.scale) }
      : {}),
    ...(textStyle.letterSpacing
      ? { charSpacing: pxToPoints(textStyle.letterSpacing * transform.scale) }
      : {}),
  });
};

const addFallbackImage = async (
  board: PlaitBoard,
  slide: any,
  element: PlaitElement,
  renderedRect: RectangleLike,
  transform: SlideTransform
) => {
  const fallbackBlob = await exportBoardToRasterBlob(board, {
    elements: [element],
    fillStyle: 'transparent',
  });
  const data = await readBlobAsDataUrl(fallbackBlob);
  const mappedRect = transformRect(
    {
      x: renderedRect.x - FALLBACK_PADDING_PX,
      y: renderedRect.y - FALLBACK_PADDING_PX,
      width: renderedRect.width + FALLBACK_PADDING_PX * 2,
      height: renderedRect.height + FALLBACK_PADDING_PX * 2,
    },
    transform
  );
  slide.addImage({
    data,
    x: pxToInches(mappedRect.x),
    y: pxToInches(mappedRect.y),
    w: pxToInches(mappedRect.width),
    h: pxToInches(mappedRect.height),
  });
};

const addElementToSlide = async (
  board: PlaitBoard,
  slide: any,
  element: PlaitElement,
  transform: SlideTransform
) => {
  const rawElement = element as Record<string, unknown>;
  const placement = getExportPlacement(board, element);
  const frameRect =
    placement.mode === 'native-line' ? placement.rect : placement.rect;
  const mappedFrameRect = transformRect(frameRect, transform);

  if (rawElement.type === 'image' && typeof rawElement.url === 'string') {
    const imageData = await applyImageEraseMask(
      rawElement.url,
      rawElement.eraseMask as Parameters<typeof applyImageEraseMask>[1]
    );
    slide.addImage({
      data: imageData,
      x: pxToInches(mappedFrameRect.x),
      y: pxToInches(mappedFrameRect.y),
      w: pxToInches(mappedFrameRect.width),
      h: pxToInches(mappedFrameRect.height),
      sizing: {
        type: 'contain',
        w: pxToInches(mappedFrameRect.width),
        h: pxToInches(mappedFrameRect.height),
      },
      rotate: toNumber(rawElement.angle) || 0,
    });
    return;
  }

  if (rawElement.type === 'geometry') {
    const text = extractTextContent(rawElement.text).trim();
    if (placement.mode === 'fallback-image') {
      await addFallbackImage(
        board,
        slide,
        element,
        getElementRenderedRectangle(board, element),
        transform
      );
      return;
    }
    if (rawElement.shape === 'text') {
      if (text) {
        addNativeText(slide, rawElement, frameRect, transform, text);
      }
      return;
    }

    const shapeType = mapGeometryShape(rawElement);
    if (!shapeType) {
      await addFallbackImage(
        board,
        slide,
        element,
        getElementRenderedRectangle(board, element),
        transform
      );
      return;
    }

    slide.addShape(shapeType, {
      x: pxToInches(mappedFrameRect.x),
      y: pxToInches(mappedFrameRect.y),
      w: pxToInches(mappedFrameRect.width),
      h: pxToInches(mappedFrameRect.height),
      rotate: toNumber(rawElement.angle) || 0,
      fill: buildFillProps(
        rawElement.fill as string,
        toNumber(rawElement.opacity)
      ),
      line: buildLineProps(
        rawElement.strokeColor as string,
        toNumber(rawElement.strokeWidth),
        toNumber(rawElement.opacity),
        transform.scale
      ),
      ...(shapeType === 'roundRect' &&
      typeof rawElement.radius === 'number' &&
      rawElement.radius > 0
        ? {
            rectRadius: Math.max(
              0,
              Math.min(
                1,
                rawElement.radius /
                  Math.max(1, Math.min(frameRect.width, frameRect.height))
              )
            ),
          }
        : {}),
    } as any);

    if (text) {
      addNativeText(
        slide,
        rawElement,
        {
          x: frameRect.x + 4,
          y: frameRect.y + 4,
          width: Math.max(1, frameRect.width - 8),
          height: Math.max(1, frameRect.height - 8),
        },
        transform,
        text
      );
    }
    return;
  }

  if (rawElement.type === 'arrow-line' || rawElement.type === 'vector-line') {
    if (placement.mode !== 'native-line') {
      await addFallbackImage(
        board,
        slide,
        element,
        getElementRenderedRectangle(board, element),
        transform
      );
      return;
    }
    const { start, end } = placement;
    const mappedStart = transformPoint(start, transform);
    const mappedEnd = transformPoint(end, transform);
    const strokeStyle =
      (rawElement.strokeStyle as string) || (rawElement.lineStyle as string);
    slide.addShape('line', {
      x: pxToInches(Math.min(mappedStart[0], mappedEnd[0])),
      y: pxToInches(Math.min(mappedStart[1], mappedEnd[1])),
      w: pxToInches(Math.max(1, Math.abs(mappedEnd[0] - mappedStart[0]))),
      h: pxToInches(Math.max(1, Math.abs(mappedEnd[1] - mappedStart[1]))),
      flipH: mappedStart[0] > mappedEnd[0],
      flipV: mappedStart[1] > mappedEnd[1],
      line: buildLineProps(
        rawElement.strokeColor as string,
        toNumber(rawElement.strokeWidth),
        toNumber(rawElement.opacity),
        transform.scale,
        {
          dashType:
            strokeStyle === 'dashed'
              ? 'dash'
              : strokeStyle === 'dotted'
              ? 'sysDot'
              : 'solid',
          beginArrowType:
            rawElement.source &&
            typeof rawElement.source === 'object' &&
            (rawElement.source as Record<string, unknown>).marker === 'arrow'
              ? 'triangle'
              : 'none',
          endArrowType:
            rawElement.target &&
            typeof rawElement.target === 'object' &&
            (rawElement.target as Record<string, unknown>).marker === 'arrow'
              ? 'triangle'
              : 'none',
        }
      ),
    });
    return;
  }

  await addFallbackImage(
    board,
    slide,
    element,
    getElementRenderedRectangle(board, element),
    transform
  );
};

const getExportElements = (board: PlaitBoard) => {
  const selectedElements = getSelectedElements(board);
  return selectedElements.length > 0 ? selectedElements : board.children;
};

const getSlideBounds = (
  board: PlaitBoard,
  elements: PlaitElement[]
): RectangleLike => {
  if (elements.length === 0) {
    return {
      x: 0,
      y: 0,
      width: DEFAULT_SLIDE_WIDTH_PX,
      height: DEFAULT_SLIDE_HEIGHT_PX,
    };
  }
  const renderedBounds = getElementsRenderedRectangle(board, elements);
  const fallbackRectangles = elements
    .map((element) => getExportPlacement(board, element))
    .filter((placement) => placement.mode === 'fallback-image')
    .map((placement) => placement.rect);
  const rectangles = [
    ...(renderedBounds ? [renderedBounds] : []),
    ...fallbackRectangles,
  ];
  if (rectangles.length === 0) {
    rectangles.push(
      ...elements.map((element) => getExportPlacement(board, element).rect)
    );
  }
  if (rectangles.length === 0) {
    return {
      x: 0,
      y: 0,
      width: DEFAULT_SLIDE_WIDTH_PX,
      height: DEFAULT_SLIDE_HEIGHT_PX,
    };
  }
  const minX = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const minY = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const maxX = Math.max(
    ...rectangles.map((rectangle) => rectangle.x + rectangle.width)
  );
  const maxY = Math.max(
    ...rectangles.map((rectangle) => rectangle.y + rectangle.height)
  );
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const getDefaultName = () => `drawnix-${new Date().getTime()}`;

export const saveAsPptx = async (
  board: PlaitBoard,
  name: string = getDefaultName()
) => {
  const elements = getExportElements(board);
  const bounds = getSlideBounds(board, elements);
  const slideTransform = getSlideTransform(bounds);
  const pptx = new pptxgen();
  pptx.defineLayout({
    name: 'DRAWNIX_EXPORT',
    width: PPTX_SLIDE_WIDTH_IN,
    height: PPTX_SLIDE_HEIGHT_IN,
  });
  pptx.layout = 'DRAWNIX_EXPORT';
  const slide = pptx.addSlide();
  const backgroundColor = normalizeHexColor(getBackgroundColor(board));
  if (backgroundColor) {
    slide.background = { color: backgroundColor };
  }

  for (const element of elements) {
    await addElementToSlide(board, slide, element, slideTransform);
  }

  const blob = await pptx.write({
    outputType: 'blob',
    compression: true,
  });
  return fileSave(blob as Blob, {
    name,
    extension: 'pptx',
    description: 'PowerPoint presentation',
  });
};
