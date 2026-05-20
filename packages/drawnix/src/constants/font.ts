export interface FontFamilyOption {
  value: string;
  label: string;
  previewText?: string;
  isBuiltIn?: boolean;
}

export type FontFamilyConfigInput = FontFamilyOption | string;
export type FontRoleName =
  | 'title'
  | 'body'
  | 'plain'
  | 'annotation'
  | 'decorative-symbol'
  | 'emoji'
  | 'code';

export type FontRoleFamilyConfig = Partial<Record<FontRoleName, string>>;

export const DEFAULT_FONT_FAMILY =
  '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export const FONT_FALLBACK_FAMILIES = [
  '"Segoe UI"',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
];

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  {
    value:
      '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    label: '思源黑体',
    previewText: '字',
    isBuiltIn: true,
  },
  {
    value: '"Noto Serif SC", "Songti SC", "STSong", "Times New Roman", serif',
    label: '思源宋体',
    previewText: '字',
    isBuiltIn: true,
  },
  {
    value:
      '"LXGW WenKai GB Screen", "Kaiti SC", STKaiti, "Noto Serif SC", serif',
    label: '霞鹜文楷',
    previewText: '文',
    isBuiltIn: true,
  },
  {
    value: '"ZCOOL XiaoWei", "Noto Serif SC", "Songti SC", serif',
    label: '站酷小薇',
    previewText: '章',
    isBuiltIn: true,
  },
  {
    value: '"ZCOOL QingKe HuangYou", "Noto Sans SC", "PingFang SC", sans-serif',
    label: '站酷庆科',
    previewText: '题',
    isBuiltIn: true,
  },
  {
    value: '"Ma Shan Zheng", "Kaiti SC", STKaiti, cursive',
    label: '马善政',
    previewText: '签',
    isBuiltIn: true,
  },
  {
    value: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    label: '苹方',
    previewText: '字',
  },
  {
    value: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
    label: '微软雅黑',
    previewText: '字',
  },
  {
    value: '"Songti SC", STSong, "Noto Serif SC", serif',
    label: '宋体',
    previewText: '字',
  },
  {
    value: '"Kaiti SC", STKaiti, "KaiTi", serif',
    label: '楷体',
    previewText: '字',
  },
  {
    value: '"FangSong", STFangsong, serif',
    label: '仿宋',
    previewText: '字',
  },
  {
    value: '"NSimSun", SimSun, "Songti SC", STSong, serif',
    label: '新宋体',
    previewText: '字',
  },
  { value: DEFAULT_FONT_FAMILY, label: 'Sans', previewText: 'Aa' },
  {
    value: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
    label: 'Source Sans',
    isBuiltIn: true,
  },
  {
    value: '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif',
    label: 'IBM Plex',
    isBuiltIn: true,
  },
  { value: '"Helvetica Neue", Arial, sans-serif', label: 'Helvetica' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  {
    value: '"Source Serif 4", Georgia, serif',
    label: 'Source Serif',
    isBuiltIn: true,
  },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet' },
  { value: '"Comic Sans MS", "Trebuchet MS", cursive', label: 'Comic Sans' },
  { value: '"Courier New", Courier, monospace', label: 'Courier' },
  {
    value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    label: 'JetBrains',
    isBuiltIn: true,
  },
  { value: '"Cascadia Code", Consolas, monospace', label: 'Cascadia' },
];

let runtimeFontFamilyOptions: FontFamilyOption[] | undefined;
let runtimeFontRoleFamilies: FontRoleFamilyConfig | undefined;

export const splitFontFamilyCandidates = (value?: string) => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeFontFamilyStack = (fontFamily?: string) => {
  const rawFamilies = splitFontFamilyCandidates(
    fontFamily || DEFAULT_FONT_FAMILY
  );
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const family of [...rawFamilies, ...FONT_FALLBACK_FAMILIES]) {
    const key = family.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(family);
  }

  return deduped.join(', ');
};

export const DEFAULT_FONT_ROLE_FAMILIES: FontRoleFamilyConfig = {
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
};

