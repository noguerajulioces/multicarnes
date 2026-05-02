import './store/theme.store'
import { TourProvider } from '@reactour/tour'
import TitleBar from './components/TitleBar'
import { Toaster, ConfirmHost, HotkeysHelp } from './components/ui'
import AppRouter from './router'
import { ventasTourSteps } from './lib/tour-steps'

function App(): React.JSX.Element {
  return (
    <TourProvider
      steps={ventasTourSteps}
      padding={{ mask: 6, popover: 12 }}
      styles={{
        popover: (base) => ({
          ...base,
          background: 'var(--color-surface)',
          color: 'var(--color-text-main)',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          fontSize: 14,
          maxWidth: 360
        }),
        maskArea: (base) => ({ ...base, rx: 8 }),
        badge: (base) => ({ ...base, background: 'var(--color-brand)' }),
        dot: (base, opts) => ({
          ...base,
          background: opts?.current ? 'var(--color-brand)' : 'var(--color-border)'
        }),
        close: (base) => ({ ...base, color: 'var(--color-text-muted)', top: 10, right: 10 })
      }}
      disableInteraction
      showCloseButton
    >
      <div className="flex flex-col h-screen">
        <TitleBar />
        <div className="flex-1 min-h-0">
          <AppRouter />
        </div>
        <Toaster />
        <ConfirmHost />
        <HotkeysHelp />
      </div>
    </TourProvider>
  )
}

export default App
