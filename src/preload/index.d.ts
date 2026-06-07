import type {
  User,
  Product,
  Category,
  Customer,
  Supplier,
  CashRegister,
  CashMovement,
  Sale,
  PurchaseOrder,
  StockAdjustment,
  CustomerPayment,
  AppSetting,
  BackupFile,
  ProductStockMovement,
  ProductRecentSale,
  ProductSalesStats,
  ProductLastPurchase,
  Paginated,
  PageOpts,
  CashMovementListOpts,
  CashMovementListResult,
  CashMovementRow,
  LogShareRequest,
  LogShareResponse
} from '../shared/types'

interface ApiUsers {
  getAll(): Promise<User[]>
  getActive(): Promise<User[]>
  getById(id: number): Promise<User | null>
  login(userId: number, pin: string): Promise<User | null>
  logout(): Promise<{ ok: true }>
  create(data: { name: string; role: string; pin: string }): Promise<User>
  update(
    id: number,
    data: { name?: string; role?: string; pin?: string; active?: boolean }
  ): Promise<User>
}

interface ApiProducts {
  getAll(
    filters?: {
      categoryId?: number
      active?: boolean
      lowStock?: boolean
      search?: string
    } & PageOpts
  ): Promise<Paginated<Product>>
  getById(id: number): Promise<Product | null>
  getByBarcode(barcode: string): Promise<Product | null>
  create(data: Partial<Product>): Promise<Product>
  update(id: number, data: Partial<Product>): Promise<Product>
  adjustStock(id: number, newStock: number, reason: string, userId: number): Promise<Product>
  categories(): Promise<Category[]>
  createCategory(name: string): Promise<Category>
  lowStock(): Promise<Product[]>
  movements(productId: number, limit?: number): Promise<ProductStockMovement[]>
  recentSales(productId: number, limit?: number): Promise<ProductRecentSale[]>
  salesStats(productId: number): Promise<ProductSalesStats>
  lastPurchase(productId: number): Promise<ProductLastPurchase | null>
  uploadImage(productId: number): Promise<string | null>
  pickImage(): Promise<{ srcPath: string; dataUrl: string } | null>
  saveImageFromPath(productId: number, srcPath: string): Promise<string>
  getImagePath(): Promise<string>
}

interface ApiSales {
  create(data: {
    registerId: number
    userId: number
    customerId?: number | null
    items: { productId: number; quantity: number; unitPrice: number; subtotal: number }[]
    subtotal: number
    discount: number
    total: number
    paymentMethod: string
    paymentProcessor?: string | null
    paymentReference?: string | null
    payments?: {
      method: string
      amount: number
      processor?: string | null
      reference?: string | null
    }[]
    notes?: string
  }): Promise<Sale>
  getAll(
    opts?: {
      from?: string
      to?: string
      paymentMethod?: string
      userId?: number
    } & PageOpts
  ): Promise<Paginated<Sale>>
  getById(id: number): Promise<Sale | null>
  getRecent(limit?: number): Promise<Sale[]>
  getByRegister(registerId: number): Promise<Sale[]>
  cancel(id: number, options?: { refundMixedCredit?: boolean }): Promise<Sale | null>
  dayTotal(): Promise<{ total: number; count: number }>
  logShare(req: LogShareRequest): Promise<LogShareResponse>
}

interface ApiCustomers {
  getAll(opts?: { search?: string; isEmployee?: boolean } & PageOpts): Promise<Paginated<Customer>>
  getById(id: number): Promise<Customer | null>
  create(data: {
    name: string
    phone?: string
    address?: string
    document?: string
    document_type?: 'CI' | 'RUC' | null
    is_employee?: boolean
    credit_limit_enabled?: boolean
    credit_limit_amount?: number | null
  }): Promise<Customer>
  update(id: number, data: Partial<Customer>): Promise<Customer>
  addPayment(
    customerId: number,
    userId: number,
    amount: number,
    note: string | undefined,
    affectsCash: boolean
  ): Promise<Customer>
  voidPayment(paymentId: number): Promise<Customer>
  getPayments(customerId: number): Promise<CustomerPayment[]>
  getSales(customerId: number): Promise<Sale[]>
  delete(id: number): Promise<{ ok: true } | { ok: false; error: string }>
}

interface ApiCash {
  open(userId: number, openingAmount: number): Promise<CashRegister>
  getCurrent(): Promise<CashRegister | null>
  getMyOpenRegister(): Promise<CashRegister | null>
  close(id: number, closingAmount: number, notes?: string, userId?: number): Promise<CashRegister>
  addMovement(
    registerId: number,
    userId: number,
    type: string,
    amount: number,
    description: string
  ): Promise<CashMovement>
  getMovements(registerId: number): Promise<CashMovement[]>
  getSummary(registerId: number): Promise<unknown>
  getAll(): Promise<CashRegister[]>
}

interface ApiCashMovements {
  list(opts: CashMovementListOpts): Promise<CashMovementListResult>
  void(originalId: number): Promise<CashMovementRow>
}

