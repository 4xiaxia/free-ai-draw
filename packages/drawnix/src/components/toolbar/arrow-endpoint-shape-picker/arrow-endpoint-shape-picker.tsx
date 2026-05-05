import React, { useEffect, useMemo, useState } from 'react';
import {
  ATTACHED_ELEMENT_CLASS_NAME,
  getSelectedElements,
  isSelectionMoving,
  PlaitBoard,
  PlaitHistoryBoard,
  Point,
  toHostPointFromViewBoxPoint,
  toScreenPointFromHostPoint,
} from '@plait/core';
import { useBoard } from '@plait-board/react-board';
import classNames from 'classnames';
import {
  ArrowLineHandleKey,
  BasicShapes,
  DrawTransforms,
  GeometryShapes,
  PlaitArrowLine,
  PlaitDrawElement,
} from '@plait/draw';
import { SHAPES } from '../../shape-picker';
import { Translations, useI18n } from '../../../i18n';
import './arrow-endpoint-shape-picker.scss';

const ENDPOINT_SHAPES = SHAPES.filter((shape) =>
  [
    BasicShapes.rectangle,
    BasicShapes.ellipse,
    BasicShapes.triangle,
    BasicShapes.roundRectangle,
    BasicShapes.diamond,
    BasicShapes.parallelogram,
  ].includes(shape.pointer as BasicShapes)
);

const DEFAULT_SHAPE_WIDTH = 112;
const DEFAULT_SHAPE_HEIGHT = 72;
const PALETTE_WIDTH = 330;
const RIGHT_PANEL_GAP = 376;

const getTargetPoint = (line: PlaitArrowLine): Point | null => {
  const points = line.points;
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  return points[points.length - 1] as Point;
};

const getPreviousPoint = (line: PlaitArrowLine): Point | null => {
  const points = line.points;
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }
  return points[points.length - 2] as Point;
};

const getNextShapePoints = (line: PlaitArrowLine): [Point, Point] | null => {
  const target = getTargetPoint(line);
  if (!target) {
    return null;
  }
  const previous = getPreviousPoint(line);
  const deltaX = previous ? target[0] - previous[0] : 1;
  const deltaY = previous ? target[1] - previous[1] : 0;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const vector: Point = [deltaX / distance, deltaY / distance];
  const center: Point = [
    target[0] + vector[0] * (DEFAULT_SHAPE_WIDTH / 2 + 36),
    target[1] + vector[1] * (DEFAULT_SHAPE_HEIGHT / 2 + 36),
  ];
  return [
    [center[0] - DEFAULT_SHAPE_WIDTH / 2, center[1] - DEFAULT_SHAPE_HEIGHT / 2],
    [center[0] + DEFAULT_SHAPE_WIDTH / 2, center[1] + DEFAULT_SHAPE_HEIGHT / 2],
  ];
};

const getShapeTitle = (title: string, t: (key: keyof Translations) => string) =>
  t((title || 'toolbar.shape') as keyof Translations);

export const ArrowEndpointShapePicker: React.FC = () => {
  const board = useBoard();
  const { t } = useI18n();
  const selectedElements = getSelectedElements(board);
  const [dismissedSelectionKey, setDismissedSelectionKey] = useState('');
  const selectionKey = selectedElements.map((element) => element.id).join('|');
  const line =
    selectedElements.length === 1 &&
    PlaitDrawElement.isArrowLine(selectedElements[0])
      ? (selectedElements[0] as PlaitArrowLine)
      : undefined;

  const state = useMemo(() => {
    if (
      isSelectionMoving(board) ||
      PlaitBoard.hasBeenTextEditing(board) ||
      dismissedSelectionKey === selectionKey
    ) {
      return null;
    }
    const anchor = line?.target?.boundId
      ? null
      : line
        ? getTargetPoint(line)
        : null;
    if (!anchor) {
      return null;
    }
    const screenPoint = toScreenPointFromHostPoint(
      board,
      toHostPointFromViewBoxPoint(board, anchor)
    );
    const maxLeft =
      typeof window === 'undefined'
        ? screenPoint[0] + 18
        : Math.max(16, window.innerWidth - RIGHT_PANEL_GAP - PALETTE_WIDTH);
    return {
      left: Math.min(screenPoint[0] + 18, maxLeft),
      top: Math.max(92, screenPoint[1] - 26),
    };
  }, [
    board,
    board.children,
    board.selection,
    board.viewport,
    dismissedSelectionKey,
    line,
    selectionKey,
  ]);

  useEffect(() => {
    if (dismissedSelectionKey && dismissedSelectionKey !== selectionKey) {
      setDismissedSelectionKey('');
    }
  }, [dismissedSelectionKey, selectionKey]);

  useEffect(() => {
    if (!line || !state) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDismissedSelectionKey(selectionKey);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [line, selectionKey, state]);

  if (!line || !state) {
    return null;
  }

  const insertAndConnect = (shape: GeometryShapes) => {
    PlaitHistoryBoard.withNewBatch(board, () => {
      const points = getNextShapePoints(line);
      if (!points) {
        return;
      }
      DrawTransforms.connectArrowLineToDraw(
        board,
        line,
        ArrowLineHandleKey.target,
        DrawTransforms.insertGeometry(board, points, shape)
      );
    });
  };

  return (
    <div
      className={classNames(
        'arrow-endpoint-shape-picker',
        ATTACHED_ELEMENT_CLASS_NAME
      )}
      style={{ left: state.left, top: state.top }}
      aria-label="箭头末端连接图形"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
      }}
    >
      {ENDPOINT_SHAPES.map((shape) => (
        <button
          key={shape.pointer}
          type="button"
          title={getShapeTitle(shape.title, t)}
          aria-label={getShapeTitle(shape.title, t)}
          onClick={() => insertAndConnect(shape.pointer as GeometryShapes)}
        >
          {shape.icon}
        </button>
      ))}
    </div>
  );
};
