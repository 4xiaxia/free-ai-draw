import classNames from 'classnames';
import { Island } from './island';
import Stack from './stack';
import { ToolButton } from './tool-button';
import {
  RectangleIcon,
  EllipseIcon,
  TriangleIcon,
  DiamondIcon,
  ParallelogramIcon,
  RoundRectangleIcon,
  TerminalIcon,
  NoteCurlyLeftIcon,
  NoteCurlyRightIcon,
} from './icons';
import { BoardTransforms, PlaitBoard } from '@plait/core';
import React from 'react';
import { BoardCreationMode, setCreationMode } from '@plait/common';
import {
  BasicShapes,
  DrawPointerType,
  FlowchartSymbols,
  SwimlaneDrawSymbols,
  TableSymbols,
  UMLSymbols,
} from '@plait/draw';
import { useBoard } from '@plait-board/react-board';
import { Translations, useI18n } from '../i18n';
import { splitRows } from '../utils/common';

export interface ShapeProps {
  icon: React.ReactNode;
  title: string;
  pointer: DrawPointerType;
}

interface ShapeGroupProps {
  title: string;
  shapes: ShapeProps[];
}

const createStrokeIcon = (children: React.ReactNode) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const TrapezoidIcon = createStrokeIcon(<path d="M7 5h10l3 14H4L7 5Z" />);

const PentagonIcon = createStrokeIcon(
  <path d="M12 3 21 10 17.5 21h-11L3 10 12 3Z" />
);

const HexagonIcon = createStrokeIcon(<path d="M8 4h8l5 8-5 8H8l-5-8 5-8Z" />);

const OctagonIcon = createStrokeIcon(
  <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z" />
);

const LeftArrowIcon = createStrokeIcon(
  <path d="M10 5 3 12l7 7v-4h11V9H10V5Z" />
);

const RightArrowIcon = createStrokeIcon(<path d="M14 5v4H3v6h11v4l7-7-7-7Z" />);

const TwoWayArrowIcon = createStrokeIcon(
  <path d="M7 5 2 12l5 7v-4h10v4l5-7-5-7v4H7V5Z" />
);

const CrossIcon = createStrokeIcon(
  <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />
);

const StarIcon = createStrokeIcon(
  <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
);

const CloudIcon = createStrokeIcon(
  <path d="M7.5 18H17a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 6.9 8.2 4.8 4.8 0 0 0 7.5 18Z" />
);

const CommentIcon = createStrokeIcon(<path d="M4 5h16v10H9l-5 4V5Z" />);

const ProcessArrowIcon = createStrokeIcon(
  <path d="M4 7h11l5 5-5 5H4l5-5-5-5Z" />
);

const DatabaseIcon = createStrokeIcon(
  <>
    <ellipse cx="12" cy="5" rx="7" ry="3" />
    <path d="M5 5v11c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
    <path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </>
);

const DocumentIcon = createStrokeIcon(
  <path d="M5 4h14v13c-4-2-6 2-10 0-1.3-.7-2.6-.8-4-.4V4Z" />
);

const MultiDocumentIcon = createStrokeIcon(
  <>
    <path d="M7 4h12v13c-3.5-1.7-5.2 1.7-8.7 0-1-.5-2.1-.7-3.3-.5V4Z" />
    <path d="M4 7h3v12h10" />
  </>
);

const TableIcon = createStrokeIcon(
  <>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M4 10h16M9 5v14M15 5v14" />
  </>
);

const SwimlaneVerticalIcon = createStrokeIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M9 4v16M14 4v16" />
  </>
);

const SwimlaneHorizontalIcon = createStrokeIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M4 9h16M4 14h16" />
  </>
);

const ActorIcon = createStrokeIcon(
  <>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v7M8 10h8M9 21l3-7 3 7" />
  </>
);

const ClassIcon = createStrokeIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M4 9h16M4 14h16" />
  </>
);

const SimpleClassIcon = createStrokeIcon(
  <>
    <rect x="5" y="5" width="14" height="14" rx="1" />
    <path d="M5 10h14" />
  </>
);

const ActivityClassIcon = createStrokeIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M4 9h16M8 14h8" />
  </>
);

