import React from 'react';
import { render, screen } from '@testing-library/react';
import { PopupToolbar } from './popup-toolbar';

const mockSetPositionReference = jest.fn();
const mockPopupFontFamilyControl = jest.fn(
  ({ currentFontFamily }: { currentFontFamily?: string }) => (
    <div>{`font-family:${currentFontFamily || 'none'}`}</div>
  )
);
const mockPopupRectangleRadiusControl = jest.fn(
  ({
    currentRadius,
    maxRadius,
  }: {
    currentRadius?: number;
    maxRadius: number;
  }) => <div>{`corner-radius:${currentRadius ?? 'none'}:${maxRadius}`}</div>
);
const mockBoard = {
  viewport: {},
  selection: null,
  children: [],
  pointerMove: jest.fn(),
  pointerUp: jest.fn(),
} as any;
const mockSelectedElements: any[] = [
  {
    id: 'shape-1',
    type: 'geometry',
    shape: 'rectangle',
    points: [
      [0, 0],
      [100, 60],
    ],
    fill: '#ffffff',
    strokeColor: '#333333',
  },
] as any;
const mockDocumentBody = document.body;

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => mockBoard,
}));

jest.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: {
      setFloating: jest.fn(),
      setPositionReference: mockSetPositionReference,
    },
    floatingStyles: {},
  }),
  offset: () => ({}),
  flip: () => ({}),
  shift: () => ({}),
}));

jest.mock('@plait/core', () => ({
  ATTACHED_ELEMENT_CLASS_NAME: 'attached',
  getRectangleByElements: () => ({ x: 0, y: 0, width: 100, height: 60 }),
  getSelectedElements: () => mockSelectedElements,
  isDragging: () => false,
  isMovingElements: () => false,
  isSelectionMoving: () => false,
  PlaitBoard: {
    getBoardContainer: () => mockDocumentBody,
    hasBeenTextEditing: () => false,
    isReadonly: () => false,
  },
  RectangleClient: {
    getRectangleByPoints: (points: Array<[number, number]>) => {
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
    getPoints: () => [
      [0, 0],
      [100, 60],
    ],
  },
  toHostPointFromViewBoxPoint: (_board: unknown, point: [number, number]) =>
    point,
  toScreenPointFromHostPoint: (_board: unknown, point: [number, number]) =>
    point,
}));

jest.mock('@plait/draw', () => ({
  BasicShapes: {
    rectangle: 'rectangle',
    roundRectangle: 'roundRectangle',
  },
  ArrowLineComponent: class {},
  getStrokeColorByElement: () => '#333333',
  getStrokeStyleByElement: () => 'solid',
  isClosedCustomGeometry: () => false,
  isClosedDrawElement: () => true,
  isDrawElementsIncludeText: (elements: Array<Record<string, unknown>>) =>
    elements.some((element) => Boolean(element?.text) || element?.shape === 'text'),
  PlaitDrawElement: {
    isImage: (value: any) => value?.type === 'image',
    isDrawElement: () => true,
    isArrowLine: (value: any) => value?.type === 'arrow-line',
    isVectorLine: () => false,
    isTable: () => false,
    isText: (value: any) => value?.shape === 'text',
    isShapeElement: (value: any) => value?.type === 'geometry',
  },
}));

jest.mock('@plait/mind', () => ({
  getStrokeColorByElement: () => '#333333',
  MindElement: {
    isMindElement: () => false,
  },
}));

jest.mock('@plait/text-plugins', () => ({
  getTextMarksByElement: () => ({}),
}));

jest.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../stack', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const Row = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    __esModule: true,
    default: {
      Row,
    },
  };
});

jest.mock('../../island', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    Island: ReactModule.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  };
});

