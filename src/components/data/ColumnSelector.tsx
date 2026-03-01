import type { ReactNode } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'

interface ColumnSelectorProps {
  columns: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  label?: ReactNode
  multiple?: boolean
}

export function ColumnSelector({
  columns,
  selected,
  onChange,
  label,
  multiple = true,
}: ColumnSelectorProps) {
  const { lang } = useLang()
  const displayLabel = label ?? t('selectColumns', lang)
  const toggle = (col: string) => {
    if (multiple) {
      onChange(selected.includes(col) ? selected.filter((c) => c !== col) : [...selected, col])
    } else {
      onChange([col])
    }
  }

  const selectAll = () => onChange([...columns])
  const clearAll = () => onChange([])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-muted">{displayLabel}</label>
        {multiple && (
          <div className="flex gap-2 text-xs">
            <button onClick={selectAll} className="text-accent hover:underline">
              {t('all', lang)}
            </button>
            <button onClick={clearAll} className="text-text-muted hover:underline">
              {t('clear', lang)}
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-bg rounded-lg border border-border">
        {columns.map((col) => (
          <button
            key={col}
            onClick={() => toggle(col)}
            className={`px-2.5 py-1 text-xs rounded-md transition-all ${
              selected.includes(col)
                ? 'bg-accent text-white'
                : 'bg-surface text-text-muted hover:text-accent hover:bg-surface-hover'
            }`}
          >
            {col}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-text-muted">{selected.length} {t('columnsSelected', lang)}</p>
      )}
    </div>
  )
}
