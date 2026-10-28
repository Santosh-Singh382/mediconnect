import React from 'react'

const Pagination = ({
  page,
  limit,
  total,
  onPageChange,
  className,
  ...props
}) => {
  const totalPages = Math.ceil(total / limit) || 1

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '1rem',
        ...props.style,
      }}
      className={className}
      {...props}
    >
      <ul
        style={{
          display: 'flex',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {/* Previous */}
        <li
          style={{
            margin: '0 0.25rem',
            ...(page <= 1 ? { display: 'none' } : {}),
          }}
        >
          <button
            onClick={() => onPageChange(page - 1)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              color: 'var(--color-text)',
              backgroundColor: 'var(--color-surface)',
              fontSize: '0.875rem',
            }}
          >
            Previous
          </button>
        </li>

        {/* Page numbers */}
        {[...Array(totalPages).keys()].map((i) => {
          const pageNumber = i + 1
          return (
            <li
              key={pageNumber}
              style={{
                margin: '0 0.25rem',
                ...(page === pageNumber
                  ? {
                      backgroundColor: 'var(--color-primary)',
                      color: '#FFFFFF',
                      border: '1px solid var(--color-primary)',
                    }
                  : {
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    })}
              }
            >
              <button
                onClick={() => onPageChange(pageNumber)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                }}
              >
                {pageNumber}
              </button>
            </li>
          )
        })}

        {/* Next */}
        <li
          style={{
            margin: '0 0.25rem',
            ...(page >= totalPages ? { display: 'none' } : {}),
          }}
        >
          <button
            onClick={() => onPageChange(page + 1)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              color: 'var(--color-text)',
              backgroundColor: 'var(--color-surface)',
              fontSize: '0.875rem',
            }}
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  )
}

export default Pagination