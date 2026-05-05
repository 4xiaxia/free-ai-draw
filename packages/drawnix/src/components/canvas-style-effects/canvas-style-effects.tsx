import React, { useEffect } from 'react';
import { PlaitElement } from '@plait/core';
import { useBoard } from '@plait-board/react-board';

type DrawnixShadow = {
  color?: string;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
};

type DrawnixGradient = {
  type?: 'linear' | 'radial';
  angle?: number;
  from?: string;
  to?: string;
};

type DrawnixImageFill = {
  dataUrl?: string;
};

const SHADOW_FILTER_ATTR = 'data-drawnix-original-filter';
const GRADIENT_MARK_ATTR = 'data-drawnix-gradient-fill';
const GRADIENT_ORIGINAL_FILL_ATTR = 'data-drawnix-original-fill';
const GRADIENT_DEF_ATTR = 'data-drawnix-canvas-gradient';
const GRADIENT_DEFS_ATTR = 'data-drawnix-canvas-effects-defs';
const IMAGE_FILL_DEF_ATTR = 'data-drawnix-canvas-image-fill';
const GRADIENT_TARGET_SELECTOR =
  'path, rect, circle, ellipse, polygon, polyline';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object';
};

const toFiniteNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const buildShadowFilter = (shadow: unknown) => {
  if (!isRecord(shadow)) {
    return '';
  }
  const color =
    typeof shadow['color'] === 'string' && shadow['color'].trim()
      ? shadow['color']
      : '#1118272E';
  const offsetX = toFiniteNumber(shadow['offsetX'], 0);
  const offsetY = toFiniteNumber(shadow['offsetY'], 8);
  const blur = Math.max(0, toFiniteNumber(shadow['blur'], 18));
  return `drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${color})`;
};

const normalizeColor = (value: unknown, fallback: string) => {
  return typeof value === 'string' && value.trim() ? value : fallback;
};

const getGradientSpec = (
  gradient: unknown,
  fallbackFill: unknown
): Required<DrawnixGradient> | null => {
  if (!isRecord(gradient)) {
    return null;
  }
  return {
    type: gradient['type'] === 'radial' ? 'radial' : 'linear',
    angle: toFiniteNumber(gradient['angle'], 90),
    from: normalizeColor(gradient['from'], '#ffffff'),
    to: normalizeColor(gradient['to'], normalizeColor(fallbackFill, '#dbeafe')),
  };
};

const getGradientId = (elementId: string) => {
  const safeId = elementId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `drawnix-gradient-${safeId}`;
};

const getImageFillId = (elementId: string) => {
  const safeId = elementId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `drawnix-image-fill-${safeId}`;
};

const ensureDefs = (svg: SVGSVGElement) => {
  const existing = svg.querySelector<SVGDefsElement>(
    `defs[${GRADIENT_DEFS_ATTR}="true"]`
  );
  if (existing) {
    return existing;
  }
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.setAttribute(GRADIENT_DEFS_ATTR, 'true');
  svg.insertBefore(defs, svg.firstChild);
  return defs;
};

