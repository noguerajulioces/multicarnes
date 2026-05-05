import { create } from 'zustand'
import type { Product, CartItem } from '@shared/types'

interface CartState {
  items: CartItem[]
  discount: number
  addItem: (product: Product, quantity: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  removeItem: (productId: number) => void
  setDiscount: (discount: number) => void
  clear: () => void
  restore: (items: CartItem[], discount: number) => void
  subtotal: () => number
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: 0,

  addItem: (product, quantity) => {
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id)
      if (existing) {
        const newQty = existing.quantity + quantity
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: newQty, subtotal: Math.round(newQty * product.price) }
              : i
          )
        }
      }
      return {
        items: [
          ...state.items,
          { product, quantity, subtotal: Math.round(quantity * product.price) }
        ]
      }
    })
  },

  updateQuantity: (productId, quantity) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId
          ? { ...i, quantity, subtotal: Math.round(quantity * i.product.price) }
          : i
      )
    }))
  },

  removeItem: (productId) => {
    set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) }))
  },

  setDiscount: (discount) => set({ discount }),

  clear: () => set({ items: [], discount: 0 }),

  restore: (items, discount) => set({ items, discount }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),

  total: () => {
    const sub = get().items.reduce((sum, i) => sum + i.subtotal, 0)
    return Math.max(0, sub - get().discount)
  }
}))
