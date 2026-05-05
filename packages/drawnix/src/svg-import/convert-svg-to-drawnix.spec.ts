import { zipSync } from 'fflate';
import {
  convertSvgAssetPackageToDrawnix,
  convertSvgToDrawnix,
} from './convert-svg-to-drawnix';
import { parseSvgAssetPackage } from './parse-svg-package';
import { setProjectFontRoleFamilies } from '../constants/font';

const encodeUtf8 = (value: string) =>
  new Uint8Array(Array.from(value).map((char) => char.charCodeAt(0)));

jest.mock('@plait/draw', () => ({
  ArrowLineMarkerType: {
    none: 'none',
    arrow: 'arrow',
  },
  ArrowLineShape: {
    straight: 'straight',
  },
  VectorLineShape: {
    straight: 'straight',
  },
  BasicShapes: {
    text: 'text',
    rectangle: 'rectangle',
    roundRectangle: 'roundRectangle',
    ellipse: 'ellipse',
    diamond: 'diamond',
  },
  createArrowLineElement: (
    shape: string,
    points: [number, number][],
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    texts?: unknown,
    options?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'arrow-line',
    shape,
    points,
    source,
    target,
    texts: texts ?? [],
    ...options,
  }),
  createGeometryElementWithText: (
    shape: string,
    points: [number, number][],
    text: string,
    options?: Record<string, unknown>,
    textProperties?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'geometry',
    shape,
    points,
    text,
    textProperties,
    ...(shape === 'text' ? { autoSize: true } : {}),
    ...options,
  }),
  createVectorLineElement: (
    shape: string,
    points: [number, number][],
    options?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'vector-line',
    shape,
    points,
    ...options,
  }),
}));

