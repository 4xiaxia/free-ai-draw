import classNames from 'classnames';
import {
  ChangeEvent,
  KeyboardEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import '../styles/autodraw-dialog.scss';
import { useBoard } from '@plait-board/react-board';
import {
  clearSelectedElement,
  getViewportOrigination,
  PlaitBoard,
  PlaitElement,
  PlaitGroupElement,
  PlaitHistoryBoard,
  Point,
  RectangleClient,
  Transforms,
  WritableClipboardOperationType,
} from '@plait/core';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { SvgImportSummary } from '../../svg-import/convert-svg-to-drawnix';
import { importBundlePackage } from '../../scene-import/import-bundle-package';
import { scaleTextMetricBag } from './autodraw-text-scale';
import {
  focusViewportOnElements,
  focusViewportOnRectangle,
  IMPORT_VIEWPORT_FOCUS_OPTIONS,
} from '../../utils/viewport-fit';
import { AutodrawActivityPanel } from './autodraw-activity-panel';
import {
  AutodrawReferenceDirectoryHandle,
  AutodrawReferenceGalleryItemFile,
  clearStoredAutodrawReferenceDirectory,
  ensureAutodrawReferenceDirectoryPermission,
  isAutodrawReferenceGallerySupported,
  loadStoredAutodrawReferenceDirectory,
  readAutodrawReferenceGallery,
  requestAutodrawReferenceDirectory,
  saveStoredAutodrawReferenceDirectory,
} from './autodraw-reference-gallery';
import {
  AutodrawStatus,
  AutodrawArtifact,
  AutodrawAssetItem,
  AutodrawAssetShelfItem,
  AutodrawHistoryEntry,
  buildAutodrawAssetShelfItems,
  buildAssemblyBatches,
  getAutodrawHistoryDefaultReplayStage,
  getAutodrawHistoryMinReplayStage,
  getAutodrawStatusBadgeClass,
  getEffectiveWorkbenchStep,
  getAutodrawSpotlightAsset,
  getWorkbenchProgressRatio,
  mergeAutodrawArtifacts,
  toAutodrawAssetItems,
} from './autodraw-dialog.utils';
import { AutodrawHistoryPanel } from './autodraw-history-panel';
import { useAutodrawHistory } from './use-autodraw-history';

interface UploadReferenceImageResponse {
  upload_id: string;
  file_name: string;
  stored_path: string;
  content_type?: string | null;
  size_bytes: number;
}

interface CreateJobResponse {
  job_id: string;
  status: AutodrawStatus;
}

interface JobResponse {
  job_id: string;
  status: AutodrawStatus;
  error_message?: string | null;
  bundle_url?: string | null;
  artifacts?: AutodrawArtifact[];
  failed_stage?: number | null;
  current_stage?: number;
  min_start_stage?: number;
  source_job_id?: string | null;
  created_at?: string;
  request?: {
    job_type?: 'autodraw' | 'image-edit';
  };
}

interface JobLogChunkResponse {
  job_id: string;
  offset: number;
  next_offset: number;
  completed: boolean;
  lines: string[];
}

type AutodrawProcessTracePrompt = {
  title?: string;
  model?: string;
  provider?: string;
  content?: string;
};

type AutodrawProcessTraceStage = {
  id?: string;
  step?: number | string;
  title?: string;
  summary?: string;
  status?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  prompts?: AutodrawProcessTracePrompt[];
  data_flow?: string[];
};

type AutodrawProcessTrace = {
  schema_version?: number;
  title?: string;
  created_at?: string;
  updated_at?: string;
  pipeline?: string;
  settings?: Record<string, unknown>;
  stages?: AutodrawProcessTraceStage[];
};

type AutodrawClarificationOption = {
  id: string;
  label: string;
  description?: string | null;
};

type AutodrawClarificationQuestion = {
  id: string;
  title: string;
  options: AutodrawClarificationOption[];
  recommended_option_id?: string | null;
};

type AutodrawClarificationAnswer = {
  question_id: string;
  option_id: string;
  label?: string | null;
  description?: string | null;
};

type AutodrawClarificationContext = {
  questions: AutodrawClarificationQuestion[];
  answers: AutodrawClarificationAnswer[];
  context_summary?: string | null;
};

interface ClarifyJobResponse {
  questions: AutodrawClarificationQuestion[];
  context_summary: string;
}

type AssemblyProgress = {
  active: boolean;
  totalBatches: number;
  completedBatches: number;
  insertedCount: number;
};

type WorkbenchStageDefinition = {
  key: string;
  label: string;
  stepNumber: string;
};

type AssetPreviewState = {
  title: string;
  subtitle: string;
  url: string;
  mode: 'default' | 'icon';
};

type AutodrawInputMode = 'generate' | 'source';
type AutodrawImageSize = '2K' | '4K';
type AutodrawFigureLanguage = 'en' | 'zh';
type AutodrawCaLanguage = 'zh' | 'en';
type AutodrawSourceRunMode = 'segmented' | 'direct-svg';
type ReferenceSource = 'gallery' | 'upload' | null;
type AutodrawClarificationStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'skipped'
  | 'error';

type ReferenceGalleryState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'needs-permission'
  | 'unsupported'
  | 'error';

type ReferenceGalleryItem = AutodrawReferenceGalleryItemFile & {
  previewUrl: string;
};

const createAssetPreviewState = (
  asset: AutodrawAssetItem,
  subtitle = asset.path
): AssetPreviewState => ({
  title: asset.name,
  subtitle,
  url: asset.url,
  mode: asset.kind === 'icon' ? 'icon' : 'default',
});

const createGalleryPreviewState = (
  item: ReferenceGalleryItem
): AssetPreviewState => ({
  title: item.name,
  subtitle: item.file.name,
  url: item.previewUrl,
  mode: 'default',
});

const createHistoryPreviewState = (
  entry: AutodrawHistoryEntry
): AssetPreviewState | null => {
  if (!entry.previewUrl) {
    return null;
  }
  return {
    title: entry.title,
    subtitle: entry.jobId || entry.subtitle,
    url: entry.previewUrl,
    mode: 'default',
  };
};

type AutodrawPersistedDraft = {
  backendUrl?: string;
  methodText?: string;
  provider?: string;
  baseUrl?: string;
  caBaseUrl?: string;
  caModel?: string;
  caLanguage?: AutodrawCaLanguage;
  imageModel?: string;
  imageSize?: AutodrawImageSize;
  figureLanguage?: AutodrawFigureLanguage;
  inputMode?: AutodrawInputMode;
  sourceRunMode?: AutodrawSourceRunMode;
  removeBackground?: boolean;
  samPrompt?: string;
  svgModel?: string;
  jobId?: string;
  jobIdInput?: string;
  showAdvanced?: boolean;
  galleryDirectoryName?: string;
  selectedGalleryItemId?: string;
  referenceSource?: ReferenceSource;
};

const readViteEnv = (key: string) => {
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }
  ).env;
  return env?.[key]?.trim() || '';
};

const readDefaultBackendUrl = () =>
  readViteEnv('VITE_AUTODRAW_BACKEND_URL') || 'http://127.0.0.1:8001';

const readDefaultCaModel = () => readViteEnv('VITE_AUTODRAW_CA_MODEL');

const readDefaultCaBaseUrl = () => readViteEnv('VITE_AUTODRAW_CA_BASE_URL');

const readDefaultCaApiKey = () => readViteEnv('VITE_AUTODRAW_CA_API_KEY');

const DEFAULT_BACKEND_URL = readDefaultBackendUrl();
const DEFAULT_AUTODRAW_CA_MODEL = readDefaultCaModel();
const DEFAULT_AUTODRAW_CA_BASE_URL = readDefaultCaBaseUrl();
const DEFAULT_AUTODRAW_CA_API_KEY = readDefaultCaApiKey();
const AUTODRAW_DRAFT_STORAGE_KEY = 'drawnix:autodraw-draft:v2';
const AUTODRAW_HISTORY_PREVIEW_LIMIT = 12;
const AUTODRAW_REALTIME_POLL_INTERVAL = 1200;
const AUTODRAW_ASSEMBLY_LEAD_IN_DELAY = 220;
const AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION = 340;
const AUTODRAW_DEFERRED_INIT_DELAY =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 0 : 140;
const AUTODRAW_DRAFT_PERSIST_DELAY =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 0 : 220;
const DEFAULT_AUTODRAW_IMAGE_SIZE: AutodrawImageSize = '4K';
const DEFAULT_AUTODRAW_SAM_PROMPT = 'icon,person,robot,animal,CurvedArrow';
const AUTODRAW_REALTIME_PROBE_DEFINITIONS = [
  {
    name: 'figure.png',
    path: 'figure.png',
    kind: 'figure',
    minStep: 0,
  },
  {
    name: 'samed.png',
    path: 'samed.png',
    kind: 'samed',
    minStep: 1,
  },
  {
    name: 'template.svg',
    path: 'template.svg',
    kind: 'template_svg',
    minStep: 3,
  },
  {
    name: 'optimized_template.svg',
    path: 'optimized_template.svg',
    kind: 'optimized_template_svg',
    minStep: 3,
  },
  {
    name: 'final.svg',
    path: 'final.svg',
    kind: 'final_svg',
    minStep: 3,
  },
  {
    name: 'process_trace.json',
    path: 'process_trace.json',
    kind: 'process_trace',
    minStep: 0,
  },
] as const;

const emptySummary: SvgImportSummary = {
  textCount: 0,
  arrowCount: 0,
  rectCount: 0,
  componentCount: 0,
  ignoredBackgroundCount: 0,
  warnings: [],
};

const initialAssemblyProgress: AssemblyProgress = {
  active: false,
  totalBatches: 0,
  completedBatches: 0,
  insertedCount: 0,
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const createRealtimeProbeArtifact = (
  jobId: string,
  definition: (typeof AUTODRAW_REALTIME_PROBE_DEFINITIONS)[number]
): AutodrawArtifact => ({
  name: definition.name,
  path: definition.path,
  kind: definition.kind,
  size_bytes: 0,
  download_url: `/api/jobs/${jobId}/artifacts/${definition.path}`,
});

const loadPersistedAutodrawDraft = (): AutodrawPersistedDraft => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const payload = window.localStorage.getItem(AUTODRAW_DRAFT_STORAGE_KEY);
    if (!payload) {
      return {};
    }
    const parsed = JSON.parse(payload) as AutodrawPersistedDraft;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeAutodrawInputMode = (
  value?: string | null
): AutodrawInputMode => {
  return value === 'source' ? 'source' : 'generate';
};

const normalizeAutodrawImageSize = (
  value?: string | null
): AutodrawImageSize => {
  return value === '2K' ? '2K' : DEFAULT_AUTODRAW_IMAGE_SIZE;
};

const normalizeAutodrawFigureLanguage = (
  value?: string | null
): AutodrawFigureLanguage => {
  return value === 'zh' ? 'zh' : 'en';
};

const normalizeAutodrawCaLanguage = (
  value?: string | null
): AutodrawCaLanguage => {
  return value === 'en' ? 'en' : 'zh';
};

const formatProcessTraceValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'object' && item !== null
          ? JSON.stringify(item)
          : String(item)
      )
      .join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const getProcessTraceStepLabel = (step: number | string | undefined) => {
  if (step === undefined || step === null || step === '') {
    return '—';
  }
  return typeof step === 'number'
    ? String(step).padStart(2, '0')
    : String(step);
};

const normalizeAutodrawSourceRunMode = (
  value?: string | null
): AutodrawSourceRunMode => {
  return value === 'direct-svg' ? 'direct-svg' : 'segmented';
};

const normalizeSamPromptValue = (value?: string | null) => {
  const normalized = (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',');
  return normalized || DEFAULT_AUTODRAW_SAM_PROMPT;
};

const getElementRectangle = (elements: PlaitElement[]) => {
  const rectangles = elements.flatMap((element) => {
    if (PlaitGroupElement.isGroup(element)) {
      return [];
    }
    const points = (element as { points?: Point[] }).points;
    if (!Array.isArray(points) || points.length < 2) {
      return [];
    }
    return [RectangleClient.getRectangleByPoints(points)];
  });
  return rectangles.length
    ? RectangleClient.getBoundingRectangle(rectangles)
    : { x: 0, y: 0, width: 0, height: 0 };
};

const roundScaleValue = (value: number) => Math.round(value * 1000) / 1000;
const roundTextScaleFactor = (value: number) => Math.round(value * 100) / 100;
const filterAutodrawHistoryEntries = (entries: AutodrawHistoryEntry[]) =>
  entries.filter((entry) => entry.jobType !== 'image-edit');

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    const effectiveDuration =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
        ? Math.min(duration, 12)
        : duration;
    window.setTimeout(() => resolve(), effectiveDuration);
  });

const getAssemblyBatchDelay = (
  batch: PlaitElement[],
  index: number,
  totalBatches: number
) => {
  const hasText = batch.some((element) => {
    const candidate = element as {
      shape?: string;
      text?: unknown;
      textStyle?: unknown;
    };
    return (
      candidate.shape === 'text' ||
      Boolean(candidate.text && candidate.textStyle)
    );
  });
  const hasArrow = batch.some(
    (element) => (element as { type?: string }).type === 'arrow-line'
  );
  const hasImage = batch.some(
    (element) => (element as { type?: string }).type === 'image'
  );

  let delay = 210;
  if (hasText) {
    delay = 280;
  } else if (hasArrow) {
    delay = 220;
  } else if (hasImage) {
    delay = 240;
  } else {
    delay = 300;
  }

  delay += Math.min(90, Math.max(0, batch.length - 1) * 26);

  if (index === 0) {
    delay += 90;
  }
  if (index === totalBatches - 2) {
    delay += 70;
  }

  return delay;
};

const getAssemblyBatchEnterProfile = (batch: PlaitElement[]) => {
  const hasText = batch.some((element) => {
    const candidate = element as {
      shape?: string;
      text?: unknown;
      textStyle?: unknown;
    };
    return (
      candidate.shape === 'text' ||
      Boolean(candidate.text && candidate.textStyle)
    );
  });
  const hasArrow = batch.some(
    (element) => (element as { type?: string }).type === 'arrow-line'
  );
  const hasImage = batch.some(
    (element) => (element as { type?: string }).type === 'image'
  );

  if (hasText) {
    return {
      translateY: 14,
      scale: 0.992,
      duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION,
      stagger: 26,
    };
  }

  if (hasArrow) {
    return {
      translateY: 18,
      scale: 0.988,
      duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION + 20,
      stagger: 30,
    };
  }

  if (hasImage) {
    return {
      translateY: 22,
      scale: 0.984,
      duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION + 35,
      stagger: 34,
    };
  }

  return {
    translateY: 26,
    scale: 0.978,
    duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION + 50,
    stagger: 38,
  };
};

const collectElementIds = (elements: PlaitElement[]) => {
  const ids: string[] = [];
  const visit = (element: PlaitElement) => {
    if (typeof (element as { id?: string }).id === 'string') {
      ids.push((element as { id: string }).id);
    }
    if (Array.isArray(element.children)) {
      element.children.forEach((child) => visit(child));
    }
  };
  elements.forEach((element) => visit(element));
  return ids;
};

const flattenBoardElements = (elements: PlaitElement[]): PlaitElement[] => {
  return elements.flatMap((element) => {
    const children = Array.isArray(
      (element as { children?: PlaitElement[] }).children
    )
      ? flattenBoardElements((element as { children: PlaitElement[] }).children)
      : [];
    return [element, ...children];
  });
};

