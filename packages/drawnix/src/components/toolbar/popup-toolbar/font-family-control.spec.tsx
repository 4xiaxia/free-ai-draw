import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PopupFontFamilyControl } from './font-family-control';
import { setProjectFontFamilyOptions } from '../../../constants/font';

const mockSetTextFontFamily = jest.fn();
const mockBoard = {} as any;

jest.mock('@plait/core', () => ({
  PlaitBoard: {
    getBoardContainer: () => globalThis.document.body,
  },
}));

jest.mock('../../../transforms/property', () => ({
  setTextFontFamily: (...args: unknown[]) => mockSetTextFontFamily(...args),
}));

jest.mock('../../select/select', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const SelectContext = ReactModule.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    onValueChange?: (value: string) => void;
  } | null>(null);

  const useSelectContext = () => {
    const context = ReactModule.useContext(SelectContext);
    if (!context) {
      throw new Error('missing select context');
    }
    return context;
  };

  return {
    Select: {
      Root: ({
        children,
        open,
        onOpenChange,
        onValueChange,
      }: {
        children: React.ReactNode;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
        onValueChange?: (value: string) => void;
      }) => {
        const [internalOpen, setInternalOpen] = ReactModule.useState(
          Boolean(open)
        );
        const actualOpen = open ?? internalOpen;
        const setOpen = (nextOpen: boolean) => {
          setInternalOpen(nextOpen);
          onOpenChange?.(nextOpen);
        };
        return (
          <SelectContext.Provider
            value={{ open: actualOpen, setOpen, onValueChange }}
          >
            {children}
          </SelectContext.Provider>
        );
      },
      Trigger: ({
        children,
        asChild,
      }: {
        children: React.ReactElement;
        asChild?: boolean;
      }) => {
        const context = useSelectContext();
        if (asChild && ReactModule.isValidElement(children)) {
          return ReactModule.cloneElement(children, {
            onClick: () => context.setOpen(!context.open),
            role: 'combobox',
            'data-state': context.open ? 'open' : 'closed',
          });
        }
        return children;
      },
      Content: ({
        children,
        className,
      }: {
        children: React.ReactNode;
        className?: string;
      }) => {
        const context = useSelectContext();
        return context.open ? (
          <div role="listbox" className={className}>
            {children}
          </div>
        ) : null;
      },
      Item: ({
        children,
        value,
        textValue,
      }: {
        children: React.ReactNode;
        value: string;
        textValue?: string;
      }) => {
        const context = useSelectContext();
        return (
          <button
            type="button"
            role="option"
            aria-label={textValue || value}
            onClick={() => {
              context.onValueChange?.(value);
              context.setOpen(false);
            }}
          >
            {children}
          </button>
        );
      },
    },
  };
});

describe('PopupFontFamilyControl', () => {
  beforeEach(() => {
    mockSetTextFontFamily.mockReset();
    setProjectFontFamilyOptions(undefined);
  });

  it('选择字体选项时应触发一次字体更新', () => {
    render(
      <PopupFontFamilyControl
        board={mockBoard}
        currentFontFamily={'Arial, sans-serif'}
        title={'字体'}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '字体' }));
    fireEvent.click(screen.getByRole('option', { name: 'Georgia' }));

    expect(mockSetTextFontFamily).toHaveBeenCalledTimes(1);
    expect(mockSetTextFontFamily).toHaveBeenCalledWith(
      mockBoard,
      'Georgia, serif'
    );
  });

  it('内置字体应显示可见标识', () => {
    setProjectFontFamilyOptions([
      {
        label: '思源黑体',
        value: '"Noto Sans SC", Arial, sans-serif',
        isBuiltIn: true,
      },
      {
        label: 'Source Sans',
        value: '"Source Sans 3", Arial, sans-serif',
        isBuiltIn: true,
      },
      {
        label: '宋体',
        value: '"Songti SC", serif',
      },
    ]);

    render(
      <PopupFontFamilyControl
        board={mockBoard}
        currentFontFamily={'"Noto Sans SC", Arial, sans-serif'}
        title={'字体'}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '字体' }));

    expect(
      globalThis.document.querySelector('.popup-font-family-option__badge-dot')
    ).toBeTruthy();
    expect(
      globalThis.document.querySelector('.popup-font-family-menu')
    ).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'Source Sans' }).textContent
    ).toBe('Source Sans');
    expect(
      screen.getByRole('option', { name: '宋体' }).textContent
    ).toBe('宋体');
    expect(
      globalThis.document.querySelector('.popup-font-family-option__preview')
    ).toBeFalsy();
    expect(
      screen.getByRole('option', { name: 'Source Sans' }).textContent
    ).not.toContain('Aa');
    expect(
      screen.getByRole('option', { name: '宋体' }).textContent
    ).not.toContain('字');
    expect(
      screen.getByRole('option', { name: '宋体' }).querySelector(
        '.popup-font-family-option__badge-dot'
      )
    ).toBeFalsy();
    expect(
      screen.getByRole('option', { name: 'Source Sans' }).querySelector(
        '.popup-font-family-option__badge-dot'
      )
    ).toBeTruthy();
  });
});
