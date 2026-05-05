import { render, screen } from '@testing-library/react';

import { Text, toCssLength } from './text';

jest.mock('@plait/text-plugins', () => ({
  isUrl: () => false,
  LinkEditor: {
    wrapLink: jest.fn(),
  },
}));

describe('Text', () => {
  it('renders imported text successfully', () => {
    const text = {
      type: 'paragraph',
      children: [
        {
          text: 'Imported title',
          color: '#000000',
          'font-size': '31.143',
          'line-height': '31.143',
          'letter-spacing': '1.25',
          'font-family': 'Georgia, serif',
        },
      ],
    } as any;

    render(<Text text={text} readonly board={{} as any} />);
    expect(screen.getByText('Imported title')).toBeTruthy();
  });

  it('converts raw numeric metrics to css lengths', () => {
    expect(toCssLength('31.143')).toBe('31.143px');
    expect(toCssLength(80)).toBe('80px');
    expect(toCssLength('1.25')).toBe('1.25px');
    expect(toCssLength('120%')).toBe('120%');
    expect(toCssLength('')).toBeUndefined();
  });
});
