import { useState, useRef, useCallback, useEffect } from 'react'

export interface WorkerMessage {
  type: 'BACKEND_READY' | 'PROGRESS' | 'RESULT' | 'ERROR'
  backend?: string
  percent?: number
  message?: string
  result?: unknown
  error?: string
}

export interface WorkerCommand {
  type: string
  payload?: unknown
}

interface UseWorkerResult<T> {
  run: (command: WorkerCommand) => void
  progress: number
  progressMessage: string
  result: T | null
  error: string | null
  isRunning: boolean
  cancel: () => void
}

export function useWorker<T = unknown>(workerPath: string): UseWorkerResult<T> {
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  const createWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
    }
    const worker = new Worker(workerPath)
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const { type } = e.data
      switch (type) {
        case 'BACKEND_READY':
          break
        case 'PROGRESS':
          setProgress(e.data.percent ?? 0)
          if (e.data.message) setProgressMessage(e.data.message)
          break
        case 'RESULT':
          setResult(e.data.result as T)
          setIsRunning(false)
          setProgress(100)
          break
        case 'ERROR':
          setError(e.data.error ?? 'Unknown error')
          setIsRunning(false)
          break
      }
    }
    worker.onerror = (e) => {
      setError(e.message || 'Worker error')
      setIsRunning(false)
    }
    workerRef.current = worker
    return worker
  }, [workerPath])

  const run = useCallback(
    (command: WorkerCommand) => {
      setProgress(0)
      setProgressMessage('')
      setResult(null)
      setError(null)
      setIsRunning(true)
      const worker = createWorker()
      worker.postMessage(command)
    },
    [createWorker],
  )

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setIsRunning(false)
    setProgress(0)
    setProgressMessage('')
  }, [])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  return { run, progress, progressMessage, result, error, isRunning, cancel }
}
