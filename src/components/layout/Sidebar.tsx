import { NavLink } from 'react-router-dom'
import { Home, Grid3x3, SlidersHorizontal, GitBranch, Layers, Binary, TreePine } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useLang } from '@/context/LangContext'
import { t, type StringKey } from '@/i18n/strings'

const navItems: { to: string; icon: typeof Home; labelKey: StringKey }[] = [
  { to: '/', icon: Home, labelKey: 'home' },
  { to: '/correlation', icon: Grid3x3, labelKey: 'correlationName' },
  { to: '/preprocessing', icon: SlidersHorizontal, labelKey: 'preprocessingName' },
  { to: '/kmeans', icon: GitBranch, labelKey: 'kmeansName' },
  { to: '/pca', icon: Layers, labelKey: 'pcaName' },
  { to: '/logistic', icon: Binary, labelKey: 'logisticName' },
  { to: '/forest', icon: TreePine, labelKey: 'forestName' },
]

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { fileName, rowCount, numericalColumns } = useData()
  const { lang } = useLang()

  return (
    <aside className="w-60 min-h-screen bg-surface border-r border-border flex flex-col shrink-0">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-accent">open</span>ML
        </h1>
        <p className="text-xs text-text-muted mt-1">{t('mlInBrowser', lang)}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'text-white bg-accent/20 border-r-2 border-accent'
                  : 'text-text-muted hover:text-accent hover:bg-accent/10'
              }`
            }
          >
            <Icon size={18} />
            <span>{t(labelKey, lang)}</span>
          </NavLink>
        ))}
      </nav>

      {fileName && (
        <div className="p-4 mx-3 mb-3 rounded-lg bg-bg border border-border">
          <p className="text-xs text-text-muted mb-1">{t('loadedDataset', lang)}</p>
          <p className="text-sm font-medium truncate">{fileName}</p>
          <div className="flex gap-3 mt-2 text-xs text-text-muted">
            <span>{rowCount.toLocaleString()} {t('rows', lang)}</span>
            <span>{numericalColumns.length} {t('numeric', lang)}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
