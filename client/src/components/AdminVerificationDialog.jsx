import { useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import Alert from './Alert.jsx'
import Textarea from './Textarea.jsx'

const SUBJECT_COPY = {
  DOCTOR: { label: 'Doctor', lower: 'doctor' },
  PHARMACY: { label: 'Pharmacy', lower: 'pharmacy' },
}

export default function AdminVerificationDialog({
  subject = 'DOCTOR',
  name,
  action = 'APPROVED',
  submitting = false,
  error,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState('')
  const copy = SUBJECT_COPY[subject] || SUBJECT_COPY.DOCTOR
  const isReject = action === 'REJECTED'
  const canSubmit =
    !submitting && (!isReject || reason.trim().length > 0)

  function handleSubmit() {
    if (!canSubmit) return
    onConfirm(isReject ? reason.trim() : null)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${isReject ? 'Reject' : 'Approve'} ${copy.label} Verification`}
      description={
        isReject
          ? `Provide a reason for rejecting ${name}. The ${copy.lower} will be notified and the profile will remain hidden from the public directory.`
          : `Approve ${name}? The profile will become visible in the public ${copy.lower} directory.`
      }
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant={isReject ? 'danger' : 'success'}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            data-autofocus={isReject ? undefined : true}
          >
            {isReject
              ? `Reject ${copy.label}`
              : `Approve ${copy.label}`}
          </Button>
        </>
      }
    >
      {isReject ? (
        <Textarea
          label="Rejection reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={500}
          placeholder={`Explain why this ${copy.lower} profile is being rejected…`}
          helperText={`${reason.trim().length}/500 characters. This reason is shared with the ${copy.lower}.`}
          data-autofocus
        />
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          Verification grants public visibility. You can change this decision
          later if the profile needs another review.
        </div>
      )}

      {error ? (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}
    </Modal>
  )
}