const InterfaceIcon = createStrokeIcon(
  <>
    <circle cx="12" cy="12" r="6" />
    <path d="M18 12h3" />
  </>
);

const RequiredInterfaceIcon = createStrokeIcon(
  <path d="M17 6c-3 0-5 2.7-5 6s2 6 5 6" />
);

const ComponentIcon = createStrokeIcon(
  <>
    <rect x="5" y="5" width="14" height="14" rx="1" />
    <path d="M3 9h4M3 15h4" />
  </>
);

const ComponentBoxIcon = createStrokeIcon(
  <>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M7 8h4M7 12h4M16 8v8" />
  </>
);

const PackageIcon = createStrokeIcon(<path d="M4 7h6l2 3h8v9H4V7Z" />);

const InternalStorageIcon = createStrokeIcon(
  <>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M8 5v14M4 9h16" />
  </>
);

const PredefinedProcessIcon = createStrokeIcon(
  <>
    <rect x="4" y="6" width="16" height="12" rx="1" />
    <path d="M8 6v12M16 6v12" />
  </>
);

const ManualInputIcon = createStrokeIcon(<path d="M5 8h15l-2 10H5V8Z" />);

const PreparationIcon = createStrokeIcon(
  <path d="M8 6h8l5 6-5 6H8l-5-6 5-6Z" />
);

const ManualLoopIcon = createStrokeIcon(<path d="M6 6h14l-3 12H4L6 6Z" />);

const MergeIcon = createStrokeIcon(<path d="M12 18 4 6h16l-8 12Z" />);

const DelayIcon = createStrokeIcon(<path d="M6 6h8a6 6 0 0 1 0 12H6V6Z" />);

const StoredDataIcon = createStrokeIcon(
  <path d="M7 5h10a5 7 0 0 1 0 14H7a5 7 0 0 0 0-14Z" />
);

const DisplayIcon = createStrokeIcon(
  <path d="M5 6h12l3 6-3 6H5c2-3.3 2-8.7 0-12Z" />
);

const OffPageIcon = createStrokeIcon(<path d="M5 4h14v12l-7 4-7-4V4Z" />);

const ConnectorIcon = createStrokeIcon(
  <>
    <circle cx="12" cy="12" r="6" />
    <path d="M18 18h3" />
  </>
);

const OrIcon = createStrokeIcon(
  <>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 6v12M6 12h12" />
  </>
);

const SummingJunctionIcon = createStrokeIcon(
  <>
    <circle cx="12" cy="12" r="6" />
    <path d="M8 8l8 8M16 8l-8 8" />
  </>
);

const NoteSquareIcon = createStrokeIcon(
  <>
    <path d="M4 6h13l3 3v9H4V6Z" />
    <path d="M17 6v3h3" />
  </>
);

const HardDiskIcon = createStrokeIcon(
  <>
    <path d="M6 6h12l3 12H3L6 6Z" />
    <ellipse cx="12" cy="18" rx="9" ry="3" />
  </>
);

const ContainerIcon = createStrokeIcon(
  <>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M8 9h8" />
  </>
);

const NoteIcon = createStrokeIcon(
  <>
    <path d="M5 5h13v14H5V5Z" />
    <path d="M14 5v4h4" />
  </>
);

const BranchMergeIcon = createStrokeIcon(
  <path d="M12 4 20 12 12 20 4 12 12 4Z" />
);

const PortIcon = createStrokeIcon(
  <>
    <rect x="7" y="7" width="10" height="10" rx="1" />
    <path d="M17 12h4" />
  </>
);

const CombinedFragmentIcon = createStrokeIcon(
  <>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M4 10h7l2-5" />
  </>
);

const ObjectIcon = createStrokeIcon(
  <>
    <rect x="5" y="6" width="14" height="12" rx="1" />
    <path d="M8 10h8" />
  </>
);

const TemplateIcon = createStrokeIcon(
  <>
    <rect x="5" y="7" width="14" height="12" rx="1" />
    <path d="M9 4h10v5" />
    <path d="M8 12h8" />
  </>
);

const ActivationIcon = createStrokeIcon(
  <rect x="9" y="4" width="6" height="16" rx="1" fill="currentColor" />
);

