import { useEffect, useRef, useState, useCallback } from 'react';
import { Drawnix, applyFontSchemeToCanvas } from '@drawnix/drawnix';
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
  normalizeBoardsState,
  removeFolderFromState,
} from './board-storage';
import type { AppValue, BoardRecord, BoardsState } from './board-storage';

type BoardShellProps = {
  onBackToLanding?: () => void;
};

const FONT_SCHEME_KEY = 'drawnix_font_scheme';
const DEFAULT_FONT_SCHEME_ID = 'academic';

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
      },
      {
        label: 'Arial',
        value: 'Arial, sans-serif',
      },
      {
        label: '宋体',
        value:
          '"Noto Serif SC", "Songti SC", "STSong", "Times New Roman", serif',
      },
      {
        label: '文楷',
        value: '"Kaiti SC", "STKaiti", "Noto Serif SC", "Songti SC", serif',
      },
      {
        label: '等宽',
        value:
          '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
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
        '"Kaiti SC", "STKaiti", "Noto Serif SC", "Songti SC", serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif',
      code: '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
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
      },
      {
        label: 'Arial',
        value: 'Arial, sans-serif',
      },
      {
        label: '文楷',
        value: '"Kaiti SC", "STKaiti", "Noto Serif SC", serif',
      },
      {
        label: '宋体',
        value: '"Noto Serif SC", "Songti SC", "STSong", serif',
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
      'decorative-symbol': '"Kaiti SC", "STKaiti", "Noto Serif SC", serif',
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
        label: 'Arial',
        value: 'Arial, sans-serif',
      },
      {
        label: 'Times',
        value: '"Times New Roman", Times, serif',
      },
      {
        label: 'Georgia',
        value: 'Georgia, serif',
      },
      {
        label: 'Cascadia',
        value:
          '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
      },
    ],
    fontRoleFamilies: {
      title:
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      body: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      plain:
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      annotation: '"Times New Roman", Georgia, "Songti SC", serif',
      'decorative-symbol': '"Helvetica Neue", Arial, sans-serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      code: '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
    },
  },
] as const;

