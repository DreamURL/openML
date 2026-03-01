import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface DataRow {
  [key: string]: string | number | null
}

interface DataContextValue {
  rawData: DataRow[]
  columns: string[]
  numericalColumns: string[]
  categoricalColumns: string[]
  fileName: string | null
  rowCount: number
  setDataset: (data: DataRow[], filename: string) => void
  clearData: () => void
}

const DataContext = createContext<DataContextValue | null>(null)

function detectColumnTypes(data: DataRow[], columns: string[]) {
  const numerical: string[] = []
  const categorical: string[] = []

  for (const col of columns) {
    let numericCount = 0
    let totalValid = 0

    for (const row of data.slice(0, Math.min(100, data.length))) {
      const val = row[col]
      if (val === null || val === '' || val === undefined) continue
      totalValid++
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '')) {
        numericCount++
      }
    }

    if (totalValid > 0 && numericCount / totalValid >= 0.8) {
      numerical.push(col)
    } else {
      categorical.push(col)
    }
  }

  return { numerical, categorical }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [rawData, setRawData] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [numericalColumns, setNumericalColumns] = useState<string[]>([])
  const [categoricalColumns, setCategoricalColumns] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | null>(null)

  const setDataset = useCallback((data: DataRow[], filename: string) => {
    const cols = data.length > 0 ? Object.keys(data[0]) : []
    const { numerical, categorical } = detectColumnTypes(data, cols)

    setRawData(data)
    setColumns(cols)
    setNumericalColumns(numerical)
    setCategoricalColumns(categorical)
    setFileName(filename)
  }, [])

  const clearData = useCallback(() => {
    setRawData([])
    setColumns([])
    setNumericalColumns([])
    setCategoricalColumns([])
    setFileName(null)
  }, [])

  return (
    <DataContext.Provider
      value={{
        rawData,
        columns,
        numericalColumns,
        categoricalColumns,
        fileName,
        rowCount: rawData.length,
        setDataset,
        clearData,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
