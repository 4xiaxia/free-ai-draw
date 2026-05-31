import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { ATTACHED_ELEMENT_CLASS_NAME, PlaitBoard } from '@plait/core';
import { Island } from '../../island';
import { useI18n } from '../../../i18n';
import {
  applyIconLibraryAsset,
  IconLibraryAsset,
  loadIconLibraryAssetsFromFiles,
  pickIconLibraryFiles,
} from '../../../utils/icon-library';
import {
  loadAssetLibraryItems,
  saveAssetLibraryItems,
} from '../../../asset-library/store';
import type {
  AssetLibraryFilter,
  AssetLibrarySort,
} from '../../../asset-library/types';
import {
  ASSET_LIBRARY_SOFT_LIMIT,
  createAssetLibraryItemFromBoardSelection,
  dataUrlToBlob,
  formatAssetFileSize,
  getAssetLibraryUsage,
} from '../../../asset-library/utils';
import { download } from '../../../utils/common';
import './icon-library-panel.scss';

export interface IconLibraryPanelProps {
  board: PlaitBoard;
}

const isAbortLikeError = (error: unknown) => {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
};

const getAssetTimestamp = (value?: string) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortAssets = (assets: IconLibraryAsset[], sort: AssetLibrarySort) => {
  const nextAssets = [...assets];
  if (sort === 'name') {
    return nextAssets.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === 'size') {
    return nextAssets.sort((a, b) => b.size - a.size);
  }
  if (sort === 'type') {
    return nextAssets.sort((a, b) => a.kind.localeCompare(b.kind));
  }
  return nextAssets.sort(
    (a, b) =>
      getAssetTimestamp(b.usedAt || b.createdAt) -
      getAssetTimestamp(a.usedAt || a.createdAt)
  );
};

