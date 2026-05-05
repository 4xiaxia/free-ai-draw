/**
 * A React context for sharing the board object, in a way that re-renders the
 * context whenever changes occur.
 */
import { PlaitBoard, PlaitPointerType } from '@plait/core';
import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { MindPointerType } from '@plait/mind';
import { DrawPointerType } from '@plait/draw';
import { FreehandShape } from '../plugins/freehand/type';
import { Editor } from 'slate';
import { LinkElement } from '@plait/common';
import type { BoardAssemblyProgress } from '../utils/board-assembly';

export enum DialogType {
  mermaidToDrawnix = 'mermaidToDrawnix',
  markdownToDrawnix = 'markdownToDrawnix',
  autodraw = 'autodraw',
  llmMermaid = 'llmMermaid',
  imageEdit = 'imageEdit',
}

export type DrawnixPointerType =
  | PlaitPointerType
  | MindPointerType
  | DrawPointerType
  | FreehandShape;

export interface DrawnixBoard extends PlaitBoard {
  appState: DrawnixState;
}

export type LinkState = {
  targetDom: HTMLElement;
  editor: Editor;
  targetElement: LinkElement;
  isEditing: boolean;
  isHovering: boolean;
  isHoveringOrigin: boolean;
};

export type ImageGenerationTask = {
  targetId: string;
  jobId: string;
  backendUrl: string;
  status: 'queued' | 'running';
};

export type ImageGenerationTaskMap = Record<string, ImageGenerationTask>;

export type DrawnixState = {
  pointer: DrawnixPointerType;
  isMobile: boolean;
  isPencilMode: boolean;
  openDialogType: DialogType | null;
  openCleanConfirm: boolean;
  boardImportProgress: BoardAssemblyProgress;
  linkState?: LinkState | null;
  imageEditTargetId?: string | null;
  imageGenerationTasks: ImageGenerationTaskMap;
  onBackToLanding?: (() => void) | null;
};

export const DrawnixContext = createContext<{
  appState: DrawnixState;
  setAppState: Dispatch<SetStateAction<DrawnixState>>;
} | null>(null);

export const useDrawnix = (): {
  appState: DrawnixState;
  setAppState: Dispatch<SetStateAction<DrawnixState>>;
} => {
  const context = useContext(DrawnixContext);

  if (!context) {
    throw new Error(
      `The \`useDrawnix\` hook must be used inside the <Drawnix> component's context.`
    );
  }

  return context;
};

export const useSetPointer = () => {
  const { appState, setAppState } = useDrawnix();
  return (pointer: DrawnixPointerType) => {
    setAppState({ ...appState, pointer });
  };
};
