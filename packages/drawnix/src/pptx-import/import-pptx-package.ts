import type { PlaitElement } from '@plait/core';
import { unzipSync } from 'fflate';
import {
  compileSceneToDrawnix,
  type SceneAsset,
  type SceneConnectorElement,
  type SceneDocument,
  type SceneElement,
  type SceneImageElement,
  type SceneShapeElement,
  type SceneTextElement,
} from '../scene-import/import-scene-package';
import type { SvgImportSummary } from '../svg-import/convert-svg-to-drawnix';

const EMU_PER_PX = 9525;
const PT_TO_PX = 96 / 72;
const PPTX_ROTATION_UNIT = 60000;
const DEFAULT_SLIDE_WIDTH_PX = 960;
const DEFAULT_SLIDE_HEIGHT_PX = 540;
const SLIDE_GAP_PX = 80;
const DEFAULT_FONT_SIZE_PX = 18;
const TEXT_HEIGHT_PADDING_PX = 4;
const MIN_AUTOFIT_FONT_SIZE_PX = 4;

type ArchiveMap = Map<string, Uint8Array>;
type LineMarker = 'none' | 'arrow';
type ThemeColorKey =
  | 'dk1'
  | 'lt1'
  | 'dk2'
  | 'lt2'
  | 'tx1'
  | 'bg1'
  | 'tx2'
  | 'bg2'
  | 'accent1'
  | 'accent2'
  | 'accent3'
  | 'accent4'
  | 'accent5'
  | 'accent6'
  | 'hlink'
  | 'folHlink';

interface PptxImportMeta {
  slideCount: number;
  assetCount: number;
  unsupportedCount: number;
}

export interface PptxImportResult {
  elements: PlaitElement[];
  summary: SvgImportSummary;
  meta: PptxImportMeta;
  descriptionLines: string[];
}

interface SlideInfo {
  path: string;
  index: number;
}

interface RelationshipMap {
  [id: string]: string;
}

type ThemeColorMap = Record<string, string>;

const THEME_COLOR_KEYS: ThemeColorKey[] = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
];

const THEME_ALIAS_KEYS: ThemeColorKey[] = [
  'tx1',
  'bg1',
  'tx2',
  'bg2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
];

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

interface TransformContext {
  offsetX: number;
  offsetY: number;
  childOffsetX: number;
  childOffsetY: number;
  scaleX: number;
  scaleY: number;
}

interface ShapeStyleRefs {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

interface TextStyleInheritance {
  paragraphSources: Element[];
  runSources: Element[];
}

interface PlaceholderTextStyle {
  type?: string;
  idx?: string;
  style: TextStyleInheritance;
}

interface PlaceholderShapeStyle {
  type?: string;
  idx?: string;
  shape: Element;
}

interface ParsedTextRun {
  text: string;
  style: ReturnType<typeof parseRunStyleFromSources>;
}

interface SlideTextStyleContext {
  title: TextStyleInheritance;
  body: TextStyleInheritance;
  other: TextStyleInheritance;
  placeholders: PlaceholderTextStyle[];
  placeholderShapes: PlaceholderShapeStyle[];
}

const emptyTextStyleInheritance = (): TextStyleInheritance => ({
  paragraphSources: [],
  runSources: [],
});

const emptySlideTextStyleContext = (): SlideTextStyleContext => ({
  title: emptyTextStyleInheritance(),
  body: emptyTextStyleInheritance(),
  other: emptyTextStyleInheritance(),
  placeholders: [],
  placeholderShapes: [],
});

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

const getDirectory = (value: string) => {
  const normalized = normalizePath(value);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
};

const resolveRelativePath = (baseFilePath: string, target: string) => {
  if (/^[a-z]+:/i.test(target)) {
    return target;
  }
  if (target.startsWith('/')) {
    return normalizePath(target.slice(1));
  }
  const baseDirectory = getDirectory(baseFilePath);
  const parts = `${baseDirectory}/${target}`.split('/');
  const next: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      next.pop();
      continue;
    }
    next.push(part);
  }
  return next.join('/');
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
        reject(new Error('无法读取 PPTX 文件'));
        return;
      }
      resolve(new Uint8Array(result));
    };
    reader.onerror = () => {
      reject(reader.error || new Error('无法读取 PPTX 文件'));
    };
    reader.readAsArrayBuffer(file);
  });
};

const decodeUtf8 = (input: Uint8Array) => {
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

const arrayBufferToBase64 = (input: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < input.length; index += chunkSize) {
    binary += String.fromCharCode(...input.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const inferMimeType = (fileName: string) => {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg'))
    return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
};

const toDataUrl = (bytes: Uint8Array, fileName: string) => {
  return `data:${inferMimeType(fileName)};base64,${arrayBufferToBase64(bytes)}`;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const emuToPx = (value: string | null | undefined) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / EMU_PER_PX : 0;
};

const pctToOpacity = (value: string | null | undefined) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return Math.max(0, Math.min(1, numeric / 100000));
};

const parseXml = (xmlText: string, fileName: string) => {
  const parse = (input: string) =>
    new DOMParser().parseFromString(input, 'application/xml');
  let document = parse(xmlText);
  let parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) {
    const recoveredText = recoverMalformedTypefaceAttributes(xmlText);
    if (recoveredText !== xmlText) {
      document = parse(recoveredText);
      parserError = document.getElementsByTagName('parsererror')[0];
    }
  }
  if (parserError) {
    throw new Error(`PPTX XML 解析失败: ${fileName}`);
  }
  return document;
};

const recoverMalformedTypefaceAttributes = (xmlText: string) => {
  return xmlText.replace(
    /typeface="([^<>]*)"\s+(pitchFamily=)/g,
    (_match, rawTypeface: string, nextAttribute: string) => {
      return `typeface="${rawTypeface.replace(/"/g, '')}" ${nextAttribute}`;
    }
  );
};

const getElementsByLocalName = (root: ParentNode, localName: string) => {
  return Array.from(root.querySelectorAll('*')).filter(
    (node): node is Element => node.localName === localName
  );
};

const getFirstByLocalName = (root: ParentNode, localName: string) => {
  return getElementsByLocalName(root, localName)[0];
};

const getDirectChild = (root: Element, localName: string) => {
  return Array.from(root.children).find(
    (child) => child.localName === localName
  );
};

const getDirectChildren = (root: Element) => {
  return Array.from(root.children).filter(
    (child): child is Element => child instanceof Element
  );
};

const collectParagraphText = (root: Element): string => {
  let text = '';
  for (const child of getDirectChildren(root)) {
    if (child.localName === 'br') {
      text += '\n';
      continue;
    }
    if (child.localName === 't') {
      text += child.textContent || '';
      continue;
    }
    text += collectParagraphText(child);
  }
  return text;
};

const readXmlEntry = (archive: ArchiveMap, path: string) => {
  const bytes = archive.get(path);
  if (!bytes) {
    return null;
  }
  const xmlText = decodeUtf8(bytes);
  if (!xmlText.trim()) {
    return null;
  }
  return parseXml(xmlText, path);
};

const buildArchiveMap = (archive: Record<string, Uint8Array>) => {
  const entries = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(archive)) {
    entries.set(normalizePath(path), bytes);
  }
  return entries;
};

const getRelationshipPath = (sourcePath: string) => {
  const directory = getDirectory(sourcePath);
  return `${directory}/_rels/${getBaseName(sourcePath)}.rels`;
};

const readRelationships = (archive: ArchiveMap, sourcePath: string) => {
  const relsPath = getRelationshipPath(sourcePath);
  const relsDocument = readXmlEntry(archive, relsPath);
  const relationships: RelationshipMap = {};
  if (!relsDocument) {
    return relationships;
  }
  for (const relationship of getElementsByLocalName(
    relsDocument,
    'Relationship'
  )) {
    const id = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (id && target) {
      relationships[id] = resolveRelativePath(sourcePath, target);
    }
  }
  return relationships;
};

const parseSlideSize = (archive: ArchiveMap) => {
  const presentation = readXmlEntry(archive, 'ppt/presentation.xml');
  const slideSize = presentation
    ? getFirstByLocalName(presentation, 'sldSz')
    : null;
  const width = slideSize ? emuToPx(slideSize.getAttribute('cx')) : 0;
  const height = slideSize ? emuToPx(slideSize.getAttribute('cy')) : 0;
  return {
    width: width > 0 ? width : DEFAULT_SLIDE_WIDTH_PX,
    height: height > 0 ? height : DEFAULT_SLIDE_HEIGHT_PX,
  };
};

const normalizeHexColor = (value: string | null | undefined) => {
  if (!value) {
    return undefined;
  }
  const normalized = value.replace(/^#/, '').trim();
  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return `#${normalized.toUpperCase()}`;
  }
  return undefined;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace(/^#/, '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = (rgb: { r: number; g: number; b: number }) => {
  const clamp = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)));
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clamp(value).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
};

const applyColorModifiers = (hex: string, colorNode: Element) => {
  let rgb = hexToRgb(hex);
  const scale = (value: string | null | undefined) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric / 100000 : undefined;
  };
  const tint = scale(
    getFirstByLocalName(colorNode, 'tint')?.getAttribute('val')
  );
  if (typeof tint === 'number') {
    rgb = {
      r: rgb.r + (255 - rgb.r) * tint,
      g: rgb.g + (255 - rgb.g) * tint,
      b: rgb.b + (255 - rgb.b) * tint,
    };
  }
  const shade = scale(
    getFirstByLocalName(colorNode, 'shade')?.getAttribute('val')
  );
  if (typeof shade === 'number') {
    rgb = {
      r: rgb.r * shade,
      g: rgb.g * shade,
      b: rgb.b * shade,
    };
  }
  const lumMod = scale(
    getFirstByLocalName(colorNode, 'lumMod')?.getAttribute('val')
  );
  if (typeof lumMod === 'number') {
    rgb = {
      r: rgb.r * lumMod,
      g: rgb.g * lumMod,
      b: rgb.b * lumMod,
    };
  }
  const lumOff = scale(
    getFirstByLocalName(colorNode, 'lumOff')?.getAttribute('val')
  );
  if (typeof lumOff === 'number') {
    rgb = {
      r: rgb.r + 255 * lumOff,
      g: rgb.g + 255 * lumOff,
      b: rgb.b + 255 * lumOff,
    };
  }
  return rgbToHex(rgb);
};

const applyThemeColorAliases = (
  themeColors: ThemeColorMap,
  aliases: Partial<Record<ThemeColorKey, ThemeColorKey>>
) => {
  const next = { ...themeColors };
  for (const [target, source] of Object.entries(aliases)) {
    if (source && themeColors[source]) {
      next[target] = themeColors[source];
    }
  }
  return next;
};

const parseThemeColors = (archive: ArchiveMap): ThemeColorMap => {
  const presentationRels = readRelationships(archive, 'ppt/presentation.xml');
  const themePath = Object.values(presentationRels).find((path) =>
    /^ppt\/theme\/theme\d+\.xml$/i.test(path)
  );
  const themeDocument = themePath ? readXmlEntry(archive, themePath) : null;
  const colorScheme = themeDocument
    ? getFirstByLocalName(themeDocument, 'clrScheme')
    : null;
  if (!colorScheme) {
    return {};
  }

  const themeColors: ThemeColorMap = {};
  for (const key of THEME_COLOR_KEYS) {
    const colorNode = getDirectChild(colorScheme, key);
    if (!colorNode) {
      continue;
    }
    const srgb = getFirstByLocalName(colorNode, 'srgbClr');
    const sys = getFirstByLocalName(colorNode, 'sysClr');
    const color =
      normalizeHexColor(srgb?.getAttribute('val')) ||
      normalizeHexColor(sys?.getAttribute('lastClr')) ||
      normalizeHexColor(sys?.getAttribute('val'));
    if (color) {
      themeColors[key] = color;
    }
  }

  return applyThemeColorAliases(themeColors, {
    tx1: 'dk1',
    bg1: 'lt1',
    tx2: 'dk2',
    bg2: 'lt2',
  });
};

