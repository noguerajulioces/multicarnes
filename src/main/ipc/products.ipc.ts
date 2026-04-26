import { ipcMain } from 'electron'
import * as productsQuery from '../db/queries/products'

export function registerProductsIpc(): void {
  ipcMain.handle('products:getAll', (_, filters?) => productsQuery.getAllProducts(filters))
  ipcMain.handle('products:getById', (_, id: number) => productsQuery.getProductById(id))
  ipcMain.handle('products:getByBarcode', (_, barcode: string) => productsQuery.getProductByBarcode(barcode))
  ipcMain.handle('products:create', (_, data) => productsQuery.createProduct(data))
  ipcMain.handle('products:update', (_, id: number, data) => productsQuery.updateProduct(id, data))
  ipcMain.handle('products:adjustStock', (_, id: number, newStock: number, reason: string, userId: number) =>
    productsQuery.adjustStock(id, newStock, reason, userId))
  ipcMain.handle('products:categories', () => productsQuery.getAllCategories())
  ipcMain.handle('products:createCategory', (_, name: string) => productsQuery.createCategory(name))
  ipcMain.handle('products:lowStock', () => productsQuery.getLowStockProducts())
}
