import AppHeader from './AppHeader.jsx'
import DashboardSidebar from './DashboardSidebar.jsx'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

export default function WorkspaceShell({ user, children, contentClassName = 'max-w-5xl' }) {
  const roleLabels = {
    PATIENT: 'Patient',
    DOCTOR: 'Doctor',
    PHARMACY: 'Pharmacy',
    ADMIN: 'Admin',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={[]} />
      <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:pl-[308px] lg:pr-8">
        <DashboardSidebar links={homeLinksFor(user)} role={roleLabels[user?.role] || 'Workspace'} />
        <main className={`min-w-0 ${contentClassName}`}>{children}</main>
      </div>
    </div>
  )
}
