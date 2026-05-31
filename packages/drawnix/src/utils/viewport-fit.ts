import {
  BoardTransforms,
  getViewportOrigination,
  MAX_ZOOM,
  MIN_ZOOM,
  PlaitBoard,
  PlaitElement,
  Point,
  RectangleClient,
} from '@plait/core';

export type ViewportFocusOptions = {
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
  duration?: number;
};

const DEFAULT_PADDING = 96;
const DEFAULT_MIN_ZOOM = 0.25;
const DEFAULT_MAX_ZOOM = 1.2;
const DEFAULT_DURATION = 320;

export const IMPORT_VIEWPORT_FOCUS_OPTIONS: ViewportFocusOptions = {
  padding: DEFAULT_PADDING,
  minZoom: DEFAULT_MIN_ZOOM,
  maxZoom: DEFAULT_MAX_ZOOM,
  duration: DEFAULT_DURATION,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const isReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const normalizeOptions = (options?: ViewportFocusOptions) => {
  const padding = options?.padding ?? DEFAULT_PADDING;
  const minZoom = options?.minZoom ?? DEFAULT_MIN_ZOOM;
  const maxZoom = options?.maxZoom ?? DEFAULT_MAX_ZOOM;
  const duration = options?.duration ?? DEFAULT_DURATION;
  return {
    padding: Math.max(0, padding),
    minZoom: Math.max(0.01, minZoom),
    maxZoom: Math.max(0.01, maxZoom),
    duration: Math.max(0, duration),
  };
};

const getElementRectangles = (elements: PlaitElement[]): RectangleClient[] => {
  return elements.flatMap((element) => {
    const children = Array.isArray(element.children)
      ? getElementRectangles(element.children as PlaitElement[])
      : [];
    const points = (element as { points?: Point[] }).points;
    if (!Array.isArray(points) || points.length < 2) {
      return children;
    }
    return [RectangleClient.getRectangleByPoints(points), ...children];
  });
};

export const getElementsRectangle = (
  elements: PlaitElement[]
): RectangleClient | null => {
  const rectangles = getElementRectangles(elements);
  return rectangles.length
    ? RectangleClient.getBoundingRectangle(rectangles)
    : null;
};

export const getTargetViewportForRectangle = (
  board: PlaitBoard,
  rectangle: RectangleClient,
  options?: ViewportFocusOptions
) => {
  const normalized = normalizeOptions(options);
  const container = PlaitBoard.getBoardContainer(board);
  const width =
    container.clientWidth || container.getBoundingClientRect().width;
  const height =
    container.clientHeight || container.getBoundingClientRect().height;
  if (!width || !height || rectangle.width <= 0 || rectangle.height <= 0) {
    return null;
  }

  const availableWidth = Math.max(1, width - normalized.padding * 2);
  const availableHeight = Math.max(1, height - normalized.padding * 2);
  const fitZoom = Math.min(
    availableWidth / rectangle.width,
    availableHeight / rectangle.height
  );
  const zoom = clamp(
    fitZoom,
    Math.max(MIN_ZOOM, normalized.minZoom),
    Math.min(MAX_ZOOM, normalized.maxZoom)
  );
  const centerX = rectangle.x + rectangle.width / 2;
  const centerY = rectangle.y + rectangle.height / 2;
  return {
    zoom,
    origination: [
      centerX - width / 2 / zoom,
      centerY - height / 2 / zoom,
    ] as Point,
    fitZoom,
  };
};

export const focusViewportOnRectangle = (
  board: PlaitBoard,
  rectangle: RectangleClient | null,
  options?: ViewportFocusOptions
) => {
  if (!rectangle) {
    return;
  }
  const normalized = normalizeOptions(options);
  const target = getTargetViewportForRectangle(board, rectangle, normalized);
  if (!target) {
    return;
  }

  const startOrigination = getViewportOrigination(board) || [0, 0];
  const startZoom = board.viewport.zoom || 1;

  if (
    normalized.duration <= 0 ||
    isReducedMotion() ||
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    BoardTransforms.updateViewport(board, target.origination, target.zoom);
    return;
  }

  const startedAt = performance.now();
  const step = (timestamp: number) => {
    const progress = clamp((timestamp - startedAt) / normalized.duration, 0, 1);
    const eased = easeOutCubic(progress);
    const nextOrigination = [
      startOrigination[0] +
        (target.origination[0] - startOrigination[0]) * eased,
      startOrigination[1] +
        (target.origination[1] - startOrigination[1]) * eased,
    ] as Point;
    const nextZoom = startZoom + (target.zoom - startZoom) * eased;
    BoardTransforms.updateViewport(board, nextOrigination, nextZoom);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
};

export const focusViewportOnElements = (
  board: PlaitBoard,
  elements: PlaitElement[],
  options?: ViewportFocusOptions
) => {
  focusViewportOnRectangle(board, getElementsRectangle(elements), options);
};

export const getBoardCenterPoint = (board: PlaitBoard): Point => {
  try {
    const boardContainerRect =
      PlaitBoard.getBoardContainer(board).getBoundingClientRect();
    const zoom = board.viewport.zoom || 1;
    const origination = getViewportOrigination(board);
    return [
      (origination?.[0] || 0) + boardContainerRect.width / 2 / zoom,
      (origination?.[1] || 0) + boardContainerRect.height / 2 / zoom,
    ];
  } catch {
    return [0, 0];
  }
};
