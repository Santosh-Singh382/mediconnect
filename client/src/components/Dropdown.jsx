import React, { useState } from 'react'

const Dropdown = ({
  triggerLabel = 'Select',
  items,
  onSelect,
  disabled = false,
  ...props
}) => {
  const [open, setOpen] = useState(false)

  const handleSelect = (value) => {
    setOpen(false)
    onSelect?.(value)
  }

  return (
    <div style={{ display: 'inline-block', ...props.style }}>
      <button
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2)',
          fontSize: 'var(--font-caption-size)',
          color: 'var(--color-text)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--transition-fast)',
        }}
        onClick={e => {
          e.stopPropagation()
          if (!disabled) {
            setOpen(!open)
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {triggerLabel}
      </button>

      {open && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 'var(--space-2)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2)',
            listStyle: 'none',
            minWidth: '120px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 1000,
            animation: 'fade-in 150ms ease-out',
          }}
        >
          {items && items.map((item) => (
            <li
              key={item.value}
              style={{
                padding: 'var(--space-3)',
                cursor: 'pointer',
                color: 'var(--color-text)',
                fontSize: 'var(--font-caption-size)',
                transition: 'var(--transition-fast)',
              }}
              onClick={() => handleSelect(item.value)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Dropdown