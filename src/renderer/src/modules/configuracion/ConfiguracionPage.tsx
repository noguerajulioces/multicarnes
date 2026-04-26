import { useState, useEffect } from 'react'
import type { AppSetting, BackupFile } from '@shared/types'
import { formatDateTime } from '../../lib/utils'

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const all = await window.api.settings.getAll()
    const map: Record<string, string> = {}
    all.forEach((s: AppSetting) => { map[s.key] = s.value })
    setSettings(map)
    window.api.backup.list().then(setBackups)
  }

  const saveSetting = async (key: string, value: string) => {
    setSettings({ ...settings, [key]: value })
    await window.api.settings.set(key, value)
  }

  const handleBackup = async () => {
    setLoading(true)
    try {
      const path = await window.api.backup.create()
      alert(`Backup creado: ${path}`)
      window.api.backup.list().then(setBackups)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    }
    setLoading(false)
  }

  const handleRestore = async () => {
    if (!confirm('Se creará un backup del estado actual antes de restaurar. ¿Continuar?')) return
    const path = await window.api.backup.restore()
    if (path) {
      alert('Backup restaurado. La aplicación se reiniciará.')
    }
  }

  const handleSelectFolder = async () => {
    const folder = await window.api.backup.selectFolder()
    if (folder) saveSetting('backup_path', folder)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Datos del Negocio</h2>
          <div className="space-y-3">
            <div><label className="block text-sm text-text-muted mb-1">Nombre</label>
              <input value={settings.business_name || ''} onChange={(e) => saveSetting('business_name', e.target.value)}
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm text-text-muted mb-1">Dirección</label>
              <input value={settings.business_address || ''} onChange={(e) => saveSetting('business_address', e.target.value)}
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" /></div>
            <div><label className="block text-sm text-text-muted mb-1">Teléfono</label>
              <input value={settings.business_phone || ''} onChange={(e) => saveSetting('business_phone', e.target.value)}
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" /></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Impresora Térmica</h2>
          <div className="space-y-3">
            <div><label className="block text-sm text-text-muted mb-1">Nombre de impresora</label>
              <input value={settings.thermal_printer_name || ''} onChange={(e) => saveSetting('thermal_printer_name', e.target.value)}
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Ej: POS-80" /></div>
            <div><label className="block text-sm text-text-muted mb-1">Ancho de papel</label>
              <select value={settings.thermal_printer_width || '80'}
                onChange={(e) => saveSetting('thermal_printer_width', e.target.value)}
                className="border rounded-lg p-2 bg-white">
                <option value="58">58mm</option><option value="80">80mm</option>
              </select></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Backup</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-muted">Backup automático</label>
              <input type="checkbox" checked={settings.auto_backup === '1'}
                onChange={(e) => saveSetting('auto_backup', e.target.checked ? '1' : '0')} />
            </div>
            <div className="flex items-center gap-2">
              <input value={settings.backup_path || ''} readOnly
                className="flex-1 border rounded-lg p-2 bg-gray-50 text-sm" placeholder="Carpeta por defecto" />
              <button onClick={handleSelectFolder} className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Cambiar</button>
            </div>
            <div className="flex gap-3">
              <button onClick={handleBackup} disabled={loading}
                className="bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-hover disabled:opacity-50">
                {loading ? 'Creando...' : 'Hacer Backup Ahora'}
              </button>
              <button onClick={handleRestore}
                className="border border-orange-300 text-orange-600 px-4 py-2 rounded-lg text-sm hover:bg-orange-50">
                Restaurar Backup
              </button>
            </div>

            {backups.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-text-muted mb-2">Backups recientes:</p>
                <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                  {backups.slice(0, 10).map((b) => (
                    <div key={b.name} className="flex justify-between bg-bg-secondary px-2 py-1 rounded">
                      <span>{b.name}</span>
                      <span className="text-text-muted">{formatDateTime(b.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