const getOrCreateGradient = (
  svg: SVGSVGElement,
  elementId: string,
  spec: Required<DrawnixGradient>
) => {
  const defs = ensureDefs(svg);
  const gradientId = getGradientId(elementId);
  let gradient = Array.from(
    defs.querySelectorAll<SVGGradientElement>(`[${GRADIENT_DEF_ATTR}]`)
  ).find((item) => item.getAttribute(GRADIENT_DEF_ATTR) === elementId);

  if (gradient && gradient.tagName.toLowerCase() !== `${spec.type}gradient`) {
    gradient.remove();
    gradient = undefined;
  }

  if (!gradient) {
    gradient = document.createElementNS(
      'http://www.w3.org/2000/svg',
      `${spec.type}Gradient`
    ) as SVGGradientElement;
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute(GRADIENT_DEF_ATTR, elementId);
    defs.appendChild(gradient);
  }

  gradient.setAttribute('id', gradientId);
  gradient.setAttribute('gradientUnits', 'objectBoundingBox');
  if (spec.type === 'linear') {
    const radians = ((spec.angle - 90) * Math.PI) / 180;
    const x = Math.cos(radians);
    const y = Math.sin(radians);
    gradient.setAttribute('x1', String(0.5 - x / 2));
    gradient.setAttribute('y1', String(0.5 - y / 2));
    gradient.setAttribute('x2', String(0.5 + x / 2));
    gradient.setAttribute('y2', String(0.5 + y / 2));
  } else {
    gradient.setAttribute('cx', '0.5');
    gradient.setAttribute('cy', '0.5');
    gradient.setAttribute('r', '0.72');
  }
  gradient.innerHTML = '';
  const firstStop = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'stop'
  );
  firstStop.setAttribute('offset', '0%');
  firstStop.setAttribute('stop-color', spec.from);
  const lastStop = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'stop'
  );
  lastStop.setAttribute('offset', '100%');
  lastStop.setAttribute('stop-color', spec.to);
  gradient.append(firstStop, lastStop);
  return gradientId;
};

const getGradientTargets = (group: SVGGElement) => {
  return Array.from(
    group.querySelectorAll<SVGElement>(GRADIENT_TARGET_SELECTOR)
  ).filter((target) => target.getAttribute('fill') !== 'none');
};

const restoreGradientTargets = (group: SVGGElement) => {
  getGradientTargets(group).forEach((target) => {
    if (target.getAttribute(GRADIENT_MARK_ATTR) !== 'true') {
      return;
    }
    const originalFill = target.getAttribute(GRADIENT_ORIGINAL_FILL_ATTR);
    if (originalFill) {
      target.setAttribute('fill', originalFill);
    } else {
      target.removeAttribute('fill');
    }
    target.removeAttribute(GRADIENT_MARK_ATTR);
    target.removeAttribute(GRADIENT_ORIGINAL_FILL_ATTR);
  });
};

const applyGradientTargets = (group: SVGGElement, gradientId: string) => {
  getGradientTargets(group).forEach((target) => {
    if (target.getAttribute(GRADIENT_MARK_ATTR) !== 'true') {
      target.setAttribute(
        GRADIENT_ORIGINAL_FILL_ATTR,
        target.getAttribute('fill') || ''
      );
    }
    target.setAttribute(GRADIENT_MARK_ATTR, 'true');
    target.setAttribute('fill', `url(#${gradientId})`);
  });
};

const getImageFillSpec = (imageFill: unknown): DrawnixImageFill | null => {
  if (!isRecord(imageFill) || typeof imageFill['dataUrl'] !== 'string') {
    return null;
  }
  return { dataUrl: imageFill['dataUrl'] };
};

const getOrCreateImageFillPattern = (
  svg: SVGSVGElement,
  elementId: string,
  spec: DrawnixImageFill
) => {
  const defs = ensureDefs(svg);
  const patternId = getImageFillId(elementId);
  let pattern = Array.from(
    defs.querySelectorAll<SVGPatternElement>(`[${IMAGE_FILL_DEF_ATTR}]`)
  ).find((item) => item.getAttribute(IMAGE_FILL_DEF_ATTR) === elementId);

  if (!pattern) {
    pattern = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'pattern'
    ) as SVGPatternElement;
    pattern.setAttribute(IMAGE_FILL_DEF_ATTR, elementId);
    defs.appendChild(pattern);
  }

  pattern.setAttribute('id', patternId);
  pattern.setAttribute('patternUnits', 'objectBoundingBox');
  pattern.setAttribute('width', '1');
  pattern.setAttribute('height', '1');
  pattern.innerHTML = '';

  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', '1');
  image.setAttribute('height', '1');
  image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', spec.dataUrl || '');
  pattern.appendChild(image);
  return patternId;
};

