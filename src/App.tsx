import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { TemplateSelectionPage } from './pages/TemplateSelectionPage'
import { WizardPage } from './pages/WizardPage'
import { ResultsPage } from './pages/ResultsPage'
import { ExportPage } from './pages/ExportPage'
import { NotFoundPage } from './pages/NotFoundPage'

/**
 * Root application component. Sets up routing and theme management.
 */
function App() {
  const { theme, toggleTheme } = useTheme()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
          <Route index element={<HomePage />} />
          <Route path="templates" element={<TemplateSelectionPage />} />
          <Route path="wizard" element={<WizardPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