const resolveSlideThemeColors = (
  themeColors: ThemeColorMap,
  slideDocument: Document
) => {
  const colorMapOverride = getFirstByLocalName(slideDocument, 'clrMapOvr');
  const overrideMapping = colorMapOverride
    ? getFirstByLocalName(colorMapOverride, 'overrideClrMapping')
    : null;
  if (!overrideMapping) {
    return themeColors;
  }
  const aliases: Partial<Record<ThemeColorKey, ThemeColorKey>> = {};
  for (const key of THEME_ALIAS_KEYS) {
    const mapped = overrideMapping.getAttribute(key);
    if (mapped && THEME_COLOR_KEYS.includes(mapped as ThemeColorKey)) {
      aliases[key] = mapped as ThemeColorKey;
    }
  }
  return applyThemeColorAliases(themeColors, aliases);
};

const parseSlideOrder = (archive: ArchiveMap) => {
  const presentation = readXmlEntry(archive, 'ppt/presentation.xml');
  const presentationRels = readRelationships(archive, 'ppt/presentation.xml');
  const slideIds = presentation
    ? getElementsByLocalName(presentation, 'sldId')
    : [];
  const ordered = slideIds
    .map((slideId, index): SlideInfo | null => {
      const relId =
        slideId.getAttribute('r:id') ||
        slideId.getAttribute('id') ||
        slideId.getAttributeNS(
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
          'id'
        );
      const path = relId ? presentationRels[relId] : null;
      return path ? { path, index } : null;
    })
    .filter((slide): slide is SlideInfo => Boolean(slide));

  if (ordered.length) {
    return ordered;
  }

  return Array.from(archive.keys())
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((left, right) => {
      const leftIndex = Number(left.match(/slide(\d+)\.xml$/i)?.[1] || 0);
      const rightIndex = Number(right.match(/slide(\d+)\.xml$/i)?.[1] || 0);
      return leftIndex - rightIndex;
    })
    .map((path, index) => ({ path, index }));
};

const createSlideTransformContext = (
  slideOffsetY: number
): TransformContext => ({
  offsetX: 0,
  offsetY: slideOffsetY,
  childOffsetX: 0,
  childOffsetY: 0,
  scaleX: 1,
  scaleY: 1,
});

const parseGroupTransformContext = (
  group: Element,
  parentContext: TransformContext
) => {
  const groupProperties = getDirectChild(group, 'grpSpPr');
  const transform = groupProperties
    ? getFirstByLocalName(groupProperties, 'xfrm')
    : null;
  if (!transform) {
    return parentContext;
  }
  const off =
    getDirectChild(transform, 'off') || getFirstByLocalName(transform, 'off');
  const ext =
    getDirectChild(transform, 'ext') || getFirstByLocalName(transform, 'ext');
  const childOff =
    getDirectChild(transform, 'chOff') ||
    getFirstByLocalName(transform, 'chOff');
  const childExt =
    getDirectChild(transform, 'chExt') ||
    getFirstByLocalName(transform, 'chExt');
  if (!off || !ext || !childOff || !childExt) {
    return parentContext;
  }

  const groupWidth = emuToPx(ext.getAttribute('cx'));
  const groupHeight = emuToPx(ext.getAttribute('cy'));
  const childWidth = emuToPx(childExt.getAttribute('cx'));
  const childHeight = emuToPx(childExt.getAttribute('cy'));
  const scaleX = childWidth > 0 ? groupWidth / childWidth : 1;
  const scaleY = childHeight > 0 ? groupHeight / childHeight : 1;

  return {
    offsetX:
      parentContext.offsetX +
      (emuToPx(off.getAttribute('x')) - parentContext.childOffsetX) *
        parentContext.scaleX,
    offsetY:
      parentContext.offsetY +
      (emuToPx(off.getAttribute('y')) - parentContext.childOffsetY) *
        parentContext.scaleY,
    childOffsetX: emuToPx(childOff.getAttribute('x')),
    childOffsetY: emuToPx(childOff.getAttribute('y')),
    scaleX: parentContext.scaleX * scaleX,
    scaleY: parentContext.scaleY * scaleY,
  };
};

const parseTransform = (
  root: Element,
  transformContext: TransformContext
): Rect | null => {
  const transform = getFirstByLocalName(root, 'xfrm');
  if (!transform) {
    return null;
  }
  const off =
    getDirectChild(transform, 'off') || getFirstByLocalName(transform, 'off');
  const ext =
    getDirectChild(transform, 'ext') || getFirstByLocalName(transform, 'ext');
  if (!off || !ext) {
    return null;
  }
  const rotation = Number(transform.getAttribute('rot') || 0);
  return {
    x:
      transformContext.offsetX +
      (emuToPx(off.getAttribute('x')) - transformContext.childOffsetX) *
        transformContext.scaleX,
    y:
      transformContext.offsetY +
      (emuToPx(off.getAttribute('y')) - transformContext.childOffsetY) *
        transformContext.scaleY,
    width: Math.max(
      1,
      emuToPx(ext.getAttribute('cx')) * transformContext.scaleX
    ),
    height: Math.max(
      1,
      emuToPx(ext.getAttribute('cy')) * transformContext.scaleY
    ),
    rotation: Number.isFinite(rotation) ? rotation / PPTX_ROTATION_UNIT : 0,
    flipH: transform.getAttribute('flipH') === '1',
    flipV: transform.getAttribute('flipV') === '1',
  };
};

const getLinePoints = (rect: Rect): [[number, number], [number, number]] => {
  return [
    [
      rect.flipH ? rect.x + rect.width : rect.x,
      rect.flipV ? rect.y + rect.height : rect.y,
    ],
    [
      rect.flipH ? rect.x : rect.x + rect.width,
      rect.flipV ? rect.y : rect.y + rect.height,
    ],
  ];
};

const parseHexColor = (
  root: Element | null | undefined,
  themeColors: ThemeColorMap
) => {
  if (!root) {
    return undefined;
  }
  const srgb = getFirstByLocalName(root, 'srgbClr');
  const srgbColor = normalizeHexColor(srgb?.getAttribute('val'));
  if (srgb && srgbColor) {
    return applyColorModifiers(srgbColor, srgb);
  }
  const scheme = getFirstByLocalName(root, 'schemeClr');
  const schemeValue = scheme?.getAttribute('val');
  const fallbackMap: Record<string, string> = {
    tx1: '#111111',
    tx2: '#344054',
    bg1: '#ffffff',
    bg2: '#f7f8fb',
    accent1: '#2563eb',
    accent2: '#16a34a',
    accent3: '#dc2626',
    accent4: '#7c3aed',
    accent5: '#0891b2',
    accent6: '#ea580c',
  };
  if (scheme && schemeValue) {
    const resolved = themeColors[schemeValue] || fallbackMap[schemeValue];
    return resolved ? applyColorModifiers(resolved, scheme) : undefined;
  }
  const sys = getFirstByLocalName(root, 'sysClr');
  const sysColor =
    normalizeHexColor(sys?.getAttribute('lastClr')) ||
    normalizeHexColor(sys?.getAttribute('val'));
  return sys && sysColor ? applyColorModifiers(sysColor, sys) : undefined;
};

const parseSolidFill = (root: Element, themeColors: ThemeColorMap) => {
  if (getDirectChild(root, 'noFill')) {
    return { color: 'transparent', opacity: 0 };
  }
  const solidFill = getDirectChild(root, 'solidFill');
  if (solidFill) {
    const color = parseHexColor(solidFill, themeColors);
    const alpha = getFirstByLocalName(solidFill, 'alpha');
    return { color, opacity: pctToOpacity(alpha?.getAttribute('val')) };
  }

  const gradientFill = getDirectChild(root, 'gradFill');
  const firstGradientStop = gradientFill
    ? getElementsByLocalName(gradientFill, 'gs').sort((left, right) => {
        return (
          Number(left.getAttribute('pos') || 0) -
          Number(right.getAttribute('pos') || 0)
        );
      })[0]
    : null;
  if (firstGradientStop) {
    const color = parseHexColor(firstGradientStop, themeColors);
    const alpha = getFirstByLocalName(firstGradientStop, 'alpha');
    return { color, opacity: pctToOpacity(alpha?.getAttribute('val')) };
  }

  const patternFill = getDirectChild(root, 'pattFill');
  if (patternFill) {
    const foreground =
      getDirectChild(patternFill, 'fgClr') ||
      getFirstByLocalName(patternFill, 'fgClr');
    const background =
      getDirectChild(patternFill, 'bgClr') ||
      getFirstByLocalName(patternFill, 'bgClr');
    const colorNode = foreground || background;
    const color = colorNode ? parseHexColor(colorNode, themeColors) : undefined;
    const alpha = colorNode ? getFirstByLocalName(colorNode, 'alpha') : null;
    return { color, opacity: pctToOpacity(alpha?.getAttribute('val')) };
  }

  return { color: undefined, opacity: undefined };
};

const parseShapeStyleRefs = (
  shape: Element,
  themeColors: ThemeColorMap
): ShapeStyleRefs => {
  const style = getDirectChild(shape, 'style');
  if (!style) {
    return {};
  }
  const fillRef = getDirectChild(style, 'fillRef');
  const lineRef = getDirectChild(style, 'lnRef');
  return {
    fill: fillRef ? parseHexColor(fillRef, themeColors) : undefined,
    stroke: lineRef ? parseHexColor(lineRef, themeColors) : undefined,
    strokeWidth: lineRef
      ? Math.max(1, Number(lineRef.getAttribute('idx')) || 1)
      : undefined,
  };
};

const parseLineMarker = (
  line: Element,
  markerName: 'headEnd' | 'tailEnd'
): LineMarker => {
  const marker = getFirstByLocalName(line, markerName);
  const markerType = marker?.getAttribute('type');
  return markerType && markerType !== 'none' ? 'arrow' : 'none';
};

const parseLineStyle = (
  root: Element,
  themeColors: ThemeColorMap,
  styleRefs: ShapeStyleRefs = {}
) => {
  const line = getFirstByLocalName(root, 'ln');
  if (!line) {
    if (styleRefs.stroke) {
      return {
        stroke: styleRefs.stroke,
        strokeWidth: styleRefs.strokeWidth || 1,
        startMarker: 'none' as const,
        endMarker: 'none' as const,
      };
    }
    return {
      stroke: 'transparent',
      strokeWidth: 0,
      startMarker: 'none' as const,
      endMarker: 'none' as const,
    };
  }
  if (getDirectChild(line, 'noFill')) {
    return {
      stroke: 'transparent',
      strokeWidth: 0,
      startMarker: 'none' as const,
      endMarker: 'none' as const,
    };
  }
  const fill = parseSolidFill(line, themeColors);
  const stroke = fill.color || styleRefs.stroke;
  if (!stroke) {
    return {
      stroke: 'transparent',
      strokeWidth: 0,
      startMarker: 'none' as const,
      endMarker: 'none' as const,
    };
  }
  const width = emuToPx(line.getAttribute('w')) || 1;
  return {
    stroke,
    strokeWidth: Math.max(1, width),
    startMarker: parseLineMarker(line, 'headEnd'),
    endMarker: parseLineMarker(line, 'tailEnd'),
  };
};

const mapShapeType = (
  shapeType?: string | null
): SceneShapeElement['shapeType'] => {
  switch (shapeType) {
    case 'roundRect':
      return 'round-rectangle';
    case 'ellipse':
      return 'ellipse';
    case 'diamond':
      return 'diamond';
    case 'triangle':
    case 'rtTriangle':
      return 'triangle';
    case 'parallelogram':
      return 'parallelogram';
    case 'trapezoid':
      return 'trapezoid';
    case 'pentagon':
    case 'homePlate':
      return 'pentagon';
    case 'hexagon':
      return 'hexagon';
    case 'octagon':
      return 'octagon';
    case 'leftArrow':
      return 'left-arrow';
    case 'rightArrow':
      return 'right-arrow';
    case 'plus':
      return 'cross';
    case 'chevron':
      return 'process-arrow';
    case 'leftRightArrow':
      return 'two-way-arrow';
    case 'wedgeRectCallout':
    case 'borderCallout1':
    case 'borderCallout2':
    case 'borderCallout3':
      return 'comment';
    case 'wedgeRoundRectCallout':
    case 'roundRectCallout':
      return 'round-comment';
    case 'star5':
      return 'star';
    case 'cloud':
    case 'cloudCallout':
      return 'cloud';
    case 'flowChartProcess':
      return 'rectangle';
    case 'flowChartDecision':
      return 'diamond';
    case 'flowChartData':
      return 'parallelogram';
    case 'flowChartTerminator':
      return 'round-rectangle';
    case 'rect':
    default:
      return 'rectangle';
  }
};

