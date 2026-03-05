import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { DataRow } from './DataContext'

export type ModelType =
  | 'multiple_regression'
  | 'logistic'
  | 'random_forest'
  | 'ann'
  | 'xgboost'
  | 'kmeans'
  | 'pca'

export interface ModelResult {
  metrics: Record<string, number>
  modelData: unknown
  predictions?: unknown
  lossHistory?: number[]
  extra?: Record<string, unknown>
}

interface WizardContextValue {
  // Step tracking
  currentStep: 1 | 2 | 3
  completedSteps: Set<number>

  // Flow mode
  hasExistingModel: boolean
  uploadedModelFile: File | null
  uploadedModelData: unknown | null

  // Step 2 output
  processedData: DataRow[] | null
  selectedColumns: string[]
  excludedColumns: string[]
  targetColumn: string

  // Step 3 state
  selectedModels: ModelType[]
  trainingResults: Map<ModelType, ModelResult>

  // Actions
  goToStep: (step: 1 | 2 | 3) => void
  completeStep: (step: number) => void
  setHasExistingModel: (v: boolean) => void
  setUploadedModelFile: (file: File | null) => void
  setUploadedModelData: (data: unknown) => void
  setProcessedData: (data: DataRow[] | null) => void
  setSelectedColumns: (cols: string[]) => void
  setExcludedColumns: (cols: string[]) => void
  setTargetColumn: (col: string) => void
  setSelectedModels: (models: ModelType[]) => void
  setTrainingResult: (model: ModelType, result: ModelResult) => void
  clearTrainingResults: () => void
  resetWizard: () => void
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const [hasExistingModel, setHasExistingModel] = useState(false)
  const [uploadedModelFile, setUploadedModelFile] = useState<File | null>(null)
  const [uploadedModelData, setUploadedModelData] = useState<unknown>(null)

  const [processedData, setProcessedData] = useState<DataRow[] | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [excludedColumns, setExcludedColumns] = useState<string[]>([])
  const [targetColumn, setTargetColumn] = useState('')

  const [selectedModels, setSelectedModels] = useState<ModelType[]>([])
  const [trainingResults, setTrainingResults] = useState<Map<ModelType, ModelResult>>(new Map())

  const goToStep = useCallback((step: 1 | 2 | 3) => {
    setCurrentStep(step)
  }, [])

  const completeStep = useCallback((step: number) => {
    setCompletedSteps((prev) => new Set(prev).add(step))
  }, [])

  const setTrainingResult = useCallback((model: ModelType, result: ModelResult) => {
    setTrainingResults((prev) => new Map(prev).set(model, result))
  }, [])

  const clearTrainingResults = useCallback(() => {
    setTrainingResults(new Map())
  }, [])

  const resetWizard = useCallback(() => {
    setCurrentStep(1)
    setCompletedSteps(new Set())
    setHasExistingModel(false)
    setUploadedModelFile(null)
    setUploadedModelData(null)
    setProcessedData(null)
    setSelectedColumns([])
    setExcludedColumns([])
    setTargetColumn('')
    setSelectedModels([])
    setTrainingResults(new Map())
  }, [])

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        completedSteps,
        hasExistingModel,
        uploadedModelFile,
        uploadedModelData,
        processedData,
        selectedColumns,
        excludedColumns,
        targetColumn,
        selectedModels,
        trainingResults,
        goToStep,
        completeStep,
        setHasExistingModel,
        setUploadedModelFile,
        setUploadedModelData,
        setProcessedData,
        setSelectedColumns,
        setExcludedColumns,
        setTargetColumn,
        setSelectedModels,
        setTrainingResult,
        clearTrainingResults,
        resetWizard,
      }}
    >
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard must be used within WizardProvider')
  return ctx
}