const scaleTextLeafMetrics = (
  value: unknown,
  scaleStyleMetric: (value: unknown) => unknown
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => scaleTextLeafMetrics(item, scaleStyleMetric));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const next = { ...(value as Record<string, unknown>) };
  if (typeof next['text'] === 'string') {
    next['font-size'] = scaleStyleMetric(next['font-size']);
    next['line-height'] = scaleStyleMetric(next['line-height']);
    next['letter-spacing'] = scaleStyleMetric(next['letter-spacing']);
    return next;
  }
  if (Array.isArray(next['children'])) {
    next['children'] = (next['children'] as unknown[]).map((child) =>
      scaleTextLeafMetrics(child, scaleStyleMetric)
    );
  }
  return next;
};

const AutodrawDialog = () => {
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const board = useBoard();
  const persistedDraftRef = useRef<AutodrawPersistedDraft>(
    loadPersistedAutodrawDraft()
  );

  const [backendUrl, setBackendUrl] = useState(
    persistedDraftRef.current.backendUrl || DEFAULT_BACKEND_URL
  );
  const [inputMode, setInputMode] = useState<AutodrawInputMode>(
    normalizeAutodrawInputMode(persistedDraftRef.current.inputMode)
  );
  const [sourceRunMode, setSourceRunMode] = useState<AutodrawSourceRunMode>(
    normalizeAutodrawSourceRunMode(persistedDraftRef.current.sourceRunMode)
  );
  const [removeBackground, setRemoveBackground] = useState(
    persistedDraftRef.current.removeBackground !== false
  );
  const [methodText, setMethodText] = useState(
    persistedDraftRef.current.methodText || ''
  );
  const [provider, setProvider] = useState(
    persistedDraftRef.current.provider || 'qingyun'
  );
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(
    persistedDraftRef.current.baseUrl || ''
  );
  const [caBaseUrl, setCaBaseUrl] = useState(
    persistedDraftRef.current.caBaseUrl || DEFAULT_AUTODRAW_CA_BASE_URL
  );
  const [caApiKey, setCaApiKey] = useState(DEFAULT_AUTODRAW_CA_API_KEY);
  const [caModel, setCaModel] = useState(
    persistedDraftRef.current.caModel || DEFAULT_AUTODRAW_CA_MODEL
  );
  const [caLanguage, setCaLanguage] = useState<AutodrawCaLanguage>(
    normalizeAutodrawCaLanguage(persistedDraftRef.current.caLanguage)
  );
  const [imageModel, setImageModel] = useState(
    persistedDraftRef.current.imageModel || ''
  );
  const [imageSize, setImageSize] = useState<AutodrawImageSize>(
    normalizeAutodrawImageSize(persistedDraftRef.current.imageSize)
  );
  const [figureLanguage, setFigureLanguage] = useState<AutodrawFigureLanguage>(
    normalizeAutodrawFigureLanguage(persistedDraftRef.current.figureLanguage)
  );
  const [samPrompt, setSamPrompt] = useState(
    normalizeSamPromptValue(persistedDraftRef.current.samPrompt)
  );
  const [svgModel, setSvgModel] = useState(
    persistedDraftRef.current.svgModel || ''
  );
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [sourceFigure, setSourceFigure] = useState<File | null>(null);
  const [referenceSource, setReferenceSource] = useState<ReferenceSource>(
    persistedDraftRef.current.referenceSource === 'gallery' ? 'gallery' : null
  );
  const [bundleFileName, setBundleFileName] = useState('');
  const [referencePreviewUrl, setReferencePreviewUrl] = useState('');
  const [jobId, setJobId] = useState(persistedDraftRef.current.jobId || '');
  const [jobIdInput, setJobIdInput] = useState(
    persistedDraftRef.current.jobIdInput ||
      persistedDraftRef.current.jobId ||
      ''
  );
  const [jobIdCopied, setJobIdCopied] = useState(false);
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [failedStage, setFailedStage] = useState<number | null>(null);
  const [status, setStatus] = useState<AutodrawStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<AutodrawArtifact[]>([]);
  const [realtimeArtifacts, setRealtimeArtifacts] = useState<
    AutodrawArtifact[]
  >([]);
  const [processTrace, setProcessTrace] = useState<AutodrawProcessTrace | null>(
    null
  );
  const [processTraceOpen, setProcessTraceOpen] = useState(false);
  const [processTraceStatus, setProcessTraceStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [processTraceError, setProcessTraceError] = useState('');
  const [workspaceReplayStage, setWorkspaceReplayStage] = useState(1);
  const [logMode, setLogMode] = useState<'idle' | 'sse' | 'polling'>('idle');
  const [summary, setSummary] = useState<SvgImportSummary>(emptySummary);
  const [previewElements, setPreviewElements] = useState<PlaitElement[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastImportedElementIds, setLastImportedElementIds] = useState<
    string[]
  >([]);
  const [lastImportedTextScale, setLastImportedTextScale] = useState(1);
  const [assemblyProgress, setAssemblyProgress] = useState<AssemblyProgress>(
    initialAssemblyProgress
  );
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(persistedDraftRef.current.showAdvanced)
  );
  const [assetPreview, setAssetPreview] = useState<AssetPreviewState | null>(
    null
  );
  const [isWorkbenchDocked, setIsWorkbenchDocked] = useState(false);
  const [deferredPanelsReady, setDeferredPanelsReady] = useState(false);
  const [galleryItems, setGalleryItems] = useState<ReferenceGalleryItem[]>([]);
  const [galleryState, setGalleryState] = useState<ReferenceGalleryState>(() =>
    isAutodrawReferenceGallerySupported() ? 'idle' : 'unsupported'
  );
  const [galleryDirectoryName, setGalleryDirectoryName] = useState(
    persistedDraftRef.current.galleryDirectoryName || ''
  );
  const [galleryMessage, setGalleryMessage] = useState('');
  const [selectedGalleryItemId, setSelectedGalleryItemId] = useState(
    persistedDraftRef.current.selectedGalleryItemId || ''
  );
  const [clarificationStatus, setClarificationStatus] =
    useState<AutodrawClarificationStatus>('idle');
  const [clarificationQuestions, setClarificationQuestions] = useState<
    AutodrawClarificationQuestion[]
  >([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<
    Record<string, string>
  >({});
  const [clarificationSummary, setClarificationSummary] = useState('');
  const [clarificationError, setClarificationError] = useState('');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const logPollingTimerRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeHistoryEntryIdRef = useRef('');
  const assemblyRunIdRef = useRef(0);
  const copyTimerRef = useRef<number | null>(null);
  const draftPersistTimerRef = useRef<number | null>(null);
  const galleryDirectoryHandleRef =
    useRef<AutodrawReferenceDirectoryHandle | null>(null);
  const galleryPreviewUrlsRef = useRef<string[]>([]);

  const disposeGalleryPreviewUrls = () => {
    galleryPreviewUrlsRef.current.forEach((previewUrl) => {
      window.URL.revokeObjectURL(previewUrl);
    });
    galleryPreviewUrlsRef.current = [];
  };

  const replaceGalleryItems = (
    nextItems: AutodrawReferenceGalleryItemFile[]
  ) => {
    disposeGalleryPreviewUrls();
    const hydratedItems = nextItems.map((item) => ({
      ...item,
      previewUrl: window.URL.createObjectURL(item.file),
    }));
    galleryPreviewUrlsRef.current = hydratedItems.map(
      (item) => item.previewUrl
    );
    startTransition(() => {
      setGalleryItems(hydratedItems);
    });
    return hydratedItems;
  };

  useEffect(() => {
    if (!assetPreview) {
      return;
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAssetPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [assetPreview]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const timer = window.setTimeout(() => {
      startTransition(() => {
        setDeferredPanelsReady(true);
      });
    }, AUTODRAW_DEFERRED_INIT_DELAY);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const {
    clearHistory,
    currentJobHistoryEntry,
    deleteHistoryEntry,
    historyPreviewEntries,
    rememberBundleHistory,
    rememberJobHistory,
    stopWatchingJob,
    watchJobUntilSettled,
  } = useAutodrawHistory({
    activeHistoryEntryIdRef,
    backendUrl,
    currentJobId: jobId,
    deferredReady: deferredPanelsReady,
    historyLimit: AUTODRAW_HISTORY_PREVIEW_LIMIT,
  });

  const deferredLogs = useDeferredValue(logs);
  const deferredHistoryPreviewEntries = useDeferredValue(historyPreviewEntries);

  const loadReferenceGalleryFromHandle = async (
    handle: AutodrawReferenceDirectoryHandle,
    options?: {
      applySelection?: boolean;
      preferredItemId?: string;
    }
  ) => {
    setGalleryState('loading');
    setGalleryMessage('');

    try {
      const granted = await ensureAutodrawReferenceDirectoryPermission(handle);
      if (!granted) {
        setGalleryState('needs-permission');
        setGalleryMessage(t('dialog.autodraw.galleryPermissionHint'));
        return [];
      }

      const nextFiles = await readAutodrawReferenceGallery(handle);
      const hydratedItems = replaceGalleryItems(nextFiles);
      galleryDirectoryHandleRef.current = handle;
      setGalleryDirectoryName(handle.name || '');
      setGalleryState('ready');

      const preferredItemId =
        options?.preferredItemId ||
        persistedDraftRef.current.selectedGalleryItemId ||
        '';
      const matchedItem = hydratedItems.find(
        (item) => item.id === preferredItemId
      );
      const nextSelectedId = matchedItem?.id || '';

      setSelectedGalleryItemId(nextSelectedId);
      if (options?.applySelection) {
        if (matchedItem) {
          setReferenceImage(matchedItem.file);
          setReferenceSource('gallery');
        } else {
          setReferenceImage(null);
          setReferenceSource(null);
          if (preferredItemId) {
            setGalleryMessage(t('dialog.autodraw.galleryMissingSelection'));
          }
        }
      }

      if (!hydratedItems.length) {
        setGalleryMessage(t('dialog.autodraw.galleryEmpty'));
      }

      return hydratedItems;
    } catch (error) {
      setGalleryState('error');
      setGalleryMessage(
        error instanceof Error
          ? error.message
          : t('dialog.autodraw.galleryLoadFailed')
      );
      return [];
    }
  };

  useEffect(() => {
    if (!referenceImage) {
      setReferencePreviewUrl('');
      return;
    }
    const url = window.URL.createObjectURL(referenceImage);
    setReferencePreviewUrl(url);
    return () => {
      window.URL.revokeObjectURL(url);
    };
  }, [referenceImage]);

  useEffect(() => {
    if (status === 'failed' || status === 'cancelled') {
      setShowAdvanced(true);
      setIsWorkbenchDocked(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'importing') {
      setIsWorkbenchDocked(true);
    }
  }, [status]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const draft: AutodrawPersistedDraft = {
      backendUrl,
      inputMode,
      sourceRunMode,
      removeBackground,
      methodText,
      provider,
      baseUrl,
      caBaseUrl,
      caModel,
      caLanguage,
      imageModel,
      imageSize,
      figureLanguage,
      samPrompt: normalizeSamPromptValue(samPrompt),
      svgModel,
      jobId,
      jobIdInput,
      showAdvanced,
      galleryDirectoryName,
      selectedGalleryItemId,
      referenceSource: referenceSource === 'gallery' ? 'gallery' : null,
    };
    if (draftPersistTimerRef.current) {
      window.clearTimeout(draftPersistTimerRef.current);
    }
    draftPersistTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(
        AUTODRAW_DRAFT_STORAGE_KEY,
        JSON.stringify(draft)
      );
    }, AUTODRAW_DRAFT_PERSIST_DELAY);
    return () => {
      if (draftPersistTimerRef.current) {
        window.clearTimeout(draftPersistTimerRef.current);
        draftPersistTimerRef.current = null;
      }
    };
  }, [
    backendUrl,
    inputMode,
    sourceRunMode,
    removeBackground,
    methodText,
    provider,
    baseUrl,
    caBaseUrl,
    caModel,
    caLanguage,
    imageModel,
    imageSize,
    figureLanguage,
    samPrompt,
    svgModel,
    jobId,
    jobIdInput,
    showAdvanced,
    galleryDirectoryName,
    selectedGalleryItemId,
    referenceSource,
  ]);

  useEffect(() => {
    let active = true;
    if (!deferredPanelsReady || !isAutodrawReferenceGallerySupported()) {
      return () => {
        active = false;
      };
    }

    void loadStoredAutodrawReferenceDirectory()
      .then((storedHandle) => {
        if (!active || !storedHandle) {
          return;
        }
        galleryDirectoryHandleRef.current = storedHandle;
        setGalleryDirectoryName(
          storedHandle.name ||
            persistedDraftRef.current.galleryDirectoryName ||
            ''
        );
        return loadReferenceGalleryFromHandle(storedHandle, {
          applySelection:
            persistedDraftRef.current.referenceSource === 'gallery',
          preferredItemId: persistedDraftRef.current.selectedGalleryItemId,
        });
      })
      .catch(() => {
        setGalleryState('idle');
      });

    return () => {
      active = false;
      disposeGalleryPreviewUrls();
    };
  }, [deferredPanelsReady, t]);

  useEffect(() => {
    const root = rootRef.current;
    const overlay = root?.closest('.Dialog-overlay');
    const modal = root?.closest('.autodraw-dialog-modal');

    overlay?.classList.toggle(
      'autodraw-dialog-overlay--peek',
      isWorkbenchDocked
    );
    modal?.classList.toggle('autodraw-dialog-modal--docked', isWorkbenchDocked);

    return () => {
      overlay?.classList.remove('autodraw-dialog-overlay--peek');
      modal?.classList.remove('autodraw-dialog-modal--docked');
    };
  }, [isWorkbenchDocked]);

  useEffect(() => {
    return () => {
      assemblyRunIdRef.current += 1;
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
      if (logPollingTimerRef.current) {
        window.clearTimeout(logPollingTimerRef.current);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (draftPersistTimerRef.current) {
        window.clearTimeout(draftPersistTimerRef.current);
      }
      disposeGalleryPreviewUrls();
      eventSourceRef.current?.close();
    };
  }, []);

  const workbenchStages = useMemo<WorkbenchStageDefinition[]>(
    () => [
      {
        key: 'generate',
        label: t('dialog.autodraw.stage.generateFigure'),
        stepNumber: '01',
      },
      {
        key: 'parse',
        label: t('dialog.autodraw.stage.parseStructure'),
        stepNumber: '02',
      },
      {
        key: 'extract',
        label: t('dialog.autodraw.stage.extractAssets'),
        stepNumber: '03',
      },
      {
        key: 'rebuild',
        label: t('dialog.autodraw.stage.rebuildSvg'),
        stepNumber: '04',
      },
      {
        key: 'import',
        label: t('dialog.autodraw.stage.importCanvas'),
        stepNumber: '05',
      },
    ],
    [t]
  );

  const workbenchStageLabels = useMemo(
    () => workbenchStages.map((stage) => stage.label),
    [workbenchStages]
  );

  const summaryItems = useMemo(
    () => [
      {
        label: t('dialog.autodraw.summary.texts'),
        value: summary.textCount,
      },
      {
        label: t('dialog.autodraw.summary.arrows'),
        value: summary.arrowCount,
      },
      {
        label: t('dialog.autodraw.summary.components'),
        value: summary.componentCount,
      },
    ],
    [summary, t]
  );

  const statusLabel = useMemo(() => {
    if (status === 'idle') {
      return t('dialog.autodraw.status.idle');
    }
    if (status === 'queued') {
      return t('dialog.autodraw.status.queued');
    }
    if (status === 'running') {
      return t('dialog.autodraw.status.running');
    }
    if (status === 'cancelling') {
      return t('dialog.autodraw.status.cancelling');
    }
    if (status === 'submitting') {
      return t('dialog.autodraw.status.submitting');
    }
    if (status === 'importing') {
      return t('dialog.autodraw.status.importing');
    }
    if (status === 'succeeded') {
      return t('dialog.autodraw.status.succeeded');
    }
    if (status === 'cancelled') {
      return t('dialog.autodraw.status.cancelled');
    }
    return t('dialog.autodraw.status.failed');
  }, [status, t]);

  const hasImportedPreview =
    previewElements.length > 0 ||
    assemblyProgress.completedBatches > 0 ||
    status === 'succeeded';

  const batchPreviewCount = useMemo(() => {
    if (assemblyProgress.totalBatches > 0) {
      return assemblyProgress.totalBatches;
    }
    if (!previewElements.length) {
      return 4;
    }
    return Math.min(8, Math.max(4, Math.ceil(previewElements.length / 3)));
  }, [assemblyProgress.totalBatches, previewElements.length]);

  const canAdjustTextScale = lastImportedElementIds.length > 0;
  const isJobBusy =
    status === 'submitting' ||
    status === 'queued' ||
    status === 'running' ||
    status === 'cancelling' ||
    status === 'importing';

  const mergedArtifacts = useMemo(
    () => mergeAutodrawArtifacts(artifacts, realtimeArtifacts),
    [artifacts, realtimeArtifacts]
  );

  const assetItems = useMemo(
    () => toAutodrawAssetItems(mergedArtifacts, backendUrl),
    [backendUrl, mergedArtifacts]
  );

  const activeWorkbenchStep = useMemo(
    () =>
      getEffectiveWorkbenchStep({
        status,
        currentStage,
        failedStage,
        logs,
        assets: assetItems,
        hasImportedPreview,
      }),
    [assetItems, currentStage, failedStage, hasImportedPreview, logs, status]
  );

  const assetShelfItems = useMemo<AutodrawAssetShelfItem[]>(
    () =>
      buildAutodrawAssetShelfItems({
        assets: assetItems,
        activeStep: activeWorkbenchStep,
        isBusy: isJobBusy,
        stageLabels: workbenchStageLabels,
      }),
    [activeWorkbenchStep, assetItems, isJobBusy, workbenchStageLabels]
  );

  const spotlightAsset = useMemo(
    () =>
      getAutodrawSpotlightAsset(assetItems, {
        preferredStep: activeWorkbenchStep,
        strictStep: isJobBusy && activeWorkbenchStep > 0,
      }),
    [activeWorkbenchStep, assetItems, isJobBusy]
  );
  const previewCanvasAsset = useMemo(() => {
    if (!spotlightAsset) {
      return null;
    }
    if (!isJobBusy || spotlightAsset.kind !== 'icon') {
      return spotlightAsset;
    }
    return (
      assetItems.find(
        (asset) =>
          asset.previewable &&
          [
            'figure',
            'final_svg',
            'optimized_template_svg',
            'template_svg',
          ].includes(asset.kind)
      ) || spotlightAsset
    );
  }, [assetItems, isJobBusy, spotlightAsset]);
  const previewCanvasInsetAsset = useMemo(() => {
    if (
      !isJobBusy ||
      !spotlightAsset?.previewable ||
      !previewCanvasAsset ||
      previewCanvasAsset.id === spotlightAsset.id
    ) {
      return null;
    }
    return spotlightAsset;
  }, [isJobBusy, previewCanvasAsset, spotlightAsset]);
  const previewCanvasStatusLabel =
    status === 'importing'
      ? t('dialog.autodraw.status.importing')
      : t('dialog.autodraw.status.running');

  const progressRatio = useMemo(
    () =>
      getWorkbenchProgressRatio(
        status,
        currentStage,
        failedStage,
        activeWorkbenchStep
      ),
    [activeWorkbenchStep, currentStage, failedStage, status]
  );
  const selectedGalleryItem = useMemo(
    () =>
      galleryItems.find((item) => item.id === selectedGalleryItemId) || null,
    [galleryItems, selectedGalleryItemId]
  );

  const openAssetPreview = (asset: AutodrawAssetItem, subtitle?: string) => {
    setAssetPreview(createAssetPreviewState(asset, subtitle));
  };

  const openGalleryPreview = (item: ReferenceGalleryItem) => {
    setAssetPreview(createGalleryPreviewState(item));
  };

  const currentStageLabel =
    workbenchStages[Math.min(activeWorkbenchStep, workbenchStages.length - 1)]
      ?.label || t('dialog.autodraw.status.idle');

  const appendLogs = (nextLines: string[]) => {
    if (!nextLines.length) {
      return;
    }
    setLogs((current) => [...current, ...nextLines]);
  };

  const syncJobState = (nextJobId: string) => {
    setJobId(nextJobId);
    setJobIdInput(nextJobId);
    setJobIdCopied(false);
  };

  const resetAssemblyState = () => {
    assemblyRunIdRef.current += 1;
    setAssemblyProgress(initialAssemblyProgress);
  };

  const stopLogStreaming = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (pollingTimerRef.current) {
      window.clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (logPollingTimerRef.current) {
      window.clearTimeout(logPollingTimerRef.current);
      logPollingTimerRef.current = null;
    }
    setLogMode('idle');
  };

  const startLogPolling = (currentJobId: string) => {
    setLogMode('polling');
    const base = normalizeBaseUrl(backendUrl);

    const fetchLogs = async (offset: number) => {
      try {
        const response = await fetch(
          `${base}/api/jobs/${currentJobId}/logs?offset=${offset}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data: JobLogChunkResponse = await response.json();
        appendLogs(data.lines);
        if (!data.completed) {
          logPollingTimerRef.current = window.setTimeout(
            () => void fetchLogs(data.next_offset),
            1000
          );
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('dialog.autodraw.error.logFailed')
        );
      }
    };

    void fetchLogs(0);
  };

  const startLogStreaming = (currentJobId: string) => {
    const base = normalizeBaseUrl(backendUrl);
    try {
      const source = new EventSource(
        `${base}/api/jobs/${currentJobId}/logs/stream`
      );
      eventSourceRef.current = source;
      setLogMode('sse');

      source.addEventListener('log', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as {
          line: string;
        };
        appendLogs([data.line]);
      });

      source.addEventListener('end', () => {
        source.close();
        eventSourceRef.current = null;
        setLogMode('idle');
      });

      source.onerror = () => {
        source.close();
        eventSourceRef.current = null;
        startLogPolling(currentJobId);
      };
    } catch {
      startLogPolling(currentJobId);
    }
  };

  const applyTextScaleToLastImport = (scaleFactor: number) => {
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
      return;
    }
    if (Math.abs(scaleFactor - 1) < 0.001) {
      return;
    }
    if (!lastImportedElementIds.length) {
      return;
    }

    const idSet = new Set(lastImportedElementIds);
    const candidates = flattenBoardElements(board.children).filter((element) =>
      idSet.has(element.id)
    );
    const textCandidates = candidates.filter((element) => {
      const textStyle = (element as { textStyle?: unknown }).textStyle;
      return (
        textStyle &&
        typeof textStyle === 'object' &&
        Array.isArray((element as { points?: Point[] }).points) &&
        ((element as { points?: Point[] }).points?.length || 0) >= 2 &&
        Boolean((element as { text?: unknown }).text)
      );
    });

    if (!textCandidates.length) {
      return;
    }

    const scaleStyleMetric = (value: unknown) => {
      if (typeof value === 'number') {
        return roundScaleValue(value * scaleFactor);
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed)
          ? String(roundScaleValue(parsed * scaleFactor))
          : value;
      }
      return value;
    };

    PlaitHistoryBoard.withNewBatch(board, () => {
      for (const element of textCandidates) {
        const path = PlaitBoard.findPath(board, element as never);
        const rawTextStyle = ((
          element as { textStyle?: Record<string, unknown> }
        ).textStyle || {}) as Record<string, unknown>;
        const align = (rawTextStyle.align as string) || 'left';
        const fontSizeValue =
          typeof rawTextStyle.fontSize === 'number'
            ? rawTextStyle.fontSize
            : typeof rawTextStyle['font-size'] === 'string'
            ? Number.parseFloat(rawTextStyle['font-size'] as string)
            : undefined;
        const nextFontSize =
          typeof fontSizeValue === 'number' && Number.isFinite(fontSizeValue)
            ? roundScaleValue(fontSizeValue * scaleFactor)
            : undefined;

        const [start, end] = ((element as { points?: [Point, Point] })
          .points || [
          [0, 0],
          [0, 0],
        ]) as [Point, Point];
        const width = end[0] - start[0];
        const height = end[1] - start[1];
        const nextWidth = width * scaleFactor;
        const nextHeight = height * scaleFactor;
        let nextLeft = start[0];
        if (align === 'center') {
          nextLeft = start[0] - (nextWidth - width) / 2;
        } else if (align === 'right') {
          nextLeft = start[0] - (nextWidth - width);
        }
        const nextTop = start[1] - (nextHeight - height) * 0.4;
        const nextPoints: [Point, Point] = [
          [nextLeft, nextTop],
          [nextLeft + nextWidth, nextTop + nextHeight],
        ];

        const nextTextStyle = scaleTextMetricBag(
          rawTextStyle,
          scaleStyleMetric
        ) as Record<string, unknown>;
        const rawTextProperties = ((
          element as { textProperties?: Record<string, unknown> }
        ).textProperties || {}) as Record<string, unknown>;
        const nextTextProperties = scaleTextMetricBag(
          rawTextProperties,
          scaleStyleMetric
        ) as Record<string, unknown>;
        const nextText = scaleTextLeafMetrics(
          (element as { text?: unknown }).text,
          scaleStyleMetric
        );
        if (nextFontSize !== undefined) {
          nextTextStyle.fontSize = nextFontSize;
          nextTextStyle['font-size'] = String(nextFontSize);
          nextTextProperties.fontSize = nextFontSize;
          nextTextProperties['font-size'] = String(nextFontSize);
        }

        Transforms.setNode(
          board,
          {
            points: nextPoints,
            textStyle: nextTextStyle,
            textProperties: nextTextProperties,
            text: nextText,
          },
          path
        );
      }
    });

    setLastImportedTextScale((value) =>
      roundTextScaleFactor(value * scaleFactor)
    );
  };

  const getImportPlacement = (elements: PlaitElement[]) => {
    const boardContainerRect =
      PlaitBoard.getBoardContainer(board).getBoundingClientRect();
    const focusPoint = [
      boardContainerRect.width / 2,
      boardContainerRect.height / 2,
    ];
    const zoom = board.viewport.zoom;
    const origination = getViewportOrigination(board);
    const centerX = (origination?.[0] || 0) + focusPoint[0] / zoom;
    const centerY = (origination?.[1] || 0) + focusPoint[1] / zoom;
    const sourceRectangle = getElementRectangle(elements);
    const startPoint = [
      centerX - sourceRectangle.width / 2,
      centerY - sourceRectangle.height / 2,
    ] as Point;
    return {
      boardContainerRect,
      sourceRectangle,
      startPoint,
    };
  };

  const getPlacedImportRectangle = (elements: PlaitElement[]) => {
    const { sourceRectangle, startPoint } = getImportPlacement(elements);
    return {
      x: startPoint[0],
      y: startPoint[1],
      width: sourceRectangle.width,
      height: sourceRectangle.height,
    };
  };

  const insertElementsAtPoint = (
    elements: PlaitElement[],
    startPoint: Point
  ) => {
    const fragmentElements = JSON.parse(
      JSON.stringify(elements)
    ) as PlaitElement[];
    board.insertFragment(
      { elements: fragmentElements },
      startPoint,
      WritableClipboardOperationType.paste
    );
    clearSelectedElement(board);
    return {
      ids: collectElementIds(fragmentElements),
      insertedElements: fragmentElements,
    };
  };

  const playBoardBatchEnterAnimation = (
    batchElements: PlaitElement[],
    batchIndex: number
  ) => {
    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function' ||
      typeof PlaitElement.getElementG !== 'function'
    ) {
      return;
    }

    const resolveTargets = () =>
      batchElements.flatMap((element) => {
        try {
          const target = PlaitElement.getElementG(element);
          return target ? [target] : [];
        } catch {
          return [];
        }
      });

    const profile = getAssemblyBatchEnterProfile(batchElements);
    const initialTranslateY =
      batchIndex === 0 ? profile.translateY + 6 : profile.translateY;

    const startAnimation = (targets: SVGGElement[]) => {
      targets.forEach((target) => {
        target.style.transition = 'none';
        target.style.opacity = '0';
        target.style.transformBox = 'fill-box';
        target.style.transformOrigin = 'center';
        target.style.transform = `translateY(${initialTranslateY}px) scale(${profile.scale})`;
        target.style.willChange = 'transform, opacity';
      });

      window.requestAnimationFrame(() => {
        targets.forEach((target, index) => {
          const enterDelay = index * profile.stagger;
          window.setTimeout(() => {
            target.style.transition = [
              `transform ${profile.duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              `opacity ${Math.max(
                220,
                profile.duration - 30
              )}ms cubic-bezier(0.2, 0, 0, 1)`,
            ].join(', ');
            target.style.opacity = '1';
            target.style.transform = 'translateY(0) scale(1)';
          }, enterDelay);

          window.setTimeout(() => {
            target.style.willChange = '';
          }, enterDelay + profile.duration + 80);
        });
      });
    };

    const immediateTargets = resolveTargets();
    if (immediateTargets.length) {
      startAnimation(immediateTargets);
      return;
    }

    window.requestAnimationFrame(() => {
      const deferredTargets = resolveTargets();
      if (deferredTargets.length) {
        startAnimation(deferredTargets);
      }
    });
  };

  const insertElementsWithAssembly = async (elements: PlaitElement[]) => {
    if (!elements.length) {
      return {
        ids: [],
        insertedElements: [] as PlaitElement[],
        importRectangle: null,
      };
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { startPoint } = getImportPlacement(elements);
    const importRectangle = getPlacedImportRectangle(elements);
    focusViewportOnRectangle(board, importRectangle, {
      ...IMPORT_VIEWPORT_FOCUS_OPTIONS,
      duration: 0,
    });
    if (reducedMotion || elements.length <= 1) {
      const insertedBatch = insertElementsAtPoint(elements, startPoint);
      setAssemblyProgress({
        active: false,
        totalBatches: 1,
        completedBatches: 1,
        insertedCount: elements.length,
      });
      return {
        ids: insertedBatch.ids,
        insertedElements: insertedBatch.insertedElements,
        importRectangle,
      };
    }

    const batches = buildAssemblyBatches(elements);
    const runId = ++assemblyRunIdRef.current;
    const insertedIds: string[] = [];
    const insertedElements: PlaitElement[] = [];

    setAssemblyProgress({
      active: true,
      totalBatches: batches.length,
      completedBatches: 0,
      insertedCount: 0,
    });

    await wait(AUTODRAW_ASSEMBLY_LEAD_IN_DELAY);

    for (let index = 0; index < batches.length; index += 1) {
      if (runId !== assemblyRunIdRef.current) {
        return { ids: insertedIds, insertedElements, importRectangle };
      }
      const insertedBatch = insertElementsAtPoint(batches[index], startPoint);
      insertedIds.push(...insertedBatch.ids);
      insertedElements.push(...insertedBatch.insertedElements);
      playBoardBatchEnterAnimation(insertedBatch.insertedElements, index);
      setAssemblyProgress({
        active: index < batches.length - 1,
        totalBatches: batches.length,
        completedBatches: index + 1,
        insertedCount: insertedIds.length,
      });
      if (index < batches.length - 1) {
        await wait(
          getAssemblyBatchDelay(batches[index], index, batches.length)
        );
      }
    }

    if (runId !== assemblyRunIdRef.current) {
      return { ids: insertedIds, insertedElements, importRectangle };
    }

    return { ids: insertedIds, insertedElements, importRectangle };
  };

  const importBundle = async (
    currentJobId: string,
    bundleUrl: string,
    nextArtifacts?: AutodrawArtifact[]
  ) => {
    const response = await fetch(bundleUrl);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const blob = await response.blob();
    const file = new File([blob], `${currentJobId}.zip`, {
      type: 'application/zip',
    });
    await importBundleFile(file, { currentJobId, nextArtifacts });
  };

  const downloadBundleFile = async (
    currentJobId: string,
    bundleUrl: string
  ) => {
    const response = await fetch(bundleUrl);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    try {
      link.href = objectUrl;
      link.download = `${currentJobId}.zip`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    }
  };

  const resolveHistoryBundleUrl = async (entry: AutodrawHistoryEntry) => {
    const base = normalizeBaseUrl(backendUrl);
    if (entry.bundleUrl) {
      return /^https?:\/\//.test(entry.bundleUrl)
        ? entry.bundleUrl
        : `${base}${entry.bundleUrl}`;
    }
    if (!entry.jobId) {
      throw new Error(t('dialog.autodraw.error.noBundle'));
    }

    const response = await fetch(`${base}/api/jobs/${entry.jobId}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: JobResponse = await response.json();
    if (data.status !== 'succeeded' || !data.bundle_url) {
      throw new Error(t('dialog.autodraw.error.noBundle'));
    }

    rememberJobHistory({
      historyId: entry.id,
      jobId: data.job_id,
      jobType: data.request?.job_type || 'autodraw',
      status: data.status as AutodrawStatus,
      createdAt: data.created_at,
      nextArtifacts: data.artifacts ?? [],
      bundleUrl: data.bundle_url || null,
      currentStage: data.current_stage,
      failedStage: data.failed_stage,
      minStartStage: data.min_start_stage,
    });

    return `${base}${data.bundle_url}`;
  };

  const importBundleFile = async (
    file: File,
    options?: {
      currentJobId?: string;
      descriptionLine?: string;
      nextArtifacts?: AutodrawArtifact[];
    }
  ) => {
    setStatus('importing');
    if (options?.descriptionLine) {
      appendLogs([options.descriptionLine]);
    }
    const result = await importBundlePackage(file);
    if (result.importKind === 'svg' && result.fallbackReason) {
      appendLogs([
        `[scene-import] fallback to svg-import: ${result.fallbackReason}`,
      ]);
    }
    const normalizedElements = result.elements;
    setPreviewElements(normalizedElements);
    setSummary(result.summary);
    const insertResult = await insertElementsWithAssembly(normalizedElements);
    const insertedElementIds = insertResult.ids;
    const viewportFocusTargets = insertResult.insertedElements.length
      ? insertResult.insertedElements
      : normalizedElements;
    if (insertResult.importRectangle) {
      focusViewportOnRectangle(board, insertResult.importRectangle, {
        ...IMPORT_VIEWPORT_FOCUS_OPTIONS,
        duration: 120,
      });
    } else {
      focusViewportOnElements(board, viewportFocusTargets, {
        ...IMPORT_VIEWPORT_FOCUS_OPTIONS,
        duration: 120,
      });
    }
    clearSelectedElement(board);
    setLastImportedElementIds(
      insertedElementIds.length
        ? insertedElementIds
        : collectElementIds(normalizedElements)
    );
    setLastImportedTextScale(1);
    setCurrentStage(5);
    setFailedStage(null);
    setStatus('succeeded');

    if (options?.currentJobId) {
      syncJobState(options.currentJobId);
      rememberJobHistory({
        jobId: options.currentJobId,
        status: 'succeeded',
        summary: result.summary,
        nextArtifacts: options.nextArtifacts || artifacts,
      });
    } else {
      rememberBundleHistory({
        bundleName: file.name,
        summary: result.summary,
      });
    }
  };

  const handleJobError = (error: unknown) => {
    stopLogStreaming();
    resetAssemblyState();
    setStatus('failed');
    setErrorMessage(
      error instanceof Error
        ? error.message
        : t('dialog.autodraw.error.submitFailed')
    );
  };

  const pollJob = async (currentJobId: string) => {
    const base = normalizeBaseUrl(backendUrl);
    const response = await fetch(`${base}/api/jobs/${currentJobId}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: JobResponse = await response.json();
    setStatus(data.status as AutodrawStatus);
    setCurrentStage(data.current_stage ?? null);
    setFailedStage(data.failed_stage ?? null);
    setArtifacts(data.artifacts ?? []);
    rememberJobHistory({
      historyId: activeHistoryEntryIdRef.current || undefined,
      jobId: data.job_id,
      status: data.status as AutodrawStatus,
      createdAt: data.created_at,
      nextArtifacts: data.artifacts ?? [],
      bundleUrl: data.bundle_url || null,
      currentStage: data.current_stage,
      failedStage: data.failed_stage,
      minStartStage: data.min_start_stage,
    });

    if (
      data.status === 'queued' ||
      data.status === 'running' ||
      data.status === 'cancelling'
    ) {
      pollingTimerRef.current = window.setTimeout(() => {
        void pollJob(currentJobId).catch(handleJobError);
      }, 1000);
      return;
    }

    stopLogStreaming();

    if (data.status === 'cancelled') {
      setErrorMessage('');
      return;
    }

    if (data.status === 'failed') {
      setErrorMessage(
        data.error_message || t('dialog.autodraw.error.jobFailed')
      );
      return;
    }

    if (!data.bundle_url) {
      throw new Error(t('dialog.autodraw.error.noBundle'));
    }

    await importBundle(
      currentJobId,
      `${base}${data.bundle_url}`,
      data.artifacts
    );
    setStatus('succeeded');
    setFailedStage(null);
  };

  const loadJobLogs = async (currentJobId: string) => {
    const base = normalizeBaseUrl(backendUrl);
    const response = await fetch(
      `${base}/api/jobs/${currentJobId}/logs?offset=0`
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: JobLogChunkResponse = await response.json();
    setLogs(data.lines);
  };

  const resetWorkbench = () => {
    setErrorMessage('');
    setLogs([]);
    setArtifacts([]);
    setRealtimeArtifacts([]);
    setProcessTrace(null);
    setProcessTraceOpen(false);
    setProcessTraceStatus('idle');
    setProcessTraceError('');
    setSummary(emptySummary);
    setPreviewElements([]);
    setLastImportedElementIds([]);
    setLastImportedTextScale(1);
    setCurrentStage(null);
    setFailedStage(null);
    setJobIdCopied(false);
    setAssetPreview(null);
    resetAssemblyState();
  };

  const releaseForegroundJob = () => {
    stopLogStreaming();
    resetWorkbench();
    setStatus('idle');
    setJobId('');
    setCurrentStage(null);
    setFailedStage(null);
  };

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !jobId ||
      !isJobBusy ||
      activeWorkbenchStep < 0
    ) {
      return;
    }

    let cancelled = false;
    const knownArtifactPaths = new Set(
      mergedArtifacts.map((artifact) => artifact.path)
    );
    const candidates = AUTODRAW_REALTIME_PROBE_DEFINITIONS.filter(
      (definition) =>
        definition.minStep <= Math.min(activeWorkbenchStep, 3) &&
        !knownArtifactPaths.has(definition.path)
    );

    if (!candidates.length) {
      return;
    }

    const probeArtifacts = async () => {
      const base = normalizeBaseUrl(backendUrl);
      const nextArtifacts = await Promise.all(
        candidates.map(async (definition) => {
          const probeUrl = `${base}/api/jobs/${jobId}/artifacts/${
            definition.path
          }?t=${Date.now()}`;
          try {
            const response = await fetch(probeUrl, {
              cache: 'no-store',
            });
            if (!response.ok) {
              return null;
            }
            return createRealtimeProbeArtifact(jobId, definition);
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const discoveredArtifacts = nextArtifacts.filter(
        (artifact): artifact is AutodrawArtifact => Boolean(artifact)
      );
      if (!discoveredArtifacts.length) {
        return;
      }
      setRealtimeArtifacts((current) =>
        mergeAutodrawArtifacts(discoveredArtifacts, current)
      );
    };

    void probeArtifacts();

    const timer = window.setTimeout(() => {
      void probeArtifacts();
    }, AUTODRAW_REALTIME_POLL_INTERVAL);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeWorkbenchStep, backendUrl, isJobBusy, jobId, mergedArtifacts]);

  const loadJobById = async (currentJobId: string) => {
    const nextJobId = currentJobId.trim();
    if (!nextJobId) {
      return;
    }

    stopLogStreaming();
    resetWorkbench();
    stopWatchingJob(nextJobId);

    try {
      const base = normalizeBaseUrl(backendUrl);
      const response = await fetch(`${base}/api/jobs/${nextJobId}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data: JobResponse = await response.json();
      syncJobState(data.job_id);
      setStatus(data.status as AutodrawStatus);
      setCurrentStage(data.current_stage ?? null);
      setFailedStage(data.failed_stage ?? null);
      setArtifacts(data.artifacts ?? []);
      rememberJobHistory({
        jobId: data.job_id,
        jobType: data.request?.job_type || 'autodraw',
        status: data.status as AutodrawStatus,
        createdAt: data.created_at,
        nextArtifacts: data.artifacts ?? [],
        bundleUrl: data.bundle_url || null,
        currentStage: data.current_stage,
        failedStage: data.failed_stage,
        minStartStage: data.min_start_stage,
      });
      await loadJobLogs(data.job_id);

      if (
        data.status === 'queued' ||
        data.status === 'running' ||
        data.status === 'cancelling'
      ) {
        startLogStreaming(data.job_id);
        await pollJob(data.job_id);
        return;
      }

      if (data.status === 'cancelled') {
        setErrorMessage('');
        return;
      }

      if (data.status === 'succeeded') {
        if (!data.bundle_url) {
          throw new Error(t('dialog.autodraw.error.noBundle'));
        }
        await importBundle(
          data.job_id,
          `${base}${data.bundle_url}`,
          data.artifacts
        );
      }
    } catch (error) {
      handleJobError(error);
    }
  };

  const loadExistingJob = async () => {
    await loadJobById(jobIdInput);
  };

  const loadProcessTrace = async () => {
    if (!jobId) {
      setProcessTraceError(t('dialog.autodraw.processTrace.noJob'));
      setProcessTraceStatus('error');
      return;
    }

    setProcessTraceStatus('loading');
    setProcessTraceError('');

    try {
      const base = normalizeBaseUrl(backendUrl);
      const response = await fetch(
        `${base}/api/jobs/${jobId}/artifacts/process_trace.json?t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error(t('dialog.autodraw.processTrace.unavailable'));
      }
      const data = (await response.json()) as AutodrawProcessTrace;
      setProcessTrace(data);
      setProcessTraceStatus('ready');
    } catch (error) {
      setProcessTraceStatus('error');
      setProcessTraceError(
        error instanceof Error
          ? error.message
          : t('dialog.autodraw.processTrace.unavailable')
      );
    }
  };

  const handleToggleProcessTrace = async () => {
    if (processTraceOpen) {
      setProcessTraceOpen(false);
      return;
    }
    setProcessTraceOpen(true);
    if (!processTrace || processTraceStatus === 'error') {
      await loadProcessTrace();
    }
  };

  const handleGenerateClarification = async () => {
    if (isSourceInputMode) {
      return;
    }
    if (!methodText.trim()) {
      setErrorMessage(t('dialog.autodraw.error.noMethodText'));
      return;
    }

    setClarificationStatus('loading');
    setClarificationError('');
    setClarificationQuestions([]);
    setClarificationAnswers({});
    setClarificationSummary('');
    setErrorMessage('');

    try {
      const base = normalizeBaseUrl(backendUrl);
      const response = await fetch(`${base}/api/jobs/clarify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method_text: methodText,
          provider,
          api_key: apiKey || null,
          base_url: baseUrl || null,
          ca_api_key: caApiKey || null,
          ca_base_url: caBaseUrl || null,
          ca_model: caModel || null,
          ca_language: caLanguage,
          image_model: imageModel || null,
          svg_model: svgModel || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: ClarifyJobResponse = await response.json();
      const nextAnswers: Record<string, string> = {};
      data.questions.forEach((question) => {
        const recommended =
          question.options.find(
            (option) => option.id === question.recommended_option_id
          ) || question.options[0];
        if (recommended) {
          nextAnswers[question.id] = recommended.id;
        }
      });
      setClarificationQuestions(data.questions);
      setClarificationAnswers(nextAnswers);
      setClarificationSummary(data.context_summary || '');
      setClarificationStatus('ready');
    } catch (error) {
      setClarificationStatus('error');
      setClarificationError(
        error instanceof Error ? error.message : t('dialog.autodraw.ca.error')
      );
    }
  };

  const handleSelectClarificationOption = (
    questionId: string,
    optionId: string
  ) => {
    setClarificationStatus((current) =>
      current === 'skipped' ? 'ready' : current
    );
    setClarificationAnswers((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  };

  const handleSkipClarification = () => {
    setClarificationStatus('skipped');
    setClarificationError('');
    setClarificationAnswers({});
  };

  const handleClearClarification = () => {
    setClarificationStatus('idle');
    setClarificationQuestions([]);
    setClarificationAnswers({});
    setClarificationSummary('');
    setClarificationError('');
  };

  const handleSubmit = async () => {
    if (!isSourceInputMode && !methodText.trim()) {
      setErrorMessage(t('dialog.autodraw.error.noMethodText'));
      return;
    }
    if (isSourceInputMode && !sourceFigure) {
      setErrorMessage(t('dialog.autodraw.error.noSourceFigure'));
      return;
    }

    stopLogStreaming();
    resetWorkbench();
    setIsWorkbenchDocked(false);
    setStatus('submitting');
    const sourceStartStage = sourceRunMode === 'direct-svg' ? 4 : 2;
    setCurrentStage(isSourceInputMode ? sourceStartStage : 1);

    try {
      const base = normalizeBaseUrl(backendUrl);
      let referenceImagePath: string | undefined;
      let sourceFigurePath: string | undefined;

      if (isSourceInputMode && sourceFigure) {
        const formData = new FormData();
        formData.append('file', sourceFigure);
        const uploadResponse = await fetch(
          `${base}/api/uploads/source-figure`,
          {
            method: 'POST',
            body: formData,
          }
        );
        if (!uploadResponse.ok) {
          throw new Error(await uploadResponse.text());
        }
        const uploadData: UploadReferenceImageResponse =
          await uploadResponse.json();
        sourceFigurePath = uploadData.stored_path;
      } else if (referenceImage) {
        const formData = new FormData();
        formData.append('file', referenceImage);
        const uploadResponse = await fetch(
          `${base}/api/uploads/reference-image`,
          {
            method: 'POST',
            body: formData,
          }
        );
        if (!uploadResponse.ok) {
          throw new Error(await uploadResponse.text());
        }
        const uploadData: UploadReferenceImageResponse =
          await uploadResponse.json();
        referenceImagePath = uploadData.stored_path;
      }

      const response = await fetch(`${base}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method_text: isSourceInputMode ? null : methodText,
          provider,
          api_key: apiKey || null,
          base_url: baseUrl || null,
          image_model: imageModel || null,
          image_size: imageSize,
          figure_language: figureLanguage,
          sam_prompt: normalizedSamPrompt,
          remove_background: removeBackground,
          svg_model: svgModel || null,
          ca_context: clarificationContext,
          sam_backend: 'api',
          reference_image_path: isSourceInputMode
            ? null
            : referenceImagePath || null,
          source_figure_path: isSourceInputMode
            ? sourceFigurePath || null
            : null,
          source_processing_mode:
            isSourceInputMode && sourceRunMode === 'direct-svg'
              ? 'direct_svg'
              : 'segmented',
          start_stage: isSourceInputMode ? sourceStartStage : 1,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: CreateJobResponse = await response.json();
      syncJobState(data.job_id);
      setStatus(data.status as AutodrawStatus);
      rememberJobHistory({
        jobId: data.job_id,
        status: data.status as AutodrawStatus,
      });
      startLogStreaming(data.job_id);
      await pollJob(data.job_id);
    } catch (error) {
      handleJobError(error);
    }
  };

  const handleResume = async () => {
    if (!jobId) {
      return;
    }

    appendLogs([
      '',
      `[resume] source_job_id=${jobId}`,
      '[resume] resume_from_stage=auto',
    ]);

    try {
      const base = normalizeBaseUrl(backendUrl);
      stopLogStreaming();
      resetAssemblyState();
      const response = await fetch(`${base}/api/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_from_stage: 'auto',
          image_model: imageModel || null,
          svg_model: svgModel || null,
          remove_background: removeBackground,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data: CreateJobResponse = await response.json();
      syncJobState(data.job_id);
      setFailedStage(null);
      setCurrentStage(null);
      setStatus(data.status as AutodrawStatus);
      setIsWorkbenchDocked(false);
      rememberJobHistory({
        jobId: data.job_id,
        status: data.status as AutodrawStatus,
      });
      startLogStreaming(data.job_id);
      await pollJob(data.job_id);
    } catch (error) {
      handleJobError(error);
    }
  };

  const handleCancelJob = async () => {
    if (
      !jobId ||
      (status !== 'queued' && status !== 'running' && status !== 'cancelling')
    ) {
      return;
    }

    try {
      const base = normalizeBaseUrl(backendUrl);
      const response = await fetch(`${base}/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: JobResponse = await response.json();
      rememberJobHistory({
        historyId: activeHistoryEntryIdRef.current || undefined,
        jobId: data.job_id,
        jobType: data.request?.job_type || 'autodraw',
        status: data.status as AutodrawStatus,
        createdAt: data.created_at,
        nextArtifacts: data.artifacts ?? [],
        bundleUrl: data.bundle_url || null,
        currentStage: data.current_stage,
        failedStage: data.failed_stage,
        minStartStage: data.min_start_stage,
      });

      if (data.status === 'cancelling') {
        setErrorMessage('');
        releaseForegroundJob();
        watchJobUntilSettled(data.job_id);
        return;
      }

      if (data.status === 'cancelled') {
        setErrorMessage('');
        releaseForegroundJob();
        stopWatchingJob(data.job_id);
        return;
      }

      setStatus(data.status as AutodrawStatus);
      setCurrentStage(data.current_stage ?? null);
      setFailedStage(data.failed_stage ?? null);
      setArtifacts(data.artifacts ?? []);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('dialog.autodraw.error.cancelFailed')
      );
    }
  };

  const handleChooseReferenceGallery = async () => {
    try {
      const handle = await requestAutodrawReferenceDirectory();
      await saveStoredAutodrawReferenceDirectory(handle);
      setGalleryDirectoryName(handle.name || '');
      setGalleryMessage('');
      galleryDirectoryHandleRef.current = handle;
      await loadReferenceGalleryFromHandle(handle, {
        applySelection: false,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setGalleryState('error');
      setGalleryMessage(
        error instanceof Error
          ? error.message
          : t('dialog.autodraw.galleryLoadFailed')
      );
    }
  };

  const handleRefreshReferenceGallery = async () => {
    const handle = galleryDirectoryHandleRef.current;
    if (!handle) {
      return;
    }
    await loadReferenceGalleryFromHandle(handle, {
      applySelection: referenceSource === 'gallery',
      preferredItemId: selectedGalleryItemId,
    });
  };

  const handleClearReferenceGallery = async () => {
    await clearStoredAutodrawReferenceDirectory().catch(() => undefined);
    galleryDirectoryHandleRef.current = null;
    disposeGalleryPreviewUrls();
    setGalleryItems([]);
    setGalleryDirectoryName('');
    setSelectedGalleryItemId('');
    setGalleryState(
      isAutodrawReferenceGallerySupported() ? 'idle' : 'unsupported'
    );
    setGalleryMessage('');
    if (referenceSource === 'gallery') {
      setReferenceImage(null);
      setReferenceSource(null);
    }
  };

  const handleReferenceGalleryPick = (item: ReferenceGalleryItem) => {
    setSelectedGalleryItemId(item.id);
    setReferenceImage(item.file);
    setReferenceSource('gallery');
    setGalleryMessage('');
  };

  const handleInputModeChange = (nextMode: AutodrawInputMode) => {
    setInputMode(nextMode);
    setErrorMessage('');
  };

  const handleCaLanguageChange = (nextLanguage: AutodrawCaLanguage) => {
    setCaLanguage(nextLanguage);
    setClarificationStatus('idle');
    setClarificationQuestions([]);
    setClarificationAnswers({});
    setClarificationSummary('');
    setClarificationError('');
  };

  const handleReferenceImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setReferenceSource(file ? 'upload' : null);
    setReferenceImage(file);
  };

  const handleSourceFigureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSourceFigure(file);
  };

  const handleBundleFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setBundleFileName(file?.name || '');
    event.target.value = '';
    if (!file) {
      return;
    }

    stopLogStreaming();
    resetWorkbench();
    setJobId('');
    setIsWorkbenchDocked(false);

    try {
      await importBundleFile(file, {
        descriptionLine: `[bundle] local zip import: ${file.name}`,
      });
    } catch (error) {
      handleJobError(error);
    }
  };

  const copyTextToClipboard = async (value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('dialog.autodraw.jobId')
      );
    }
  };

  const handleCopyJobId = async () => {
    if (!jobId) {
      return;
    }
    setJobIdCopied(true);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    try {
      await copyTextToClipboard(jobId);
    } catch {
      setJobIdCopied(false);
      return;
    }
    copyTimerRef.current = window.setTimeout(() => {
      setJobIdCopied(false);
    }, 1600);
  };

  const handleShowCurrentJobFlow = async () => {
    if (!jobId) {
      return;
    }
    setIsWorkbenchDocked(false);
    await loadJobById(jobId);
  };

  const handleHistoryLoad = async (entry: AutodrawHistoryEntry) => {
    if (!entry.jobId) {
      return;
    }
    activeHistoryEntryIdRef.current = entry.id;
    setIsWorkbenchDocked(false);
    await loadJobById(entry.jobId);
  };

  const handleHistoryCopy = async (entry: AutodrawHistoryEntry) => {
    if (!entry.jobId) {
      return;
    }
    await copyTextToClipboard(entry.jobId);
  };

  const handleBundleDownload = async (entry: AutodrawHistoryEntry | null) => {
    if (!entry?.jobId || entry.status !== 'succeeded') {
      return;
    }

    try {
      const bundleUrl = await resolveHistoryBundleUrl(entry);
      await downloadBundleFile(entry.jobId, bundleUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('dialog.autodraw.error.noBundle')
      );
    }
  };

  const replayJobFromStage = async (
    entry: AutodrawHistoryEntry | null,
    startStage: number
  ) => {
    if (
      !entry?.jobId ||
      entry.status === 'queued' ||
      entry.status === 'running' ||
      entry.status === 'cancelling'
    ) {
      return;
    }

    try {
      const base = normalizeBaseUrl(backendUrl);
      stopLogStreaming();
      resetWorkbench();
      setIsWorkbenchDocked(false);
      setStatus('submitting');
      setCurrentStage(startStage);
      appendLogs([
        '',
        `[replay] source_job_id=${entry.jobId}`,
        `[replay] start_stage=${startStage}`,
      ]);

      const response = await fetch(`${base}/api/jobs/${entry.jobId}/replay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_stage: startStage,
          image_model: imageModel || null,
          svg_model: svgModel || null,
          remove_background: removeBackground,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: CreateJobResponse = await response.json();
      syncJobState(data.job_id);
      setFailedStage(null);
      setStatus(data.status as AutodrawStatus);
      rememberJobHistory({
        jobId: data.job_id,
        status: data.status as AutodrawStatus,
      });
      startLogStreaming(data.job_id);
      await pollJob(data.job_id);
    } catch (error) {
      handleJobError(error);
    }
  };

  const handleWorkspaceRebuild = async () => {
    if (!currentJobHistoryEntry) {
      return;
    }
    await replayJobFromStage(currentJobHistoryEntry, currentJobMinReplayStage);
  };

  const handleWorkspaceReplay = async () => {
    if (!currentJobHistoryEntry) {
      return;
    }
    await replayJobFromStage(currentJobHistoryEntry, workspaceReplayStage);
  };

  const handleHistoryPreview = (entry: AutodrawHistoryEntry) => {
    const previewState = createHistoryPreviewState(entry);
    if (!previewState) {
      return;
    }
    setAssetPreview(previewState);
  };

  const handleAssetPreview = (asset: AutodrawAssetItem) => {
    openAssetPreview(asset);
  };

  const handleDockWorkbench = () => {
    setIsWorkbenchDocked(true);
  };

  const handleClose = () => {
    stopLogStreaming();
    resetAssemblyState();
    setIsWorkbenchDocked(false);
    setAppState({
      ...appState,
      openDialogType: null,
    });
  };

  const methodCharacterCount = useMemo(
    () => Array.from(methodText).length,
    [methodText]
  );
  const isSourceInputMode = inputMode === 'source';
  const isDirectSvgSourceMode =
    isSourceInputMode && sourceRunMode === 'direct-svg';
  const normalizedSamPrompt = useMemo(
    () => normalizeSamPromptValue(samPrompt),
    [samPrompt]
  );
  const clarificationContext =
    useMemo<AutodrawClarificationContext | null>(() => {
      if (
        isSourceInputMode ||
        clarificationStatus !== 'ready' ||
        clarificationQuestions.length === 0
      ) {
        return null;
      }

      const answers: AutodrawClarificationAnswer[] = clarificationQuestions
        .map((question) => {
          const optionId = clarificationAnswers[question.id];
          const option = question.options.find((item) => item.id === optionId);
          if (!option) {
            return null;
          }
          return {
            question_id: question.id,
            option_id: option.id,
            label: option.label,
            description: option.description || null,
          };
        })
        .filter(Boolean) as AutodrawClarificationAnswer[];

      if (!answers.length) {
        return null;
      }

      return {
        questions: clarificationQuestions,
        answers,
        context_summary: clarificationSummary || null,
      };
    }, [
      clarificationAnswers,
      clarificationQuestions,
      clarificationStatus,
      clarificationSummary,
      isSourceInputMode,
    ]);

  const stagePreviewAssets = useMemo(() => {
    const previewMap = new Map<number, AutodrawAssetItem>();
    assetItems
      .filter((asset) => asset.previewable && asset.category === 'visual')
      .forEach((asset) => {
        const stageIndex = Math.min(
          asset.stageIndex,
          workbenchStages.length - 1
        );
        if (!previewMap.has(stageIndex)) {
          previewMap.set(stageIndex, asset);
        }
      });
    return previewMap;
  }, [assetItems, workbenchStages.length]);

  const backendLabel = useMemo(() => {
    const normalized = normalizeBaseUrl(backendUrl).trim();
    if (!normalized) {
      return 'backend';
    }
    try {
      return new URL(normalized).host;
    } catch {
      return normalized.replace(/^https?:\/\//, '');
    }
  }, [backendUrl]);

  const currentJobMinReplayStage = useMemo(() => {
    if (!currentJobHistoryEntry) {
      return 1;
    }
    return getAutodrawHistoryMinReplayStage(currentJobHistoryEntry);
  }, [currentJobHistoryEntry]);

  const canOperateCurrentJob = Boolean(
    currentJobHistoryEntry &&
      (currentJobHistoryEntry.status === 'succeeded' ||
        currentJobHistoryEntry.status === 'failed' ||
        currentJobHistoryEntry.status === 'cancelled')
  );

  const canDownloadCurrentBundle = Boolean(
    currentJobHistoryEntry &&
      currentJobHistoryEntry.status === 'succeeded' &&
      currentJobHistoryEntry.jobId
  );

  useEffect(() => {
    if (!currentJobHistoryEntry) {
      setWorkspaceReplayStage(1);
      return;
    }

    setWorkspaceReplayStage((current) => {
      const preferredStage = getAutodrawHistoryDefaultReplayStage(
        currentJobHistoryEntry
      );
      if (current < currentJobMinReplayStage || current > 4) {
        return preferredStage;
      }
      return current;
    });
  }, [currentJobHistoryEntry, currentJobMinReplayStage]);

  const replayableWorkspaceStages = useMemo(
    () =>
      workbenchStages
        .slice(currentJobMinReplayStage - 1, 4)
        .map((stage, index) => ({
          ...stage,
          value: currentJobMinReplayStage + index,
        })),
    [currentJobMinReplayStage, workbenchStages]
  );

  const handleMethodTextKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const handleMethodTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMethodText(event.target.value);
    if (clarificationStatus !== 'idle') {
      setClarificationStatus('idle');
      setClarificationQuestions([]);
      setClarificationAnswers({});
      setClarificationSummary('');
      setClarificationError('');
    }
  };

  const renderStageThumb = (index: number) => {
    const asset = stagePreviewAssets.get(index);

    if (index === 0) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--text">
          <p>{methodText.trim() || t('dialog.autodraw.placeholder')}</p>
        </div>
      );
    }

    if (index === 4) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--board">
          <div className="autodraw-stage-thumb__board-grid" />
          <div className="autodraw-stage-thumb__board-marks">
            {Array.from({ length: 3 }, (_, markIndex) => (
              <span key={`board-mark-${markIndex}`} />
            ))}
          </div>
          <div className="autodraw-stage-thumb__board-note">{`${
            assemblyProgress.completedBatches || 0
          } / ${assemblyProgress.totalBatches || batchPreviewCount}`}</div>
        </div>
      );
    }

    if (asset?.previewable) {
      return (
        <button
          type="button"
          className="autodraw-stage-thumb autodraw-stage-thumb--image autodraw-stage-thumb--preview"
          onClick={() => openAssetPreview(asset)}
          aria-label={`${t('dialog.autodraw.openPreview')}: ${asset.name}`}
        >
          <img
            src={asset.url}
            alt={asset.name}
            loading="lazy"
            className="autodraw-stage-thumb__image"
          />
        </button>
      );
    }

    if (index === 1) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--bitmap" />
      );
    }

    if (index === 2) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--mask">
          <svg viewBox="0 0 120 90" aria-hidden="true">
            <defs>
              <pattern
                id="autodraw-stage-mask"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="4"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <path
              d="M15 20 Q 30 8, 48 16 T 72 28 L 66 42 Q 50 50, 32 40 Z"
              fill="url(#autodraw-stage-mask)"
              stroke="currentColor"
              strokeDasharray="2 2"
            />
            <path
              d="M60 48 Q 78 42, 92 52 T 105 72 L 88 78 Q 70 72, 58 62 Z"
              fill="rgba(244, 114, 182, 0.24)"
              stroke="currentColor"
              strokeDasharray="2 2"
            />
            <circle
              cx="30"
              cy="68"
              r="10"
              fill="rgba(59, 130, 246, 0.22)"
              stroke="currentColor"
              strokeDasharray="2 2"
            />
          </svg>
        </div>
      );
    }

    return (
      <div className="autodraw-stage-thumb autodraw-stage-thumb--vector">
        <svg viewBox="0 0 120 90" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          >
            <path d="M20 25 L40 20 L55 35" strokeDasharray="2 3" />
            <path d="M60 50 Q 75 40, 90 55" strokeDasharray="2 3" />
            <circle cx="35" cy="65" r="8" strokeDasharray="2 3" />
          </g>
        </svg>
      </div>
    );
  };

  const getStageMeta = (index: number) => {
    const asset = stagePreviewAssets.get(index);
    if (asset) {
      return asset.name;
    }
    if (index === 0) {
      return 'method text';
    }
    if (index === 1) {
      return 'figure bitmap';
    }
    if (index === 2) {
      const iconCount = assetShelfItems.filter(
        (item) => item.stageIndex === 2 && !item.isPlaceholder
      ).length;
      return `${iconCount || assetShelfItems.length} assets`;
    }
    if (index === 3) {
      return 'final.svg';
    }
    if (assemblyProgress.totalBatches > 0) {
      return `${assemblyProgress.completedBatches}/${assemblyProgress.totalBatches} batches`;
    }
    return 'canvas assembly';
  };

  const getStageChipLabel = (index: number) => {
    const isFailed =
      (status === 'failed' || status === 'cancelled') &&
      index === activeWorkbenchStep;
    const isComplete = index < activeWorkbenchStep || status === 'succeeded';
    const isActive =
      !isFailed &&
      !isComplete &&
      index === activeWorkbenchStep &&
      status !== 'idle';

    if (isFailed) {
      return status === 'cancelled'
        ? t('dialog.autodraw.status.cancelled')
        : t('dialog.autodraw.status.failed');
    }
    if (isComplete) {
      return t('dialog.autodraw.status.succeeded');
    }
    if (isActive) {
      return statusLabel;
    }
    return t('dialog.autodraw.status.idle');
  };

  return (
    <div
      ref={rootRef}
      className={classNames('autodraw-dialog', {
        'autodraw-dialog--docked': isWorkbenchDocked,
      })}
    >
      {isWorkbenchDocked ? (
        <section className="autodraw-dock">
          <div className="autodraw-dock__head">
            <div className="autodraw-dock__copy">
              <span
                className={`autodraw-badge ${getAutodrawStatusBadgeClass(
                  status
                )}`}
              >
                {statusLabel}
              </span>
              <h3 className="autodraw-dock__title">
                {t('dialog.autodraw.importMonitor')}
              </h3>
              <p className="autodraw-dock__description">
                {t('dialog.autodraw.importWatchingHint')}
              </p>
            </div>
            <div className="autodraw-dock__actions">
              <button
                type="button"
                className="autodraw-button autodraw-button--secondary autodraw-button--compact"
                onClick={() => setIsWorkbenchDocked(false)}
              >
                {t('dialog.autodraw.returnWorkbench')}
              </button>
              <button
                type="button"
                className="autodraw-button autodraw-button--ghost autodraw-button--compact"
                onClick={handleClose}
              >
                {t('dialog.close')}
              </button>
            </div>
          </div>

          <div className="autodraw-progress-shell autodraw-progress-shell--compact">
            <div className="autodraw-progress-shell__meta">
              <span>{currentStageLabel}</span>
              <span>{`${Math.round(progressRatio * 100)}%`}</span>
            </div>
            <div className="autodraw-progress-bar">
              <span
                className={classNames('autodraw-progress-bar__fill', {
                  'autodraw-progress-bar__fill--running': isJobBusy,
                })}
                style={{ width: `${Math.max(progressRatio, 0.04) * 100}%` }}
              />
            </div>
          </div>

          <div className="autodraw-dock__metrics">
            {summaryItems.map((item) => (
              <div key={item.label} className="autodraw-dialog__summary-card">
                <span className="autodraw-dialog__summary-value">
                  {item.value}
                </span>
                <span className="autodraw-dialog__summary-label">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="autodraw-workbench">
          <div className="autodraw-paper" />

          <header className="autodraw-topbar">
            <div className="autodraw-topbar__left">
              <button
                type="button"
                className="autodraw-back-btn"
                onClick={handleClose}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M9 3 L5 7 L9 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                返回画板
              </button>
              <div className="autodraw-crumb">
                <span>工具</span>
                <span className="autodraw-crumb__sep">/</span>
                <span className="autodraw-crumb__current">
                  AutoDraw · 实验室工作台
                </span>
              </div>
            </div>

            <div className="autodraw-topbar__right">
              <span
                className={classNames(
                  'autodraw-chip',
                  `autodraw-chip--${getAutodrawStatusBadgeClass(status).replace(
                    'autodraw-badge--',
                    ''
                  )}`
                )}
              >
                <span className="autodraw-chip__pulse" />
                {statusLabel}
              </span>
              <span className="autodraw-anno">已连接 · {backendLabel}</span>
              <button
                type="button"
                className="autodraw-icon-btn"
                onClick={() => setShowAdvanced((value) => !value)}
                aria-label={t('dialog.autodraw.advancedSettings')}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <circle
                    cx="7"
                    cy="7"
                    r="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path
                    d="M7 2 L7 3 M7 11 L7 12 M2 7 L3 7 M11 7 L12 7 M3.5 3.5 L4.2 4.2 M9.8 9.8 L10.5 10.5 M3.5 10.5 L4.2 9.8 M9.8 4.2 L10.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="autodraw-icon-btn"
                onClick={handleDockWorkbench}
                aria-label={t('dialog.autodraw.hideWorkbench')}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <rect
                    x="2.25"
                    y="3"
                    width="9.5"
                    height="8"
                    rx="1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M4.5 5.5 H9.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </header>

          <div className="autodraw-workspace-grid">
            <aside className="autodraw-col autodraw-col--left">
              <div className="autodraw-page-kicker">AUTODRAW · 01</div>
              <h1 className="autodraw-page-title">
                实验室<span>工作台</span>
              </h1>
              <p className="autodraw-page-desc">
                {t('dialog.autodraw.description')}
              </p>

              <div className="autodraw-sec-head">
                <div className="autodraw-sec-title">
                  {t('dialog.autodraw.basicInfo')}
                  <span>· input</span>
                </div>
                {!isSourceInputMode && (
                  <span className="autodraw-anno autodraw-anno--small">
                    {`${methodCharacterCount} chars`}
                  </span>
                )}
              </div>

              <div className="autodraw-dialog__field">
                <span className="autodraw-dialog__label">
                  {t('dialog.autodraw.inputMode')}
                </span>
                <div className="autodraw-mode-switch">
                  <button
                    type="button"
                    onClick={() => handleInputModeChange('generate')}
                    disabled={isJobBusy}
                    aria-pressed={inputMode === 'generate'}
                    className={classNames('autodraw-mode-switch__button', {
                      'autodraw-mode-switch__button--active':
                        inputMode === 'generate',
                    })}
                  >
                    {t('dialog.autodraw.modeGenerate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputModeChange('source')}
                    disabled={isJobBusy}
                    aria-pressed={inputMode === 'source'}
                    className={classNames('autodraw-mode-switch__button', {
                      'autodraw-mode-switch__button--active':
                        inputMode === 'source',
                    })}
                  >
                    {t('dialog.autodraw.modeSourceFigure')}
                  </button>
                </div>
                <p className="autodraw-dialog__hint">
                  {isSourceInputMode
                    ? t('dialog.autodraw.modeSourceHint')
                    : t('dialog.autodraw.modeGenerateHint')}
                </p>
              </div>

              {isSourceInputMode ? (
                <div className="autodraw-inline-card autodraw-inline-card--stack">
                  <div>
                    <div className="autodraw-dialog__label">
                      {t('dialog.autodraw.sourceFigure')}
                    </div>
                    <p className="autodraw-dialog__hint">
                      {t('dialog.autodraw.sourceFigureHint')}
                    </p>
                  </div>
                  <div className="autodraw-file-input">
                    <input
                      type="file"
                      id="source-figure"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleSourceFigureChange}
                      className="autodraw-file-input__hidden"
                    />
                    <label
                      htmlFor="source-figure"
                      className="autodraw-file-input__label"
                    >
                      {sourceFigure?.name || t('dialog.autodraw.chooseFile')}
                    </label>
                  </div>
                  <div className="autodraw-dialog__field autodraw-dialog__field--compact">
                    <span className="autodraw-dialog__label">
                      {t('dialog.autodraw.sourceRunMode')}
                    </span>
                    <div className="autodraw-mode-switch">
                      <button
                        type="button"
                        onClick={() => setSourceRunMode('segmented')}
                        disabled={isJobBusy}
                        aria-pressed={sourceRunMode === 'segmented'}
                        className={classNames('autodraw-mode-switch__button', {
                          'autodraw-mode-switch__button--active':
                            sourceRunMode === 'segmented',
                        })}
                      >
                        {t('dialog.autodraw.sourceRunSegmented')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceRunMode('direct-svg')}
                        disabled={isJobBusy}
                        aria-pressed={sourceRunMode === 'direct-svg'}
                        className={classNames('autodraw-mode-switch__button', {
                          'autodraw-mode-switch__button--active':
                            sourceRunMode === 'direct-svg',
                        })}
                      >
                        {t('dialog.autodraw.sourceRunDirectSvg')}
                      </button>
                    </div>
                    <p className="autodraw-dialog__hint">
                      {sourceRunMode === 'direct-svg'
                        ? t('dialog.autodraw.sourceRunDirectSvgHint')
                        : t('dialog.autodraw.sourceRunSegmentedHint')}
                    </p>
                  </div>
                </div>
              ) : (
                <label className="autodraw-dialog__field">
                  <span className="autodraw-field-label">
                    <span className="autodraw-dialog__label">
                      {t('dialog.autodraw.methodText')}
                    </span>
                    <span className="autodraw-anno autodraw-anno--small">
                      Ctrl+Enter 提交
                    </span>
                  </span>
                  <textarea
                    rows={7}
                    value={methodText}
                    onChange={handleMethodTextChange}
                    onKeyDown={handleMethodTextKeyDown}
                    placeholder={t('dialog.autodraw.placeholder')}
                    className="autodraw-input autodraw-input--method"
                  />
                </label>
              )}

              {!isSourceInputMode && (
                <section className="autodraw-ca-panel">
                  <div className="autodraw-ca-panel__head">
                    <div>
                      <div className="autodraw-sec-title">
                        {t('dialog.autodraw.ca.title')}
                        <span>{t('dialog.autodraw.ca.kicker')}</span>
                      </div>
                      <p className="autodraw-dialog__hint">
                        {clarificationStatus === 'ready'
                          ? t('dialog.autodraw.ca.readyHint')
                          : clarificationStatus === 'skipped'
                          ? t('dialog.autodraw.ca.skippedHint')
                          : t('dialog.autodraw.ca.hint')}
                      </p>
                      <div className="autodraw-ca-language">
                        <span>{t('dialog.autodraw.ca.language')}</span>
                        <div className="autodraw-ca-language__switch">
                          <button
                            type="button"
                            onClick={() => handleCaLanguageChange('zh')}
                            disabled={
                              isJobBusy || clarificationStatus === 'loading'
                            }
                            aria-pressed={caLanguage === 'zh'}
                            className={classNames(
                              'autodraw-ca-language__button',
                              {
                                'autodraw-ca-language__button--active':
                                  caLanguage === 'zh',
                              }
                            )}
                          >
                            {t('dialog.autodraw.ca.languageChinese')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCaLanguageChange('en')}
                            disabled={
                              isJobBusy || clarificationStatus === 'loading'
                            }
                            aria-pressed={caLanguage === 'en'}
                            className={classNames(
                              'autodraw-ca-language__button',
                              {
                                'autodraw-ca-language__button--active':
                                  caLanguage === 'en',
                              }
                            )}
                          >
                            {t('dialog.autodraw.ca.languageEnglish')}
                          </button>
                        </div>
                      </div>
                    </div>
                    <span
                      className={classNames(
                        'autodraw-ca-panel__status',
                        `autodraw-ca-panel__status--${clarificationStatus}`
                      )}
                    >
                      {t(`dialog.autodraw.ca.status.${clarificationStatus}`)}
                    </span>
                  </div>

                  {clarificationSummary && clarificationStatus === 'ready' && (
                    <div className="autodraw-ca-panel__summary">
                      <span>{t('dialog.autodraw.ca.summary')}</span>
                      {clarificationSummary}
                    </div>
                  )}

                  {clarificationStatus === 'error' && clarificationError && (
                    <div className="autodraw-ca-panel__error">
                      {clarificationError}
                    </div>
                  )}

                  {clarificationQuestions.length > 0 &&
                    clarificationStatus !== 'skipped' && (
                      <div className="autodraw-ca-question-list">
                        {clarificationQuestions.map((question, index) => (
                          <div
                            key={question.id}
                            className="autodraw-ca-question"
                          >
                            <div className="autodraw-ca-question__title">
                              <span>{String(index + 1).padStart(2, '0')}</span>
                              {question.title}
                            </div>
                            <div className="autodraw-ca-options">
                              {question.options.map((option) => {
                                const isSelected =
                                  clarificationAnswers[question.id] ===
                                  option.id;
                                const isRecommended =
                                  question.recommended_option_id === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() =>
                                      handleSelectClarificationOption(
                                        question.id,
                                        option.id
                                      )
                                    }
                                    aria-pressed={isSelected}
                                    className={classNames(
                                      'autodraw-ca-option',
                                      {
                                        'autodraw-ca-option--selected':
                                          isSelected,
                                      }
                                    )}
                                  >
                                    <span className="autodraw-ca-option__label">
                                      {option.label}
                                      {isRecommended && (
                                        <em>
                                          {t('dialog.autodraw.ca.recommended')}
                                        </em>
                                      )}
                                    </span>
                                    {option.description && (
                                      <span className="autodraw-ca-option__desc">
                                        {option.description}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  <div className="autodraw-ca-panel__actions">
                    <button
                      type="button"
                      onClick={() => void handleGenerateClarification()}
                      disabled={isJobBusy || clarificationStatus === 'loading'}
                      className="autodraw-button autodraw-button--secondary autodraw-button--compact"
                    >
                      {clarificationStatus === 'loading'
                        ? t('dialog.autodraw.ca.generating')
                        : clarificationQuestions.length
                        ? t('dialog.autodraw.ca.regenerate')
                        : t('dialog.autodraw.ca.generate')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipClarification}
                      disabled={isJobBusy || clarificationStatus === 'loading'}
                      className="autodraw-link-btn autodraw-link-btn--inline"
                    >
                      {t('dialog.autodraw.ca.skip')}
                    </button>
                    {clarificationQuestions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearClarification}
                        disabled={
                          isJobBusy || clarificationStatus === 'loading'
                        }
                        className="autodraw-link-btn autodraw-link-btn--inline"
                      >
                        {t('dialog.autodraw.ca.clear')}
                      </button>
                    )}
                  </div>
                </section>
              )}

              <label className="autodraw-dialog__field">
                <span className="autodraw-dialog__label">
                  {t('dialog.autodraw.imageSize')}
                </span>
                <select
                  value={imageSize}
                  onChange={(event) =>
                    setImageSize(event.target.value as AutodrawImageSize)
                  }
                  disabled={isSourceInputMode}
                  className="autodraw-input"
                >
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
                <p className="autodraw-dialog__hint">
                  {t('dialog.autodraw.imageSizeHint')}
                </p>
              </label>

              <div className="autodraw-dialog__field">
                <span className="autodraw-dialog__label">
                  {t('dialog.autodraw.figureLanguage')}
                </span>
                <div className="autodraw-mode-switch">
                  <button
                    type="button"
                    onClick={() => setFigureLanguage('en')}
                    disabled={isSourceInputMode || isJobBusy}
                    aria-pressed={figureLanguage === 'en'}
                    className={classNames('autodraw-mode-switch__button', {
                      'autodraw-mode-switch__button--active':
                        figureLanguage === 'en',
                    })}
                  >
                    {t('dialog.autodraw.figureLanguageEnglish')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFigureLanguage('zh')}
                    disabled={isSourceInputMode || isJobBusy}
                    aria-pressed={figureLanguage === 'zh'}
                    className={classNames('autodraw-mode-switch__button', {
                      'autodraw-mode-switch__button--active':
                        figureLanguage === 'zh',
                    })}
                  >
                    {t('dialog.autodraw.figureLanguageChinese')}
                  </button>
                </div>
                <p className="autodraw-dialog__hint">
                  {isSourceInputMode
                    ? t('dialog.autodraw.figureLanguageHintSource')
                    : figureLanguage === 'zh'
                    ? t('dialog.autodraw.figureLanguageHintChinese')
                    : t('dialog.autodraw.figureLanguageHintEnglish')}
                </p>
              </div>

              <label className="autodraw-dialog__field">
                <span className="autodraw-field-label">
                  <span className="autodraw-dialog__label">
                    {t('dialog.autodraw.samPrompt')}
                  </span>
                </span>
                <input
                  value={samPrompt}
                  onChange={(event) => setSamPrompt(event.target.value)}
                  disabled={isDirectSvgSourceMode}
                  className="autodraw-input"
                />
                <p className="autodraw-dialog__hint">
                  {isDirectSvgSourceMode
                    ? t('dialog.autodraw.samPromptHintDirectSvg')
                    : t('dialog.autodraw.samPromptHint')}
                </p>
              </label>

              <div className="autodraw-dialog__field">
                <span className="autodraw-dialog__label">
                  {t('dialog.autodraw.backgroundRemoval')}
                </span>
                <div className="autodraw-mode-switch">
                  <button
                    type="button"
                    onClick={() => setRemoveBackground(true)}
                    disabled={isDirectSvgSourceMode || isJobBusy}
                    aria-pressed={removeBackground}
                    className={classNames('autodraw-mode-switch__button', {
                      'autodraw-mode-switch__button--active': removeBackground,
                    })}
                  >
                    {t('dialog.autodraw.backgroundRemovalOn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveBackground(false)}
                    disabled={isDirectSvgSourceMode || isJobBusy}
                    aria-pressed={!removeBackground}
                    className={classNames('autodraw-mode-switch__button', {
                      'autodraw-mode-switch__button--active': !removeBackground,
                    })}
                  >
                    {t('dialog.autodraw.backgroundRemovalOff')}
                  </button>
                </div>
                <p className="autodraw-dialog__hint">
                  {isDirectSvgSourceMode
                    ? t('dialog.autodraw.backgroundRemovalHintDirectSvg')
                    : removeBackground
                    ? t('dialog.autodraw.backgroundRemovalHint')
                    : t('dialog.autodraw.backgroundRemovalHintSkip')}
                </p>
              </div>

              <div className="autodraw-btn-row">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isJobBusy}
                  className="autodraw-button autodraw-button--primary"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 1 L9 5 L2 9 Z" fill="currentColor" />
                  </svg>
                  {t('dialog.autodraw.generate')}
                </button>
                {jobId &&
                  (status === 'queued' ||
                    status === 'running' ||
                    status === 'cancelling') && (
                    <button
                      type="button"
                      onClick={handleCancelJob}
                      disabled={status === 'cancelling'}
                      className="autodraw-button autodraw-button--danger"
                    >
                      {status === 'cancelling'
                        ? t('dialog.autodraw.cancelling')
                        : t('dialog.autodraw.cancel')}
                    </button>
                  )}
                {jobId && (
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={isJobBusy}
                    className="autodraw-button autodraw-button--secondary"
                  >
                    {t('dialog.autodraw.resume')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDockWorkbench}
                  className="autodraw-button autodraw-button--ghost"
                >
                  {t('dialog.autodraw.hideWorkbench')}
                </button>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="autodraw-link-btn"
              >
                {t('dialog.close')}
              </button>

              {!isSourceInputMode && (
                <>
                  <div
                    className="autodraw-divider"
                    data-label={t('dialog.autodraw.referenceGallery')}
                  />

                  <div className="autodraw-sec-head">
                    <div className="autodraw-sec-title">
                      {t('dialog.autodraw.resources')}
                      <span>· style refs</span>
                    </div>
                    <span className="autodraw-anno autodraw-anno--small">
                      {referenceSource === 'upload'
                        ? t('dialog.autodraw.manualReference')
                        : t('dialog.autodraw.referenceGallery')}
                    </span>
                  </div>

                  <div className="autodraw-mini-label">
                    {t('dialog.autodraw.referenceGallery')}
                  </div>

                  <div className="autodraw-folder-tab">
                    <span className="autodraw-folder-tab__dot" />
                    {galleryDirectoryName ||
                      selectedGalleryItem?.name ||
                      referenceImage?.name ||
                      'gallery'}
                  </div>

                  <div className="autodraw-gallery-actions">
                    <button
                      type="button"
                      className="autodraw-mini-btn"
                      onClick={() => void handleChooseReferenceGallery()}
                    >
                      {t('dialog.autodraw.galleryChooseFolder')}
                    </button>
                    {galleryDirectoryName && (
                      <>
                        <button
                          type="button"
                          className="autodraw-mini-btn"
                          onClick={() => void handleRefreshReferenceGallery()}
                        >
                          {t('dialog.autodraw.galleryRefresh')}
                        </button>
                        <button
                          type="button"
                          className="autodraw-mini-btn"
                          onClick={() => void handleClearReferenceGallery()}
                        >
                          {t('dialog.autodraw.galleryDisconnect')}
                        </button>
                      </>
                    )}
                  </div>

                  {galleryState === 'loading' ? (
                    <div className="autodraw-gallery-empty">
                      {t('dialog.autodraw.galleryLoading')}
                    </div>
                  ) : galleryState === 'unsupported' ? (
                    <div className="autodraw-gallery-empty">
                      {t('dialog.autodraw.galleryUnsupported')}
                    </div>
                  ) : galleryState === 'needs-permission' ? (
                    <div className="autodraw-gallery-empty">
                      {galleryMessage ||
                        t('dialog.autodraw.galleryPermissionHint')}
                    </div>
                  ) : galleryItems.length > 0 ? (
                    <div className="autodraw-gallery-grid">
                      {galleryItems.map((item) => (
                        <div
                          key={item.id}
                          className={classNames('autodraw-gallery-card', {
                            'autodraw-gallery-card--active':
                              selectedGalleryItemId === item.id &&
                              referenceSource === 'gallery',
                          })}
                        >
                          <button
                            type="button"
                            onClick={() => handleReferenceGalleryPick(item)}
                            className="autodraw-gallery-card__select"
                          >
                            <div className="autodraw-gallery-card__image-wrap">
                              <img
                                src={item.previewUrl}
                                alt={item.name}
                                loading="lazy"
                                className="autodraw-gallery-card__image"
                              />
                            </div>
                            <span className="autodraw-gallery-card__label">
                              {item.name}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="autodraw-gallery-card__preview-btn"
                            onClick={() => openGalleryPreview(item)}
                            aria-label={`${t('dialog.autodraw.openPreview')}: ${
                              item.name
                            }`}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="autodraw-gallery-empty">
                      {galleryMessage || t('dialog.autodraw.galleryEmpty')}
                    </div>
                  )}

                  <div className="autodraw-inline-card">
                    <div>
                      <div className="autodraw-dialog__label">
                        {t('dialog.autodraw.manualReference')}
                      </div>
                      <p className="autodraw-dialog__hint">
                        {t('dialog.autodraw.manualReferenceHint')}
                      </p>
                    </div>
                    <div className="autodraw-file-input">
                      <input
                        type="file"
                        id="ref-image"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleReferenceImageChange}
                        className="autodraw-file-input__hidden"
                      />
                      <label
                        htmlFor="ref-image"
                        className="autodraw-file-input__label"
                      >
                        {referenceSource === 'upload' && referenceImage
                          ? referenceImage.name
                          : t('dialog.autodraw.chooseFile')}
                      </label>
                    </div>
                  </div>

                  <p className="autodraw-dialog__hint">
                    {t('dialog.autodraw.referenceHint')}
                  </p>
                </>
              )}

              <div className="autodraw-divider" data-label="导入 / 接续" />

              <div className="autodraw-inline-card autodraw-inline-card--stack">
                <div className="autodraw-file-input">
                  <input
                    type="file"
                    id="bundle-zip"
                    accept=".zip,application/zip"
                    onChange={handleBundleFileChange}
                    className="autodraw-file-input__hidden"
                  />
                  <label
                    htmlFor="bundle-zip"
                    className="autodraw-file-input__label"
                  >
                    {bundleFileName || t('dialog.autodraw.uploadZip')}
                  </label>
                </div>
                <p className="autodraw-dialog__hint">
                  {t('dialog.autodraw.bundleHint')}
                </p>
              </div>

              <label className="autodraw-dialog__field">
                <span className="autodraw-dialog__label">
                  {t('dialog.autodraw.existingJobId')}
                </span>
                <div className="autodraw-dialog__inline">
                  <input
                    value={jobIdInput}
                    onChange={(event) => setJobIdInput(event.target.value)}
                    placeholder={t('dialog.autodraw.existingJobPlaceholder')}
                    className="autodraw-input"
                  />
                  <button
                    type="button"
                    onClick={loadExistingJob}
                    disabled={isJobBusy}
                    className="autodraw-button autodraw-button--secondary"
                  >
                    {t('dialog.autodraw.loadJob')}
                  </button>
                </div>
              </label>

              {jobId && (
                <div className="autodraw-dialog__job-actions">
                  <span className="autodraw-dialog__pill">{jobId}</span>
                  <button
                    type="button"
                    onClick={handleCopyJobId}
                    className="autodraw-button autodraw-button--secondary autodraw-button--compact"
                  >
                    {jobIdCopied
                      ? t('dialog.autodraw.copied')
                      : t('dialog.autodraw.copyJobId')}
                  </button>
                  <button
                    type="button"
                    onClick={handleShowCurrentJobFlow}
                    disabled={isJobBusy}
                    className="autodraw-button autodraw-button--ghost autodraw-button--compact"
                  >
                    {t('dialog.autodraw.viewFlow')}
                  </button>
                </div>
              )}

              {showAdvanced && (
                <>
                  <div
                    className="autodraw-divider"
                    data-label={t('dialog.autodraw.advancedSettings')}
                  />

                  <div className="autodraw-advanced-grid">
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.backendUrl')}
                      </span>
                      <input
                        value={backendUrl}
                        onChange={(event) => setBackendUrl(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.provider')}
                      </span>
                      <input
                        value={provider}
                        onChange={(event) => setProvider(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.apiKey')}
                      </span>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.baseUrl')}
                      </span>
                      <input
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.imageModel')}
                      </span>
                      <input
                        value={imageModel}
                        onChange={(event) => setImageModel(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.caBaseUrl')}
                      </span>
                      <input
                        value={caBaseUrl}
                        onChange={(event) => setCaBaseUrl(event.target.value)}
                        placeholder={DEFAULT_AUTODRAW_CA_BASE_URL || undefined}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.caApiKey')}
                      </span>
                      <input
                        type="password"
                        value={caApiKey}
                        onChange={(event) => setCaApiKey(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.caModel')}
                      </span>
                      <input
                        value={caModel}
                        onChange={(event) => setCaModel(event.target.value)}
                        placeholder={DEFAULT_AUTODRAW_CA_MODEL || undefined}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.svgModel')}
                      </span>
                      <input
                        value={svgModel}
                        onChange={(event) => setSvgModel(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                  </div>

                  <div className="autodraw-scale-card">
                    <div className="autodraw-sec-head autodraw-sec-head--tight">
                      <div className="autodraw-sec-title">
                        {t('dialog.autodraw.latestImport')}
                        <span>· text scale</span>
                      </div>
                      <span className="autodraw-dialog__pill">{`x${lastImportedTextScale.toFixed(
                        2
                      )}`}</span>
                    </div>
                    <div className="autodraw-dialog__scale-actions">
                      <button
                        type="button"
                        className="autodraw-button autodraw-button--secondary"
                        disabled={!canAdjustTextScale}
                        onClick={() => {
                          const nextScale = Math.max(
                            0.6,
                            roundTextScaleFactor(lastImportedTextScale - 0.1)
                          );
                          applyTextScaleToLastImport(
                            nextScale / lastImportedTextScale
                          );
                        }}
                      >
                        A-
                      </button>
                      <button
                        type="button"
                        className="autodraw-button autodraw-button--ghost"
                        disabled={!canAdjustTextScale}
                        onClick={() =>
                          applyTextScaleToLastImport(1 / lastImportedTextScale)
                        }
                      >
                        {`x${lastImportedTextScale.toFixed(2)}`}
                      </button>
                      <button
                        type="button"
                        className="autodraw-button autodraw-button--secondary"
                        disabled={!canAdjustTextScale}
                        onClick={() => {
                          const nextScale = Math.min(
                            2.5,
                            roundTextScaleFactor(lastImportedTextScale + 0.1)
                          );
                          applyTextScaleToLastImport(
                            nextScale / lastImportedTextScale
                          );
                        }}
                      >
                        A+
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>

            <main className="autodraw-col autodraw-col--center">
              <div className="autodraw-task-head">
                <div className="autodraw-task-id">
                  <span
                    className={classNames(
                      'autodraw-chip',
                      `autodraw-chip--${getAutodrawStatusBadgeClass(
                        status
                      ).replace('autodraw-badge--', '')}`
                    )}
                  >
                    <span className="autodraw-chip__pulse" />
                    {statusLabel}
                  </span>
                  <span className="autodraw-task-id__title">
                    {t('dialog.autodraw.workbench')}
                  </span>
                  <code>
                    {jobId ? `ID: ${jobId}` : t('dialog.autodraw.noJob')}
                  </code>
                </div>
                <div className="autodraw-counts">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="autodraw-count-card">
                      <div className="autodraw-count-card__value">
                        {item.value}
                      </div>
                      <div className="autodraw-count-card__label">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <section className="autodraw-progress-wrap">
                <div className="autodraw-progress-head">
                  <span className="autodraw-progress-head__label">
                    生成预估进度
                    <span className="autodraw-anno autodraw-anno--small">
                      · {currentStageLabel}
                    </span>
                  </span>
                  <span className="autodraw-progress-head__value">{`${Math.round(
                    progressRatio * 100
                  )}%`}</span>
                </div>
                <div className="autodraw-progress-bar autodraw-progress-bar--workspace">
                  <span
                    className={classNames('autodraw-progress-bar__fill', {
                      'autodraw-progress-bar__fill--running': isJobBusy,
                    })}
                    style={{ width: `${Math.max(progressRatio, 0.04) * 100}%` }}
                  />
                </div>
              </section>

              {!!errorMessage && (
                <div className="autodraw-dialog__error-banner">
                  <span className="autodraw-dialog__error-dot" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <section className="autodraw-pipeline-card">
                <span className="autodraw-help-chip">
                  // 每一步都可以回看 / 重跑
                </span>

                <div className="autodraw-sec-head">
                  <div className="autodraw-sec-title">
                    Pipeline<span>· 文本 → 矢量</span>
                  </div>
                  <div className="autodraw-sec-actions">
                    <button
                      type="button"
                      className={classNames(
                        'autodraw-mini-btn',
                        'autodraw-mini-btn--trace',
                        {
                          'autodraw-mini-btn--active': processTraceOpen,
                        }
                      )}
                      onClick={() => void handleToggleProcessTrace()}
                      disabled={!jobId || processTraceStatus === 'loading'}
                    >
                      {processTraceStatus === 'loading'
                        ? t('dialog.autodraw.processTrace.loading')
                        : t('dialog.autodraw.processTrace.button')}
                    </button>
                    <span className="autodraw-anno autodraw-anno--small">
                      当前 · {currentStageLabel}
                    </span>
                  </div>
                </div>

                {processTraceOpen && (
                  <section className="autodraw-process-card">
                    <div className="autodraw-process-card__head">
                      <div>
                        <div className="autodraw-process-card__kicker">
                          {t('dialog.autodraw.processTrace.kicker')}
                        </div>
                        <h3>{t('dialog.autodraw.processTrace.title')}</h3>
                      </div>
                      <button
                        type="button"
                        className="autodraw-link-btn autodraw-link-btn--inline"
                        onClick={() => setProcessTraceOpen(false)}
                      >
                        {t('dialog.autodraw.processTrace.close')}
                      </button>
                    </div>

                    {processTraceStatus === 'error' && (
                      <div className="autodraw-process-card__empty">
                        {processTraceError ||
                          t('dialog.autodraw.processTrace.unavailable')}
                      </div>
                    )}

                    {processTraceStatus === 'loading' && (
                      <div className="autodraw-process-card__empty">
                        {t('dialog.autodraw.processTrace.loading')}
                      </div>
                    )}

                    {processTraceStatus === 'ready' && processTrace && (
                      <>
                        <div className="autodraw-process-card__meta">
                          <span>
                            {processTrace.pipeline || 'method_to_svg'}
                          </span>
                          <span>
                            {formatProcessTraceValue(
                              processTrace.settings?.figure_language
                            )}
                          </span>
                          <span>
                            {formatProcessTraceValue(
                              processTrace.settings?.provider
                            )}
                          </span>
                        </div>

                        <div className="autodraw-process-stage-list">
                          {(processTrace.stages || []).map((stage, index) => (
                            <article
                              key={stage.id || `${stage.step}-${index}`}
                              className="autodraw-process-stage"
                            >
                              <div className="autodraw-process-stage__rail">
                                <span>
                                  {getProcessTraceStepLabel(stage.step)}
                                </span>
                              </div>
                              <div className="autodraw-process-stage__body">
                                <div className="autodraw-process-stage__top">
                                  <div>
                                    <h4>
                                      {stage.title ||
                                        t('dialog.autodraw.processTrace.stage')}
                                    </h4>
                                    {stage.summary && <p>{stage.summary}</p>}
                                  </div>
                                  {stage.status && (
                                    <span className="autodraw-process-stage__status">
                                      {stage.status}
                                    </span>
                                  )}
                                </div>

                                {stage.data_flow?.length ? (
                                  <div className="autodraw-process-flow">
                                    {stage.data_flow.map((item, flowIndex) => (
                                      <span
                                        key={`${stage.id}-flow-${flowIndex}`}
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                <div className="autodraw-process-io">
                                  {stage.inputs && (
                                    <div>
                                      <strong>
                                        {t(
                                          'dialog.autodraw.processTrace.inputs'
                                        )}
                                      </strong>
                                      {Object.entries(stage.inputs).map(
                                        ([key, value]) => (
                                          <p key={key}>
                                            <span>{key}</span>
                                            <code>
                                              {formatProcessTraceValue(value)}
                                            </code>
                                          </p>
                                        )
                                      )}
                                    </div>
                                  )}
                                  {stage.outputs && (
                                    <div>
                                      <strong>
                                        {t(
                                          'dialog.autodraw.processTrace.outputs'
                                        )}
                                      </strong>
                                      {Object.entries(stage.outputs).map(
                                        ([key, value]) => (
                                          <p key={key}>
                                            <span>{key}</span>
                                            <code>
                                              {formatProcessTraceValue(value)}
                                            </code>
                                          </p>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>

                                {stage.prompts?.length ? (
                                  <div className="autodraw-process-prompts">
                                    {stage.prompts.map(
                                      (prompt, promptIndex) => (
                                        <details
                                          key={`${stage.id}-prompt-${promptIndex}`}
                                          className="autodraw-process-prompt"
                                        >
                                          <summary>
                                            <span>
                                              {prompt.title ||
                                                t(
                                                  'dialog.autodraw.processTrace.prompt'
                                                )}
                                            </span>
                                            <em>
                                              {[prompt.provider, prompt.model]
                                                .filter(Boolean)
                                                .join(' · ')}
                                            </em>
                                          </summary>
                                          <pre>{prompt.content || '—'}</pre>
                                        </details>
                                      )
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                )}

                <div className="autodraw-pipeline-stages">
                  {workbenchStages.map((stage, index) => {
                    const isFailed =
                      (status === 'failed' || status === 'cancelled') &&
                      index === activeWorkbenchStep;
                    const isComplete =
                      index < activeWorkbenchStep || status === 'succeeded';
                    const isActive =
                      !isFailed &&
                      !isComplete &&
                      index === activeWorkbenchStep &&
                      status !== 'idle';
                    return (
                      <div
                        key={stage.key}
                        className={classNames('autodraw-pipeline-stage', {
                          'autodraw-pipeline-stage--done': isComplete,
                          'autodraw-pipeline-stage--active': isActive,
                          'autodraw-pipeline-stage--pending':
                            !isComplete && !isActive && !isFailed,
                          'autodraw-pipeline-stage--failed': isFailed,
                        })}
                      >
                        <div className="autodraw-pipeline-stage__no">
                          {stage.stepNumber}
                        </div>
                        <div className="autodraw-pipeline-stage__thumb-box">
                          {renderStageThumb(index)}
                        </div>
                        <div className="autodraw-pipeline-stage__label">
                          {stage.label}
                        </div>
                        <div className="autodraw-pipeline-stage__meta">
                          {getStageMeta(index)}
                        </div>
                        <div className="autodraw-pipeline-stage__chip">
                          {getStageChipLabel(index)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <svg
                  className="autodraw-stage-arrows"
                  viewBox="0 0 1000 60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  >
                    <path d="M180 30 C 195 22, 210 38, 220 30 M215 26 L222 30 L215 34" />
                    <path d="M380 30 C 395 22, 410 38, 420 30 M415 26 L422 30 L415 34" />
                    <path
                      d="M580 30 C 595 22, 610 38, 620 30 M615 26 L622 30 L615 34"
                      strokeDasharray="3 3"
                    />
                    <path
                      d="M780 30 C 795 22, 810 38, 820 30 M815 26 L822 30 L815 34"
                      strokeDasharray="3 3"
                    />
                  </g>
                </svg>
              </section>

              <div className="autodraw-output-grid">
                <section className="autodraw-panel">
                  <div className="autodraw-panel-head">
                    <div className="autodraw-panel-head__title">
                      落板预览<span>· canvas preview</span>
                    </div>
                    <div className="autodraw-panel-head__meta">
                      {currentStageLabel}
                    </div>
                  </div>

                  <div className="autodraw-output-canvas">
                    <div className="autodraw-output-canvas__mesh" />

                    {previewCanvasAsset && previewCanvasAsset.previewable ? (
                      <button
                        type="button"
                        className={classNames('autodraw-output-canvas__focus', {
                          'autodraw-output-canvas__focus--busy': isJobBusy,
                        })}
                        onClick={() => openAssetPreview(previewCanvasAsset)}
                        aria-label={`${t('dialog.autodraw.openPreview')}: ${
                          previewCanvasAsset.name
                        }`}
                      >
                        <div className="autodraw-output-canvas__sheet">
                          <img
                            src={previewCanvasAsset.url}
                            alt={previewCanvasAsset.name}
                            loading="lazy"
                            className={classNames(
                              'autodraw-output-canvas__image',
                              {
                                'autodraw-output-canvas__image--busy':
                                  isJobBusy,
                              }
                            )}
                          />

                          {isJobBusy ? (
                            <>
                              <div
                                className="autodraw-output-canvas__draft"
                                aria-hidden="true"
                              />
                              <div
                                className="autodraw-output-canvas__scan"
                                aria-hidden="true"
                              />

                              {previewCanvasInsetAsset ? (
                                <div
                                  className="autodraw-output-canvas__inset"
                                  aria-hidden="true"
                                >
                                  <img
                                    src={previewCanvasInsetAsset.url}
                                    alt=""
                                    loading="lazy"
                                    className="autodraw-output-canvas__inset-image"
                                  />
                                </div>
                              ) : null}

                              <div className="autodraw-output-canvas__status">
                                <span className="autodraw-output-canvas__status-chip">
                                  {previewCanvasStatusLabel}
                                </span>
                                <strong className="autodraw-output-canvas__status-title">
                                  {currentStageLabel}
                                </strong>
                                <span className="autodraw-output-canvas__status-copy">
                                  {t('dialog.autodraw.runningStageHint')}
                                </span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </button>
                    ) : (
                      <div className="autodraw-output-canvas__placeholder">
                        <div className="autodraw-output-canvas__placeholder-note">
                          {isJobBusy
                            ? t('dialog.autodraw.runningStageHint')
                            : t('dialog.autodraw.readyHint')}
                        </div>
                      </div>
                    )}
                  </div>

                  {(hasImportedPreview || isJobBusy) && (
                    <div className="autodraw-output-assembly">
                      {Array.from({ length: batchPreviewCount }, (_, index) => {
                        const complete =
                          assemblyProgress.totalBatches > 0
                            ? index < assemblyProgress.completedBatches
                            : index < batchPreviewCount;
                        return (
                          <span
                            key={`assembly-${index}`}
                            className={classNames(
                              'autodraw-output-assembly__brick',
                              {
                                'autodraw-output-assembly__brick--complete':
                                  complete,
                              }
                            )}
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="autodraw-panel-foot">
                    <span className="autodraw-anno autodraw-anno--small">
                      自动导入画板 · 完成后跳转
                    </span>
                    <span className="autodraw-anno autodraw-anno--small">
                      {assemblyProgress.insertedCount > 0
                        ? `placing fragments · ${assemblyProgress.insertedCount}`
                        : t('dialog.autodraw.latestImport')}
                    </span>
                  </div>
                </section>

                <section className="autodraw-panel">
                  <div className="autodraw-panel-head">
                    <div className="autodraw-panel-head__title">
                      {t('dialog.autodraw.assetRoom')}
                      <span>· asset room</span>
                    </div>
                    <div className="autodraw-panel-head__aside">
                      <div className="autodraw-panel-head__meta">
                        {`${assetShelfItems.length} items`}
                      </div>
                      {currentJobHistoryEntry && (
                        <div className="autodraw-asset-toolbar">
                          <button
                            type="button"
                            className="autodraw-mini-btn"
                            onClick={() =>
                              void handleBundleDownload(currentJobHistoryEntry)
                            }
                            disabled={!canDownloadCurrentBundle}
                          >
                            {t('dialog.autodraw.downloadBundle')}
                          </button>
                          <button
                            type="button"
                            className="autodraw-mini-btn"
                            onClick={() => void handleWorkspaceRebuild()}
                            disabled={!canOperateCurrentJob}
                          >
                            {t('dialog.autodraw.rebuildJob')}
                          </button>
                          <label className="autodraw-asset-toolbar__field">
                            <span className="autodraw-sr-only">
                              {t('dialog.autodraw.replayStageLabel')}
                            </span>
                            <select
                              value={workspaceReplayStage}
                              onChange={(event) =>
                                setWorkspaceReplayStage(
                                  Number(event.target.value)
                                )
                              }
                              className="autodraw-input autodraw-input--sm autodraw-asset-toolbar__select"
                              aria-label={t('dialog.autodraw.replayStageLabel')}
                              disabled={!canOperateCurrentJob}
                            >
                              {replayableWorkspaceStages.map((stage) => (
                                <option key={stage.key} value={stage.value}>
                                  {`${stage.stepNumber} · ${stage.label}`}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="autodraw-mini-btn"
                            onClick={() => void handleWorkspaceReplay()}
                            disabled={!canOperateCurrentJob}
                          >
                            {t('dialog.autodraw.replayFromStage')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {assetShelfItems.length > 0 ? (
                    <div className="autodraw-asset-room">
                      {assetShelfItems.map((item) =>
                        item.asset ? (
                          <article
                            key={item.id}
                            className={classNames('autodraw-asset-card', {
                              'autodraw-asset-card--icon': item.kind === 'icon',
                              'autodraw-asset-card--figure':
                                item.kind === 'figure',
                            })}
                          >
                            <button
                              type="button"
                              onClick={() => handleAssetPreview(item.asset!)}
                              className="autodraw-asset-card__preview"
                              aria-label={`${t(
                                'dialog.autodraw.openPreview'
                              )}: ${item.asset.name}`}
                            >
                              <div className="autodraw-asset-card__thumb">
                                <img
                                  src={item.asset.url}
                                  alt={item.asset.name}
                                  loading="lazy"
                                  className="autodraw-asset-card__image"
                                />
                              </div>
                            </button>
                            <div className="autodraw-asset-card__meta">
                              <strong className="autodraw-asset-card__title">
                                {item.title}
                              </strong>
                              <span className="autodraw-asset-card__stage">
                                {item.subtitle}
                              </span>
                            </div>
                          </article>
                        ) : (
                          <div
                            key={item.id}
                            className={classNames('autodraw-asset-card', {
                              'autodraw-asset-card--placeholder': true,
                              'autodraw-asset-card--icon': item.kind === 'icon',
                              'autodraw-asset-card--figure':
                                item.kind === 'figure',
                            })}
                          >
                            <div className="autodraw-asset-card__thumb">
                              <span className="autodraw-asset-card__placeholder">
                                待生成
                              </span>
                            </div>
                            <div className="autodraw-asset-card__meta">
                              <strong className="autodraw-asset-card__title">
                                {item.title}
                              </strong>
                              <span className="autodraw-asset-card__stage">
                                {item.subtitle}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="autodraw-asset-empty">
                      <span>{t('dialog.autodraw.noAssets')}</span>
                      <span className="autodraw-anno autodraw-anno--small">
                        {t('dialog.autodraw.assetHintLive')}
                      </span>
                    </div>
                  )}
                </section>
              </div>
            </main>

            <aside className="autodraw-col autodraw-col--right">
              <AutodrawActivityPanel
                isBusy={isJobBusy}
                isReady={deferredPanelsReady}
                logs={deferredLogs}
                onClearLogs={() => setLogs([])}
                t={t}
              />
              <AutodrawHistoryPanel
                currentJobId={jobId}
                entries={deferredHistoryPreviewEntries}
                isReady={deferredPanelsReady}
                onClearHistory={clearHistory}
                onDeleteHistoryEntry={deleteHistoryEntry}
                onHistoryCopy={handleHistoryCopy}
                onHistoryLoad={handleHistoryLoad}
                onHistoryPreview={handleHistoryPreview}
                onHistoryReplay={(entry, startStage) =>
                  replayJobFromStage(entry, startStage)
                }
                t={t}
                workbenchStages={workbenchStages}
              />
            </aside>
          </div>
        </div>
      )}

      {assetPreview && (
        <div
          className="autodraw-asset-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setAssetPreview(null)}
        >
          <div
            className={classNames('autodraw-asset-lightbox__panel', {
              'autodraw-asset-lightbox__panel--icon':
                assetPreview.mode === 'icon',
            })}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="autodraw-asset-lightbox__head">
              <div>
                <h3 className="autodraw-dialog__panel-title">
                  {assetPreview.title}
                </h3>
                <p className="autodraw-dialog__panel-copy">
                  {assetPreview.subtitle}
                </p>
              </div>
              <button
                type="button"
                className="autodraw-button autodraw-button--ghost autodraw-button--compact"
                onClick={() => setAssetPreview(null)}
              >
                {t('dialog.close')}
              </button>
            </div>
            <div
              className={classNames('autodraw-asset-lightbox__viewport', {
                'autodraw-asset-lightbox__viewport--icon':
                  assetPreview.mode === 'icon',
              })}
            >
              <img
                src={assetPreview.url}
                alt={assetPreview.title}
                className={classNames('autodraw-asset-lightbox__image', {
                  'autodraw-asset-lightbox__image--icon':
                    assetPreview.mode === 'icon',
                })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutodrawDialog;