const getShapePreset = (root: Element) => {
  return getFirstByLocalName(root, 'prstGeom')?.getAttribute('prst') || 'rect';
};

const shapeHasVisibleStyle = (shape: SceneShapeElement) => {
  return (
    shape.style.fill !== 'transparent' ||
    (shape.style.stroke !== 'transparent' && shape.style.strokeWidth > 0)
  );
};

const buildShapeElement = (
  root: Element,
  id: string,
  rect: Rect,
  themeColors: ThemeColorMap,
  inheritedShape?: Element
): SceneShapeElement | SceneConnectorElement | null => {
  const shapeProperties = getFirstByLocalName(root, 'spPr');
  if (!shapeProperties) {
    return null;
  }
  const inheritedShapeProperties = inheritedShape
    ? getFirstByLocalName(inheritedShape, 'spPr')
    : null;
  const directStyleRefs = parseShapeStyleRefs(root, themeColors);
  const inheritedStyleRefs = inheritedShape
    ? parseShapeStyleRefs(inheritedShape, themeColors)
    : {};
  const styleRefs = {
    fill: directStyleRefs.fill || inheritedStyleRefs.fill,
    stroke: directStyleRefs.stroke || inheritedStyleRefs.stroke,
    strokeWidth: directStyleRefs.strokeWidth || inheritedStyleRefs.strokeWidth,
  };
  const hasDirectLine = Boolean(getDirectChild(shapeProperties, 'ln'));
  const line =
    !hasDirectLine && inheritedShapeProperties
      ? parseLineStyle(inheritedShapeProperties, themeColors, styleRefs)
      : parseLineStyle(shapeProperties, themeColors, styleRefs);
  if (getShapePreset(shapeProperties) === 'line') {
    if (line.stroke === 'transparent' || line.strokeWidth <= 0) {
      return null;
    }
    const points = getLinePoints(rect);
    return {
      id,
      kind: 'connector',
      routing: {
        shape: 'straight',
        points,
      },
      style: {
        stroke: line.stroke,
        strokeWidth: line.strokeWidth,
        startMarker: line.startMarker,
        endMarker: line.endMarker,
      },
    };
  }
  const fill = parseSolidFill(shapeProperties, themeColors);
  const inheritedFill = inheritedShapeProperties
    ? parseSolidFill(inheritedShapeProperties, themeColors)
    : { color: undefined };
  const element: SceneShapeElement = {
    id,
    kind: 'shape',
    shapeType: mapShapeType(getShapePreset(shapeProperties)),
    bounds: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    style: {
      fill:
        fill.color !== undefined
          ? fill.color
          : inheritedFill.color || styleRefs.fill || 'transparent',
      stroke: line.stroke,
      strokeWidth: line.strokeWidth,
    },
  };
  return shapeHasVisibleStyle(element) ? element : null;
};

const parseParagraphLineHeight = (
  textBody: Element,
  fontSize: number,
  inheritedParagraphSources: Element[] = []
) => {
  const paragraphProperties = getFirstByLocalName(textBody, 'pPr');
  const paragraphSources = [
    paragraphProperties,
    ...inheritedParagraphSources,
  ].filter((source): source is Element => Boolean(source));
  const lineSpacing = paragraphSources
    .map((source) => getFirstByLocalName(source, 'lnSpc'))
    .find(Boolean);
  const spacingPoints = lineSpacing
    ? getFirstByLocalName(lineSpacing, 'spcPts')
    : null;
  const spacingPercent = lineSpacing
    ? getFirstByLocalName(lineSpacing, 'spcPct')
    : null;
  const pointsValue = Number(spacingPoints?.getAttribute('val'));
  if (Number.isFinite(pointsValue) && pointsValue > 0 && fontSize > 0) {
    return Math.max(1, ((pointsValue / 100) * PT_TO_PX) / fontSize);
  }
  const percentValue = Number(spacingPercent?.getAttribute('val'));
  if (Number.isFinite(percentValue) && percentValue > 0) {
    return Math.max(1, percentValue / 100000);
  }
  return 1.15;
};

const parseAutofitScale = (value: string | null | undefined) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  const scale = numeric > 1000 ? numeric / 100000 : numeric / 100;
  return Math.max(0.01, Math.min(1, scale));
};

const getNormalAutofit = (bodyProperties: Element | null) => {
  if (!bodyProperties || getDirectChild(bodyProperties, 'noAutofit')) {
    return null;
  }
  const normalAutofit = getDirectChild(bodyProperties, 'normAutofit');
  if (!normalAutofit) {
    return null;
  }
  return {
    fontScale: parseAutofitScale(normalAutofit.getAttribute('fontScale')),
  };
};

const estimateCharacterWidth = (character: string, fontSize: number) => {
  if (/[\u2e80-\u9fff\uff00-\uffef]/u.test(character)) {
    return fontSize;
  }
  if (/\s/u.test(character)) {
    return fontSize * 0.32;
  }
  if (/[A-Z0-9]/u.test(character)) {
    return fontSize * 0.56;
  }
  if (/[-–—.,:;()[\]{}'"!?+/\\|]/u.test(character)) {
    return fontSize * 0.28;
  }
  return fontSize * 0.48;
};

const estimateLineWidth = (
  text: string,
  fontSize: number,
  letterSpacing?: number
) => {
  const characters = Array.from(text);
  const spacing = letterSpacing || 0;
  return characters.reduce((width, character, index) => {
    return (
      width +
      estimateCharacterWidth(character, fontSize) +
      (index > 0 ? spacing : 0)
    );
  }, 0);
};

const estimateWrappedLineCount = (
  paragraphs: string[],
  width: number,
  fontSize: number,
  letterSpacing?: number
) => {
  const availableWidth = Math.max(fontSize, width);
  return paragraphs.reduce((count, paragraph) => {
    const hardLines = paragraph.split('\n');
    const lineCount = hardLines.reduce((lineSum, line) => {
      const estimatedWidth = estimateLineWidth(line, fontSize, letterSpacing);
      return lineSum + Math.max(1, Math.ceil(estimatedWidth / availableWidth));
    }, 0);
    return count + Math.max(1, lineCount);
  }, 0);
};

const fitAutofitFontSize = (
  paragraphs: string[],
  width: number,
  height: number,
  fontSize: number,
  lineHeight: number,
  letterSpacing?: number
) => {
  if (height <= 0 || width <= 0 || fontSize <= 0) {
    return fontSize;
  }
  let nextFontSize = fontSize;
  for (let index = 0; index < 8; index += 1) {
    const wrappedLineCount = estimateWrappedLineCount(
      paragraphs,
      width,
      nextFontSize,
      letterSpacing
    );
    const estimatedHeight =
      wrappedLineCount * nextFontSize * lineHeight + TEXT_HEIGHT_PADDING_PX;
    if (estimatedHeight <= height + 0.5) {
      break;
    }
    const scale = Math.max(
      0.2,
      Math.min(1, (height - TEXT_HEIGHT_PADDING_PX) / estimatedHeight)
    );
    nextFontSize = Math.max(MIN_AUTOFIT_FONT_SIZE_PX, nextFontSize * scale);
  }
  return nextFontSize;
};

const getFirstRunProperties = (textBody: Element) => {
  const firstParagraph = getElementsByLocalName(textBody, 'p')[0];
  const firstRun = firstParagraph
    ? getElementsByLocalName(firstParagraph, 'r')[0]
    : null;
  return firstRun
    ? getDirectChild(firstRun, 'rPr') || getFirstByLocalName(firstRun, 'rPr')
    : getFirstByLocalName(textBody, 'rPr');
};

const getRunStyleSources = (
  textBody: Element,
  inheritedRunSources: Element[] = []
) => {
  const firstParagraph = getElementsByLocalName(textBody, 'p')[0];
  const paragraphProperties = firstParagraph
    ? getDirectChild(firstParagraph, 'pPr') ||
      getFirstByLocalName(firstParagraph, 'pPr')
    : null;
  const paragraphDefault = paragraphProperties
    ? getDirectChild(paragraphProperties, 'defRPr') ||
      getFirstByLocalName(paragraphProperties, 'defRPr')
    : null;
  const listStyle = getDirectChild(textBody, 'lstStyle');
  const listDefault = listStyle
    ? getFirstByLocalName(listStyle, 'defRPr')
    : null;
  return [
    getFirstRunProperties(textBody),
    paragraphDefault,
    listDefault,
    ...inheritedRunSources,
  ].filter((source): source is Element => Boolean(source));
};

const getParagraphRunStyleSources = (
  textBody: Element,
  paragraph: Element,
  run: Element | null,
  inheritedRunSources: Element[] = []
) => {
  const runProperties = run
    ? getDirectChild(run, 'rPr') || getFirstByLocalName(run, 'rPr')
    : null;
  const paragraphProperties =
    getDirectChild(paragraph, 'pPr') || getFirstByLocalName(paragraph, 'pPr');
  const paragraphDefault = paragraphProperties
    ? getDirectChild(paragraphProperties, 'defRPr') ||
      getFirstByLocalName(paragraphProperties, 'defRPr')
    : null;
  const listStyle = getDirectChild(textBody, 'lstStyle');
  const listDefault = listStyle
    ? getFirstByLocalName(listStyle, 'defRPr')
    : null;
  return [
    runProperties,
    paragraphDefault,
    listDefault,
    ...inheritedRunSources,
  ].filter((source): source is Element => Boolean(source));
};

const getFirstStyleAttribute = (sources: Element[], attributeName: string) => {
  for (const source of sources) {
    const value = source.getAttribute(attributeName);
    if (value !== null) {
      return value;
    }
  }
  return undefined;
};

const hasDirectFill = (source: Element) => {
  return Boolean(
    getDirectChild(source, 'noFill') ||
      getDirectChild(source, 'solidFill') ||
      getDirectChild(source, 'gradFill') ||
      getDirectChild(source, 'pattFill')
  );
};

const parseInheritedFill = (sources: Element[], themeColors: ThemeColorMap) => {
  for (const source of sources) {
    if (!hasDirectFill(source)) {
      continue;
    }
    const fill = parseSolidFill(source, themeColors);
    if (fill.color || typeof fill.opacity === 'number') {
      return fill;
    }
  }
  return undefined;
};

const parseRunStyleFromSources = (
  styleSources: Element[],
  themeColors: ThemeColorMap
) => {
  const size = Number(getFirstStyleAttribute(styleSources, 'sz'));
  const fontSize =
    Number.isFinite(size) && size > 0
      ? (size / 100) * PT_TO_PX
      : DEFAULT_FONT_SIZE_PX;
  const fill = parseInheritedFill(styleSources, themeColors);
  const latin = styleSources
    .map((source) => getFirstByLocalName(source, 'latin'))
    .find(Boolean);
  const spacing = Number(getFirstStyleAttribute(styleSources, 'spc'));
  const bold = getFirstStyleAttribute(styleSources, 'b');
  const italic = getFirstStyleAttribute(styleSources, 'i');
  return {
    fontFamily: latin?.getAttribute('typeface') || 'Arial',
    fontSize,
    fontWeight: bold === '1' ? 'bold' : undefined,
    fontStyle: italic === '1' ? 'italic' : undefined,
    fill: fill?.color || '#111111',
    opacity: fill?.opacity,
    letterSpacing:
      Number.isFinite(spacing) && spacing !== 0
        ? (spacing / 100) * PT_TO_PX
        : undefined,
  };
};

const parseRunStyle = (
  textBody: Element,
  themeColors: ThemeColorMap,
  inheritedRunSources: Element[] = []
) => {
  return parseRunStyleFromSources(
    getRunStyleSources(textBody, inheritedRunSources),
    themeColors
  );
};

const getRunText = (run: Element) => {
  return getElementsByLocalName(run, 't')
    .map((node) => node.textContent || '')
    .join('');
};

const collectRichTextRuns = (
  textBody: Element,
  themeColors: ThemeColorMap,
  inheritedRunSources: Element[] = []
): ParsedTextRun[] => {
  const paragraphs = getElementsByLocalName(textBody, 'p');
  const runs: ParsedTextRun[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (paragraphIndex > 0) {
      runs.push({
        text: '\n',
        style: parseRunStyleFromSources(
          getParagraphRunStyleSources(
            textBody,
            paragraph,
            null,
            inheritedRunSources
          ),
          themeColors
        ),
      });
    }
    for (const child of getDirectChildren(paragraph)) {
      if (child.localName === 'r' || child.localName === 'fld') {
        const text = getRunText(child);
        if (!text) {
          continue;
        }
        runs.push({
          text,
          style: parseRunStyleFromSources(
            getParagraphRunStyleSources(
              textBody,
              paragraph,
              child,
              inheritedRunSources
            ),
            themeColors
          ),
        });
        continue;
      }
      if (child.localName === 'br') {
        runs.push({
          text: '\n',
          style: parseRunStyleFromSources(
            getParagraphRunStyleSources(
              textBody,
              paragraph,
              null,
              inheritedRunSources
            ),
            themeColors
          ),
        });
      }
    }
  });
  return runs;
};