describe('convertSvgToDrawnix', () => {
  const originalGetBBox = (globalThis as any).SVGElement?.prototype?.getBBox;
  const originalGetBoundingClientRect = (globalThis as any).HTMLElement?.prototype?.getBoundingClientRect;

  const parseMatrix = (value?: string | null) => {
    const matched = value?.match(
      /matrix\(([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)\)/
    );
    if (!matched) {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }
    return {
      a: Number(matched[1]),
      b: Number(matched[2]),
      c: Number(matched[3]),
      d: Number(matched[4]),
      e: Number(matched[5]),
      f: Number(matched[6]),
    };
  };

  const transformPoint = (
    point: [number, number],
    matrix: ReturnType<typeof parseMatrix>
  ): [number, number] => {
    const [x, y] = point;
    return [
      matrix.a * x + matrix.c * y + matrix.e,
      matrix.b * x + matrix.d * y + matrix.f,
    ];
  };

  const transformBounds = (
    bounds: { x: number; y: number; width: number; height: number },
    matrix: ReturnType<typeof parseMatrix>
  ) => {
    const corners = [
      transformPoint([bounds.x, bounds.y], matrix),
      transformPoint([bounds.x + bounds.width, bounds.y], matrix),
      transformPoint([bounds.x, bounds.y + bounds.height], matrix),
      transformPoint([bounds.x + bounds.width, bounds.y + bounds.height], matrix),
    ];
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  };

  beforeAll(() => {
    if (!(globalThis as any).SVGElement) {
      return;
    }
    (globalThis as any).SVGElement.prototype.getBBox = function () {
      const matrix = parseMatrix(this.getAttribute?.('transform'));
      const encoded = this.getAttribute?.('data-bbox');
      if (encoded) {
        const [x, y, width, height] = encoded
          .split(/[\s,]+/)
          .map((item: string) => Number.parseFloat(item));
        return transformBounds({ x, y, width, height }, matrix);
      }
      const tagName = this.tagName?.toLowerCase?.() || '';
      if (tagName === 'text') {
        const x = Number(this.getAttribute?.('x') || 0);
        const fontSize = Number(this.getAttribute?.('font-size') || 16);
        const text = this.textContent || '';
        return transformBounds({
          x,
          y: Number(this.getAttribute?.('y') || 0) - fontSize,
          width: Math.max(text.length * fontSize * 0.6, fontSize),
          height: Math.max(fontSize * 1.2, 20),
        }, matrix);
      }
      return transformBounds({ x: 0, y: 0, width: 10, height: 10 }, matrix);
    };

    if ((globalThis as any).HTMLElement) {
      (globalThis as any).HTMLElement.prototype.getBoundingClientRect = function () {
        const element = this as HTMLElement;
        if (element.tagName?.toLowerCase() === 'span') {
          const fontFamily = element.style.fontFamily || '';
          if (/georgia|courier|comic sans|chalkboard|arial/i.test(fontFamily)) {
            const text = element.textContent || '';
            const fontSize = Number.parseFloat(element.style.fontSize || '16') || 16;
            const lineHeight = Number.parseFloat(element.style.lineHeight || '');
            const letterSpacing = Number.parseFloat(element.style.letterSpacing || '0') || 0;
            const widthFactor = /georgia/i.test(fontFamily)
              ? 0.74
              : /comic sans|chalkboard/i.test(fontFamily)
                ? 0.52
                : /arial/i.test(fontFamily)
                  ? 0.56
                  : 0.5;
            const glyphHeight = /georgia/i.test(fontFamily)
              ? fontSize * 1.32
              : /comic sans|chalkboard/i.test(fontFamily)
                ? fontSize * 1.22
                : fontSize * 1.2;
            const width = Math.max(
              text.length * fontSize * widthFactor + Math.max(text.length - 1, 0) * letterSpacing,
              fontSize * 0.75
            );
            const height = Number.isFinite(lineHeight)
              ? Math.max(lineHeight, glyphHeight)
              : glyphHeight;
            return {
              x: 0,
              y: 0,
              top: 0,
              left: 0,
              right: width,
              bottom: height,
              width,
              height,
              toJSON: () => ({}),
            };
          }
        }
        if (originalGetBoundingClientRect) {
          return originalGetBoundingClientRect.call(this);
        }
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        };
      };
    }
  });

  afterAll(() => {
    if (!(globalThis as any).SVGElement) {
      return;
    }
    (globalThis as any).SVGElement.prototype.getBBox = originalGetBBox;
    if ((globalThis as any).HTMLElement) {
      (globalThis as any).HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }
  });

  afterEach(() => {
    setProjectFontRoleFamilies(undefined);
  });

  it('extracts text, converts connector arrow, and keeps component image on svg coordinates', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
        <style>
          .stroke-main { fill: none; stroke: #111; stroke-width: 2; }
          .fill-box { fill: #dbeafe; stroke: #111; stroke-width: 2; }
          .text-label { font-size: 20px; text-anchor: middle; fill: #222; }
        </style>
        <g>
          <rect id="bg" width="100%" height="100%" fill="#ffffff" />
          <rect id="box" class="fill-box" x="20" y="20" width="120" height="80" />
          <text id="label" class="text-label" x="80" y="70" data-bbox="32 44 96 26">Hello</text>
          <path id="arrow" class="stroke-main" d="m170,60l110,0l-5,-5m5,5l-5,5" />
          <image id="icon_AF04" x="300" y="10" width="50" height="60" href="data:image/png;base64,old" />
        </g>
      </svg>
    `;

    const result = convertSvgAssetPackageToDrawnix({
      fileName: 'final.svg',
      svgText: input,
      componentAssets: {
        icon_AF04: {
          id: 'icon_AF04',
          fileName: 'icon_AF04_nobg.png',
          url: 'data:image/png;base64,new',
        },
      },
      iconBoxMap: {},
    });

    expect(result.summary.ignoredBackgroundCount).toBe(1);
    expect(result.summary.textCount).toBe(1);
    expect(result.summary.arrowCount).toBe(1);
    expect(result.summary.rectCount).toBe(1);
    expect(result.summary.componentCount).toBe(1); // bg and box removed, only icon_AF04 and arrow remain. wait, arrow converted, label converted.
    
    // the remaining elements should be 
    // icon_AF04 (image)
    // box (rectangle geometry)
    // arrow (arrow-line)
    // label (text geometry)
    
    // since base layer has nothing visible left (bg ignored, box extracted, text extracted, arrow extracted, icon extracted), base layer image is not created
    
    const elements = result.elements;
    
    const iconEl = elements.find(e => e.id === 'icon_AF04');
    expect(iconEl).toEqual(
      expect.objectContaining({
        type: 'image',
        url: 'data:image/png;base64,new',
        points: [
          [300, 10],
          [350, 70],
        ],
      })
    );
    
    const boxEl = elements.find(e => e.id === 'box');
    expect(boxEl).toEqual(
      expect.objectContaining({
        type: 'geometry',
        shape: 'rectangle',
        points: [
          [20, 20],
          [140, 100],
        ],
      })
    );

    const arrowEl = elements.find(e => e.id === 'arrow');
    expect(arrowEl).toEqual(
      expect.objectContaining({
        type: 'arrow-line',
      })
    );
    
    const labelEl = elements.find(e => e.id === 'label');
    expect(labelEl).toEqual(
      expect.objectContaining({
        type: 'geometry',
        shape: 'text',
        text: 'Hello',
      })
    );
    expect((labelEl as any).points[0][0]).toBeLessThanOrEqual(32);
    expect((labelEl as any).points[0][1]).toBeLessThanOrEqual(44);
    expect((labelEl as any).points[1][0]).toBeGreaterThanOrEqual(128);
    expect((labelEl as any).points[1][1]).toBeGreaterThanOrEqual(70);
    expect((labelEl as any).textStyle).toEqual(
      expect.objectContaining({
        align: 'center',
        fontSize: 20,
        fontFamily: expect.stringContaining('Arial'),
      })
    );
    expect((labelEl as any).textProperties).toEqual(
      expect.objectContaining({
        'font-size': '20',
        'font-family': expect.stringContaining('Arial'),
      })
    );
    expect((labelEl as any).svgImportMetadata).toEqual(
      expect.objectContaining({
        source: 'svg-import',
        importMode: 'native',
        sourceFontSize: 20,
        textRole: 'title',
      })
    );
  });

  it('preserves explicit source font-family during svg import', () => {
    setProjectFontRoleFamilies({
      title: 'Georgia, serif',
      plain: 'Verdana, sans-serif',
    });

    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
        <text
          id="title"
          x="120"
          y="60"
          font-size="24"
          font-family="Courier New, monospace"
          data-bbox="40 30 160 40"
        >
          Hello
        </text>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const title = result.elements.find((element) => element.id === 'title') as any;

    expect(title.textStyle.fontFamily).toContain('Courier New');
    expect(title.textProperties['font-family']).toContain('Courier New');
    expect(title.svgImportMetadata.sourceFontFamily).toContain('Courier New');
  });

  it('expands native text bounds when a generic source font resolves to a wider role font', () => {
    setProjectFontRoleFamilies({
      title: 'Georgia, serif',
      plain: 'Verdana, sans-serif',
    });

    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
        <text
          id="mapped-title"
          x="120"
          y="60"
          font-size="24"
          text-anchor="middle"
          font-family="sans-serif"
          data-bbox="80 30 80 30"
        >
          Wider Title
        </text>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const title = result.elements.find((element) => element.id === 'mapped-title') as any;

    expect(title.svgImportMetadata).toEqual(
      expect.objectContaining({
        importMode: 'native',
        sourceFontFamily: expect.stringContaining('sans-serif'),
      })
    );
    expect(title.textStyle.fontFamily).toContain('Georgia');
    expect(title.points[0][0]).toBeLessThan(80);
    expect(title.points[1][0] - title.points[0][0]).toBeGreaterThan(80);
    expect(title.points[1][1] - title.points[0][1]).toBeGreaterThanOrEqual(30);
  });

  it('keeps job-like Comic Sans and Arial families instead of remapping them to role fonts', () => {
    setProjectFontRoleFamilies({
      title: '"Source Han Sans SC", Arial, sans-serif',
      plain: 'Verdana, sans-serif',
    });

    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
        <style>
          .title-font { font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; font-size: 32px; }
          .text-normal { font-family: 'Arial', sans-serif; font-size: 20px; }
        </style>
        <text id="job-title" class="title-font" x="120" y="50">Input</text>
        <text id="job-body" class="text-normal" x="120" y="100">Automation</text>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const title = result.elements.find((element) => element.id === 'job-title') as any;
    const body = result.elements.find((element) => element.id === 'job-body') as any;

    expect(title.textStyle.fontFamily).toContain('Comic Sans MS');
    expect(title.textProperties['font-family']).toContain('Comic Sans MS');
    expect(body.textStyle.fontFamily).toContain('Arial');
    expect(body.textProperties['font-family']).toContain('Arial');
  });

  it('adds safety width for single-line source titles so they do not render edge-to-edge', () => {
    setProjectFontRoleFamilies({
      title: '"Source Han Sans SC", Arial, sans-serif',
      plain: 'Verdana, sans-serif',
    });

    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
        <style>
          .title-font { font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; font-size: 32px; }
        </style>
        <text id="job-title" class="title-font" x="120" y="50" text-anchor="middle">Input</text>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const title = result.elements.find((element) => element.id === 'job-title') as any;
    const width = title.points[1][0] - title.points[0][0];

    expect(title.textStyle.fontFamily).toContain('Comic Sans MS');
    expect(width).toBeGreaterThan(95);
  });

  it('disables native autoSize for long fallback svg titles so source single-line layout is preserved', () => {
    setProjectFontRoleFamilies({
      title: '"Source Han Sans SC", Arial, sans-serif',
      plain: 'Verdana, sans-serif',
    });

    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="200">
        <style>
          .title-font { font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; font-size: 32px; }
        </style>
        <text
          id="stage-title"
          class="title-font"
          x="835"
          y="35"
          text-anchor="middle"
          data-bbox="460 0 750 42"
        >
          Stage 1 (Deconstruction &amp; Formalization)
        </text>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const title = result.elements.find((element) => element.id === 'stage-title') as any;
    const width = title.points[1][0] - title.points[0][0];

    expect(title.autoSize).toBe(false);
    expect(width).toBeGreaterThanOrEqual(750);
    expect(title.text).toBe('Stage 1 (Deconstruction & Formalization)');
  });

  it('applies ancestor group transforms to rect, text, image and arrow coordinates', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="240">
        <style>
          .stroke-main { fill: none; stroke: #111; stroke-width: 2; }
          .shape { fill: #dbeafe; stroke: #111; stroke-width: 2; }
          .label { font-size: 20px; text-anchor: middle; fill: #222; }
        </style>
        <g transform="translate(50 30)">
          <rect id="box" class="shape" x="20" y="20" width="120" height="80" />
          <text id="label" class="label" x="80" y="70" data-bbox="32 44 96 26">Hello</text>
          <path id="arrow" class="stroke-main" d="m170,60l110,0l-5,-5m5,5l-5,5" />
          <image id="icon_AF04" x="300" y="10" width="50" height="60" href="data:image/png;base64,old" />
        </g>
      </svg>
    `;

    const result = convertSvgAssetPackageToDrawnix({
      fileName: 'final.svg',
      svgText: input,
      componentAssets: {
        icon_AF04: {
          id: 'icon_AF04',
          fileName: 'icon_AF04_nobg.png',
          url: 'data:image/png;base64,new',
        },
      },
      iconBoxMap: {},
    });

    const boxEl = result.elements.find(e => e.id === 'box');
    expect(boxEl).toEqual(
      expect.objectContaining({
        type: 'geometry',
        shape: 'rectangle',
        points: [
          [70, 50],
          [190, 130],
        ],
      })
    );

    const labelEl = result.elements.find(e => e.id === 'label');
    expect(labelEl).toEqual(
      expect.objectContaining({
        type: 'geometry',
        shape: 'text',
        text: 'Hello',
      })
    );
    expect((labelEl as any).points[0][0]).toBeLessThanOrEqual(82);
    expect((labelEl as any).points[0][1]).toBeLessThanOrEqual(74);
    expect((labelEl as any).points[1][0]).toBeGreaterThanOrEqual(178);
    expect((labelEl as any).points[1][1]).toBeGreaterThanOrEqual(100);

    const iconEl = result.elements.find(e => e.id === 'icon_AF04');
    expect(iconEl).toEqual(
      expect.objectContaining({
        type: 'image',
        url: 'data:image/png;base64,new',
        points: [
          [350, 40],
          [400, 100],
        ],
      })
    );

    const arrowEl = result.elements.find(e => e.id === 'arrow') as any;
    expect(arrowEl).toEqual(
      expect.objectContaining({
        type: 'arrow-line',
        points: [
          [220, 90],
          [330, 90],
        ],
      })
    );
  });

  it('keeps unsupported path arrows inside component image', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
        <style>
          .fill-arrow { fill: #E8E3D9; stroke: #111; stroke-width: 4; }
        </style>
        <g>
          <path id="fancy-arrow" class="fill-arrow" data-bbox="10 20 120 50" d="M10 50 Q 60 0 120 50" />
        </g>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);

    expect(result.summary.arrowCount).toBe(0);
    expect(result.summary.componentCount).toBe(1); // preserve-arrow -> component

    const fancyArrow = result.elements.find(e => e.id === 'fancy-arrow');
    expect(fancyArrow).toEqual(
      expect.objectContaining({
        type: 'image',
      })
    );
    expect(decodeURIComponent((fancyArrow as any).url)).toContain('viewBox="6 16 128 58"');
  });

  it('converts marker-based path connectors into arrow elements and keeps the arrow head markers', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="160">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#7c592a" />
          </marker>
        </defs>
        <path
          id="marker-path-arrow"
          d="M 40 80 L 220 80 L 260 40"
          stroke="#7c592a"
          stroke-width="4"
          fill="none"
          marker-end="url(#arrow)"
        />
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const arrow = result.elements.find((element) => element.id === 'marker-path-arrow') as any;

    expect(arrow).toEqual(
      expect.objectContaining({
        type: 'arrow-line',
        points: [
          [40, 80],
          [220, 80],
          [260, 40],
        ],
      })
    );
    expect(arrow.source).toEqual(expect.objectContaining({ marker: 'none' }));
    expect(arrow.target).toEqual(expect.objectContaining({ marker: 'arrow' }));
  });

  it('converts autodraw residual shapes into editable ellipse and vector-line elements', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="220">
        <g id="stage-arrow" class="arrow" transform="translate(20, 20)">
          <path id="stage-arrow-body" d="M 0 0 L 15 15 L 0 30 L 8 30 L 23 15 L 8 0 Z" fill="#7c592a" />
        </g>
        <ellipse id="residual-ellipse" cx="90" cy="40" rx="26" ry="14" fill="#fbe8d6" stroke="#c18400" stroke-width="2" />
        <path id="residual-bracket" d="M 145 20 L 135 20 L 135 60 L 145 60" stroke="black" stroke-width="3" fill="none" />
        <path id="residual-axes" d="M 180 80 L 220 80 M 180 80 L 180 40" stroke="#427854" stroke-width="2" fill="none" />
      </svg>
    `;

    const result = convertSvgToDrawnix(input);

    expect(result.elements.find((element) => element.id === 'svg-base-layer')).toBeUndefined();
    expect(result.summary.componentCount).toBe(0);

    expect(result.elements.find((element) => element.id === 'residual-ellipse')).toEqual(
      expect.objectContaining({
        type: 'geometry',
        shape: 'ellipse',
        points: [
          [64, 26],
          [116, 54],
        ],
      })
    );

    expect(result.elements.find((element) => element.id === 'stage-arrow-body-1')).toEqual(
      expect.objectContaining({
        type: 'vector-line',
        fill: '#7c592a',
        points: [
          [20, 20],
          [35, 35],
          [20, 50],
          [28, 50],
          [43, 35],
          [28, 20],
          [20, 20],
        ],
      })
    );

    expect(result.elements.find((element) => element.id === 'residual-bracket-1')).toEqual(
      expect.objectContaining({
        type: 'vector-line',
        points: [
          [145, 20],
          [135, 20],
          [135, 60],
          [145, 60],
        ],
      })
    );

    expect(result.elements.find((element) => element.id === 'residual-axes-1')).toEqual(
      expect.objectContaining({
        type: 'vector-line',
        points: [
          [180, 80],
          [220, 80],
        ],
      })
    );
    expect(result.elements.find((element) => element.id === 'residual-axes-2')).toEqual(
      expect.objectContaining({
        type: 'vector-line',
        points: [
          [180, 80],
          [180, 40],
        ],
      })
    );
  });

  it('keeps unsupported residual nodes as per-node fragments instead of one svg base layer', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="220">
        <path id="curve-a" data-bbox="10 20 90 40" d="M 10 50 C 30 10, 70 10, 100 50" stroke="#111" stroke-width="2" fill="none" />
        <path id="curve-b" data-bbox="140 20 90 40" d="M 140 50 C 160 10, 200 10, 230 50" stroke="#111" stroke-width="2" fill="none" />
      </svg>
    `;

    const result = convertSvgToDrawnix(input);

    expect(result.elements.find((element) => element.id === 'svg-base-layer')).toBeUndefined();
    expect(result.summary.componentCount).toBe(2);
    expect(result.elements.find((element) => element.id === 'curve-a')).toEqual(
      expect.objectContaining({
        type: 'image',
      })
    );
    expect(result.elements.find((element) => element.id === 'curve-b')).toEqual(
      expect.objectContaining({
        type: 'image',
      })
    );
  });

  it('keeps imported element order aligned with the source svg order', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="360" height="220">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#7c592a" />
          </marker>
        </defs>
        <rect id="frame" x="20" y="20" width="320" height="180" fill="none" stroke="#999" stroke-width="2" />
        <path id="connector" d="M 60 110 L 180 110" stroke="#7c592a" stroke-width="4" fill="none" marker-end="url(#arrow)" />
        <image id="icon_AF01" x="210" y="70" width="56" height="56" href="data:image/png;base64,old" />
        <text id="label" x="140" y="60" data-bbox="92 32 96 26">Ordered</text>
      </svg>
    `;

    const result = convertSvgAssetPackageToDrawnix({
      fileName: 'ordered.svg',
      svgText: input,
      componentAssets: {
        icon_AF01: {
          id: 'icon_AF01',
          fileName: 'icon_AF01.png',
          url: 'data:image/png;base64,new',
        },
      },
      iconBoxMap: {},
    });

    expect(result.elements.map((element) => element.id)).toEqual([
      'frame',
      'connector',
      'icon_AF01',
      'label',
    ]);
  });

  it('keeps svg text editable while preserving the source font-size', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="7060" height="2432">
        <text id="large-canvas-label" x="400" y="300" font-size="80" data-bbox="320 220 420 96">
          Readable Text
        </text>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const label = result.elements.find((element) => element.id === 'large-canvas-label') as any;

    expect(label).toEqual(
      expect.objectContaining({
        type: 'geometry',
        shape: 'text',
        text: 'Readable Text',
      })
    );
    expect(label.textStyle).toEqual(
      expect.objectContaining({
        fontSize: 80,
      })
    );
    expect(label.points[0][0]).toBeLessThanOrEqual(320);
    expect(label.points[0][1]).toBeLessThanOrEqual(220);
    expect(label.points[1][0]).toBeGreaterThanOrEqual(740);
    expect(label.points[1][1]).toBeGreaterThanOrEqual(316);
  });

  it('skips placeholder AF text when boxlib and icon assets are both present', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="120">
        <g id="AF01" transform="translate(20 10)">
          <rect id="box" x="0" y="0" width="60" height="60" fill="#0f172a" />
          <text id="placeholder" x="30" y="30" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="14">
            &lt;AF&gt;01
          </text>
        </g>
        <image id="icon_AF01" x="24" y="14" width="40" height="40" href="data:image/png;base64,old" />
      </svg>
    `;

    const result = convertSvgAssetPackageToDrawnix({
      fileName: 'final.svg',
      svgText: input,
      componentAssets: {
        icon_AF01: {
          id: 'icon_AF01',
          fileName: 'icon_AF01_nobg.png',
          url: 'data:image/png;base64,new',
        },
      },
      iconBoxMap: {
        AF01: {
          id: 0,
          label: '<AF>01',
          normalizedLabel: 'AF01',
          iconId: 'icon_AF01',
          x1: 24,
          y1: 14,
          x2: 64,
          y2: 54,
        },
      },
    });

    expect(result.summary.textCount).toBe(0);
    expect(result.elements.find((element) => element.id === 'placeholder')).toBeUndefined();
    expect(result.elements.find((element) => element.id === 'icon_AF01')).toEqual(
      expect.objectContaining({
        type: 'image',
        url: 'data:image/png;base64,new',
      })
    );
  });

  it('keeps simple rotated text as native text with angle metadata', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
        <text
          id="rotated-title"
        transform="translate(200,300) rotate(-90)"
        fill="#ffffff"
        font-family="Arial"
        font-weight="bold"
        font-size="20"
        data-bbox="0 -20 140 30"
        >
          PROPOSED INTEGRATED SYSTEM
        </text>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);
    const rotated = result.elements.find((element) => element.id === 'rotated-title') as any;

    expect(rotated).toEqual(
      expect.objectContaining({
        type: 'geometry',
        shape: 'text',
        angle: -90,
      })
    );
    expect(rotated.svgImportMetadata).toEqual(
      expect.objectContaining({
        importMode: 'native',
        sourceRotation: -90,
      })
    );
  });

  it('parses zip package from components or icons folders and prefers _nobg component asset', async () => {
    const archive = zipSync({
      'pic/final.svg': encodeUtf8('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      'pic/boxlib.json': encodeUtf8(
        JSON.stringify({
          boxes: [
            {
              id: 0,
              label: '<AF>04',
              x1: 10,
              y1: 20,
              x2: 40,
              y2: 60,
              score: 0.99,
              prompt: 'icon',
            },
          ],
        })
      ),
      'pic/icons/icon_AF04.png': new Uint8Array([1, 2, 3]),
      'pic/icons/icon_AF04_nobg.png': new Uint8Array([4, 5, 6]),
    });

    const file = new File([archive], 'assets.zip', { type: 'application/zip' });
    const result = await parseSvgAssetPackage(file);

    expect(result.fileName).toBe('final.svg');
    expect(result.svgText).toContain('<svg');
    expect(Object.keys(result.componentAssets)).toEqual(['icon_AF04']);
    expect(result.componentAssets.icon_AF04.fileName).toBe('icon_AF04_nobg.png');
    expect(result.componentAssets.icon_AF04.url).toContain('data:image/png;base64');
    expect(result.iconBoxMap.AF04).toEqual(
      expect.objectContaining({
        label: '<AF>04',
        iconId: 'icon_AF04',
        prompt: 'icon',
      })
    );
  });
});
