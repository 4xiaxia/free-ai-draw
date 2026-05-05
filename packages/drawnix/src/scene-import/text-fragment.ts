import {
  normalizeFontFamilyStack,
  resolveFontFamilyForRole,
} from '../constants/font';

export interface SceneTextFragmentRunMetadata {
  text: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    lineHeight?: number;
    letterSpacing?: number;
    baselineShift?: string;
    opacity?: number;
  };
  layout?: {
    x?: number;
    y?: number;
    dx?: number;
    dy?: number;
  };
}

interface BaseTextFragmentMetadata {
  kind: 'text-fragment';
  source: 'scene-import' | 'svg-import';
  sourceText: string;
  text: string;
  textRole: string;
  classList: string[];
  hasEmoji: boolean;
  hasDecorativeSymbol: boolean;
  hasTspan: boolean;
  hasTransform: boolean;
  fontFamilies: string[];
  style: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    lineHeight?: number;
    letterSpacing?: number;
    baselineShift?: string;
    opacity?: number;
  };
  layout: {
    x?: number;
    y?: number;
    anchor?: 'start' | 'middle' | 'end';
    baseline?: string;
    rotation?: number;
    width?: number;
    height?: number;
  };
  textLength?: number;
  lengthAdjust?: string;
  runs?: SceneTextFragmentRunMetadata[];
}

export interface SceneTextFragmentMetadata extends BaseTextFragmentMetadata {
  source: 'scene-import';
  sceneElementId: string;
}

export interface SvgTextFragmentMetadata extends BaseTextFragmentMetadata {
  source: 'svg-import';
  sourceElementId: string;
}

export type TextFragmentMetadata =
  | SceneTextFragmentMetadata
  | SvgTextFragmentMetadata;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const resolveSvgBaseline = (baseline?: string) => {
  switch (baseline) {
    case 'middle':
    case 'central':
      return 'middle';
    case 'hanging':
    case 'text-top':
      return 'hanging';
    case 'text-bottom':
      return 'text-after-edge';
    default:
      return 'alphabetic';
  }
};

