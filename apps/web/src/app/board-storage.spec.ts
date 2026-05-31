import {
  getNextUntitledName,
  moveBoardToFolder,
  normalizeBoardsState,
  removeFolderFromState,
} from './board-storage';
import type { BoardRecord, BoardsState } from './board-storage';

const createBoard = (
  id: string,
  name: string,
  folderId: string | null = null
): BoardRecord => ({
  id,
  name,
  children: [],
  folderId,
  createdAt: '2026-05-05T00:00:00.000Z',
  updatedAt: '2026-05-05T00:00:00.000Z',
});

describe('board-storage', () => {
  it('将 v1 画板列表迁移为 v2 无文件夹结构', () => {
    const state = normalizeBoardsState({
      boards: [
        createBoard('board-1', '我的画板1'),
        createBoard('board-2', '未命名画板'),
      ],
      activeBoardId: 'board-2',
    });

    expect(state).toMatchObject({
      version: 2,
      folders: [],
      activeBoardId: 'board-2',
    });
    expect(state?.boards).toHaveLength(2);
    expect(state?.boards[0].folderId).toBeNull();
  });

  it('只保留有效文件夹关系，失效 folderId 会回到未归档', () => {
    const state = normalizeBoardsState({
      version: 2,
      folders: [
        {
          id: 'folder-1',
          name: '项目图',
          collapsed: false,
          createdAt: '2026-05-05T00:00:00.000Z',
          updatedAt: '2026-05-05T00:00:00.000Z',
        },
      ],
      boards: [
        createBoard('board-1', '归档画板', 'folder-1'),
        createBoard('board-2', '丢失目录画板', 'missing-folder'),
      ],
      activeBoardId: 'board-1',
    });

    expect(state?.boards[0].folderId).toBe('folder-1');
    expect(state?.boards[1].folderId).toBeNull();
  });

  it('未命名画板在不同文件夹内独立编号', () => {
    const boards = [
      createBoard('board-1', '未命名画板'),
      createBoard('board-2', '未命名画板', 'folder-1'),
    ];

    expect(getNextUntitledName(boards, null)).toBe('未命名画板 1');
    expect(getNextUntitledName(boards, 'folder-1')).toBe('未命名画板 1');
    expect(getNextUntitledName(boards, 'folder-2')).toBe('未命名画板');
  });

  it('删除文件夹时只移出画板，不删除画板内容', () => {
    const state: BoardsState = {
      version: 2,
      folders: [
        {
          id: 'folder-1',
          name: '项目图',
          collapsed: false,
          createdAt: '2026-05-05T00:00:00.000Z',
          updatedAt: '2026-05-05T00:00:00.000Z',
        },
      ],
      boards: [createBoard('board-1', '归档画板', 'folder-1')],
      activeBoardId: 'board-1',
    };

    const next = removeFolderFromState(state, 'folder-1');

    expect(next.folders).toHaveLength(0);
    expect(next.boards).toHaveLength(1);
    expect(next.boards[0].folderId).toBeNull();
  });

  it('支持将画板移入文件夹并移回未归档', () => {
    const state: BoardsState = {
      version: 2,
      folders: [
        {
          id: 'folder-1',
          name: '项目图',
          collapsed: true,
          createdAt: '2026-05-05T00:00:00.000Z',
          updatedAt: '2026-05-05T00:00:00.000Z',
        },
      ],
      boards: [createBoard('board-1', '流程图')],
      activeBoardId: 'board-1',
    };

    const movedIntoFolder = moveBoardToFolder(state, 'board-1', 'folder-1');
    expect(movedIntoFolder.boards[0].folderId).toBe('folder-1');
    expect(movedIntoFolder.folders[0].collapsed).toBe(false);

    const movedBackToUnfiled = moveBoardToFolder(
      movedIntoFolder,
      'board-1',
      null
    );
    expect(movedBackToUnfiled.boards[0].folderId).toBeNull();
  });
});
