import { useState, useEffect } from 'react'
import type { AppSetting } from '@shared/types'
import { useThemeStore } from '../../store/theme.store'
import { Sun, Moon, Store, Palette, KeyRound, Printer } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Select
} from '../../components/ui'

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  useEffect(() => {
    window.api.settings.getAll().then((all) => {
      const map: Record<string, string> = {}
      all.forEach((s: AppSetting) => {
        map[s.key] = s.value
      })
      setSettings(map)
    })
  }, [])

  const saveSetting = async (key: string, value: string): Promise<void> => {
    setSettings({ ...settings, [key]: value })
    await window.api.settings.set(key, value)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        title="Configuración"
        subtitle="Personalizá los datos del negocio, la apariencia y la impresora"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
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

      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
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

      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
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

      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
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
            <label className="block text-sm text-text-muted mb-1.5">Nombre de la impresora</label>
            <Input
              value={settings.thermal_printer_name || ''}
              onChange={(e) => saveSetting('thermal_printer_name', e.target.value)}
              placeholder="Ej: POS-80"
            />
            <p className="text-xs text-text-muted mt-1">
              Tal como aparece en el sistema operativo
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
