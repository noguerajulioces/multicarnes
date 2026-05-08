import { dialog } from 'electron'
import { copyFileSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import * as productsQuery from '../db/queries/products'
import { getImagesDir } from '../db'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

// US3 — fields stripped from product responses for cashiers (no cost/margin
// data leakage). Applied centrally in the read handlers.
const COST_FIELDS = [
  'last_purchase_cost',
  'last_unit_cost',
  'margin',
  'margin_pct',
  'profit_margin'
] as const

function stripCostFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row }
  for (const f of COST_FIELDS) delete out[f]
  return out
}

function stripCostFieldsArray<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((r) => stripCostFields(r))
}

export function registerProductsIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized(
    'products:getAll',
    getRule('products:getAll'),
    async (_e, ctx, filters?: Parameters<typeof productsQuery.getAllProducts>[0]) => {
      const result = await productsQuery.getAllProducts(filters)
      if (ctx.role === 'cajero' && result && Array.isArray(result.items)) {
        return { ...result, items: stripCostFieldsArray(result.items as Record<string, unknown>[]) }
      }
      return result
    }
  )

  registerAuthorized('products:getById', getRule('products:getById'), async (_e, ctx, id: number) => {
    const product = await productsQuery.getProductById(id)
    if (ctx.role === 'cajero' && product) {
      return stripCostFields(product as Record<string, unknown>)
    }
    return product
  })

  registerAuthorized(
    'products:getByBarcode',
    getRule('products:getByBarcode'),
    async (_e, ctx, barcode: string) => {
      const product = await productsQuery.getProductByBarcode(barcode)
      if (ctx.role === 'cajero' && product) {
        return stripCostFields(product as Record<string, unknown>)
      }
      return product
    }
  )

  registerAuthorized('products:create', getRule('products:create'), (_e, _c, data: unknown) =>
    productsQuery.createProduct(data as Parameters<typeof productsQuery.createProduct>[0])
  )
  registerAuthorized(
    'products:update',
    getRule('products:update'),
    (_e, _c, id: number, data: unknown) =>
      productsQuery.updateProduct(id, data as Parameters<typeof productsQuery.updateProduct>[1])
  )
  registerAuthorized(
    'products:adjustStock',
    getRule('products:adjustStock'),
    (_e, _c, id: number, newStock: number, reason: string, userId: number) =>
      productsQuery.adjustStock(id, newStock, reason, userId)
  )
  registerAuthorized('products:categories', getRule('products:categories'), () =>
    productsQuery.getAllCategories()
  )
  registerAuthorized(
    'products:createCategory',
    getRule('products:createCategory'),
    (_e, _c, name: string) => productsQuery.createCategory(name)
  )
  registerAuthorized('products:lowStock', getRule('products:lowStock'), () =>
    productsQuery.getLowStockProducts()
  )
  registerAuthorized(
    'products:movements',
    getRule('products:movements'),
    (_e, _c, productId: number, limit?: number) =>
      productsQuery.getStockMovements(productId, limit)
  )
  registerAuthorized(
    'products:recentSales',
    getRule('products:recentSales'),
    (_e, _c, productId: number, limit?: number) =>
      productsQuery.getRecentSalesForProduct(productId, limit)
  )
  registerAuthorized(
    'products:salesStats',
    getRule('products:salesStats'),
    (_e, _c, productId: number) => productsQuery.getProductSalesStats(productId)
  )
  registerAuthorized(
    'products:lastPurchase',
    getRule('products:lastPurchase'),
    (_e, _c, productId: number) => productsQuery.getLastPurchaseForProduct(productId)
  )

  registerAuthorized(
    'products:uploadImage',
    getRule('products:uploadImage'),
    async (_e, _c, productId: number) => {
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
    }
  )

  registerAuthorized('products:pickImage', getRule('products:pickImage'), async () => {
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

  registerAuthorized(
    'products:saveImageFromPath',
    getRule('products:saveImageFromPath'),
    (_e, _c, productId: number, srcPath: string) => {
      const ext = extname(srcPath)
      const filename = `product_${productId}_${Date.now()}${ext}`
      const destPath = join(getImagesDir(), filename)
      copyFileSync(srcPath, destPath)
      productsQuery.updateProduct(productId, { image: filename })
      return filename
    }
  )

  registerAuthorized('products:getImagePath', getRule('products:getImagePath'), () => {
    return getImagesDir()
  })

  return listRegisteredChannels().slice(before)
}
