import { Alignment, PropertyTransforms } from '@plait/common';
import {
  getSelectedElements,
  isNullOrUndefined,
  Path,
  PlaitBoard,
  PlaitElement,
  Point,
  RectangleClient,
  Transforms,
} from '@plait/core';
import { getMemorizeKey } from '@plait/draw';
import {
  BasicShapes,
  isDrawElementsIncludeText,
  PlaitDrawElement,
} from '@plait/draw';
import {
  applyOpacityToHex,
  hexAlphaToOpacity,
  isFullyOpaque,
  isNoColor,
  isValidColor,
  removeHexAlpha,
} from '../utils/color';
import { MindElement } from '@plait/mind';
import {
  getCurrentFill,
  getCurrentStrokeColor,
  isClosedElement,
} from '../utils/property';
import { DEFAULT_FONT_SIZE, TextTransforms } from '@plait/text-plugins';
import {
  buildTextFragmentDataUrl,
  isTextFragmentMetadata,
} from '../scene-import/text-fragment';
import {
  normalizeFontFamilyStack,
  resolveFontFamilyForRole,
  type FontRoleFamilyConfig,
} from '../constants/font';

export const setFillColorOpacity = (board: PlaitBoard, fillOpacity: number) => {
  PropertyTransforms.setFillColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      if (!isClosedElement(board, element)) {
        return;
      }
      const currentFill = getCurrentFill(board, element);
      if (!currentFill || !isValidColor(currentFill)) {
        return;
      }
      const currentFillColor = removeHexAlpha(currentFill);
      const newFill = isFullyOpaque(fillOpacity)
        ? currentFillColor
        : applyOpacityToHex(currentFillColor, fillOpacity);
      Transforms.setNode(board, { fill: newFill }, path);
    },
  });
};

export const setFillColor = (board: PlaitBoard, fillColor: string) => {
  PropertyTransforms.setFillColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      if (!isClosedElement(board, element)) {
        return;
      }
      const currentFill = getCurrentFill(board, element);
      const currentOpacity =
        currentFill && !isNoColor(currentFill)
          ? hexAlphaToOpacity(currentFill)
          : 100;
      if (isNoColor(fillColor)) {
        Transforms.setNode(board, { fill: null }, path);
      } else {
        if (
          isNullOrUndefined(currentOpacity) ||
          isFullyOpaque(currentOpacity)
        ) {
          Transforms.setNode(board, { fill: fillColor }, path);
        } else {
          Transforms.setNode(
            board,
            { fill: applyOpacityToHex(fillColor, currentOpacity) },
            path
          );
        }
      }
    },
  });
};

export const setStrokeColorOpacity = (
  board: PlaitBoard,
  fillOpacity: number
) => {
  PropertyTransforms.setStrokeColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      const currentStrokeColor = getCurrentStrokeColor(board, element);
      if (!currentStrokeColor || !isValidColor(currentStrokeColor)) {
        return;
      }
      const currentStrokeColorValue = removeHexAlpha(currentStrokeColor);
      const newStrokeColor = isFullyOpaque(fillOpacity)
        ? currentStrokeColorValue
        : applyOpacityToHex(currentStrokeColorValue, fillOpacity);
      Transforms.setNode(board, { strokeColor: newStrokeColor }, path);
    },
  });
};

export const setStrokeColor = (board: PlaitBoard, newColor: string) => {
  PropertyTransforms.setStrokeColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      const currentStrokeColor = getCurrentStrokeColor(board, element);
      const currentOpacity =
        currentStrokeColor && !isNoColor(currentStrokeColor)
          ? hexAlphaToOpacity(currentStrokeColor)
          : 100;
      if (isNoColor(newColor)) {
        Transforms.setNode(board, { strokeColor: null }, path);
      } else {
        if (
          isNullOrUndefined(currentOpacity) ||
          isFullyOpaque(currentOpacity)
        ) {
          Transforms.setNode(board, { strokeColor: newColor }, path);
        } else {
          Transforms.setNode(
            board,
            { strokeColor: applyOpacityToHex(newColor, currentOpacity) },
            path
          );
        }
      }
    },
  });
};

