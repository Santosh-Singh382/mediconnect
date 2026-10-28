const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  doctors: (
    <>
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M12 11v5M9.5 13.5h5" />
    </>
  ),
  pharmacies: (
    <>
      <path d="M4 10.5V20h16v-9.5" />
      <path d="M3 10.5 5 4h14l2 6.5" />
      <path d="M3 10.5a3 3 0 0 0 4.5 0 3 3 0 0 0 4.5 0 3 3 0 0 0 4.5 0 3 3 0 0 0 4.5 0" />
      <path d="M9 20v-4h6v4" />
    </>
  ),
  users: (
    <>
      <path d="M16 19.5v-1.2a3.8 3.8 0 0 0-3.8-3.8H7.8A3.8 3.8 0 0 0 4 18.3v1.2" />
      <circle cx="10" cy="8" r="3.5" />
      <path d="M20 19.5v-1.2a3.8 3.8 0 0 0-2.8-3.7" />
      <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4" />
    </>
  ),
  medicines: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v4L7.5 11.5V21h9V11.5L14 7V3" />
      <path d="M8 15h8" />
    </>
  ),
  orders: (
    <>
      <path d="M9 4.5H7.5A1.5 1.5 0 0 0 6 6v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 20V6a1.5 1.5 0 0 0-1.5-1.5H15" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  notifications: (
    <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
  ),
  account: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 19a6.5 6.5 0 0 1 11 0" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" />
      <path d="m15 8 4 4-4 4" />
      <path d="M19 12H9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  check: <path d="m5 13 4 4L19 7" />,
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M6.3 6.3a8 8 0 1 0 11.4 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3.5 19h17L12 4Z" />
      <path d="M12 9v4.5M12 17h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13h4l1.5 3h5L16 13h4" />
      <path d="M5.5 5h13l1.5 8v4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17v-4l1.5-8Z" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: (
    <path d="M5 4h3l1.5 4.5-2 1.5a15 15 0 0 0 6.5 6.5l1.5-2L20 16v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 9h2a2 2 0 0 1 2 2v10" />
      <path d="M8 7h2M8 11h2M8 15h2M3 21h18" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m6 18 12-12" />
    </>
  ),
}

export default function AdminIcon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.7,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {ICONS[name] || ICONS.dashboard}
    </svg>
  )
}