const DeletionIcon = createStrokeIcon(
  <>
    <path d="M7 7l10 10M17 7 7 17" />
    <path d="M12 17v4" />
  </>
);

const AssemblyIcon = createStrokeIcon(
  <>
    <circle cx="9" cy="12" r="4" />
    <path d="M13 12h8M3 12h2" />
  </>
);

export const SHAPES: ShapeProps[] = [
  {
    icon: RectangleIcon,
    title: 'toolbar.shape.rectangle',
    pointer: BasicShapes.rectangle,
  },
  {
    icon: EllipseIcon,
    title: 'toolbar.shape.ellipse',
    pointer: BasicShapes.ellipse,
  },
  {
    icon: TriangleIcon,
    title: 'toolbar.shape.triangle',
    pointer: BasicShapes.triangle,
  },
  {
    icon: TerminalIcon,
    title: 'toolbar.shape.terminal',
    pointer: FlowchartSymbols.terminal,
  },
  {
    icon: NoteCurlyRightIcon,
    title: 'toolbar.shape.noteCurlyRight',
    pointer: FlowchartSymbols.noteCurlyRight,
  },
  {
    icon: NoteCurlyLeftIcon,
    title: 'toolbar.shape.noteCurlyLeft',
    pointer: FlowchartSymbols.noteCurlyLeft,
  },
  {
    icon: DiamondIcon,
    title: 'toolbar.shape.diamond',
    pointer: BasicShapes.diamond,
  },
  {
    icon: ParallelogramIcon,
    title: 'toolbar.shape.parallelogram',
    pointer: BasicShapes.parallelogram,
  },
  {
    icon: RoundRectangleIcon,
    title: 'toolbar.shape.roundRectangle',
    pointer: BasicShapes.roundRectangle,
  },
];

const BASIC_SHAPES: ShapeProps[] = [
  ...SHAPES,
  {
    icon: TrapezoidIcon,
    title: '梯形',
    pointer: BasicShapes.trapezoid,
  },
  {
    icon: PentagonIcon,
    title: '五边形',
    pointer: BasicShapes.pentagon,
  },
  {
    icon: HexagonIcon,
    title: '六边形',
    pointer: BasicShapes.hexagon,
  },
  {
    icon: OctagonIcon,
    title: '八边形',
    pointer: BasicShapes.octagon,
  },
  {
    icon: LeftArrowIcon,
    title: '左箭头',
    pointer: BasicShapes.leftArrow,
  },
  {
    icon: RightArrowIcon,
    title: '右箭头',
    pointer: BasicShapes.rightArrow,
  },
  {
    icon: TwoWayArrowIcon,
    title: '双向箭头',
    pointer: BasicShapes.twoWayArrow,
  },
  {
    icon: ProcessArrowIcon,
    title: '流程箭头',
    pointer: BasicShapes.processArrow,
  },
  {
    icon: ProcessArrowIcon,
    title: '五边箭头',
    pointer: BasicShapes.pentagonArrow,
  },
  {
    icon: CommentIcon,
    title: '批注',
    pointer: BasicShapes.comment,
  },
  {
    icon: CommentIcon,
    title: '圆角批注',
    pointer: BasicShapes.roundComment,
  },
  {
    icon: StarIcon,
    title: '星形',
    pointer: BasicShapes.star,
  },
  {
    icon: CloudIcon,
    title: '云朵',
    pointer: BasicShapes.cloud,
  },
  {
    icon: CrossIcon,
    title: '十字形',
    pointer: BasicShapes.cross,
  },
];