export const setTextColor = (
  board: PlaitBoard,
  currentColor: string,
  newColor: string
) => {
  const currentOpacity = hexAlphaToOpacity(currentColor);
  if (isNoColor(newColor)) {
    TextTransforms.setTextColor(board, null);
  } else {
    TextTransforms.setTextColor(
      board,
      applyOpacityToHex(newColor, currentOpacity)
    );
  }
};

export const setTextColorOpacity = (
  board: PlaitBoard,
  currentColor: string,
  opacity: number
) => {
  const currentFontColorValue = removeHexAlpha(currentColor);
  const newFontColor = isFullyOpaque(opacity)
    ? currentFontColorValue
    : applyOpacityToHex(currentFontColorValue, opacity);
  TextTransforms.setTextColor(board, newFontColor);
};

export const setTextFontSize = (board: PlaitBoard, size: number) => {
  if (!Number.isFinite(size) || size <= 0) {
    return;
  }
  TextTransforms.setFontSize(board, String(size) as any, DEFAULT_FONT_SIZE);

  const selectedIds = new Set(
    getSelectedElements(board).map((element) => element.id)
  );
  const entries = collectBoardElementEntries(board.children).filter((entry) =>
    selectedIds.has(entry.element.id)
  );
  entries.forEach((entry) => applyFontSizePatch(board, entry, size));
};

export type DrawnixTextMark =
  | 'bold'
  | 'italic'
  | 'underlined'
  | 'strike'
  | 'superscript'
  | 'subscript';

export const toggleTextMark = (board: PlaitBoard, mark: DrawnixTextMark) => {
  TextTransforms.setTextMarks(board, mark as any);
};

export const setTextAlign = (board: PlaitBoard, align: Alignment) => {
  TextTransforms.setTextAlign(board, align);
};

export const setSelectedShape = (board: PlaitBoard, shape: string) => {
  if (!shape.trim()) {
    return;
  }

  getSelectedElements(board).forEach((element) => {
    if (
      !PlaitDrawElement.isShapeElement(element) ||
      PlaitDrawElement.isImage(element) ||
      PlaitDrawElement.isText(element)
    ) {
      return;
    }
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(board, { shape }, path);
  });
};

export const setStrokeWidth = (board: PlaitBoard, strokeWidth: number) => {
  if (!Number.isFinite(strokeWidth)) {
    return;
  }
  const nextStrokeWidth = Math.max(0, Math.round(strokeWidth));
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(board, { strokeWidth: nextStrokeWidth }, path);
  });
};

export const setElementOpacity = (board: PlaitBoard, opacity: number) => {
  if (!Number.isFinite(opacity)) {
    return;
  }
  const nextOpacity = Math.max(0, Math.min(1, opacity));
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(board, { opacity: nextOpacity }, path);
  });
};

export const setElementAngle = (board: PlaitBoard, angle: number) => {
  if (!Number.isFinite(angle)) {
    return;
  }
  const nextAngle = ((Math.round(angle) % 360) + 360) % 360;
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(board, { angle: nextAngle }, path);
  });
};

export const setElementShadow = (board: PlaitBoard, enabled: boolean) => {
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(
      board,
      {
        shadow: enabled
          ? {
              color: '#1118272E',
              offsetX: 0,
              offsetY: 8,
              blur: 18,
            }
          : null,
      },
      path
    );
  });
};

export const setElementShadowProperty = (
  board: PlaitBoard,
  key: 'color' | 'offsetX' | 'offsetY' | 'blur',
  value: string | number
) => {
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    const existingShadow =
      (element as Record<string, unknown>)['shadow'] &&
      typeof (element as Record<string, unknown>)['shadow'] === 'object'
        ? ((element as Record<string, unknown>)['shadow'] as Record<
            string,
            unknown
          >)
        : {};
    Transforms.setNode(
      board,
      {
        shadow: {
          color: '#1118272E',
          offsetX: 0,
          offsetY: 8,
          blur: 18,
          ...existingShadow,
          [key]:
            key === 'color'
              ? String(value)
              : key === 'blur'
              ? Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0)
              : Number.isFinite(Number(value))
              ? Number(value)
              : 0,
        },
      },
      path
    );
  });
};

