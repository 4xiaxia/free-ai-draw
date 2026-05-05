import { ToolButton } from '../../components/tool-button';
import { AutodrawBrushIcon } from '../../components/icons';
import { useI18n } from '../../i18n';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import '../styles/autodraw-toolbar-button.scss';

export const AutodrawToolbarButton = () => {
  const { t } = useI18n();
  const { appState, setAppState } = useDrawnix();
  const label = t('extraTools.autodraw') || 'Autodraw';
  const isOpen = appState.openDialogType === DialogType.autodraw;

  return (
    <ToolButton
      type="icon"
      visible={true}
      className="autodraw-toolbar-button"
      selected={isOpen}
      icon={AutodrawBrushIcon}
      title={label}
      aria-label={label}
      showAriaLabel={true}
      onClick={() => {
        setAppState({
          ...appState,
          openDialogType: isOpen ? null : DialogType.autodraw,
        });
      }}
    />
  );
};
