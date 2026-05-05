import Stack from '../../stack';
import { FontColorIcon } from '../../icons';
import {
  ATTACHED_ELEMENT_CLASS_NAME,
  getRectangleByElements,
  getSelectedElements,
  isDragging,
  isMovingElements,
  isSelectionMoving,
  PlaitBoard,
  PlaitElement,
  RectangleClient,
  toHostPointFromViewBoxPoint,
  toScreenPointFromHostPoint,
} from '@plait/core';
import { useEffect, useRef, useState } from 'react';
import { useBoard } from '@plait-board/react-board';
import { flip, offset, shift, useFloating } from '@floating-ui/react';
import { Island } from '../../island';
import classNames from 'classnames';
import { useI18n } from '../../../i18n';
import {
  getStrokeColorByElement as getStrokeColorByMindElement,
  MindElement,
} from '@plait/mind';
import './popup-toolbar.scss';
import {
  ArrowLineHandle,
  BasicShapes,
  getStrokeColorByElement as getStrokeColorByDrawElement,
  getStrokeStyleByElement,
  isClosedCustomGeometry,
  isClosedDrawElement,
  isDrawElementsIncludeText,
  PlaitDrawElement,
} from '@plait/draw';
import { CustomText, StrokeStyle } from '@plait/common';
import { getTextMarksByElement } from '@plait/text-plugins';
import { PopupFontColorButton } from './font-color-button';
import { PopupFontFamilyControl } from './font-family-control';
import { PopupFontSizeControl } from './font-size-control';
import { PopupStrokeButton } from './stroke-button';
import { PopupFillButton } from './fill-button';
import { isWhite, removeHexAlpha } from '../../../utils/color';
import { NO_COLOR } from '../../../constants/color';
import { Freehand } from '../../../plugins/freehand/type';
import { PopupLinkButton } from './link-button';
import { ArrowMarkButton } from './arrow-mark-button';
import { MoreOptionsButton } from './more-options-button';
import { isTextFragmentMetadata } from '../../../scene-import/text-fragment';
import { ArrangeButton } from './arrange-button';
import {
  DrawnixAnimatedArrowLine,
  isArrowAnimationEnabled,
} from '../../../plugins/with-arrow-animation';
import { ArrowAnimationButton } from './arrow-animation-button';
import { AIImageEditButton } from './ai-image-edit-button';
import { ReplaceImageButton } from './replace-image-button';
import { PopupRectangleRadiusControl } from './rectangle-radius-control';