export type DrawnixImageFill = {
  dataUrl: string;
  name?: string;
  mimeType?: string;
};

export type DrawnixElementGradient = {
  type: 'linear' | 'radial';
  angle: number;
  from: string;
  to: string;
};

const normalizeGradientAngle = (angle: number) => {
  return ((Math.round(angle) % 360) + 360) % 360;
};

export const setElementGradientPreset = (
  board: PlaitBoard,
  gradient: DrawnixElementGradient
) => {
  const nextGradient: DrawnixElementGradient = {
    ...gradient,
    angle: normalizeGradientAngle(gradient.angle),
  };
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(
      board,
      {
        gradient: { ...nextGradient },
        imageFill: null,
      },
      path
    );
  });
};

export const setElementGradient = (board: PlaitBoard, enabled: boolean) => {
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(
      board,
      {
        gradient: enabled
          ? {
              type: 'linear',
              angle: 90,
              from: '#ffffff',
              to: getCurrentFill(board, element) || '#dbeafe',
            }
          : null,
        imageFill: null,
      },
      path
    );
  });
};

export const setElementGradientType = (
  board: PlaitBoard,
  type: 'linear' | 'radial'
) => {
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    const existingGradient =
      (element as Record<string, unknown>)['gradient'] &&
      typeof (element as Record<string, unknown>)['gradient'] === 'object'
        ? ((element as Record<string, unknown>)['gradient'] as Record<
            string,
            unknown
          >)
        : {};
    Transforms.setNode(
      board,
      {
        gradient: {
          angle: 90,
          from: '#ffffff',
          to: getCurrentFill(board, element) || '#dbeafe',
          ...existingGradient,
          type,
        },
        imageFill: null,
      },
      path
    );
  });
};

export const setElementGradientColor = (
  board: PlaitBoard,
  key: 'from' | 'to',
  color: string
) => {
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    const existingGradient =
      (element as Record<string, unknown>)['gradient'] &&
      typeof (element as Record<string, unknown>)['gradient'] === 'object'
        ? ((element as Record<string, unknown>)['gradient'] as Record<
            string,
            unknown
          >)
        : {};
    Transforms.setNode(
      board,
      {
        gradient: {
          type: 'linear',
          angle: 90,
          from: '#ffffff',
          to: getCurrentFill(board, element) || '#dbeafe',
          ...existingGradient,
          [key]: color,
        },
        imageFill: null,
      },
      path
    );
  });
};

export const setElementGradientAngle = (board: PlaitBoard, angle: number) => {
  if (!Number.isFinite(angle)) {
    return;
  }
  const nextAngle = normalizeGradientAngle(angle);
  getSelectedElements(board).forEach((element) => {
    const path = PlaitBoard.findPath(board, element);
    const existingGradient =
      (element as Record<string, unknown>)['gradient'] &&
      typeof (element as Record<string, unknown>)['gradient'] === 'object'
        ? ((element as Record<string, unknown>)['gradient'] as Record<
            string,
            unknown
          >)
        : {};
    Transforms.setNode(
      board,
      {
        gradient: {
          type: 'linear',
          from: '#ffffff',
          to: getCurrentFill(board, element) || '#dbeafe',
          ...existingGradient,
          angle: nextAngle,
        },
        imageFill: null,
      },
      path
    );
  });
};

export const setElementImageFill = (
  board: PlaitBoard,
  imageFill: DrawnixImageFill | null
) => {
  getSelectedElements(board).forEach((element) => {
    if (!isClosedElement(board, element)) {
      return;
    }
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(
      board,
      {
        imageFill,
        gradient: null,
      },
      path
    );
  });
};

