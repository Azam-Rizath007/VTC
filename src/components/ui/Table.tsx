import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  onRowClick?: (row: T) => void
  className?: string
}

export function Table<T>({ columns, data, keyField, onRowClick, className }: TableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-gray-100', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn('px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide', col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((row) => (
            <tr
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={cn('bg-white', onRowClick && 'cursor-pointer hover:bg-gray-50 active:bg-gray-100')}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-gray-700', col.className)}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