export const PopupToolbar = () => {
  const board = useBoard();
  const { t } = useI18n();
  const selectedElements = getSelectedElements(board);
  const [movingOrDragging, setMovingOrDragging] = useState(false);
  const movingOrDraggingRef = useRef(movingOrDragging);
  const hasSelectedTextFragmentImage = selectedElements.some((element) =>
    isTextFragmentMetadata((element as any)?.sceneImportMetadata)
  );
  const isSingleSelectedPlainImage =
    selectedElements.length === 1 &&
    selectedElements.every((element) => PlaitDrawElement.isImage(element)) &&
    !hasSelectedTextFragmentImage;
  const open =
    selectedElements.length > 0 &&
    !isSelectionMoving(board) &&
    (!selectedElements.some(PlaitDrawElement.isImage) ||
      hasSelectedTextFragmentImage ||
      isSingleSelectedPlainImage);
  const { viewport, selection, children } = board;
  const { refs, floatingStyles } = useFloating({
    placement: 'right-start',
    middleware: [
      offset(32),
      flip({
        padding: { top: 24, right: 376, bottom: 24, left: 24 },
      }),
      shift({
        padding: { top: 24, right: 376, bottom: 24, left: 24 },
      }),
    ],
  });
  let state: {
    fill: string | undefined;
    strokeColor?: string;
    strokeStyle?: StrokeStyle;
    hasFill?: boolean;
    hasText?: boolean;
    hasFontFamily?: boolean;
    fontColor?: string;
    hasFontColor?: boolean;
    hasStroke?: boolean;
    hasStrokeStyle?: boolean;
    hasCornerRadius?: boolean;
    cornerRadius?: number;
    cornerRadiusMax?: number;
    marks?: Omit<CustomText, 'text'>;
    // Line state
    isLine?: boolean;
    source?: ArrowLineHandle;
    target?: ArrowLineHandle;
    animation?: DrawnixAnimatedArrowLine['drawnixArrowAnimation'];
  } = {
    fill: 'red',
  };
  if (open && !movingOrDragging) {
    const hasFill =
      selectedElements.some((value) => hasFillProperty(board, value)) &&
      !PlaitBoard.hasBeenTextEditing(board);
    const hasText = selectedElements.some((value) =>
      hasTextProperty(board, value)
    );
    const hasFontFamily = selectedElements.some((value) => {
      const metadata = (value as any)?.sceneImportMetadata;
      return hasTextProperty(board, value) || isTextFragmentMetadata(metadata);
    });
    const hasStroke =
      selectedElements.some((value) => hasStrokeProperty(board, value)) &&
      !PlaitBoard.hasBeenTextEditing(board);
    const hasStrokeStyle =
      selectedElements.some((value) => hasStrokeStyleProperty(board, value)) &&
      !PlaitBoard.hasBeenTextEditing(board);
    const hasCornerRadius =
      selectedElements.length > 0 &&
      selectedElements.every((value) =>
        hasRectangleCornerRadiusProperty(value)
      ) &&
      !PlaitBoard.hasBeenTextEditing(board);
    const isLine = selectedElements.every((value) =>
      PlaitDrawElement.isArrowLine(value)
    );
    const animation =
      isLine &&
      selectedElements.every((value) =>
        isArrowAnimationEnabled(value as DrawnixAnimatedArrowLine)
      )
        ? 'flow'
        : undefined;
    state = {
      ...getElementState(board),
      hasFill,
      hasFontColor: hasText,
      hasFontFamily,
      hasStroke,
      hasStrokeStyle,
      hasCornerRadius,
      cornerRadius: hasCornerRadius
        ? getCurrentRectangleCornerRadius(selectedElements)
        : undefined,
      cornerRadiusMax: hasCornerRadius
        ? getRectangleCornerRadiusLimit(selectedElements)
        : undefined,
      hasText,
      isLine,
      animation,
    };
  }

  useEffect(() => {
    if (open) {
      const hasSelected = selectedElements.length > 0;
      if (!movingOrDragging && hasSelected) {
        const elements = getSelectedElements(board);
        const rectangle = getRectangleByElements(board, elements, false);
        const [start, end] = RectangleClient.getPoints(rectangle);
        const screenStart = toScreenPointFromHostPoint(
          board,
          toHostPointFromViewBoxPoint(board, start)
        );
        const screenEnd = toScreenPointFromHostPoint(
          board,
          toHostPointFromViewBoxPoint(board, end)
        );
        const width = screenEnd[0] - screenStart[0];
        const height = screenEnd[1] - screenStart[1];
        refs.setPositionReference({
          getBoundingClientRect() {
            return {
              width,
              height,
              x: screenStart[0],
              y: screenStart[1],
              top: screenStart[1],
              left: screenStart[0],
              right: screenStart[0] + width,
              bottom: screenStart[1] + height,
            };
          },
        });
      }
    }
  }, [viewport, selection, children, movingOrDragging]);

  useEffect(() => {
    movingOrDraggingRef.current = movingOrDragging;
  }, [movingOrDragging]);

  useEffect(() => {
    const { pointerUp, pointerMove } = board;

    board.pointerMove = (event: PointerEvent) => {
      if (
        (isMovingElements(board) || isDragging(board)) &&
        !movingOrDraggingRef.current
      ) {
        setMovingOrDragging(true);
      }
      pointerMove(event);
    };

    board.pointerUp = (event: PointerEvent) => {
      if (
        movingOrDraggingRef.current &&
        (isMovingElements(board) || isDragging(board))
      ) {
        setMovingOrDragging(false);
      }
      pointerUp(event);
    };

    return () => {
      board.pointerUp = pointerUp;
      board.pointerMove = pointerMove;
    };
  }, [board]);

  const hasTextGroup =
    state.hasFontFamily || state.hasText || state.hasFontColor;
  const hasStyleGroup =
    state.hasStroke || state.hasFill || state.hasCornerRadius;

  return (
    <>
      {open && !movingOrDragging && (
        <Island
          padding={1}
          className={classNames('popup-toolbar', ATTACHED_ELEMENT_CLASS_NAME)}
          ref={refs.setFloating}
          style={floatingStyles}
        >
          <Stack.Row gap={1} className="popup-toolbar__row">
            {hasTextGroup && (
              <div className="popup-toolbar__group popup-toolbar__group--text">
                {state.hasFontFamily && (
                  <PopupFontFamilyControl
                    board={board}
                    key={'font-family'}
                    currentFontFamily={getCurrentFontFamily(board, state.marks)}
                    title={t('popupToolbar.fontFamily')}
                  />
                )}
                {state.hasText && (
                  <PopupFontSizeControl
                    board={board}
                    key={'font-size'}
                    currentFontSize={getFontSizeFromMarks(state.marks)}
                    title={t('popupToolbar.fontSize')}
                  />
                )}
                {state.hasFontColor && (
                  <PopupFontColorButton
                    board={board}
                    key={0}
                    currentColor={state.marks?.color}
                    title={t('popupToolbar.fontColor')}
                    fontColorIcon={
                      <FontColorIcon currentColor={state.marks?.color} />
                    }
                  ></PopupFontColorButton>
                )}
                {state.hasText && (
                  <PopupLinkButton
                    board={board}
                    title={t('popupToolbar.link')}
                  ></PopupLinkButton>
                )}
              </div>
            )}
            {hasStyleGroup && (
              <div className="popup-toolbar__group popup-toolbar__group--style">
                {state.hasStroke && (
                  <PopupStrokeButton
                    board={board}
                    key={1}
                    currentColor={state.strokeColor}
                    currentStyle={state.strokeStyle}
                    title={t('popupToolbar.stroke')}
                    hasStrokeStyle={state.hasStrokeStyle || false}
                  >
                    <label
                      className={classNames('stroke-label', 'color-label')}
                      style={{ borderColor: state.strokeColor }}
                    ></label>
                  </PopupStrokeButton>
                )}
                {state.hasFill && (
                  <PopupFillButton
                    board={board}
                    key={2}
                    currentColor={state.fill}
                    title={t('popupToolbar.fillColor')}
                  >
                    <label
                      className={classNames('fill-label', 'color-label', {
                        'color-white':
                          state.fill && isWhite(removeHexAlpha(state.fill)),
                      })}
                      style={{ backgroundColor: state.fill }}
                    ></label>
                  </PopupFillButton>
                )}
                {state.hasCornerRadius && (
                  <PopupRectangleRadiusControl
                    board={board}
                    currentRadius={state.cornerRadius}
                    maxRadius={state.cornerRadiusMax || 0}
                    title={t('popupToolbar.cornerRadius')}
                  />
                )}
              </div>
            )}
            {isSingleSelectedPlainImage && (
              <div className="popup-toolbar__group popup-toolbar__group--image">
                <ReplaceImageButton
                  board={board}
                  targetId={selectedElements[0].id}
                />
                <AIImageEditButton targetId={selectedElements[0].id} />
              </div>
            )}
            <div className="popup-toolbar__group popup-toolbar__group--layout">
              <ArrangeButton board={board} />
            </div>
            {state.isLine && (
              <div className="popup-toolbar__group popup-toolbar__group--line">
                <ArrowAnimationButton
                  board={board}
                  animation={state.animation}
                />
                <ArrowMarkButton
                  board={board}
                  end={'source'}
                  endProperty={state.source}
                />
                <ArrowMarkButton
                  board={board}
                  end={'target'}
                  endProperty={state.target}
                />
              </div>
            )}
            <div className="popup-toolbar__group popup-toolbar__group--more">
              <MoreOptionsButton board={board} />
            </div>
          </Stack.Row>
        </Island>
      )}
    </>
  );
};