const applyImageFillTargets = (group: SVGGElement, patternId: string) => {
  getGradientTargets(group).forEach((target) => {
    if (target.getAttribute(GRADIENT_MARK_ATTR) !== 'true') {
      target.setAttribute(
        GRADIENT_ORIGINAL_FILL_ATTR,
        target.getAttribute('fill') || ''
      );
    }
    target.setAttribute(GRADIENT_MARK_ATTR, 'true');
    target.setAttribute('fill', `url(#${patternId})`);
  });
};

const cleanupUnusedGradients = (
  svg: SVGSVGElement,
  activeGradientElementIds: Set<string>,
  activeImageFillElementIds: Set<string>
) => {
  svg
    .querySelectorAll<SVGGradientElement>(`[${GRADIENT_DEF_ATTR}]`)
    .forEach((gradient) => {
      const elementId = gradient.getAttribute(GRADIENT_DEF_ATTR);
      if (!elementId || !activeGradientElementIds.has(elementId)) {
        gradient.remove();
      }
    });
  svg
    .querySelectorAll<SVGPatternElement>(`[${IMAGE_FILL_DEF_ATTR}]`)
    .forEach((pattern) => {
      const elementId = pattern.getAttribute(IMAGE_FILL_DEF_ATTR);
      if (!elementId || !activeImageFillElementIds.has(elementId)) {
        pattern.remove();
      }
    });
};

const syncElementStyleEffects = (
  element: PlaitElement,
  activeGradientElementIds: Set<string>,
  activeImageFillElementIds: Set<string>
) => {
  if (!PlaitElement.hasMounted(element)) {
    return;
  }

  const group = PlaitElement.getElementG(element);
  const rawElement = element as Record<string, unknown>;
  const shadowFilter = buildShadowFilter(rawElement['shadow']);
  if (shadowFilter) {
    if (!group.hasAttribute(SHADOW_FILTER_ATTR)) {
      group.setAttribute(SHADOW_FILTER_ATTR, group.style.filter || '');
    }
    group.style.filter = shadowFilter;
  } else if (group.hasAttribute(SHADOW_FILTER_ATTR)) {
    group.style.filter = group.getAttribute(SHADOW_FILTER_ATTR) || '';
    group.removeAttribute(SHADOW_FILTER_ATTR);
  }

  const imageFillSpec = getImageFillSpec(rawElement['imageFill']);
  const gradientSpec = getGradientSpec(rawElement['gradient'], rawElement['fill']);
  const svg = group.ownerSVGElement;
  if (imageFillSpec && svg) {
    const patternId = getOrCreateImageFillPattern(svg, element.id, imageFillSpec);
    applyImageFillTargets(group, patternId);
    activeImageFillElementIds.add(element.id);
  } else if (gradientSpec && svg) {
    const gradientId = getOrCreateGradient(svg, element.id, gradientSpec);
    applyGradientTargets(group, gradientId);
    activeGradientElementIds.add(element.id);
  } else {
    restoreGradientTargets(group);
  }
};

const visitElements = (
  elements: PlaitElement[],
  activeGradientElementIds: Set<string>,
  activeImageFillElementIds: Set<string>
) => {
  elements.forEach((element) => {
    syncElementStyleEffects(
      element,
      activeGradientElementIds,
      activeImageFillElementIds
    );
    if (element.children?.length) {
      visitElements(
        element.children,
        activeGradientElementIds,
        activeImageFillElementIds
      );
    }
  });
};

export const syncCanvasStyleEffects = (elements: PlaitElement[]) => {
  const activeGradientElementIds = new Set<string>();
  const activeImageFillElementIds = new Set<string>();
  visitElements(elements, activeGradientElementIds, activeImageFillElementIds);
  const firstMountedElement = elements.find((element) =>
    PlaitElement.hasMounted(element)
  );
  const svg = firstMountedElement
    ? PlaitElement.getElementG(firstMountedElement).ownerSVGElement
    : null;
  if (svg) {
    cleanupUnusedGradients(svg, activeGradientElementIds, activeImageFillElementIds);
  }
};

export const CanvasStyleEffects: React.FC = () => {
  const board = useBoard();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncCanvasStyleEffects(board.children);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [board, board.children, board.selection, board.viewport]);

  return null;
};
