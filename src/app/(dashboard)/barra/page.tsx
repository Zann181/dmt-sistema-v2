"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useCartStore } from "@/stores/cartStore"
import { useContextStore } from "@/stores/contextStore"
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, QrCode, ShieldAlert, Check, ShoppingBag, X } from "lucide-react"
import { formatThousands, parseThousands } from "@/shared/utils/price"

export default function BarraPage() {
  const { activeBranchId, activeEventId, activeEventName } = useContextStore()

  const cart = useCartStore(s => s.items)
  const addItem = useCartStore(s => s.addItem)
  const removeItem = useCartStore(s => s.removeItem)
  const updateQty = useCartStore(s => s.updateQuantity)
  const total = useCartStore(s => s.total)
  const clear = useCartStore(s => s.clear)

  // Modals state
  const [checkoutType, setCheckoutType] = useState<"CASH" | "CARD" | "MIXED" | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successDetails, setSuccessDetails] = useState<any>(null)

  // Payment forms
  const [cashReceived, setCashReceived] = useState("")
  const [cardReference, setCardReference] = useState("")
  const [mixedCash, setMixedCash] = useState("")
  const [mixedCard, setMixedCard] = useState("")

  const [checkoutError, setCheckoutError] = useState("")

  // Cash movement states
  const [showCashModal, setShowCashModal] = useState(false)
  const [cashForm, setCashForm] = useState({
    movementType: "EXPENSE" as "EXPENSE" | "CASH_DROP",
    description: "",
    totalAmount: "",
    method: "CASH" as "CASH" | "TRANSFER" | "QR" | "CARD"
  })
  const [cashError, setCashError] = useState("")

  const registerCashMovementMutation = useMutation({
    mutationFn: async (data: typeof cashForm) => {
      const res = await fetch("/api/cash/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          eventId: activeEventId,
          module: "BAR",
          movementType: data.movementType,
          description: data.description,
          totalAmount: parseThousands(data.totalAmount),
          method: data.method
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al registrar movimiento de caja")
      return res.json()
    },
    onSuccess: () => {
      setShowCashModal(false)
      setCashForm({ movementType: "EXPENSE", description: "", totalAmount: "", method: "CASH" })
      setCashError("")
      alert("Movimiento de caja registrado con éxito")
    },
    onError: (err: any) => {
      setCashError(err.message)
    }
  })

  // Fetch event specific products
  const { data: products, isLoading, error } = useQuery({
    queryKey: ["event-products", activeBranchId, activeEventId],
    queryFn: async () => {
      const res = await fetch(`/api/sales/event-products?activeOnly=true&branchId=${activeBranchId}&eventId=${activeEventId}`)
      if (!res.ok) throw new Error((await res.json()).error || "Error al cargar productos de evento")
      const json = await res.json()
      return json.data as any[]
    },
    enabled: !!activeBranchId && !!activeEventId
  })

  // Sale mutation
  const executeSaleMutation = useMutation({
    mutationFn: async (payload: { payments: any[] }) => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          eventId: activeEventId,
          cart: cart.map(item => ({
            eventProductId: item.eventProductId, // Product ID
            quantity: item.quantity,
            unitPrice: item.price
          })),
          payments: payload.payments
        })
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error al procesar venta")
      return res.json()
    },
    onSuccess: (resJson) => {
      setSuccessDetails({
        saleGroupId: resJson.data.saleGroupId,
        total,
        cart: [...cart],
        payments: checkoutType === "CASH" 
          ? [{ method: "Efectivo", amount: total, change: (parseThousands(cashReceived) || total) - total }]
          : checkoutType === "CARD"
          ? [{ method: "Tarjeta", amount: total, reference: cardReference }]
          : [
              { method: "Efectivo", amount: Number(mixedCash) },
              { method: "Tarjeta", amount: Number(mixedCard) }
            ]
      })
      clear()
      setCheckoutType(null)
      setCashReceived("")
      setCardReference("")
      setMixedCash("")
      setMixedCard("")
      setCheckoutError("")
      setShowSuccessModal(true)
    },
    onError: (err: any) => {
      setCheckoutError(err.message)
    }
  })

  const handleOpenCheckout = (type: "CASH" | "CARD" | "MIXED") => {
    setCheckoutType(type)
    setCheckoutError("")
    if (type === "CASH") {
      setCashReceived(formatThousands(total))
    } else if (type === "MIXED") {
      setMixedCash(formatThousands(total / 2))
      setMixedCard(formatThousands(total / 2))
    }
  }

  const handleConfirmCheckout = (e: React.FormEvent) => {
    e.preventDefault()
    setCheckoutError("")

    let payments: any[] = []

    if (checkoutType === "CASH") {
      const received = parseThousands(cashReceived)
      if (isNaN(received) || received < total) {
        setCheckoutError("El monto recibido debe ser igual o mayor al total.")
        return
      }
      payments = [{ method: "CASH", amount: total }]
    } else if (checkoutType === "CARD") {
      payments = [{ method: "CARD", amount: total, reference: cardReference || null }]
    } else if (checkoutType === "MIXED") {
      const cash = parseThousands(mixedCash) || 0
      const card = parseThousands(mixedCard) || 0
      if (Math.abs(cash + card - total) > 0.01) {
        setCheckoutError("La suma de Efectivo y Tarjeta debe ser igual al total del pedido.")
        return
      }
      payments = [
        { method: "CASH", amount: cash },
        { method: "CARD", amount: card }
      ]
    }

    executeSaleMutation.mutate({ payments })
  }

  const remainingMixed = total - ((parseThousands(mixedCash) || 0) + (parseThousands(mixedCard) || 0))

  if (!activeBranchId || !activeEventId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center max-w-md mx-auto space-y-4">
        <ShieldAlert size={48} className="text-amber-500 animate-bounce" />
        <h2 className="text-xl font-bold">Contexto Incompleto</h2>
        <p className="text-zinc-500 text-sm">
          Por favor selecciona una sucursal y un evento activo en la barra superior antes de vender.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden">
      {/* Product Catalog Grid */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
          <h2 className="text-lg font-bold">Menú de Barra</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCashModal(true)}
              className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-semibold transition-colors flex items-center gap-1"
            >
              <Banknote size={14} /> Movimiento Caja
            </button>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-900">
              Evento: {activeEventName}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center text-zinc-500 py-12 text-sm">Cargando menú del evento...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
              <ShieldAlert size={16} /> {(error as any).message}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {products?.map(p => (
                <button 
                  key={p.id}
                  onClick={() => addItem({ id: p.id, name: p.name, price: Number(p.price) })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20 transition-all flex flex-col aspect-square justify-between shadow-sm hover:shadow group"
                >
                  <span className="font-semibold text-sm leading-tight text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.name}</span>
                  <div className="flex flex-col">
                    {p.description && <span className="text-[10px] text-zinc-400 truncate mb-1">{p.description}</span>}
                    <span className="text-zinc-900 dark:text-white font-extrabold text-base">${Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </button>
              ))}
              {products?.length === 0 && (
                <div className="col-span-full py-12 text-center text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  No hay productos habilitados para este evento.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
          <h2 className="text-lg font-bold flex items-center gap-2"><ShoppingCart size={20}/> Pedido Actual</h2>
          <button onClick={clear} className="text-zinc-400 hover:text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
              <ShoppingCart size={40} className="opacity-15 animate-pulse" />
              <p className="text-sm">El pedido está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.eventProductId} className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-zinc-950/40 rounded-xl border border-zinc-100 dark:border-zinc-800/60 shadow-sm">
                <div className="flex-1 pr-3">
                  <p className="font-semibold text-sm leading-tight text-zinc-800 dark:text-zinc-200">{item.name}</p>
                  <p className="text-zinc-900 dark:text-white text-xs font-bold mt-1">${(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1.5 shadow-sm">
                  <button 
                    onClick={() => item.quantity > 1 ? updateQty(item.eventProductId, item.quantity - 1) : removeItem(item.eventProductId)}
                    className="p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-4 text-center text-sm font-semibold text-zinc-800 dark:text-zinc-200">{item.quantity}</span>
                  <button 
                    onClick={() => updateQty(item.eventProductId, item.quantity + 1)}
                    className="p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-zinc-500">Total</span>
            <span className="text-2xl font-black text-zinc-900 dark:text-white">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button 
              disabled={cart.length === 0} 
              onClick={() => handleOpenCheckout("CASH")}
              className="flex flex-col items-center justify-center py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:cursor-not-allowed"
            >
              <Banknote size={20} className="mb-1 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold">Efectivo</span>
            </button>
            <button 
              disabled={cart.length === 0} 
              onClick={() => handleOpenCheckout("CARD")}
              className="flex flex-col items-center justify-center py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:cursor-not-allowed"
            >
              <CreditCard size={20} className="mb-1 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold">Tarjeta</span>
            </button>
            <button 
              disabled={cart.length === 0} 
              onClick={() => handleOpenCheckout("MIXED")}
              className="col-span-2 flex flex-col items-center justify-center py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-colors shadow disabled:cursor-not-allowed font-semibold"
            >
              <QrCode size={18} className="mb-1 animate-pulse" />
              <span className="text-xs font-semibold">Cobro Mixto / QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {checkoutType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {checkoutType === "CASH" ? <Banknote className="text-emerald-500" /> : checkoutType === "CARD" ? <CreditCard className="text-blue-500" /> : <QrCode className="text-indigo-500 animate-spin" />}
                Registrar Pago {checkoutType === "CASH" ? "Efectivo" : checkoutType === "CARD" ? "Tarjeta" : "Mixto"}
              </h3>
              <button onClick={() => setCheckoutType(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            {checkoutError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {checkoutError}
              </div>
            )}

            <form onSubmit={handleConfirmCheckout} className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg flex items-center justify-between">
                <span className="font-semibold text-zinc-500 text-sm">Total del Pedido:</span>
                <span className="text-xl font-black">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {checkoutType === "CASH" && (
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Monto Recibido</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(formatThousands(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg text-right"
                    required
                  />
                  {parseThousands(cashReceived) > total && (
                    <div className="mt-3 flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>Cambio a entregar:</span>
                      <span>${(parseThousands(cashReceived) - total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}

              {checkoutType === "CARD" && (
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Referencia del Voucher (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: 948271"
                    value={cardReference}
                    onChange={(e) => setCardReference(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {checkoutType === "MIXED" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">Monto en Efectivo</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={mixedCash}
                        onChange={(e) => setMixedCash(formatThousands(e.target.value))}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 block mb-1">Monto en Tarjeta</label>
                      <input
                        type="text"
                        placeholder="0"
                        value={mixedCard}
                        onChange={(e) => setMixedCard(formatThousands(e.target.value))}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold border-t pt-3 border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-500">Restante por pagar:</span>
                    <span className={`text-sm font-black ${remainingMixed === 0 ? "text-green-600" : remainingMixed < 0 ? "text-amber-600" : "text-red-500"}`}>
                      {remainingMixed === 0 ? "Completado" : `$${remainingMixed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCheckoutType(null)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={executeSaleMutation.isPending || (checkoutType === "MIXED" && Math.abs(remainingMixed) > 0.01)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {executeSaleMutation.isPending ? "Procesando..." : "Confirmar Venta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && successDetails && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-100 dark:border-emerald-900/40">
              <Check size={32} />
            </div>

            <div>
              <h3 className="text-xl font-bold">Venta Exitosa</h3>
              <p className="text-xs text-zinc-400 font-mono mt-1">Ref: {successDetails.saleGroupId}</p>
            </div>

            <div className="border-t border-b border-zinc-100 dark:border-zinc-800/80 py-4 text-left space-y-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Detalles del Pedido</span>
              {successDetails.cart.map((item: any) => (
                <div key={item.eventProductId} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{item.name} <span className="text-zinc-400">x{item.quantity}</span></span>
                  <span className="font-semibold">${(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between text-base font-extrabold border-t pt-3 mt-3 border-zinc-100 dark:border-zinc-800/55">
                <span>Total pagado:</span>
                <span>${successDetails.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-xl text-left space-y-1.5 text-xs text-zinc-500">
              {successDetails.payments.map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>Pago con {p.method}:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {p.reference && ` (Ref: ${p.reference})`}
                    {p.change !== undefined && p.change > 0 && ` (Cambio: $${p.change.toLocaleString()})`}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow"
            >
              Listo (Entrar)
            </button>
          </div>
        </div>
      )}

      {/* CASH MOVEMENT MODAL */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Banknote className="text-indigo-600" /> Movimiento de Caja (Barra)
              </h3>
              <button onClick={() => setShowCashModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            {cashError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert size={16} /> {cashError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                registerCashMovementMutation.mutate(cashForm)
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Tipo de Movimiento</label>
                <select
                  value={cashForm.movementType}
                  onChange={(e) => setCashForm({ ...cashForm, movementType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="EXPENSE">Gasto Operativo (Salida de dinero)</option>
                  <option value="CASH_DROP">Vaciado de Caja / Retiro de efectivo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder={cashForm.movementType === "EXPENSE" ? "Ej: Compra de hielos" : "Ej: Retiro parcial caja fuerte"}
                  value={cashForm.description}
                  onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Monto ($)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={cashForm.totalAmount}
                    onChange={(e) => setCashForm({ ...cashForm, totalAmount: formatThousands(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Método de Pago</label>
                  <select
                    value={cashForm.method}
                    onChange={(e) => setCashForm({ ...cashForm, method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="QR">Código QR</option>
                    <option value="CARD">Tarjeta</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t pt-4 border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registerCashMovementMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {registerCashMovementMutation.isPending ? "Registrando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
