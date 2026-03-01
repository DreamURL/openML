import { useState, useRef, type DragEvent } from 'react'
import { Upload, FileSpreadsheet } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useData, type DataRow } from '@/context/DataContext'

export function DataUpload() {
  const { setDataset } = useData()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    setError(null)
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
      Papa.parse<DataRow>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            setError('No data found in CSV file')
            return
          }
          setDataset(results.data, file.name)
        },
        error: () => setError('Failed to parse CSV file'),
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target!.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json<DataRow>(ws, { defval: '' })
          if (data.length === 0) {
            setError('No data found in Excel file')
            return
          }
          setDataset(data, file.name)
        } catch {
          setError('Failed to parse Excel file')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setError('Unsupported file format. Use CSV or Excel (.xlsx, .xls)')
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-accent bg-accent/10'
            : 'border-border hover:border-accent/50 hover:bg-surface-hover'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) processFile(file)
          }}
        />
        <div className="flex flex-col items-center gap-4">
          {isDragging ? (
            <FileSpreadsheet size={48} className="text-accent" />
          ) : (
            <Upload size={48} className="text-text-muted" />
          )}
          <div>
            <p className="text-lg font-medium">
              {isDragging ? 'Drop your file here' : 'Upload your dataset'}
            </p>
            <p className="text-sm text-text-muted mt-1">
              Drag & drop or click to select. Supports CSV, XLSX, XLS
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