interface ApiSuppliers {
  getAll(opts?: { search?: string } & PageOpts): Promise<Paginated<Supplier>>
  getById(id: number): Promise<Supplier | null>
  create(data: Partial<Supplier>): Promise<Supplier>
  update(id: number, data: Partial<Supplier>): Promise<Supplier>
}

interface ApiPurchases {
  getAll(opts?: { status?: string } & PageOpts): Promise<Paginated<PurchaseOrder>>
  getById(id: number): Promise<PurchaseOrder | null>
  create(data: unknown): Promise<PurchaseOrder>
  receive(id: number): Promise<PurchaseOrder>
  cancel(id: number): Promise<PurchaseOrder>
}

interface PendingCreditRow {
  id: number
  name: string
  phone: string | null
  is_employee: number
  balance: number
  last_credit_sale_at: string | null
  last_payment_at: string | null
}

interface SalesSummaryResult {
  totals: { sales_count: number; total: number; discount: number; subtotal: number }
  byDay: { day: string; sales_count: number; total: number }[]
  byMethod: { method: string; sales_count: number; total: number }[]
  byCardProcessor: { processor: string; sales_count: number; total: number }[]
  byUser: { user_id: number; user_name: string; sales_count: number; total: number }[]
}

interface CardSalesRow {
  sale_id: number
  created_at: string
  user_name: string | null
  customer_name: string | null
  processor: string | null
  reference: string | null
  amount: number
  source: 'single' | 'mixed'
}

interface SalesComparisonResult {
  current: {
    sales_count: number
    total: number
    discount: number
    units: number
    avg_ticket: number
  }
  previous: {
    sales_count: number
    total: number
    discount: number
    units: number
    avg_ticket: number
  }
  period: {
    current_from: string
    current_to: string
    previous_from: string
    previous_to: string
    length_days: number
  }
}

interface ApiReports {
  salesByPeriod(from: string, to: string, method?: string, userId?: number): Promise<Sale[]>
  topProducts(from: string, to: string, categoryId?: number): Promise<unknown[]>
  profitMargin(): Promise<unknown[]>
  stockMovements(from: string, to: string, productId?: number): Promise<StockAdjustment[]>
  cashRegisters(): Promise<CashRegister[]>
  pendingCredits(): Promise<PendingCreditRow[]>
  salesSummary(from: string, to: string): Promise<SalesSummaryResult>
  salesComparison(from: string, to: string): Promise<SalesComparisonResult>
  cardSales(from: string, to: string, processor?: string): Promise<CardSalesRow[]>
}

interface ApiBackup {
  create(): Promise<string>
  list(): Promise<BackupFile[]>
  restore(path?: string): Promise<string | null>
  selectFolder(): Promise<string | null>
}

interface ApiSettings {
  getAll(): Promise<AppSetting[]>
  set(key: string, value: string): Promise<boolean>
}

interface ApiNotify {
  show(title: string, body: string): Promise<boolean>
}

interface PrintTicketLine {
  text: string
  bold?: boolean
  emphasized?: boolean
}

interface PrinterChoice {
  name: string
  displayName: string
}

interface ApiPrint {
  ticket(payload: {
    lines: PrintTicketLine[]
    cut?: boolean
  }): Promise<{ ok: true } | { ok: false; error: string }>
  hasConfig(): Promise<boolean>
  listPrinters(): Promise<PrinterChoice[]>
}

interface HeldTicketRow {
  id: string
  label: string
  payload: string
  discount: number
  created_at: string
}

interface ApiHeldTickets {
  list(): Promise<HeldTicketRow[]>
  add(data: {
    id: string
    label: string
    payload: string
    discount: number
  }): Promise<HeldTicketRow>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

import type {
  AuthAlert,
  AuthAuditEntry,
  AuthAuditFilters,
  AuthMatrixSummaryEntry
} from '../shared/auth-types'

interface ApiAuth {
  recoveryNeeded(): Promise<{ recoveryNeeded: boolean }>
  matrixSummary(): Promise<AuthMatrixSummaryEntry[]>
  listAuditEntries(
    filters?: AuthAuditFilters
  ): Promise<{ entries: AuthAuditEntry[]; total: number }>
  listAlerts(): Promise<AuthAlert[]>
  acknowledgeAlert(alertId: number): Promise<{ ok: true }>
}

interface ApiWindow {
  minimize(): Promise<void>
  maximizeToggle(): Promise<boolean>
  close(): Promise<void>
  isMaximized(): Promise<boolean>
  onStateChange(cb: (isMaximized: boolean) => void): () => void
}

declare global {
  interface Window {
    api: {
      users: ApiUsers
      products: ApiProducts
      sales: ApiSales
      customers: ApiCustomers
      cash: ApiCash
      cashMovements: ApiCashMovements
      suppliers: ApiSuppliers
      purchases: ApiPurchases
      reports: ApiReports
      backup: ApiBackup
      settings: ApiSettings
      notify: ApiNotify
      print: ApiPrint
      heldTickets: ApiHeldTickets
      auth: ApiAuth
      window: ApiWindow
    }
  }
}
