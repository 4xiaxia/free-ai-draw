import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArrowAnimationButton } from './arrow-animation-button';

const mockSetProperty = jest.fn();

jest.mock('../../tool-button', () => ({
  ToolButton: ({
    onClick,
    title,
    className,
    selected,
    'aria-label': ariaLabel,
  }: {
    onClick?: () => void;
    title?: string;
    className?: string;
    selected?: boolean;
    'aria-label': string;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      className={className}
      data-selected={selected ? 'true' : 'false'}
      onClick={onClick}
    >
      arrow-animation-button
    </button>
  ),
}));

jest.mock('../../icons', () => ({
  ArrowAnimationIcon: null,
}));

jest.mock('@plait/common', () => ({
  PropertyTransforms: {
    setProperty: (...args: unknown[]) => mockSetProperty(...args),
  },
}));

jest.mock('@plait/draw', () => ({
  ArrowLineComponent: class {},
  getMemorizeKey: () => 'arrow',
  PlaitDrawElement: {
    isArrowLine: (element: any) => element?.type === 'arrow-line',
  },
}));

jest.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('ArrowAnimationButton', () => {
  beforeEach(() => {
    mockSetProperty.mockReset();
  });

  it('点击后应写入箭头动画属性', () => {
    render(<ArrowAnimationButton board={{} as any} animation={undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'line.enableAnimation' }));

    expect(mockSetProperty).toHaveBeenCalledWith(
      expect.anything(),
      { drawnixArrowAnimation: 'flow' },
      expect.objectContaining({
        getMemorizeKey: expect.any(Function),
        match: expect.any(Function),
      })
    );
  });

  it('动画已开启时点击应清除动画属性', () => {
    render(<ArrowAnimationButton board={{} as any} animation={'flow'} />);

    const button = screen.getByRole('button', { name: 'line.disableAnimation' });
    expect(button.getAttribute('data-selected')).toBe('true');
    expect(button.className).toContain('popup-arrow-animation-button--enabled');

    fireEvent.click(button);

    expect(mockSetProperty).toHaveBeenCalledWith(
      expect.anything(),
      { drawnixArrowAnimation: undefined },
      expect.objectContaining({
        getMemorizeKey: expect.any(Function),
        match: expect.any(Function),
      })
    );
  });
});
