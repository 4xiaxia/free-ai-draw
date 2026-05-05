import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteFragment,
  duplicateElements,
  getRectangleByElements,
  getSelectedElements,
  PlaitBoard,
  PlaitElement,
} from '@plait/core';
import { useBoard } from '@plait-board/react-board';
import { Alignment, CustomText } from '@plait/common';
import { PlaitDrawElement } from '@plait/draw';
import { getTextMarksByElement } from '@plait/text-plugins';
import classNames from 'classnames';
import {
  applyTextCase,
  setFillColorOpacity,
  setElementAngle,
  setElementGradient,
  setElementGradientPreset,
  setElementImageFill,
  setElementOpacity,
  setElementPosition,
  setElementShadow,
  setElementShadowProperty,
  setElementSize,
  setFillColor,
  setRectangleCornerRadius,
  setSelectedShape,
  setStrokeColor,
  setStrokeColorOpacity,
  setStrokeWidth,
  setTextAlign,
  setTextColor,
  setTextColorOpacity,
  setTextFontFamily,
  setTextFontSize,
  setTextFontWeight,
  setTextLetterSpacing,
  setTextLineHeight,
  setTextScript,
  toggleTextMark,
} from '../../../transforms/property';
import type { DrawnixElementGradient } from '../../../transforms/property';
import {
  getConfiguredFontFamilyOptions,
  resolveFontFamilyOption,
} from '../../../constants/font';
import {
  CLASSIC_COLORS,
  NO_COLOR,
  TRANSPARENT,
} from '../../../constants/color';
import { isTextFragmentMetadata } from '../../../scene-import/text-fragment';
import { getCurrentFill, getCurrentStrokeColor } from '../../../utils/property';
import { hexAlphaToOpacity, removeHexAlpha } from '../../../utils/color';
import {
  getElementState,
  hasFillProperty,
  hasStrokeProperty,
  hasTextProperty,
} from '../popup-toolbar/popup-toolbar';
import { SHAPES } from '../../shape-picker';
import { Translations, useI18n } from '../../../i18n';
import {
  alignSelection,
  distributeSelection,
} from '../../../transforms/arrange';
import {
  moveSelectionOneStepPreservingBackground,
  moveSelectionToEdgePreservingBackground,
} from '../../../utils/background-layer';
import {
  createAssetLibraryItemFromFile,
  SUPPORTED_ASSET_MIME_TYPES,
} from '../../../asset-library/utils';
import './selection-property-panel.scss';

const TEXT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24, 28, 32, 44, 56, 72];
const VISIBLE_COLORS = CLASSIC_COLORS.slice(0, 12);
const RECENT_COLORS_STORAGE_KEY = 'drawnix:selection-panel-recent-colors:v1';
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const FONT_WEIGHT_OPTIONS = [
  { label: '常规', value: '400' },
  { label: '中等', value: '500' },
  { label: '半粗', value: '600' },
  { label: '粗体', value: '700' },
];
const GRADIENT_PRESETS: Array<
  DrawnixElementGradient & {
    id: string;
    label: string;
  }
> = [
  {
    id: 'graphite',
    label: '墨灰',
    type: 'linear',
    angle: 90,
    from: '#F8FAFC',
    to: '#111827',
  },
  {
    id: 'violet',
    label: '蓝紫',
    type: 'radial',
    angle: 135,
    from: '#93C5FD',
    to: '#7C3AED',
  },
  {
    id: 'mint',
    label: '青绿',
    type: 'radial',
    angle: 135,
    from: '#A7F3D0',
    to: '#14B8A6',
  },
  {
    id: 'rose',
    label: '玫粉',
    type: 'radial',
    angle: 135,
    from: '#FCE7F3',
    to: '#E11D48',
  },
  {
    id: 'ember',
    label: '霞光',
    type: 'linear',
    angle: 135,
    from: '#FDE68A',
    to: '#F97316',
  },
  {
    id: 'ice',
    label: '冰蓝',
    type: 'radial',
    angle: 135,
    from: '#DBEAFE',
    to: '#38BDF8',
  },
  {
    id: 'forest',
    label: '松绿',
    type: 'linear',
    angle: 135,
    from: '#6EE7B7',
    to: '#14532D',
  },
  {
    id: 'silver',
    label: '银白',
    type: 'linear',
    angle: 135,
    from: '#FFFFFF',
    to: '#CBD5E1',
  },
  {
    id: 'gold',
    label: '暖金',
    type: 'radial',
    angle: 135,
    from: '#FEF3C7',
    to: '#F59E0B',
  },
];
const DEFAULT_GRADIENT_PRESET = GRADIENT_PRESETS[0];

const isEditableShape = (element: PlaitElement) => {
  return (
    PlaitDrawElement.isShapeElement(element) &&
    !PlaitDrawElement.isText(element) &&
    !PlaitDrawElement.isImage(element) &&
    !PlaitDrawElement.isArrowLine(element) &&
    !PlaitDrawElement.isVectorLine(element)
  );
};

