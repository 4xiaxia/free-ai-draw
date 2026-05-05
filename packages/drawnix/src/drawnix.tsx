import { Board, BoardChangeData, Wrapper } from '@plait-board/react-board';
import {
  PlaitBoard,
  PlaitBoardOptions,
  PlaitElement,
  PlaitPlugin,
  PlaitPointerType,
  PlaitTheme,
  Selection,
  ThemeColorMode,
  Viewport,
} from '@plait/core';
import React, { useState, useRef, useEffect } from 'react';
import { withGroup } from '@plait/common';
import { withDraw } from '@plait/draw';
import { MindThemeColors, withMind } from '@plait/mind';
import MobileDetect from 'mobile-detect';
import { withMindExtend } from './plugins/with-mind-extend';
import { withCommonPlugin } from './plugins/with-common';
import { CreationToolbar } from './components/toolbar/creation-toolbar';
import { ZoomToolbar } from './components/toolbar/zoom-toolbar';
import { PopupToolbar } from './components/toolbar/popup-toolbar/popup-toolbar';
import { AppToolbar } from './components/toolbar/app-toolbar/app-toolbar';
import classNames from 'classnames';
import './styles/index.scss';
import { buildDrawnixHotkeyPlugin } from './plugins/with-hotkey';
import { withFreehand } from './plugins/freehand/with-freehand';
import { ThemeToolbar } from './components/toolbar/theme-toolbar';
import { buildPencilPlugin } from './plugins/with-pencil';
import {
  DrawnixBoard,
  DrawnixContext,
  DrawnixState,
} from './hooks/use-drawnix';
import { ClosePencilToolbar } from './components/toolbar/pencil-mode-toolbar';
import { TTDDialog } from './components/ttd-dialog/ttd-dialog';
import { CleanConfirm } from './components/clean-confirm/clean-confirm';
import { buildTextLinkPlugin } from './plugins/with-text-link';
import { LinkPopup } from './components/popup/link-popup/link-popup';
import { I18nProvider } from './i18n';
import { Tutorial } from './components/tutorial';
import { LASER_POINTER_CLASS_NAME } from './utils/laser-pointer';
import {
  FontFamilyConfigInput,
  FontRoleFamilyConfig,
  setProjectFontFamilyOptions,
  setProjectFontRoleFamilies,
} from './constants/font';
import { withSelectionHit } from './plugins/with-selection-hit';
import { withArrowAnimation } from './plugins/with-arrow-animation';
import { withDefaultDrawStyle } from './plugins/with-default-draw-style';
import { syncImageGenerationTasks } from './image-edit/image-generation-store';
import { ImageGenerationRunner } from './image-edit/components/image-generation-runner';
import { initialBoardAssemblyProgress } from './utils/board-assembly';
import { BoardImportProgress } from './components/import/board-import-progress';
import { SelectionPropertyPanel } from './components/toolbar/selection-property-panel/selection-property-panel';
import { ArrowEndpointShapePicker } from './components/toolbar/arrow-endpoint-shape-picker/arrow-endpoint-shape-picker';
import { CanvasStyleEffects } from './components/canvas-style-effects/canvas-style-effects';

export type DrawnixProps = {
  value: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
  onChange?: (value: BoardChangeData) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  onValueChange?: (value: PlaitElement[]) => void;
  onViewportChange?: (value: Viewport) => void;
  onThemeChange?: (value: ThemeColorMode) => void;
  afterInit?: (board: PlaitBoard) => void;
  tutorial?: boolean;
  fontFamilies?: FontFamilyConfigInput[];
  fontRoleFamilies?: FontRoleFamilyConfig;
} & React.HTMLAttributes<HTMLDivElement>;

