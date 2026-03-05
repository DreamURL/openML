import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from '@/context/DataContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { LangProvider } from '@/context/LangContext'
import { WizardProvider } from '@/context/WizardContext'
import { WizardLayout } from '@/components/layout/WizardLayout'
import { StepUpload } from '@/pages/wizard/StepUpload'
import { StepProcessing } from '@/pages/wizard/StepProcessing'
import { StepTraining } from '@/pages/wizard/StepTraining'

export default function App() {
  return (
    <ThemeProvider>
    <LangProvider>
    <DataProvider>
    <WizardProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<WizardLayout />}>
            <Route path="/" element={<StepUpload />} />
            <Route path="/processing" element={<StepProcessing />} />
            <Route path="/training" element={<StepTraining />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WizardProvider>
    </DataProvider>
    </LangProvider>
    </ThemeProvider>
  )
}