const getElementPoints = (element: PlaitElement) => {
  const points = (element as { points?: Point[] }).points;
  return Array.isArray(points) && points.length >= 2 ? points : null;
};

const getElementBounds = (element: PlaitElement) => {
  const points = getElementPoints(element);
  if (!points) {
    return null;
  }
  return RectangleClient.getRectangleByPoints(points);
};

export const setElementPosition = (
  board: PlaitBoard,
  position: Partial<{ x: number; y: number }>
) => {
  getSelectedElements(board).forEach((element) => {
    const bounds = getElementBounds(element);
    const points = getElementPoints(element);
    if (!bounds || !points) {
      return;
    }
    const deltaX =
      Number.isFinite(position.x) && position.x !== undefined
        ? position.x - bounds.x
        : 0;
    const deltaY =
      Number.isFinite(position.y) && position.y !== undefined
        ? position.y - bounds.y
        : 0;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(
      board,
      {
        points: points.map((point) => [point[0] + deltaX, point[1] + deltaY]),
      },
      path
    );
  });
};

export const setElementSize = (
  board: PlaitBoard,
  size: Partial<{ width: number; height: number }>,
  options: { lockAspectRatio?: boolean } = {}
) => {
  getSelectedElements(board).forEach((element) => {
    const bounds = getElementBounds(element);
    const points = getElementPoints(element);
    if (!bounds || !points) {
      return;
    }
    const nextWidth =
      Number.isFinite(size.width) && size.width !== undefined
        ? Math.max(1, size.width)
        : Math.abs(bounds.width || 1);
    const nextHeight =
      Number.isFinite(size.height) && size.height !== undefined
        ? Math.max(1, size.height)
        : Math.abs(bounds.height || 1);
    const currentWidth = Math.abs(bounds.width || 1);
    const currentHeight = Math.abs(bounds.height || 1);
    let scaleX = nextWidth / currentWidth;
    let scaleY = nextHeight / currentHeight;
    if (options.lockAspectRatio) {
      const lockedScale = Number.isFinite(size.width) ? scaleX : scaleY;
      scaleX = lockedScale;
      scaleY = lockedScale;
    }
    const path = PlaitBoard.findPath(board, element);
    Transforms.setNode(
      board,
      {
        points: points.map((point) => [
          bounds.x + (point[0] - bounds.x) * scaleX,
          bounds.y + (point[1] - bounds.y) * scaleY,
        ]),
      },
      path
    );
  });
};

export const setTextFontWeight = (
  board: PlaitBoard,
  fontWeight: string | number
) => {
  applyTextStylePatchToSelection(board, {
    textStyle: { fontWeight },
    textProperties: { fontWeight },
    leaf: { fontWeight },
    fragmentStyle: { fontWeight },
  });
};

export const setTextLineHeight = (board: PlaitBoard, lineHeight: number) => {
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return;
  }
  const normalized = Number(lineHeight.toFixed(2));
  applyTextStylePatchToSelection(board, {
    textStyle: { lineHeight: normalized, 'line-height': String(normalized) },
    textProperties: {
      lineHeight: normalized,
      'line-height': String(normalized),
    },
    leaf: { lineHeight: normalized, 'line-height': String(normalized) },
    fragmentStyle: { lineHeight: normalized },
  });
};

export const setTextLetterSpacing = (
  board: PlaitBoard,
  letterSpacing: number
) => {
  if (!Number.isFinite(letterSpacing)) {
    return;
  }
  const normalized = Math.max(
    -20,
    Math.min(80, Number(letterSpacing.toFixed(1)))
  );
  applyTextStylePatchToSelection(board, {
    textStyle: {
      letterSpacing: normalized,
      'letter-spacing': String(normalized),
    },
    textProperties: {
      letterSpacing: normalized,
      'letter-spacing': String(normalized),
    },
    leaf: {
      letterSpacing: normalized,
      'letter-spacing': String(normalized),
    },
    fragmentStyle: { letterSpacing: normalized },
  });
};

