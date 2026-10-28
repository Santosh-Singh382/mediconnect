const Card = ({
  children,
  className,
  elevation = 'md',
  verified,
  onViewMore,
  title,
  subtitle,
  experience,
  fee,
  ...props
}) => {
  const cardStyle = {
    position: 'relative',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow:
      elevation === 'lg'
        ? '0 16px 35px rgba(15, 23, 42, 0.10)'
        : elevation === 'sm'
          ? '0 4px 14px rgba(15, 23, 42, 0.04)'
          : '0 8px 24px rgba(15, 23, 42, 0.06)',
    ...props.style,
  }

  // Handle verified badge
  const verifiedBadge = verified ? (
    <span
      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm"
    >
      V
    </span>
  ) : null

  // Handle View More button
  const viewMoreBtn = onViewMore ? (
    <a
      href={onViewMore}
      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 underline-offset-4 hover:text-blue-700 hover:underline"
    >
      View More
    </a>
  ) : null

  // Render title and subtitle
  const titleElem = title ? (
    <h3 className="font-medium text-surface-900 mb-2">
      {title}
    </h3>
  ) : null

  const subtitleElem = subtitle ? (
    <p className="text-slate-500 text-sm">
      {subtitle}
    </p>
  ) : null

  // Render experience and fee
  const infoElem = experience || fee ? (
    <div className="mt-2 text-slate-500 text-sm">
      {experience && <p>{experience}</p>}
      {fee && <p>{fee}</p>}
    </div>
  ) : null

  return (
    <div
      className={className}
      style={cardStyle}
    >
      {titleElem}
      {subtitleElem}
      {infoElem}
      {verifiedBadge}
      {children}
      {viewMoreBtn}
    </div>
  )
}

export default Card