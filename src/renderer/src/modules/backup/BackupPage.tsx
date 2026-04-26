import { useState, useEffect } from 'react'
import type { AppSetting, BackupFile } from '@shared/types'
import { formatDateTime } from '../../lib/utils'
import { Clock } from 'lucide-react'

export default function BackupPage() {
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
    setSettings((prev) => ({ ...prev, [key]: value }))
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

  const scheduleEnabled = settings.backup_schedule_enabled === '1'
  const scheduleTime = settings.backup_schedule_time || '22:00'

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Backup</h1>

      <div className="space-y-6">
        {/* Backup automático al cerrar caja */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Al cerrar caja</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.auto_backup === '1'}
              onChange={(e) => saveSetting('auto_backup', e.target.checked ? '1' : '0')}
              className="w-4 h-4 accent-brand" />
            <span className="text-sm">Crear backup automático cada vez que se cierra una caja</span>
          </label>
        </div>

        {/* Backup programado diario */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} />
            Backup programado diario
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={scheduleEnabled}
                onChange={(e) => saveSetting('backup_schedule_enabled', e.target.checked ? '1' : '0')}
                className="w-4 h-4 accent-brand" />
              <span className="text-sm">Activar backup diario automático</span>
            </label>

            <div className={`flex items-center gap-3 ${!scheduleEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="text-sm text-text-muted">Hora del backup:</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => saveSetting('backup_schedule_time', e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            {scheduleEnabled && (
              <p className="text-xs text-text-muted bg-bg-secondary px-3 py-2 rounded-lg">
                Se creará un backup automáticamente todos los días a las <strong>{scheduleTime}</strong> hs,
                siempre que la aplicación esté abierta.
              </p>
            )}
          </div>
        </div>

        {/* Carpeta destino */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Carpeta de destino</h2>
          <div className="flex items-center gap-2">
            <input value={settings.backup_path || ''} readOnly
              className="flex-1 border rounded-lg p-2 bg-gray-50 text-sm" placeholder="Carpeta por defecto (userData/backups)" />
            <button onClick={handleSelectFolder} className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Cambiar</button>
          </div>
        </div>

        {/* Acciones manuales */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Acciones</h2>
          <div className="flex gap-3">
            <button onClick={handleBackup} disabled={loading}
              className="bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-hover disabled:opacity-50">
              {loading ? 'Creando...' : 'Hacer Backup Ahora'}
            </button>
            <button onClick={handleRestore}
              className="border border-orange-300 text-orange-600 px-6 py-3 rounded-lg hover:bg-orange-50">
              Restaurar Backup
            </button>
          </div>
        </div>

        {/* Historial */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Historial de Backups</h2>
          {backups.length > 0 ? (
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.name} className="flex justify-between items-center bg-bg-secondary px-4 py-2 rounded-lg text-sm">
                  <span className="font-medium">{b.name}</span>
                  <div className="flex items-center gap-4 text-text-muted">
                    <span>{(b.size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>{formatDateTime(b.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm">No hay backups registrados.</p>
          )}
        </div>
      </div>
    </div>
  )
}
