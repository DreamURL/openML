import { useData } from '@/context/DataContext'
import { useWizard } from '@/context/WizardContext'
import { useLang } from '@/context/LangContext'
import { t } from '@/i18n/strings'
import { Table, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export function ProcessingPreviewPanel() {
  const { rawData, columns } = useData()
  const { processedData, excludedColumns } = useWizard()
  const { lang } = useLang()

  const data = processedData || rawData
  const activeCols = columns.filter((c) => !excludedColumns.includes(c))

  const downloadExcel = () => {
    if (data.length === 0) return
    const exportData = data.map((row) => {
      const r: Record<string, unknown> = {}
      for (const col of activeCols) r[col] = row[col]
      return r
    })
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Processed')
    XLSX.writeFile(wb, 'processed_data.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table size={18} className="text-accent" />
          <h3 className="font-semibold text-sm">{t('preview', lang)}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {data.length} {t('rows', lang)} × {activeCols.length} {t('columns', lang)}
          </span>
          <button onClick={downloadExcel}
            className="flex items-center gap-1 px-3 py-1.5 border border-border text-text-muted hover:text-accent hover:border-accent rounded-lg text-xs transition-all">
            <Download size={12} /> {t('downloadExcel', lang)}
          </button>
        </div>
      </div>

      {processedData && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-xs text-success">
          {t('processed', lang)}: {rawData.length} → {processedData.length} {t('rows', lang)}
          {excludedColumns.length > 0 && (
            <span> | {excludedColumns.length} {t('columnsExcluded', lang)}</span>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left text-text-muted">#</th>
                {activeCols.slice(0, 15).map((c) => (
                  <th key={c} className="px-2 py-1.5 text-left text-text-muted truncate max-w-[100px]" title={c}>
                    {c}
                  </th>
                ))}
                {activeCols.length > 15 && (
                  <th className="px-2 py-1.5 text-text-muted">+{activeCols.length - 15}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-surface-hover">
                  <td className="px-2 py-1 text-text-muted">{i + 1}</td>
                  {activeCols.slice(0, 15).map((c) => (
                    <td key={c} className="px-2 py-1 font-mono truncate max-w-[100px]">
                      {row[c] !== null && row[c] !== undefined ? String(row[c]) : <span className="text-warning">null</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 50 && (
          <p className="text-xs text-text-muted text-center mt-2">
            {t('showingFirst', lang)} 50 / {data.length} {t('rows', lang)}
          </p>
        )}
      </div>
    </div>
  )
}
