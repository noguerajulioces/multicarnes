import { useState, useEffect, useCallback } from 'react'
import type { AppSetting } from '@shared/types'
import { useThemeStore } from '../../store/theme.store'
import { useTourStore } from '../../store/tour.store'
import {
  Sun,
  Moon,
  Store,
  Palette,
  KeyRound,
  Printer,
  HelpCircle,
  RotateCcw,
  RefreshCw
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Select,
  TourButton
} from '../../components/ui'
import { toast } from '../../lib/toast'
import { usePageTour } from '../../lib/use-page-tour'
import { configTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [printers, setPrinters] = useState<{ name: string; displayName: string }[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const resetAllTours = useTourStore((s) => s.resetAll)

  useEffect(() => {
    window.api.settings.getAll().then((all) => {
      const map: Record<string, string> = {}
      all.forEach((s: AppSetting) => {
        map[s.key] = s.value
      })
      setSettings(map)
    })
  }, [])

  const loadPrinters = useCallback(async (): Promise<void> => {
    setLoadingPrinters(true)
    try {
      setPrinters(await window.api.print.listPrinters())
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoadingPrinters(false)
    }
  }, [])

  useEffect(() => {
    loadPrinters()
  }, [loadPrinters])

  const saveSetting = async (key: string, value: string): Promise<void> => {
    setSettings({ ...settings, [key]: value })
    try {
      await window.api.settings.set(key, value)
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleResetTours = (): void => {
    resetAllTours()
    toast.success('Tutoriales reiniciados. Aparecerán al entrar a cada pantalla.')
  }

  const { startTour } = usePageTour({ key: 'config', steps: configTourSteps })

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        title="Configuración"
        subtitle="Personalizá los datos del negocio, la apariencia y la impresora"
        actions={<TourButton onClick={startTour} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Card
          data-tour="config-business"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'var(--gradient-kpi-blue)' }}
              >
                <Store size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-text-main">Datos del Negocio</h2>
                <p className="text-xs text-text-muted">Aparecen en los tickets y reportes</p>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Nombre del negocio</label>
              <Input
                value={settings.business_name || ''}
                onChange={(e) => saveSetting('business_name', e.target.value)}
                placeholder="Ej: Multicarnes S.R.L."
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Dirección</label>
              <Input
                value={settings.business_address || ''}
                onChange={(e) => saveSetting('business_address', e.target.value)}
                placeholder="Calle, número, ciudad"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Teléfono</label>
              <Input
                value={settings.business_phone || ''}
                onChange={(e) => saveSetting('business_phone', e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </CardBody>
        </Card>

        <Card
          data-tour="config-theme"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'var(--gradient-kpi-purple)' }}
              >
                <Palette size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-text-main">Apariencia</h2>
                <p className="text-xs text-text-muted">Tema visual de la aplicación</p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <ThemeOption
                active={theme === 'light'}
                onClick={() => setTheme('light')}
                icon={<Sun size={18} />}
                label="Claro"
                description="Para uso de día o ambientes iluminados"
              />
              <ThemeOption
                active={theme === 'dark'}
                onClick={() => setTheme('dark')}
                icon={<Moon size={18} />}
                label="Oscuro"
                description="Para uso de noche o ambientes con poca luz"
              />
            </div>
          </CardBody>
        </Card>

        <Card
          data-tour="config-login"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'var(--gradient-kpi-teal)' }}
              >
                <KeyRound size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-text-main">Login</h2>
                <p className="text-xs text-text-muted">Cómo se ingresa al sistema</p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.login_keypad_enabled === '1'}
                onChange={(e) => saveSetting('login_keypad_enabled', e.target.checked ? '1' : '0')}
                className="w-4 h-4 mt-0.5 rounded accent-brand shrink-0"
              />
              <div>
                <span className="text-sm font-medium text-text-main">
                  Mostrar teclado numérico en pantalla
                </span>
                <p className="text-xs text-text-muted mt-0.5">
                  Útil si la app se usa en pantalla táctil. Se aplica al ingresar el PIN.
                </p>
              </div>
            </label>
          </CardBody>
        </Card>

        <Card
          data-tour="config-printer"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'var(--gradient-kpi-green)' }}
              >
                <Printer size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-text-main">Impresora Térmica</h2>
                <p className="text-xs text-text-muted">Para imprimir tickets de venta</p>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-text-muted">Impresora</label>
                <button
                  type="button"
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loadingPrinters ? 'animate-spin' : undefined} />
                  Actualizar
                </button>
              </div>
              <Select
                value={settings.thermal_printer_name || ''}
                onChange={(e) => saveSetting('thermal_printer_name', e.target.value)}
              >
                <option value="">— Seleccioná una impresora —</option>
                {settings.thermal_printer_name &&
                  !printers.some((p) => p.name === settings.thermal_printer_name) && (
                    <option value={settings.thermal_printer_name}>
                      {settings.thermal_printer_name} (no detectada)
                    </option>
                  )}
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-text-muted mt-1">
                {printers.length === 0
                  ? 'No se detectaron impresoras. Conectá la impresora y tocá Actualizar.'
                  : 'Se detectan automáticamente las impresoras instaladas en el sistema.'}
              </p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Ancho de papel</label>
              <Select
                value={settings.thermal_printer_width || '80'}
                onChange={(e) => saveSetting('thermal_printer_width', e.target.value)}
                className="max-w-[160px]"
              >
                <option value="58">58 mm</option>
                <option value="80">80 mm</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        <Card
          data-tour="config-tutorials"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'var(--gradient-kpi-blue)' }}
              >
                <HelpCircle size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-text-main">Tutoriales</h2>
                <p className="text-xs text-text-muted">Volver a mostrar la guía en cada pantalla</p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-text-muted mb-3">
              Reinicia el progreso de los tutoriales. La próxima vez que entres a cada pantalla
              vuelve a aparecer el recorrido guiado.
            </p>
            <Button variant="secondary" onClick={handleResetTours} className="rounded-xl">
              <RotateCcw size={14} />
              Reiniciar tutoriales
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

interface ThemeOptionProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
}

function ThemeOption({
  active,
  onClick,
  icon,
  label,
  description
}: ThemeOptionProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 transition-colors text-left',
        active
          ? 'border-brand bg-brand-light/40'
          : 'border-border bg-surface hover:bg-surface-muted'
      )}
    >
      <div
        className={cn(
          'inline-flex items-center gap-2 font-medium',
          active ? 'text-brand' : 'text-text-main'
        )}
      >
        {icon}
        {label}
      </div>
      <p className="text-xs text-text-muted leading-snug">{description}</p>
    </button>
  )
}
