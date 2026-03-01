import { Cpu, Sun, Moon } from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { useTheme } from '@/context/ThemeContext'

interface HeaderProps {
  menuButton?: ReactNode
}

export function Header({ menuButton }: HeaderProps) {
  const [backend, setBackend] = useState<string>('detecting...')
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    async function detectBackend() {
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
        if (gl) {
          setBackend('WebGL')
        } else {
          setBackend('CPU')
        }
      } catch {
        setBackend('CPU')
      }
    }
    detectBackend()
  }, [])

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2">
        {menuButton}
        <span className="lg:hidden text-sm font-bold"><span className="text-accent">open</span>ML</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Cpu size={14} />
          <span className="hidden sm:inline">Backend: </span>
          <span>{backend}</span>
          <span className={`w-2 h-2 rounded-full ${backend === 'CPU' ? 'bg-warning' : 'bg-success'}`} />
        </div>
      </div>
    </header>
  )
}