const hasSelectionPanelTextSection = (
  board: PlaitBoard,
  element: PlaitElement
) => {
  const metadata = (element as Record<string, unknown>)['sceneImportMetadata'];
  if (PlaitDrawElement.isDrawElement(element)) {
    return (
      PlaitDrawElement.isText(element) ||
      (PlaitDrawElement.isImage(element) && isTextFragmentMetadata(metadata))
    );
  }
  return hasTextProperty(board, element);
};

const getTextLeafValue = (
  value: unknown,
  getValue: (record: Record<string, unknown>) => unknown
): unknown => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const direct = getValue(record);
  if (direct !== undefined && direct !== null && direct !== '') {
    return direct;
  }
  if (Array.isArray(record['children'])) {
    for (const child of record['children'] as unknown[]) {
      const nested = getTextLeafValue(child, getValue);
      if (nested !== undefined && nested !== null && nested !== '') {
        return nested;
      }
    }
  }
  return undefined;
};

const getCurrentFontSize = (
  element: PlaitElement,
  marks?: Omit<CustomText, 'text'>
) => {
  const markValue = marks?.['font-size'];
  const markSize =
    typeof markValue === 'number' ? markValue : Number(markValue || undefined);
  if (Number.isFinite(markSize) && markSize > 0) {
    return markSize;
  }

  const rawElement = element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata)) {
    return fragmentMetadata.style.fontSize;
  }

  const textStyle = rawElement['textStyle'] as
    | Record<string, unknown>
    | undefined;
  const textProperties = rawElement['textProperties'] as
    | Record<string, unknown>
    | undefined;
  const styleValue = textStyle?.fontSize ?? textStyle?.['font-size'];
  const propertyValue =
    textProperties?.['font-size'] ?? textProperties?.fontSize;
  const leafValue = getTextLeafValue(
    rawElement['text'],
    (record) => record['font-size']
  );
  const size = Number(styleValue ?? propertyValue ?? leafValue);
  return Number.isFinite(size) && size > 0 ? size : undefined;
};

const getCurrentFontFamily = (
  element: PlaitElement,
  marks?: Omit<CustomText, 'text'>
) => {
  const fromMarks =
    (marks as any)?.fontFamily ?? (marks as any)?.['font-family'];
  if (typeof fromMarks === 'string' && fromMarks.trim()) {
    return fromMarks;
  }

  const rawElement = element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata)) {
    return fragmentMetadata.style.fontFamily;
  }

  const textStyle = rawElement['textStyle'] as
    | Record<string, unknown>
    | undefined;
  const textProperties = rawElement['textProperties'] as
    | Record<string, unknown>
    | undefined;
  const styleValue = textStyle?.fontFamily ?? textStyle?.['font-family'];
  const propertyValue =
    textProperties?.fontFamily ?? textProperties?.['font-family'];
  const leafValue = getTextLeafValue(
    rawElement['text'],
    (record) => record['fontFamily'] ?? record['font-family']
  );
  const value = styleValue ?? propertyValue ?? leafValue;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const getCurrentAlign = (element: PlaitElement) => {
  const rawElement = element as Record<string, unknown>;
  const text = rawElement['text'];
  const direct = getTextLeafValue(text, (record) => record['align']);
  if (
    direct === Alignment.left ||
    direct === Alignment.center ||
    direct === Alignment.right
  ) {
    return direct;
  }
  return Alignment.center;
};

const getRawNumber = (
  element: PlaitElement,
  keys: string[],
  fallback?: number
) => {
  const rawElement = element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  for (const key of keys) {
    const direct = rawElement[key];
    const textStyle = rawElement['textStyle'] as
      | Record<string, unknown>
      | undefined;
    const textProperties = rawElement['textProperties'] as
      | Record<string, unknown>
      | undefined;
    const fragmentValue = isTextFragmentMetadata(fragmentMetadata)
      ? (fragmentMetadata.style as Record<string, unknown>)[key]
      : undefined;
    const leafValue = getTextLeafValue(
      rawElement['text'],
      (record) => record[key]
    );
    const value =
      direct ??
      textStyle?.[key] ??
      textProperties?.[key] ??
      fragmentValue ??
      leafValue;
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }
  return fallback;
};

const getRawString = (element: PlaitElement, keys: string[], fallback = '') => {
  const rawElement = element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  for (const key of keys) {
    const textStyle = rawElement['textStyle'] as
      | Record<string, unknown>
      | undefined;
    const textProperties = rawElement['textProperties'] as
      | Record<string, unknown>
      | undefined;
    const fragmentValue = isTextFragmentMetadata(fragmentMetadata)
      ? (fragmentMetadata.style as Record<string, unknown>)[key]
      : undefined;
    const leafValue = getTextLeafValue(
      rawElement['text'],
      (record) => record[key]
    );
    const value =
      rawElement[key] ??
      textStyle?.[key] ??
      textProperties?.[key] ??
      fragmentValue ??
      leafValue;
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return fallback;
};

const getSelectionTypeLabel = (elements: PlaitElement[]) => {
  if (elements.length > 1) {
    return '多选对象';
  }
  const element = elements[0];
  if (!element) {
    return '对象';
  }
  const metadata = (element as Record<string, unknown>)['sceneImportMetadata'];
  if (PlaitDrawElement.isImage(element) && isTextFragmentMetadata(metadata)) {
    return '文本片段';
  }
  if (PlaitDrawElement.isImage(element)) {
    return '图片';
  }
  if (PlaitDrawElement.isArrowLine(element)) {
    return '箭头';
  }
  if (PlaitDrawElement.isText(element)) {
    return '文本';
  }
  if (PlaitDrawElement.isShapeElement(element)) {
    return '图形';
  }
  return '对象';
};

const getShapeTitle = (title: string, t: (key: keyof Translations) => string) =>
  t((title || 'toolbar.shape') as keyof Translations);

const normalizeHexColor = (value: string) => {
  const trimmed = removeHexAlpha(value.trim());
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toUpperCase();
  }
  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toUpperCase() : '';
};