const normalizeRunStyleForComparison = (style: ParsedTextRun['style']) => ({
  fontFamily: style.fontFamily,
  fontSize: Number(style.fontSize.toFixed(3)),
  fontWeight: style.fontWeight || '',
  fontStyle: style.fontStyle || '',
  fill: style.fill,
  opacity:
    typeof style.opacity === 'number' ? Number(style.opacity.toFixed(3)) : '',
  letterSpacing:
    typeof style.letterSpacing === 'number'
      ? Number(style.letterSpacing.toFixed(3))
      : '',
});

const hasMeaningfulRunStyleDifferences = (runs: ParsedTextRun[]) => {
  const textRuns = runs.filter((run) => run.text && run.text !== '\n');
  if (textRuns.length < 2) {
    return false;
  }
  const first = JSON.stringify(
    normalizeRunStyleForComparison(textRuns[0]!.style)
  );
  return textRuns.some(
    (run) => JSON.stringify(normalizeRunStyleForComparison(run.style)) !== first
  );
};

const collectTextFontFamilies = (
  primaryFontFamily: string,
  runs: ParsedTextRun[]
) => {
  const families = [
    primaryFontFamily,
    ...runs.map((run) => run.style.fontFamily),
  ].filter(Boolean);
  const seen = new Set<string>();
  return families.filter((family) => {
    const key = family.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const parseParagraphAlign = (
  textBody: Element,
  inheritedParagraphSources: Element[] = []
): SceneTextElement['layout']['anchor'] => {
  const paragraphProperties = getFirstByLocalName(textBody, 'pPr');
  const align = [paragraphProperties, ...inheritedParagraphSources]
    .filter((source): source is Element => Boolean(source))
    .map((source) => source.getAttribute('algn'))
    .find((value) => value !== null);
  switch (align) {
    case 'ctr':
      return 'middle';
    case 'r':
      return 'end';
    default:
      return 'start';
  }
};

const readTextStyleInheritance = (
  root: ParentNode | null,
  styleName: 'titleStyle' | 'bodyStyle' | 'otherStyle'
): TextStyleInheritance => {
  if (!root) {
    return emptyTextStyleInheritance();
  }
  const style = getFirstByLocalName(root, styleName);
  const paragraphProperties = style
    ? getFirstByLocalName(style, 'lvl1pPr')
    : null;
  const runProperties = paragraphProperties
    ? getDirectChild(paragraphProperties, 'defRPr') ||
      getFirstByLocalName(paragraphProperties, 'defRPr')
    : null;
  return {
    paragraphSources: paragraphProperties ? [paragraphProperties] : [],
    runSources: runProperties ? [runProperties] : [],
  };
};

const readTextBodyStyleInheritance = (
  textBody: Element | null
): TextStyleInheritance => {
  if (!textBody) {
    return emptyTextStyleInheritance();
  }
  const firstParagraph = getElementsByLocalName(textBody, 'p')[0];
  const paragraphProperties = firstParagraph
    ? getDirectChild(firstParagraph, 'pPr') ||
      getFirstByLocalName(firstParagraph, 'pPr')
    : null;
  const listStyle = getDirectChild(textBody, 'lstStyle');
  const listParagraphProperties = listStyle
    ? getFirstByLocalName(listStyle, 'lvl1pPr')
    : null;
  return {
    paragraphSources: [paragraphProperties, listParagraphProperties].filter(
      (source): source is Element => Boolean(source)
    ),
    runSources: getRunStyleSources(textBody),
  };
};

const getPlaceholderInfo = (shape: Element) => {
  const placeholder = getFirstByLocalName(shape, 'ph');
  return {
    type: placeholder?.getAttribute('type') || undefined,
    idx: placeholder?.getAttribute('idx') || undefined,
  };
};

const readPlaceholderTextStyles = (
  document: Document | null
): PlaceholderTextStyle[] => {
  if (!document) {
    return [];
  }
  return getElementsByLocalName(document, 'sp')
    .map((shape) => {
      const placeholder = getPlaceholderInfo(shape);
      if (!placeholder.type && !placeholder.idx) {
        return null;
      }
      const style = readTextBodyStyleInheritance(
        getFirstByLocalName(shape, 'txBody')
      );
      if (!style.paragraphSources.length && !style.runSources.length) {
        return null;
      }
      const next: PlaceholderTextStyle = { style };
      if (placeholder.type) {
        next.type = placeholder.type;
      }
      if (placeholder.idx) {
        next.idx = placeholder.idx;
      }
      return next;
    })
    .filter((style): style is PlaceholderTextStyle => Boolean(style));
};

const readPlaceholderShapeStyles = (
  document: Document | null
): PlaceholderShapeStyle[] => {
  if (!document) {
    return [];
  }
  return getElementsByLocalName(document, 'sp')
    .map((shape) => {
      const placeholder = getPlaceholderInfo(shape);
      if (!placeholder.type && !placeholder.idx) {
        return null;
      }
      if (!getFirstByLocalName(shape, 'spPr')) {
        return null;
      }
      const next: PlaceholderShapeStyle = { shape };
      if (placeholder.type) {
        next.type = placeholder.type;
      }
      if (placeholder.idx) {
        next.idx = placeholder.idx;
      }
      return next;
    })
    .filter((style): style is PlaceholderShapeStyle => Boolean(style));
};

const mergeTextStyleInheritance = (
  ...styles: TextStyleInheritance[]
): TextStyleInheritance => ({
  paragraphSources: styles.flatMap((style) => style.paragraphSources),
  runSources: styles.flatMap((style) => style.runSources),
});

const buildSlideTextStyleContext = (
  layoutDocument: Document | null,
  masterDocument: Document | null
): SlideTextStyleContext => {
  return {
    title: mergeTextStyleInheritance(
      readTextStyleInheritance(layoutDocument, 'titleStyle'),
      readTextStyleInheritance(masterDocument, 'titleStyle')
    ),
    body: mergeTextStyleInheritance(
      readTextStyleInheritance(layoutDocument, 'bodyStyle'),
      readTextStyleInheritance(masterDocument, 'bodyStyle')
    ),
    other: mergeTextStyleInheritance(
      readTextStyleInheritance(layoutDocument, 'otherStyle'),
      readTextStyleInheritance(masterDocument, 'otherStyle')
    ),
    placeholders: [
      ...readPlaceholderTextStyles(layoutDocument),
      ...readPlaceholderTextStyles(masterDocument),
    ],
    placeholderShapes: [
      ...readPlaceholderShapeStyles(layoutDocument),
      ...readPlaceholderShapeStyles(masterDocument),
    ],
  };
};

const findPlaceholderStyle = <T extends { type?: string; idx?: string }>(
  placeholder: { type?: string; idx?: string },
  styles: T[]
) => {
  const { type, idx } = placeholder;
  return (
    styles.find(
      (style) =>
        Boolean(idx) &&
        Boolean(type) &&
        style.idx === idx &&
        style.type === type
    ) ||
    styles.find((style) => Boolean(idx) && style.idx === idx) ||
    styles.find((style) => Boolean(type) && style.type === type)
  );
};

const findPlaceholderTextStyle = (
  placeholder: { type?: string; idx?: string },
  textStyleContext: SlideTextStyleContext
) => {
  return findPlaceholderStyle(placeholder, textStyleContext.placeholders)
    ?.style;
};

const findPlaceholderShape = (
  shape: Element,
  textStyleContext: SlideTextStyleContext
) => {
  return findPlaceholderStyle(
    getPlaceholderInfo(shape),
    textStyleContext.placeholderShapes
  )?.shape;
};

const resolveShapeTextStyle = (
  shape: Element,
  textStyleContext: SlideTextStyleContext
) => {
  const placeholder = getPlaceholderInfo(shape);
  const placeholderStyle = findPlaceholderTextStyle(
    placeholder,
    textStyleContext
  );
  switch (placeholder.type) {
    case 'title':
    case 'ctrTitle':
      return mergeTextStyleInheritance(
        placeholderStyle || emptyTextStyleInheritance(),
        textStyleContext.title
      );
    case 'body':
    case 'subTitle':
    case 'obj':
      return mergeTextStyleInheritance(
        placeholderStyle || emptyTextStyleInheritance(),
        textStyleContext.body
      );
    default:
      return mergeTextStyleInheritance(
        placeholderStyle || emptyTextStyleInheritance(),
        textStyleContext.other
      );
  }
};

const parseTextBody = (
  textBody: Element,
  id: string,
  rect: Rect,
  slideIndex: number,
  themeColors: ThemeColorMap,
  inheritedTextStyle: TextStyleInheritance = emptyTextStyleInheritance()
): SceneTextElement | null => {
  const paragraphs = getElementsByLocalName(textBody, 'p')
    .map((paragraph) => collectParagraphText(paragraph))
    .filter((text) => text.length > 0);
  const text = paragraphs.join('\n').trim();
  if (!text) {
    return null;
  }

  const bodyProperties = getFirstByLocalName(textBody, 'bodyPr');
  const leftInset = emuToPx(bodyProperties?.getAttribute('lIns')) || 0;
  const rightInset = emuToPx(bodyProperties?.getAttribute('rIns')) || 0;
  const topInset = emuToPx(bodyProperties?.getAttribute('tIns')) || 0;
  const bottomInset = emuToPx(bodyProperties?.getAttribute('bIns')) || 0;
  const runStyle = parseRunStyle(
    textBody,
    themeColors,
    inheritedTextStyle.runSources
  );
  const richTextRuns = collectRichTextRuns(
    textBody,
    themeColors,
    inheritedTextStyle.runSources
  );
  const hasRichRunStyleDifferences =
    hasMeaningfulRunStyleDifferences(richTextRuns);
  const lineHeight = parseParagraphLineHeight(
    textBody,
    runStyle.fontSize,
    inheritedTextStyle.paragraphSources
  );
  const textWidth = Math.max(1, rect.width - leftInset - rightInset);
  const sourceTextHeight = Math.max(1, rect.height - topInset - bottomInset);
  const normalAutofit = getNormalAutofit(bodyProperties);
  const initialAutofitScale = normalAutofit?.fontScale || 1;
  const initialFontSize = runStyle.fontSize * initialAutofitScale;
  const initialLetterSpacing =
    typeof runStyle.letterSpacing === 'number'
      ? runStyle.letterSpacing * initialAutofitScale
      : undefined;
  const fontSize = normalAutofit
    ? fitAutofitFontSize(
        paragraphs,
        textWidth,
        sourceTextHeight,
        initialFontSize,
        lineHeight,
        initialLetterSpacing
      )
    : runStyle.fontSize;
  const fontScale = runStyle.fontSize > 0 ? fontSize / runStyle.fontSize : 1;
  const letterSpacing =
    typeof runStyle.letterSpacing === 'number'
      ? runStyle.letterSpacing * fontScale
      : undefined;
  const wrappedLineCount = estimateWrappedLineCount(
    paragraphs,
    textWidth,
    fontSize,
    letterSpacing
  );
  const minTextHeight =
    wrappedLineCount * fontSize * lineHeight + TEXT_HEIGHT_PADDING_PX;
  const textHeight = normalAutofit
    ? sourceTextHeight
    : Math.max(1, sourceTextHeight, minTextHeight);

  return {
    id,
    kind: 'text',
    text,
    layout: {
      x: rect.x + leftInset,
      y: rect.y + topInset,
      width: textWidth,
      height: textHeight,
      anchor: parseParagraphAlign(
        textBody,
        inheritedTextStyle.paragraphSources
      ),
      baseline:
        bodyProperties?.getAttribute('anchor') === 'mid'
          ? 'middle'
          : 'alphabetic',
      rotation: rect.rotation,
      wrapMode: 'square',
    },
    style: {
      fontFamily: runStyle.fontFamily,
      fontSize,
      fontWeight: runStyle.fontWeight,
      fontStyle: runStyle.fontStyle,
      fill: runStyle.fill,
      opacity: runStyle.opacity,
      lineHeight,
      letterSpacing,
    },
    metadata: {
      textRole: slideIndex === 0 && fontSize >= 28 ? 'title' : 'plain',
      hasTspan: hasRichRunStyleDifferences,
      fontFamilies: collectTextFontFamilies(runStyle.fontFamily, richTextRuns),
    },
    runs: hasRichRunStyleDifferences
      ? richTextRuns.map((run) => ({
          text: run.text,
          style: {
            fontFamily: run.style.fontFamily,
            fontSize: run.style.fontSize * fontScale,
            fontWeight: run.style.fontWeight,
            fontStyle: run.style.fontStyle,
            fill: run.style.fill,
            opacity: run.style.opacity,
            letterSpacing:
              typeof run.style.letterSpacing === 'number'
                ? run.style.letterSpacing * fontScale
                : undefined,
            lineHeight,
          },
        }))
      : undefined,
  };
};

const parseText = (
  shape: Element,
  id: string,
  rect: Rect,
  slideIndex: number,
  themeColors: ThemeColorMap,
  textStyleContext: SlideTextStyleContext
): SceneTextElement | null => {
  const textBody = getFirstByLocalName(shape, 'txBody');
  return textBody
    ? parseTextBody(
        textBody,
        id,
        rect,
        slideIndex,
        themeColors,
        resolveShapeTextStyle(shape, textStyleContext)
      )
    : null;
};

const parseCropPercent = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }
  const normalized = value.trim();
  const numeric = Number(normalized.replace(/%$/, ''));
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const fraction = normalized.endsWith('%') ? numeric / 100 : numeric / 100000;
  return Math.max(0, Math.min(0.99, fraction));
};

const parseImageCrop = (blipFill: Element) => {
  const srcRect =
    getDirectChild(blipFill, 'srcRect') ||
    getFirstByLocalName(blipFill, 'srcRect');
  if (!srcRect) {
    return null;
  }
  const left = parseCropPercent(srcRect.getAttribute('l'));
  const top = parseCropPercent(srcRect.getAttribute('t'));
  const right = parseCropPercent(srcRect.getAttribute('r'));
  const bottom = parseCropPercent(srcRect.getAttribute('b'));
  if (left === 0 && top === 0 && right === 0 && bottom === 0) {
    return null;
  }
  return { left, top, right, bottom };
};

const formatSvgNumber = (value: number) => {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const buildCroppedImageDataUrl = (
  imageDataUrl: string,
  crop: { left: number; top: number; right: number; bottom: number }
) => {
  const visibleWidth = Math.max(0.01, 1 - crop.left - crop.right);
  const visibleHeight = Math.max(0.01, 1 - crop.top - crop.bottom);
  const imageX = (-crop.left / visibleWidth) * 100;
  const imageY = (-crop.top / visibleHeight) * 100;
  const imageWidth = (1 / visibleWidth) * 100;
  const imageHeight = (1 / visibleHeight) * 100;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <image href="${escapeXml(imageDataUrl)}" x="${formatSvgNumber(
    imageX
  )}" y="${formatSvgNumber(imageY)}" width="${formatSvgNumber(
    imageWidth
  )}" height="${formatSvgNumber(imageHeight)}" preserveAspectRatio="none"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const getBlipRelationshipId = (root: Element) => {
  const blip = getFirstByLocalName(root, 'blip');
  return (
    blip?.getAttribute('r:embed') ||
    blip?.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'embed'
    )
  );
};

