import { useData } from '@/context/DataContext'
import { Table, X } from 'lucide-react'

export function DataPreview() {
  const { rawData, columns, numericalColumns, categoricalColumns, fileName, rowCount, clearData } =
    useData()

  if (rawData.length === 0) return null

  const previewRows = rawData.slice(0, 10)

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Table size={16} className="text-accent" />
          <span className="font-medium text-sm">{fileName}</span>
          <span className="text-xs text-text-muted">
            {rowCount.toLocaleString()} rows · {columns.length} columns
          </span>
        </div>
        <button
          onClick={clearData}
          className="text-text-muted hover:text-danger transition-colors p-1"
          title="Remove dataset"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-2 px-5 py-2 border-b border-border">
        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
          {numericalColumns.length} numeric
        </span>
        <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">
          {categoricalColumns.length} categorical
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-medium text-text-muted whitespace-nowrap"
                >
                  <span>{col}</span>
                  <span
                    className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${
                      numericalColumns.includes(col)
                        ? 'bg-accent/10 text-accent'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {numericalColumns.includes(col) ? 'num' : 'cat'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-1.5 whitespace-nowrap text-xs">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rawData.length > 10 && (
        <p className="px-5 py-2 text-xs text-text-muted">
          Showing first 10 of {rowCount.toLocaleString()} rows
        </p>
      )}
    </div>
  )
}
