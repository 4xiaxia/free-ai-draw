import { PlaitElement } from '@plait/core';
import {
  buildShadowFilter,
  syncCanvasStyleEffects,
} from './canvas-style-effects';

const mockGroups = new Map<string, SVGGElement>();

jest.mock('@plait/core', () => ({
  PlaitElement: {
    hasMounted: (element: { id: string }) => mockGroups.has(element.id),
    getElementG: (element: { id: string }) => mockGroups.get(element.id),
  },
}));

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => ({
    children: [],
    selection: null,
    viewport: null,
  }),
}));

const createMountedElement = (element: PlaitElement) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', String((element as any).fill || '#ffffff'));
  group.appendChild(path);
  svg.appendChild(group);
  mockGroups.set(element.id, group);
  return { group, path, svg };
};

describe('canvas style effects', () => {
  beforeEach(() => {
    mockGroups.clear();
  });

  it('builds a stable CSS drop-shadow filter from element data', () => {
    expect(
      buildShadowFilter({
        color: 'rgba(15, 23, 42, 0.18)',
        offsetX: 2,
        offsetY: 6,
        blur: 12,
      })
    ).toBe('drop-shadow(2px 6px 12px rgba(15, 23, 42, 0.18))');
  });

  it('applies and restores shadow filters on mounted element groups', () => {
    const element = {
      id: 'shape-a',
      shadow: { color: '#111827', offsetX: 0, offsetY: 8, blur: 18 },
    } as PlaitElement;
    const { group } = createMountedElement(element);

    syncCanvasStyleEffects([element]);
    expect(group.style.filter).toBe('drop-shadow(0px 8px 18px #111827)');

    delete (element as any).shadow;
    syncCanvasStyleEffects([element]);
    expect(group.style.filter).toBe('');
  });

  it('applies and removes svg gradients without losing the original fill', () => {
    const element = {
      id: 'shape-b',
      fill: '#2563eb',
      gradient: {
        type: 'linear',
        angle: 90,
        from: '#ffffff',
        to: '#2563eb',
      },
    } as PlaitElement;
    const { path, svg } = createMountedElement(element);

    syncCanvasStyleEffects([element]);
    expect(path.getAttribute('fill')).toBe('url(#drawnix-gradient-shape-b)');
    expect(svg.querySelector('linearGradient')).toBeTruthy();

    delete (element as any).gradient;
    syncCanvasStyleEffects([element]);
    expect(path.getAttribute('fill')).toBe('#2563eb');
    expect(svg.querySelector('linearGradient')).toBeFalsy();
  });

  it('renders radial gradient definitions when requested', () => {
    const element = {
      id: 'shape-c',
      fill: '#22c55e',
      gradient: {
        type: 'radial',
        from: '#ffffff',
        to: '#22c55e',
      },
    } as PlaitElement;
    const { path, svg } = createMountedElement(element);

    syncCanvasStyleEffects([element]);

    const gradient = svg.querySelector('radialGradient');
    expect(path.getAttribute('fill')).toBe('url(#drawnix-gradient-shape-c)');
    expect(gradient?.getAttribute('cx')).toBe('0.5');
    expect(gradient?.getAttribute('r')).toBe('0.72');
  });

  it('applies and removes image fill patterns without losing the original fill', () => {
    const element = {
      id: 'shape-texture',
      fill: '#f8fafc',
      imageFill: {
        dataUrl:
          'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
      },
    } as PlaitElement;
    const { path, svg } = createMountedElement(element);

    syncCanvasStyleEffects([element]);

    const pattern = svg.querySelector('pattern');
    const image = pattern?.querySelector('image');
    expect(path.getAttribute('fill')).toBe(
      'url(#drawnix-image-fill-shape-texture)'
    );
    expect(pattern).toBeTruthy();
    expect(image?.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');

    delete (element as any).imageFill;
    syncCanvasStyleEffects([element]);
    expect(path.getAttribute('fill')).toBe('#f8fafc');
    expect(svg.querySelector('pattern')).toBeFalsy();
  });
});