const buildImageElementFromBlipFill = (
  blipFill: Element,
  id: string,
  layout: SceneImageElement['layout'],
  relationships: RelationshipMap,
  archive: ArchiveMap,
  assets: SceneAsset[],
  assetUrlMap: Map<string, string>,
  warnings: string[]
): SceneImageElement | null => {
  const relId = getBlipRelationshipId(blipFill);
  const imagePath = relId ? relationships[relId] : null;
  if (!imagePath) {
    warnings.push(`图片缺少关系映射: ${id}`);
    return null;
  }
  const imageBytes = archive.get(imagePath);
  if (!imageBytes) {
    warnings.push(`图片资源缺失: ${imagePath}`);
    return null;
  }
  const assetId = `asset-${id}`;
  const crop = parseImageCrop(blipFill);
  assets.push({
    id: assetId,
    kind: 'image',
    path: imagePath,
    mimeType: crop ? 'image/svg+xml' : inferMimeType(imagePath),
  });
  const imageDataUrl = toDataUrl(imageBytes, imagePath);
  assetUrlMap.set(
    assetId,
    crop ? buildCroppedImageDataUrl(imageDataUrl, crop) : imageDataUrl
  );
  return {
    id,
    kind: 'image',
    assetRef: assetId,
    layout,
  };
};

const buildImageElement = (
  picture: Element,
  id: string,
  rect: Rect,
  relationships: RelationshipMap,
  archive: ArchiveMap,
  assets: SceneAsset[],
  assetUrlMap: Map<string, string>,
  warnings: string[]
): SceneImageElement | null => {
  const blipFill = getFirstByLocalName(picture, 'blipFill');
  if (!blipFill) {
    warnings.push(`图片缺少填充信息: ${id}`);
    return null;
  }
  return buildImageElementFromBlipFill(
    blipFill,
    id,
    {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    relationships,
    archive,
    assets,
    assetUrlMap,
    warnings
  );
};

const buildConnectorElement = (
  connector: Element,
  id: string,
  rect: Rect,
  themeColors: ThemeColorMap
): SceneConnectorElement => {
  const shapeProperties = getFirstByLocalName(connector, 'spPr');
  const styleRefs = parseShapeStyleRefs(connector, themeColors);
  const line = shapeProperties
    ? parseLineStyle(shapeProperties, themeColors, styleRefs)
    : {
        stroke: styleRefs.stroke || '#111827',
        strokeWidth: 1,
        startMarker: 'none' as const,
        endMarker: 'none' as const,
      };
  return {
    id,
    kind: 'connector',
    routing: {
      shape: 'straight',
      points: getLinePoints(rect),
    },
    style: {
      stroke: line.stroke === 'transparent' ? '#111827' : line.stroke,
      strokeWidth: line.strokeWidth || 1,
      startMarker: line.startMarker,
      endMarker: line.endMarker,
    },
  };
};

const buildSimpleTextElement = (
  id: string,
  text: string,
  bounds: SceneTextElement['layout'],
  style: Partial<SceneTextElement['style']> = {}
): SceneTextElement => ({
  id,
  kind: 'text',
  text,
  layout: bounds,
  style: {
    fontFamily: style.fontFamily || 'Arial',
    fontSize: style.fontSize || 14,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fill: style.fill || '#111827',
    opacity: style.opacity,
    lineHeight: style.lineHeight || 1.15,
    letterSpacing: style.letterSpacing,
  },
  metadata: {
    textRole: 'plain',
    fontFamilies: [style.fontFamily || 'Arial'],
  },
});

const getRelationshipId = (root: Element, attributeName: string) => {
  return (
    root.getAttribute(`r:${attributeName}`) ||
    root.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      attributeName
    )
  );
};

const getCachedPointValues = (root: Element | null | undefined) => {
  if (!root) {
    return [];
  }
  const cache =
    getFirstByLocalName(root, 'strCache') ||
    getFirstByLocalName(root, 'numCache');
  if (!cache) {
    return [];
  }
  return getElementsByLocalName(cache, 'pt')
    .sort((left, right) => {
      return (
        Number(left.getAttribute('idx') || 0) -
        Number(right.getAttribute('idx') || 0)
      );
    })
    .map((point) => getFirstByLocalName(point, 'v')?.textContent || '')
    .filter(Boolean);
};

const parseChartTitle = (chartDocument: Document) => {
  const chart = getFirstByLocalName(chartDocument, 'chart');
  const title = chart ? getDirectChild(chart, 'title') : null;
  return title ? collectParagraphText(title).trim() : '';
};

const parseChartSeriesColor = (
  series: Element,
  themeColors: ThemeColorMap,
  fallback: string
) => {
  const seriesProperties = getFirstByLocalName(series, 'spPr');
  const lineProperties = seriesProperties
    ? getFirstByLocalName(seriesProperties, 'ln')
    : null;
  return (
    (lineProperties
      ? parseSolidFill(lineProperties, themeColors).color
      : undefined) ||
    (seriesProperties
      ? parseSolidFill(seriesProperties, themeColors).color
      : undefined) ||
    fallback
  );
};

const getChartSeriesValues = (series: Element) => {
  const categories = getCachedPointValues(getFirstByLocalName(series, 'cat'));
  const rawValues = getCachedPointValues(getFirstByLocalName(series, 'val'));
  const values = rawValues.map((value) => Number(value));
  const itemCount = Math.min(categories.length, values.length);
  const points = values
    .slice(0, itemCount)
    .map((value, index) => ({
      category: categories[index] || '',
      value,
    }))
    .filter((point) => Number.isFinite(point.value));
  return points;
};

const getScatterChartSeriesValues = (series: Element) => {
  const xValues = getCachedPointValues(getFirstByLocalName(series, 'xVal')).map(
    (value) => Number(value)
  );
  const yValues = getCachedPointValues(getFirstByLocalName(series, 'yVal')).map(
    (value) => Number(value)
  );
  const itemCount = Math.min(xValues.length, yValues.length);
  return xValues
    .slice(0, itemCount)
    .map((xValue, index) => ({
      xValue,
      yValue: yValues[index] ?? Number.NaN,
    }))
    .filter(
      (point) => Number.isFinite(point.xValue) && Number.isFinite(point.yValue)
    );
};

const getBubbleChartSeriesValues = (series: Element) => {
  const scatterPoints = getScatterChartSeriesValues(series);
  const bubbleSizes = getCachedPointValues(
    getFirstByLocalName(series, 'bubbleSize')
  ).map((value) => Number(value));
  return scatterPoints
    .map((point, index) => ({
      ...point,
      bubbleSize: bubbleSizes[index] ?? 1,
    }))
    .filter((point) => Number.isFinite(point.bubbleSize));
};

const getChartPointColorOverrides = (
  series: Element,
  themeColors: ThemeColorMap
) => {
  const colors = new Map<number, string>();
  getDirectChildren(series)
    .filter((child) => child.localName === 'dPt')
    .forEach((dataPoint) => {
      const index = Number(
        getFirstByLocalName(dataPoint, 'idx')?.getAttribute('val')
      );
      if (!Number.isFinite(index)) {
        return;
      }
      const shapeProperties = getFirstByLocalName(dataPoint, 'spPr');
      const color = shapeProperties
        ? parseSolidFill(shapeProperties, themeColors).color
        : undefined;
      if (color) {
        colors.set(index, color);
      }
    });
  return colors;
};

const getChartSeriesElements = (chart: Element) => {
  return getDirectChildren(chart).filter((child) => child.localName === 'ser');
};

const getChartSeriesFallbackColor = (
  themeColors: ThemeColorMap,
  index: number
) => {
  const fallbackColors = [
    themeColors.accent1 || '#4472C4',
    themeColors.accent2 || '#ED7D31',
    themeColors.accent3 || '#A5A5A5',
    themeColors.accent4 || '#FFC000',
    themeColors.accent5 || '#5B9BD5',
    themeColors.accent6 || '#70AD47',
  ];
  return fallbackColors[index % fallbackColors.length] || '#4472C4';
};