const normalizeGradientAngleValue = (angle: number) => {
  return ((Math.round(angle) % 360) + 360) % 360;
};

const getGradientPresetPreview = (gradient: DrawnixElementGradient) => {
  return getGradientSurfacePreview(gradient);
};

const getGradientSurfacePreview = (gradient: DrawnixElementGradient) => {
  if (gradient.type === 'radial') {
    return `radial-gradient(circle at 50% 50%, ${gradient.from}, ${gradient.to})`;
  }
  return `linear-gradient(${normalizeGradientAngleValue(gradient.angle)}deg, ${
    gradient.from
  }, ${gradient.to})`;
};

const isGradientPresetActive = (
  state: {
    gradientType: string;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;
  },
  preset: DrawnixElementGradient
) => {
  return (
    state.gradientType === preset.type &&
    normalizeHexColor(state.gradientFrom) === normalizeHexColor(preset.from) &&
    normalizeHexColor(state.gradientTo) === normalizeHexColor(preset.to) &&
    normalizeGradientAngleValue(state.gradientAngle) ===
      normalizeGradientAngleValue(preset.angle)
  );
};

const getColorOpacityValue = (value?: string) => {
  if (!value || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value.trim())) {
    return 100;
  }
  return Math.round(hexAlphaToOpacity(value));
};

const loadRecentColors = () => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(RECENT_COLORS_STORAGE_KEY);
    const colors = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(colors)
      ? colors.filter((color) => typeof color === 'string').slice(0, 8)
      : [];
  } catch {
    return [];
  }
};

const saveRecentColors = (colors: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      RECENT_COLORS_STORAGE_KEY,
      JSON.stringify(colors.slice(0, 8))
    );
  } catch {
    // localStorage may be unavailable in private or embedded environments.
  }
};