export const getMindElementState = (
  board: PlaitBoard,
  element: MindElement
) => {
  const marks = getTextMarksByElement(element);
  return {
    fill: element.fill,
    strokeColor: getStrokeColorByMindElement(board, element),
    strokeStyle: getStrokeStyleByElement(board, element),
    marks,
  };
};

export const getDrawElementState = (
  board: PlaitBoard,
  element: PlaitDrawElement
) => {
  const marks: Omit<CustomText, 'text'> = getTextMarksByElement(element);
  return {
    fill: element.fill,
    strokeColor: getStrokeColorByDrawElement(board, element),
    strokeStyle: getStrokeStyleByElement(board, element),
    marks,
    source: element?.source || {},
    target: element?.target || {},
  };
};

export const getElementState = (board: PlaitBoard) => {
  const selectedElement = getSelectedElements(board)[0];
  if (MindElement.isMindElement(board, selectedElement)) {
    return getMindElementState(board, selectedElement);
  }
  return getDrawElementState(board, selectedElement as PlaitDrawElement);
};

export const hasFillProperty = (board: PlaitBoard, element: PlaitElement) => {
  if (MindElement.isMindElement(board, element)) {
    return true;
  }
  if (isClosedCustomGeometry(board, element)) {
    return true;
  }
  if (PlaitDrawElement.isDrawElement(element)) {
    return (
      PlaitDrawElement.isShapeElement(element) &&
      !PlaitDrawElement.isImage(element) &&
      !PlaitDrawElement.isText(element) &&
      isClosedDrawElement(element)
    );
  }
  return false;
};

