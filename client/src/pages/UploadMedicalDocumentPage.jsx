import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import { uploadMedicalDocument } from '../lib/medicalDocumentApi.js'
import { getMedicalRecords } from '../lib/medicalRecordApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import { inputClass } from '../lib/formStyles.js'
import {
  DOCUMENT_TYPE_OPTIONS,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  fileExtension,
} from '../lib/medicalDocumentFormat.js'

function fieldError(errors, field) {
  const message = errors[field]
  return message ? (
    <p className="mt-1 text-xs text-red-600">{message}</p>
  ) : null
}

export default function UploadMedicalDocumentPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [records, setRecords] = useState([])
  const [recordsError, setRecordsError] = useState(null)

  const [form, setForm] = useState({
    title: '',
    documentType: 'LAB_REPORT',
    recordId: '',
    description: '',
  })
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    getMedicalRecords({ limit: 50 })
      .then((response) => {
        setRecords(response.data.data.records || [])
      })
      .catch(() => {
        setRecordsError('Unable to load your medical records.')
      })
  }, [])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validateFile(candidate) {
    if (!candidate) return 'Please choose a file to upload'
    const extension = fileExtension(candidate.name)
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      return 'This file type is not supported. Please upload a PDF, JPG, JPEG, or PNG file.'
    }
    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      return `File size must be ${MAX_FILE_SIZE_MB} MB or less`
    }
    return null
  }

  function selectFile(candidate) {
    const message = validateFile(candidate)
    setErrors((prev) => {
      const next = { ...prev }
      if (message) next.file = message
      else delete next.file
      return next
    })
    if (message) {
      setFile(null)
      return
    }
    setFile(candidate)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragActive(false)
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) selectFile(dropped)
  }

  function handleDragOver(event) {
    event.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    setDragActive(false)
  }

  function handleChooseClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const chosen = event.target.files?.[0]
    if (chosen) selectFile(chosen)
    event.target.value = ''
  }

  function clearFile() {
    setFile(null)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.file
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const nextErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Title is required'
    if (!form.documentType) nextErrors.documentType = 'Document type is required'
    const fileMessage = validateFile(file)
    if (fileMessage) nextErrors.file = fileMessage

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    setGeneralError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', form.documentType)
    formData.append('title', form.title.trim())
    if (form.recordId) formData.append('recordId', form.recordId)
    if (form.description.trim()) formData.append('description', form.description.trim())

    uploadMedicalDocument(formData)
      .then((response) => {
        setCreated(response.data.data.document)
      })
      .catch((error) => {
        const data = error?.response?.data
        const fieldErrors = {}
        if (Array.isArray(data?.details)) {
          for (const detail of data.details) {
            fieldErrors[detail.field] = detail.message
          }
        }
        setErrors(fieldErrors)
        setGeneralError(
          getApiErrorMessage(error, "We couldn't upload this document. Please try again."),
        )
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  if (created) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <h1 className="text-xl font-semibold text-green-900">
              Document uploaded
            </h1>
            <p className="mt-2 text-sm text-green-800">
              &ldquo;{created.title}&rdquo; has been added to your medical
              documents and is private to you.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/medical-records"
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Back to medical records
              </Link>
              <button
                type="button"
                onClick={() => {
                  setCreated(null)
                  setForm({ title: '', documentType: 'LAB_REPORT', recordId: '', description: '' })
                  clearFile()
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Upload another
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/medical-records"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to medical records
        </Link>

        <section className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Upload medical document
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Add a lab report, scan, prescription, or other medical document to
            your private record. Only you and doctors treating you can see it.
          </p>
        </section>

        {generalError && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {generalError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Document details</h2>

            <label
              htmlFor="title"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Title
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              className={inputClass}
              maxLength={200}
              placeholder="e.g. CBC blood test report"
            />
            {fieldError(errors, 'title')}

            <label
              htmlFor="documentType"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Document type
            </label>
            <select
              id="documentType"
              value={form.documentType}
              onChange={(event) => updateField('documentType', event.target.value)}
              className={inputClass}
            >
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(errors, 'documentType')}

            <label
              htmlFor="recordId"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Related medical record (optional)
            </label>
            <select
              id="recordId"
              value={form.recordId}
              onChange={(event) => updateField('recordId', event.target.value)}
              className={inputClass}
            >
              <option value="">None</option>
              {records.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.title}
                </option>
              ))}
            </select>
            {recordsError ? (
              <p className="mt-1 text-xs text-amber-700">{recordsError}</p>
            ) : null}
            {fieldError(errors, 'recordId')}

            <label
              htmlFor="description"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Description (optional)
            </label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              className={inputClass}
              maxLength={1000}
              placeholder="Add any context about this document"
            />
            {fieldError(errors, 'description')}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Upload file</h2>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`mt-4 rounded-lg border-2 border-dashed p-8 text-center transition ${
                dragActive
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-300 bg-slate-50'
              }`}
            >
              <svg
                className="mx-auto h-10 w-10 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                />
              </svg>
              <p className="mt-3 text-sm text-slate-600">
                Drag &amp; drop your file here, or
              </p>
              <button
                type="button"
                onClick={handleChooseClick}
                className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Choose file
              </button>
              <p className="mt-3 text-xs text-slate-500">
                Accepted: PDF, JPG, JPEG, PNG &middot; Maximum size: {MAX_FILE_SIZE_MB} MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {fieldError(errors, 'file')}

            {file && (
              <div className="mt-4 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {file.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  className="ml-4 shrink-0 text-sm font-medium text-red-600 transition hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Uploading…' : 'Upload document'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/medical-records')}
              className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
