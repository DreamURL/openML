import { useState } from 'react'
import { useData, type DataRow } from '@/context/DataContext'
import { DataUpload } from '@/components/data/DataUpload'
import { DataPreview } from '@/components/data/DataPreview'
import { useNavigate } from 'react-router-dom'
import { Grid3x3, SlidersHorizontal, GitBranch, Layers, Binary, TreePine, Database } from 'lucide-react'
import Papa from 'papaparse'

const BASE = import.meta.env.BASE_URL

const algorithms = [
  {
    to: '/correlation',
    icon: Grid3x3,
    name: 'Correlation Analysis',
    desc: 'Pearson & Spearman correlation matrix',
  },
  {
    to: '/preprocessing',
    icon: SlidersHorizontal,
    name: 'Preprocessing',
    desc: 'Missing values, normalization, filtering & outlier removal',
  },
  {
    to: '/kmeans',
    icon: GitBranch,
    name: 'K-Means Clustering',
    desc: 'Unsupervised clustering of data points into k groups',
  },
  {
    to: '/pca',
    icon: Layers,
    name: 'PCA',
    desc: 'Dimensionality reduction and anomaly detection',
  },
  {
    to: '/logistic',
    icon: Binary,
    name: 'Logistic Regression',
    desc: 'Binary classification with probability estimation',
  },
  {
    to: '/forest',
    icon: TreePine,
    name: 'Random Forest',
    desc: 'Ensemble method for classification and regression',
  },
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
          Welcome to <span className="text-accent">open</span>ML
        </h2>
        <p className="text-text-muted mt-1">
          Upload your dataset and explore machine learning algorithms — all running in your browser.
        </p>
      </div>

      {/* Sample Dataset */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-accent" />
          <h3 className="text-sm font-semibold">Sample Dataset</h3>
          <span className="text-xs text-text-muted">— try without uploading</span>
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
          <h3 className="text-lg font-semibold mb-4">Choose an Algorithm</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {algorithms.map(({ to, icon: Icon, name, desc }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="bg-surface border border-border rounded-xl p-4 text-left hover:border-accent/50 hover:bg-surface-hover transition-all group"
              >
                <Icon size={24} className="text-accent mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-medium text-sm">{name}</h4>
                <p className="text-xs text-text-muted mt-1">{desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
