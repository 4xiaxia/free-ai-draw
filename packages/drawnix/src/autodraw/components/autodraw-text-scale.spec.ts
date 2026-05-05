import { scaleTextMetricBag } from './autodraw-text-scale';

describe('scaleTextMetricBag', () => {
  const scaleStyleMetric = (value: unknown) => {
    if (typeof value === 'number') {
      return Math.round(value * 50) / 100;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? String(Math.round(parsed * 50) / 100) : value;
    }
    return value;
  };

  it('scales font-size, line-height and letter-spacing in textProperties-like bags', () => {
    const result = scaleTextMetricBag(
      {
        fontSize: 80,
        'font-size': '80',
        lineHeight: 96,
        'line-height': '96',
        letterSpacing: 4,
        'letter-spacing': '4',
        'font-family': 'Georgia, serif',
      },
      scaleStyleMetric
    ) as Record<string, unknown>;

    expect(result).toEqual(
      expect.objectContaining({
        fontSize: 40,
        'font-size': '40',
        lineHeight: 48,
        'line-height': '48',
        letterSpacing: 2,
        'letter-spacing': '2',
        'font-family': 'Georgia, serif',
      })
    );
  });
});
