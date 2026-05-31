export type AssetLibrarySource = 'local' | 'ai' | 'built-in';

export type AssetLibraryKind = 'image' | 'svg' | 'drawnix';

export type AssetLibraryItem = {
  id: string;
  name: string;
  mimeType: string;
  kind: AssetLibraryKind;
  source: AssetLibrarySource;
  size: number;
  createdAt: string;
  updatedAt: string;
  usedAt?: string;
  tags: string[];
  favorite: boolean;
  isSubject: boolean;
  width?: number;
  height?: number;
  elementCount?: number;
  dataUrl: string;
  thumbnailDataUrl?: string;
};

export type AssetLibraryFilter =
  | 'all'
  | 'image'
  | 'svg'
  | 'drawnix'
  | 'favorite'
  | 'local'
  | 'ai'
  | 'built-in';

export type AssetLibrarySort = 'recent' | 'name' | 'size' | 'type';