export const setTextScript = (
  board: PlaitBoard,
  script: 'normal' | 'superscript' | 'subscript'
) => {
  const baselineShift =
    script === 'superscript'
      ? 'super'
      : script === 'subscript'
      ? 'sub'
      : undefined;
  applyTextStylePatchToSelection(board, {
    textStyle: {
      verticalAlign: script === 'normal' ? undefined : script,
      baselineShift,
    },
    textProperties: {
      verticalAlign: script === 'normal' ? undefined : script,
      baselineShift,
    },
    leaf: {
      verticalAlign: script === 'normal' ? undefined : script,
      baselineShift,
    },
    fragmentStyle: { baselineShift },
  });
};

export const applyTextCase = (
  board: PlaitBoard,
  mode: 'uppercase' | 'lowercase' | 'capitalize'
) => {
  const selectedIds = new Set(
    getSelectedElements(board).map((element) => element.id)
  );
  const entries = collectBoardElementEntries(board.children).filter((entry) =>
    selectedIds.has(entry.element.id)
  );
  entries.forEach((entry) => applyTextCasePatch(board, entry, mode));
};

const isRectangleCornerRadiusElement = (element: PlaitElement) => {
  if (!PlaitDrawElement.isDrawElement(element)) {
    return false;
  }
  const shape = (element as { shape?: string }).shape;
  return (
    shape === BasicShapes.rectangle || shape === BasicShapes.roundRectangle
  );
};

const getRectangleCornerRadiusLimit = (element: PlaitElement) => {
  const points = (element as { points?: [number, number][] }).points;
  if (!Array.isArray(points) || points.length === 0) {
    return 0;
  }
  const rectangle = RectangleClient.getRectangleByPoints(points);
  const width = Math.abs(rectangle.width || 0);
  const height = Math.abs(rectangle.height || 0);
  const limit = Math.min(width, height) / 2;
  return Number.isFinite(limit) && limit > 0 ? limit : 0;
};

export const setRectangleCornerRadius = (board: PlaitBoard, radius: number) => {
  if (!Number.isFinite(radius)) {
    return;
  }

  getSelectedElements(board).forEach((element) => {
    if (!isRectangleCornerRadiusElement(element)) {
      return;
    }

    const path = PlaitBoard.findPath(board, element);
    const limit = getRectangleCornerRadiusLimit(element);
    const nextRadius = Math.min(limit, Math.max(0, radius));
    const nextShape =
      nextRadius > 0 ? BasicShapes.roundRectangle : BasicShapes.rectangle;

    Transforms.setNode(
      board,
      {
        shape: nextShape,
        radius: nextRadius,
      },
      path
    );
  });
};

type BoardElementEntry = {
  element: PlaitElement;
  path: Path;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

const collectBoardElementEntries = (
  elements: PlaitElement[],
  parentPath: Path = []
): BoardElementEntry[] => {
  return elements.flatMap((element, index) => {
    const path = [...parentPath, index];
    const children = Array.isArray(
      (element as Record<string, unknown>)['children']
    )
      ? collectBoardElementEntries(
          (element as Record<string, unknown>)['children'] as PlaitElement[],
          path
        )
      : [];
    return [{ element, path }, ...children];
  });
};

const patchTextLeavesFontFamily = (
  value: unknown,
  fontFamily: string
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => patchTextLeavesFontFamily(item, fontFamily));
  }
  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = { ...value };
  if (typeof next['text'] === 'string') {
    next['font-family'] = fontFamily;
    next['fontFamily'] = fontFamily;
    return next;
  }
  if (Array.isArray(next['children'])) {
    next['children'] = (next['children'] as unknown[]).map((child) =>
      patchTextLeavesFontFamily(child, fontFamily)
    );
  }
  return next;
};