export const Drawnix: React.FC<DrawnixProps> = ({
  value,
  viewport,
  theme,
  onChange,
  onSelectionChange,
  onViewportChange,
  onThemeChange,
  onValueChange,
  afterInit,
  tutorial = false,
  fontFamilies,
  fontRoleFamilies,
}) => {
  const options: PlaitBoardOptions = {
    readonly: false,
    hideScrollbar: false,
    disabledScrollOnNonFocus: false,
    themeColors: MindThemeColors,
  };

  const [appState, setAppState] = useState<DrawnixState>(() => {
    // TODO: need to consider how to maintenance the pointer state in future
    const md = new MobileDetect(window.navigator.userAgent);
    return {
      pointer: PlaitPointerType.hand,
      isMobile: md.mobile() !== null,
      isPencilMode: false,
      openDialogType: null,
      openCleanConfirm: false,
      boardImportProgress: initialBoardAssemblyProgress,
      imageEditTargetId: null,
      imageGenerationTasks: {},
    };
  });

  const [board, setBoard] = useState<DrawnixBoard | null>(null);

  if (board) {
    board.appState = appState;
  }

  const updateAppState = (newAppState: Partial<DrawnixState>) => {
    setAppState({
      ...appState,
      ...newAppState,
    });
  };

  const plugins: PlaitPlugin[] = [
    withDraw,
    withDefaultDrawStyle,
    withArrowAnimation,
    withGroup,
    withMind,
    withMindExtend,
    withCommonPlugin,
    buildDrawnixHotkeyPlugin(updateAppState),
    withFreehand,
    buildPencilPlugin(updateAppState),
    buildTextLinkPlugin(updateAppState),
    withSelectionHit,
  ];

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProjectFontFamilyOptions(fontFamilies);
    return () => {
      setProjectFontFamilyOptions(undefined);
    };
  }, [fontFamilies]);

  useEffect(() => {
    setProjectFontRoleFamilies(fontRoleFamilies);
    return () => {
      setProjectFontRoleFamilies(undefined);
    };
  }, [fontRoleFamilies]);

  useEffect(() => {
    syncImageGenerationTasks(appState.imageGenerationTasks);
  }, [appState.imageGenerationTasks]);

  return (
    <I18nProvider>
      <DrawnixContext.Provider value={{ appState, setAppState }}>
        <div
          className={classNames('drawnix', {
            'drawnix--mobile': appState.isMobile,
          })}
          ref={containerRef}
        >
          <Wrapper
            value={value}
            viewport={viewport}
            theme={theme}
            options={options}
            plugins={plugins}
            onChange={(data: BoardChangeData) => {
              onChange && onChange(data);
            }}
            onSelectionChange={onSelectionChange}
            onViewportChange={onViewportChange}
            onThemeChange={onThemeChange}
            onValueChange={onValueChange}
          >
            <Board
              afterInit={(board) => {
                setBoard(board as DrawnixBoard);
                afterInit && afterInit(board);
              }}
            >
              {tutorial &&
                board &&
                PlaitBoard.isPointer(board, PlaitPointerType.selection) && (
                  <Tutorial />
                )}
            </Board>
            <AppToolbar></AppToolbar>
            <CreationToolbar></CreationToolbar>
            <ZoomToolbar></ZoomToolbar>
            <ThemeToolbar></ThemeToolbar>
            <PopupToolbar></PopupToolbar>
            <ArrowEndpointShapePicker></ArrowEndpointShapePicker>
            <SelectionPropertyPanel></SelectionPropertyPanel>
            <CanvasStyleEffects></CanvasStyleEffects>
            <LinkPopup></LinkPopup>
            <ClosePencilToolbar></ClosePencilToolbar>
            <BoardImportProgress></BoardImportProgress>
            <TTDDialog container={containerRef.current}></TTDDialog>
            <CleanConfirm container={containerRef.current}></CleanConfirm>
            <ImageGenerationRunner board={board}></ImageGenerationRunner>
          </Wrapper>
          <canvas
            className={`${LASER_POINTER_CLASS_NAME} mouse-course-hidden`}
          ></canvas>
        </div>
      </DrawnixContext.Provider>
    </I18nProvider>
  );
};
