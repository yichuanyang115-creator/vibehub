import { Modal } from './Modal'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  isDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = '取消',
  isDanger = true,
  onConfirm,
  onCancel
}: ConfirmModalProps): React.JSX.Element {
  const footer = (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-md py-sm text-sm font-medium text-text-secondary"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={`rounded-md px-md py-sm text-sm font-medium text-white ${
          isDanger ? 'bg-danger' : 'bg-primary'
        }`}
      >
        {confirmLabel}
      </button>
    </>
  )

  return (
    <Modal title={title} onClose={onCancel} footer={footer}>
      <p className="text-sm text-text-secondary">{message}</p>
    </Modal>
  )
}
