import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArrowEndpointShapePicker } from './arrow-endpoint-shape-picker';

const mockBoard = {
  children: [],
  selection: null,
  viewport: null,
} as any;
let mockSelectedElements: any[] = [];
let mockIsTextEditing = false;
const mockWithNewBatch = jest.fn((_board: unknown, callback: () => void) =>
  callback()
);
const mockInsertGeometry = jest.fn();
const mockConnectArrowLineToDraw = jest.fn();

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => mockBoard,
}));

jest.mock('@plait/core', () => ({
  ATTACHED_ELEMENT_CLASS_NAME: 'attached',
  getRectangleByElements: () => ({ x: 10, y: 20, width: 100, height: 60 }),
  getSelectedElements: () => mockSelectedElements,
  isSelectionMoving: () => false,
  PlaitBoard: {
    hasBeenTextEditing: () => mockIsTextEditing,
  },
  PlaitHistoryBoard: {
    withNewBatch: (...args: unknown[]) => mockWithNewBatch(...(args as any)),
  },
  toHostPointFromViewBoxPoint: (_board: unknown, point: [number, number]) =>
    point,
  toScreenPointFromHostPoint: (_board: unknown, point: [number, number]) =>
    point,
}));

jest.mock('@plait/draw', () => ({
  ArrowLineHandleKey: {
    source: 'source',
    target: 'target',
  },
  BasicShapes: {
    rectangle: 'rectangle',
    ellipse: 'ellipse',
    triangle: 'triangle',
    roundRectangle: 'roundRectangle',
    diamond: 'diamond',
    parallelogram: 'parallelogram',
  },
  DrawTransforms: {
    insertGeometry: (...args: unknown[]) => mockInsertGeometry(...args),
    connectArrowLineToDraw: (...args: unknown[]) =>
      mockConnectArrowLineToDraw(...args),
  },
  PlaitDrawElement: {
    isArrowLine: (element: any) => element?.type === 'arrow-line',
    isImage: (element: any) => element?.type === 'image',
    isShapeElement: (element: any) => element?.type === 'geometry',
    isText: (element: any) => element?.shape === 'text',
  },
}));

jest.mock('../../shape-picker', () => ({
  SHAPES: [
    { pointer: 'rectangle', title: 'toolbar.rectangle', icon: 'rect' },
    { pointer: 'ellipse', title: 'toolbar.ellipse', icon: 'ellipse' },
    { pointer: 'triangle', title: 'toolbar.triangle', icon: 'tri' },
    { pointer: 'diamond', title: 'toolbar.diamond', icon: 'diamond' },
  ],
}));

jest.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('ArrowEndpointShapePicker', () => {
  beforeEach(() => {
    mockSelectedElements = [];
    mockIsTextEditing = false;
    mockBoard.children = [];
    jest.clearAllMocks();
    mockInsertGeometry.mockReturnValue({
      id: 'geometry-created',
      type: 'geometry',
    });
  });

  it('stays hidden after selecting a connectable shape', () => {
    mockSelectedElements = [
      {
        id: 'shape-source',
        type: 'geometry',
        shape: 'rectangle',
      },
    ];

    render(<ArrowEndpointShapePicker />);

    expect(screen.queryByLabelText('箭头末端连接图形')).toBeNull();
  });

  it('connects an unbound arrow target to a newly created shape', () => {
    const arrowLine = {
      id: 'arrow-existing',
      type: 'arrow-line',
      target: {},
      points: [
        [0, 0],
        [120, 0],
      ],
    };
    mockSelectedElements = [arrowLine];

    render(<ArrowEndpointShapePicker />);
    fireEvent.click(screen.getByRole('button', { name: 'toolbar.ellipse' }));

    expect(mockInsertGeometry).toHaveBeenCalledWith(
      mockBoard,
      expect.any(Array),
      'ellipse'
    );
    expect(mockConnectArrowLineToDraw).toHaveBeenCalledWith(
      mockBoard,
      arrowLine,
      'target',
      { id: 'geometry-created', type: 'geometry' }
    );
  });

  it('stays hidden when the selected arrow target is already bound', () => {
    mockSelectedElements = [
      {
        id: 'arrow-bound',
        type: 'arrow-line',
        target: { boundId: 'shape-target' },
        points: [
          [0, 0],
          [120, 0],
        ],
      },
    ];

    render(<ArrowEndpointShapePicker />);

    expect(screen.queryByLabelText('箭头末端连接图形')).toBeNull();
  });

  it('stays hidden during text editing and for non-connectable image elements', () => {
    mockIsTextEditing = true;
    mockSelectedElements = [
      {
        id: 'shape-source',
        type: 'geometry',
        shape: 'rectangle',
      },
    ];
    const { rerender } = render(<ArrowEndpointShapePicker />);
    expect(screen.queryByLabelText('箭头末端连接图形')).toBeNull();

    mockIsTextEditing = false;
    mockSelectedElements = [{ id: 'image-1', type: 'image' }];
    rerender(<ArrowEndpointShapePicker />);
    expect(screen.queryByLabelText('箭头末端连接图形')).toBeNull();
  });
});