const patchTextLeavesFontSize = (value: unknown, fontSize: number): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => patchTextLeavesFontSize(item, fontSize));
  }
  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = { ...value };
  if (typeof next['text'] === 'string') {
    next['font-size'] = String(fontSize);
    return next;
  }
  if (Array.isArray(next['children'])) {
    next['children'] = (next['children'] as unknown[]).map((child) =>
      patchTextLeavesFontSize(child, fontSize)
    );
  }
  return next;
};

const patchTextLeavesStyle = (
  value: unknown,
  patch: Record<string, unknown>
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => patchTextLeavesStyle(item, patch));
  }
  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = { ...value };
  if (typeof next['text'] === 'string') {
    Object.entries(patch).forEach(([key, patchValue]) => {
      if (patchValue === undefined) {
        delete next[key];
      } else {
        next[key] = patchValue;
      }
    });
    return next;
  }
  if (Array.isArray(next['children'])) {
    next['children'] = (next['children'] as unknown[]).map((child) =>
      patchTextLeavesStyle(child, patch)
    );
  }
  return next;
};

const transformTextLeaves = (
  value: unknown,
  transformText: (text: string) => string
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => transformTextLeaves(item, transformText));
  }
  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = { ...value };
  if (typeof next['text'] === 'string') {
    next['text'] = transformText(next['text']);
    return next;
  }
  if (Array.isArray(next['children'])) {
    next['children'] = (next['children'] as unknown[]).map((child) =>
      transformTextLeaves(child, transformText)
    );
  }
  return next;
};

const applyRecordPatch = (
  value: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> => {
  const next = isRecord(value) ? { ...value } : {};
  Object.entries(patch).forEach(([key, patchValue]) => {
    if (patchValue === undefined) {
      delete next[key];
    } else {
      next[key] = patchValue;
    }
  });
  return next;
};

type TextStylePatch = {
  textStyle?: Record<string, unknown>;
  textProperties?: Record<string, unknown>;
  leaf?: Record<string, unknown>;
  fragmentStyle?: Record<string, unknown>;
};

const applyTextStylePatchToSelection = (
  board: PlaitBoard,
  patch: TextStylePatch
) => {
  const selectedIds = new Set(
    getSelectedElements(board).map((element) => element.id)
  );
  const entries = collectBoardElementEntries(board.children).filter((entry) =>
    selectedIds.has(entry.element.id)
  );
  entries.forEach((entry) => applyTextStylePatch(board, entry, patch));
};

const applyTextStylePatch = (
  board: PlaitBoard,
  entry: BoardElementEntry,
  patch: TextStylePatch
) => {
  const rawElement = entry.element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata) && patch.fragmentStyle) {
    const nextMetadata = {
      ...fragmentMetadata,
      style: applyRecordPatch(fragmentMetadata.style, patch.fragmentStyle),
      runs: fragmentMetadata.runs?.map((run) => ({
        ...run,
        style: applyRecordPatch(
          run.style,
          patch.fragmentStyle as Record<string, unknown>
        ),
      })),
    };
    Transforms.setNode(
      board,
      {
        url: buildTextFragmentDataUrl(nextMetadata),
        sceneImportMetadata: nextMetadata,
      },
      entry.path
    );
    return;
  }

  if (!supportsTextFontFamily(board, entry.element)) {
    return;
  }

  const nodePatch: Record<string, unknown> = {};
  if (patch.textStyle) {
    nodePatch['textStyle'] = applyRecordPatch(
      rawElement['textStyle'],
      patch.textStyle
    );
  }
  if (patch.textProperties) {
    nodePatch['textProperties'] = applyRecordPatch(
      rawElement['textProperties'],
      patch.textProperties
    );
  }
  if (patch.leaf && rawElement['text']) {
    nodePatch['text'] = patchTextLeavesStyle(rawElement['text'], patch.leaf);
  }
  if (Object.keys(nodePatch).length > 0) {
    Transforms.setNode(board, nodePatch, entry.path);
  }
};