export const IconLibraryPanel: React.FC<IconLibraryPanelProps> = ({
  board,
}) => {
  const { t } = useI18n();
  const [assets, setAssets] = useState<IconLibraryAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AssetLibraryFilter>('all');
  const [sort, setSort] = useState<AssetLibrarySort>('recent');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [renamingCardId, setRenamingCardId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadAssetLibraryItems().then((storedAssets) => {
      if (!alive) {
        return;
      }
      setAssets(storedAssets);
      setSelectedAssetId(storedAssets[0]?.id || null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setAndPersistAssets = (
    updater: (currentAssets: IconLibraryAsset[]) => IconLibraryAsset[]
  ) => {
    setAssets((currentAssets) => {
      const nextAssets = updater(currentAssets);
      void saveAssetLibraryItems(nextAssets);
      if (
        selectedAssetId &&
        !nextAssets.some((asset) => asset.id === selectedAssetId)
      ) {
        setSelectedAssetId(nextAssets[0]?.id || null);
      }
      return nextAssets;
    });
  };

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortAssets(
      assets.filter((asset) => {
        if (filter === 'favorite' && !asset.favorite) {
          return false;
        }
        if (filter === 'image' && asset.kind !== 'image') {
          return false;
        }
        if (filter === 'svg' && asset.kind !== 'svg') {
          return false;
        }
        if (filter === 'drawnix' && asset.kind !== 'drawnix') {
          return false;
        }
        if (
          (filter === 'local' || filter === 'ai' || filter === 'built-in') &&
          asset.source !== filter
        ) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [asset.name, asset.mimeType, asset.source, ...asset.tags].some(
          (value) => value.toLowerCase().includes(normalizedQuery)
        );
      }),
      sort
    );
  }, [assets, filter, query, sort]);

  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ||
    visibleAssets[0] ||
    null;
  const usage = getAssetLibraryUsage(assets);
  const usageRatio = Math.min(100, (usage / ASSET_LIBRARY_SOFT_LIMIT) * 100);

  const addAssetsFromFiles = async (files: File[]) => {
    if (!files.length) {
      return;
    }
    setIsUploading(true);
    setErrorMessage('');
    try {
      const nextAssets = await loadIconLibraryAssetsFromFiles(files);
      if (!nextAssets.length) {
        setErrorMessage(t('assetLibrary.unsupported'));
        return;
      }
      setAndPersistAssets((currentAssets) => [...nextAssets, ...currentAssets]);
      setSelectedAssetId(nextAssets[0].id);
    } finally {
      setIsUploading(false);
      setIsDraggingOver(false);
    }
  };

  const handleUpload = async () => {
    try {
      const files = await pickIconLibraryFiles();
      await addAssetsFromFiles(files);
    } catch (error) {
      setIsUploading(false);
      if (!isAbortLikeError(error)) {
        setErrorMessage(t('assetLibrary.uploadFailed'));
      }
    }
  };

  const handleSaveSelection = async () => {
    setIsSavingSelection(true);
    setErrorMessage('');
    try {
      const nextAsset = await createAssetLibraryItemFromBoardSelection(board);
      setAndPersistAssets((currentAssets) => [nextAsset, ...currentAssets]);
      setSelectedAssetId(nextAsset.id);
    } catch {
      setErrorMessage(t('assetLibrary.saveSelectionFailed'));
    } finally {
      setIsSavingSelection(false);
    }
  };

  const handleApply = async (asset: IconLibraryAsset) => {
    try {
      await applyIconLibraryAsset(board, asset);
      const usedAt = new Date().toISOString();
      setAndPersistAssets((currentAssets) =>
        currentAssets.map((item) =>
          item.id === asset.id ? { ...item, usedAt, updatedAt: usedAt } : item
        )
      );
    } catch {
      setErrorMessage(t('assetLibrary.insertFailed'));
    }
  };

  const handleRemove = (assetId: string) => {
    setAndPersistAssets((currentAssets) =>
      currentAssets.filter((asset) => asset.id !== assetId)
    );
  };

  const handleToggleFavorite = (assetId: string) => {
    setAndPersistAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              favorite: !asset.favorite,
              updatedAt: new Date().toISOString(),
            }
          : asset
      )
    );
  };

  const handleSetSubject = (assetId: string) => {
    const updatedAt = new Date().toISOString();
    setAndPersistAssets((currentAssets) =>
      currentAssets.map((asset) => ({
        ...asset,
        isSubject: asset.id === assetId,
        updatedAt: asset.id === assetId ? updatedAt : asset.updatedAt,
      }))
    );
  };

  const handleRename = (assetId: string, name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }
    const updatedAt = new Date().toISOString();
    setAndPersistAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === assetId
          ? { ...asset, name: normalizedName, updatedAt }
          : asset
      )
    );
    setRenamingCardId(null);
  };

  const handleCancelRename = () => {
    setRenamingCardId(null);
  };

  const startRenamingCard = (assetId: string) => {
    setRenamingCardId(assetId);
    setSelectedAssetId(assetId);
  };

  const handleDownload = (asset: IconLibraryAsset) => {
    const extension =
      asset.kind === 'drawnix'
        ? 'drawnix'
        : asset.kind === 'svg'
        ? 'svg'
        : asset.mimeType.split('/')[1] || 'png';
    download(dataUrlToBlob(asset.dataUrl), `${asset.name}.${extension}`);
  };

  return (
    <Island
      padding={0}
      className={classNames(ATTACHED_ELEMENT_CLASS_NAME, 'icon-library-panel')}
    >
      <div className="icon-library-panel__topbar">
        <div className="icon-library-panel__heading">
          <div className="icon-library-panel__title">
            {t('toolbar.iconLibrary')}
          </div>
          <div className="icon-library-panel__hint">
            {t('iconLibrary.hint')}
          </div>
        </div>
        <div className="icon-library-panel__topbar-actions">
          <button
            type="button"
            className="icon-library-panel__secondary"
            onClick={() => {
              void handleSaveSelection();
            }}
            disabled={isSavingSelection}
          >
            {isSavingSelection
              ? t('assetLibrary.savingSelection')
              : t('assetLibrary.saveSelection')}
          </button>
          <button
            type="button"
            className="icon-library-panel__primary"
            onClick={() => {
              void handleUpload();
            }}
            disabled={isUploading}
          >
            {isUploading ? t('iconLibrary.uploading') : t('iconLibrary.upload')}
          </button>
        </div>
      </div>

      <div className="icon-library-panel__body">
        <div
          className={classNames('icon-library-panel__main', {
            'icon-library-panel__main--dragging': isDraggingOver,
          })}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            void addAssetsFromFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="icon-library-panel__controls">
            <label className="icon-library-panel__search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('assetLibrary.search')}
              />
            </label>
            <select
              className="icon-library-panel__select"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as AssetLibraryFilter)
              }
              aria-label={t('assetLibrary.filter')}
            >
              <option value="all">{t('assetLibrary.filter.all')}</option>
              <option value="image">{t('assetLibrary.filter.image')}</option>
              <option value="svg">{t('assetLibrary.filter.svg')}</option>
              <option value="drawnix">
                {t('assetLibrary.filter.drawnix')}
              </option>
              <option value="favorite">
                {t('assetLibrary.filter.favorite')}
              </option>
              <option value="local">{t('assetLibrary.source.local')}</option>
              <option value="ai">{t('assetLibrary.source.ai')}</option>
              <option value="built-in">
                {t('assetLibrary.source.built-in')}
              </option>
            </select>
            <select
              className="icon-library-panel__select"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as AssetLibrarySort)
              }
              aria-label={t('assetLibrary.sort')}
            >
              <option value="recent">{t('assetLibrary.sort.recent')}</option>
              <option value="name">{t('assetLibrary.sort.name')}</option>
              <option value="size">{t('assetLibrary.sort.size')}</option>
              <option value="type">{t('assetLibrary.sort.type')}</option>
            </select>
          </div>

          <div className="icon-library-panel__meta">
            <span>
              {t('assetLibrary.count').replace(
                '{count}',
                String(assets.length)
              )}
            </span>
            <span>{t('assetLibrary.dropHint')}</span>
          </div>

          {errorMessage && (
            <div className="icon-library-panel__error">{errorMessage}</div>
          )}

          {!assets.length && (
            <button
              type="button"
              className="icon-library-panel__empty"
              onClick={() => {
                void handleUpload();
              }}
            >
              <span>{t('iconLibrary.empty')}</span>
              <strong>{t('assetLibrary.emptyAction')}</strong>
            </button>
          )}

          {!!assets.length && !visibleAssets.length && (
            <div className="icon-library-panel__empty">
              <span>{t('assetLibrary.noResults')}</span>
            </div>
          )}

          {!!visibleAssets.length && (
            <div className="icon-library-panel__grid">
              {visibleAssets.map((asset) => {
                const selected = asset.id === selectedAsset?.id;
                const isRenaming = renamingCardId === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={classNames('icon-library-panel__card', {
                      'icon-library-panel__card--selected': selected,
                      'icon-library-panel__card--renaming': isRenaming,
                    })}
                    onClick={() => setSelectedAssetId(asset.id)}
                    onDoubleClick={() => {
                      void handleApply(asset);
                    }}
                    title={asset.name}
                    aria-label={asset.name}
                  >
                    <div className="icon-library-panel__preview">
                      <img
                        src={asset.thumbnailDataUrl || asset.dataUrl}
                        alt={asset.name}
                      />
                    </div>
                    {isRenaming ? (
                      <input
                        className="icon-library-panel__name-input"
                        type="text"
                        defaultValue={asset.name}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(event) =>
                          handleRename(asset.id, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleRename(asset.id, event.currentTarget.value);
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            handleCancelRename();
                          }
                        }}
                      />
                    ) : (
                      <div className="icon-library-panel__name-row">
                        <div className="icon-library-panel__name">
                          {asset.name}
                        </div>
                        <button
                          type="button"
                          className="icon-library-panel__rename-btn"
                          title={t('assetLibrary.rename')}
                          onClick={(event) => {
                            event.stopPropagation();
                            startRenamingCard(asset.id);
                          }}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                    <div className="icon-library-panel__badges">
                      <span>{asset.kind.toUpperCase()}</span>
                      {asset.favorite && <span>♥</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="icon-library-panel__detail">
          {selectedAsset ? (
            <>
              <div className="icon-library-panel__detail-preview">
                <img
                  src={
                    selectedAsset.kind === 'drawnix'
                      ? selectedAsset.thumbnailDataUrl || selectedAsset.dataUrl
                      : selectedAsset.dataUrl
                  }
                  alt={selectedAsset.name}
                />
              </div>
              <input
                className="icon-library-panel__detail-title"
                value={selectedAsset.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setAssets((currentAssets) =>
                    currentAssets.map((asset) =>
                      asset.id === selectedAsset.id
                        ? { ...asset, name: value }
                        : asset
                    )
                  );
                }}
                onBlur={(event) =>
                  handleRename(selectedAsset.id, event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
                aria-label={t('assetLibrary.rename')}
              />
              <dl className="icon-library-panel__facts">
                <div>
                  <dt>{t('assetLibrary.type')}</dt>
                  <dd>{selectedAsset.kind.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>{t('assetLibrary.source')}</dt>
                  <dd>
                    {t(`assetLibrary.source.${selectedAsset.source}` as any)}
                  </dd>
                </div>
                <div>
                  <dt>{t('assetLibrary.createdAt')}</dt>
                  <dd>{new Date(selectedAsset.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{t('assetLibrary.size')}</dt>
                  <dd>{formatAssetFileSize(selectedAsset.size)}</dd>
                </div>
                {selectedAsset.kind === 'drawnix' && (
                  <div>
                    <dt>{t('assetLibrary.elements')}</dt>
                    <dd>{selectedAsset.elementCount || 0}</dd>
                  </div>
                )}
              </dl>
              <div
                className={classNames('icon-library-panel__actions', {
                  'icon-library-panel__actions--compact':
                    selectedAsset.kind === 'drawnix',
                })}
              >
                <button
                  type="button"
                  className="icon-library-panel__insert"
                  onClick={() => {
                    void handleApply(selectedAsset);
                  }}
                >
                  {t('assetLibrary.insert')}
                </button>
                {selectedAsset.kind !== 'drawnix' && (
                  <button
                    type="button"
                    onClick={() => handleSetSubject(selectedAsset.id)}
                  >
                    {selectedAsset.isSubject
                      ? t('assetLibrary.subjectSet')
                      : t('assetLibrary.setSubject')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(selectedAsset.id)}
                >
                  {selectedAsset.favorite
                    ? t('assetLibrary.unfavorite')
                    : t('assetLibrary.favorite')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(selectedAsset)}
                >
                  {t('assetLibrary.download')}
                </button>
                <button
                  type="button"
                  className="icon-library-panel__danger"
                  onClick={() => handleRemove(selectedAsset.id)}
                >
                  {t('iconLibrary.remove')}
                </button>
              </div>
            </>
          ) : (
            <div className="icon-library-panel__detail-empty">
              {t('assetLibrary.selectAsset')}
            </div>
          )}
        </aside>
      </div>

      <div className="icon-library-panel__footer">
        <span>
          {t('assetLibrary.usage')
            .replace('{used}', formatAssetFileSize(usage))
            .replace('{limit}', formatAssetFileSize(ASSET_LIBRARY_SOFT_LIMIT))}
        </span>
        <div className="icon-library-panel__usage">
          <span style={{ width: `${usageRatio}%` }} />
        </div>
      </div>
    </Island>
  );
};
