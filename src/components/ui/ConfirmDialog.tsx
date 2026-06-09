'use client'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmLabel?: string
  loading?: boolean
  danger?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  loading,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} fullWidth onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
