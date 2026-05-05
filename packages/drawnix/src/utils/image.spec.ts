import { saveAsImage, saveAsSvg } from './image';

const mockGetSelectedElements = jest.fn();
const mockToSvgData = jest.fn();
const mockDownload = jest.fn();
const mockExportBoardToRasterBlob = jest.fn();
const mockGetBackgroundColor = jest.fn();
const mockIsWhite = jest.fn();
const mockFileOpen = jest.fn();
const mockInsertImage = jest.fn();

jest.mock('@plait/core', () => ({
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  toSvgData: (...args: unknown[]) => mockToSvgData(...args),
}));

jest.mock('./common', () => ({
  download: (...args: unknown[]) => mockDownload(...args),
  exportBoardToRasterBlob: (...args: unknown[]) =>
    mockExportBoardToRasterBlob(...args),
}));

jest.mock('./color', () => ({
  getBackgroundColor: (...args: unknown[]) => mockGetBackgroundColor(...args),
  isWhite: (...args: unknown[]) => mockIsWhite(...args),
}));

jest.mock('../data/filesystem', () => ({
  fileOpen: (...args: unknown[]) => mockFileOpen(...args),
}));

jest.mock('../data/image', () => ({
  insertImage: (...args: unknown[]) => mockInsertImage(...args),
}));

describe('saveAsImage', () => {
  const getSelectedElementsMock = mockGetSelectedElements;
  const exportBoardToRasterBlobMock = mockExportBoardToRasterBlob;
  const downloadMock = mockDownload;
  const getBackgroundColorMock = mockGetBackgroundColor;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T08:00:00Z'));
    mockGetSelectedElements.mockReset();
    mockToSvgData.mockReset();
    mockDownload.mockReset();
    mockExportBoardToRasterBlob.mockReset();
    mockGetBackgroundColor.mockReset();
    mockIsWhite.mockReset();
    mockFileOpen.mockReset();
    mockInsertImage.mockReset();

    mockGetSelectedElements.mockReturnValue([]);
    mockGetBackgroundColor.mockReturnValue('#ffffff');
    mockExportBoardToRasterBlob.mockResolvedValue(
      new Blob(['png'], { type: 'image/png' })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exports selected content as a real PNG blob', async () => {
    const board = { children: [] } as any;
    const selectedElements = [{ id: 'image-1' }];
    const pngBlob = new Blob(['png'], { type: 'image/png' });
    getSelectedElementsMock.mockReturnValue(selectedElements as any);
    exportBoardToRasterBlobMock.mockResolvedValue(pngBlob);

    await saveAsImage(board, true);

    expect(exportBoardToRasterBlobMock).toHaveBeenCalledWith(board, {
      elements: selectedElements,
      fillStyle: 'transparent',
      format: 'png',
    });
    expect(downloadMock).toHaveBeenCalledWith(
      pngBlob,
      expect.stringMatching(/^drawnix-\d+\.png$/)
    );
  });

  it('exports the whole board as a real JPG blob when nothing is selected', async () => {
    const board = { children: [] } as any;
    const jpgBlob = new Blob(['jpg'], { type: 'image/jpeg' });
    getSelectedElementsMock.mockReturnValue([]);
    getBackgroundColorMock.mockReturnValue('#f7f8fb');
    exportBoardToRasterBlobMock.mockResolvedValue(jpgBlob);

    await saveAsImage(board, false);

    expect(exportBoardToRasterBlobMock).toHaveBeenCalledWith(board, {
      elements: undefined,
      fillStyle: '#f7f8fb',
      format: 'jpeg',
    });
    expect(downloadMock).toHaveBeenCalledWith(
      jpgBlob,
      expect.stringMatching(/^drawnix-\d+\.jpg$/)
    );
  });

  it('logs export failures instead of silently succeeding', async () => {
    const board = { children: [] } as any;
    const error = new Error('export failed');
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    exportBoardToRasterBlobMock.mockRejectedValue(error);

    await saveAsImage(board, true);

    expect(consoleError).toHaveBeenCalledWith('Error exporting image:', error);
    expect(downloadMock).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('exports SVG with transparent background when the board background is white', async () => {
    const board = { children: [] } as any;
    const selectedElements = [{ id: 'shape-1' }];
    getSelectedElementsMock.mockReturnValue(selectedElements as any);
    mockGetBackgroundColor.mockReturnValue('#ffffff');
    mockIsWhite.mockReturnValue(true);
    mockToSvgData.mockResolvedValue('<svg />');

    await saveAsSvg(board);

    expect(mockToSvgData).toHaveBeenCalledWith(board, {
      fillStyle: 'TRANSPARENT',
      padding: 20,
      ratio: 4,
      elements: selectedElements,
      inlineStyleClassNames: '.plait-text-container',
      styleNames: ['position'],
    });
    expect(downloadMock).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^drawnix-\d+\.svg$/)
    );
  });
});
