import { useMemo } from 'react'
import { useData } from '@/context/DataContext'
import { useWizard } from '@/context/WizardContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { Columns3, Check, X, Lock } from 'lucide-react'

export function ColumnManagementPanel() {
  const { rawData, columns, numericalColumns } = useData()
  const { selectedColumns, excludedColumns, setSelectedColumns, setExcludedColumns, targetColumn, setTargetColumn, hasExistingModel, uploadedModelData } = useWizard()
  const { lang } = useLang()

  const modelData = uploadedModelData as Record<string, any> | null
  const isLocked = hasExistingModel && modelData != null
  const lockedFeatures: string[] = isLocked ? (modelData.featureColumns || []) : []
  const lockedTarget: string = isLocked ? (modelData.targetColumn || '') : ''

  const columnStats = useMemo(() => {
    const stats: Record<string, { type: string; sample: string; nonNull: number }> = {}
    for (const col of columns) {
      const isNum = numericalColumns.includes(col)
      const sample = rawData.length > 0 ? String(rawData[0][col] ?? '') : ''
      let nonNull = 0
      for (const row of rawData.slice(0, 100)) {
        if (row[col] !== null && row[col] !== undefined && row[col] !== '') nonNull++
      }
      stats[col] = { type: isNum ? 'numeric' : 'categorical', sample, nonNull }
    }
    return stats
  }, [rawData, columns, numericalColumns])

  const toggleColumn = (col: string) => {
    if (isLocked && (lockedFeatures.includes(col) || col === lockedTarget)) return
    if (excludedColumns.includes(col)) {
      setExcludedColumns(excludedColumns.filter((c) => c !== col))
      setSelectedColumns([...selectedColumns, col])
    } else {
      setSelectedColumns(selectedColumns.filter((c) => c !== col))
      setExcludedColumns([...excludedColumns, col])
    }
  }

  const selectAll = () => {
    setSelectedColumns([...columns])
    setExcludedColumns([])
  }

  const deselectAll = () => {
    setSelectedColumns([])
    setExcludedColumns([...columns])
  }

  const selectNumericOnly = () => {
    setSelectedColumns([...numericalColumns])
    setExcludedColumns(columns.filter((c) => !numericalColumns.includes(c)))
  }

  const isIncluded = (col: string) => !excludedColumns.includes(col)

  const isColumnLocked = (col: string) => isLocked && (lockedFeatures.includes(col) || col === lockedTarget)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Columns3 size={18} className="text-accent" />
        <h3 className="font-semibold text-sm">{t('columnManagement', lang)}</h3>
        <span className="text-xs text-text-muted ml-auto">
          {columns.length - excludedColumns.length} / {columns.length} {t('columnsSelected', lang)}
        </span>
      </div>

      {/* Locked notice */}
      {isLocked && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg p-2 text-xs text-warning">
          <Lock size={14} />
          {t('columnsLockedByModel', lang)}
        </div>
      )}

      {/* Target column selector */}
      <div className="bg-surface border border-border rounded-lg p-3">
        <label className="text-sm font-medium text-text-muted">{t('targetColumn', lang)}</label>
        {isLocked ? (
          <>
            <div className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text opacity-70 flex items-center gap-2">
              <Lock size={12} className="text-warning" />
              {lockedTarget}
            </div>
            <p className="text-[10px] text-warning mt-1">{t('targetLockedByModel', lang)}</p>
          </>
        ) : (
          <select
            value={targetColumn}
            onChange={(e) => setTargetColumn(e.target.value)}
            className="w-full mt-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text"
          >
            <option value="">{t('selectTarget', lang)}</option>
            {columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Quick actions */}
      {!isLocked && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={selectAll} className="px-3 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent transition-all">
            {t('selectAll', lang)}
          </button>
          <button onClick={deselectAll} className="px-3 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent transition-all">
            {t('deselectAll', lang)}
          </button>
          <button onClick={selectNumericOnly} className="px-3 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-accent hover:border-accent transition-all">
            {t('numericOnly', lang)}
          </button>
        </div>
      )}

      {/* Column table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-text-muted w-10">{t('use', lang)}</th>
                <th className="px-3 py-2 text-left text-text-muted">{t('columnName', lang)}</th>
                <th className="px-3 py-2 text-left text-text-muted">{t('type', lang)}</th>
                <th className="px-3 py-2 text-left text-text-muted">{t('sampleValue', lang)}</th>
                <th className="px-3 py-2 text-right text-text-muted">{t('nonNull', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => {
                const stat = columnStats[col]
                const included = isIncluded(col)
                const isTarget = col === targetColumn
                const locked = isColumnLocked(col)
                return (
                  <tr
                    key={col}
                    className={`border-b border-border/20 transition-colors ${
                      !included ? 'opacity-40' : ''
                    } ${isTarget ? 'bg-accent/5' : 'hover:bg-surface-hover'}`}
                  >
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => toggleColumn(col)}
                        disabled={locked}
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                          locked
                            ? 'bg-accent/50 border-accent/50 text-white cursor-not-allowed'
                            : included
                              ? 'bg-accent border-accent text-white'
                              : 'border-border text-transparent hover:border-accent/50'
                        }`}
                      >
                        {locked ? <Lock size={10} /> : included ? <Check size={12} /> : <X size={12} />}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 font-mono font-medium">
                      {col}
                      {isTarget && <span className="ml-1 text-accent text-[10px]">TARGET</span>}
                      {locked && !isTarget && <span className="ml-1 text-warning text-[10px]">LOCKED</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        stat?.type === 'numeric'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {stat?.type === 'numeric' ? t('numeric', lang) : t('categorical', lang)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-text-muted truncate max-w-[120px]">
                      {stat?.sample || '-'}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-right">
                      {stat?.nonNull ?? 0}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
