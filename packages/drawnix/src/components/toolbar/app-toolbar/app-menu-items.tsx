import {
  ExportImageIcon,
  GithubIcon,
  OpenFileIcon,
  SaveFileIcon,
  TrashIcon,
} from '../../icons';
import { useBoard, useListRender } from '@plait-board/react-board';
import {
  PlaitBoard,
  PlaitElement,
  PlaitTheme,
  ThemeColorMode,
  Viewport,
} from '@plait/core';
import { openJSONFile, parseJSONFile, saveAsJSON } from '../../../data/json';
import { hasValidViewport } from '../../../data/snapshot';
import {
  initialBoardAssemblyProgress,
  loadBoardElementsWithAssembly,
} from '../../../utils/board-assembly';
import MenuItem from '../../menu/menu-item';
import MenuItemLink from '../../menu/menu-item-link';
import { saveAsImage, saveAsSvg } from '../../../utils/image';
import { saveAsPptx } from '../../../utils/pptx-export';
import { importPptxPackage } from '../../../pptx-import/import-pptx-package';
import { useDrawnix } from '../../../hooks/use-drawnix';
import { useI18n } from '../../../i18n';
import Menu from '../../menu/menu';
import { useContext } from 'react';
import { MenuContentPropsContext } from '../../menu/common';
import { EVENT, MIME_TYPES } from '../../../constants';
import { getShortcutKey } from '../../../utils/common';
import { focusViewportOnElements } from '../../../utils/viewport-fit';
import { AppLogo } from '../../app-logo';
import './app-menu-items.scss';

export const SaveToFile = () => {
  const board = useBoard();
  const { t } = useI18n();
  return (
    <MenuItem
      data-testid="save-button"
      onSelect={() => {
        saveAsJSON(board);
      }}
      icon={SaveFileIcon}
      aria-label={t('menu.saveFile')}
      shortcut={getShortcutKey('CtrlOrCmd+S')}
    >
      {t('menu.saveFile')}
    </MenuItem>
  );
};
SaveToFile.displayName = 'SaveToFile';

export const OpenFile = () => {
  const board = useBoard();
  const listRender = useListRender();
  const { setAppState } = useDrawnix();
  const { t } = useI18n();
  const clearAndLoad = (
    value: PlaitElement[],
    viewport?: Viewport,
    theme?: PlaitTheme
  ) => {
    board.children = value;
    board.viewport = viewport || { zoom: 1 };
    if (theme) {
      board.theme = theme;
    }
    listRender.update(board.children, {
      board: board,
      parent: board,
      parentG: PlaitBoard.getElementHost(board),
    });
    if (!hasValidViewport(viewport)) {
      focusViewportOnElements(board, value);
    }
  };

  const setBoardImportProgress = (
    updater:
      | typeof initialBoardAssemblyProgress
      | ((
          current: typeof initialBoardAssemblyProgress
        ) => typeof initialBoardAssemblyProgress)
  ) => {
    setAppState((prev) => ({
      ...prev,
      boardImportProgress:
        typeof updater === 'function'
          ? updater(prev.boardImportProgress)
          : updater,
    }));
  };

  const clearBoardImportProgress = async () => {
    const settleDuration =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
        ? 0
        : 180;
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, settleDuration);
    });
    setBoardImportProgress(initialBoardAssemblyProgress);
  };

  const startPreparingImportProgress = (fileName: string) => {
    setBoardImportProgress({
      active: true,
      phase: 'preparing',
      fileName,
      totalBatches: 0,
      completedBatches: 0,
      insertedCount: 0,
    });
  };

  const waitForNextPaint = async () => {
    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      return;
    }
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  };

  const isPptxFile = (file: File) => {
    return file.type === MIME_TYPES.pptx || /\.pptx$/i.test(file.name || '');
  };

  const clearAndLoadWithAssembly = async (
    value: PlaitElement[],
    fileName: string,
    viewport?: Viewport,
    theme?: PlaitTheme
  ) => {
    if (theme) {
      board.theme = theme;
    }
    board.viewport = viewport || { zoom: 1 };
    const parentG = PlaitBoard.getElementHost(board);
    if (!parentG) {
      clearAndLoad(value, viewport, theme);
      return;
    }

    await loadBoardElementsWithAssembly({
      board,
      parentG,
      listRender,
      elements: value,
      fileName,
      onProgress: (progress) => {
        setBoardImportProgress(progress);
      },
    });

    if (!hasValidViewport(viewport)) {
      focusViewportOnElements(board, value);
    }
  };

  return (
    <MenuItem
      data-testid="open-button"
      onSelect={() => {
        openJSONFile()
          .then(async (file) => {
            const displayName = file.name || t('menu.open');
            startPreparingImportProgress(displayName);
            await waitForNextPaint();
            if (isPptxFile(file)) {
              const result = await importPptxPackage(file);
              await clearAndLoadWithAssembly(result.elements, displayName);
              await clearBoardImportProgress();
              return;
            }
            const { data, fileName } = await parseJSONFile(board, file);
            await clearAndLoadWithAssembly(
              data.elements,
              fileName || displayName,
              data.viewport,
              data.theme
            );
            await clearBoardImportProgress();
          })
          .catch(() => {
            setBoardImportProgress(initialBoardAssemblyProgress);
          });
      }}
      icon={OpenFileIcon}
      aria-label={t('menu.open')}
    >
      {t('menu.open')}
    </MenuItem>
  );
};
OpenFile.displayName = 'OpenFile';

