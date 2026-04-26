import './store/theme.store'
import TitleBar from './components/TitleBar'
import { Toaster, ConfirmHost, HotkeysHelp } from './components/ui'
import AppRouter from './router'

function App(): React.JSX.Element {
  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <div className="flex-1 min-h-0">
        <AppRouter />
      </div>
      <Toaster />
      <ConfirmHost />
      <HotkeysHelp />
    </div>
  )
}

export default App
