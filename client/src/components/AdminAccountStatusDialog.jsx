import Modal from './Modal.jsx'
import Button from './Button.jsx'
import Alert from './Alert.jsx'

export default function AdminAccountStatusDialog({
  subject = 'User',
  name,
  isActive = true,
  submitting = false,
  error,
  onClose,
  onConfirm,
}) {
  const deactivating = isActive

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${deactivating ? 'Deactivate' : 'Reactivate'} ${subject} Account`}
      description={
        deactivating
          ? `Deactivate ${name}? The account holder will lose login access immediately. Their role and verification status will not change.`
          : `Reactivate ${name}? The account holder will be able to sign in again with their existing role and verification status.`
      }
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            data-autofocus={deactivating ? true : undefined}
          >
            Cancel
          </Button>
          <Button
            variant={deactivating ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={submitting}
            data-autofocus={deactivating ? undefined : true}
          >
            {deactivating ? 'Deactivate Account' : 'Reactivate Account'}
          </Button>
        </>
      }
    >
      <Alert variant={deactivating ? 'warning' : 'info'}>
        {deactivating
          ? 'Active sessions will no longer be able to perform protected actions, and the account will be blocked from signing in.'
          : 'Existing account information, role, and verification status remain unchanged.'}
      </Alert>

      {error ? (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}
    </Modal>
  )
}