export const SaveAsImage = () => {
  const board = useBoard();
  const menuContentProps = useContext(MenuContentPropsContext);
  const { t } = useI18n();
  return (
    <MenuItem
      icon={ExportImageIcon}
      data-testid="image-export-button"
      onSelect={() => {
        saveAsImage(board, true);
      }}
      submenu={
        <Menu
          onSelect={() => {
            const itemSelectEvent = new CustomEvent(EVENT.MENU_ITEM_SELECT, {
              bubbles: true,
              cancelable: true,
            });
            menuContentProps.onSelect?.(itemSelectEvent);
          }}
        >
          <MenuItem
            onSelect={() => {
              saveAsSvg(board);
            }}
            aria-label={t('menu.exportImage.svg')}
          >
            {t('menu.exportImage.svg')}
          </MenuItem>
          <MenuItem
            onSelect={() => {
              saveAsImage(board, true);
            }}
            aria-label={t('menu.exportImage.png')}
          >
            {t('menu.exportImage.png')}
          </MenuItem>
          <MenuItem
            onSelect={() => {
              saveAsImage(board, false);
            }}
            aria-label={t('menu.exportImage.jpg')}
          >
            {t('menu.exportImage.jpg')}
          </MenuItem>
        </Menu>
      }
      shortcut={getShortcutKey('CtrlOrCmd+Shift+E')}
      aria-label={t('menu.exportImage')}
    >
      {t('menu.exportImage')}
    </MenuItem>
  );
};
SaveAsImage.displayName = 'SaveAsImage';

export const SaveAsPptx = () => {
  const board = useBoard();
  const { t } = useI18n();
  return (
    <MenuItem
      icon={ExportImageIcon}
      data-testid="pptx-export-button"
      onSelect={() => {
        saveAsPptx(board).catch((error) => {
          console.error('Error exporting pptx:', error);
        });
      }}
      aria-label={t('menu.exportPptx')}
    >
      {t('menu.exportPptx')}
    </MenuItem>
  );
};
SaveAsPptx.displayName = 'SaveAsPptx';

export const CleanBoard = () => {
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  return (
    <MenuItem
      icon={TrashIcon}
      data-testid="reset-button"
      onSelect={() => {
        setAppState({
          ...appState,
          openCleanConfirm: true,
        });
      }}
      shortcut={getShortcutKey('CtrlOrCmd+Backspace')}
      aria-label={t('menu.cleanBoard')}
    >
      {t('menu.cleanBoard')}
    </MenuItem>
  );
};
CleanBoard.displayName = 'CleanBoard';

export const MenuBrandHeader = () => {
  return (
    <div className="menu-brand-header">
      <AppLogo size="medium" />
      <div className="brand-info">
        <div className="brand-name">XAI Board</div>
        <div className="brand-subtitle">XAI 课题组</div>
      </div>
    </div>
  );
};
MenuBrandHeader.displayName = 'MenuBrandHeader';

export const BackToLanding = ({ onBack }: { onBack: () => void }) => {
  return (
    <MenuItem
      onSelect={() => {
        onBack();
      }}
      aria-label="返回首页"
    >
      ← 返回首页
    </MenuItem>
  );
};
BackToLanding.displayName = 'BackToLanding';

export const Socials = () => {
  return (
    <MenuItemLink
      icon={GithubIcon}
      href="https://github.com/plait-board/drawnix"
      aria-label="GitHub"
    >
      GitHub
    </MenuItemLink>
  );
};
Socials.displayName = 'Socials';