export const buildTextFragmentDataUrl = (
  metadata: TextFragmentMetadata,
  overrides?: {
    fontFamily?: string;
  }
) => {
  const width = Math.max(1, metadata.layout.width || 1);
  const height = Math.max(1, metadata.layout.height || 1);
  const fontSize = Math.max(1, metadata.style.fontSize || 16);
  const fontFamily = overrides?.fontFamily
    ? normalizeFontFamilyStack(overrides.fontFamily)
    : resolveFontFamilyForRole(
        metadata.textRole,
        metadata.style.fontFamily,
        metadata.fontFamilies
      );
  const textAnchor =
    metadata.layout.anchor === 'middle'
      ? 'middle'
      : metadata.layout.anchor === 'end'
        ? 'end'
        : 'start';
  const dominantBaseline = resolveSvgBaseline(metadata.layout.baseline);
  const x =
    typeof metadata.layout.x === 'number'
      ? metadata.layout.x
      : textAnchor === 'middle'
        ? width / 2
        : textAnchor === 'end'
          ? width
          : 0;
  const y =
    typeof metadata.layout.y === 'number'
      ? metadata.layout.y
      : dominantBaseline === 'middle'
        ? height / 2
        : dominantBaseline === 'hanging'
          ? 0
          : Math.min(height, Math.max(fontSize, fontSize * 1.05));
  const fontWeight = metadata.style.fontWeight ?? '400';
  const fontStyle = metadata.style.fontStyle ?? 'normal';
  const fill = metadata.style.fill || '#000000';
  const stroke = metadata.style.stroke;
  const strokeWidth = metadata.style.strokeWidth ?? 0;
  const opacity =
    typeof metadata.style.opacity === 'number' ? metadata.style.opacity : 1;
  const baselineShift = metadata.style.baselineShift;
  const letterSpacing =
    typeof metadata.style.letterSpacing === 'number'
      ? metadata.style.letterSpacing
      : 0;
  const rotation = metadata.layout.rotation || 0;
  const transform =
    rotation !== 0 ? ` transform="rotate(${rotation} ${width / 2} ${height / 2})"` : '';
  const strokeAttrs =
    stroke && stroke !== 'none' && stroke !== 'transparent'
      ? ` stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" paint-order="stroke"`
      : '';
  const letterSpacingAttr =
    letterSpacing !== 0 ? ` letter-spacing="${letterSpacing}"` : '';
  const opacityAttr = opacity !== 1 ? ` opacity="${opacity}"` : '';
  const baselineShiftAttr = baselineShift
    ? ` baseline-shift="${escapeXml(baselineShift)}"`
    : '';
  const textLengthAttr =
    metadata.textLength && metadata.textLength > 0
      ? ` textLength="${metadata.textLength}"`
      : '';
  const lengthAdjustAttr =
    metadata.lengthAdjust && metadata.lengthAdjust.trim()
      ? ` lengthAdjust="${escapeXml(metadata.lengthAdjust)}"`
      : '';

  const runsMarkup =
    metadata.runs && metadata.runs.length > 0
      ? metadata.runs
          .map((run) => {
            const runText = escapeXml(run.text || '');
            const runFontFamily = overrides?.fontFamily
              ? normalizeFontFamilyStack(overrides.fontFamily)
              : resolveFontFamilyForRole(
                  metadata.textRole,
                  run.style?.fontFamily || metadata.style.fontFamily,
                  metadata.fontFamilies
                );
            const runFontSize = run.style?.fontSize ?? fontSize;
            const runFontWeight = run.style?.fontWeight ?? fontWeight;
            const runFontStyle = run.style?.fontStyle ?? fontStyle;
            const runFill = run.style?.fill ?? fill;
            const runStroke = run.style?.stroke ?? stroke;
            const runStrokeWidth = run.style?.strokeWidth ?? strokeWidth;
            const runLetterSpacing =
              typeof run.style?.letterSpacing === 'number'
                ? run.style.letterSpacing
                : letterSpacing;
            const runOpacity =
              typeof run.style?.opacity === 'number' ? run.style.opacity : opacity;
            const runBaselineShift =
              run.style?.baselineShift ?? baselineShift;
            const runStrokeAttrs =
              runStroke && runStroke !== 'none' && runStroke !== 'transparent'
                ? ` stroke="${escapeXml(runStroke)}" stroke-width="${runStrokeWidth}" paint-order="stroke"`
                : '';
            const runLetterSpacingAttr =
              runLetterSpacing !== 0 ? ` letter-spacing="${runLetterSpacing}"` : '';
            const runOpacityAttr = runOpacity !== 1 ? ` opacity="${runOpacity}"` : '';
            const runBaselineShiftAttr = runBaselineShift
              ? ` baseline-shift="${escapeXml(runBaselineShift)}"`
              : '';
            const runLayoutAttrs = [
              run.layout?.x !== undefined ? `x="${run.layout.x}"` : '',
              run.layout?.y !== undefined ? `y="${run.layout.y}"` : '',
              run.layout?.dx !== undefined ? `dx="${run.layout.dx}"` : '',
              run.layout?.dy !== undefined ? `dy="${run.layout.dy}"` : '',
            ]
              .filter(Boolean)
              .join(' ');
            return `<tspan ${runLayoutAttrs} font-family="${escapeXml(runFontFamily)}" font-size="${runFontSize}" font-weight="${escapeXml(
              String(runFontWeight)
            )}" font-style="${escapeXml(runFontStyle)}" fill="${escapeXml(
              runFill
            )}"${runStrokeAttrs}${runLetterSpacingAttr}${runOpacityAttr}${runBaselineShiftAttr}>${runText}</tspan>`;
          })
          .join('')
      : escapeXml(metadata.text);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text
    x="${x}"
    y="${y}"
    text-anchor="${textAnchor}"
    dominant-baseline="${dominantBaseline}"
    font-family="${escapeXml(fontFamily)}"
    font-size="${fontSize}"
    font-weight="${escapeXml(String(fontWeight))}"
    font-style="${escapeXml(fontStyle)}"
    xml:space="preserve"
    fill="${escapeXml(fill)}"${strokeAttrs}${letterSpacingAttr}${opacityAttr}${baselineShiftAttr}${textLengthAttr}${lengthAdjustAttr}${transform}
  >${runsMarkup}</text>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const buildSceneTextFragmentDataUrl = (
  metadata: SceneTextFragmentMetadata,
  overrides?: {
    fontFamily?: string;
  }
) => buildTextFragmentDataUrl(metadata, overrides);

export const buildSvgTextFragmentDataUrl = (
  metadata: SvgTextFragmentMetadata,
  overrides?: {
    fontFamily?: string;
  }
) => buildTextFragmentDataUrl(metadata, overrides);

export const isTextFragmentMetadata = (
  value: unknown
): value is TextFragmentMetadata => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as TextFragmentMetadata).kind === 'text-fragment'
  );
};

export const isSceneTextFragmentMetadata = (
  value: unknown
): value is SceneTextFragmentMetadata => {
  return isTextFragmentMetadata(value) && value.source === 'scene-import';
};

export const isSvgTextFragmentMetadata = (
  value: unknown
): value is SvgTextFragmentMetadata => {
  return isTextFragmentMetadata(value) && value.source === 'svg-import';
};
