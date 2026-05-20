import {
  normalizeFontFamilyStack,
  resolveFontFamilyOption,
  setProjectFontFamilyOptions,
} from './font';

describe('font option matching', () => {
  afterEach(() => {
    setProjectFontFamilyOptions(undefined);
  });

  it('应优先按主字体匹配，而不是被 fallback 误判成默认无衬线', () => {
    const normalized = normalizeFontFamilyStack('Georgia, serif');

    const resolved = resolveFontFamilyOption(normalized);

    expect(resolved.label).toBe('Georgia');
  });

  it('应能在项目级字体方案下返回正确标签', () => {
    setProjectFontFamilyOptions([
      {
        label: '默认无衬线',
        value:
          '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        isBuiltIn: true,
      },
      {
        label: '宋体',
        value: '"Noto Serif SC", "Songti SC", "STSong", serif',
      },
    ]);

    const normalized = normalizeFontFamilyStack(
      '"Noto Serif SC", "Songti SC", "STSong", serif'
    );

    const resolved = resolveFontFamilyOption(normalized);

    expect(resolved.label).toBe('宋体');
  });

  it('应保留项目级字体的内置标记', () => {
    setProjectFontFamilyOptions([
      {
        label: 'Source Sans',
        value: '"Source Sans 3", Arial, sans-serif',
        isBuiltIn: true,
      },
    ]);

    const resolved = resolveFontFamilyOption(
      normalizeFontFamilyStack('"Source Sans 3", Arial, sans-serif')
    );

    expect(resolved.label).toBe('Source Sans');
    expect(resolved.isBuiltIn).toBe(true);
  });
});