const getChartElementId = (
  baseId: string,
  part: string,
  seriesIndex: number,
  pointIndex: number,
  seriesCount: number
) => {
  return seriesCount > 1
    ? `${baseId}-${part}-${seriesIndex}-${pointIndex}`
    : `${baseId}-${part}-${pointIndex}`;
};

const buildChartElements = (
  graphicFrame: Element,
  baseId: string,
  rect: Rect,
  relationships: RelationshipMap,
  archive: ArchiveMap,
  themeColors: ThemeColorMap,
  warnings: string[]
) => {
  const chartReference = getFirstByLocalName(graphicFrame, 'chart');
  if (!chartReference) {
    return null;
  }
  const relId = getRelationshipId(chartReference, 'id');
  const chartPath = relId ? relationships[relId] : null;
  const chartDocument = chartPath ? readXmlEntry(archive, chartPath) : null;
  if (!chartPath || !chartDocument) {
    warnings.push(`图表资源缺失: ${baseId}`);
    return [];
  }

  const barChart = getFirstByLocalName(chartDocument, 'barChart');
  const lineChart = getFirstByLocalName(chartDocument, 'lineChart');
  const areaChart = getFirstByLocalName(chartDocument, 'areaChart');
  const scatterChart = getFirstByLocalName(chartDocument, 'scatterChart');
  const bubbleChart = getFirstByLocalName(chartDocument, 'bubbleChart');
  const pieChart = getFirstByLocalName(chartDocument, 'pieChart');
  const doughnutChart = getFirstByLocalName(chartDocument, 'doughnutChart');
  if (
    !barChart &&
    !lineChart &&
    !areaChart &&
    !scatterChart &&
    !bubbleChart &&
    !pieChart &&
    !doughnutChart
  ) {
    warnings.push(`暂未支持的图表类型: ${baseId}`);
    return [];
  }

  const chart =
    barChart ||
    lineChart ||
    areaChart ||
    scatterChart ||
    bubbleChart ||
    pieChart ||
    doughnutChart;
  const seriesList = chart ? getChartSeriesElements(chart) : [];
  if (!seriesList.length) {
    return [];
  }

  const title = parseChartTitle(chartDocument);
  const titleHeight = title ? Math.min(34, rect.height * 0.18) : 0;
  const labelHeight = Math.min(26, rect.height * 0.16);
  const valueHeight = Math.min(22, rect.height * 0.12);
  const chartTop = rect.y + titleHeight + valueHeight;
  const chartHeight = Math.max(
    1,
    rect.height - titleHeight - labelHeight - valueHeight
  );
  const elements: SceneElement[] = [];

  if (title) {
    elements.push(
      buildSimpleTextElement(
        `${baseId}-title`,
        title,
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: titleHeight,
          anchor: 'middle',
          baseline: 'alphabetic',
          rotation: rect.rotation,
          wrapMode: 'square',
        },
        {
          fontSize: Math.min(18, Math.max(12, titleHeight * 0.55)),
          fontWeight: 'bold',
        }
      )
    );
  }

  if (pieChart || doughnutChart) {
    const pieSeries = seriesList
      .map((series, seriesIndex) => ({
        series,
        seriesIndex,
        points: getChartSeriesValues(series),
        color: parseChartSeriesColor(
          series,
          themeColors,
          getChartSeriesFallbackColor(themeColors, seriesIndex)
        ),
        pointColorOverrides: getChartPointColorOverrides(series, themeColors),
      }))
      .filter((series) => series.points.length);
    const firstSeries = pieSeries[0];
    if (!firstSeries) {
      return elements;
    }
    const positivePoints = firstSeries.points.filter(
      (point) => point.value > 0
    );
    if (!positivePoints.length) {
      return elements;
    }
    const totalValue =
      positivePoints.reduce((sum, point) => sum + point.value, 0) || 1;
    const stackHeight = Math.max(12, Math.min(26, chartHeight * 0.22));
    const stackY = chartTop + Math.max(0, (chartHeight - stackHeight) / 2);
    const swatchSize = Math.max(8, Math.min(14, labelHeight * 0.55));
    let cursorX = rect.x;

    positivePoints.forEach((point, index) => {
      const segmentWidth = Math.max(3, (point.value / totalValue) * rect.width);
      const color =
        firstSeries.pointColorOverrides.get(index) ||
        getChartSeriesFallbackColor(themeColors, index);
      elements.push({
        id: `${baseId}-${doughnutChart ? 'doughnut' : 'pie'}-segment-${index}`,
        kind: 'shape',
        shapeType: 'rectangle',
        bounds: {
          x: cursorX,
          y: stackY,
          width: segmentWidth,
          height: stackHeight,
        },
        style: {
          fill: color,
          stroke: '#ffffff',
          strokeWidth: 1,
        },
      });
      elements.push({
        id: `${baseId}-${doughnutChart ? 'doughnut' : 'pie'}-swatch-${index}`,
        kind: 'shape',
        shapeType: 'rectangle',
        bounds: {
          x: rect.x,
          y: rect.y + titleHeight + index * labelHeight,
          width: swatchSize,
          height: swatchSize,
        },
        style: {
          fill: color,
          stroke: '#ffffff',
          strokeWidth: 1,
        },
      });
      elements.push(
        buildSimpleTextElement(
          `${baseId}-${doughnutChart ? 'doughnut' : 'pie'}-label-${index}`,
          `${point.category || index + 1}: ${point.value}`,
          {
            x: rect.x + swatchSize + 4,
            y: rect.y + titleHeight + index * labelHeight - 2,
            width: Math.max(1, rect.width - swatchSize - 4),
            height: labelHeight,
            anchor: 'start',
            baseline: 'alphabetic',
            rotation: rect.rotation,
            wrapMode: 'square',
          },
          {
            fontSize: Math.min(12, Math.max(8, labelHeight * 0.55)),
            fill: '#344054',
          }
        )
      );
      cursorX += segmentWidth;
    });

    return elements;
  }

  if (bubbleChart) {
    const bubbleSeries = seriesList
      .map((series, seriesIndex) => ({
        series,
        seriesIndex,
        points: getBubbleChartSeriesValues(series),
        color: parseChartSeriesColor(
          series,
          themeColors,
          getChartSeriesFallbackColor(themeColors, seriesIndex)
        ),
        pointColorOverrides: getChartPointColorOverrides(series, themeColors),
      }))
      .filter((series) => series.points.length);
    if (!bubbleSeries.length) {
      return elements;
    }
    const xValues = bubbleSeries.flatMap((series) =>
      series.points.map((point) => point.xValue)
    );
    const yValues = bubbleSeries.flatMap((series) =>
      series.points.map((point) => point.yValue)
    );
    const sizeValues = bubbleSeries.flatMap((series) =>
      series.points.map((point) => point.bubbleSize)
    );
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const minSizeValue = Math.min(...sizeValues);
    const maxSizeValue = Math.max(...sizeValues);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    const sizeRange = maxSizeValue - minSizeValue || 1;
    const plotPadding = Math.max(14, Math.min(34, rect.width * 0.1));
    const plotLeft = rect.x + plotPadding;
    const plotWidth = Math.max(1, rect.width - plotPadding * 2);
    const maxPointCount = Math.max(
      1,
      ...bubbleSeries.map((series) => series.points.length)
    );
    const columnWidth = rect.width / maxPointCount;
    const minBubbleSize = Math.max(8, Math.min(16, rect.width / 30));
    const maxBubbleSize = Math.max(
      minBubbleSize + 2,
      Math.min(34, rect.width / 10)
    );

    bubbleSeries.forEach((seriesData) => {
      seriesData.points.forEach((point, index) => {
        const x = plotLeft + ((point.xValue - minX) / xRange) * plotWidth;
        const y =
          chartTop +
          chartHeight -
          ((point.yValue - minY) / yRange) * chartHeight;
        const bubbleSize =
          minBubbleSize +
          ((point.bubbleSize - minSizeValue) / sizeRange) *
            (maxBubbleSize - minBubbleSize);
        const bubbleColor =
          seriesData.pointColorOverrides.get(index) || seriesData.color;
        elements.push({
          id: getChartElementId(
            baseId,
            'bubble',
            seriesData.seriesIndex,
            index,
            bubbleSeries.length
          ),
          kind: 'shape',
          shapeType: 'ellipse',
          bounds: {
            x: x - bubbleSize / 2,
            y: y - bubbleSize / 2,
            width: bubbleSize,
            height: bubbleSize,
          },
          style: {
            fill: bubbleColor,
            stroke: '#ffffff',
            strokeWidth: 1,
          },
        });
        elements.push(
          buildSimpleTextElement(
            getChartElementId(
              baseId,
              'bubble-size',
              seriesData.seriesIndex,
              index,
              bubbleSeries.length
            ),
            String(point.bubbleSize),
            {
              x: Math.max(rect.x, x - columnWidth / 2),
              y: Math.max(
                rect.y + titleHeight,
                y - bubbleSize / 2 - valueHeight
              ),
              width: columnWidth,
              height: valueHeight,
              anchor: 'middle',
              baseline: 'alphabetic',
              rotation: rect.rotation,
              wrapMode: 'square',
            },
            {
              fontSize: Math.min(12, Math.max(8, valueHeight * 0.6)),
              fill: '#344054',
            }
          )
        );
        elements.push(
          buildSimpleTextElement(
            getChartElementId(
              baseId,
              'bubble-x',
              seriesData.seriesIndex,
              index,
              bubbleSeries.length
            ),
            String(point.xValue),
            {
              x: Math.max(rect.x, x - columnWidth / 2),
              y: rect.y + rect.height - labelHeight,
              width: columnWidth,
              height: labelHeight,
              anchor: 'middle',
              baseline: 'alphabetic',
              rotation: rect.rotation,
              wrapMode: 'square',
            },
            { fontSize: Math.min(12, Math.max(8, labelHeight * 0.55)) }
          )
        );
      });
    });

    return elements;
  }

  if (scatterChart) {
    const scatterSeries = seriesList
      .map((series, seriesIndex) => ({
        series,
        seriesIndex,
        points: getScatterChartSeriesValues(series),
        color: parseChartSeriesColor(
          series,
          themeColors,
          getChartSeriesFallbackColor(themeColors, seriesIndex)
        ),
        pointColorOverrides: getChartPointColorOverrides(series, themeColors),
      }))
      .filter((series) => series.points.length);
    if (!scatterSeries.length) {
      return elements;
    }
    const xValues = scatterSeries.flatMap((series) =>
      series.points.map((point) => point.xValue)
    );
    const yValues = scatterSeries.flatMap((series) =>
      series.points.map((point) => point.yValue)
    );
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    const plotPadding = Math.max(10, Math.min(28, rect.width * 0.08));
    const plotLeft = rect.x + plotPadding;
    const plotWidth = Math.max(1, rect.width - plotPadding * 2);
    const maxPointCount = Math.max(
      1,
      ...scatterSeries.map((series) => series.points.length)
    );
    const columnWidth = rect.width / maxPointCount;
    const markerSize = Math.max(6, Math.min(12, rect.width / 40));

    scatterSeries.forEach((seriesData) => {
      const linePoints = seriesData.points.map((point) => {
        const x = plotLeft + ((point.xValue - minX) / xRange) * plotWidth;
        const y =
          chartTop +
          chartHeight -
          ((point.yValue - minY) / yRange) * chartHeight;
        return { x, y };
      });

      linePoints.slice(0, -1).forEach((point, index) => {
        const nextPoint = linePoints[index + 1];
        if (!nextPoint) {
          return;
        }
        elements.push({
          id: getChartElementId(
            baseId,
            'scatter-line',
            seriesData.seriesIndex,
            index,
            scatterSeries.length
          ),
          kind: 'connector',
          routing: {
            shape: 'straight',
            points: [
              [point.x, point.y],
              [nextPoint.x, nextPoint.y],
            ],
          },
          style: {
            stroke: seriesData.color,
            strokeWidth: 2,
            startMarker: 'none',
            endMarker: 'none',
          },
        });
      });

      seriesData.points.forEach((point, index) => {
        const markerCenter = linePoints[index];
        if (!markerCenter) {
          return;
        }
        const markerColor =
          seriesData.pointColorOverrides.get(index) || seriesData.color;
        elements.push({
          id: getChartElementId(
            baseId,
            'scatter-marker',
            seriesData.seriesIndex,
            index,
            scatterSeries.length
          ),
          kind: 'shape',
          shapeType: 'ellipse',
          bounds: {
            x: markerCenter.x - markerSize / 2,
            y: markerCenter.y - markerSize / 2,
            width: markerSize,
            height: markerSize,
          },
          style: {
            fill: markerColor,
            stroke: '#ffffff',
            strokeWidth: 1,
          },
        });
        elements.push(
          buildSimpleTextElement(
            getChartElementId(
              baseId,
              'scatter-y',
              seriesData.seriesIndex,
              index,
              scatterSeries.length
            ),
            String(point.yValue),
            {
              x: Math.max(rect.x, markerCenter.x - columnWidth / 2),
              y: Math.max(rect.y + titleHeight, markerCenter.y - valueHeight),
              width: columnWidth,
              height: valueHeight,
              anchor: 'middle',
              baseline: 'alphabetic',
              rotation: rect.rotation,
              wrapMode: 'square',
            },
            {
              fontSize: Math.min(12, Math.max(8, valueHeight * 0.6)),
              fill: '#344054',
            }
          )
        );
        elements.push(
          buildSimpleTextElement(
            getChartElementId(
              baseId,
              'scatter-x',
              seriesData.seriesIndex,
              index,
              scatterSeries.length
            ),
            String(point.xValue),
            {
              x: Math.max(rect.x, markerCenter.x - columnWidth / 2),
              y: rect.y + rect.height - labelHeight,
              width: columnWidth,
              height: labelHeight,
              anchor: 'middle',
              baseline: 'alphabetic',
              rotation: rect.rotation,
              wrapMode: 'square',
            },
            { fontSize: Math.min(12, Math.max(8, labelHeight * 0.55)) }
          )
        );
      });
    });

    return elements;
  }

  const valueSeries = seriesList
    .map((series, seriesIndex) => ({
      series,
      seriesIndex,
      points: getChartSeriesValues(series),
      color: parseChartSeriesColor(
        series,
        themeColors,
        getChartSeriesFallbackColor(themeColors, seriesIndex)
      ),
      pointColorOverrides: getChartPointColorOverrides(series, themeColors),
    }))
    .filter((series) => series.points.length);
  if (!valueSeries.length) {
    return elements;
  }

  const itemCount = Math.max(
    1,
    ...valueSeries.map((series) => series.points.length)
  );
  const columnWidth = rect.width / itemCount;

  if (lineChart || areaChart) {
    const allValues = valueSeries.flatMap((series) =>
      series.points.map((point) => point.value)
    );
    const minValue = Math.min(0, ...allValues);
    const maxValue = Math.max(...allValues, 1);
    const range = maxValue - minValue || 1;
    const markerSize = Math.max(6, Math.min(12, rect.width / 36));

    valueSeries.forEach((seriesData) => {
      const xStep =
        seriesData.points.length > 1
          ? rect.width / (seriesData.points.length - 1)
          : 0;
      const linePoints = seriesData.points.map((point, index) => {
        const x =
          seriesData.points.length > 1
            ? rect.x + index * xStep
            : rect.x + rect.width / 2;
        const y =
          chartTop +
          chartHeight -
          ((point.value - minValue) / range) * chartHeight;
        return { x, y };
      });

      linePoints.slice(0, -1).forEach((point, index) => {
        const nextPoint = linePoints[index + 1];
        if (!nextPoint) {
          return;
        }
        elements.push({
          id: getChartElementId(
            baseId,
            areaChart ? 'area-line' : 'line',
            seriesData.seriesIndex,
            index,
            valueSeries.length
          ),
          kind: 'connector',
          routing: {
            shape: 'straight',
            points: [
              [point.x, point.y],
              [nextPoint.x, nextPoint.y],
            ],
          },
          style: {
            stroke: seriesData.color,
            strokeWidth: 2,
            startMarker: 'none',
            endMarker: 'none',
          },
        });
      });

      seriesData.points.forEach((point, index) => {
        const markerCenter = linePoints[index];
        if (!markerCenter) {
          return;
        }
        const markerColor =
          seriesData.pointColorOverrides.get(index) || seriesData.color;
        elements.push({
          id: getChartElementId(
            baseId,
            areaChart ? 'area-marker' : 'marker',
            seriesData.seriesIndex,
            index,
            valueSeries.length
          ),
          kind: 'shape',
          shapeType: 'ellipse',
          bounds: {
            x: markerCenter.x - markerSize / 2,
            y: markerCenter.y - markerSize / 2,
            width: markerSize,
            height: markerSize,
          },
          style: {
            fill: markerColor,
            stroke: '#ffffff',
            strokeWidth: 1,
          },
        });
        elements.push(
          buildSimpleTextElement(
            getChartElementId(
              baseId,
              areaChart ? 'area-value' : 'value',
              seriesData.seriesIndex,
              index,
              valueSeries.length
            ),
            String(point.value),
            {
              x: Math.max(rect.x, markerCenter.x - columnWidth / 2),
              y: Math.max(rect.y + titleHeight, markerCenter.y - valueHeight),
              width: columnWidth,
              height: valueHeight,
              anchor: 'middle',
              baseline: 'alphabetic',
              rotation: rect.rotation,
              wrapMode: 'square',
            },
            {
              fontSize: Math.min(12, Math.max(8, valueHeight * 0.6)),
              fill: '#344054',
            }
          )
        );
        elements.push(
          buildSimpleTextElement(
            getChartElementId(
              baseId,
              areaChart ? 'area-label' : 'label',
              seriesData.seriesIndex,
              index,
              valueSeries.length
            ),
            point.category,
            {
              x: Math.max(rect.x, markerCenter.x - columnWidth / 2),
              y: rect.y + rect.height - labelHeight,
              width: columnWidth,
              height: labelHeight,
              anchor: 'middle',
              baseline: 'alphabetic',
              rotation: rect.rotation,
              wrapMode: 'square',
            },
            { fontSize: Math.min(12, Math.max(8, labelHeight * 0.55)) }
          )
        );
      });
    });

    return elements;
  }

  const maxValue = Math.max(
    1,
    ...valueSeries.flatMap((series) =>
      series.points.map((point) => point.value)
    )
  );
  const clusterWidth = columnWidth * 0.72;
  const barWidth = Math.max(3, clusterWidth / valueSeries.length);
  valueSeries.forEach((seriesData, seriesPosition) => {
    seriesData.points.forEach((point, index) => {
      const value = point.value;
      const barHeight = Math.max(1, (value / maxValue) * chartHeight);
      const clusterX =
        rect.x + index * columnWidth + (columnWidth - clusterWidth) / 2;
      const barX = clusterX + seriesPosition * barWidth;
      const barY = chartTop + chartHeight - barHeight;
      const barColor =
        seriesData.pointColorOverrides.get(index) || seriesData.color;
      elements.push({
        id: getChartElementId(
          baseId,
          'bar',
          seriesData.seriesIndex,
          index,
          valueSeries.length
        ),
        kind: 'shape',
        shapeType: 'rectangle',
        bounds: {
          x: barX,
          y: barY,
          width: barWidth,
          height: barHeight,
        },
        style: {
          fill: barColor,
          stroke: 'transparent',
          strokeWidth: 0,
        },
      });
      elements.push(
        buildSimpleTextElement(
          getChartElementId(
            baseId,
            'value',
            seriesData.seriesIndex,
            index,
            valueSeries.length
          ),
          String(value),
          {
            x: rect.x + index * columnWidth,
            y: rect.y + titleHeight + seriesPosition * valueHeight,
            width: columnWidth,
            height: valueHeight,
            anchor: 'middle',
            baseline: 'alphabetic',
            rotation: rect.rotation,
            wrapMode: 'square',
          },
          {
            fontSize: Math.min(12, Math.max(8, valueHeight * 0.6)),
            fill: '#344054',
          }
        )
      );
    });
  });

  const labelSeries = valueSeries[0];
  if (labelSeries) {
    labelSeries.points.forEach((point, index) => {
      elements.push(
        buildSimpleTextElement(
          `${baseId}-label-${index}`,
          point.category,
          {
            x: rect.x + index * columnWidth,
            y: rect.y + rect.height - labelHeight,
            width: columnWidth,
            height: labelHeight,
            anchor: 'middle',
            baseline: 'alphabetic',
            rotation: rect.rotation,
            wrapMode: 'square',
          },
          { fontSize: Math.min(12, Math.max(8, labelHeight * 0.55)) }
        )
      );
    });
  }

  return elements;
};