const FLOWCHART_SHAPES: ShapeProps[] = [
  {
    icon: RectangleIcon,
    title: '流程',
    pointer: FlowchartSymbols.process,
  },
  {
    icon: DiamondIcon,
    title: '判定',
    pointer: FlowchartSymbols.decision,
  },
  {
    icon: ParallelogramIcon,
    title: '数据',
    pointer: FlowchartSymbols.data,
  },
  {
    icon: TerminalIcon,
    title: '开始/结束',
    pointer: FlowchartSymbols.terminal,
  },
  {
    icon: DocumentIcon,
    title: '文档',
    pointer: FlowchartSymbols.document,
  },
  {
    icon: MultiDocumentIcon,
    title: '多文档',
    pointer: FlowchartSymbols.multiDocument,
  },
  {
    icon: DatabaseIcon,
    title: '数据库',
    pointer: FlowchartSymbols.database,
  },
  {
    icon: HardDiskIcon,
    title: '硬盘',
    pointer: FlowchartSymbols.hardDisk,
  },
  {
    icon: InternalStorageIcon,
    title: '内部存储',
    pointer: FlowchartSymbols.internalStorage,
  },
  {
    icon: PredefinedProcessIcon,
    title: '预定义流程',
    pointer: FlowchartSymbols.predefinedProcess,
  },
  {
    icon: ManualInputIcon,
    title: '手动输入',
    pointer: FlowchartSymbols.manualInput,
  },
  {
    icon: PreparationIcon,
    title: '准备',
    pointer: FlowchartSymbols.preparation,
  },
  {
    icon: ManualLoopIcon,
    title: '手动循环',
    pointer: FlowchartSymbols.manualLoop,
  },
  {
    icon: MergeIcon,
    title: '合并',
    pointer: FlowchartSymbols.merge,
  },
  {
    icon: DelayIcon,
    title: '延迟',
    pointer: FlowchartSymbols.delay,
  },
  {
    icon: StoredDataIcon,
    title: '存储数据',
    pointer: FlowchartSymbols.storedData,
  },
  {
    icon: DisplayIcon,
    title: '显示',
    pointer: FlowchartSymbols.display,
  },
  {
    icon: OffPageIcon,
    title: '页外引用',
    pointer: FlowchartSymbols.offPage,
  },
  {
    icon: ConnectorIcon,
    title: '连接符',
    pointer: FlowchartSymbols.connector,
  },
  {
    icon: OrIcon,
    title: '或',
    pointer: FlowchartSymbols.or,
  },
  {
    icon: SummingJunctionIcon,
    title: '求和点',
    pointer: FlowchartSymbols.summingJunction,
  },
  {
    icon: NoteSquareIcon,
    title: '方括注释',
    pointer: FlowchartSymbols.noteSquare,
  },
  {
    icon: NoteCurlyRightIcon,
    title: 'toolbar.shape.noteCurlyRight',
    pointer: FlowchartSymbols.noteCurlyRight,
  },
  {
    icon: NoteCurlyLeftIcon,
    title: 'toolbar.shape.noteCurlyLeft',
    pointer: FlowchartSymbols.noteCurlyLeft,
  },
];

const UML_SHAPES: ShapeProps[] = [
  {
    icon: ActorIcon,
    title: '参与者',
    pointer: UMLSymbols.actor,
  },
  {
    icon: EllipseIcon,
    title: '用例',
    pointer: UMLSymbols.useCase,
  },
  {
    icon: ContainerIcon,
    title: '容器',
    pointer: UMLSymbols.container,
  },
  {
    icon: NoteIcon,
    title: '注释',
    pointer: UMLSymbols.note,
  },
  {
    icon: SimpleClassIcon,
    title: '简单类',
    pointer: UMLSymbols.simpleClass,
  },
  {
    icon: ActivityClassIcon,
    title: '活动类',
    pointer: UMLSymbols.activityClass,
  },
  {
    icon: BranchMergeIcon,
    title: '分支/合并',
    pointer: UMLSymbols.branchMerge,
  },
  {
    icon: PortIcon,
    title: '端口',
    pointer: UMLSymbols.port,
  },
  {
    icon: PackageIcon,
    title: '包',
    pointer: UMLSymbols.package,
  },
  {
    icon: CombinedFragmentIcon,
    title: '组合片段',
    pointer: UMLSymbols.combinedFragment,
  },
  {
    icon: ClassIcon,
    title: '类',
    pointer: UMLSymbols.class,
  },
  {
    icon: InterfaceIcon,
    title: '接口',
    pointer: UMLSymbols.interface,
  },
  {
    icon: ObjectIcon,
    title: '对象',
    pointer: UMLSymbols.object,
  },
  {
    icon: ComponentIcon,
    title: '组件',
    pointer: UMLSymbols.component,
  },
  {
    icon: ComponentBoxIcon,
    title: '组件盒',
    pointer: UMLSymbols.componentBox,
  },
  {
    icon: TemplateIcon,
    title: '模板',
    pointer: UMLSymbols.template,
  },
  {
    icon: ActivationIcon,
    title: '激活',
    pointer: UMLSymbols.activation,
  },
  {
    icon: DeletionIcon,
    title: '删除',
    pointer: UMLSymbols.deletion,
  },
  {
    icon: AssemblyIcon,
    title: '装配',
    pointer: UMLSymbols.assembly,
  },
  {
    icon: InterfaceIcon,
    title: '提供接口',
    pointer: UMLSymbols.providedInterface,
  },
  {
    icon: RequiredInterfaceIcon,
    title: '需要接口',
    pointer: UMLSymbols.requiredInterface,
  },
];

