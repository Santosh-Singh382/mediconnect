import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getMyPharmacy } from '../lib/pharmacyApi.js'
import { getPharmacyOrderSummary } from '../lib/orderApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { PHARMACY_ORDER_SUMMARY_CARDS } from '../lib/orderFormat.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const QUICK_ACTIONS = [
  {
    title: 'Orders',
    description: 'Review incoming orders and update fulfillment status.',
    to: '/pharmacy/orders',
    cta: 'View orders',
  },
  {
    title: 'Inventory',
    description: 'Add medicines and manage stock, pricing, and expiry.',
    to: '/pharmacy/inventory',
  },
  {
    title: 'Pharmacy Profile',
    description: 'Manage your pharmacy and contact details.',
    to: '/pharmacy/profile',
  },
]

const VERIFICATION_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

function VerificationBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        VERIFICATION_STYLES[status] || VERIFICATION_STYLES.PENDING
      }`}
    >
      {status}
    </span>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">
        {value || 'Not provided'}
      </dd>
    </div>
  )
}

export default function PharmacyDashboardPage() {
  const { user } = useAuth()
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
    summary: null,
    summaryError: null,
  })

  const load = useCallback(() => {
    getMyPharmacy()
      .then(async (response) => {
        const data = response.data.data
        const profile = data.profile
        let summary = null
        let summaryError = null

        if (
          profile?.verificationStatus === 'APPROVED' &&
          profile.isActive !== false
        ) {
          try {
            const summaryResponse = await getPharmacyOrderSummary()
            summary = summaryResponse.data.data.summary
          } catch (error) {
            summaryError = getApiErrorMessage(
              error,
              'Unable to load order statistics.',
            )
          }
        }

        setState({
          loading: false,
          error: null,
          data,
          summary,
          summaryError,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error),
          data: null,
          summary: null,
          summaryError: null,
        })
      })
  }, [])

  function retry() {
    setState({
      loading: true,
      error: null,
      data: null,
      summary: null,
      summaryError: null,
    })
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <LoadingState label="Loading your dashboard…" />
        </main>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <ErrorState message={state.error} onRetry={retry} />
        </main>
      </div>
    )
  }

  const { user: account, profile } = state.data
  const { summary, summaryError } = state
  const firstName = account.name.split(' ')[0]

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage orders, inventory, and your pharmacy profile.
            </p>
          </div>
          {profile ? (
            <VerificationBadge status={profile.verificationStatus} />
          ) : null}
        </section>

        {!profile ? (
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Set up your pharmacy profile
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Add your pharmacy, pharmacist, licence, and location details.
              New profiles start with PENDING verification.
            </p>
            <Link
              to="/pharmacy/profile"
              className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Create pharmacy profile
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {profile.pharmacyName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {profile.pharmacistName}
                    </p>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      profile.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {profile.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <InfoRow
                    label="Verification status"
                    value={profile.verificationStatus}
                  />
                  <InfoRow
                    label="Licence number"
                    value={profile.licenseNumber}
                  />
                  <InfoRow label="Phone" value={profile.phone} />
                  <InfoRow label="Email" value={profile.email} />
                  <InfoRow
                    label="Address"
                    value={[
                      profile.address,
                      profile.city,
                      profile.state,
                      profile.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  />
                  <InfoRow
                    label="Opening hours"
                    value={
                      profile.openingTime && profile.closingTime
                        ? `${profile.openingTime} – ${profile.closingTime}`
                        : ''
                    }
                  />
                </dl>

                <div className="mt-5">
                  <Link
                    to="/pharmacy/profile"
                    className="inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                  >
                    Manage profile
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">
                  Verification
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  {profile.verificationStatus === 'PENDING'
                    ? 'Your profile is awaiting platform verification. You can keep editing your details while it is reviewed.'
                    : profile.verificationStatus === 'APPROVED'
                      ? 'Your pharmacy is verified and visible in the public directory.'
                      : 'Your verification was rejected. Review your details and contact the platform for help.'}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Verification status is managed by MediConnect and cannot be
                  changed from this dashboard.
                </p>
              </div>
            </section>

            {profile.description ? (
              <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">
                  About
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {profile.description}
                </p>
              </section>
            ) : null}
          </>
        )}

        {profile &&
        profile.verificationStatus === 'APPROVED' &&
        profile.isActive !== false ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Order overview
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Live counts for orders placed with your pharmacy.
                </p>
              </div>
              <Link
                to="/pharmacy/orders"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                View Orders
              </Link>
            </div>

            {summaryError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-5 text-center">
                <p className="text-sm font-medium text-red-700">
                  {summaryError}
                </p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {PHARMACY_ORDER_SUMMARY_CARDS.map((card) => (
                  <Link
                    key={card.key}
                    to={`/pharmacy/orders?status=${card.status}`}
                    className={`rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.cardClass}`}
                  >
                    <p
                      className={`text-xs font-medium uppercase tracking-wide ${card.labelClass}`}
                    >
                      {card.label}
                    </p>
                    <p
                      className={`mt-2 text-2xl font-semibold ${card.valueClass}`}
                    >
                      {summary?.[card.key] ?? 0}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : profile ? (
          <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-base font-semibold text-amber-900">
              Order management unavailable
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              {profile.isActive === false
                ? 'Your pharmacy profile is inactive. Order management becomes available when the profile is active and approved.'
                : profile.verificationStatus === 'REJECTED'
                  ? 'Your pharmacy profile was rejected. Order management is unavailable.'
                  : 'Order management becomes available after your pharmacy profile is approved.'}
            </p>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">
            Quick actions
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <div
                key={action.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="text-base font-medium text-slate-900">
                  {action.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {action.description}
                </p>
                <div className="mt-3">
                  <Link
                    to={action.to}
                    className="inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                  >
                    {action.cta || 'Open'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
