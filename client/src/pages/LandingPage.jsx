import { Link } from 'react-router-dom'

const specialties = [
  { name: 'General medicine', detail: 'Everyday care', icon: '✚' },
  { name: 'Cardiology', detail: 'Heart health', icon: '♡' },
  { name: 'Dermatology', detail: 'Skin concerns', icon: '◌' },
  { name: 'Pediatrics', detail: 'Care for children', icon: '⌁' },
]

const benefits = [
  {
    number: '01',
    title: 'Choose your doctor',
    description: 'Browse verified specialists and find the right fit for your needs.',
  },
  {
    number: '02',
    title: 'Book in seconds',
    description: 'Pick a convenient time and consultation type without the waiting room.',
  },
  {
    number: '03',
    title: 'Keep moving forward',
    description: 'Get digital prescriptions, records, and follow-up care in one place.',
  },
]

const consultationTypes = [
  { title: 'Video consultation', detail: 'Face-to-face care from wherever you are.', icon: '▣' },
  { title: 'Audio consultation', detail: 'Private, focused conversations with your doctor.', icon: '◒' },
  { title: 'Secure chat', detail: 'Ask questions and follow up at your own pace.', icon: '⌁' },
]

function Arrow() {
  return <span aria-hidden="true">↗</span>
}

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700" aria-hidden="true">
      ✓
    </span>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <header className="relative z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-200">+</span>
            <span className="text-lg font-bold tracking-tight">Medi<span className="text-blue-600">Connect</span></span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="transition hover:text-blue-600">How it works</a>
            <a href="#specialties" className="transition hover:text-blue-600">Specialties</a>
            <a href="#care-options" className="transition hover:text-blue-600">Care options</a>
            <Link to="/medicines" className="transition hover:text-blue-600">Medicines</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="hidden px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-blue-600 sm:block">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:px-4">Get started <span className="hidden sm:inline"><Arrow /></span></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-slate-200 bg-white">
          <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_70%_20%,#dbeafe_0,transparent_55%)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Care that fits your life
              </div>
              <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-7xl">
                Better care starts with <span className="text-blue-600">a simple step.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Connect with trusted doctors, book a consultation, and manage your health journey—all from one calm, secure place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/doctors" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">
                  Find your doctor <Arrow />
                </Link>
                <Link to="/medicines" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                  Explore medicines
                </Link>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
                <span className="flex items-center gap-2"><CheckIcon /> Verified professionals</span>
                <span className="flex items-center gap-2"><CheckIcon /> Private & secure</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[30rem] lg:ml-auto">
              <div className="absolute -inset-5 rounded-[2rem] bg-blue-100/70 blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 p-3 shadow-2xl shadow-blue-200/60">
                <div className="rounded-[1.25rem] bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 p-6 text-white sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-100">Your care dashboard</span>
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs">Today</span>
                  </div>
                  <div className="mt-12 rounded-2xl bg-white p-5 text-slate-900 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Next consultation</p>
                        <h2 className="mt-2 text-xl font-bold">A calmer care journey</h2>
                        <p className="mt-1 text-sm text-slate-500">Appointments, prescriptions, and follow-up care</p>
                      </div>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-700">♡</span>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                      <span className="font-semibold text-slate-700">Your care, in one place</span>
                      <span className="font-semibold text-blue-600">Explore care →</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-bold">01</p><p className="mt-1 text-xs text-blue-100">Find the right care</p></div>
                    <div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-bold">02</p><p className="mt-1 text-xs text-blue-100">Stay on track</p></div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:block">
                <p className="text-xs font-semibold text-slate-400">Patients feel supported</p>
                <p className="mt-1 text-sm font-bold text-slate-800">At every step of care</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-8 sm:grid-cols-3 sm:px-8">
            {[
              ['Verified', 'Care professionals'],
              ['Private', 'Health information'],
              ['Connected', 'Care experience'],
            ].map(([value, label]) => (
              <div key={label} className="border-l-2 border-blue-200 pl-5">
                <p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Your health journey, without the friction.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">Thoughtfully designed tools to make finding and managing care feel effortless.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {benefits.map((item) => (
              <article key={item.number} className="rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/50">
                <span className="text-sm font-bold text-blue-600">{item.number}</span>
                <h3 className="mt-12 text-xl font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="specialties" className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-300">Find the right care</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Support for every chapter.</h2>
              </div>
              <Link to="/doctors" className="text-sm font-bold text-blue-300 transition hover:text-white">View all specialties <Arrow /></Link>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {specialties.map((specialty) => (
                <Link to="/doctors" key={specialty.name} className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-blue-400/60 hover:bg-blue-600">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-2xl text-blue-300 group-hover:bg-white/20 group-hover:text-white">{specialty.icon}</span>
                  <h3 className="mt-8 font-bold">{specialty.name}</h3>
                  <p className="mt-1 text-sm text-slate-400 group-hover:text-blue-100">{specialty.detail}</p>
                  <span className="mt-6 block text-sm font-bold text-blue-300 group-hover:text-white">Explore →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="care-options" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid items-start gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">Care on your terms</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Choose how you connect.</h2>
              <p className="mt-5 leading-7 text-slate-600">Whether you need a quick answer or a thoughtful consultation, meet your doctor in the way that works best for you.</p>
              <Link to="/doctors" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">Meet our doctors <Arrow /></Link>
            </div>
            <div className="grid gap-4">
              {consultationTypes.map((type) => (
                <div key={type.title} className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-lg">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600">{type.icon}</span>
                  <div>
                    <h3 className="font-bold text-slate-950">{type.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{type.detail}</p>
                  </div>
                  <span className="ml-auto text-xl text-slate-300">→</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 lg:pb-28">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-blue-600 px-6 py-12 text-center text-white shadow-2xl shadow-blue-200 sm:px-12 sm:py-16">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-100">Start feeling more in control</p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Good care is closer than you think.</h2>
            <p className="mx-auto mt-4 max-w-xl text-blue-100">Find a trusted doctor and take your next step today.</p>
            <Link to="/doctors" className="mt-8 inline-flex rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50">Find a doctor <span className="ml-2"><Arrow /></span></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link to="/" className="font-bold text-slate-900">Medi<span className="text-blue-600">Connect</span></Link>
          <p>Simple, secure healthcare for everyone.</p>
          <div className="flex gap-5"><Link to="/login" className="hover:text-blue-600">Sign in</Link><Link to="/register" className="hover:text-blue-600">Create account</Link></div>
        </div>
      </footer>
    </div>
  )
}
