import type { PlaitElement, PlaitTheme, Viewport } from '@plait/core';

export type BoardRecord = {
  id: string;
  name: string;
  children: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BoardFolderRecord = {
  id: string;
  name: string;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BoardsState = {
  version: 2;
  folders: BoardFolderRecord[];
  boards: BoardRecord[];
  activeBoardId: string;
};

export type AppValue = {
  children: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
};

type BoardsStateV1 = {
  boards: Array<Omit<BoardRecord, 'folderId'>>;
  activeBoardId: string;
};

export const BOARDS_STORAGE_KEY = 'drawnix_boards_v2';
export const LEGACY_BOARDS_STORAGE_KEY = 'drawnix_boards_v1';
export const LEGACY_BOARD_CONTENT_KEY = 'main_board_content';

const UNTITLED_BOARD_PREFIX = '未命名画板';
const UNTITLED_FOLDER_PREFIX = '新建文件夹';

export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyBoard(
  name: string,
  options: {
    folderId?: string | null;
    idFactory?: () => string;
  } = {}
): BoardRecord {
  const now = new Date().toISOString();
  return {
    id: (options.idFactory || generateId)(),
    name,
    children: [],
    folderId: options.folderId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBoardFolder(
  name: string,
  idFactory: () => string = generateId
): BoardFolderRecord {
  const now = new Date().toISOString();
  return {
    id: idFactory(),
    name,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function getNextUntitledName(
  boards: BoardRecord[],
  folderId: string | null = null
): string {
  const existing = boards
    .filter((board) => (board.folderId ?? null) === folderId)
    .map((board) => board.name)
    .filter((name) => name.startsWith(UNTITLED_BOARD_PREFIX));
  return getNextName(UNTITLED_BOARD_PREFIX, existing);
}

export function getNextFolderName(folders: BoardFolderRecord[]): string {
  return getNextName(
    UNTITLED_FOLDER_PREFIX,
    folders.map((folder) => folder.name)
  );
}

export function createInitialBoardsState(
  idFactory: () => string = generateId
): BoardsState {
  const initialBoard = createEmptyBoard('我的画板1', { idFactory });
  return {
    version: 2,
    folders: [],
    boards: [initialBoard],
    activeBoardId: initialBoard.id,
  };
}

export function createBoardsStateFromLegacy(
  legacyData: AppValue,
  idFactory: () => string = generateId
): BoardsState {
  const now = new Date().toISOString();
  const initialBoard: BoardRecord = {
    id: idFactory(),
    name: '我的画板1',
    children: legacyData.children || [],
    viewport: legacyData.viewport,
    theme: legacyData.theme,
    folderId: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    version: 2,
    folders: [],
    boards: [initialBoard],
    activeBoardId: initialBoard.id,
  };
}

export function normalizeBoardsState(storedState: unknown): BoardsState | null {
  if (!storedState || typeof storedState !== 'object') {
    return null;
  }

  const state = storedState as Partial<BoardsState & BoardsStateV1>;
  if (!Array.isArray(state.boards) || state.boards.length === 0) {
    return null;
  }

  const folders = normalizeFolders(state.folders);
  const folderIds = new Set(folders.map((folder) => folder.id));
  const boards = normalizeBoards(state.boards, folderIds);
  if (boards.length === 0) {
    return null;
  }

  const activeBoardId =
    typeof state.activeBoardId === 'string' &&
    boards.some((board) => board.id === state.activeBoardId)
      ? state.activeBoardId
      : boards[0].id;

  return {
    version: 2,
    folders,
    boards,
    activeBoardId,
  };
}

export function removeFolderFromState(
  state: BoardsState,
  folderId: string
): BoardsState {
  return {
    ...state,
    folders: state.folders.filter((folder) => folder.id !== folderId),
    boards: state.boards.map((board) =>
      board.folderId === folderId
        ? { ...board, folderId: null, updatedAt: new Date().toISOString() }
        : board
    ),
  };
}

export function moveBoardToFolder(
  state: BoardsState,
  boardId: string,
  folderId: string | null
): BoardsState {
  const now = new Date().toISOString();
  return {
    ...state,
    folders: state.folders.map((folder) =>
      folder.id === folderId
        ? {
            ...folder,
            collapsed: false,
            updatedAt: now,
          }
        : folder
    ),
    boards: state.boards.map((board) =>
      board.id === boardId ? { ...board, folderId, updatedAt: now } : board
    ),
  };
}

function normalizeFolders(folders: unknown): BoardFolderRecord[] {
  if (!Array.isArray(folders)) {
    return [];
  }

  return folders.flatMap((folder) => {
    if (
      !folder ||
      typeof folder !== 'object' ||
      typeof (folder as Partial<BoardFolderRecord>).id !== 'string' ||
      typeof (folder as Partial<BoardFolderRecord>).name !== 'string'
    ) {
      return [];
    }

    const normalizedFolder = folder as Partial<BoardFolderRecord> &
      Pick<BoardFolderRecord, 'id' | 'name'>;
    return [
      {
        id: normalizedFolder.id,
        name: normalizedFolder.name.trim() || UNTITLED_FOLDER_PREFIX,
        collapsed: Boolean(normalizedFolder.collapsed),
        createdAt: normalizedFolder.createdAt || new Date().toISOString(),
        updatedAt:
          normalizedFolder.updatedAt ||
          normalizedFolder.createdAt ||
          new Date().toISOString(),
      },
    ];
  });
}

function normalizeBoards(
  boards: BoardsStateV1['boards'],
  folderIds: Set<string>
): BoardRecord[] {
  return boards
    .filter((board): board is BoardRecord => {
      return (
        !!board &&
        typeof board === 'object' &&
        typeof board.id === 'string' &&
        typeof board.name === 'string' &&
        Array.isArray(board.children)
      );
    })
    .map((board) => {
      const folderId =
        typeof board.folderId === 'string' && folderIds.has(board.folderId)
          ? board.folderId
          : null;
      return {
        ...board,
        name: board.name.trim() || UNTITLED_BOARD_PREFIX,
        folderId,
        createdAt: board.createdAt || new Date().toISOString(),
        updatedAt:
          board.updatedAt || board.createdAt || new Date().toISOString(),
      };
    });
}

function getNextName(prefix: string, existing: string[]): string {
  if (!existing.includes(prefix)) {
    return prefix;
  }
  let index = 1;
  while (existing.includes(`${prefix} ${index}`)) {
    index++;
  }
  return `${prefix} ${index}`;
}
