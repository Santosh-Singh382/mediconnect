import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getDoctors } from '../lib/doctorsApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'

const DAY_OPTIONS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const DAY_SHORT = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
}

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'experience_desc', label: 'Experience (high to low)' },
  { value: 'experience_asc', label: 'Experience (low to high)' },
  { value: 'fee_desc', label: 'Fee (high to low)' },
  { value: 'fee_asc', label: 'Fee (low to high)' },
]

function emptyDraft() {
  return {
    q: '',
    specialization: '',
    minExperience: '',
    maxExperience: '',
    minFee: '',
    maxFee: '',
    language: '',
    day: '',
  }
}

function draftFromParams(params) {
  return {
    q: params.get('q') || '',
    specialization: params.get('specialization') || '',
    minExperience: params.get('minExperience') || '',
    maxExperience: params.get('maxExperience') || '',
    minFee: params.get('minFee') || '',
    maxFee: params.get('maxFee') || '',
    language: params.get('language') || '',
    day: params.get('day') || '',
  }
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function avatarColor(id) {
  const palette = [
    'bg-blue-100 text-blue-700',
    'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700',
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
  ]
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return palette[hash % palette.length]
}

function AvailabilitySummary({ availability }) {
  if (!availability || availability.length === 0) {
    return <p className="text-sm text-slate-400">Availability not set</p>
  }
  const labels = availability
    .map((entry) => DAY_SHORT[entry.dayOfWeek])
    .filter(Boolean)
  return (
    <p className="text-sm text-slate-600">
      <span className="font-medium">Available: </span>
      {labels.join(' · ')}
    </p>
  )
}

export default function DoctorSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState(() => draftFromParams(searchParams))
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })

  const load = useCallback(() => {
    getDoctors(Object.fromEntries(searchParams.entries()))
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load doctors right now.'),
          data: null,
        })
      })
  }, [searchParams])

  useEffect(() => {
    load()
  }, [load])

  function beginLoading() {
    setState({ loading: true, error: null, data: null })
  }

  function retry() {
    beginLoading()
    load()
  }

  function handleSearch(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(draft)) {
      const trimmed = String(value).trim()
      if (trimmed !== '') next.set(key, trimmed)
    }
    const sort = searchParams.get('sort')
    if (sort) next.set('sort', sort)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function handleClear() {
    setDraft(emptyDraft())
    beginLoading()
    setSearchParams({})
  }

  function changeSort(sort) {
    const next = new URLSearchParams(searchParams)
    next.set('sort', sort)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    beginLoading()
    setSearchParams(next)
  }

  function hasFilters() {
    return Object.values(draftFromParams(searchParams)).some((value) => value)
  }

  const currentSort = searchParams.get('sort') || 'name_asc'
  const currentPage = Number(searchParams.get('page')) || 1
  const { doctors, pagination } = state.data || { doctors: [], pagination: null }
  const { total, totalPages } = pagination || { total: 0, totalPages: 0 }
  const activeFilterCount = Object.values(draftFromParams(searchParams)).filter(Boolean).length

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-teal-500/15 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                MediConnect care network
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Find care that fits you
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Connect with approved specialists, compare experience and fees,
                and book a consultation with confidence.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-3 gap-2">
              {[
                ['01', 'Approved doctors'],
                ['02', 'Flexible filters'],
                ['03', 'Easy booking'],
              ].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
                  <p className="text-lg font-black text-white">{number}</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-300">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSearch}
          className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Search specialists</h2>
              <p className="mt-1 text-xs text-slate-500">Filter by expertise, experience, consultation fee, language, or availability.</p>
            </div>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
              </span>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="search"
                className="block text-sm font-medium text-slate-700"
              >
                Search
              </label>
              <input
                id="search"
                type="search"
                value={draft.q}
                onChange={(event) => setDraft((d) => ({ ...d, q: event.target.value }))}
                placeholder="Search doctor, specialization, or clinic"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="specialization"
                className="block text-sm font-medium text-slate-700"
              >
                Specialization
              </label>
              <input
                id="specialization"
                type="text"
                value={draft.specialization}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, specialization: event.target.value }))
                }
                placeholder="e.g. Cardiologist"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-slate-700"
              >
                Language
              </label>
              <input
                id="language"
                type="text"
                value={draft.language}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, language: event.target.value }))
                }
                placeholder="e.g. Hindi"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="minExperience"
                className="block text-sm font-medium text-slate-700"
              >
                Min experience (years)
              </label>
              <input
                id="minExperience"
                type="number"
                min="0"
                max="80"
                value={draft.minExperience}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, minExperience: event.target.value }))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="maxExperience"
                className="block text-sm font-medium text-slate-700"
              >
                Max experience (years)
              </label>
              <input
                id="maxExperience"
                type="number"
                min="0"
                max="80"
                value={draft.maxExperience}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, maxExperience: event.target.value }))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="minFee"
                className="block text-sm font-medium text-slate-700"
              >
                Min fee (₹)
              </label>
              <input
                id="minFee"
                type="number"
                min="0"
                value={draft.minFee}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, minFee: event.target.value }))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="maxFee"
                className="block text-sm font-medium text-slate-700"
              >
                Max fee (₹)
              </label>
              <input
                id="maxFee"
                type="number"
                min="0"
                value={draft.maxFee}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, maxFee: event.target.value }))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="day"
                className="block text-sm font-medium text-slate-700"
              >
                Available day
              </label>
              <select
                id="day"
                value={draft.day}
                onChange={(event) => setDraft((d) => ({ ...d, day: event.target.value }))}
                className={inputClass}
              >
                <option value="">Any day</option>
                {DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {day.charAt(0) + day.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                Clear filters
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="sort"
                className="text-sm font-medium text-slate-700"
              >
                Sort by
              </label>
              <select
                id="sort"
                value={currentSort}
                onChange={(event) => changeSort(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading doctors…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState
              message={state.error}
              onRetry={retry}
            />
          </div>
        ) : doctors.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              No doctors found
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {hasFilters()
                ? 'Try adjusting your filters or clearing them to see more results.'
                : 'No approved doctors match your search. Try again later.'}
            </p>
            {hasFilters() ? (
              <button
                type="button"
                onClick={handleClear}
                className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Care specialists</p>
              <p className="mt-1 text-sm text-slate-500">
                {total} {total === 1 ? 'doctor' : 'doctors'} found
              </p>
            </div>
            <section className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((doctor) => (
                <article
                  key={doctor.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/60"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/60 px-5 py-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black shadow-sm ring-1 ring-white ${avatarColor(doctor.id)}`} aria-hidden="true">
                      {initials(doctor.name)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Verified specialist
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {doctor.name}
                      </h2>
                      <p className="text-sm font-bold text-brand-700">
                        {doctor.specialization}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {doctor.qualification} ·{' '}
                        {doctor.experience !== null
                          ? `${doctor.experience} years experience`
                          : 'Experience not listed'}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="rounded-xl bg-blue-50/70 p-3">
                      <dt className="text-xs font-bold uppercase tracking-wide text-blue-700">Consultation fee</dt>
                      <dd className="mt-1 text-lg font-black text-slate-950">
                        {doctor.consultationFee !== null
                          ? `₹${doctor.consultationFee}`
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-900">Languages</dt>
                      <dd className="text-slate-600">
                        {doctor.languages.length > 0
                          ? doctor.languages.join(', ')
                          : 'Not listed'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-900">Clinic</dt>
                      <dd className="text-slate-600">
                        {doctor.clinicName || 'Not listed'}
                      </dd>
                    </div>
                    <AvailabilitySummary availability={doctor.availability} />
                  </dl>

                  <div className="mt-auto pt-4">
                    <Link
                      to={`/doctors/${doctor.id}`}
                      className="inline-block w-full rounded-xl bg-brand-600 px-3 py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-700"
                    >
                      View profile
                    </Link>
                  </div>
                  </div>
                </article>
              ))}
            </section>

            {totalPages > 1 && (
              <nav
                className="mt-8 flex flex-wrap items-center justify-between gap-3"
                aria-label="Pagination"
              >
                <p className="text-sm text-slate-500">
                  Showing page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  )
}