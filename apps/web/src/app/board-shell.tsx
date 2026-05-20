import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Drawnix } from '@drawnix/drawnix';
import { PlaitBoard } from '@plait/core';
import localforage from 'localforage';
import classNames from 'classnames';
import styles from './app.module.scss';
import {
  BOARDS_STORAGE_KEY,
  createBoardFolder,
  createBoardsStateFromLegacy,
  createEmptyBoard,
  createInitialBoardsState,
  getNextFolderName,
  getNextUntitledName,
  LEGACY_BOARD_CONTENT_KEY,
  LEGACY_BOARDS_STORAGE_KEY,
  moveBoardToFolder,
  normalizeBoardsState,
  removeFolderFromState,
} from './board-storage';
import type { AppValue, BoardRecord, BoardsState } from './board-storage';

type BoardShellProps = {
  onBackToLanding?: () => void;
};

type FloatingMenuPosition = {
  top: number;
  left: number;
};

const FONT_SCHEME_KEY = 'drawnix_font_scheme';
const DEFAULT_FONT_SCHEME_ID = 'academic';
type FontSchemeId = (typeof FONT_SCHEMES)[number]['id'];

const FONT_SCHEMES = [
  {
    id: 'academic',
    label: '学术图表',
    description: '标题偏黑体，正文偏无衬线，注释偏衬线，适合论文图和流程图。',
    fontFamilies: [
      {
        label: '默认无衬线',
        value:
          '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      },
      {
        label: '思源黑体',
        value:
          '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        isBuiltIn: true,
      },
      {
        label: '霞鹜文楷',
        value:
          '"LXGW WenKai GB Screen", "Kaiti SC", "STKaiti", "Noto Serif SC", serif',
        isBuiltIn: true,
      },
      {
        label: '宋体',
        value:
          '"Noto Serif SC", "Songti SC", "STSong", "Times New Roman", serif',
        isBuiltIn: true,
      },
      {
        label: '新宋体',
        value: '"NSimSun", SimSun, "Songti SC", STSong, serif',
      },
      {
        label: 'Source Sans',
        value: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        isBuiltIn: true,
      },
      {
        label: 'Source Serif',
        value: '"Source Serif 4", Georgia, "Times New Roman", serif',
        isBuiltIn: true,
      },
      {
        label: 'Times New Roman',
        value: '"Times New Roman", Times, serif',
      },
      {
        label: 'JetBrains',
        value:
          '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, "Courier New", monospace',
        isBuiltIn: true,
      },
    ],
    fontRoleFamilies: {
      title:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
      body: '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      plain:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      annotation:
        '"Noto Serif SC", "Songti SC", "STSong", "Times New Roman", serif',
      'decorative-symbol':
        '"LXGW WenKai GB Screen", "Kaiti SC", "STKaiti", "Noto Serif SC", "Songti SC", serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif',
      code: '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, "Courier New", monospace',
    },
  },
  {
    id: 'zh-priority',
    label: '中文优先',
    description: '强调中文可读性，适合中文报告、讲义和知识图谱。',
    fontFamilies: [
      {
        label: '苹方',
        value:
          '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      },
      {
        label: '思源黑体',
        value:
          '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        isBuiltIn: true,
      },
      {
        label: '霞鹜文楷',
        value:
          '"LXGW WenKai GB Screen", "Kaiti SC", "STKaiti", "Noto Serif SC", serif',
        isBuiltIn: true,
      },
      {
        label: '站酷小薇',
        value: '"ZCOOL XiaoWei", "Noto Serif SC", "Songti SC", serif',
        isBuiltIn: true,
      },
      {
        label: '站酷庆科',
        value:
          '"ZCOOL QingKe HuangYou", "Noto Sans SC", "PingFang SC", sans-serif',
        isBuiltIn: true,
      },
      {
        label: '马善政',
        value: '"Ma Shan Zheng", "Kaiti SC", "STKaiti", cursive',
        isBuiltIn: true,
      },
      {
        label: '宋体',
        value: '"Noto Serif SC", "Songti SC", "STSong", serif',
        isBuiltIn: true,
      },
      {
        label: '新宋体',
        value: '"NSimSun", SimSun, "Songti SC", STSong, serif',
      },
      {
        label: '等宽',
        value:
          '"Sarasa Mono SC", "Cascadia Code", Consolas, "Courier New", monospace',
      },
    ],
    fontRoleFamilies: {
      title:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      body: '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      plain:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      annotation: '"Noto Serif SC", "Songti SC", "STSong", serif',
      'decorative-symbol':
        '"LXGW WenKai GB Screen", "Kaiti SC", "STKaiti", "Noto Serif SC", serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      code: '"Sarasa Mono SC", "Cascadia Code", Consolas, monospace',
    },
  },
  {
    id: 'en-priority',
    label: '英文优先',
    description: '强调英文标题和正文观感，适合英文图表和技术示意图。',
    fontFamilies: [
      {
        label: 'Helvetica',
        value: '"Helvetica Neue", Arial, sans-serif',
      },
      {
        label: 'Source Sans',
        value: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        isBuiltIn: true,
      },
      {
        label: 'IBM Plex',
        value: '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif',
        isBuiltIn: true,
      },
      {
        label: 'Arial',
        value: 'Arial, sans-serif',
      },
      {
        label: 'Source Serif',
        value: '"Source Serif 4", Georgia, "Times New Roman", serif',
        isBuiltIn: true,
      },
      {
        label: 'Times New Roman',
        value: '"Times New Roman", Times, serif',
      },
      {
        label: 'Georgia',
        value: 'Georgia, serif',
      },
      {
        label: 'JetBrains',
        value:
          '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, "Courier New", monospace',
        isBuiltIn: true,
      },
    ],
    fontRoleFamilies: {
      title:
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      body: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      plain:
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      annotation:
        '"Source Serif 4", "Times New Roman", Georgia, "Songti SC", serif',
      'decorative-symbol': '"Helvetica Neue", Arial, sans-serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      code: '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, "Courier New", monospace',
    },
  },
] as const;

localforage.config({
  name: 'XAIBoard',
  storeName: 'xai_board_store',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

export function BoardShell({ onBackToLanding }: BoardShellProps) {
  const [boardsState, setBoardsState] = useState<BoardsState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [fontSchemeId, setFontSchemeId] = useState<FontSchemeId>(
    DEFAULT_FONT_SCHEME_ID
  );
  const [managerOpen, setManagerOpen] = useState(true);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const [folderMenuPosition, setFolderMenuPosition] =
    useState<FloatingMenuPosition | null>(null);
  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(
    null
  );
  const [dropTargetUnfiled, setDropTargetUnfiled] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const boardRef = useRef<PlaitBoard | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const managerRef = useRef<HTMLDivElement | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  const folderMenuTriggerRefs = useRef<
    Record<string, HTMLButtonElement | null>
  >({});

  // Load boards from storage
  useEffect(() => {
    const loadData = async () => {
      const [storedBoards, legacyBoards, storedFontScheme, legacyData] =
        await Promise.all([
          localforage.getItem(BOARDS_STORAGE_KEY),
          localforage.getItem(LEGACY_BOARDS_STORAGE_KEY),
          localforage.getItem(FONT_SCHEME_KEY),
          localforage.getItem(LEGACY_BOARD_CONTENT_KEY),
        ]);

      // Font scheme
      const normalizedFontScheme =
        typeof storedFontScheme === 'string' &&
        FONT_SCHEMES.some((scheme) => scheme.id === storedFontScheme)
          ? (storedFontScheme as FontSchemeId)
          : DEFAULT_FONT_SCHEME_ID;
      setFontSchemeId(normalizedFontScheme);

      const storedBoardsState =
        normalizeBoardsState(storedBoards) ||
        normalizeBoardsState(legacyBoards);
      if (storedBoardsState) {
        setBoardsState(storedBoardsState);
        await localforage.setItem(BOARDS_STORAGE_KEY, storedBoardsState);
        const activeBoard = storedBoardsState.boards.find(
          (b) => b.id === storedBoardsState.activeBoardId
        );
        if (activeBoard && activeBoard.children.length === 0) {
          setTutorial(true);
        }
        setIsLoaded(true);
        return;
      }

      // Migrate from legacy single-board storage
      if (legacyData && typeof legacyData === 'object') {
        const newState = createBoardsStateFromLegacy(legacyData as AppValue);
        setBoardsState(newState);
        await localforage.setItem(BOARDS_STORAGE_KEY, newState);
        if (newState.boards[0].children.length === 0) {
          setTutorial(true);
        }
        setIsLoaded(true);
        return;
      }

      // Fresh start
      const newState = createInitialBoardsState();
      setBoardsState(newState);
      await localforage.setItem(BOARDS_STORAGE_KEY, newState);
      setTutorial(true);
      setIsLoaded(true);
    };

    loadData();
  }, []);

  // Persist boards state
  const persistBoards = useCallback(
    async (updater: (prev: BoardsState) => BoardsState) => {
      setBoardsState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        localforage
          .setItem(BOARDS_STORAGE_KEY, next)
          .then(() => setStorageError(null))
          .catch(() =>
            setStorageError('本地保存失败，请先导出备份后再刷新页面。')
          );
        return next;
      });
    },
    []
  );

  const activeBoard = boardsState?.boards.find(
    (b) => b.id === boardsState.activeBoardId
  );
  const activeBoardFolderId = activeBoard?.folderId ?? null;

  const activeFontScheme =
    FONT_SCHEMES.find((scheme) => scheme.id === fontSchemeId) ||
    FONT_SCHEMES[0];

  const handleCreateBoard = useCallback(
    (folderId: string | null = null) => {
      persistBoards((prev) => {
        const newBoard = createEmptyBoard(
          getNextUntitledName(prev.boards, folderId),
          { folderId }
        );
        return {
          ...prev,
          folders: prev.folders.map((folder) =>
            folder.id === folderId
              ? {
                  ...folder,
                  collapsed: false,
                  updatedAt: new Date().toISOString(),
                }
              : folder
          ),
          boards: [...prev.boards, newBoard],
          activeBoardId: newBoard.id,
        };
      });
      setTutorial(true);
    },
    [persistBoards]
  );

  const handleCreateFolder = useCallback(() => {
    persistBoards((prev) => {
      const newFolder = createBoardFolder(getNextFolderName(prev.folders));
      return {
        ...prev,
        folders: [...prev.folders, newFolder],
      };
    });
  }, [persistBoards]);

  const handleSwitchBoard = useCallback(
    (boardId: string) => {
      if (!boardsState || boardId === boardsState.activeBoardId) return;
      persistBoards((prev) => ({
        ...prev,
        activeBoardId: boardId,
      }));
      setTutorial(false);
    },
    [boardsState, persistBoards]
  );

  const handleDeleteBoard = useCallback(
    (boardId: string) => {
      if (!boardsState) return;
      if (boardsState.boards.length <= 1) return;
      const nextBoards = boardsState.boards.filter((b) => b.id !== boardId);
      const nextActiveId =
        boardsState.activeBoardId === boardId
          ? nextBoards[0].id
          : boardsState.activeBoardId;
      persistBoards(() => ({
        ...boardsState,
        boards: nextBoards,
        activeBoardId: nextActiveId,
      }));
    },
    [boardsState, persistBoards]
  );

  const handleRenameBoard = useCallback(
    (boardId: string, name: string) => {
      const normalized = name.trim();
      if (!normalized) {
        setRenamingBoardId(null);
        return;
      }
      persistBoards((prev) => ({
        ...prev,
        boards: prev.boards.map((b) =>
          b.id === boardId
            ? { ...b, name: normalized, updatedAt: new Date().toISOString() }
            : b
        ),
      }));
      setRenamingBoardId(null);
    },
    [persistBoards]
  );

  const handleRenameFolder = useCallback(
    (folderId: string, name: string) => {
      const normalized = name.trim();
      if (!normalized) {
        setRenamingFolderId(null);
        return;
      }
      persistBoards((prev) => ({
        ...prev,
        folders: prev.folders.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                name: normalized,
                updatedAt: new Date().toISOString(),
              }
            : folder
        ),
      }));
      setRenamingFolderId(null);
    },
    [persistBoards]
  );

  const handleToggleFolder = useCallback(
    (folderId: string) => {
      persistBoards((prev) => ({
        ...prev,
        folders: prev.folders.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                collapsed: !folder.collapsed,
                updatedAt: new Date().toISOString(),
              }
            : folder
        ),
      }));
    },
    [persistBoards]
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      persistBoards((prev) => removeFolderFromState(prev, folderId));
    },
    [persistBoards]
  );

  const handleMoveActiveBoardToFolder = useCallback(
    (folderId: string | null) => {
      persistBoards((prev) =>
        moveBoardToFolder(prev, prev.activeBoardId, folderId)
      );
    },
    [persistBoards]
  );

  const handleMoveBoardToFolder = useCallback(
    (boardId: string, folderId: string | null) => {
      persistBoards((prev) => moveBoardToFolder(prev, boardId, folderId));
    },
    [persistBoards]
  );

  const resetBoardDragState = useCallback(() => {
    setDraggingBoardId(null);
    setDropTargetFolderId(null);
    setDropTargetUnfiled(false);
  }, []);

  const closeFolderMenu = useCallback(() => {
    setOpenFolderMenuId(null);
    setFolderMenuPosition(null);
  }, []);

  const updateFolderMenuPosition = useCallback(
    (folderId: string) => {
      const trigger = folderMenuTriggerRefs.current[folderId];
      if (!trigger) {
        closeFolderMenu();
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = activeBoardFolderId !== folderId ? 168 : 130;
      const viewportPadding = 12;
      const nextLeft = Math.min(
        rect.right + 8,
        window.innerWidth - menuWidth - viewportPadding
      );
      const nextTop = Math.min(
        rect.bottom + 8,
        window.innerHeight - menuHeight - viewportPadding
      );

      setFolderMenuPosition({
        top: Math.max(viewportPadding, nextTop),
        left: Math.max(viewportPadding, nextLeft),
      });
    },
    [activeBoardFolderId, closeFolderMenu]
  );

  const handleToggleFolderMenu = useCallback(
    (folderId: string) => {
      setCreateMenuOpen(false);
      if (openFolderMenuId === folderId) {
        closeFolderMenu();
        return;
      }
      setOpenFolderMenuId(folderId);
      updateFolderMenuPosition(folderId);
    },
    [closeFolderMenu, openFolderMenuId, updateFolderMenuPosition]
  );

  const handleBoardChange = useCallback(
    (value: unknown) => {
      if (!boardsState || !activeBoard) return;
      const newValue = value as AppValue;
      persistBoards((prev) => ({
        ...prev,
        boards: prev.boards.map((b) =>
          b.id === activeBoard.id
            ? {
                ...b,
                children: newValue.children,
                viewport: newValue.viewport,
                theme: newValue.theme,
                updatedAt: new Date().toISOString(),
              }
            : b
        ),
      }));
      if (newValue.children && newValue.children.length > 0) {
        setTutorial(false);
      }
    },
    [boardsState, activeBoard, persistBoards]
  );

  const folderIds = new Set(
    boardsState?.folders.map((folder) => folder.id) || []
  );
  const unfiledBoards =
    boardsState?.boards.filter(
      (board) => !board.folderId || !folderIds.has(board.folderId)
    ) || [];

  // Focus rename input when entering rename mode
  useEffect(() => {
    if ((renamingBoardId || renamingFolderId) && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingBoardId, renamingFolderId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        managerRef.current?.contains(target) ||
        folderMenuRef.current?.contains(target)
      ) {
        return;
      }
      if (!managerRef.current?.contains(target)) {
        setCreateMenuOpen(false);
        closeFolderMenu();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [closeFolderMenu]);

  useEffect(() => {
    if (!managerOpen) {
      setCreateMenuOpen(false);
      closeFolderMenu();
    }
  }, [closeFolderMenu, managerOpen]);

  useEffect(() => {
    if (!openFolderMenuId) {
      return;
    }

    const handleReposition = () => {
      updateFolderMenuPosition(openFolderMenuId);
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [openFolderMenuId, updateFolderMenuPosition]);

  if (!isLoaded || !boardsState || !activeBoard) {
    return (
      <div className={styles.appShell}>
        <div className={styles.loadingOverlay}>加载中…</div>
      </div>
    );
  }

  const renderBoardItem = (board: BoardRecord) => {
    const isActive = board.id === boardsState.activeBoardId;
    const isRenaming = renamingBoardId === board.id;
    return (
      <div
        key={board.id}
        className={classNames(styles.boardManagerItem, {
          [styles.boardManagerItemActive]: isActive,
          [styles.boardManagerItemDragging]: draggingBoardId === board.id,
        })}
        draggable={!isRenaming}
        onClick={() => !isRenaming && handleSwitchBoard(board.id)}
        onDragStart={(event) => {
          if (isRenaming) return;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', board.id);
          setDraggingBoardId(board.id);
          setDropTargetFolderId(null);
          setDropTargetUnfiled(false);
        }}
        onDragEnd={resetBoardDragState}
      >
        <span className={styles.boardManagerItemIcon}>#</span>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className={styles.boardManagerItemInput}
            type="text"
            defaultValue={board.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => handleRenameBoard(board.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRenameBoard(board.id, e.currentTarget.value);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setRenamingBoardId(null);
              }
            }}
          />
        ) : (
          <span className={styles.boardManagerItemName}>{board.name}</span>
        )}

        {!isRenaming && (
          <div className={styles.boardManagerItemActions}>
            <button
              type="button"
              className={styles.boardManagerItemActionBtn}
              title="重命名"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingBoardId(board.id);
              }}
            >
              ✎
            </button>
            {boardsState.boards.length > 1 && (
              <button
                type="button"
                className={styles.boardManagerItemActionBtn}
                title="删除"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`确定要删除画板「${board.name}」吗？`)) {
                    handleDeleteBoard(board.id);
                  }
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.appShell}>
      {/* Board Manager Sidebar */}
      <div
        ref={managerRef}
        className={classNames(styles.boardManager, {
          [styles.boardManagerClosed]: !managerOpen,
        })}
      >
        <div className={styles.boardManagerHeader}>
          <div className={styles.boardManagerTitle}>画布管理</div>
          <button
            type="button"
            className={styles.boardManagerToggle}
            onClick={() => setManagerOpen(!managerOpen)}
            aria-label={managerOpen ? '收起' : '展开'}
          >
            {managerOpen ? '◀' : '▶'}
          </button>
        </div>

        {managerOpen && (
          <>
            <div className={styles.boardManagerCreateMenuWrap}>
              <button
                type="button"
                className={styles.boardManagerCreateBtn}
                onClick={() => {
                  setCreateMenuOpen((prev) => !prev);
                  setOpenFolderMenuId(null);
                }}
              >
                <span className={styles.boardManagerCreateIcon}>+</span>
                <span>新增</span>
                <span className={styles.boardManagerCreateCaret}>
                  {createMenuOpen ? '▲' : '▼'}
                </span>
              </button>
              {createMenuOpen ? (
                <div className={styles.boardManagerMenuPanel}>
                  <button
                    type="button"
                    className={styles.boardManagerMenuItem}
                    onClick={() => {
                      handleCreateBoard(null);
                      setCreateMenuOpen(false);
                    }}
                  >
                    新建画板
                  </button>
                  <button
                    type="button"
                    className={styles.boardManagerMenuItem}
                    onClick={() => {
                      handleCreateFolder();
                      setCreateMenuOpen(false);
                    }}
                  >
                    新建文件夹
                  </button>
                </div>
              ) : null}
            </div>

            {storageError ? (
              <div className={styles.boardManagerStorageStatus}>
                {storageError}
              </div>
            ) : null}

            <div className={styles.boardManagerList}>
              <div className={styles.boardManagerSection}>
                <div
                  className={classNames(styles.boardManagerSectionHeader, {
                    [styles.boardManagerSectionHeaderDropTarget]:
                      dropTargetUnfiled,
                  })}
                  onDragOver={(event) => {
                    if (!draggingBoardId) return;
                    event.preventDefault();
                    if (!dropTargetUnfiled) {
                      setDropTargetUnfiled(true);
                    }
                    if (dropTargetFolderId !== null) {
                      setDropTargetFolderId(null);
                    }
                  }}
                  onDragLeave={(event) => {
                    if (
                      event.currentTarget.contains(
                        event.relatedTarget as Node | null
                      )
                    ) {
                      return;
                    }
                    setDropTargetUnfiled(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingBoardId) {
                      handleMoveBoardToFolder(draggingBoardId, null);
                    }
                    resetBoardDragState();
                  }}
                >
                  <span>未归档</span>
                  {activeBoard.folderId ? (
                    <button
                      type="button"
                      className={styles.boardManagerSectionAction}
                      title="将当前画板移到未归档"
                      onClick={() => handleMoveActiveBoardToFolder(null)}
                    >
                      ↖
                    </button>
                  ) : null}
                </div>
                {unfiledBoards.map((board) => renderBoardItem(board))}
              </div>

              {boardsState.folders.map((folder) => {
                const folderBoards = boardsState.boards.filter(
                  (board) => board.folderId === folder.id
                );
                const isRenaming = renamingFolderId === folder.id;
                return (
                  <div key={folder.id} className={styles.boardManagerFolder}>
                    <div
                      className={classNames(styles.boardManagerFolderHeader, {
                        [styles.boardManagerFolderHeaderDropTarget]:
                          dropTargetFolderId === folder.id,
                      })}
                      onClick={() => handleToggleFolder(folder.id)}
                      onDragOver={(event) => {
                        if (!draggingBoardId) return;
                        event.preventDefault();
                        if (dropTargetFolderId !== folder.id) {
                          setDropTargetFolderId(folder.id);
                        }
                        if (dropTargetUnfiled) {
                          setDropTargetUnfiled(false);
                        }
                      }}
                      onDragLeave={(event) => {
                        if (
                          event.currentTarget.contains(
                            event.relatedTarget as Node | null
                          )
                        ) {
                          return;
                        }
                        if (dropTargetFolderId === folder.id) {
                          setDropTargetFolderId(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (draggingBoardId) {
                          handleMoveBoardToFolder(draggingBoardId, folder.id);
                        }
                        resetBoardDragState();
                      }}
                    >
                      <span className={styles.boardManagerFolderToggle}>
                        {folder.collapsed ? '▶' : '▼'}
                      </span>
                      <span className={styles.boardManagerFolderIcon}>□</span>
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          className={styles.boardManagerItemInput}
                          type="text"
                          defaultValue={folder.name}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) =>
                            handleRenameFolder(folder.id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenameFolder(
                                folder.id,
                                e.currentTarget.value
                              );
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setRenamingFolderId(null);
                            }
                          }}
                        />
                      ) : (
                        <>
                          <span
                            className={styles.boardManagerFolderInfo}
                            title={folder.name}
                          >
                            <span className={styles.boardManagerFolderName}>
                              {folder.name}
                            </span>
                            <span className={styles.boardManagerFolderCount}>
                              {folderBoards.length}
                            </span>
                          </span>
                        </>
                      )}

                      {!isRenaming && (
                        <div className={styles.boardManagerFolderActions}>
                          <button
                            type="button"
                            className={styles.boardManagerFolderMenuTrigger}
                            title="文件夹操作"
                            ref={(element) => {
                              folderMenuTriggerRefs.current[folder.id] =
                                element;
                            }}
                            aria-expanded={openFolderMenuId === folder.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFolderMenu(folder.id);
                            }}
                          >
                            ⋯
                          </button>
                        </div>
                      )}
                    </div>
                    {!folder.collapsed && (
                      <div className={styles.boardManagerFolderChildren}>
                        {folderBoards.length > 0 ? (
                          folderBoards.map((board) => renderBoardItem(board))
                        ) : (
                          <div className={styles.boardManagerFolderEmpty}>
                            空文件夹
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div
        className={classNames(styles.boardContainer, {
          [styles.boardContainerWithManager]: managerOpen,
          [styles.boardContainerManagerClosed]: !managerOpen,
        })}
      >
        <Drawnix
          key={activeBoard.id}
          value={activeBoard.children}
          viewport={activeBoard.viewport}
          theme={activeBoard.theme}
          fontFamilies={[...activeFontScheme.fontFamilies]}
          fontRoleFamilies={activeFontScheme.fontRoleFamilies}
          onChange={handleBoardChange}
          tutorial={tutorial}
          onBackToLanding={onBackToLanding}
          onDialogTypeChange={(dialogType) => {
            if (dialogType === 'autodraw') {
              setManagerOpen(false);
            }
          }}
          afterInit={(board) => {
            boardRef.current = board;
          }}
        />
      </div>

      {openFolderMenuId && folderMenuPosition
        ? createPortal(
            <div
              ref={folderMenuRef}
              className={styles.boardManagerFloatingMenu}
              style={{
                top: `${folderMenuPosition.top}px`,
                left: `${folderMenuPosition.left}px`,
              }}
            >
              <button
                type="button"
                className={styles.boardManagerMenuItem}
                onClick={() => {
                  handleCreateBoard(openFolderMenuId);
                  closeFolderMenu();
                }}
              >
                新建画板
              </button>
              {activeBoard.folderId !== openFolderMenuId ? (
                <button
                  type="button"
                  className={styles.boardManagerMenuItem}
                  onClick={() => {
                    handleMoveActiveBoardToFolder(openFolderMenuId);
                    closeFolderMenu();
                  }}
                >
                  移入当前画板
                </button>
              ) : null}
              <button
                type="button"
                className={styles.boardManagerMenuItem}
                onClick={() => {
                  setRenamingFolderId(openFolderMenuId);
                  closeFolderMenu();
                }}
              >
                重命名文件夹
              </button>
              <button
                type="button"
                className={classNames(
                  styles.boardManagerMenuItem,
                  styles.boardManagerMenuDanger
                )}
                onClick={() => {
                  const targetFolder = boardsState.folders.find(
                    (folder) => folder.id === openFolderMenuId
                  );
                  if (
                    targetFolder &&
                    window.confirm(
                      `确定要删除文件夹「${targetFolder.name}」吗？文件夹内画板会移到未归档。`
                    )
                  ) {
                    handleDeleteFolder(openFolderMenuId);
                  }
                  closeFolderMenu();
                }}
              >
                删除文件夹
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

const addDebugLog = (board: PlaitBoard, value: string) => {
  const container = PlaitBoard.getBoardContainer(board).closest(
    '.drawnix'
  ) as HTMLElement;
  let consoleContainer = container.querySelector('.drawnix-console');
  if (!consoleContainer) {
    consoleContainer = document.createElement('div');
    consoleContainer.classList.add('drawnix-console');
    container.append(consoleContainer);
  }
  const div = document.createElement('div');
  div.innerHTML = value;
  consoleContainer.append(div);
};

void addDebugLog;

export default BoardShell;
