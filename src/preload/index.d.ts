import type {
  User, Product, Category, Customer, Supplier, CashRegister, CashMovement,
  Sale, PurchaseOrder, StockAdjustment, CustomerPayment, AppSetting, BackupFile
} from '../shared/types'

interface ApiUsers {
  getAll(): Promise<User[]>
  getActive(): Promise<User[]>
  getById(id: number): Promise<User | null>
  login(userId: number, pin: string): Promise<User | null>
  create(data: { name: string; role: string; pin: string }): Promise<User>
  update(id: number, data: { name?: string; role?: string; pin?: string; active?: boolean }): Promise<User>
}

interface ApiProducts {
  getAll(filters?: { categoryId?: number; active?: boolean; lowStock?: boolean; search?: string }): Promise<Product[]>
  getById(id: number): Promise<Product | null>
  getByBarcode(barcode: string): Promise<Product | null>
  create(data: Partial<Product>): Promise<Product>
  update(id: number, data: Partial<Product>): Promise<Product>
  adjustStock(id: number, newStock: number, reason: string, userId: number): Promise<Product>
  categories(): Promise<Category[]>
  createCategory(name: string): Promise<Category>
  lowStock(): Promise<Product[]>
}

interface ApiSales {
  create(data: {
    registerId: number; userId: number; customerId?: number | null;
    items: { productId: number; quantity: number; unitPrice: number; subtotal: number }[];
    subtotal: number; discount: number; total: number; paymentMethod: string;
    payments?: { method: string; amount: number }[]; notes?: string
  }): Promise<Sale>
  getById(id: number): Promise<Sale | null>
  getRecent(limit?: number): Promise<Sale[]>
  getByRegister(registerId: number): Promise<Sale[]>
  cancel(id: number, userId: number): Promise<Sale | null>
  dayTotal(): Promise<{ total: number; count: number }>
}

interface ApiCustomers {
  getAll(search?: string): Promise<Customer[]>
  getById(id: number): Promise<Customer | null>
  create(data: { name: string; phone?: string; address?: string; is_employee?: boolean }): Promise<Customer>
  update(id: number, data: Partial<Customer>): Promise<Customer>
  addPayment(customerId: number, userId: number, amount: number, note?: string): Promise<Customer>
  getPayments(customerId: number): Promise<CustomerPayment[]>
  getSales(customerId: number): Promise<Sale[]>
}

interface ApiCash {
  open(userId: number, openingAmount: number): Promise<CashRegister>
  getCurrent(): Promise<CashRegister | null>
  close(id: number, closingAmount: number, notes?: string): Promise<CashRegister>
  addMovement(registerId: number, userId: number, type: string, amount: number, description: string): Promise<CashMovement>
  getMovements(registerId: number): Promise<CashMovement[]>
  getSummary(registerId: number): Promise<unknown>
  getAll(): Promise<CashRegister[]>
}

interface ApiSuppliers {
  getAll(search?: string): Promise<Supplier[]>
  getById(id: number): Promise<Supplier | null>
  create(data: Partial<Supplier>): Promise<Supplier>
  update(id: number, data: Partial<Supplier>): Promise<Supplier>
}

interface ApiPurchases {
  getAll(status?: string): Promise<PurchaseOrder[]>
  getById(id: number): Promise<PurchaseOrder | null>
  create(data: unknown): Promise<PurchaseOrder>
  receive(id: number): Promise<PurchaseOrder>
  cancel(id: number): Promise<PurchaseOrder>
}

interface ApiReports {
  salesByPeriod(from: string, to: string, method?: string, userId?: number): Promise<Sale[]>
  topProducts(from: string, to: string, categoryId?: number): Promise<unknown[]>
  profitMargin(): Promise<unknown[]>
  stockMovements(from: string, to: string, productId?: number): Promise<StockAdjustment[]>
  cashRegisters(): Promise<CashRegister[]>
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

declare global {
  interface Window {
    api: {
      users: ApiUsers
      products: ApiProducts
      sales: ApiSales
      customers: ApiCustomers
      cash: ApiCash
      suppliers: ApiSuppliers
      purchases: ApiPurchases
      reports: ApiReports
      backup: ApiBackup
      settings: ApiSettings
    }
  }
}
