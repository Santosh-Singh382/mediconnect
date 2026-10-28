import { useId } from 'react'

export default function Input({
  type = 'text',
  label,
  helperText,
  error,
  id,
  name,
  required = false,
  disabled = false,
  leadingIcon,
  className = '',
  containerClassName = '',
  ...props
}) {
  const generatedId = useId()
  const inputId = id || `input-${generatedId}`
  const messageId = `${inputId}-message`

  return (
    <div className={containerClassName}>
      {label ? (
        <label
          htmlFor={inputId}
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
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={inputId}
          name={name}
          type={type}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
            leadingIcon ? 'pl-10' : ''
          } ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
              : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
          } ${className}`}
          {...props}
        />
      </div>
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
