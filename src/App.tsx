import { HashRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from '@/context/DataContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { Layout } from '@/components/layout/Layout'
import { Home } from '@/pages/Home'
import { CorrelationAnalysis } from '@/pages/CorrelationAnalysis'
import { Preprocessing } from '@/pages/Preprocessing'
import { KMeans } from '@/pages/KMeans'
import { PCA } from '@/pages/PCA'
import { LogisticRegression } from '@/pages/LogisticRegression'
import { RandomForest } from '@/pages/RandomForest'

export default function App() {
  return (
    <ThemeProvider>
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/correlation" element={<CorrelationAnalysis />} />
            <Route path="/preprocessing" element={<Preprocessing />} />
            <Route path="/kmeans" element={<KMeans />} />
            <Route path="/pca" element={<PCA />} />
            <Route path="/logistic" element={<LogisticRegression />} />
            <Route path="/forest" element={<RandomForest />} />
          </Route>
        </Routes>
      </HashRouter>
    </DataProvider>
    </ThemeProvider>
  )
}