jest.mock('../../popover/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PopoverContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

jest.mock('./font-color-button', () => ({
  PopupFontColorButton: () => <div>font-color</div>,
}));

jest.mock('./font-family-control', () => ({
  PopupFontFamilyControl: (props: { currentFontFamily?: string }) =>
    mockPopupFontFamilyControl(props),
}));

jest.mock('./font-size-control', () => ({
  PopupFontSizeControl: () => <div>font-size</div>,
}));

jest.mock('./rectangle-radius-control', () => ({
  PopupRectangleRadiusControl: (props: {
    currentRadius?: number;
    maxRadius: number;
  }) => mockPopupRectangleRadiusControl(props),
}));

jest.mock('./stroke-button', () => ({
  PopupStrokeButton: ({ children }: { children?: React.ReactNode }) => (
    <div>{children || 'stroke'}</div>
  ),
}));

jest.mock('./fill-button', () => ({
  PopupFillButton: ({ children }: { children?: React.ReactNode }) => (
    <div>{children || 'fill'}</div>
  ),
}));

jest.mock('./link-button', () => ({
  PopupLinkButton: () => <div>link</div>,
}));

jest.mock('./arrange-button', () => ({
  ArrangeButton: () => <div>arrange</div>,
}));

jest.mock('./arrow-mark-button', () => ({
  ArrowMarkButton: () => <div>arrow</div>,
}));

jest.mock('./arrow-animation-button', () => ({
  ArrowAnimationButton: () => <div>arrow-animation</div>,
}));

jest.mock('./ai-image-edit-button', () => ({
  AIImageEditButton: () => <div>ai-image-edit</div>,
}));

jest.mock('./replace-image-button', () => ({
  ReplaceImageButton: () => <div>replace-image</div>,
}));

jest.mock('./more-options-button', () => ({
  MoreOptionsButton: () => (
    <button type="button" aria-label="general.moreOptions">
      more-options
    </button>
  ),
}));

jest.mock('../../../plugins/freehand/type', () => ({
  Freehand: {
    isFreehand: () => false,
  },
}));

describe('PopupToolbar', () => {
  beforeEach(() => {
    mockSetPositionReference.mockReset();
    mockPopupFontFamilyControl.mockClear();
    mockPopupRectangleRadiusControl.mockClear();
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'shape-1',
        type: 'geometry',
        shape: 'rectangle',
        points: [
          [0, 0],
          [100, 60],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );
  });

  it('更多操作按钮应只渲染一次，重复渲染后也不应增殖', () => {
    const { rerender } = render(<PopupToolbar />);

    expect(
      screen.getAllByRole('button', { name: 'general.moreOptions' })
    ).toHaveLength(1);

    rerender(<PopupToolbar />);

    expect(
      screen.getAllByRole('button', { name: 'general.moreOptions' })
    ).toHaveLength(1);
  });

  it('选中箭头时应显示动画按钮', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'arrow-1',
        type: 'arrow-line',
        source: { marker: 'none' },
        target: { marker: 'arrow' },
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.getByText('arrow-animation')).toBeTruthy();
  });

  it('选中文本元素时应显示字体与字号控件', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'text-1',
        type: 'geometry',
        shape: 'text',
        points: [
          [0, 0],
          [100, 40],
        ],
        text: {
          type: 'paragraph',
          children: [{ text: '标题' }],
        },
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.getByText('font-family:none')).toBeTruthy();
    expect(screen.getByText('font-size')).toBeTruthy();
  });

  it('字体已写回元素时应把当前字体传给字体控件', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'text-2',
        type: 'geometry',
        shape: 'text',
        points: [
          [0, 0],
          [120, 48],
        ],
        text: {
          type: 'paragraph',
          children: [{ text: '标题', 'font-family': 'Georgia, serif' }],
        },
        textStyle: {
          fontFamily: 'Georgia, serif',
        },
        textProperties: {
          fontFamily: 'Georgia, serif',
        },
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.getByText('font-family:Georgia, serif')).toBeTruthy();
  });

  it('单选矩形时应显示圆角控件', () => {
    render(<PopupToolbar />);

    expect(screen.getByText('corner-radius:0:30')).toBeTruthy();
  });

  it('单选圆角矩形时应把当前圆角传给控件', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'shape-2',
        type: 'geometry',
        shape: 'roundRectangle',
        radius: 18,
        points: [
          [0, 0],
          [100, 60],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.getByText('corner-radius:18:30')).toBeTruthy();
  });

  it('混选 rectangle 和 roundRectangle 时仍应显示圆角控件', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'shape-1',
        type: 'geometry',
        shape: 'rectangle',
        points: [
          [0, 0],
          [100, 60],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      },
      {
        id: 'shape-2',
        type: 'geometry',
        shape: 'roundRectangle',
        radius: 12,
        points: [
          [0, 0],
          [80, 40],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.getByText('corner-radius:0:20')).toBeTruthy();
  });

  it('混选矩形和椭圆时不应显示圆角控件', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'shape-1',
        type: 'geometry',
        shape: 'rectangle',
        points: [
          [0, 0],
          [100, 60],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      },
      {
        id: 'shape-3',
        type: 'geometry',
        shape: 'ellipse',
        points: [
          [0, 0],
          [90, 50],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.queryByText(/corner-radius:/)).toBeNull();
  });

  it('混选矩形和文本时不应显示圆角控件', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'shape-1',
        type: 'geometry',
        shape: 'rectangle',
        points: [
          [0, 0],
          [100, 60],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      },
      {
        id: 'text-3',
        type: 'geometry',
        shape: 'text',
        points: [
          [0, 0],
          [80, 40],
        ],
        text: {
          type: 'paragraph',
          children: [{ text: '说明' }],
        },
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.queryByText(/corner-radius:/)).toBeNull();
  });

  it('混选矩形和图片时不应显示圆角控件', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'shape-1',
        type: 'geometry',
        shape: 'rectangle',
        points: [
          [0, 0],
          [100, 60],
        ],
        fill: '#ffffff',
        strokeColor: '#333333',
      },
      {
        id: 'image-2',
        type: 'image',
        url: 'image.png',
      }
    );

    render(<PopupToolbar />);

    expect(screen.queryByText(/corner-radius:/)).toBeNull();
  });

  it('单选普通图片时应显示换图与 AI 编辑按钮', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'image-1',
        type: 'image',
        url: 'image.png',
      }
    );

    render(<PopupToolbar />);

    expect(screen.getByText('replace-image')).toBeTruthy();
    expect(screen.getByText('ai-image-edit')).toBeTruthy();
    expect(screen.getByText('arrange')).toBeTruthy();
  });
});
