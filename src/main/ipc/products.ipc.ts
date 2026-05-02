import { ipcMain, dialog } from 'electron'
import { copyFileSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import * as productsQuery from '../db/queries/products'
import { getImagesDir } from '../db'

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

  ipcMain.handle('products:uploadImage', async (_, productId: number) => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null

    const srcPath = result.filePaths[0]
    const ext = extname(srcPath)
    const filename = `product_${productId}_${Date.now()}${ext}`
    const destPath = join(getImagesDir(), filename)
    copyFileSync(srcPath, destPath)

    productsQuery.updateProduct(productId, { image: filename })
    return filename
  })

  ipcMain.handle('products:pickImage', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null

    const srcPath = result.filePaths[0]
    const ext = extname(srcPath).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const dataUrl = `data:image/${mime};base64,${readFileSync(srcPath).toString('base64')}`
    return { srcPath, dataUrl }
  })

  ipcMain.handle('products:saveImageFromPath', (_, productId: number, srcPath: string) => {
    const ext = extname(srcPath)
    const filename = `product_${productId}_${Date.now()}${ext}`
    const destPath = join(getImagesDir(), filename)
    copyFileSync(srcPath, destPath)
    productsQuery.updateProduct(productId, { image: filename })
    return filename
  })

  ipcMain.handle('products:getImagePath', () => {
    return getImagesDir()
  })
}
