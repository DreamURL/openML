import { useCallback } from 'react'

export function useModelIO() {
  const saveModel = useCallback((modelData: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(modelData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const loadModel = useCallback((file: File): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target!.result as string))
        } catch {
          reject(new Error('Invalid JSON file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }, [])

  return { saveModel, loadModel }
}