const transformTextCase = (
  text: string,
  mode: 'uppercase' | 'lowercase' | 'capitalize'
) => {
  if (mode === 'uppercase') {
    return text.toLocaleUpperCase();
  }
  if (mode === 'lowercase') {
    return text.toLocaleLowerCase();
  }
  return text.replace(/(^|\s)(\S)/g, (match) => match.toLocaleUpperCase());
};

const applyTextCasePatch = (
  board: PlaitBoard,
  entry: BoardElementEntry,
  mode: 'uppercase' | 'lowercase' | 'capitalize'
) => {
  const rawElement = entry.element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata)) {
    const transform = (text: string) => transformTextCase(text, mode);
    const nextMetadata = {
      ...fragmentMetadata,
      sourceText: transform(fragmentMetadata.sourceText),
      text: transform(fragmentMetadata.text),
      runs: fragmentMetadata.runs?.map((run) => ({
        ...run,
        text: transform(run.text),
      })),
    };
    Transforms.setNode(
      board,
      {
        url: buildTextFragmentDataUrl(nextMetadata),
        sceneImportMetadata: nextMetadata,
      },
      entry.path
    );
    return;
  }

  if (!supportsTextFontFamily(board, entry.element) || !rawElement['text']) {
    return;
  }
  Transforms.setNode(
    board,
    {
      text: transformTextLeaves(rawElement['text'], (text) =>
        transformTextCase(text, mode)
      ),
    },
    entry.path
  );
};

const applyFontSizePatch = (
  board: PlaitBoard,
  entry: BoardElementEntry,
  fontSize: number
) => {
  const nextSize = Math.max(1, Math.round(fontSize));
  const rawElement = entry.element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata)) {
    const nextMetadata = {
      ...fragmentMetadata,
      style: {
        ...fragmentMetadata.style,
        fontSize: nextSize,
      },
      runs: fragmentMetadata.runs?.map((run) => ({
        ...run,
        style: {
          ...run.style,
          fontSize: nextSize,
        },
      })),
    };
    Transforms.setNode(
      board,
      {
        url: buildTextFragmentDataUrl(nextMetadata),
        sceneImportMetadata: nextMetadata,
      },
      entry.path
    );
    return;
  }

  if (!supportsTextFontFamily(board, entry.element)) {
    return;
  }

  const existingTextStyle =
    rawElement['textStyle'] && typeof rawElement['textStyle'] === 'object'
      ? (rawElement['textStyle'] as Record<string, unknown>)
      : {};
  const existingTextProperties =
    rawElement['textProperties'] &&
    typeof rawElement['textProperties'] === 'object'
      ? (rawElement['textProperties'] as Record<string, unknown>)
      : {};
  const patch: Record<string, unknown> = {
    textStyle: {
      ...existingTextStyle,
      fontSize: nextSize,
      'font-size': String(nextSize),
    },
    textProperties: {
      ...existingTextProperties,
      'font-size': String(nextSize),
    },
  };

  if (rawElement['text']) {
    patch['text'] = patchTextLeavesFontSize(rawElement['text'], nextSize);
  }

  Transforms.setNode(board, patch, entry.path);
};

const getElementTextRole = (element: PlaitElement) => {
  const rawElement = element as Record<string, unknown>;
  const svgImportMetadata = rawElement['svgImportMetadata'];
  if (
    isRecord(svgImportMetadata) &&
    typeof svgImportMetadata['textRole'] === 'string' &&
    svgImportMetadata['textRole'].trim()
  ) {
    return svgImportMetadata['textRole'] as string;
  }
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata) && fragmentMetadata.textRole) {
    return fragmentMetadata.textRole;
  }
  return 'plain';
};

const buildTextStyleFontFamilyPatch = (
  existingTextStyle: Record<string, unknown>,
  fontFamily: string
) => {
  return {
    ...existingTextStyle,
    fontFamily,
    'font-family': fontFamily,
  };
};

const buildTextPropertiesFontFamilyPatch = (
  existingTextProperties: Record<string, unknown>,
  fontFamily: string
) => {
  return {
    ...existingTextProperties,
    fontFamily,
    'font-family': fontFamily,
  };
};

