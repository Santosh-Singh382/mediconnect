import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import AuthShell from '../components/AuthShell.jsx'
import { inputClass } from '../lib/formStyles.js'

const ROLE_OPTIONS = [
  { value: 'PATIENT', label: 'Patient' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'PHARMACY', label: 'Pharmacy' },
]

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'PATIENT',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const errors = {}
    if (!form.name.trim()) errors.name = 'Full name is required.'
    if (!form.email.trim()) errors.email = 'Email is required.'
    if (!form.password) errors.password = 'Password is required.'
    else if (form.password.length < 8)
      errors.password = 'Password must be at least 8 characters.'

    setFieldErrors(errors)
    setApiError(null)
    if (Object.keys(errors).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role,
      })
      navigate('/login', {
        replace: true,
        state: {
          registrationComplete: true,
          registeredEmail: form.email.trim(),
        },
      })
    } catch (error) {
      setApiError(getApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="Join MediConnect as a patient, doctor, or pharmacy."
    >
      {apiError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {apiError}
        </div>
      ) : null}

      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</span>
        <div className="h-1 flex-1 rounded-full bg-blue-600" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">2</span>
        <div className="h-1 flex-1 rounded-full bg-slate-100" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-400">3</span>
      </div>
      <p className="mb-5 text-xs font-semibold text-slate-500">Create your secure account</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-semibold text-slate-800"
          >
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            className={inputClass}
          />
          {fieldErrors.name ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="register-email"
            className="block text-sm font-semibold text-slate-800"
          >
            Email
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            className={inputClass}
          />
          {fieldErrors.email ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-semibold text-slate-800"
          >
            Phone (optional)
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder="9876543210"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="register-password"
            className="block text-sm font-semibold text-slate-800"
          >
            Password
          </label>
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            className={`${inputClass} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="relative float-right -mt-9 mr-4 text-xs font-bold text-slate-500 hover:text-blue-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
          <p className="mt-1 text-xs text-slate-500">
            At least 8 characters.
          </p>
          {fieldErrors.password ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="role"
            className="block text-sm font-semibold text-slate-800"
          >
            I am a
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((option) => {
              const selected = form.role === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update('role', option.value)}
                  className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300 hover:bg-white'
                  }`}
                  aria-pressed={selected}
                >
                  <span className="mb-1 block text-base">{option.value === 'PATIENT' ? '◉' : option.value === 'DOCTOR' ? '✚' : '▣'}</span>
                  {option.label}
                </button>
              )
            })}
          </div>
          <input type="hidden" name="role" value={form.role} />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}