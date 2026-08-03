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
  Receipt,
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
import { DEFAULT_THANKS_MESSAGE } from '../../lib/ticket'

// Sample ticket used by the "Imprimir prueba" button. Lines are padded to the
// selected column width so the divider spans the full paper and the amount
// column hits the right edge — that's what makes width/cut miscalibration
// visible without having to ring up a real sale.
function buildTestTicketLines(
  cols: number,
  businessName: string
): { text: string; bold?: boolean }[] {
  const divider = '-'.repeat(cols)
  const center = (s: string): string =>
    s.length >= cols ? s.slice(0, cols) : ' '.repeat(Math.floor((cols - s.length) / 2)) + s
  const row = (l: string, r: string): string => {
    const space = cols - l.length - r.length
    return space > 1 ? l + ' '.repeat(space) + r : `${l} ${r}`.slice(0, cols)
  }
  return [
    { text: center('PRUEBA DE IMPRESION'), bold: true },
    { text: center(businessName || 'Multicarnes') },
    { text: divider },
    { text: 'Producto de ejemplo' },
    { text: row('  1 x 10.000', '10.000') },
    { text: 'Otro producto' },
    { text: row('  2 x 5.000', '10.000') },
    { text: divider },
    { text: row('TOTAL Gs.', '20.000'), bold: true },
    { text: divider },
    { text: center('Si la linea de guiones tiene') },
    { text: center('un margen parejo a cada lado,') },
    { text: center('el ancho esta bien calibrado.') },
    { text: '' },
    { text: center('Impresion OK!') },
    { text: '' }
  ]
}

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [printers, setPrinters] = useState<{ name: string; displayName: string }[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [testing, setTesting] = useState(false)
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

  const loadPrinters = useCallback(async (notify = false): Promise<void> => {
    setLoadingPrinters(true)
    try {
      const list = await window.api.print.listPrinters()
      setPrinters(list)
      if (notify) {
        toast.success(
          list.length === 0
            ? 'No se detectaron impresoras instaladas.'
            : `${list.length} impresora${list.length === 1 ? '' : 's'} detectada${list.length === 1 ? '' : 's'}.`
        )
      }
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoadingPrinters(false)
    }
  }, [])

  useEffect(() => {
    loadPrinters()
  }, [loadPrinters])

  const handleTestPrint = async (): Promise<void> => {
    setTesting(true)
    try {
      const cols = settings.thermal_printer_width === '58' ? 32 : 48
      const result = await window.api.print.ticket({
        lines: buildTestTicketLines(cols, settings.business_name || ''),
        cut: true
      })
      if (result.ok) {
        toast.success('Prueba enviada a la impresora')
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir la prueba.')
    } finally {
      setTesting(false)
    }
  }

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
        <Card data-tour="config-business">
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
                placeholder="Calle y número"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Ciudad</label>
              <Input
                value={settings.business_city || ''}
                onChange={(e) => saveSetting('business_city', e.target.value)}
                placeholder="Ej: Encarnación"
              />
              <p className="text-xs text-text-muted mt-1">
                Se imprime en su propia línea. Si la ciudad ya está dentro de Dirección, sacala de
                ahí para que no salga repetida.
              </p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">RUC</label>
              <Input
                value={settings.business_ruc || ''}
                onChange={(e) => saveSetting('business_ruc', e.target.value)}
                placeholder="Ej: 80012345-6"
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

        <Card data-tour="config-receipt">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'var(--gradient-kpi-teal)' }}
              >
                <Receipt size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-text-main">Comprobante</h2>
                <p className="text-xs text-text-muted">Mensajes al pie del ticket</p>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Mensaje adicional</label>
              <Input
                value={settings.receipt_extra_message || ''}
                onChange={(e) => saveSetting('receipt_extra_message', e.target.value)}
                placeholder="Ej: Cambios dentro de las 24hs con este ticket"
              />
              <p className="text-xs text-text-muted mt-1">
                Se imprime arriba del saludo. Dejalo vacío para no mostrarlo.
              </p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Saludo final</label>
              <Input
                value={settings.receipt_thanks_message ?? DEFAULT_THANKS_MESSAGE}
                onChange={(e) => saveSetting('receipt_thanks_message', e.target.value)}
                placeholder={DEFAULT_THANKS_MESSAGE}
              />
              <p className="text-xs text-text-muted mt-1">
                Última línea del ticket. Vaciálo para imprimir el comprobante sin saludo.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card data-tour="config-theme">
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

        <Card data-tour="config-login">
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

        <Card data-tour="config-printer">
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
                  onClick={() => loadPrinters(true)}
                  disabled={loadingPrinters}
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loadingPrinters ? 'animate-spin' : undefined} />
                  {loadingPrinters ? 'Buscando…' : 'Actualizar'}
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
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Modo de impresión</label>
              <Select
                value={settings.thermal_printer_mode === 'raster' ? 'raster' : 'escpos'}
                onChange={(e) => saveSetting('thermal_printer_mode', e.target.value)}
                className="max-w-[260px]"
              >
                <option value="escpos">ESC/POS (recomendado)</option>
                <option value="raster">Gráfico (compatibilidad)</option>
              </Select>
              <p className="text-xs text-text-muted mt-1">
                ESC/POS le habla directo al cabezal: texto más nítido y corte automático. Usá
                Gráfico sólo si tu impresora no acepta este modo.
              </p>
            </div>
            <div className="pt-1">
              <Button
                variant="secondary"
                onClick={handleTestPrint}
                disabled={testing || !settings.thermal_printer_name}
                className="rounded-xl"
              >
                <Printer size={14} />
                {testing ? 'Imprimiendo…' : 'Imprimir prueba'}
              </Button>
              <p className="text-xs text-text-muted mt-1.5">
                {settings.thermal_printer_name
                  ? 'Imprime un ticket de muestra para verificar el ancho y el corte.'
                  : 'Seleccioná una impresora para habilitar la prueba.'}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card data-tour="config-tutorials">
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