export const SelectionPropertyPanel: React.FC = () => {
  const board = useBoard();
  const { t } = useI18n();
  const selectedElements = getSelectedElements(board);
  const imageFillInputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [dismissedSelectionKey, setDismissedSelectionKey] = useState('');
  const [imageFillError, setImageFillError] = useState('');
  const selectedElement = selectedElements[0];
  const selectionKey = selectedElements.map((element) => element.id).join('|');
  const open =
    selectedElements.length > 0 &&
    !PlaitBoard.hasBeenTextEditing(board) &&
    dismissedSelectionKey !== selectionKey;

  useEffect(() => {
    if (dismissedSelectionKey && dismissedSelectionKey !== selectionKey) {
      setDismissedSelectionKey('');
    }
    setImageFillError('');
  }, [dismissedSelectionKey, selectionKey]);

  useEffect(() => {
    if (open) {
      setCollapsed(true);
    }
  }, [open, selectionKey]);

  const state = useMemo(() => {
    if (!open || !selectedElement) {
      return null;
    }
    const elementState = getElementState(board);
    const marks = getTextMarksByElement(selectedElement);
    const rectangle = getRectangleByElements(board, selectedElements, false);
    const hasText = selectedElements.some((element) =>
      hasSelectionPanelTextSection(board, element)
    );
    const hasFill = selectedElements.some((element) =>
      hasFillProperty(board, element)
    );
    const hasStroke = selectedElements.some((element) =>
      hasStrokeProperty(board, element)
    );
    const shape = (selectedElement as { shape?: string }).shape;
    const gradient =
      (selectedElement as Record<string, unknown>)['gradient'] &&
      typeof (selectedElement as Record<string, unknown>)['gradient'] ===
        'object'
        ? ((selectedElement as Record<string, unknown>)['gradient'] as Record<
            string,
            unknown
          >)
        : {};
    const shadow =
      (selectedElement as Record<string, unknown>)['shadow'] &&
      typeof (selectedElement as Record<string, unknown>)['shadow'] === 'object'
        ? ((selectedElement as Record<string, unknown>)['shadow'] as Record<
            string,
            unknown
          >)
        : {};
    const imageFill =
      (selectedElement as Record<string, unknown>)['imageFill'] &&
      typeof (selectedElement as Record<string, unknown>)['imageFill'] ===
        'object'
        ? ((selectedElement as Record<string, unknown>)['imageFill'] as Record<
            string,
            unknown
          >)
        : {};
    return {
      ...elementState,
      marks,
      typeLabel: getSelectionTypeLabel(selectedElements),
      x: Math.round(rectangle.x || 0),
      y: Math.round(rectangle.y || 0),
      width: Math.round(Math.abs(rectangle.width || 0)),
      height: Math.round(Math.abs(rectangle.height || 0)),
      hasText,
      hasFill,
      hasStroke,
      fontSize: getCurrentFontSize(selectedElement, marks),
      fontFamily: getCurrentFontFamily(selectedElement, marks),
      align: getCurrentAlign(selectedElement),
      fill: getCurrentFill(board, selectedElement),
      strokeColor: getCurrentStrokeColor(board, selectedElement),
      strokeWidth: getRawNumber(selectedElement, ['strokeWidth'], 1),
      opacity: getRawNumber(selectedElement, ['opacity'], 1),
      angle: getRawNumber(selectedElement, ['angle'], 0),
      radius: getRawNumber(selectedElement, ['radius'], 0),
      shadowEnabled: Boolean(
        (selectedElement as Record<string, unknown>)['shadow']
      ),
      gradientEnabled: Boolean(
        (selectedElement as Record<string, unknown>)['gradient']
      ),
      gradientFrom:
        typeof gradient['from'] === 'string' ? gradient['from'] : '#ffffff',
      gradientTo:
        typeof gradient['to'] === 'string'
          ? gradient['to']
          : getCurrentFill(board, selectedElement) || '#dbeafe',
      gradientAngle: Number.isFinite(Number(gradient['angle']))
        ? Number(gradient['angle'])
        : 90,
      gradientType: gradient['type'] === 'radial' ? 'radial' : 'linear',
      shadowColor:
        typeof shadow['color'] === 'string' ? shadow['color'] : '#1118272E',
      shadowOffsetX: Number.isFinite(Number(shadow['offsetX']))
        ? Number(shadow['offsetX'])
        : 0,
      shadowOffsetY: Number.isFinite(Number(shadow['offsetY']))
        ? Number(shadow['offsetY'])
        : 8,
      shadowBlur: Number.isFinite(Number(shadow['blur']))
        ? Number(shadow['blur'])
        : 18,
      imageFillEnabled: typeof imageFill['dataUrl'] === 'string',
      imageFillName:
        typeof imageFill['name'] === 'string' ? imageFill['name'] : '图片填充',
      fontWeight: getRawString(selectedElement, ['fontWeight'], '400'),
      lineHeight: getRawNumber(
        selectedElement,
        ['lineHeight', 'line-height'],
        1.5
      ),
      letterSpacing: getRawNumber(
        selectedElement,
        ['letterSpacing', 'letter-spacing'],
        0
      ),
      script: getRawString(
        selectedElement,
        ['verticalAlign', 'baselineShift'],
        'normal'
      ),
      hasShapeSwitch: selectedElements.every(isEditableShape),
      shape,
    };
  }, [board, board.children, board.selection, board.viewport, open]);

  if (!open || !state || !selectedElement) {
    return null;
  }

  const fontOptions = getConfiguredFontFamilyOptions();
  const currentFontOption = resolveFontFamilyOption(state.fontFamily);
  const textColor = state.marks?.color || '#111827';
  const applyImageFillFile = async (file?: File) => {
    if (!file) {
      return;
    }
    try {
      const asset = await createAssetLibraryItemFromFile(file);
      setElementImageFill(board, {
        dataUrl: asset.dataUrl,
        name: asset.name,
        mimeType: asset.mimeType,
      });
      setImageFillError('');
    } catch {
      setImageFillError(
        '图片填充仅支持 SVG、PNG、JPG、JPEG、WebP，单个文件不超过 8MB'
      );
    } finally {
      if (imageFillInputRef.current) {
        imageFillInputRef.current.value = '';
      }
    }
  };

  return (
    <aside
      className={classNames('selection-property-panel', {
        'selection-property-panel--collapsed': collapsed,
      })}
      aria-label="属性设置"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
      }}
    >
      <header className="selection-property-panel__header">
        <div>
          <div className="selection-property-panel__title">属性设置</div>
          <div className="selection-property-panel__meta">
            {state.typeLabel} · {selectedElements.length} 个 · {state.width} x{' '}
            {state.height}
          </div>
        </div>
        <div className="selection-property-panel__header-actions">
          <button
            type="button"
            className="selection-property-panel__collapse"
            aria-label={collapsed ? '展开属性面板' : '收起属性面板'}
            title={collapsed ? '展开属性面板' : '收起属性面板'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? '›' : '‹'}
          </button>
          <button
            type="button"
            className="selection-property-panel__close"
            aria-label="关闭属性面板"
            title="关闭属性面板"
            onClick={() => setDismissedSelectionKey(selectionKey)}
          >
            ×
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="selection-property-panel__body">
          {state.hasText && (
            <section className="selection-property-panel__section selection-property-panel__section--text">
              <div className="selection-property-panel__section-heading">
                <div>
                  <div className="selection-property-panel__section-title">
                    文字
                  </div>
                  <div className="selection-property-panel__section-subtitle">
                    字体、段落与色彩
                  </div>
                </div>
              </div>
              <div className="selection-property-panel__control-card">
                <label className="selection-property-panel__field">
                  <span>字体</span>
                  <select
                    value={currentFontOption.value}
                    onChange={(event) =>
                      setTextFontFamily(board, event.currentTarget.value)
                    }
                  >
                    {fontOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="selection-property-panel__inline-fields selection-property-panel__inline-fields--size">
                  <label className="selection-property-panel__field">
                    <span>字号</span>
                    <input
                      type="number"
                      min={8}
                      max={160}
                      value={state.fontSize || 16}
                      onChange={(event) =>
                        setTextFontSize(
                          board,
                          Number(event.currentTarget.value)
                        )
                      }
                    />
                  </label>
                  <label className="selection-property-panel__field">
                    <span>预设</span>
                    <select
                      value={state.fontSize || 16}
                      onChange={(event) =>
                        setTextFontSize(
                          board,
                          Number(event.currentTarget.value)
                        )
                      }
                    >
                      {TEXT_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}px
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="selection-property-panel__field">
                  <span>字重</span>
                  <select
                    value={
                      FONT_WEIGHT_OPTIONS.some(
                        (option) => option.value === String(state.fontWeight)
                      )
                        ? String(state.fontWeight)
                        : '400'
                    }
                    onChange={(event) =>
                      setTextFontWeight(board, event.currentTarget.value)
                    }
                  >
                    {FONT_WEIGHT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ColorRow
                label="文字颜色"
                currentColor={textColor}
                onSelect={(color) => setTextColor(board, textColor, color)}
                onOpacityChange={(opacity) =>
                  setTextColorOpacity(board, textColor, opacity)
                }
              />
              <div className="selection-property-panel__control-block">
                <div className="selection-property-panel__control-label">
                  样式
                </div>
                <div
                  className="selection-property-panel__segmented selection-property-panel__segmented--marks"
                  aria-label="文字样式"
                >
                  {[
                    ['bold', 'B'],
                    ['italic', 'I'],
                    ['underlined', 'U'],
                    ['strike', 'S'],
                  ].map(([mark, label]) => (
                    <button
                      key={mark}
                      type="button"
                      className={classNames({
                        active: Boolean((state.marks as any)?.[mark]),
                      })}
                      onClick={() => toggleTextMark(board, mark as any)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="selection-property-panel__control-block">
                <div className="selection-property-panel__control-label">
                  对齐
                </div>
                <div
                  className="selection-property-panel__segmented selection-property-panel__segmented--thirds"
                  aria-label="文字对齐"
                >
                  {[
                    [Alignment.left, '左'],
                    [Alignment.center, '中'],
                    [Alignment.right, '右'],
                  ].map(([align, label]) => (
                    <button
                      key={align}
                      type="button"
                      className={classNames({ active: state.align === align })}
                      onClick={() => setTextAlign(board, align as Alignment)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="selection-property-panel__control-block selection-property-panel__control-block--paired">
                <div>
                  <div className="selection-property-panel__control-label">
                    标注
                  </div>
                  <div className="selection-property-panel__segmented selection-property-panel__segmented--thirds">
                    {[
                      ['normal', '常规'],
                      ['superscript', '上标'],
                      ['subscript', '下标'],
                    ].map(([script, label]) => (
                      <button
                        key={script}
                        type="button"
                        className={classNames({
                          active:
                            state.script === script ||
                            (script === 'superscript' &&
                              state.script === 'super') ||
                            (script === 'subscript' && state.script === 'sub'),
                        })}
                        onClick={() => setTextScript(board, script as any)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="selection-property-panel__control-label">
                    大小写
                  </div>
                  <div className="selection-property-panel__segmented selection-property-panel__segmented--thirds">
                    {[
                      ['uppercase', 'AA'],
                      ['lowercase', 'aa'],
                      ['capitalize', 'Aa'],
                    ].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => applyTextCase(board, mode as any)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <SliderField
                label="行高"
                min={0.8}
                max={3}
                step={0.1}
                value={state.lineHeight}
                suffix="x"
                onChange={(value) => setTextLineHeight(board, value)}
              />
              <SliderField
                label="字距"
                min={-8}
                max={24}
                step={1}
                value={state.letterSpacing}
                suffix="px"
                onChange={(value) => setTextLetterSpacing(board, value)}
              />
            </section>
          )}

          {state.hasShapeSwitch && (
            <section className="selection-property-panel__section">
              <div className="selection-property-panel__section-title">
                图形
              </div>
              <div className="selection-property-panel__shape-grid">
                {SHAPES.map((shape) => (
                  <button
                    key={shape.pointer}
                    type="button"
                    className={classNames({
                      active: state.shape === shape.pointer,
                    })}
                    title={getShapeTitle(shape.title, t)}
                    aria-label={getShapeTitle(shape.title, t)}
                    onClick={() => setSelectedShape(board, shape.pointer)}
                  >
                    {shape.icon}
                  </button>
                ))}
              </div>
            </section>
          )}

          {(state.hasFill || state.hasStroke) && (
            <section className="selection-property-panel__section">
              <div className="selection-property-panel__section-title">
                外观
              </div>
              {state.hasFill && (
                <>
                  <div className="selection-property-panel__fill-tabs">
                    <button
                      type="button"
                      className={classNames({
                        active:
                          !state.gradientEnabled && !state.imageFillEnabled,
                      })}
                      onClick={() => setElementGradient(board, false)}
                    >
                      纯色
                    </button>
                    <button
                      type="button"
                      className={classNames({
                        active:
                          state.gradientEnabled && !state.imageFillEnabled,
                      })}
                      onClick={() =>
                        setElementGradientPreset(board, DEFAULT_GRADIENT_PRESET)
                      }
                    >
                      渐变
                    </button>
                    <button
                      type="button"
                      className={classNames({ active: state.imageFillEnabled })}
                      onClick={() => imageFillInputRef.current?.click()}
                    >
                      图片
                    </button>
                  </div>
                  <input
                    ref={imageFillInputRef}
                    type="file"
                    hidden
                    accept={SUPPORTED_ASSET_MIME_TYPES.join(',')}
                    onChange={(event) => {
                      void applyImageFillFile(event.currentTarget.files?.[0]);
                    }}
                  />
                  {!state.gradientEnabled && !state.imageFillEnabled && (
                    <ColorRow
                      label="纯色填充"
                      currentColor={state.fill}
                      allowNoColor
                      onSelect={(color) => setFillColor(board, color)}
                      onOpacityChange={(opacity) =>
                        setFillColorOpacity(board, opacity)
                      }
                    />
                  )}
                  {state.imageFillEnabled && (
                    <div className="selection-property-panel__image-fill-controls">
                      <span>{state.imageFillName}</span>
                      <button
                        type="button"
                        onClick={() => imageFillInputRef.current?.click()}
                      >
                        替换
                      </button>
                      <button
                        type="button"
                        onClick={() => setElementImageFill(board, null)}
                      >
                        清除
                      </button>
                    </div>
                  )}
                  {imageFillError && (
                    <div className="selection-property-panel__field-error">
                      {imageFillError}
                    </div>
                  )}
                  {state.gradientEnabled && !state.imageFillEnabled && (
                    <div className="selection-property-panel__gradient-presets">
                      <div
                        className="selection-property-panel__gradient-current"
                        style={{
                          background: getGradientSurfacePreview({
                            type:
                              state.gradientType === 'radial'
                                ? 'radial'
                                : 'linear',
                            from: state.gradientFrom,
                            to: state.gradientTo,
                            angle: state.gradientAngle,
                          }),
                        }}
                        aria-hidden="true"
                      >
                        <span>当前渐变</span>
                      </div>
                      <div
                        className="selection-property-panel__gradient-preset-grid"
                        aria-label="渐变预设"
                      >
                        {GRADIENT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className={classNames({
                              active: isGradientPresetActive(state, preset),
                            })}
                            title={preset.label}
                            aria-label={preset.label}
                            style={{
                              background: getGradientPresetPreview(preset),
                            }}
                            onClick={() =>
                              setElementGradientPreset(board, preset)
                            }
                          >
                            <span>{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {state.hasStroke && (
                <>
                  <ColorRow
                    label="描边"
                    currentColor={state.strokeColor}
                    onSelect={(color) => setStrokeColor(board, color)}
                    onOpacityChange={(opacity) =>
                      setStrokeColorOpacity(board, opacity)
                    }
                  />
                  <SliderField
                    label="描边宽度"
                    min={0}
                    max={24}
                    step={1}
                    value={state.strokeWidth}
                    suffix="px"
                    onChange={(value) => setStrokeWidth(board, value)}
                  />
                </>
              )}
              <SliderField
                label="不透明度"
                min={0}
                max={100}
                step={1}
                value={Math.round((state.opacity ?? 1) * 100)}
                suffix="%"
                onChange={(value) => setElementOpacity(board, value / 100)}
              />
              {state.hasShapeSwitch && (
                <SliderField
                  label="圆角"
                  min={0}
                  max={80}
                  step={1}
                  value={state.radius}
                  suffix="px"
                  onChange={(value) => setRectangleCornerRadius(board, value)}
                />
              )}
              <div className="selection-property-panel__toggle-row">
                <span>阴影</span>
                <button
                  type="button"
                  className={classNames({ active: state.shadowEnabled })}
                  onClick={() => setElementShadow(board, !state.shadowEnabled)}
                >
                  {state.shadowEnabled ? '开启' : '关闭'}
                </button>
              </div>
              {state.shadowEnabled && (
                <div className="selection-property-panel__shadow-controls">
                  <ColorRow
                    label="阴影颜色"
                    currentColor={state.shadowColor}
                    onSelect={(color) =>
                      setElementShadowProperty(board, 'color', color)
                    }
                  />
                  <div className="selection-property-panel__quad-fields">
                    <NumberField
                      label="X"
                      value={state.shadowOffsetX}
                      onChange={(value) =>
                        setElementShadowProperty(board, 'offsetX', value)
                      }
                    />
                    <NumberField
                      label="Y"
                      value={state.shadowOffsetY}
                      onChange={(value) =>
                        setElementShadowProperty(board, 'offsetY', value)
                      }
                    />
                  </div>
                  <SliderField
                    label="模糊"
                    min={0}
                    max={48}
                    step={1}
                    value={state.shadowBlur}
                    suffix="px"
                    onChange={(value) =>
                      setElementShadowProperty(board, 'blur', value)
                    }
                  />
                </div>
              )}
            </section>
          )}

          <section className="selection-property-panel__section">
            <div className="selection-property-panel__section-title">
              尺寸与位置
            </div>
            <div className="selection-property-panel__toggle-row selection-property-panel__toggle-row--compact">
              <span>锁定比例</span>
              <button
                type="button"
                className={classNames({ active: lockAspectRatio })}
                onClick={() => setLockAspectRatio((value) => !value)}
              >
                {lockAspectRatio ? '开启' : '关闭'}
              </button>
            </div>
            <div className="selection-property-panel__quad-fields">
              <NumberField
                label="X"
                value={state.x}
                onChange={(value) => setElementPosition(board, { x: value })}
              />
              <NumberField
                label="Y"
                value={state.y}
                onChange={(value) => setElementPosition(board, { y: value })}
              />
              <NumberField
                label="W"
                value={state.width}
                onChange={(value) =>
                  setElementSize(board, { width: value }, { lockAspectRatio })
                }
              />
              <NumberField
                label="H"
                value={state.height}
                onChange={(value) =>
                  setElementSize(board, { height: value }, { lockAspectRatio })
                }
              />
            </div>
            <SliderField
              label="旋转"
              min={0}
              max={359}
              step={1}
              value={state.angle}
              suffix="°"
              onChange={(value) => setElementAngle(board, value)}
            />
          </section>

          <section className="selection-property-panel__section">
            <div className="selection-property-panel__section-title">操作</div>
            <div className="selection-property-panel__action-grid">
              <button type="button" onClick={() => duplicateElements(board)}>
                复制
              </button>
              <button type="button" onClick={() => deleteFragment(board)}>
                删除
              </button>
              <button
                type="button"
                onClick={() =>
                  moveSelectionOneStepPreservingBackground(board, 'up')
                }
              >
                上移
              </button>
              <button
                type="button"
                onClick={() =>
                  moveSelectionOneStepPreservingBackground(board, 'down')
                }
              >
                下移
              </button>
              <button
                type="button"
                onClick={() =>
                  moveSelectionToEdgePreservingBackground(board, 'up')
                }
              >
                置顶
              </button>
              <button
                type="button"
                onClick={() =>
                  moveSelectionToEdgePreservingBackground(board, 'down')
                }
              >
                置底
              </button>
            </div>
            <div className="selection-property-panel__align-grid">
              {[
                ['left', '左'],
                ['center', '中'],
                ['right', '右'],
                ['top', '上'],
                ['middle', '垂'],
                ['bottom', '下'],
              ].map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => alignSelection(board, type as any)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => distributeSelection(board, 'horizontal')}
              >
                水平
              </button>
              <button
                type="button"
                onClick={() => distributeSelection(board, 'vertical')}
              >
                垂直
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
};

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
}) => (
  <label className="selection-property-panel__mini-field">
    <span>{label}</span>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  </label>
);

type SliderFieldProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value?: number;
  suffix: string;
  onChange: (value: number) => void;
};

const SliderField: React.FC<SliderFieldProps> = ({
  label,
  min,
  max,
  step,
  value = min,
  suffix,
  onChange,
}) => {
  const normalized = Number.isFinite(value) ? value : min;
  const percentage =
    max === min ? 0 : ((normalized - min) / (max - min)) * 100;
  return (
    <div className="selection-property-panel__slider-field">
      <div>
        <span>{label}</span>
        <output>
          {normalized}
          {suffix}
        </output>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={normalized}
        style={{ '--value': `${percentage}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
};

type ColorRowProps = {
  label: string;
  currentColor?: string;
  allowNoColor?: boolean;
  onSelect: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
};

const ColorRow: React.FC<ColorRowProps> = ({
  label,
  currentColor,
  allowNoColor = false,
  onSelect,
  onOpacityChange,
}) => {
  const [recentColors, setRecentColors] = useState<string[]>(loadRecentColors);
  const [hexValue, setHexValue] = useState(() =>
    normalizeHexColor(currentColor || '')
  );
  const [opacityValue, setOpacityValue] = useState(() =>
    getColorOpacityValue(currentColor)
  );
  const colors = allowNoColor
    ? [
        { value: NO_COLOR, name: '无' },
        ...VISIBLE_COLORS.filter((color) => color.value !== NO_COLOR),
      ]
    : VISIBLE_COLORS;
  const normalizedCurrentColor = normalizeHexColor(currentColor || '');
  const colorSummary =
    currentColor === NO_COLOR ? '无颜色' : normalizedCurrentColor || '混合颜色';
  const previewColor =
    currentColor === NO_COLOR
      ? TRANSPARENT
      : normalizedCurrentColor || TRANSPARENT;
  const paletteValue = normalizedCurrentColor || '#111827';
  const isColorActive = (value: string) =>
    value === NO_COLOR
      ? currentColor === NO_COLOR
      : normalizedCurrentColor === normalizeHexColor(value);

  useEffect(() => {
    setHexValue(normalizeHexColor(currentColor || ''));
    setOpacityValue(getColorOpacityValue(currentColor));
  }, [currentColor]);

  const commitColor = (color: string) => {
    onSelect(color);
    const normalized = normalizeHexColor(color);
    if (normalized) {
      const nextColors = [
        normalized,
        ...recentColors.filter(
          (recentColor) => recentColor.toUpperCase() !== normalized
        ),
      ].slice(0, 8);
      setRecentColors(nextColors);
      saveRecentColors(nextColors);
    }
  };

  const commitHexValue = () => {
    const normalized = normalizeHexColor(hexValue);
    if (!normalized) {
      setHexValue(normalizeHexColor(currentColor || ''));
      return;
    }
    commitColor(normalized);
  };

  const commitOpacityValue = () => {
    if (!onOpacityChange) {
      return;
    }
    const normalizedOpacity = Math.max(
      0,
      Math.min(100, Math.round(Number(opacityValue)))
    );
    setOpacityValue(normalizedOpacity);
    onOpacityChange(normalizedOpacity);
  };

  const commitOpacity = (value: number) => {
    if (!onOpacityChange || !Number.isFinite(value)) {
      return;
    }
    const normalizedOpacity = Math.max(0, Math.min(100, Math.round(value)));
    setOpacityValue(normalizedOpacity);
    onOpacityChange(normalizedOpacity);
  };

  const canUseEyeDropper =
    typeof window !== 'undefined' && Boolean((window as any).EyeDropper);

  const pickColor = async () => {
    if (!canUseEyeDropper) {
      return;
    }
    try {
      const dropper = new (window as any).EyeDropper();
      const result = await dropper.open();
      if (result?.sRGBHex) {
        commitColor(result.sRGBHex);
      }
    } catch {
      // The picker can be cancelled by the user; no UI state needs to change.
    }
  };

  return (
    <div className="selection-property-panel__color-row">
      <div className="selection-property-panel__color-lab">
        <div className="selection-property-panel__color-hero">
          <span
            className={classNames('selection-property-panel__color-preview', {
              'selection-property-panel__color-preview--none':
                currentColor === NO_COLOR,
            })}
            style={{ backgroundColor: previewColor }}
            aria-hidden="true"
          />
          <div className="selection-property-panel__color-meta">
            <span className="selection-property-panel__color-label">
              {label}
            </span>
            <span className="selection-property-panel__color-value">
              {colorSummary}
            </span>
          </div>
          {onOpacityChange && (
            <span className="selection-property-panel__color-opacity-badge">
              {opacityValue}%
            </span>
          )}
        </div>
        <div
          className="selection-property-panel__swatches"
          aria-label={`${label}色板`}
        >
          {colors.map((color) => (
            <button
              key={color.value}
              type="button"
              className={classNames('selection-property-panel__swatch', {
                active: isColorActive(color.value),
                'selection-property-panel__swatch--none':
                  color.value === NO_COLOR,
              })}
              title={color.name}
              aria-label={color.name}
              style={{
                backgroundColor:
                  color.value === NO_COLOR ? TRANSPARENT : color.value,
              }}
              onClick={() => commitColor(color.value)}
            />
          ))}
        </div>
        <div className="selection-property-panel__color-tools">
          <button
            type="button"
            className="selection-property-panel__eyedropper"
            title={canUseEyeDropper ? '吸取屏幕颜色' : '当前浏览器不支持吸管'}
            aria-label="吸取屏幕颜色"
            disabled={!canUseEyeDropper}
            onClick={pickColor}
          >
            取色
          </button>
          <label
            className="selection-property-panel__palette-picker"
            title="打开系统调色板"
            aria-label="打开系统调色板"
          >
            <span aria-hidden="true" />
            色盘
            <input
              type="color"
              value={paletteValue}
              onChange={(event) => commitColor(event.currentTarget.value)}
            />
          </label>
          <input
            type="text"
            value={hexValue}
            placeholder="#111827"
            spellCheck={false}
            onChange={(event) => setHexValue(event.currentTarget.value)}
            onBlur={commitHexValue}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitHexValue();
              }
            }}
          />
        </div>
        {onOpacityChange && (
          <div className="selection-property-panel__opacity-slider">
            <span>透明度</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacityValue}
              aria-label={`${label}透明度滑杆`}
              style={{ '--value': `${opacityValue}%` } as React.CSSProperties}
              onChange={(event) =>
                commitOpacity(Number(event.currentTarget.value))
              }
            />
            <label>
              <input
                type="number"
                min={0}
                max={100}
                value={opacityValue}
                aria-label={`${label}透明度`}
                onChange={(event) =>
                  setOpacityValue(Number(event.currentTarget.value))
                }
                onBlur={commitOpacityValue}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitOpacityValue();
                  }
                }}
              />
            </label>
          </div>
        )}
        {recentColors.length > 0 && (
          <div className="selection-property-panel__recent-colors">
            <span>最近</span>
            <div className="selection-property-panel__recent-swatches">
              {recentColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={classNames('selection-property-panel__swatch', {
                    active: normalizedCurrentColor === color,
                  })}
                  title={color}
                  aria-label={color}
                  style={{ backgroundColor: color }}
                  onClick={() => commitColor(color)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