const applyFontFamilyPatch = (
  board: PlaitBoard,
  entry: BoardElementEntry,
  fontFamily: string
) => {
  const normalized = normalizeFontFamilyStack(fontFamily);
  if (!normalized) {
    return;
  }

  const rawElement = entry.element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata)) {
    const nextMetadata = {
      ...fragmentMetadata,
      style: {
        ...fragmentMetadata.style,
        fontFamily: normalized,
      },
    };
    Transforms.setNode(
      board,
      {
        url: buildTextFragmentDataUrl(nextMetadata, {
          fontFamily: normalized,
        }),
        sceneImportMetadata: nextMetadata,
      },
      entry.path
    );
    return;
  }

  if (!supportsTextFontFamily(board, entry.element)) {
    return;
  }

  const existingTextStyle =
    rawElement['textStyle'] && typeof rawElement['textStyle'] === 'object'
      ? (rawElement['textStyle'] as Record<string, unknown>)
      : {};
  const patch: Record<string, unknown> = {
    textStyle: buildTextStyleFontFamilyPatch(existingTextStyle, normalized),
  };
  const existingTextProperties =
    rawElement['textProperties'] &&
    typeof rawElement['textProperties'] === 'object'
      ? (rawElement['textProperties'] as Record<string, unknown>)
      : {};
  patch['textProperties'] = buildTextPropertiesFontFamilyPatch(
    existingTextProperties,
    normalized
  );

  if (rawElement['text']) {
    patch['text'] = patchTextLeavesFontFamily(rawElement['text'], normalized);
  }

  Transforms.setNode(board, patch, entry.path);
};

const applyFontFamilyToEntries = (
  board: PlaitBoard,
  entries: BoardElementEntry[],
  resolveFontFamily: (entry: BoardElementEntry) => string | undefined
) => {
  for (const entry of entries) {
    const fontFamily = resolveFontFamily(entry);
    if (!fontFamily) {
      continue;
    }
    applyFontFamilyPatch(board, entry, fontFamily);
  }
};

export const setTextFontFamily = (board: PlaitBoard, fontFamily: string) => {
  const normalized = fontFamily.trim();
  if (!normalized) {
    return;
  }

  const maybeSetFontFamily = (TextTransforms as any).setFontFamily;
  if (typeof maybeSetFontFamily === 'function') {
    maybeSetFontFamily(board, normalized);
  }

  const selectedIds = new Set(
    getSelectedElements(board).map((element) => element.id)
  );
  const entries = collectBoardElementEntries(board.children).filter((entry) =>
    selectedIds.has(entry.element.id)
  );
  applyFontFamilyToEntries(board, entries, () => normalized);
};

export const applyFontSchemeToCanvas = (
  board: PlaitBoard,
  scheme: FontRoleFamilyConfig
) => {
  const entries = collectBoardElementEntries(board.children).filter((entry) => {
    const rawElement = entry.element as Record<string, unknown>;
    return (
      supportsTextFontFamily(board, entry.element) ||
      isTextFragmentMetadata(rawElement['sceneImportMetadata'])
    );
  });

  applyFontFamilyToEntries(board, entries, (entry) => {
    const textRole = getElementTextRole(entry.element);
    const configured =
      scheme[textRole as keyof FontRoleFamilyConfig] ||
      scheme.plain ||
      resolveFontFamilyForRole(textRole);
    return configured ? normalizeFontFamilyStack(configured) : undefined;
  });
};

const supportsTextFontFamily = (board: PlaitBoard, element: PlaitElement) => {
  if (MindElement.isMindElement(board, element)) {
    return true;
  }
  if (PlaitDrawElement.isDrawElement(element)) {
    return isDrawElementsIncludeText([element]);
  }
  const fragmentMetadata = (element as any)?.sceneImportMetadata;
  if (isTextFragmentMetadata(fragmentMetadata)) {
    return true;
  }
  return false;
};
