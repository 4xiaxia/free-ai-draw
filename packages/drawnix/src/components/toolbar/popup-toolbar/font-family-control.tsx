import React, { useMemo, useState } from 'react';
import { PlaitBoard } from '@plait/core';
import { setTextFontFamily } from '../../../transforms/property';
import { Select } from '../../select/select';
import { ChevronDownIcon } from '../../icons';
import {
  getConfiguredFontFamilyOptions,
  resolveFontFamilyOption,
} from '../../../constants/font';

export type PopupFontFamilyControlProps = {
  board: PlaitBoard;
  currentFontFamily?: string;
  title: string;
};

export const PopupFontFamilyControl: React.FC<PopupFontFamilyControlProps> = ({
  board,
  currentFontFamily,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const currentOption = useMemo(
    () => resolveFontFamilyOption(currentFontFamily),
    [currentFontFamily]
  );
  const fontOptions = getConfiguredFontFamilyOptions();
  const currentValue = currentOption.value;
  const currentLabel = currentOption.label;
  const container = PlaitBoard.getBoardContainer(board);

  return (
    <Select.Root
      open={open}
      onOpenChange={setOpen}
      value={currentValue}
      onValueChange={(value) => {
        setTextFontFamily(board, value);
      }}
      placement={'top-start'}
      sideOffset={12}
      hideSelectedIndicator
    >
      <Select.Trigger asChild>
        <button
          type="button"
          className="popup-font-family"
          title={title}
          aria-label={title}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
          }}
        >
          <span
            className="popup-font-family__label"
            style={{ fontFamily: currentValue }}
          >
            {currentLabel}
          </span>
          <span className="popup-font-family__icon" aria-hidden="true">
            {ChevronDownIcon}
          </span>
        </button>
      </Select.Trigger>
      <Select.Content
        className="popup-font-family-menu"
        container={container}
        style={{ minWidth: '13.5rem' }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
        }}
      >
        {fontOptions.map((option) => (
          <Select.Item
            key={option.value}
            value={option.value}
            textValue={option.label}
            className="popup-font-family-option"
          >
            <span className="popup-font-family-option__content">
              <span
                className="popup-font-family-option__name-wrap"
                style={{ fontFamily: option.value }}
              >
                <span className="popup-font-family-option__name">
                  {option.label}
                </span>
                {option.isBuiltIn ? (
                  <span
                    className="popup-font-family-option__badge-dot"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            </span>
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
};