const getTableColumnWidths = (table: Element, tableWidth: number) => {
  const grid = getFirstByLocalName(table, 'tblGrid');
  const gridColumns = grid
    ? getDirectChildren(grid).filter((child) => child.localName === 'gridCol')
    : [];
  const rawWidths = gridColumns
    .map((column) => emuToPx(column.getAttribute('w')))
    .filter((width) => width > 0);
  const totalWidth = rawWidths.reduce((sum, width) => sum + width, 0);
  if (!rawWidths.length || totalWidth <= 0) {
    return [];
  }
  return rawWidths.map((width) => (width / totalWidth) * tableWidth);
};

const getTableRowHeights = (rows: Element[], tableHeight: number) => {
  const rawHeights = rows
    .map((row) => emuToPx(row.getAttribute('h')))
    .filter((height) => height > 0);
  const totalHeight = rawHeights.reduce((sum, height) => sum + height, 0);
  if (rawHeights.length !== rows.length || totalHeight <= 0) {
    return rows.map(() => tableHeight / Math.max(1, rows.length));
  }
  return rawHeights.map((height) => (height / totalHeight) * tableHeight);
};

const buildTableElements = (
  graphicFrame: Element,
  baseId: string,
  rect: Rect,
  slideIndex: number,
  themeColors: ThemeColorMap
) => {
  const table = getFirstByLocalName(graphicFrame, 'tbl');
  if (!table) {
    return null;
  }
  const rows = getDirectChildren(table).filter(
    (child) => child.localName === 'tr'
  );
  if (!rows.length) {
    return [];
  }

  const columnWidths = getTableColumnWidths(table, rect.width);
  const maxCellCount = Math.max(
    1,
    ...rows.map(
      (row) =>
        getDirectChildren(row).filter((child) => child.localName === 'tc')
          .length
    )
  );
  const fallbackColumnWidth = rect.width / maxCellCount;
  const rowHeights = getTableRowHeights(rows, rect.height);
  const elements: SceneElement[] = [];

  let y = rect.y;
  rows.forEach((row, rowIndex) => {
    let x = rect.x;
    const rowHeight = rowHeights[rowIndex] || rect.height / rows.length;
    const cells = getDirectChildren(row).filter(
      (child) => child.localName === 'tc'
    );
    cells.forEach((cell, cellIndex) => {
      const cellWidth = columnWidths[cellIndex] || fallbackColumnWidth;
      const cellRect: Rect = {
        x,
        y,
        width: cellWidth,
        height: rowHeight,
        rotation: rect.rotation,
        flipH: false,
        flipV: false,
      };
      const cellProperties = getDirectChild(cell, 'tcPr');
      const fill = cellProperties
        ? parseSolidFill(cellProperties, themeColors)
        : { color: undefined };
      elements.push({
        id: `${baseId}-cell-${rowIndex}-${cellIndex}`,
        kind: 'shape',
        shapeType: 'rectangle',
        bounds: {
          x,
          y,
          width: cellWidth,
          height: rowHeight,
        },
        style: {
          fill: fill.color || 'transparent',
          stroke: '#d0d5dd',
          strokeWidth: 1,
        },
      });

      const textBody = getDirectChild(cell, 'txBody');
      const textElement = textBody
        ? parseTextBody(
            textBody,
            `${baseId}-text-${rowIndex}-${cellIndex}`,
            cellRect,
            slideIndex,
            themeColors
          )
        : null;
      if (textElement) {
        elements.push(textElement);
      }
      x += cellWidth;
    });
    y += rowHeight;
  });
  return elements;
};