const FONT_ROLE_PREVIEW_ITEMS = [
  {
    key: 'title',
    label: '标题',
    sample: 'Integrated Scientific Diagramming System',
  },
  { key: 'body', label: '正文', sample: 'User Natural Language Request' },
  {
    key: 'annotation',
    label: '注释',
    sample: '(Human-in-the-loop refinement)',
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
  const [fontSchemeId, setFontSchemeId] =
    useState<(typeof FONT_SCHEMES)[number]['id']>('academic');
  const [fontPanelOpen, setFontPanelOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(true);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const boardRef = useRef<PlaitBoard | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

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
          ? (storedFontScheme as (typeof FONT_SCHEMES)[number]['id'])
          : 'academic';
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
      persistBoards((prev) => ({
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
        boards: prev.boards.map((board) =>
          board.id === prev.activeBoardId
            ? { ...board, folderId, updatedAt: new Date().toISOString() }
            : board
        ),
      }));
    },
    [persistBoards]
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
        })}
        onClick={() => !isRenaming && handleSwitchBoard(board.id)}
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
            <div className={styles.boardManagerCreateRow}>
              <button
                type="button"
                className={styles.boardManagerCreateBtn}
                onClick={() => handleCreateBoard(null)}
              >
                <span className={styles.boardManagerCreateIcon}>+</span>
                <span>画板</span>
              </button>
              <button
                type="button"
                className={classNames(
                  styles.boardManagerCreateBtn,
                  styles.boardManagerCreateFolderBtn
                )}
                onClick={handleCreateFolder}
              >
                <span className={styles.boardManagerCreateIcon}>+</span>
                <span>文件夹</span>
              </button>
            </div>

            {storageError ? (
              <div className={styles.boardManagerStorageStatus}>
                {storageError}
              </div>
            ) : null}

            <div className={styles.boardManagerList}>
              <div className={styles.boardManagerSection}>
                <div className={styles.boardManagerSectionHeader}>
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
                      className={styles.boardManagerFolderHeader}
                      onClick={() => handleToggleFolder(folder.id)}
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
                          <span className={styles.boardManagerFolderName}>
                            {folder.name}
                          </span>
                          <span className={styles.boardManagerFolderCount}>
                            {folderBoards.length}
                          </span>
                        </>
                      )}

                      {!isRenaming && (
                        <div className={styles.boardManagerItemActions}>
                          <button
                            type="button"
                            className={styles.boardManagerItemActionBtn}
                            title="在此文件夹中新建画板"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateBoard(folder.id);
                            }}
                          >
                            +
                          </button>
                          {activeBoard.folderId !== folder.id ? (
                            <button
                              type="button"
                              className={styles.boardManagerItemActionBtn}
                              title="将当前画板移入此文件夹"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveActiveBoardToFolder(folder.id);
                              }}
                            >
                              ↘
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.boardManagerItemActionBtn}
                            title="重命名文件夹"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFolderId(folder.id);
                            }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={styles.boardManagerItemActionBtn}
                            title="删除文件夹"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `确定要删除文件夹「${folder.name}」吗？文件夹内画板会移到未归档。`
                                )
                              ) {
                                handleDeleteFolder(folder.id);
                              }
                            }}
                          >
                            ×
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

      <div className={styles.floatingTools}>
        {fontPanelOpen ? (
          <div className={styles.fontPanel}>
            <div className={styles.fontPanelHeader}>
              <div>
                <div className={styles.topBarTitle}>字体方案</div>
                <div className={styles.schemeDescription}>
                  {activeFontScheme.description}
                </div>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setFontPanelOpen(false)}
              >
                收起
              </button>
            </div>
            <div className={styles.schemeActionRow}>
              <label className={styles.schemeControl}>
                <span className={styles.schemeLabel}>当前方案</span>
                <select
                  className={styles.schemeSelect}
                  value={fontSchemeId}
                  onChange={(event) => {
                    const nextValue = event.target
                      .value as (typeof FONT_SCHEMES)[number]['id'];
                    setFontSchemeId(nextValue);
                    localforage.setItem(FONT_SCHEME_KEY, nextValue);
                  }}
                >
                  {FONT_SCHEMES.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.applyButton}
                onClick={() => {
                  if (!boardRef.current) {
                    return;
                  }
                  applyFontSchemeToCanvas(
                    boardRef.current,
                    activeFontScheme.fontRoleFamilies
                  );
                }}
              >
                应用到画布
              </button>
              <button
                type="button"
                className={styles.resetButton}
                disabled={fontSchemeId === DEFAULT_FONT_SCHEME_ID}
                onClick={() => {
                  setFontSchemeId(DEFAULT_FONT_SCHEME_ID);
                  localforage.setItem(FONT_SCHEME_KEY, DEFAULT_FONT_SCHEME_ID);
                }}
              >
                恢复默认
              </button>
            </div>
            <div className={styles.ruleHint}>
              <div className={styles.ruleHintTitle}>当前规则</div>
              <div className={styles.ruleHintText}>
                标题、正文、注释按当前全局角色字体策略导入；描边标题、emoji
                和装饰符号优先走保真片段。
              </div>
            </div>
            <div className={styles.rolePreviewList}>
              {FONT_ROLE_PREVIEW_ITEMS.map((item) => (
                <div className={styles.rolePreviewCard} key={item.key}>
                  <div className={styles.rolePreviewLabel}>{item.label}</div>
                  <div
                    className={styles.rolePreviewText}
                    style={{
                      fontFamily:
                        activeFontScheme.fontRoleFamilies[
                          item.key as keyof typeof activeFontScheme.fontRoleFamilies
                        ],
                    }}
                  >
                    {item.sample}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.openButton}
            onClick={() => setFontPanelOpen(true)}
          >
            字体方案
          </button>
        )}
      </div>
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
