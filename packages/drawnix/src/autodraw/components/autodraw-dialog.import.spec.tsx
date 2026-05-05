import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import AutodrawDialog from './autodraw-dialog';
import { importBundlePackage } from '../../scene-import/import-bundle-package';

const mockGallerySupport = jest.fn(() => false);
const mockLoadStoredReferenceDirectory = jest.fn();
const mockRequestReferenceDirectory = jest.fn();
const mockReadReferenceGallery = jest.fn();
const mockEnsureReferenceDirectoryPermission = jest.fn(
  async (_handle?: unknown) => true
);
const mockSaveStoredReferenceDirectory = jest.fn(
  async (_handle?: unknown) => undefined
);
const mockClearStoredReferenceDirectory = jest.fn(async () => undefined);

const mockInsertFragment = jest.fn();
const mockClearSelectedElement = jest.fn();
const mockSetAppState = jest.fn();
const mockBoardContainer = {
  getBoundingClientRect: () => ({
    width: 1200,
    height: 800,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
};

const mockBoard = {
  viewport: {
    zoom: 1,
  },
  children: [],
  insertFragment: (...args: unknown[]) => mockInsertFragment(...args),
} as any;

const createJsonResponse = (data: unknown) =>
  ({
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);

const createBlobResponse = (blob: Blob) =>
  ({
    ok: true,
    blob: async () => blob,
    text: async () => '',
  } as Response);

const createErrorResponse = (message: string, status = 500) =>
  ({
    ok: false,
    status,
    text: async () => message,
  } as Response);

const createBundleImportResult = () => ({
  importKind: 'svg' as const,
  fallbackReason: undefined,
  descriptionLines: [],
  summary: {
    textCount: 1,
    arrowCount: 1,
    rectCount: 1,
    componentCount: 1,
    ignoredBackgroundCount: 0,
    warnings: [],
  },
  elements: [
    {
      id: 'shape-1',
      type: 'shape',
      shape: 'rectangle',
      points: [
        [0, 0],
        [120, 80],
      ],
    },
    {
      id: 'image-1',
      type: 'image',
      points: [
        [150, 10],
        [230, 90],
      ],
    },
    {
      id: 'arrow-1',
      type: 'arrow-line',
      points: [
        [120, 40],
        [150, 40],
      ],
    },
    {
      id: 'text-1',
      type: 'shape',
      shape: 'text',
      text: [{ text: 'pipeline' }],
      textStyle: { fontSize: 14 },
      points: [
        [20, 100],
        [180, 130],
      ],
    },
  ] as any[],
});

const createLayerSensitiveBundleImportResult = () => ({
  importKind: 'svg' as const,
  fallbackReason: undefined,
  descriptionLines: [],
  summary: {
    textCount: 1,
    arrowCount: 1,
    rectCount: 2,
    componentCount: 1,
    ignoredBackgroundCount: 0,
    warnings: [],
  },
  elements: [
    {
      id: 'background-rect',
      type: 'shape',
      shape: 'rectangle',
      points: [
        [0, 0],
        [300, 180],
      ],
    },
    {
      id: 'icon-foreground',
      type: 'image',
      points: [
        [40, 40],
        [120, 120],
      ],
    },
    {
      id: 'label-backdrop',
      type: 'shape',
      shape: 'rectangle',
      points: [
        [140, 30],
        [260, 90],
      ],
    },
    {
      id: 'label-text',
      type: 'shape',
      shape: 'text',
      text: [{ text: 'label' }],
      textStyle: { fontSize: 14 },
      points: [
        [150, 45],
        [240, 75],
      ],
    },
    {
      id: 'connector',
      type: 'arrow-line',
      points: [
        [120, 80],
        [180, 80],
      ],
    },
  ] as any[],
});

const AUTODRAW_HISTORY_STORAGE_KEY_V1 = 'drawnix:autodraw-history:v1';
const AUTODRAW_HISTORY_STORAGE_KEY_V2 = 'drawnix:autodraw-history:v2';

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => mockBoard,
}));