const processSlideChildElement = (
  child: Element,
  slideIndex: number,
  transformContext: TransformContext,
  relationships: RelationshipMap,
  archive: ArchiveMap,
  assets: SceneAsset[],
  assetUrlMap: Map<string, string>,
  warnings: string[],
  slideElements: SceneElement[],
  sequence: { value: number },
  themeColors: ThemeColorMap,
  textStyleContext: SlideTextStyleContext
) => {
  switch (child.localName) {
    case 'sp': {
      const rect = parseTransform(child, transformContext);
      if (!rect) {
        return;
      }
      const baseId = `pptx-slide-${slideIndex + 1}-shape-${sequence.value++}`;
      const shapeElement = buildShapeElement(
        child,
        `${baseId}-shape`,
        rect,
        themeColors,
        findPlaceholderShape(child, textStyleContext)
      );
      if (shapeElement) {
        slideElements.push(shapeElement);
      }
      const textElement = parseText(
        child,
        `${baseId}-text`,
        rect,
        slideIndex,
        themeColors,
        textStyleContext
      );
      if (textElement) {
        slideElements.push(textElement);
      }
      return;
    }
    case 'pic': {
      const rect = parseTransform(child, transformContext);
      if (!rect) {
        return;
      }
      const imageElement = buildImageElement(
        child,
        `pptx-slide-${slideIndex + 1}-image-${sequence.value++}`,
        rect,
        relationships,
        archive,
        assets,
        assetUrlMap,
        warnings
      );
      if (imageElement) {
        slideElements.push(imageElement);
      }
      return;
    }
    case 'cxnSp': {
      const rect = parseTransform(child, transformContext);
      if (!rect) {
        return;
      }
      slideElements.push(
        buildConnectorElement(
          child,
          `pptx-slide-${slideIndex + 1}-connector-${sequence.value++}`,
          rect,
          themeColors
        )
      );
      return;
    }
    case 'graphicFrame': {
      const rect = parseTransform(child, transformContext);
      if (!rect) {
        return;
      }
      const baseId = `pptx-slide-${slideIndex + 1}-graphic-${sequence.value++}`;
      const tableElements = buildTableElements(
        child,
        `${baseId}-table`,
        rect,
        slideIndex,
        themeColors
      );
      if (tableElements) {
        slideElements.push(...tableElements);
        return;
      }
      const chartElements = buildChartElements(
        child,
        `${baseId}-chart`,
        rect,
        relationships,
        archive,
        themeColors,
        warnings
      );
      if (chartElements) {
        slideElements.push(...chartElements);
      }
      return;
    }
    case 'grpSp': {
      const nestedContext = parseGroupTransformContext(child, transformContext);
      for (const nestedChild of getDirectChildren(child)) {
        processSlideChildElement(
          nestedChild,
          slideIndex,
          nestedContext,
          relationships,
          archive,
          assets,
          assetUrlMap,
          warnings,
          slideElements,
          sequence,
          themeColors,
          textStyleContext
        );
      }
      return;
    }
    default:
      return;
  }
};

const addSlideFrame = (
  elements: SceneElement[],
  slideIndex: number,
  slideSize: { width: number; height: number },
  slideOffsetY: number,
  fill: string
) => {
  elements.push({
    id: `pptx-slide-${slideIndex + 1}-frame`,
    kind: 'frame',
    shapeType: 'rectangle',
    bounds: {
      x: 0,
      y: slideOffsetY,
      width: slideSize.width,
      height: slideSize.height,
    },
    style: {
      fill,
      stroke: '#d0d5dd',
      strokeWidth: 1,
    },
  });
};

const parseBackgroundFromDocument = (
  slideDocument: Document,
  themeColors: ThemeColorMap
) => {
  const backgroundProperties = getFirstByLocalName(slideDocument, 'bgPr');
  if (backgroundProperties) {
    return parseSolidFill(backgroundProperties, themeColors).color;
  }
  const backgroundReference = getFirstByLocalName(slideDocument, 'bgRef');
  return backgroundReference
    ? parseHexColor(backgroundReference, themeColors)
    : undefined;
};

const buildBackgroundImageElementFromDocument = (
  document: Document | null | undefined,
  relationships: RelationshipMap,
  id: string,
  slideSize: { width: number; height: number },
  slideOffsetY: number,
  archive: ArchiveMap,
  assets: SceneAsset[],
  assetUrlMap: Map<string, string>,
  warnings: string[]
) => {
  if (!document) {
    return null;
  }
  const backgroundProperties = getFirstByLocalName(document, 'bgPr');
  const blipFill = backgroundProperties
    ? getFirstByLocalName(backgroundProperties, 'blipFill')
    : null;
  if (!blipFill) {
    return null;
  }
  return buildImageElementFromBlipFill(
    blipFill,
    id,
    {
      x: 0,
      y: slideOffsetY,
      width: slideSize.width,
      height: slideSize.height,
    },
    relationships,
    archive,
    assets,
    assetUrlMap,
    warnings
  );
};

const findRelatedPath = (relationships: RelationshipMap, pattern: RegExp) => {
  return Object.values(relationships).find((path) => pattern.test(path));
};

const getSlideLayoutPath = (slideRelationships: RelationshipMap) => {
  return findRelatedPath(
    slideRelationships,
    /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i
  );
};

const getLayoutMasterPath = (archive: ArchiveMap, layoutPath: string) => {
  const layoutRelationships = readRelationships(archive, layoutPath);
  return findRelatedPath(
    layoutRelationships,
    /^ppt\/slideMasters\/slideMaster\d+\.xml$/i
  );
};

const parseSlideBackground = (
  slideDocument: Document,
  themeColors: ThemeColorMap,
  archive: ArchiveMap,
  slideRelationships: RelationshipMap
) => {
  const slideBackground = parseBackgroundFromDocument(
    slideDocument,
    themeColors
  );
  if (slideBackground) {
    return slideBackground;
  }

  const layoutPath = getSlideLayoutPath(slideRelationships);
  const layoutDocument = layoutPath ? readXmlEntry(archive, layoutPath) : null;
  const layoutBackground = layoutDocument
    ? parseBackgroundFromDocument(layoutDocument, themeColors)
    : undefined;
  if (layoutBackground) {
    return layoutBackground;
  }

  const masterPath = layoutPath
    ? getLayoutMasterPath(archive, layoutPath)
    : undefined;
  const masterDocument = masterPath ? readXmlEntry(archive, masterPath) : null;
  const masterBackground = masterDocument
    ? parseBackgroundFromDocument(masterDocument, themeColors)
    : undefined;

  return masterBackground || '#ffffff';
};

const buildSlideBackgroundImageElement = (
  slideDocument: Document,
  slideRelationships: RelationshipMap,
  layoutDocument: Document | null,
  layoutPath: string | undefined,
  masterDocument: Document | null,
  masterPath: string | undefined,
  slideIndex: number,
  slideSize: { width: number; height: number },
  slideOffsetY: number,
  archive: ArchiveMap,
  assets: SceneAsset[],
  assetUrlMap: Map<string, string>,
  warnings: string[]
) => {
  const baseId = `pptx-slide-${slideIndex + 1}-background-image`;
  const slideBackground = buildBackgroundImageElementFromDocument(
    slideDocument,
    slideRelationships,
    baseId,
    slideSize,
    slideOffsetY,
    archive,
    assets,
    assetUrlMap,
    warnings
  );
  if (slideBackground) {
    return slideBackground;
  }

  const layoutRelationships = layoutPath
    ? readRelationships(archive, layoutPath)
    : {};
  const layoutBackground = buildBackgroundImageElementFromDocument(
    layoutDocument,
    layoutRelationships,
    `${baseId}-layout`,
    slideSize,
    slideOffsetY,
    archive,
    assets,
    assetUrlMap,
    warnings
  );
  if (layoutBackground) {
    return layoutBackground;
  }

  const masterRelationships = masterPath
    ? readRelationships(archive, masterPath)
    : {};
  return buildBackgroundImageElementFromDocument(
    masterDocument,
    masterRelationships,
    `${baseId}-master`,
    slideSize,
    slideOffsetY,
    archive,
    assets,
    assetUrlMap,
    warnings
  );
};

export const importPptxPackage = async (
  file: File
): Promise<PptxImportResult> => {
  const archive = buildArchiveMap(unzipSync(await readFileAsUint8Array(file)));
  if (
    !archive.has('[Content_Types].xml') ||
    !archive.has('ppt/presentation.xml')
  ) {
    throw new Error('PPTX 文件结构无效');
  }

  const slideSize = parseSlideSize(archive);
  const slides = parseSlideOrder(archive);
  const themeColors = parseThemeColors(archive);
  if (!slides.length) {
    throw new Error('PPTX 中未找到幻灯片');
  }

  const scene: SceneDocument = {
    type: 'drawnix-scene',
    version: 'pptx-import-v1',
    assets: [],
    elements: [],
  };
  const assetUrlMap = new Map<string, string>();
  const warnings: string[] = [];

  for (const slide of slides) {
    const slideDocument = readXmlEntry(archive, slide.path);
    if (!slideDocument) {
      warnings.push(`无法读取幻灯片: ${slide.path}`);
      continue;
    }

    const slideThemeColors = resolveSlideThemeColors(
      themeColors,
      slideDocument
    );
    const slideOffsetY = slide.index * (slideSize.height + SLIDE_GAP_PX);
    const slideElements: SceneElement[] = [];
    const relationships = readRelationships(archive, slide.path);
    const layoutPath = getSlideLayoutPath(relationships);
    const layoutDocument = layoutPath
      ? readXmlEntry(archive, layoutPath)
      : null;
    const masterPath = layoutPath
      ? getLayoutMasterPath(archive, layoutPath)
      : undefined;
    const masterDocument = masterPath
      ? readXmlEntry(archive, masterPath)
      : null;
    const textStyleContext = buildSlideTextStyleContext(
      layoutDocument,
      masterDocument
    );
    addSlideFrame(
      slideElements,
      slide.index,
      slideSize,
      slideOffsetY,
      parseSlideBackground(
        slideDocument,
        slideThemeColors,
        archive,
        relationships
      )
    );
    const backgroundImageElement = buildSlideBackgroundImageElement(
      slideDocument,
      relationships,
      layoutDocument,
      layoutPath,
      masterDocument,
      masterPath,
      slide.index,
      slideSize,
      slideOffsetY,
      archive,
      scene.assets,
      assetUrlMap,
      warnings
    );
    if (backgroundImageElement) {
      slideElements.push(backgroundImageElement);
    }
    const sequence = { value: 0 };
    const spTree = getFirstByLocalName(slideDocument, 'spTree');
    const sourceChildren = spTree
      ? getDirectChildren(spTree)
      : getDirectChildren(slideDocument.documentElement);
    const transformContext = createSlideTransformContext(slideOffsetY);
    for (const child of sourceChildren) {
      processSlideChildElement(
        child,
        slide.index,
        transformContext,
        relationships,
        archive,
        scene.assets,
        assetUrlMap,
        warnings,
        slideElements,
        sequence,
        slideThemeColors,
        textStyleContext
      );
    }

    const unsupportedGraphicFrames = getElementsByLocalName(
      slideDocument,
      'graphicFrame'
    ).filter(
      (graphicFrame) =>
        !getFirstByLocalName(graphicFrame, 'tbl') &&
        !getFirstByLocalName(graphicFrame, 'chart')
    ).length;
    if (unsupportedGraphicFrames) {
      warnings.push(
        `第 ${
          slide.index + 1
        } 页包含 ${unsupportedGraphicFrames} 个暂未转为可编辑元素的图表/SmartArt`
      );
    }

    scene.elements.push(...slideElements);
  }

  const compiled = compileSceneToDrawnix(scene, assetUrlMap, {
    preserveSourceOrder: true,
    preferSourceFontFamily: true,
  });
  const summary = {
    ...compiled.summary,
    warnings: [...warnings, ...compiled.summary.warnings],
  };

  return {
    elements: compiled.elements,
    summary,
    meta: {
      slideCount: slides.length,
      assetCount: scene.assets.length,
      unsupportedCount: warnings.length,
    },
    descriptionLines: [
      file.name || 'presentation.pptx',
      'Import: pptx',
      `slides: ${slides.length}`,
      `assets: ${scene.assets.length}`,
      `warnings: ${warnings.length}`,
    ],
  };
};
