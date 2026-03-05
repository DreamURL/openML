import { useState, useRef, useCallback, useEffect } from 'react'
import type { WorkerMessage, WorkerCommand } from './useWorker'
import type { ModelType } from '@/context/WizardContext'

export interface ModelWorkerState {
  progress: number
  progressMessage: string
  result: any
  error: string | null
  isRunning: boolean
}

const workerPaths: Record<ModelType, string> = {
  multiple_regression: 'workers/regression.worker.js',
  logistic: 'workers/logistic.worker.js',
  random_forest: 'workers/rf.worker.js',
  ann: 'workers/ann.worker.js',
  xgboost: 'workers/xgboost.worker.js',
  kmeans: 'workers/kmeans.worker.js',
  pca: 'workers/pca.worker.js',
}

const workerCommands: Record<ModelType, string> = {
  multiple_regression: 'RUN_REGRESSION',
  logistic: 'RUN_LOGISTIC',
  random_forest: 'RUN_RF',
  ann: 'RUN_ANN',
  xgboost: 'RUN_XGBOOST',
  kmeans: 'RUN_KMEANS',
  pca: 'RUN_PCA',
}

export interface ModelTrainingConfig {
  modelType: ModelType
  payload: Record<string, unknown>
}

interface UseMultiWorkerResult {
  runAll: (configs: ModelTrainingConfig[]) => void
  states: Map<ModelType, ModelWorkerState>
  cancelAll: () => void
  isAnyRunning: boolean
}

export function useMultiWorker(): UseMultiWorkerResult {
  const [states, setStates] = useState<Map<ModelType, ModelWorkerState>>(new Map())
  const workersRef = useRef<Map<ModelType, Worker>>(new Map())

  const BASE = import.meta.env.BASE_URL

  const updateState = useCallback((model: ModelType, update: Partial<ModelWorkerState>) => {
    setStates((prev) => {
      const next = new Map(prev)
      const current = next.get(model) || { progress: 0, progressMessage: '', result: null, error: null, isRunning: false }
      next.set(model, { ...current, ...update })
      return next
    })
  }, [])

  const runAll = useCallback((configs: ModelTrainingConfig[]) => {
    // Terminate existing workers
    workersRef.current.forEach((w) => w.terminate())
    workersRef.current.clear()

    // Initialize states
    const initial = new Map<ModelType, ModelWorkerState>()
    for (const config of configs) {
      initial.set(config.modelType, { progress: 0, progressMessage: '', result: null, error: null, isRunning: true })
    }
    setStates(initial)

    // Generate a shared random seed so all workers produce the same shuffle
    const sharedSeed = Math.floor(Math.random() * 2147483647)

    // Launch workers in parallel
    for (const config of configs) {
      const path = workerPaths[config.modelType]
      if (!path) continue

      const worker = new Worker(`${BASE}${path}`)
      workersRef.current.set(config.modelType, worker)

      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const { type: msgType } = e.data
        switch (msgType) {
          case 'PROGRESS':
            updateState(config.modelType, {
              progress: e.data.percent ?? 0,
              progressMessage: e.data.message ?? '',
            })
            break
          case 'RESULT':
            updateState(config.modelType, {
              result: e.data.result,
              isRunning: false,
              progress: 100,
            })
            break
          case 'ERROR':
            updateState(config.modelType, {
              error: e.data.error ?? 'Unknown error',
              isRunning: false,
            })
            break
        }
      }

      worker.onerror = (err) => {
        updateState(config.modelType, {
          error: err.message || 'Worker error',
          isRunning: false,
        })
      }

      const command: WorkerCommand = {
        type: workerCommands[config.modelType],
        payload: { ...config.payload, sharedSeed },
      }
      worker.postMessage(command)
    }
  }, [BASE, updateState])

  const cancelAll = useCallback(() => {
    workersRef.current.forEach((w) => w.terminate())
    workersRef.current.clear()
    setStates((prev) => {
      const next = new Map(prev)
      next.forEach((state, key) => {
        if (state.isRunning) {
          next.set(key, { ...state, isRunning: false, progress: 0, progressMessage: '' })
        }
      })
      return next
    })
  }, [])

  const isAnyRunning = Array.from(states.values()).some((s) => s.isRunning)

  useEffect(() => {
    return () => {
      workersRef.current.forEach((w) => w.terminate())
    }
  }, [])

  return { runAll, states, cancelAll, isAnyRunning }
}