jest.mock('@plait/core', () => ({
  clearSelectedElement: (board: unknown) => mockClearSelectedElement(board),
  getViewportOrigination: () => [0, 0],
  PlaitBoard: {
    getBoardContainer: () => mockBoardContainer,
    findPath: () => [0],
  },
  PlaitElement: {},
  PlaitGroupElement: {
    isGroup: () => false,
  },
  PlaitHistoryBoard: {
    withNewBatch: (_board: unknown, callback: () => void) => callback(),
  },
  RectangleClient: {
    getRectangleByPoints: (points: [number, number][]) => {
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
    getBoundingRectangle: (
      rectangles: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>
    ) => {
      const xs = rectangles.flatMap((rectangle) => [
        rectangle.x,
        rectangle.x + rectangle.width,
      ]);
      const ys = rectangles.flatMap((rectangle) => [
        rectangle.y,
        rectangle.y + rectangle.height,
      ]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
  },
  Transforms: {
    setNode: jest.fn(),
  },
  WritableClipboardOperationType: {
    paste: 'paste',
  },
}));

jest.mock('../../hooks/use-drawnix', () => ({
  DialogType: {
    autodraw: 'autodraw',
  },
  useDrawnix: () => ({
    appState: {
      openDialogType: 'autodraw',
      pointer: 'selection',
      isMobile: false,
      isPencilMode: false,
      openCleanConfirm: false,
    },
    setAppState: mockSetAppState,
  }),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../scene-import/import-bundle-package', () => ({
  importBundlePackage: jest.fn(),
}));

jest.mock('./autodraw-reference-gallery', () => ({
  isAutodrawReferenceGallerySupported: () => mockGallerySupport(),
  loadStoredAutodrawReferenceDirectory: () =>
    mockLoadStoredReferenceDirectory(),
  requestAutodrawReferenceDirectory: () => mockRequestReferenceDirectory(),
  readAutodrawReferenceGallery: (handle: unknown) =>
    mockReadReferenceGallery(handle),
  ensureAutodrawReferenceDirectoryPermission: (handle: unknown) =>
    mockEnsureReferenceDirectoryPermission(handle),
  saveStoredAutodrawReferenceDirectory: (handle: unknown) =>
    mockSaveStoredReferenceDirectory(handle),
  clearStoredAutodrawReferenceDirectory: () =>
    mockClearStoredReferenceDirectory(),
}));

describe('AutodrawDialog import semantics', () => {
  const mockFetch = jest.fn();
  const importBundlePackageMock = importBundlePackage as jest.MockedFunction<
    typeof importBundlePackage
  >;
  const clipboardWriteText = jest.fn();
  const originalFetch = global.fetch;
  const originalMatchMedia = window.matchMedia;
  const originalClipboard = navigator.clipboard;
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;

  beforeEach(() => {
    mockInsertFragment.mockReset();
    mockClearSelectedElement.mockReset();
    mockSetAppState.mockReset();
    importBundlePackageMock.mockReset();
    clipboardWriteText.mockReset();
    mockFetch.mockReset();
    mockGallerySupport.mockReset();
    mockGallerySupport.mockReturnValue(false);
    mockLoadStoredReferenceDirectory.mockReset();
    mockLoadStoredReferenceDirectory.mockResolvedValue(undefined);
    mockRequestReferenceDirectory.mockReset();
    mockReadReferenceGallery.mockReset();
    mockEnsureReferenceDirectoryPermission.mockReset();
    mockEnsureReferenceDirectoryPermission.mockResolvedValue(true);
    mockSaveStoredReferenceDirectory.mockReset();
    mockClearStoredReferenceDirectory.mockReset();
    // AutodrawDialog mounts and then requests the runtime job preview list.
    mockFetch.mockResolvedValue(createJsonResponse([]));
    localStorage.clear();
    global.fetch = mockFetch as typeof fetch;
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn((file?: File) => `blob:${file?.name || 'preview'}`),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value:
        typeof originalRevokeObjectURL === 'function'
          ? originalRevokeObjectURL
          : jest.fn(),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('keeps assembly preview but inserts the imported bundle only once', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/jobs?limit=12&offset=0')) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.endsWith('/api/jobs/job-1')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-1',
            status: 'succeeded',
            bundle_url: '/bundle.zip',
            current_stage: 4,
            failed_stage: null,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-1/artifacts/figure.png',
              },
              {
                name: 'final.svg',
                path: 'final.svg',
                kind: 'final_svg',
                size_bytes: 100,
                download_url: '/api/jobs/job-1/artifacts/final.svg',
              },
            ],
          })
        );
      }
      if (url.includes('/api/jobs/job-1/logs?offset=0')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-1',
            offset: 0,
            next_offset: 0,
            completed: true,
            lines: ['done'],
          })
        );
      }
      if (url.endsWith('/bundle.zip')) {
        return Promise.resolve(createBlobResponse(bundleBlob));
      }
      return Promise.resolve(createJsonResponse([]));
    });

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-1',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(
      () => {
        expect(mockInsertFragment.mock.calls.length).toBeGreaterThan(1);
      },
      { timeout: 1500 }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    expect(
      screen.getByRole('button', { name: 'dialog.autodraw.resume' })
    ).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: 'dialog.autodraw.copyJobId' })
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', {
        name: 'dialog.autodraw.openAssetActions: job-1',
      }).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('figure.png').length).toBeGreaterThan(0);
  });

  it('shows figure and final svg in the asset room and opens enlarged previews', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/jobs?limit=12&offset=0')) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.endsWith('/api/jobs/job-preview')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-preview',
            status: 'succeeded',
            bundle_url: '/bundle.zip',
            current_stage: 4,
            failed_stage: null,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-preview/artifacts/figure.png',
              },
              {
                name: 'icon_AF01_nobg.png',
                path: 'icons/icon_AF01_nobg.png',
                kind: 'icon',
                size_bytes: 80,
                download_url:
                  '/api/jobs/job-preview/artifacts/icons/icon_AF01_nobg.png',
              },
              {
                name: 'final.svg',
                path: 'final.svg',
                kind: 'final_svg',
                size_bytes: 120,
                download_url: '/api/jobs/job-preview/artifacts/final.svg',
              },
            ],
          })
        );
      }
      if (url.includes('/api/jobs/job-preview/logs?offset=0')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-preview',
            offset: 0,
            next_offset: 0,
            completed: true,
            lines: ['done'],
          })
        );
      }
      if (url.endsWith('/bundle.zip')) {
        return Promise.resolve(createBlobResponse(bundleBlob));
      }
      return Promise.resolve(createJsonResponse([]));
    });

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    const { container } = render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-preview',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    const assetRoom = container.querySelector(
      '.autodraw-asset-room'
    ) as HTMLElement | null;
    expect(assetRoom).toBeTruthy();
    expect(
      within(assetRoom as HTMLElement).getByText('figure.png')
    ).toBeTruthy();
    expect(
      within(assetRoom as HTMLElement).getByText('final.svg')
    ).toBeTruthy();
    expect(
      within(assetRoom as HTMLElement).getByText('icon_AF01_nobg.png')
    ).toBeTruthy();
    expect(
      within(assetRoom as HTMLElement).queryByRole('button', {
        name: 'dialog.autodraw.openAssetActions: icon_AF01_nobg.png',
      })
    ).toBeNull();

    const historyPreviewButton = await screen.findByRole('button', {
      name: 'dialog.autodraw.openPreview: job-preview',
    });
    const historyCard = historyPreviewButton.closest(
      '.autodraw-history-card'
    ) as HTMLElement | null;
    expect(historyCard).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        within(historyCard as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.openPreview: job-preview',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByRole('heading', { name: 'job-preview' })
      ).toBeTruthy();
    });

    await act(async () => {
      const dialog = screen.getByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'dialog.close' })
      );
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        within(historyCard as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.openAssetActions: job-preview',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        within(historyCard as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.openPreview',
        })
      ).toBeTruthy();
    });
    expect(
      within(historyCard as HTMLElement).getByRole('button', {
        name: 'dialog.autodraw.replayFromStage',
      })
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        within(assetRoom as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.openPreview: figure.png',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByRole('heading', { name: 'figure.png' })
      ).toBeTruthy();
      expect(within(dialog).getByAltText('figure.png')).toBeTruthy();
    });

    await act(async () => {
      const dialog = screen.getByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'dialog.close' })
      );
      await Promise.resolve();
    });

    const pipelineCard = container.querySelector(
      '.autodraw-pipeline-card'
    ) as HTMLElement | null;
    expect(pipelineCard).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        within(pipelineCard as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.openPreview: final.svg',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByRole('heading', { name: 'final.svg' })
      ).toBeTruthy();
      expect(within(dialog).getByAltText('final.svg')).toBeTruthy();
    });

    await act(async () => {
      const dialog = screen.getByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'dialog.close' })
      );
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        within(assetRoom as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.openPreview: icon_AF01_nobg.png',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      const panel = container.querySelector(
        '.autodraw-asset-lightbox__panel--icon'
      );
      const image = container.querySelector(
        '.autodraw-asset-lightbox__image--icon'
      );
      expect(panel).toBeTruthy();
      expect(image).toBeTruthy();
    });
  });

  it('imports a local zip directly without requesting backend job data', async () => {
    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    const { container } = render(<AutodrawDialog />);
    const zipInput = container.querySelector('#bundle-zip') as HTMLInputElement;
    const file = new File(['zip'], 'bundle.zip', { type: 'application/zip' });

    await act(async () => {
      fireEvent.change(zipInput, {
        target: {
          files: [file],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(mockInsertFragment.mock.calls.length).toBeGreaterThan(1);
    });
    expect(mockClearSelectedElement).toHaveBeenCalledWith(mockBoard);
    expect(mockClearSelectedElement.mock.calls.length).toBeGreaterThanOrEqual(
      mockInsertFragment.mock.calls.length
    );

    // Only the runtime jobs list request should be sent.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain('/api/jobs?limit=12');
  });

  it('renders lightweight right-rail placeholders before deferred panels hydrate', async () => {
    const { container } = render(<AutodrawDialog />);

    expect(
      container.querySelectorAll('.autodraw-side-card--loading')
    ).toHaveLength(2);

    await waitFor(() => {
      expect(
        container.querySelectorAll('.autodraw-side-card--loading')
      ).toHaveLength(0);
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.clearLogs' })
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.clearHistory' })
      ).toBeTruthy();
    });
  });

  it('lets the user terminate a running job from the workbench', async () => {
    let currentStatus: 'running' | 'cancelled' = 'running';

    mockFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/jobs?limit=12&offset=0')) {
          return Promise.resolve(createJsonResponse([]));
        }
        if (url.includes('/api/jobs/job-cancel/logs?offset=0')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel',
              offset: 0,
              next_offset: 0,
              completed: true,
              lines: ['running'],
            })
          );
        }
        if (
          url.endsWith('/api/jobs/job-cancel/cancel') &&
          init?.method === 'POST'
        ) {
          currentStatus = 'cancelled';
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel',
              status: 'cancelled',
              created_at: '2026-04-20T12:00:00.000Z',
              current_stage: 2,
              failed_stage: 2,
              artifacts: [
                {
                  name: 'figure.png',
                  path: 'figure.png',
                  kind: 'figure',
                  size_bytes: 100,
                  download_url: '/api/jobs/job-cancel/artifacts/figure.png',
                },
              ],
            })
          );
        }
        if (url.endsWith('/api/jobs/job-cancel')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel',
              status: currentStatus,
              created_at: '2026-04-20T12:00:00.000Z',
              current_stage: 2,
              failed_stage: currentStatus === 'cancelled' ? 2 : null,
              artifacts: [
                {
                  name: 'figure.png',
                  path: 'figure.png',
                  kind: 'figure',
                  size_bytes: 100,
                  download_url: '/api/jobs/job-cancel/artifacts/figure.png',
                },
              ],
            })
          );
        }
        return Promise.resolve(createJsonResponse([]));
      }
    );

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-cancel',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/jobs/job-cancel/cancel'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeNull();
      expect(
        screen.getAllByText('dialog.autodraw.status.cancelled').length
      ).toBeGreaterThan(0);
      expect(
        screen
          .getByRole('button', { name: 'dialog.autodraw.generate' })
          .hasAttribute('disabled')
      ).toBe(false);
    });
  });

  it('releases the workbench immediately while a cancelling job settles in history', async () => {
    let currentStatus: 'running' | 'cancelling' | 'cancelled' = 'running';
    let cancellingPollCount = 0;

    mockFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/jobs?limit=12&offset=0')) {
          return Promise.resolve(createJsonResponse([]));
        }
        if (url.includes('/api/jobs/job-cancel-watch/logs?offset=0')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-watch',
              offset: 0,
              next_offset: 0,
              completed: true,
              lines: ['running'],
            })
          );
        }
        if (
          url.endsWith('/api/jobs/job-cancel-watch/cancel') &&
          init?.method === 'POST'
        ) {
          currentStatus = 'cancelling';
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-watch',
              status: 'cancelling',
              created_at: '2026-04-20T12:00:00.000Z',
              current_stage: 2,
              failed_stage: null,
              artifacts: [
                {
                  name: 'figure.png',
                  path: 'figure.png',
                  kind: 'figure',
                  size_bytes: 100,
                  download_url:
                    '/api/jobs/job-cancel-watch/artifacts/figure.png',
                },
              ],
            })
          );
        }
        if (url.endsWith('/api/jobs/job-cancel-watch')) {
          if (currentStatus === 'cancelling') {
            cancellingPollCount += 1;
            if (cancellingPollCount >= 2) {
              currentStatus = 'cancelled';
            }
          }
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-watch',
              status: currentStatus,
              created_at: '2026-04-20T12:00:00.000Z',
              current_stage: 2,
              failed_stage: currentStatus === 'cancelled' ? 2 : null,
              artifacts: [
                {
                  name: 'figure.png',
                  path: 'figure.png',
                  kind: 'figure',
                  size_bytes: 100,
                  download_url:
                    '/api/jobs/job-cancel-watch/artifacts/figure.png',
                },
              ],
            })
          );
        }
        return Promise.resolve(createJsonResponse([]));
      }
    );

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-cancel-watch',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'dialog.autodraw.resume' })
      ).toBeNull();
      expect(
        screen
          .getByRole('button', { name: 'dialog.autodraw.generate' })
          .hasAttribute('disabled')
      ).toBe(false);
      expect(
        screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder')
      ).toMatchObject({
        value: 'job-cancel-watch',
      });
      expect(
        screen.getAllByText('dialog.autodraw.status.idle').length
      ).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText('dialog.autodraw.status.cancelled').length
      ).toBeGreaterThan(0);
    });
  });

  it('keeps the current running task foregrounded when cancel fails', async () => {
    mockFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/jobs?limit=12&offset=0')) {
          return Promise.resolve(createJsonResponse([]));
        }
        if (url.includes('/api/jobs/job-cancel-fail/logs?offset=0')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-fail',
              offset: 0,
              next_offset: 0,
              completed: true,
              lines: ['running'],
            })
          );
        }
        if (
          url.endsWith('/api/jobs/job-cancel-fail/cancel') &&
          init?.method === 'POST'
        ) {
          return Promise.resolve(createErrorResponse('cancel failed'));
        }
        if (url.endsWith('/api/jobs/job-cancel-fail')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-fail',
              status: 'running',
              created_at: '2026-04-20T12:00:00.000Z',
              current_stage: 2,
              failed_stage: null,
              artifacts: [],
            })
          );
        }
        return Promise.resolve(createJsonResponse([]));
      }
    );

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-cancel-fail',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('cancel failed')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeTruthy();
      expect(
        screen
          .getByRole('button', { name: 'dialog.autodraw.generate' })
          .hasAttribute('disabled')
      ).toBe(true);
    });
  });

  it('shows a staged canvas preview instead of enlarging icon crops while extraction is running', async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/jobs?limit=12&offset=0')) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.includes('/api/jobs/job-running-preview/logs?offset=0')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-running-preview',
            offset: 0,
            next_offset: 0,
            completed: true,
            lines: ['running'],
          })
        );
      }
      if (url.endsWith('/api/jobs/job-running-preview')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-running-preview',
            status: 'running',
            created_at: '2026-04-20T12:00:00.000Z',
            current_stage: 3,
            failed_stage: null,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 320,
                download_url: '/api/jobs/job-running-preview/artifacts/figure.png',
              },
              {
                name: 'icon_AF01_nobg.png',
                path: 'icons/icon_AF01_nobg.png',
                kind: 'icon',
                size_bytes: 120,
                download_url:
                  '/api/jobs/job-running-preview/artifacts/icons/icon_AF01_nobg.png',
              },
            ],
          })
        );
      }
      return Promise.resolve(createJsonResponse([]));
    });

    const { container } = render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-running-preview',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeTruthy();
    });

    const previewCanvas = container.querySelector(
      '.autodraw-output-canvas'
    ) as HTMLElement | null;
    expect(previewCanvas).toBeTruthy();
    expect(
      within(previewCanvas as HTMLElement).getByRole('button', {
        name: 'dialog.autodraw.openPreview: figure.png',
      })
    ).toBeTruthy();
    expect(
      (previewCanvas as HTMLElement).querySelector(
        '.autodraw-output-canvas__focus--busy'
      )
    ).toBeTruthy();
    expect(
      (previewCanvas as HTMLElement).querySelector(
        '.autodraw-output-canvas__inset'
      )
    ).toBeTruthy();
    expect(
      within(previewCanvas as HTMLElement).getByText(
        'dialog.autodraw.status.running'
      )
    ).toBeTruthy();
    expect(
      within(previewCanvas as HTMLElement).getByText(
        'dialog.autodraw.stage.extractAssets'
      )
    ).toBeTruthy();

    let historyPreviewImage: HTMLImageElement | null = null;
    await waitFor(() => {
      historyPreviewImage = container.querySelector(
        '.autodraw-history-card__preview .autodraw-asset-card__image'
      ) as HTMLImageElement | null;
      expect(historyPreviewImage).toBeTruthy();
    });
    expect(historyPreviewImage?.getAttribute('src')).toContain('figure.png');
  });

  it('stops the background cancel watcher when the same job is foregrounded again', async () => {
    let jobFetchCount = 0;
    let currentStatus: 'running' | 'cancelling' = 'running';

    mockFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/jobs?limit=12&offset=0')) {
          return Promise.resolve(createJsonResponse([]));
        }
        if (url.includes('/api/jobs/job-cancel-reload/logs?offset=0')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-reload',
              offset: 0,
              next_offset: 0,
              completed: true,
              lines: ['running'],
            })
          );
        }
        if (
          url.endsWith('/api/jobs/job-cancel-reload/cancel') &&
          init?.method === 'POST'
        ) {
          currentStatus = 'cancelling';
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-reload',
              status: 'cancelling',
              created_at: '2026-04-20T12:00:00.000Z',
              current_stage: 2,
              failed_stage: null,
              artifacts: [],
            })
          );
        }
        if (url.endsWith('/api/jobs/job-cancel-reload')) {
          jobFetchCount += 1;
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-cancel-reload',
              status: currentStatus,
              created_at: '2026-04-20T12:00:00.000Z',
              current_stage: 2,
              failed_stage: null,
              artifacts: [],
            })
          );
        }
        return Promise.resolve(createJsonResponse([]));
      }
    );

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-cancel-reload',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.cancel' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'dialog.autodraw.generate' })
          .hasAttribute('disabled')
      ).toBe(false);
    });

    const beforeReloadCount = jobFetchCount;

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.cancelling' })
      ).toBeTruthy();
    });

    const expectedUpperBound = beforeReloadCount + 3;

    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 120);
      });
    });

    expect(jobFetchCount).toBeLessThanOrEqual(expectedUpperBound);
  });

  it('lets the user delete a selected history entry without clearing the rest', async () => {
    localStorage.setItem(
      AUTODRAW_HISTORY_STORAGE_KEY_V1,
      JSON.stringify([
        {
          id: 'bundle:bundle.zip:1',
          type: 'bundle',
          title: 'bundle.zip',
          subtitle: 'Local ZIP',
          status: 'local',
          createdAt: '2026-04-20T10:00:00.000Z',
        },
        {
          id: 'job:server-job:1',
          type: 'job',
          jobType: 'autodraw',
          title: 'server-job',
          subtitle: 'Generated job',
          status: 'succeeded',
          createdAt: '2026-04-20T09:00:00.000Z',
          jobId: 'server-job',
        },
      ])
    );

    render(<AutodrawDialog />);

    const bundleAction = await screen.findByRole('button', {
      name: 'dialog.autodraw.openAssetActions: bundle.zip',
    });
    const bundleCard = bundleAction.closest(
      '.autodraw-history-card'
    ) as HTMLElement | null;
    expect(bundleCard).toBeTruthy();

    await act(async () => {
      fireEvent.click(bundleAction);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        within(bundleCard as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.deleteHistoryEntry',
        })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        within(bundleCard as HTMLElement).getByRole('button', {
          name: 'dialog.autodraw.deleteHistoryEntry',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        within(bundleCard as HTMLElement).getByText(
          'dialog.autodraw.deleteHistoryPrompt'
        )
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        within(bundleCard as HTMLElement).getByRole('button', {
          name: 'general.delete',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'dialog.autodraw.openAssetActions: bundle.zip',
        })
      ).toBeNull();
      expect(
        screen.getByRole('button', {
          name: 'dialog.autodraw.openAssetActions: server-job',
        })
      ).toBeTruthy();
    });

    await waitFor(() => {
      const persistedHistory = JSON.parse(
        localStorage.getItem(AUTODRAW_HISTORY_STORAGE_KEY_V2) ?? '[]'
      );
      expect(persistedHistory).toEqual([
        expect.objectContaining({
          id: 'job:server-job',
          jobId: 'server-job',
        }),
      ]);
      expect(localStorage.getItem(AUTODRAW_HISTORY_STORAGE_KEY_V1)).toBeNull();
    });
  });

  it('keeps gallery selection and preview as separate actions', async () => {
    mockGallerySupport.mockReturnValue(true);
    const galleryHandle = {
      name: 'refs',
      values: async function* values() {},
    };
    const referenceFile = new File(['ref'], 'ref-1.png', {
      type: 'image/png',
    });
    mockRequestReferenceDirectory.mockResolvedValue(galleryHandle);
    mockReadReferenceGallery.mockResolvedValue([
      {
        id: 'ref-1.png',
        name: 'ref-1',
        file: referenceFile,
      },
    ]);

    const { container } = render(<AutodrawDialog />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'dialog.autodraw.galleryChooseFolder',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'dialog.autodraw.openPreview: ref-1',
        })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'dialog.autodraw.openPreview: ref-1',
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('ref-1')).toBeTruthy();
      expect(within(dialog).getByText('ref-1.png')).toBeTruthy();
    });

    await act(async () => {
      const dialog = screen.getByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'dialog.close' })
      );
      await Promise.resolve();
    });

    const selectButton = container.querySelector(
      '.autodraw-gallery-card__select'
    ) as HTMLButtonElement | null;
    expect(selectButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(selectButton as HTMLButtonElement);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        container.querySelector('.autodraw-gallery-card--active')
      ).toBeTruthy();
    });
  });

  it('submits image size and sam prompt for text generation jobs', async () => {
    mockFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/jobs?limit=12')) {
          return Promise.resolve(createJsonResponse([]));
        }
        if (url.endsWith('/api/jobs') && init?.method === 'POST') {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-submit',
              status: 'queued',
            })
          );
        }
        if (url.includes('/api/jobs/job-submit/logs?offset=0')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-submit',
              offset: 0,
              next_offset: 0,
              completed: true,
              lines: [],
            })
          );
        }
        if (url.endsWith('/api/jobs/job-submit')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-submit',
              status: 'failed',
              current_stage: 1,
              failed_stage: 1,
              error_message: 'stage failed',
              artifacts: [],
            })
          );
        }
        return Promise.resolve(createJsonResponse([]));
      }
    );

    const { container } = render(<AutodrawDialog />);
    const imageSizeSelect = container.querySelector(
      'select.autodraw-input'
    ) as HTMLSelectElement;

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.placeholder'),
      {
        target: {
          value: 'pipeline steps',
        },
      }
    );
    fireEvent.change(imageSizeSelect, {
      target: {
        value: '2K',
      },
    });
    fireEvent.change(
      screen.getByDisplayValue('icon,person,robot,animal,CurvedArrow'),
      {
        target: {
          value: 'icon,diagram,arrow',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.generate' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      const jobCall = mockFetch.mock.calls.find(
        ([url, options]) =>
          String(url).endsWith('/api/jobs') && options?.method === 'POST'
      );
      expect(jobCall).toBeTruthy();
      const payload = JSON.parse(String(jobCall?.[1]?.body));
      expect(payload.method_text).toBe('pipeline steps');
      expect(payload.image_size).toBe('2K');
      expect(payload.sam_prompt).toBe('icon,diagram,arrow');
      expect(payload.start_stage).toBe(1);
      expect(payload.source_figure_path).toBeNull();
    });
  });

  it('uploads a source figure and starts the job from stage two', async () => {
    mockFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/jobs?limit=12')) {
          return Promise.resolve(createJsonResponse([]));
        }
        if (url.endsWith('/api/uploads/source-figure')) {
          return Promise.resolve(
            createJsonResponse({
              upload_id: 'srcfig_1',
              file_name: 'figure.png',
              stored_path: '/tmp/source-figure.png',
              size_bytes: 12,
            })
          );
        }
        if (url.endsWith('/api/jobs') && init?.method === 'POST') {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-source',
              status: 'queued',
            })
          );
        }
        if (url.includes('/api/jobs/job-source/logs?offset=0')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-source',
              offset: 0,
              next_offset: 0,
              completed: true,
              lines: [],
            })
          );
        }
        if (url.endsWith('/api/jobs/job-source')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-source',
              status: 'failed',
              current_stage: 2,
              failed_stage: 2,
              error_message: 'stage failed',
              artifacts: [],
            })
          );
        }
        return Promise.resolve(createJsonResponse([]));
      }
    );

    const { container } = render(<AutodrawDialog />);
    const sourceFile = new File(['img'], 'source.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'dialog.autodraw.modeSourceFigure',
        })
      );
      await Promise.resolve();
    });

    const sourceInput = container.querySelector(
      '#source-figure'
    ) as HTMLInputElement | null;
    expect(sourceInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(sourceInput as HTMLInputElement, {
        target: {
          files: [sourceFile],
        },
      });
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.generate' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(([url]) =>
          String(url).endsWith('/api/uploads/source-figure')
        )
      ).toBe(true);
      const jobCall = mockFetch.mock.calls.find(
        ([url, options]) =>
          String(url).endsWith('/api/jobs') && options?.method === 'POST'
      );
      expect(jobCall).toBeTruthy();
      const payload = JSON.parse(String(jobCall?.[1]?.body));
      expect(payload.method_text).toBeNull();
      expect(payload.reference_image_path).toBeNull();
      expect(payload.source_figure_path).toBe('/tmp/source-figure.png');
      expect(payload.source_processing_mode).toBe('segmented');
      expect(payload.start_stage).toBe(2);
      expect(payload.sam_prompt).toBe('icon,person,robot,animal,CurvedArrow');
    });
  });

  it('uploads a source figure and can jump straight to direct svg rebuild', async () => {
    mockFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/jobs?limit=12')) {
          return Promise.resolve(createJsonResponse([]));
        }
        if (url.endsWith('/api/uploads/source-figure')) {
          return Promise.resolve(
            createJsonResponse({
              upload_id: 'srcfig_svg_1',
              file_name: 'figure.png',
              stored_path: '/tmp/direct-svg-source.png',
              size_bytes: 12,
            })
          );
        }
        if (url.endsWith('/api/jobs') && init?.method === 'POST') {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-direct-svg',
              status: 'queued',
            })
          );
        }
        if (url.includes('/api/jobs/job-direct-svg/logs?offset=0')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-direct-svg',
              offset: 0,
              next_offset: 0,
              completed: true,
              lines: [],
            })
          );
        }
        if (url.endsWith('/api/jobs/job-direct-svg')) {
          return Promise.resolve(
            createJsonResponse({
              job_id: 'job-direct-svg',
              status: 'failed',
              current_stage: 4,
              failed_stage: 4,
              error_message: 'stage failed',
              artifacts: [],
            })
          );
        }
        return Promise.resolve(createJsonResponse([]));
      }
    );

    const { container } = render(<AutodrawDialog />);
    const sourceFile = new File(['img'], 'source.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'dialog.autodraw.modeSourceFigure',
        })
      );
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'dialog.autodraw.sourceRunDirectSvg',
        })
      );
      await Promise.resolve();
    });

    const sourceInput = container.querySelector(
      '#source-figure'
    ) as HTMLInputElement | null;
    expect(sourceInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(sourceInput as HTMLInputElement, {
        target: {
          files: [sourceFile],
        },
      });
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.generate' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      const jobCall = mockFetch.mock.calls.find(
        ([url, options]) =>
          String(url).endsWith('/api/jobs') && options?.method === 'POST'
      );
      expect(jobCall).toBeTruthy();
      const payload = JSON.parse(String(jobCall?.[1]?.body));
      expect(payload.source_figure_path).toBe('/tmp/direct-svg-source.png');
      expect(payload.source_processing_mode).toBe('direct_svg');
      expect(payload.start_stage).toBe(4);
    });
  });

  it('keeps imported element order stable across animated insertion batches', async () => {
    importBundlePackageMock.mockResolvedValue(
      createLayerSensitiveBundleImportResult()
    );

    const { container } = render(<AutodrawDialog />);
    const zipInput = container.querySelector('#bundle-zip') as HTMLInputElement;
    const file = new File(['zip'], 'bundle.zip', { type: 'application/zip' });

    await act(async () => {
      fireEvent.change(zipInput, {
        target: {
          files: [file],
        },
      });
      await Promise.resolve();
    });

    let insertedIds: Array<string | undefined> = [];
    await waitFor(
      () => {
        insertedIds = mockInsertFragment.mock.calls.flatMap((call) => {
          const fragment = call[0] as { elements?: Array<{ id?: string }> };
          return (fragment.elements || []).map((element) => element.id);
        });
        expect(insertedIds).toHaveLength(5);
      },
      { timeout: 4000 }
    );

    expect(insertedIds).toEqual([
      'background-rect',
      'icon-foreground',
      'label-backdrop',
      'label-text',
      'connector',
    ]);
  });

  it('lists runtime jobs in history and lets the user load them', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            job_id: 'job-list-1',
            status: 'succeeded',
            created_at: '2026-04-16T10:00:00.000Z',
            current_stage: 5,
            failed_stage: null,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-list-1/artifacts/figure.png',
              },
            ],
            bundle_url: '/api/jobs/job-list-1/bundle',
          },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-list-1',
          status: 'succeeded',
          bundle_url: '/bundle.zip',
          current_stage: 4,
          failed_stage: null,
          artifacts: [
            {
              name: 'figure.png',
              path: 'figure.png',
              kind: 'figure',
              size_bytes: 100,
              download_url: '/api/jobs/job-list-1/artifacts/figure.png',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-list-1',
          offset: 0,
          next_offset: 0,
          completed: true,
          lines: ['done'],
        })
      )
      .mockResolvedValueOnce(createBlobResponse(bundleBlob));

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    const { container } = render(<AutodrawDialog />);

    await waitFor(() => {
      expect(
        container.querySelectorAll('.autodraw-history-card').length
      ).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'dialog.autodraw.openAssetActions: job-list-1',
        })
      );
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.viewFlow' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledTimes(1);
    });
  });

  it('replays the current job from the asset room toolbar', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.includes('/api/jobs?limit=12&offset=0')) {
          return createJsonResponse([]);
        }

        if (url.endsWith('/api/jobs/job-list-1')) {
          return createJsonResponse({
            job_id: 'job-list-1',
            status: 'succeeded',
            bundle_url: '/api/jobs/job-list-1/bundle',
            current_stage: 5,
            failed_stage: null,
            min_start_stage: 1,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-list-1/artifacts/figure.png',
              },
            ],
          });
        }

        if (url.includes('/api/jobs/job-list-1/logs?offset=0')) {
          return createJsonResponse({
            job_id: 'job-list-1',
            offset: 0,
            next_offset: 0,
            completed: true,
            lines: ['loaded'],
          });
        }

        if (url.endsWith('/api/jobs/job-list-1/bundle')) {
          return createBlobResponse(bundleBlob);
        }

        if (url.endsWith('/api/jobs/job-list-1/replay')) {
          expect(init?.method).toBe('POST');
          expect(JSON.parse(String(init?.body))).toMatchObject({
            start_stage: 3,
          });
          return createJsonResponse({
            job_id: 'job-replay-1',
            status: 'queued',
          });
        }

        if (url.includes('/api/jobs/job-replay-1/logs?offset=0')) {
          return createJsonResponse({
            job_id: 'job-replay-1',
            offset: 0,
            next_offset: 0,
            completed: true,
            lines: ['replay'],
          });
        }

        if (url.endsWith('/api/jobs/job-replay-1')) {
          return createJsonResponse({
            job_id: 'job-replay-1',
            status: 'succeeded',
            bundle_url: '/api/jobs/job-replay-1/bundle',
            current_stage: 5,
            failed_stage: null,
            min_start_stage: 1,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-replay-1/artifacts/figure.png',
              },
            ],
          });
        }

        if (url.endsWith('/api/jobs/job-replay-1/bundle')) {
          return createBlobResponse(bundleBlob);
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }
    );

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-list-1',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    const toolbarReplaySelect = document.querySelector(
      '.autodraw-asset-toolbar__select'
    ) as HTMLSelectElement | null;
    expect(toolbarReplaySelect).toBeTruthy();

    fireEvent.change(toolbarReplaySelect as HTMLSelectElement, {
      target: {
        value: '3',
      },
    });

    await act(async () => {
      fireEvent.click(
        document.querySelector(
          '.autodraw-asset-toolbar .autodraw-mini-btn:last-of-type'
        ) as HTMLButtonElement
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledTimes(2);
    });
  });

  it('downloads bundle.zip from the asset room toolbar', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/jobs?limit=12&offset=0')) {
        return createJsonResponse([]);
      }

      if (url.endsWith('/api/jobs/job-list-zip')) {
        return createJsonResponse({
          job_id: 'job-list-zip',
          status: 'succeeded',
          bundle_url: '/api/jobs/job-list-zip/bundle',
          current_stage: 5,
          failed_stage: null,
          min_start_stage: 1,
          artifacts: [
            {
              name: 'figure.png',
              path: 'figure.png',
              kind: 'figure',
              size_bytes: 100,
              download_url: '/api/jobs/job-list-zip/artifacts/figure.png',
            },
          ],
        });
      }

      if (url.includes('/api/jobs/job-list-zip/logs?offset=0')) {
        return createJsonResponse({
          job_id: 'job-list-zip',
          offset: 0,
          next_offset: 0,
          completed: true,
          lines: ['loaded'],
        });
      }

      if (url.endsWith('/api/jobs/job-list-zip/bundle')) {
        return createBlobResponse(bundleBlob);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
      render(<AutodrawDialog />);

      fireEvent.change(
        screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
        {
          target: {
            value: 'job-list-zip',
          },
        }
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
        );
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'dialog.autodraw.downloadBundle' })
        ).toBeTruthy();
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', {
            name: 'dialog.autodraw.downloadBundle',
          })
        );
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled();
      });
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('copies the current job id after a successful load', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/jobs?limit=12&offset=0')) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.endsWith('/api/jobs/job-9')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-9',
            status: 'succeeded',
            bundle_url: '/bundle.zip',
            current_stage: 4,
            failed_stage: null,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-9/artifacts/figure.png',
              },
            ],
          })
        );
      }
      if (url.includes('/api/jobs/job-9/logs?offset=0')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-9',
            offset: 0,
            next_offset: 0,
            completed: true,
            lines: ['done'],
          })
        );
      }
      if (url.endsWith('/bundle.zip')) {
        return Promise.resolve(createBlobResponse(bundleBlob));
      }
      return Promise.resolve(createJsonResponse([]));
    });

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    const { container } = render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-9',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    await act(async () => {
      const currentJobCopyButton = container.querySelector(
        '.autodraw-dialog__job-actions .autodraw-button--secondary'
      ) as HTMLButtonElement | null;
      expect(currentJobCopyButton).toBeTruthy();
      fireEvent.click(currentJobCopyButton as HTMLButtonElement);
      await Promise.resolve();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith('job-9');
    expect(
      screen.queryAllByRole('button', { name: 'dialog.autodraw.copyJobId' })
        .length +
        screen.queryAllByRole('button', { name: 'dialog.autodraw.copied' })
          .length
    ).toBeGreaterThan(0);
  });

  it('restores the persisted draft when the dialog opens again', () => {
    localStorage.setItem(
      'drawnix:autodraw-draft:v2',
      JSON.stringify({
        methodText: 'restored pipeline',
        jobId: 'job-persisted',
        jobIdInput: 'job-persisted',
        provider: 'qingyun',
        showAdvanced: true,
      })
    );

    render(<AutodrawDialog />);

    expect(
      screen.getByPlaceholderText('dialog.autodraw.placeholder')
    ).toMatchObject({
      value: 'restored pipeline',
    });
    expect(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder')
    ).toMatchObject({
      value: 'job-persisted',
    });
  });

  it('keeps prior history entries when a new job snapshot is persisted', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    localStorage.setItem(
      AUTODRAW_HISTORY_STORAGE_KEY_V1,
      JSON.stringify([
        {
          id: 'job:old-job:1',
          type: 'job',
          title: 'old-job',
          subtitle: 'Generated job',
          status: 'succeeded',
          createdAt: '2026-04-15T10:00:00.000Z',
          jobId: 'old-job',
        },
      ])
    );

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/jobs?limit=12&offset=0')) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.endsWith('/api/jobs/job-20')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-20',
            status: 'succeeded',
            bundle_url: '/bundle.zip',
            current_stage: 4,
            failed_stage: null,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-20/artifacts/figure.png',
              },
            ],
            created_at: '2026-04-16T12:00:00.000Z',
          })
        );
      }
      if (url.includes('/api/jobs/job-20/logs?offset=0')) {
        return Promise.resolve(
          createJsonResponse({
            job_id: 'job-20',
            offset: 0,
            next_offset: 0,
            completed: true,
            lines: ['done'],
          })
        );
      }
      if (url.endsWith('/bundle.zip')) {
        return Promise.resolve(createBlobResponse(bundleBlob));
      }
      return Promise.resolve(createJsonResponse([]));
    });

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-20',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'dialog.autodraw.openAssetActions: old-job',
        })
      ).toBeTruthy();
    });

    await waitFor(() => {
      const persistedHistory = JSON.parse(
        localStorage.getItem(AUTODRAW_HISTORY_STORAGE_KEY_V2) ?? '[]'
      );
      expect(persistedHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ jobId: 'old-job' }),
          expect.objectContaining({ jobId: 'job-20' }),
        ])
      );
      expect(localStorage.getItem(AUTODRAW_HISTORY_STORAGE_KEY_V1)).toBeNull();
    });
  });

  it('filters image-edit jobs out of autodraw history', async () => {
    localStorage.setItem(
      AUTODRAW_HISTORY_STORAGE_KEY_V1,
      JSON.stringify([
        {
          id: 'job:image-edit-legacy',
          type: 'job',
          title: 'image-edit-legacy',
          subtitle: 'Generated job',
          status: 'succeeded',
          createdAt: '2026-04-20T10:00:00.000Z',
          jobId: 'image-edit-legacy',
        },
        {
          id: 'job:image-edit-tagged',
          type: 'job',
          jobType: 'image-edit',
          title: 'image-edit-tagged',
          subtitle: 'Generated job',
          status: 'succeeded',
          createdAt: '2026-04-20T09:30:00.000Z',
          jobId: 'image-edit-tagged',
        },
        {
          id: 'job:autodraw-old',
          type: 'job',
          jobType: 'autodraw',
          title: 'autodraw-old',
          subtitle: 'Generated job',
          status: 'succeeded',
          createdAt: '2026-04-20T09:00:00.000Z',
          jobId: 'autodraw-old',
        },
      ])
    );

    mockFetch.mockResolvedValueOnce(
      createJsonResponse([
        {
          job_id: 'image-edit-legacy',
          job_type: 'image-edit',
          status: 'succeeded',
          created_at: '2026-04-20T10:00:00.000Z',
          artifacts: [],
        },
        {
          job_id: 'autodraw-new',
          job_type: 'autodraw',
          status: 'succeeded',
          created_at: '2026-04-20T11:00:00.000Z',
          artifacts: [],
        },
      ])
    );

    render(<AutodrawDialog />);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'dialog.autodraw.openAssetActions: image-edit-legacy',
        })
      ).toBeNull();
      expect(
        screen.queryByRole('button', {
          name: 'dialog.autodraw.openAssetActions: image-edit-tagged',
        })
      ).toBeNull();
      expect(
        screen.getByRole('button', {
          name: 'dialog.autodraw.openAssetActions: autodraw-old',
        })
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: 'dialog.autodraw.openAssetActions: autodraw-new',
        })
      ).toBeTruthy();
    });
  });
});
