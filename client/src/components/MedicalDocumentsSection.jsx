import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingState from './LoadingState.jsx'
import ErrorState from './ErrorState.jsx'
import {
  listMedicalDocuments,
  downloadMedicalDocument,
  deleteMedicalDocument,
} from '../lib/medicalDocumentApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  documentTypeLabel,
  documentTypeClass,
  formatDocumentDate,
  formatFileSize,
} from '../lib/medicalDocumentFormat.js'

// Opens an authenticated file in a new tab by fetching it as a Blob. The JWT
// stays in the request header, never in the URL.
async function openInNewTab(documentId) {
  const blob = await downloadMedicalDocument(documentId)
  const url = URL.createObjectURL(blob.data)
  window.open(url, '_blank', 'noopener')
  // Give the browser a moment to start the request before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

async function triggerDownload(document) {
  const blob = await downloadMedicalDocument(document.id)
  const url = URL.createObjectURL(blob.data)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = document.originalName || 'medical-document'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function MedicalDocumentsSection() {
  const [state, setState] = useState({ loading: true, error: null, documents: [] })
  const [notice, setNotice] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    listMedicalDocuments({ limit: 50 })
      .then((response) => {
        setState({
          loading: false,
          error: null,
          documents: response.data.data.documents || [],
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load your documents right now.'),
          documents: [],
        })
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleView(document) {
    setNotice(null)
    openInNewTab(document.id).catch(() => {
      setNotice({
        kind: 'error',
        message: 'Unable to open this document. Please try again.',
      })
    })
  }

  function handleDownload(document) {
    setNotice(null)
    setBusyId(document.id)
    triggerDownload(document)
      .then(() => {
        setNotice({ kind: 'success', message: 'Your download has started.' })
      })
      .catch(() => {
        setNotice({
          kind: 'error',
          message: 'Unable to download this document. Please try again.',
        })
      })
      .finally(() => setBusyId(null))
  }

  function handleDelete(document) {
    setNotice(null)
    setBusyId(document.id)
    deleteMedicalDocument(document.id)
      .then(() => {
        setConfirmId(null)
        setNotice({
          kind: 'success',
          message: `“${document.title}” has been deleted.`,
        })
        load()
      })
      .catch((error) => {
        setNotice({
          kind: 'error',
          message: getApiErrorMessage(
            error,
            'Unable to delete this document. Please try again.',
          ),
        })
      })
      .finally(() => setBusyId(null))
  }

  if (state.loading) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
        <div className="mt-4">
          <LoadingState label="Loading documents…" />
        </div>
      </section>
    )
  }

  if (state.error) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
        <div className="mt-4">
          <ErrorState message={state.error} onRetry={load} />
        </div>
      </section>
    )
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
        <Link
          to="/medical-records/upload"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          + Upload medical document
        </Link>
      </div>

      {notice && (
        <p
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            notice.kind === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.message}
        </p>
      )}

      {state.documents.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No documents yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Upload lab reports, scans, prescriptions, or other medical files to
            keep them in one private place.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {state.documents.map((document) => (
            <li
              key={document.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${documentTypeClass(document.documentType)}`}
                    >
                      {documentTypeLabel(document.documentType)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDocumentDate(document.uploadedAt)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatFileSize(document.size)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">
                    {document.title}
                  </h3>
                  {document.description ? (
                    <p className="mt-0.5 text-sm text-slate-600">
                      {document.description}
                    </p>
                  ) : null}
                  {document.record ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Linked to a medical record
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleView(document)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(document)}
                    disabled={busyId === document.id}
                    className="rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(document.id)}
                    disabled={busyId === document.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {confirmId === document.id && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">
                    Delete this medical document?
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    This action cannot be undone.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(document)}
                      disabled={busyId === document.id}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === document.id ? 'Deleting…' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={busyId === document.id}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
