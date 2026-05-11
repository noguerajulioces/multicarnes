import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './modules/login/LoginPage'
import DashboardPage from './modules/dashboard/DashboardPage'
import CajaPage from './modules/caja/CajaPage'
import AperturaCajaPage from './modules/caja/AperturaCajaPage'
import CierreCajaPage from './modules/caja/CierreCajaPage'
import PosScreen from './modules/ventas/PosScreen'
import VentasListadoPage from './modules/ventas-listado/VentasListadoPage'
import VentaDetallePage from './modules/ventas-listado/VentaDetallePage'
import MovimientosCajaPage from './modules/movimientos-caja/MovimientosCajaPage'
import ProductosPage from './modules/productos/ProductosPage'
import ProductoFormPage from './modules/productos/ProductoFormPage'
import ProductoDetallePage from './modules/productos/ProductoDetallePage'
import ComprasPage from './modules/compras/ComprasPage'
import NuevaCompraPage from './modules/compras/NuevaCompraPage'
import CompraDetallePage from './modules/compras/CompraDetallePage'
import ProveedoresPage from './modules/compras/ProveedoresPage'
import ClientesPage from './modules/clientes/ClientesPage'
import ClienteFichaPage from './modules/clientes/ClienteFichaPage'
import ReportesPage from './modules/reportes/ReportesPage'
import UsuariosPage from './modules/usuarios/UsuariosPage'
import ConfiguracionPage from './modules/configuracion/ConfiguracionPage'
import BackupPage from './modules/backup/BackupPage'
import PerfilPage from './modules/perfil/PerfilPage'

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pos" element={<PosScreen />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ventas" element={<VentasListadoPage />} />
          <Route path="/ventas/:id" element={<VentaDetallePage />} />
          <Route path="/caja" element={<CajaPage />} />
          <Route path="/movimientos-caja" element={<MovimientosCajaPage />} />
          <Route path="/caja/apertura" element={<AperturaCajaPage />} />
          <Route path="/caja/cierre" element={<CierreCajaPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/productos/nuevo" element={<ProductoFormPage />} />
          <Route path="/productos/:id" element={<ProductoDetallePage />} />
          <Route path="/productos/:id/editar" element={<ProductoFormPage />} />
          <Route path="/compras" element={<ComprasPage />} />
          <Route path="/compras/nueva" element={<NuevaCompraPage />} />
          <Route path="/proveedores" element={<ProveedoresPage />} />
          <Route path="/compras/:id" element={<CompraDetallePage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/:id" element={<ClienteFichaPage />} />
          <Route path="/reportes" element={<ReportesPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}
