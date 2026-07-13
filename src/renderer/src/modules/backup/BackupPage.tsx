import { useState, useEffect } from 'react'
import type { AppSetting, BackupFile } from '@shared/types'
import { formatDateTime } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { confirm } from '../../lib/confirm'
import { Clock, HardDrive, FolderOpen, Database, RotateCcw, Save, FileArchive } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  TourButton
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { backupTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function BackupPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [operation, setOperation] = useState<'backup' | 'restore' | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 8
  const loading = operation !== null

  useEffect(() => {
    let cancelled = false

    Promise.all([window.api.settings.getAll(), window.api.backup.list()])
      .then(([all, availableBackups]) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        all.forEach((setting: AppSetting) => {
          map[setting.key] = setting.value
        })
        setSettings(map)
        setBackups(availableBackups)
      })
      .catch(handleApiError)

    return () => {
      cancelled = true
    }
  }, [])

  const saveSetting = async (key: string, value: string): Promise<void> => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    try {
      await window.api.settings.set(key, value)
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleBackup = async (): Promise<void> => {
    setOperation('backup')
    try {
      const path = await window.api.backup.create()
      toast.success(`Backup creado: ${path}`)
      setPage(1)
      window.api.backup.list().then(setBackups)
      window.api.notify.show('Backup creado', `Se guardó en ${path}`).catch(() => {})
    } catch (err: unknown) {
      handleApiError(err)
    } finally {
      setOperation(null)
    }
  }

  const handleRestore = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Restaurar backup',
      message:
        'Esto reemplazará la base de datos actual.\nSe creará un backup automático del estado actual antes de continuar.',
      confirmLabel: 'Restaurar',
      danger: true
    })
    if (!ok) return
    setOperation('restore')
    let restored = false
    try {
      const path = await window.api.backup.restore()
      if (path) {
        restored = true
        toast.success('Backup restaurado. Reiniciando...')
      }
    } catch (err: unknown) {
      handleApiError(err)
    } finally {
      if (!restored) setOperation(null)
    }
  }

  const handleSelectFolder = async (): Promise<void> => {
    try {
      const folder = await window.api.backup.selectFolder()
      if (folder) saveSetting('backup_path', folder)
    } catch (err) {
      handleApiError(err)
    }
  }

  const scheduleEnabled = settings.backup_schedule_enabled === '1'
  const scheduleTime = settings.backup_schedule_time || '22:00'

  const { startTour } = usePageTour({ key: 'backup', steps: backupTourSteps })

  const pageBackups = backups.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        title="Backup"
        subtitle="Resguardá la base de datos del negocio y restaurá copias previas"
        actions={<TourButton onClick={startTour} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <Card data-tour="backup-actions">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: 'var(--gradient-kpi-green)' }}
                >
                  <Save size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-text-main">Acciones</h2>
                  <p className="text-xs text-text-muted">Crear o restaurar un backup manualmente</p>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex gap-3 flex-wrap">
                <Button onClick={handleBackup} disabled={loading} size="lg" className="rounded-xl">
                  <Database size={16} />
                  {operation === 'backup' ? 'Creando...' : 'Hacer Backup Ahora'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="rounded-xl border-warning-500 text-warning-700 hover:bg-warning-50"
                  onClick={handleRestore}
                  disabled={loading}
                >
                  <RotateCcw size={16} />
                  {operation === 'restore' ? 'Restaurando...' : 'Restaurar Backup'}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card data-tour="backup-folder">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: 'var(--gradient-kpi-purple)' }}
                >
                  <FolderOpen size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-text-main">Carpeta de destino</h2>
                  <p className="text-xs text-text-muted">Dónde se guardan los archivos de backup</p>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-2">
                <Input
                  value={settings.backup_path || ''}
                  readOnly
                  className="flex-1 bg-surface-muted"
                  placeholder="Carpeta por defecto (userData/backups)"
                />
                <Button variant="secondary" onClick={handleSelectFolder} disabled={loading}>
                  <FolderOpen size={14} />
                  Cambiar
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card data-tour="backup-schedule">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: 'var(--gradient-kpi-blue)' }}
                >
                  <Clock size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-text-main">Backup Automático</h2>
                  <p className="text-xs text-text-muted">
                    Cuándo crear copias sin intervención manual
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_backup === '1'}
                  disabled={loading}
                  onChange={(e) => saveSetting('auto_backup', e.target.checked ? '1' : '0')}
                  className="w-4 h-4 mt-0.5 rounded accent-brand shrink-0"
                />
                <div>
                  <span className="text-sm font-medium text-text-main">
                    Crear backup al cerrar caja
                  </span>
                  <p className="text-xs text-text-muted mt-0.5">
                    Cada vez que se cierra una caja se genera una copia automáticamente.
                  </p>
                </div>
              </label>

              <div className="border-t border-border pt-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    disabled={loading}
                    onChange={(e) =>
                      saveSetting('backup_schedule_enabled', e.target.checked ? '1' : '0')
                    }
                    className="w-4 h-4 mt-0.5 rounded accent-brand shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-text-main">
                      Backup diario programado
                    </span>
                    <p className="text-xs text-text-muted mt-0.5">
                      Una copia automática cada día a una hora fija, mientras la app esté abierta.
                    </p>
                  </div>
                </label>

                <div
                  className={`flex items-center gap-3 ml-7 ${
                    !scheduleEnabled ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  <label className="text-sm text-text-muted">Hora:</label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    disabled={loading}
                    onChange={(e) => saveSetting('backup_schedule_time', e.target.value)}
                    className="w-32 tabular-nums"
                  />
                </div>

                {scheduleEnabled && (
                  <div className="ml-7 px-3 py-2 bg-info-50 text-info-700 rounded-lg text-xs">
                    Próximo backup programado a las{' '}
                    <span className="font-semibold tabular-nums">{scheduleTime}</span> hs.
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card data-tour="backup-history">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: 'var(--gradient-kpi-teal)' }}
                >
                  <HardDrive size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-text-main">Historial de Backups</h2>
                  <p className="text-xs text-text-muted">
                    {backups.length === 0
                      ? 'Aún no hay copias guardadas'
                      : `${backups.length} archivo${backups.length === 1 ? '' : 's'} disponible${backups.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {backups.length === 0 ? (
                <EmptyState
                  icon={<HardDrive size={36} />}
                  title="Sin backups"
                  description='Hacé tu primer backup tocando "Hacer Backup Ahora".'
                />
              ) : (
                <ul className="space-y-2">
                  {pageBackups.map((b) => (
                    <li
                      key={b.name}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-surface-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileArchive size={16} className="text-text-muted shrink-0" />
                        <span className="font-medium text-sm text-text-main truncate">
                          {b.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-muted shrink-0">
                        <span className="tabular-nums">{formatSize(b.size)}</span>
                        <span className="tabular-nums">{formatDateTime(b.date)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
            {backups.length > PER_PAGE && (
              <Pagination
                page={page}
                perPage={PER_PAGE}
                total={backups.length}
                onPageChange={setPage}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