export const normalizeFontFamilyTokens = (value?: string) =>
  splitFontFamilyCandidates(value).map((item) =>
    item.replace(/^['"]|['"]$/g, '').toLowerCase()
  );

export const getPrimaryFontFamilyName = (value?: string) => {
  const [first] = splitFontFamilyCandidates(value);
  return first ? first.replace(/^['"]|['"]$/g, '') : undefined;
};

export const normalizeFontFamilyOption = (
  input: FontFamilyConfigInput
): FontFamilyOption | null => {
  if (typeof input === 'string') {
    const value = input.trim();
    if (!value) {
      return null;
    }
    return {
      value,
      label: splitFontFamilyCandidates(value)[0] || value,
    };
  }
  const value = input.value?.trim();
  const label = input.label?.trim();
  if (!value || !label) {
    return null;
  }
  return {
    value,
    label,
    previewText: input.previewText,
    isBuiltIn: input.isBuiltIn,
  };
};

export const normalizeFontFamilyOptions = (
  options?: FontFamilyConfigInput[]
): FontFamilyOption[] | undefined => {
  if (!options || options.length === 0) {
    return undefined;
  }
  const normalized = options
    .map((option) => normalizeFontFamilyOption(option))
    .filter((option): option is FontFamilyOption => Boolean(option));
  return normalized.length > 0 ? normalized : undefined;
};

export const setProjectFontFamilyOptions = (
  options?: FontFamilyConfigInput[]
) => {
  runtimeFontFamilyOptions = normalizeFontFamilyOptions(options);
};

export const setProjectFontRoleFamilies = (
  roleFamilies?: FontRoleFamilyConfig
) => {
  runtimeFontRoleFamilies = roleFamilies ? { ...roleFamilies } : undefined;
};

export const getConfiguredFontFamilyOptions = (): FontFamilyOption[] => {
  if (runtimeFontFamilyOptions?.length) {
    return runtimeFontFamilyOptions;
  }

  const windowOptions =
    typeof window !== 'undefined'
      ? (
          window as Window & {
            __DRAWNIX_FONT_FAMILIES__?: FontFamilyConfigInput[];
          }
        ).__DRAWNIX_FONT_FAMILIES__
      : undefined;
  const normalizedWindowOptions = normalizeFontFamilyOptions(windowOptions);
  if (normalizedWindowOptions?.length) {
    return normalizedWindowOptions;
  }

  return FONT_FAMILY_OPTIONS;
};

export const getConfiguredFontRoleFamilies = (): FontRoleFamilyConfig => {
  const windowRoleFamilies =
    typeof window !== 'undefined'
      ? (
          window as Window & {
            __DRAWNIX_FONT_ROLE_FAMILIES__?: FontRoleFamilyConfig;
          }
        ).__DRAWNIX_FONT_ROLE_FAMILIES__
      : undefined;
  return {
    ...DEFAULT_FONT_ROLE_FAMILIES,
    ...(windowRoleFamilies || {}),
    ...(runtimeFontRoleFamilies || {}),
  };
};

export const resolveFontFamilyForRole = (
  role: string | undefined,
  explicitFontFamily?: string,
  availableSourceFamilies?: string[]
) => {
  const roleFamilies = getConfiguredFontRoleFamilies();
  const roleKey = (role || 'plain') as FontRoleName;
  const configured =
    roleFamilies[roleKey] || roleFamilies.plain || DEFAULT_FONT_FAMILY;
  if (configured?.trim()) {
    return normalizeFontFamilyStack(configured);
  }

  const sourceFamilies = (availableSourceFamilies || []).filter(Boolean);
  if (sourceFamilies.length > 0) {
    return normalizeFontFamilyStack(sourceFamilies.join(', '));
  }
  const normalizedExplicit = explicitFontFamily?.trim();
  if (normalizedExplicit && normalizedExplicit !== DEFAULT_FONT_FAMILY) {
    return normalizeFontFamilyStack(normalizedExplicit);
  }
  return normalizeFontFamilyStack(DEFAULT_FONT_FAMILY);
};

export const resolveFontFamilyOption = (currentFontFamily?: string) => {
  const currentFamilies = normalizeFontFamilyTokens(currentFontFamily);
  const availableOptions = getConfiguredFontFamilyOptions();
  if (currentFamilies.length === 0) {
    return availableOptions[0]!;
  }
  const currentPrimary =
    getPrimaryFontFamilyName(currentFontFamily)?.toLowerCase();
  const matchedByPrimary =
    currentPrimary &&
    availableOptions.find((option) => {
      return (
        getPrimaryFontFamilyName(option.value)?.toLowerCase() === currentPrimary
      );
    });
  if (matchedByPrimary) {
    return matchedByPrimary;
  }
  const matched = availableOptions.find((option) => {
    const optionFamilies = normalizeFontFamilyTokens(option.value);
    return (
      optionFamilies.length > 0 &&
      optionFamilies.every((family) => currentFamilies.includes(family))
    );
  });
  return (
    matched || {
      value: currentFontFamily!,
      label: splitFontFamilyCandidates(currentFontFamily)[0] || 'Custom',
    }
  );
};
