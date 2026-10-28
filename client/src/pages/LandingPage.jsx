import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  PROJECT_NAME,
} from '../lib/branding.js'

const CURRENT_YEAR = new Date().getFullYear()

const STEPS = [
  {
    number: '01',
    title: 'Find a Doctor',
    description: 'Browse approved doctors by specialty and find a care fit.',
  },
  {
    number: '02',
    title: 'Choose a Consultation',
    description: 'Pick a convenient appointment and connect your way.',
  },
  {
    number: '03',
    title: 'Consult Online',
    description: 'Use video, audio, or secure chat for your consultation.',
  },
  {
    number: '04',
    title: 'Receive Prescription & Care',
    description: 'Keep prescriptions, records, and medicines connected.',
  },
]

const FEATURES = [
  {
    title: 'Find Doctors',
    description: 'Discover approved specialists and compare care options.',
    icon: 'doctor',
    className: 'landing-feature-featured',
    to: '/doctors',
  },
  {
    title: 'Video Consultation',
    description: 'Meet your doctor remotely through a focused video visit.',
    icon: 'video',
    to: '/appointments',
  },
  {
    title: 'Audio Consultation',
    description: 'Have a private conversation when video is not practical.',
    icon: 'audio',
    to: '/appointments',
  },
  {
    title: 'Secure Chat',
    description: 'Follow up with your doctor at your own pace.',
    icon: 'chat',
    to: '/appointments',
  },
  {
    title: 'Appointments',
    description: 'Book and keep track of upcoming consultations.',
    icon: 'calendar',
    to: '/appointments',
  },
  {
    title: 'Digital Prescriptions',
    description: 'Access prescriptions from your connected care journey.',
    icon: 'prescription',
    to: '/prescriptions',
  },
  {
    title: 'Medical Records',
    description: 'Keep important health documents in one protected place.',
    icon: 'record',
    to: '/medical-records',
  },
  {
    title: 'Medicines & Pharmacy',
    description: 'Explore medicine listings from pharmacy partners.',
    icon: 'medicine',
    to: '/medicines',
  },
  {
    title: 'Order Tracking',
    description: 'Follow medicine orders from checkout to delivery.',
    icon: 'order',
    to: '/orders',
  },
]

const TRUST_POINTS = [
  ['shield', 'Secure authentication', 'Protected sign-in and role-based access.'],
  ['users', 'Verified workflows', 'Doctor and pharmacy verification stays controlled.'],
  ['lock', 'Protected information', 'Medical information is kept behind authorized access.'],
  ['message', 'Secure communication', 'Connect through supported consultation channels.'],
]

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    doctor: <><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M12 11v5M9.5 13.5h5" /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    audio: <><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4-.9L4 20l1.5-3.5A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    prescription: <><path d="M7 4h10v16H7z" /><path d="M9 8h6M9 12h6M9 16h3" /><path d="M9 4V3h6v1" /></>,
    record: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    medicine: <><path d="M9 3h6M10 3v4L7.5 11.5V21h9v-9.5L14 7V3M8 15h8" /></>,
    order: <><path d="M6 4h12v17H6z" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    users: <><path d="M16 19.5v-1.2a3.8 3.8 0 0 0-3.8-3.8H7.8A3.8 3.8 0 0 0 4 18.3v1.2" /><circle cx="10" cy="8" r="3.5" /><path d="M20 19.5v-1.2a3.8 3.8 0 0 0-2.8-3.7M15.5 4.8a3.5 3.5 0 0 1 0 6.4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4-.9L4 20l1.5-3.5A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" /><path d="M8 12h8" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.arrow}
    </svg>
  )
}

function Brand({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm shadow-blue-200">
        +
      </span>
      <span className={compact ? 'text-base font-bold tracking-tight' : 'text-lg font-bold tracking-tight'}>
        {BRAND_NAME}
      </span>
    </span>
  )
}

