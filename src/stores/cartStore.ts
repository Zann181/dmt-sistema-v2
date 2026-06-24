"use client"

import { create } from "zustand"

interface CartItem {
  eventProductId: string
  name: string
  price: number
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: { id: string, name: string, price: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, qty: number) => void
  clear: () => void
  total: number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => {
    const existing = state.items.find(i => i.eventProductId === item.id)
    if (existing) {
      return { items: state.items.map(i => i.eventProductId === item.id ? { ...i, quantity: i.quantity + 1 } : i) }
    }
    return { items: [...state.items, { eventProductId: item.id, name: item.name, price: item.price, quantity: 1 }] }
  }),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.eventProductId !== id) })),
  updateQuantity: (id, qty) => set((state) => ({ 
    items: state.items.map(i => i.eventProductId === id ? { ...i, quantity: qty } : i) 
  })),
  clear: () => set({ items: [] }),
  get total() {
    return get().items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  }
}))
