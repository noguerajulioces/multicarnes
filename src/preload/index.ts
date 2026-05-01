import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Users
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    getActive: () => ipcRenderer.invoke('users:getActive'),
    getById: (id: number) => ipcRenderer.invoke('users:getById', id),
    login: (userId: number, pin: string) => ipcRenderer.invoke('users:login', userId, pin),
    create: (data: unknown) => ipcRenderer.invoke('users:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('users:update', id, data)
  },
  // Products
  products: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('products:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('products:getById', id),
    getByBarcode: (barcode: string) => ipcRenderer.invoke('products:getByBarcode', barcode),
    create: (data: unknown) => ipcRenderer.invoke('products:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('products:update', id, data),
    adjustStock: (id: number, newStock: number, reason: string, userId: number) =>
      ipcRenderer.invoke('products:adjustStock', id, newStock, reason, userId),
    categories: () => ipcRenderer.invoke('products:categories'),
    createCategory: (name: string) => ipcRenderer.invoke('products:createCategory', name),
    lowStock: () => ipcRenderer.invoke('products:lowStock'),
    uploadImage: (productId: number) => ipcRenderer.invoke('products:uploadImage', productId),
    getImagePath: () => ipcRenderer.invoke('products:getImagePath')
  },
  // Sales
  sales: {
    create: (data: unknown) => ipcRenderer.invoke('sales:create', data),
    getById: (id: number) => ipcRenderer.invoke('sales:getById', id),
    getRecent: (limit?: number) => ipcRenderer.invoke('sales:getRecent', limit),
    getByRegister: (registerId: number) => ipcRenderer.invoke('sales:getByRegister', registerId),
    cancel: (id: number, userId: number) => ipcRenderer.invoke('sales:cancel', id, userId),
    dayTotal: () => ipcRenderer.invoke('sales:dayTotal')
  },
  // Customers
  customers: {
    getAll: (search?: string) => ipcRenderer.invoke('customers:getAll', search),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('customers:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('customers:update', id, data),
    addPayment: (customerId: number, userId: number, amount: number, note?: string) =>
      ipcRenderer.invoke('customers:addPayment', customerId, userId, amount, note),
    getPayments: (customerId: number) => ipcRenderer.invoke('customers:getPayments', customerId),
    getSales: (customerId: number) => ipcRenderer.invoke('customers:getSales', customerId)
  },
  // Cash
  cash: {
    open: (userId: number, openingAmount: number) => ipcRenderer.invoke('cash:open', userId, openingAmount),
    getCurrent: () => ipcRenderer.invoke('cash:getCurrent'),
    close: (id: number, closingAmount: number, notes?: string) =>
      ipcRenderer.invoke('cash:close', id, closingAmount, notes),
    addMovement: (registerId: number, userId: number, type: string, amount: number, description: string) =>
      ipcRenderer.invoke('cash:addMovement', registerId, userId, type, amount, description),
    getMovements: (registerId: number) => ipcRenderer.invoke('cash:getMovements', registerId),
    getSummary: (registerId: number) => ipcRenderer.invoke('cash:getSummary', registerId),
    getAll: () => ipcRenderer.invoke('cash:getAll')
  },
  // Purchases & Suppliers
  suppliers: {
    getAll: (search?: string) => ipcRenderer.invoke('suppliers:getAll', search),
    getById: (id: number) => ipcRenderer.invoke('suppliers:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('suppliers:update', id, data)
  },
  purchases: {
    getAll: (status?: string) => ipcRenderer.invoke('purchases:getAll', status),
    getById: (id: number) => ipcRenderer.invoke('purchases:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('purchases:create', data),
    receive: (id: number) => ipcRenderer.invoke('purchases:receive', id),
    cancel: (id: number) => ipcRenderer.invoke('purchases:cancel', id)
  },
  // Reports
  reports: {
    salesByPeriod: (from: string, to: string, method?: string, userId?: number) =>
      ipcRenderer.invoke('reports:salesByPeriod', from, to, method, userId),
    topProducts: (from: string, to: string, categoryId?: number) =>
      ipcRenderer.invoke('reports:topProducts', from, to, categoryId),
    profitMargin: () => ipcRenderer.invoke('reports:profitMargin'),
    stockMovements: (from: string, to: string, productId?: number) =>
      ipcRenderer.invoke('reports:stockMovements', from, to, productId),
    cashRegisters: () => ipcRenderer.invoke('reports:cashRegisters'),
    pendingCredits: () => ipcRenderer.invoke('reports:pendingCredits'),
    salesSummary: (from: string, to: string) =>
      ipcRenderer.invoke('reports:salesSummary', from, to),
    salesComparison: (from: string, to: string) =>
      ipcRenderer.invoke('reports:salesComparison', from, to)
  },
  // Backup & Settings
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (path?: string) => ipcRenderer.invoke('backup:restore', path),
    selectFolder: () => ipcRenderer.invoke('backup:selectFolder')
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value)
  },
  notify: {
    show: (title: string, body: string) => ipcRenderer.invoke('notify:show', title, body)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
