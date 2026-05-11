import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Users
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    getActive: () => ipcRenderer.invoke('users:getActive'),
    getById: (id: number) => ipcRenderer.invoke('users:getById', id),
    login: (userId: number, pin: string) => ipcRenderer.invoke('users:login', userId, pin),
    logout: () => ipcRenderer.invoke('users:logout'),
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
    movements: (productId: number, limit?: number) =>
      ipcRenderer.invoke('products:movements', productId, limit),
    recentSales: (productId: number, limit?: number) =>
      ipcRenderer.invoke('products:recentSales', productId, limit),
    salesStats: (productId: number) => ipcRenderer.invoke('products:salesStats', productId),
    lastPurchase: (productId: number) => ipcRenderer.invoke('products:lastPurchase', productId),
    uploadImage: (productId: number) => ipcRenderer.invoke('products:uploadImage', productId),
    pickImage: () => ipcRenderer.invoke('products:pickImage'),
    saveImageFromPath: (productId: number, srcPath: string) =>
      ipcRenderer.invoke('products:saveImageFromPath', productId, srcPath),
    getImagePath: () => ipcRenderer.invoke('products:getImagePath')
  },
  // Sales
  sales: {
    create: (data: unknown) => ipcRenderer.invoke('sales:create', data),
    getById: (id: number) => ipcRenderer.invoke('sales:getById', id),
    getRecent: (limit?: number) => ipcRenderer.invoke('sales:getRecent', limit),
    getByRegister: (registerId: number) => ipcRenderer.invoke('sales:getByRegister', registerId),
    cancel: (id: number, options?: { refundMixedCredit?: boolean }) =>
      ipcRenderer.invoke('sales:cancel', id, options),
    dayTotal: () => ipcRenderer.invoke('sales:dayTotal')
  },
  // Customers
  customers: {
    getAll: (opts?: unknown) => ipcRenderer.invoke('customers:getAll', opts),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('customers:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('customers:update', id, data),
    addPayment: (customerId: number, userId: number, amount: number, note?: string) =>
      ipcRenderer.invoke('customers:addPayment', customerId, userId, amount, note),
    updatePayment: (paymentId: number, amount: number, note?: string | null) =>
      ipcRenderer.invoke('customers:updatePayment', paymentId, amount, note),
    deletePayment: (paymentId: number) => ipcRenderer.invoke('customers:deletePayment', paymentId),
    getPayments: (customerId: number) => ipcRenderer.invoke('customers:getPayments', customerId),
    getSales: (customerId: number) => ipcRenderer.invoke('customers:getSales', customerId),
    delete: (id: number) => ipcRenderer.invoke('customers:delete', id)
  },
  // Cash
  cash: {
    open: (userId: number, openingAmount: number) =>
      ipcRenderer.invoke('cash:open', userId, openingAmount),
    getCurrent: () => ipcRenderer.invoke('cash:getCurrent'),
    close: (id: number, closingAmount: number, notes?: string, userId?: number) =>
      ipcRenderer.invoke('cash:close', id, closingAmount, notes, userId),
    addMovement: (
      registerId: number,
      userId: number,
      type: string,
      amount: number,
      description: string
    ) => ipcRenderer.invoke('cash:addMovement', registerId, userId, type, amount, description),
    getMovements: (registerId: number) => ipcRenderer.invoke('cash:getMovements', registerId),
    getSummary: (registerId: number) => ipcRenderer.invoke('cash:getSummary', registerId),
    getAll: () => ipcRenderer.invoke('cash:getAll')
  },
  // Purchases & Suppliers
  suppliers: {
    getAll: (opts?: unknown) => ipcRenderer.invoke('suppliers:getAll', opts),
    getById: (id: number) => ipcRenderer.invoke('suppliers:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('suppliers:update', id, data)
  },
  purchases: {
    getAll: (opts?: unknown) => ipcRenderer.invoke('purchases:getAll', opts),
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
  },
  print: {
    ticket: (payload: unknown) => ipcRenderer.invoke('print:ticket', payload),
    hasConfig: () => ipcRenderer.invoke('print:hasConfig')
  },
  heldTickets: {
    list: () => ipcRenderer.invoke('held:list'),
    add: (data: { id: string; label: string; payload: string; discount: number }) =>
      ipcRenderer.invoke('held:add', data),
    remove: (id: string) => ipcRenderer.invoke('held:remove', id),
    clear: () => ipcRenderer.invoke('held:clear')
  },
  auth: {
    recoveryNeeded: () => ipcRenderer.invoke('auth:recoveryNeeded'),
    matrixSummary: () => ipcRenderer.invoke('auth:matrixSummary'),
    listAuditEntries: (filters?: unknown) => ipcRenderer.invoke('auth:listAuditEntries', filters),
    listAlerts: () => ipcRenderer.invoke('auth:listAlerts'),
    acknowledgeAlert: (alertId: number) => ipcRenderer.invoke('auth:acknowledgeAlert', alertId)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onStateChange: (cb: (isMaximized: boolean) => void) => {
      const handler = (_: unknown, isMaximized: boolean): void => cb(isMaximized)
      ipcRenderer.on('window:state', handler)
      return () => ipcRenderer.removeListener('window:state', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore — fallback path when contextIsolation is disabled
  window.api = api
}
