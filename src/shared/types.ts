export type Role = 'admin' | 'supervisor' | 'cajero'
export type PriceType = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'm' | 'docena' | 'paquete'
export type PaymentMethod = 'cash' | 'card' | 'credit' | 'transfer' | 'mixed'
export type PaymentProcessor = 'bancard' | 'dinelco' | 'upay'
export type SaleStatus = 'completed' | 'cancelled'
export type OrderStatus = 'pending' | 'received' | 'cancelled'
export type MovementType = 'income' | 'expense'
export type CashMovementType = 'income' | 'expense' | 'opening' | 'closing' | 'void'

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
  // 005-promotional-pricing: per-product promo. Active iff promo_enabled AND
  // (current local date is within [promo_from, promo_to] when set).
  promo_enabled?: boolean
  promo_type?: 'fixed' | 'percent' | null
  promo_value?: number | null
  promo_from?: string | null
  promo_to?: string | null
  created_at?: string
  updated_at?: string
}

export interface EffectivePrice {
  unitPrice: number
  normalPrice: number
  savingsPerUnit: number
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
  credit_limit_enabled?: boolean
  credit_limit_amount?: number | null
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
  // 010-cash-float-close: cash left in the drawer at close (float for the next
  // shift). NULL on registers closed before the feature. The withdrawal is
  // derived (closing_amount − kept_amount), never stored.
  kept_amount: number | null
  status: 'open' | 'closed'
}

// 010-cash-float-close: amounts of the most recent closed register, used by the
// apertura screen to propose the float that stayed in the drawer.
export interface LastClosedRegister {
  id: number
  closed_at: string
  closing_amount: number | null
  kept_amount: number | null
}

export interface CashMovement {
  id: number
  register_id: number
  user_id: number
  user_name?: string
  type: CashMovementType
  amount: number
  description: string
  created_at: string
}

// 003-cash-movements-history: timeline row with apertura/cierre/void as
// first-class types and the void linkage computed at read time.
export interface CashMovementRow {
  id: number
  registerId: number
  userId: number
  userName: string
  type: CashMovementType
  amount: number
  description: string
  createdAt: string
  isVoided: boolean
  voidedBy: number | null
  voidOf: number | null
  registerStatus: 'open' | 'closed'
}

export interface CashMovementListOpts {
  from?: string
  to?: string
  types?: CashMovementType[]
  userId?: number
  registerId?: number
  search?: string
  page?: number
  perPage?: number
}

export interface CashMovementListResult {
  items: CashMovementRow[]
  total: number
  page: number
  perPage: number
}

export interface Sale {
  id: number
  register_id: number
  customer_id: number | null
  customer_name?: string
  // 007-receipt-share: customer.phone surfaced on the sale so the renderer can
  // pre-fill the WhatsApp recipient without a second IPC round-trip. Optional
  // because anonymous sales and customers without phone leave this empty.
  customer_phone?: string | null
  customer_balance?: number
  user_id: number
  user_name?: string
  subtotal: number
  discount: number
  total: number
  payment_method: PaymentMethod
  payment_processor?: PaymentProcessor | null
  payment_reference?: string | null
  status: SaleStatus
  notes: string | null
  items?: SaleItem[]
  payments?: SalePayment[]
  // 009: aggregated fiado (credit) portion of the sale, attached by getAllSales
  // so listings/exports can show it per-row without re-summing payments.
  credit_portion?: number
  created_at: string
}

// 007-receipt-share: receipt sharing channels used by the audit IPC.
export type ShareChannel = 'whatsapp' | 'pdf' | 'image'

export interface LogShareRequest {
  saleId: number
  channel: ShareChannel
  target?: string | null
}

export type LogShareResponse =
  | { ok: true; logId: number }
  | { ok: false; error: 'sale_not_found' | 'invalid_channel' | 'invalid_target' }

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  product_name?: string
  price_type?: PriceType
  quantity: number
  unit_price: number
  subtotal: number
  // 005-promotional-pricing: current product price at read time. When this
  // exceeds `unit_price`, the line was sold under a promo and the receipt
  // renders an "Ahorrás" totals line. NOTE: this is the product's *current*
  // normal price (joined at read time), not a snapshot of the price at sale.
  // A future change can snapshot the price on sale_items when retroactive
  // accuracy on historical reprints matters (data-model.md §1.3).
  normal_price?: number
}

export interface SalePayment {
  id: number
  sale_id: number
  method: 'cash' | 'card' | 'credit' | 'transfer'
  amount: number
  processor?: PaymentProcessor | null
  reference?: string | null
}

export interface CartItem {
  product: Product
  quantity: number
  subtotal: number
  // 005-promotional-pricing: present only when the line was added under an
  // active promo. Snapshotted at add-to-cart so mid-sale promo changes do not
  // repaint the line.
  unit_price?: number
  normal_price?: number
  savings_per_unit?: number
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
  price_type?: PriceType
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
  affects_cash: boolean
  /** When set, this row is an annulment of the payment with this id (append-only void trail). */
  void_of: number | null
  /** True when another row annuls this payment (i.e. this payment was voided). */
  is_voided: boolean
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
