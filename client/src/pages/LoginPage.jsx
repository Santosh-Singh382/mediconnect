import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor } from '../lib/homePath.js'
import AuthShell from '../components/AuthShell.jsx'
import { inputClass } from '../lib/formStyles.js'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to={homePathFor(user)} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const errors = {}
    if (!email.trim()) errors.email = 'Email is required.'
    if (!password) errors.password = 'Password is required.'

    setFieldErrors(errors)
    setApiError(null)
    if (Object.keys(errors).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      const sessionUser = await login(email.trim(), password)
      navigate(
        location.state?.from?.pathname || homePathFor(sessionUser),
        { replace: true },
      )
    } catch (error) {
      setApiError(
        error?.response?.data?.message === 'Invalid email or password'
          ? 'The email or password you entered is incorrect.'
          : getApiErrorMessage(error),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your MediConnect account."
    >
      {apiError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {apiError}
        </div>
      ) : null}

      {location.state?.registrationComplete ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          Account created successfully. Sign in to continue
          {location.state.registeredEmail
            ? ` as ${location.state.registeredEmail}.`
            : '.'}
        </div>
      ) : null}

      <div className="mb-6 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">✓</span>
          Secure sign in
        </span>
        <span className="text-blue-600">256-bit encrypted</span>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-slate-800"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
          {fieldErrors.email ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-slate-800"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 transition hover:text-blue-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {fieldErrors.password ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-7 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5 text-center text-[11px] font-semibold text-slate-400">
        <span>✓ Verified doctors</span>
        <span>✓ Private records</span>
        <span>✓ Easy bookings</span>
      </div>

      <p className="mt-7 text-center text-sm text-slate-600">
        New to MediConnect?{' '}
        <Link
          to="/register"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}