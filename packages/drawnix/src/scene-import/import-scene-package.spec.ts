import { zipSync } from 'fflate';
import { setProjectFontRoleFamilies } from '../constants/font';
import { importScenePackage } from './import-scene-package';

const encodeUtf8 = (value: string) =>
  new Uint8Array(Array.from(value).map((char) => char.charCodeAt(0)));

jest.mock('@plait/draw', () => ({
  ArrowLineMarkerType: {
    none: 'none',
    arrow: 'arrow',
  },
  ArrowLineShape: {
    straight: 'straight',
    elbow: 'elbow',
  },
  BasicShapes: {
    text: 'text',
    rectangle: 'rectangle',
    roundRectangle: 'roundRectangle',
    ellipse: 'ellipse',
    diamond: 'diamond',
    triangle: 'triangle',
    parallelogram: 'parallelogram',
    trapezoid: 'trapezoid',
    pentagon: 'pentagon',
    hexagon: 'hexagon',
    octagon: 'octagon',
    leftArrow: 'leftArrow',
    rightArrow: 'rightArrow',
    cross: 'cross',
    pentagonArrow: 'pentagonArrow',
    processArrow: 'processArrow',
    twoWayArrow: 'twoWayArrow',
    comment: 'comment',
    roundComment: 'roundComment',
    star: 'star',
    cloud: 'cloud',
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
    ...options,
  }),
}));

describe('importScenePackage', () => {
  afterEach(() => {
    setProjectFontRoleFamilies(undefined);
  });

  it('prefers configured role fonts over source font-family during scene import', async () => {
    setProjectFontRoleFamilies({
      title: 'Georgia, serif',
      plain: 'Verdana, sans-serif',
    });

    const archive = zipSync({
      'scene.json': encodeUtf8(
        JSON.stringify({
          type: 'drawnix-scene',
          version: '1.0.0',
          assets: [],
          elements: [
            {
              id: 'title',
              kind: 'text',
              text: 'Hello',
              layout: {
                x: 20,
                y: 30,
                width: 180,
                height: 40,
                anchor: 'start',
                baseline: 'alphabetic',
                rotation: 0,
                wrapMode: 'none',
              },
              style: {
                fontFamily: 'Courier New, monospace',
                fontSize: 24,
                fill: '#111111',
              },
              metadata: {
                textRole: 'title',
                fontFamilies: ['Courier New', 'monospace'],
              },
            },
          ],
        })
      ),
    });

    const file = new File([archive], 'scene.zip', { type: 'application/zip' });
    const result = await importScenePackage(file);
    const title = result.elements[0] as any;

    expect(title.textStyle.fontFamily).toContain('Georgia');
    expect(title.textProperties['font-family']).toContain('Georgia');
  });

  it('keeps source fontSize/rotation for text fidelity during scene import', async () => {
    const archive = zipSync({
      'scene.json': encodeUtf8(
        JSON.stringify({
          type: 'drawnix-scene',
          version: '1.0.0',
          assets: [],
          elements: [
            {
              id: 'caption',
              kind: 'text',
              text: 'Caption',
              layout: {
                x: 10,
                y: 20,
                width: 140,
                height: 30,
                anchor: 'start',
                baseline: 'alphabetic',
                rotation: 15,
                wrapMode: 'none',
              },
              style: {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: '#111111',
              },
            },
          ],
        })
      ),
    });

    const file = new File([archive], 'scene.zip', { type: 'application/zip' });
    const result = await importScenePackage(file);
    const caption = result.elements[0] as any;

    expect(caption.textStyle.fontSize).toBe(12);
    expect(caption.textStyle['font-size']).toBe('12');
    expect(caption.textProperties['font-size']).toBe('12');
    expect(caption.angle).toBe(15);
  });
});
