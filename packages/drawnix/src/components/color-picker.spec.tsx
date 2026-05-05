import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ColorPicker } from './color-picker';

const mockMergingSet = jest.fn();
const mockSetSplittingOnce = jest.fn();

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => ({}),
}));

jest.mock('@plait/core', () => ({
  DEFAULT_COLOR: '#000000',
  isNullOrUndefined: (value: unknown) => value === null || value === undefined,
  MERGING: {
    set: (...args: unknown[]) => mockMergingSet(...args),
  },
  PlaitHistoryBoard: {
    setSplittingOnce: (...args: unknown[]) => mockSetSplittingOnce(...args),
  },
}));

jest.mock('../utils/common', () => ({
  splitRows: <T,>(items: T[], size: number) =>
    items.reduce<T[][]>((rows, item, index) => {
      if (index % size === 0) {
        rows.push([]);
      }
      rows[rows.length - 1].push(item);
      return rows;
    }, []),
}));

jest.mock('./size-slider', () => ({
  SizeSlider: ({
    title,
    disabled,
    onChange,
  }: {
    title: string;
    disabled?: boolean;
    onChange: (value: number) => void;
  }) => (
    <button
      type="button"
      aria-label={title}
      data-disabled={disabled ? 'true' : 'false'}
      onClick={() => onChange(65)}
    >
      opacity
    </button>
  ),
}));

jest.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('ColorPicker', () => {
  it('renders a labeled color palette and selects a swatch', () => {
    const onColorChange = jest.fn();
    const onOpacityChange = jest.fn();

    render(
      <ColorPicker
        label="填充颜色"
        currentColor="#FF4500"
        onColorChange={onColorChange}
        onOpacityChange={onOpacityChange}
      />
    );

    expect(screen.getByText('填充颜色')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'color.red' }).className
    ).toContain('active');

    fireEvent.click(screen.getByRole('button', { name: 'color.green' }));

    expect(onColorChange).toHaveBeenCalledWith('#2ECC71');
  });

  it('keeps opacity disabled while no color is selected', () => {
    render(
      <ColorPicker
        label="边框"
        onColorChange={jest.fn()}
        onOpacityChange={jest.fn()}
      />
    );

    expect(
      screen
        .getByRole('button', { name: 'popupToolbar.opacity' })
        .getAttribute('data-disabled')
    ).toBe('true');
  });
});
