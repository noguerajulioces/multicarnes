import { useState, useEffect } from 'react'
import type { AppSetting } from '@shared/types'

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    window.api.settings.getAll().then((all) => {
      const map: Record<string, string> = {}
      all.forEach((s: AppSetting) => { map[s.key] = s.value })
      setSettings(map)
    })
  }, [])

  const saveSetting = async (key: string, value: string) => {
    setSettings({ ...settings, [key]: value })
    await window.api.settings.set(key, value)
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
      </div>
    </div>
  )
}
