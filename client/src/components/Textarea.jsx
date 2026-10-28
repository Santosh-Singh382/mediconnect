import { useId } from 'react'

export default function Textarea({
  label,
  error,
  helperText,
  disabled = false,
  required = false,
  id,
  name,
  className = '',
  containerClassName = '',
  rows = 4,
  ...props
}) {
  const generatedId = useId()
  const textareaId = id || `textarea-${generatedId}`
  const messageId = `${textareaId}-message`

  return (
    <div className={containerClassName}>
      {label ? (
        <label
          htmlFor={textareaId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        name={name}
        rows={rows}
        disabled={disabled}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error || helperText ? messageId : undefined}
        className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
            : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={messageId} className="mb-0 mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : helperText ? (
        <p id={messageId} className="mb-0 mt-1.5 text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
