export default function Table({
  columns = [],
  data = [],
  rowKey = 'id',
  loading = false,
  empty = 'No results found.',
  caption,
  minWidthClass = 'min-w-full',
  className = '',
  wrapperClassName = '',
  rowClassName = '',
  ...props
}) {
  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row, index)
    if (rowKey === null) return index
    return row?.[rowKey] ?? index
  }

  return (
    <div className={`w-full overflow-x-auto ${wrapperClassName}`}>
      <table
        className={`w-full border-collapse ${minWidthClass} ${className}`}
        {...props}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80">
            {columns.map((column, index) => {
              const alignClass =
                column.align === 'right'
                  ? 'text-right'
                  : column.align === 'center'
                    ? 'text-center'
                    : 'text-left'

              return (
                <th
                  key={column.key || column.id || index}
                  scope="col"
                  className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${alignClass} ${column.headerClassName || ''}`}
                >
                  {column.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm text-slate-500"
              >
                Loading…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm text-slate-500"
              >
                {empty}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getRowKey(row, index)}
                className={`align-middle transition-colors hover:bg-blue-50/30 ${rowClassName}`}
              >
                {columns.map((column, columnIndex) => {
                  const alignClass =
                    column.align === 'right'
                      ? 'text-right'
                      : column.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  const value = column.render
                    ? column.render(row, index)
                    : row?.[column.key]

                  return (
                    <td
                      key={column.key || column.id || columnIndex}
                      className={`px-4 py-3.5 text-sm text-slate-700 ${alignClass} ${
                        column.noWrap ? 'whitespace-nowrap' : ''
                      } ${column.className || ''}`}
                    >
                      {value}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