function ProductPreview() {
  return (
    <div className="landing-preview relative mx-auto w-full max-w-[34rem]">
      <div className="landing-preview-glow" aria-hidden="true" />
      <div className="relative rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
        <div className="overflow-hidden rounded-[1.3rem] bg-slate-950">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-400">
            <span className="flex items-center gap-2 font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Care workspace
            </span>
            <span>Secure connection</span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-[1.2fr_.8fr] sm:p-5">
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Next step</p>
                  <h3 className="mt-3 text-xl font-bold">Find your care team</h3>
                </div>
                <span className="rounded-lg bg-white/15 p-2"><Icon name="doctor" /></span>
              </div>
              <p className="mt-10 max-w-xs text-sm leading-6 text-blue-100">
                Search approved doctors and choose a consultation that works for you.
              </p>
              <Link to="/doctors" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50">
                Find a Doctor <Icon name="arrow" className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name="calendar" className="h-4 w-4" /></span>
                  <div><p className="text-xs font-semibold text-slate-400">Appointments</p><p className="mt-1 text-sm font-bold text-slate-900">Stay on track</p></div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Icon name="prescription" className="h-4 w-4" /></span>
                  <div><p className="text-xs font-semibold text-slate-400">Prescriptions</p><p className="mt-1 text-sm font-bold text-slate-900">Connected care</p></div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Icon name="medicine" className="h-4 w-4" /></span>
                  <div><p className="text-xs font-semibold text-slate-400">Medicines</p><p className="mt-1 text-sm font-bold text-slate-900">Explore pharmacy</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="landing-preview-note absolute -bottom-5 -left-3 hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:block">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Built for access beyond distance</p>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">{children}</p>
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="landing-page min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <header className={`landing-navbar fixed inset-x-0 top-0 z-40 transition ${scrolled ? 'landing-navbar-scrolled' : ''}`}>
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label={`${BRAND_NAME} home`} onClick={closeMenu}><Brand /></Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex" aria-label="Primary navigation">
            <a href="#find-care" className="transition hover:text-blue-600">Find a Doctor</a>
            <Link to="/medicines" className="transition hover:text-blue-600">Medicines</Link>
            <a href="#how-it-works" className="transition hover:text-blue-600">How It Works</a>
            <a href="#about" className="transition hover:text-blue-600">About</a>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login" className="px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-blue-600">Login</Link>
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">Get Started <Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen}>
            <Icon name="menu" />
          </button>
        </div>
        {menuOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/30 lg:hidden" role="presentation" onClick={closeMenu}>
            <div className="absolute right-0 top-0 h-full w-[min(22rem,88vw)] bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Mobile navigation" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between"><Brand compact /><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={closeMenu} aria-label="Close navigation"><Icon name="close" /></button></div>
              <nav className="mt-10 grid gap-2" aria-label="Mobile navigation">
                {[
                  ['Find a Doctor', '#find-care'],
                  ['Medicines', '/medicines'],
                  ['How It Works', '#how-it-works'],
                  ['About', '#about'],
                ].map(([label, to]) => (
                  <a key={label} href={to} onClick={closeMenu} className="rounded-xl px-4 py-3 text-base font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">{label}</a>
                ))}
              </nav>
              <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6">
                <Link to="/login" onClick={closeMenu} className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700">Login</Link>
                <Link to="/register" onClick={closeMenu} className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white">Get Started</Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section className="landing-hero relative overflow-hidden border-b border-slate-200 bg-white pt-28 sm:pt-36">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,#dbeafe_0,transparent_34%),radial-gradient(circle_at_12%_80%,#ecfeff_0,transparent_30%)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 sm:px-8 sm:pb-28 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:pb-32">
            <div className="landing-reveal">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {PROJECT_NAME}
              </div>
              <h1 className="max-w-2xl text-5xl font-bold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-7xl">
                Healthcare <span className="text-blue-600">Beyond Distance.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">{BRAND_TAGLINE}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/doctors" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">Find a Doctor <Icon name="arrow" className="h-4 w-4" /></Link>
                <Link to="/medicines" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">Explore Medicines</Link>
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-500"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">✓</span> Connect with healthcare professionals from wherever you are.</p>
            </div>
            <div className="landing-reveal landing-reveal-delay"><ProductPreview /></div>
          </div>
        </section>

        <section id="about" className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:py-28">
            <div>
              <SectionLabel>Care should travel further</SectionLabel>
              <h2 className="max-w-lg text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Healthcare should not depend on where you live.</h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">Telemedicine helps rural communities take the next step in care without making distance the first barrier. Find a doctor, consult remotely, manage prescriptions, and explore medicines through one connected experience.</p>
              <Link to="/register" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition hover:text-blue-700">Start your care journey <Icon name="arrow" className="h-4 w-4" /></Link>
            </div>
            <div className="relative rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-8">
              <div className="absolute left-[13%] right-[13%] top-1/2 hidden h-px bg-blue-200 sm:block" aria-hidden="true" />
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  ['Rural Patient', 'users'],
                  ['Telemedicine', 'message'],
                  ['Doctor', 'doctor'],
                  ['Prescription', 'prescription'],
                ].map(([label, icon], index) => (
                  <div key={label} className="relative z-10 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:block sm:text-center">
                    <span className={`mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${index === 1 ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}><Icon name={icon} /></span>
                    <p className="mt-0 text-sm font-bold text-slate-900 sm:mt-3">{label}</p>
                    {index < 3 ? <span className="ml-auto text-blue-400 sm:hidden">→</span> : null}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"><Icon name="medicine" className="h-4 w-4" /> Connected to pharmacy and medicines</div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-2xl"><SectionLabel>How it works</SectionLabel><h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">A clearer path from need to care.</h2><p className="mt-4 text-base leading-7 text-slate-600">Simple steps designed around how people actually access healthcare.</p></div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.number} className="landing-step relative">
                {index < STEPS.length - 1 ? <span className="landing-step-line" aria-hidden="true" /> : null}
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700">{step.number}</span>
                <h3 className="mt-5 text-lg font-bold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="find-care" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><SectionLabel>One connected platform</SectionLabel><h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Tools that keep care moving.</h2></div><p className="max-w-md text-sm leading-6 text-slate-600">Use the capabilities you need, when you need them—from finding a doctor to following an order.</p></div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <Link key={feature.title} to={feature.to} className={`landing-feature group ${feature.className || ''}`}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white"><Icon name={feature.icon} /></span>
                  <h3 className="mt-5 text-base font-bold text-slate-950">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-blue-600">Explore <Icon name="arrow" className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div><SectionLabel>Designed for your role</SectionLabel><h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">A better experience for every part of care.</h2><p className="mt-4 text-base leading-7 text-slate-600">Patients, doctors, and pharmacies each get focused tools that work together.</p></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link to="/register" className="landing-audience landing-audience-patient"><span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Patients</span><h3 className="mt-7 text-xl font-bold text-slate-950">Access healthcare from wherever you are.</h3><span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-blue-600">Find a Doctor <Icon name="arrow" className="h-4 w-4" /></span></Link>
              <Link to="/register" className="landing-audience landing-audience-doctor"><span className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Doctors</span><h3 className="mt-7 text-xl font-bold text-slate-950">Connect with patients and manage consultations.</h3><span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">Join as a Doctor <Icon name="arrow" className="h-4 w-4" /></span></Link>
              <Link to="/register" className="landing-audience landing-audience-pharmacy"><span className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Pharmacies</span><h3 className="mt-7 text-xl font-bold text-slate-950">Help patients access medicines after consultation.</h3><span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-violet-700">Join as a Pharmacy <Icon name="arrow" className="h-4 w-4" /></span></Link>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:py-24">
            <div><SectionLabel>Built around trust</SectionLabel><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Technology should make care feel safer, not harder.</h2><p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Telemedicine brings together the secure workflows already built into the platform, while keeping access clear by role.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRUST_POINTS.map(([icon, title, description]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20 text-blue-200"><Icon name={icon} className="h-4 w-4" /></span><h3 className="mt-4 text-sm font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></div>)}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-blue-200 bg-blue-600 px-6 py-12 text-center text-white shadow-2xl shadow-blue-200 sm:px-12 sm:py-16"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Start closer to care</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Better healthcare, closer to home.</h2><p className="mx-auto mt-4 max-w-xl text-blue-100">Connect with doctors, manage consultations, prescriptions, and medicines through one digital healthcare platform.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link to="/doctors" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50">Find a Doctor <Icon name="arrow" className="h-4 w-4" /></Link><Link to="/register" className="rounded-xl border border-white/30 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">Get Started</Link></div></div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div><Link to="/" aria-label={`${BRAND_NAME} home`}><Brand /></Link><p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">{PROJECT_NAME}</p></div>
          <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Platform</h2><div className="mt-4 grid gap-3 text-sm text-slate-600"><Link to="/doctors" className="hover:text-blue-600">Find a Doctor</Link><Link to="/appointments" className="hover:text-blue-600">Appointments</Link><Link to="/medicines" className="hover:text-blue-600">Medicines</Link><Link to="/prescriptions" className="hover:text-blue-600">Prescriptions</Link></div></div>
          <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">For Providers</h2><div className="mt-4 grid gap-3 text-sm text-slate-600"><Link to="/register" className="hover:text-blue-600">Doctors</Link><Link to="/register" className="hover:text-blue-600">Pharmacy</Link></div></div>
          <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Account</h2><div className="mt-4 grid gap-3 text-sm text-slate-600"><Link to="/login" className="hover:text-blue-600">Login</Link><Link to="/register" className="hover:text-blue-600">Register</Link><a href="#how-it-works" className="hover:text-blue-600">How It Works</a></div></div>
        </div>
        <div className="border-t border-slate-100"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {CURRENT_YEAR} {BRAND_NAME}</span><span>{PROJECT_NAME}</span></div></div>
      </footer>
    </div>
  )
}
