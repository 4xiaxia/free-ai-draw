import {
  buildBoardImportBatches,
  loadBoardElementsWithAssembly,
} from './board-assembly';

jest.mock('@plait/core', () => ({
  PlaitElement: {
    getElementG: () => null,
  },
}));

describe('board assembly', () => {
  const originalMatchMedia = window.matchMedia;
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      writable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      writable: true,
      value: originalRequestAnimationFrame,
    });
  });

  it('builds larger import batches for bigger drawnix files', () => {
    const batches = buildBoardImportBatches(
      Array.from({ length: 40 }, (_, index) => ({
        id: `element-${index}`,
        type: 'geometry',
      }))
    );

    expect(batches).toHaveLength(5);
    expect(batches.every((batch) => batch.length <= 8)).toBe(true);
  });

  it('loads board elements in stable order across animated batches', async () => {
    const progressUpdates: Array<{
      active: boolean;
      completedBatches: number;
      insertedCount: number;
      totalBatches: number;
    }> = [];
    const board = {
      children: [],
    } as any;
    const listRender = {
      update: jest.fn(),
    };
    const parentG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const elements = Array.from({ length: 10 }, (_, index) => ({
      id: `element-${index}`,
      type: 'geometry',
      shape: index % 2 === 0 ? 'text' : 'rectangle',
    })) as any;

    await loadBoardElementsWithAssembly({
      board,
      parentG,
      listRender,
      elements,
      fileName: 'demo.drawnix',
      onProgress: (progress) => {
        progressUpdates.push({
          active: progress.active,
          completedBatches: progress.completedBatches,
          insertedCount: progress.insertedCount,
          totalBatches: progress.totalBatches,
        });
      },
    });

    expect(board.children.map((element: any) => element.id)).toEqual(
      elements.map((element: any) => element.id)
    );
    expect(listRender.update).toHaveBeenCalledTimes(4);
    expect(progressUpdates.at(-1)).toEqual({
      active: false,
      completedBatches: 3,
      insertedCount: 10,
      totalBatches: 3,
    });
  });
});
