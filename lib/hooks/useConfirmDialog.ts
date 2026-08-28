import { useState, useCallback } from 'react';

interface DialogState {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  thirdLabel?: string;
  onThird?: () => void;
  thirdDestructive?: boolean;
}

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<DialogState>({
    visible: false,
    title: '',
    onConfirm: () => {},
  });

  const showAlert = useCallback((title: string, message?: string) => {
    setDialog({
      visible: true,
      title,
      message,
      confirmLabel: 'OK',
      onConfirm: () => setDialog((prev) => ({ ...prev, visible: false })),
    });
  }, []);

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      options?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean }
    ) => {
      setDialog({
        visible: true,
        title,
        message,
        confirmLabel: options?.confirmLabel,
        cancelLabel: options?.cancelLabel,
        destructive: options?.destructive ?? false,
        onConfirm: () => {
          setDialog((prev) => ({ ...prev, visible: false }));
          onConfirm();
        },
        onCancel: () => setDialog((prev) => ({ ...prev, visible: false })),
      });
    },
    []
  );

  const showThreeOption = useCallback(
    (
      title: string,
      message: string,
      options: {
        cancelLabel: string;
        thirdLabel: string;
        confirmLabel: string;
        onCancel: () => void;
        onThird: () => void;
        onConfirm: () => void;
        thirdDestructive?: boolean;
        destructive?: boolean;
      }
    ) => {
      setDialog({
        visible: true,
        title,
        message,
        cancelLabel: options.cancelLabel,
        thirdLabel: options.thirdLabel,
        confirmLabel: options.confirmLabel,
        thirdDestructive: options.thirdDestructive ?? false,
        destructive: options.destructive ?? false,
        onCancel: () => {
          setDialog((prev) => ({ ...prev, visible: false }));
          options.onCancel();
        },
        onThird: () => {
          setDialog((prev) => ({ ...prev, visible: false }));
          options.onThird();
        },
        onConfirm: () => {
          setDialog((prev) => ({ ...prev, visible: false }));
          options.onConfirm();
        },
      });
    },
    []
  );

  const hideDialog = useCallback(() => {
    setDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  return { dialog, showAlert, showConfirm, showThreeOption, hideDialog };
}
