import { useId } from 'react'

export default function Select({
  label,
  error,
  helperText,
  disabled = false,
  required = false,
  placeholder,
  value,
  onChange,
  options = [],
  id,
  name,
  className = '',
  containerClassName = '',
  ...props
}) {
  const generatedId = useId()
  const selectId = id || `select-${generatedId}`
  const messageId = `${selectId}-message`
  const hasEmptyOption = options.some((option) => option.value === '')

  return (
    <div className={containerClassName}>
      {label ? (
        <label
          htmlFor={selectId}
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
        <select
          id={selectId}
          name={name}
          value={value}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          onChange={onChange}
          className={`h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm text-slate-900 shadow-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
              : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
          } ${className}`}
          {...props}
        >
          {placeholder && !hasEmptyOption ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
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