const SWIMLANE_SHAPES: ShapeProps[] = [
  {
    icon: SwimlaneVerticalIcon,
    title: '垂直泳道',
    pointer: SwimlaneDrawSymbols.swimlaneVertical,
  },
  {
    icon: SwimlaneHorizontalIcon,
    title: '水平泳道',
    pointer: SwimlaneDrawSymbols.swimlaneHorizontal,
  },
  {
    icon: SwimlaneVerticalIcon,
    title: '垂直泳道（带表头）',
    pointer: SwimlaneDrawSymbols.swimlaneVerticalWithHeader,
  },
  {
    icon: SwimlaneHorizontalIcon,
    title: '水平泳道（带表头）',
    pointer: SwimlaneDrawSymbols.swimlaneHorizontalWithHeader,
  },
  {
    icon: TableIcon,
    title: '表格',
    pointer: TableSymbols.table,
  },
];

export const SHAPE_PICKER_GROUPS: ShapeGroupProps[] = [
  {
    title: '基础',
    shapes: BASIC_SHAPES,
  },
  {
    title: '泳道',
    shapes: SWIMLANE_SHAPES,
  },
  {
    title: '流程图',
    shapes: FLOWCHART_SHAPES,
  },
  {
    title: '类图 / 组件图',
    shapes: UML_SHAPES,
  },
];

const getShapeTitle = (
  shape: ShapeProps,
  t: (key: keyof Translations) => string
) => {
  return shape.title.startsWith('toolbar.')
    ? t(shape.title as keyof Translations)
    : shape.title;
};

export type ShapePickerProps = {
  onPointerUp: (pointer: DrawPointerType) => void;
};

export const ShapePicker: React.FC<ShapePickerProps> = ({ onPointerUp }) => {
  const board = useBoard();
  const { t } = useI18n();
  return (
    <Island padding={1}>
      <Stack.Col gap={2}>
        {SHAPE_PICKER_GROUPS.map((group) => {
          return (
            <Stack.Col gap={1} key={group.title}>
              <div
                style={{
                  color: '#667085',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: '18px',
                  padding: '2px 4px',
                }}
              >
                {group.title}
              </div>
              {splitRows(group.shapes, 5).map((rowShapes, rowIndex) => {
                return (
                  <Stack.Row gap={1} key={`${group.title}-${rowIndex}`}>
                    {rowShapes.map((shape) => {
                      const title = getShapeTitle(shape, t);
                      return (
                        <ToolButton
                          key={shape.pointer}
                          className={classNames({ fillable: false })}
                          type="icon"
                          size={'small'}
                          visible={true}
                          selected={PlaitBoard.isPointer(board, shape.pointer)}
                          icon={shape.icon}
                          title={title}
                          aria-label={title}
                          onPointerDown={() => {
                            setCreationMode(board, BoardCreationMode.dnd);
                            BoardTransforms.updatePointerType(
                              board,
                              shape.pointer
                            );
                          }}
                          onPointerUp={() => {
                            setCreationMode(board, BoardCreationMode.drawing);
                            onPointerUp(shape.pointer);
                          }}
                        />
                      );
                    })}
                  </Stack.Row>
                );
              })}
            </Stack.Col>
          );
        })}
      </Stack.Col>
    </Island>
  );
};
