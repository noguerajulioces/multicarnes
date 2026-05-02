export type Role = 'admin' | 'supervisor' | 'cajero'
export type PriceType = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'm' | 'docena' | 'paquete'
export type PaymentMethod = 'cash' | 'credit' | 'transfer' | 'mixed'
export type SaleStatus = 'completed' | 'cancelled'
export type OrderStatus = 'pending' | 'received' | 'cancelled'
export type MovementType = 'income' | 'expense'

export interface User {
  id: number
  name: string
  role: Role
  active: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
}

export interface Product {
  id: number
  category_id: number | null
  category_name?: string
  name: string
  barcode: string | null
  price: number
  price_type: PriceType
  stock: number
  min_stock: number
  image: string | null
  active: boolean
  low_stock?: boolean
  created_at?: string
  updated_at?: string
}

export type DocumentType = 'CI' | 'RUC'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export interface PageOpts {
  page?: number
  perPage?: number
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  address: string | null
  document: string | null
  document_type: DocumentType | null
  is_employee: boolean
  balance: number
  created_at?: string
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  active: boolean
  created_at?: string
}

export interface CashRegister {
  id: number
  user_id: number
  user_name?: string
  opened_at: string
  closed_at: string | null
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference: number | null
  notes: string | null
  status: 'open' | 'closed'
}

export interface CashMovement {
  id: number
  register_id: number
  user_id: number
  user_name?: string
  type: MovementType
  amount: number
  description: string
  created_at: string
}

export interface Sale {
  id: number
  register_id: number
  customer_id: number | null
  customer_name?: string
  user_id: number
  user_name?: string
  subtotal: number
  discount: number
  total: number
  payment_method: PaymentMethod
  status: SaleStatus
  notes: string | null
  items?: SaleItem[]
  payments?: SalePayment[]
  created_at: string
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  product_name?: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface SalePayment {
  id: number
  sale_id: number
  method: 'cash' | 'credit' | 'transfer'
  amount: number
}

export interface CartItem {
  product: Product
  quantity: number
  subtotal: number
}

export interface PurchaseOrder {
  id: number
  supplier_id: number | null
  supplier_name?: string
  user_id: number
  user_name?: string
  total: number
  status: OrderStatus
  notes: string | null
  created_at: string
  received_at: string | null
  items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: number
  order_id: number
  product_id: number
  product_name?: string
  quantity: number
  unit_cost: number
  subtotal: number
}

export interface StockAdjustment {
  id: number
  product_id: number
  product_name?: string
  user_id: number
  user_name?: string
  quantity_before: number
  quantity_after: number
  reason: string
  created_at: string
}

export interface ProductStockMovement {
  id: number
  user_id: number
  user_name: string | null
  quantity_before: number
  quantity_after: number
  delta: number
  reason: string
  created_at: string
}

export interface ProductRecentSale {
  sale_id: number
  created_at: string
  quantity: number
  unit_price: number
  subtotal: number
  user_id: number
  user_name: string | null
  customer_name: string | null
}

export interface ProductSalesStats {
  units_7d: number
  total_7d: number
  units_30d: number
  total_30d: number
  last_sale_at: string | null
}

export interface ProductLastPurchase {
  order_id: number
  created_at: string
  unit_cost: number
  quantity: number
  supplier_name: string | null
}

export interface CustomerPayment {
  id: number
  customer_id: number
  customer_name?: string
  user_id: number
  user_name?: string
  amount: number
  note: string | null
  created_at: string
}

export interface ActionLog {
  id: number
  user_id: number | null
  user_name?: string
  action: string
  details: string | null
  created_at: string
}

export interface AppSetting {
  key: string
  value: string
}

export interface BackupFile {
  name: string
  path: string
  size: number
  date: string
}
