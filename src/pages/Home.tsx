import { useState } from 'react'
import { useData, type DataRow } from '@/context/DataContext'
import { DataUpload } from '@/components/data/DataUpload'
import { DataPreview } from '@/components/data/DataPreview'
import { useNavigate } from 'react-router-dom'
import { Grid3x3, SlidersHorizontal, GitBranch, Layers, Binary, TreePine, Database } from 'lucide-react'
import { useLang } from '@/context/LangContext'
import { t, type StringKey } from '@/i18n/strings'
import Papa from 'papaparse'

const BASE = import.meta.env.BASE_URL

const algorithms: { to: string; icon: typeof Grid3x3; nameKey: StringKey; descKey: StringKey }[] = [
  { to: '/correlation', icon: Grid3x3, nameKey: 'correlationName', descKey: 'correlationDesc' },
  { to: '/preprocessing', icon: SlidersHorizontal, nameKey: 'preprocessingName', descKey: 'preprocessingDesc' },
  { to: '/kmeans', icon: GitBranch, nameKey: 'kmeansName', descKey: 'kmeansDesc' },
  { to: '/pca', icon: Layers, nameKey: 'pcaName', descKey: 'pcaDesc' },
  { to: '/logistic', icon: Binary, nameKey: 'logisticName', descKey: 'logisticDesc' },
  { to: '/forest', icon: TreePine, nameKey: 'forestName', descKey: 'forestDesc' },
]

const sampleDatasets = [
  {
    name: 'Boston Housing',
    file: 'boston_housing.csv',
    desc: '162 rows, 13 features — predict median home value (MEDV)',
  },
]

export function Home() {
  const { rawData, setDataset } = useData()
  const navigate = useNavigate()
  const { lang } = useLang()
  const [loadingSample, setLoadingSample] = useState(false)

  const loadSample = async (file: string, name: string) => {
    setLoadingSample(true)
    try {
      const res = await fetch(`${BASE}samples/${file}`)
      const text = await res.text()
      Papa.parse<DataRow>(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            setDataset(results.data, name)
          }
          setLoadingSample(false)
        },
        error: () => setLoadingSample(false),
      })
    } catch {
      setLoadingSample(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold">
          {t('welcomeTo', lang)} <span className="text-accent">open</span>ML
        </h2>
        <p className="text-text-muted mt-1">
          {t('homeDesc', lang)}
        </p>
      </div>

      {/* Sample Dataset */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-accent" />
          <h3 className="text-sm font-semibold">{t('sampleDataset', lang)}</h3>
          <span className="text-xs text-text-muted">{t('trySample', lang)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sampleDatasets.map((ds) => (
            <button
              key={ds.file}
              onClick={() => loadSample(ds.file, ds.name)}
              disabled={loadingSample}
              className="flex items-center gap-3 bg-bg border border-border rounded-lg px-4 py-2.5 text-left hover:border-accent/50 hover:bg-surface-hover transition-all disabled:opacity-50"
            >
              <div>
                <p className="text-sm font-medium">{ds.name}</p>
                <p className="text-xs text-text-muted">{ds.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <DataUpload />
      <DataPreview />

      {rawData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">{t('chooseAlgorithm', lang)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {algorithms.map(({ to, icon: Icon, nameKey, descKey }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="bg-surface border border-border rounded-xl p-4 text-left hover:border-accent/50 hover:bg-surface-hover transition-all group"
              >
                <Icon size={24} className="text-accent mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-medium text-sm">{t(nameKey, lang)}</h4>
                <p className="text-xs text-text-muted mt-1">{t(descKey, lang)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
