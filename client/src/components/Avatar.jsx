import React from 'react'

const Avatar = ({
  src,
  alt,
  size = 'md',
  shape = 'circle',
  label,
  ...props
}) => {
  const sizeStyles = {
    sm: { width: '32px', height: '32px' },
    md: { width: '48px', height: '48px' },
    lg: { width: '64px', height: '64px' },
  }

  const renderInitials = (name) => {
    if (!name) return null
    const initials = name
      .split(' ')
      .map ((n) => n[0])
      .join('')
      .toUpperCase()
    return initials
  }

  const renderImage = () => {
    if (!src) return null
    return <img src={src} alt={alt || ''} style={{ width: sizeStyles[size].width, height: sizeStyles[size].height, borderRadius: shape === 'circle' ? '50%' : 0, objectFit: 'cover' }} {...props} />
  }

  return (
    <div
      style={{
        width: sizeStyles[size].width,
        height: sizeStyles[size].height,
        borderRadius: shape === 'circle' ? '50%' : 0,
        backgroundColor: 'var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text)',
        fontSize: shape === 'circle' ? '1rem' : '0.875rem',
        ...props.style,
      }}
      aria-label={label || 'User avatar'}
    >
      {src ? renderImage() : renderInitials(label)}
    </div>
  )
}

export default Avatar