import { create } from 'zustand'
import type { Product, CartItem } from '@shared/types'
import { computeEffectivePrice } from '../lib/promo'

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
    // 005-promotional-pricing: snapshot the effective unit price at add time.
    // A promo that expires or is disabled mid-sale MUST NOT re-price a line
    // already in the cart (spec FR-008).
    const eff = computeEffectivePrice(product, new Date())
    const unitPrice = eff?.unitPrice ?? product.price
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id)
      if (existing) {
        const newQty = existing.quantity + quantity
        const existingUnit = existing.unit_price ?? existing.product.price
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: newQty, subtotal: Math.round(newQty * existingUnit) }
              : i
          )
        }
      }
      const newItem: CartItem = {
        product,
        quantity,
        subtotal: Math.round(quantity * unitPrice),
        ...(eff
          ? {
              unit_price: eff.unitPrice,
              normal_price: eff.normalPrice,
              savings_per_unit: eff.savingsPerUnit
            }
          : {})
      }
      return { items: [...state.items, newItem] }
    })
  },

  updateQuantity: (productId, quantity) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId
          ? {
              ...i,
              quantity,
              subtotal: Math.round(quantity * (i.unit_price ?? i.product.price))
            }
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
