import { useState } from 'react';
import { Check, NoColorIcon } from './icons';
import './color-picker.scss';
import { splitRows } from '../utils/common';
import {
  hexAlphaToOpacity,
  isDefaultStroke,
  isNoColor,
  removeHexAlpha,
} from '../utils/color';
import React from 'react';
import { SizeSlider } from './size-slider';
import {
  DEFAULT_COLOR,
  isNullOrUndefined,
  MERGING,
  PlaitHistoryBoard,
} from '@plait/core';
import {
  CLASSIC_COLORS,
  NO_COLOR,
  TRANSPARENT,
  WHITE,
} from '../constants/color';
import { useBoard } from '@plait-board/react-board';
import { Translations, useI18n } from '../i18n';

const ROWS_CLASSIC_COLORS = splitRows(CLASSIC_COLORS, 4);

export type ColorPickerProps = {
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  currentColor?: string;
  label?: string;
};

export const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(
  (props, ref) => {
    const board = useBoard();
    const { t } = useI18n();
    const { currentColor, label, onColorChange, onOpacityChange } = props;
    const [selectedColor, setSelectedColor] = useState(
      (currentColor && removeHexAlpha(currentColor)) ||
        ROWS_CLASSIC_COLORS[0][0].value
    );
    const [opacity, setOpacity] = useState(() => {
      const _opacity = currentColor && hexAlphaToOpacity(currentColor);
      return (!isNullOrUndefined(_opacity) ? _opacity : 100) as number;
    });
    const previewColor = isNoColor(selectedColor) ? TRANSPARENT : selectedColor;

    return (
      <div className="color-picker" ref={ref}>
        {label && (
          <div className="color-picker__header">
            <span className="color-picker__title">{label}</span>
            <span
              className="color-picker__preview"
              style={{ backgroundColor: previewColor }}
              aria-hidden="true"
            >
              {isNoColor(selectedColor) && NoColorIcon}
            </span>
          </div>
        )}
        <div className="color-picker__palette" role="group" aria-label={label}>
          {ROWS_CLASSIC_COLORS.map((colors, index) => (
            <div className="color-picker__row" key={index}>
              {colors.map((color) => {
                return (
                  <button
                    key={color.value}
                    type="button"
                    className={`color-select-item ${
                      selectedColor === color.value ? 'active' : ''
                    } ${isNoColor(color.value) ? 'no-color' : ''}`}
                    style={{
                      backgroundColor: isNoColor(color.value)
                        ? TRANSPARENT
                        : color.value,
                      color: isDefaultStroke(color.value)
                        ? WHITE
                        : DEFAULT_COLOR,
                    }}
                    onClick={() => {
                      setSelectedColor(color.value);
                      if (color.value === NO_COLOR) {
                        setOpacity(100);
                      }
                      onColorChange(color.value);
                    }}
                    title={t(
                      (color.name || 'color.unknown') as keyof Translations
                    )}
                    aria-label={t(
                      (color.name || 'color.unknown') as keyof Translations
                    )}
                  >
                    {isNoColor(color.value) && NoColorIcon}
                    {selectedColor === color.value && Check}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="color-picker__opacity">
          <div className="color-picker__opacity-header">
            <span>{t('popupToolbar.opacity')}</span>
            <span>{opacity}%</span>
          </div>
          <SizeSlider
            title={t('popupToolbar.opacity')}
            step={5}
            defaultValue={opacity}
            onChange={(value) => {
              setOpacity(value);
              onOpacityChange(value);
            }}
            beforeStart={() => {
              MERGING.set(board, true);
              PlaitHistoryBoard.setSplittingOnce(board, true);
            }}
            afterEnd={() => {
              MERGING.set(board, false);
            }}
            disabled={isNoColor(selectedColor)}
          ></SizeSlider>
        </div>
      </div>
    );
  }
);