export const hasStrokeProperty = (board: PlaitBoard, element: PlaitElement) => {
  if (MindElement.isMindElement(board, element)) {
    return true;
  }
  if (Freehand.isFreehand(element)) {
    return true;
  }
  if (PlaitDrawElement.isDrawElement(element)) {
    return (
      (PlaitDrawElement.isShapeElement(element) &&
        !PlaitDrawElement.isImage(element) &&
        !PlaitDrawElement.isText(element)) ||
      PlaitDrawElement.isArrowLine(element) ||
      PlaitDrawElement.isVectorLine(element) ||
      PlaitDrawElement.isTable(element)
    );
  }
  return false;
};

export const hasStrokeStyleProperty = (
  board: PlaitBoard,
  element: PlaitElement
) => {
  return hasStrokeProperty(board, element);
};

export const hasTextProperty = (board: PlaitBoard, element: PlaitElement) => {
  if (MindElement.isMindElement(board, element)) {
    return true;
  }
  if (PlaitDrawElement.isDrawElement(element)) {
    return isDrawElementsIncludeText([element]);
  }
  return false;
};

export const getColorPropertyValue = (color: string) => {
  if (color === NO_COLOR) {
    return null;
  } else {
    return color;
  }
};

const isRectangleCornerRadiusShape = (shape?: string) => {
  return (
    shape === BasicShapes.rectangle || shape === BasicShapes.roundRectangle
  );
};

const getRectangleElementRadiusLimit = (element: PlaitElement) => {
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

const getRectangleElementCornerRadius = (element: PlaitElement) => {
  const value = (element as { radius?: number | string }).radius;
  const radius = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(radius) && radius > 0 ? radius : 0;
};

const getCurrentRectangleCornerRadius = (selectedElements: PlaitElement[]) => {
  const target = selectedElements.find((element) =>
    hasRectangleCornerRadiusProperty(element)
  );
  return target ? getRectangleElementCornerRadius(target) : 0;
};

const getRectangleCornerRadiusLimit = (selectedElements: PlaitElement[]) => {
  const limits = selectedElements
    .filter((element) => hasRectangleCornerRadiusProperty(element))
    .map((element) => getRectangleElementRadiusLimit(element))
    .filter((value) => value > 0);
  return limits.length > 0 ? Math.min(...limits) : 0;
};

const hasRectangleCornerRadiusProperty = (element: PlaitElement) => {
  return (
    PlaitDrawElement.isShapeElement(element) &&
    !PlaitDrawElement.isText(element) &&
    !PlaitDrawElement.isImage(element) &&
    isRectangleCornerRadiusShape((element as { shape?: string }).shape)
  );
};

const getFontSizeFromMarks = (marks?: Omit<CustomText, 'text'>) => {
  const value = (marks as any)?.['font-size'];
  const size = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(size) && size > 0 ? size : undefined;
};

const getFontFamilyFromMarks = (marks?: Omit<CustomText, 'text'>) => {
  const value = (marks as any)?.fontFamily ?? (marks as any)?.['font-family'];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const getFontFamilyFromTextLeaf = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const leafValue = record['fontFamily'] ?? record['font-family'];
  if (typeof leafValue === 'string' && leafValue.trim()) {
    return leafValue;
  }
  if (Array.isArray(record['children'])) {
    for (const child of record['children'] as unknown[]) {
      const nested = getFontFamilyFromTextLeaf(child);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
};

const getFontFamilyFromElement = (element: unknown) => {
  if (!element || typeof element !== 'object') {
    return undefined;
  }
  const record = element as Record<string, unknown>;
  const textStyle = record['textStyle'] as Record<string, unknown> | undefined;
  const textProperties = record['textProperties'] as
    | Record<string, unknown>
    | undefined;
  const styleValue = textStyle?.fontFamily ?? textStyle?.['font-family'];
  if (typeof styleValue === 'string' && styleValue.trim()) {
    return styleValue;
  }
  const propertyValue =
    textProperties?.fontFamily ?? textProperties?.['font-family'];
  if (typeof propertyValue === 'string' && propertyValue.trim()) {
    return propertyValue;
  }
  return getFontFamilyFromTextLeaf(record['text']);
};

const getCurrentFontFamily = (
  board: PlaitBoard,
  marks?: Omit<CustomText, 'text'>
) => {
  const fromMarks = getFontFamilyFromMarks(marks);
  if (fromMarks) {
    return fromMarks;
  }
  const selectedElement = getSelectedElements(board)[0] as any;
  const fromElement = getFontFamilyFromElement(selectedElement);
  if (fromElement) {
    return fromElement;
  }
  const metadata = selectedElement?.sceneImportMetadata;
  if (isTextFragmentMetadata(metadata)) {
    return metadata.style?.fontFamily;
  }
  return undefined;
};
