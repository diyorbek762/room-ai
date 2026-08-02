"use client";

import { useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/store";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { formatUZS, cn } from "@/lib/format";

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "Tashkent",
    address: "",
    payment: "cash",
  });
  const [submitted, setSubmitted] = useState(false);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.storeSlug]) acc[item.storeSlug] = [];
    acc[item.storeSlug].push(item);
    return acc;
  }, {});

  const total = items.reduce((sum, i) => sum + i.priceUZS * i.quantity, 0);

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 text-white flex items-center justify-center p-6">
        <GlassPanel variant="dark" blur="xl" rounded="3xl" className="p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
          <p className="text-white/70 mb-6">
            Thank you for your order. You&apos;ll receive a confirmation SMS at {form.phone}.
          </p>
          <p className="text-white/50 text-sm mb-6">
            Items will be delivered from {Object.keys(grouped).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" & ")}.
          </p>
          <div className="space-y-2">
            <Link
              href="/"
              onClick={() => clearCart()}
              className="block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl"
            >
              Back to Home
            </Link>
            <Link
              href="/catalog"
              onClick={() => clearCart()}
              className="block text-white/60 hover:text-white py-2 text-sm"
            >
              Continue Shopping
            </Link>
          </div>
        </GlassPanel>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 text-white flex items-center justify-center p-6">
        <GlassPanel variant="dark" blur="xl" rounded="3xl" className="p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🛒</div>
          <h1 className="text-xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-white/60 mb-6">Add furniture to your cart before checking out</p>
          <Link
            href="/catalog"
            className="block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl"
          >
            Browse Catalog
          </Link>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 text-white">
      <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold">
              R
            </div>
            <span className="font-bold">RoomAI</span>
          </Link>
          <span className="text-white/40 mx-2">›</span>
          <h1 className="text-lg font-semibold">Checkout</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <GlassPanel variant="dark" blur="xl" rounded="2xl" className="p-5">
            <h2 className="text-lg font-bold mb-4">Contact Information</h2>
            <div className="space-y-3">
              <Input
                label="Full Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Alisher Navoiy"
                required
              />
              <Input
                label="Phone Number"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="+998 90 123 45 67"
                type="tel"
                required
              />
            </div>
          </GlassPanel>

          <GlassPanel variant="dark" blur="xl" rounded="2xl" className="p-5">
            <h2 className="text-lg font-bold mb-4">Delivery Address</h2>
            <div className="space-y-3">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
                  City
                </label>
                <select
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Tashkent">Tashkent</option>
                  <option value="Samarkand">Samarkand</option>
                  <option value="Bukhara">Bukhara</option>
                  <option value="Andijan">Andijan</option>
                  <option value="Namangan">Namangan</option>
                  <option value="Fergana">Fergana</option>
                </select>
              </div>
              <Input
                label="Street Address"
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
                placeholder="Amir Temur ko'chasi, 12-uy"
                required
              />
            </div>
          </GlassPanel>

          <GlassPanel variant="dark" blur="xl" rounded="2xl" className="p-5">
            <h2 className="text-lg font-bold mb-4">Payment Method</h2>
            <div className="space-y-2">
              <PaymentOption
                value="cash"
                label="Cash on Delivery"
                description="Pay when you receive your order"
                selected={form.payment === "cash"}
                onSelect={(v) => setForm({ ...form, payment: v })}
                icon="💵"
              />
              <PaymentOption
                value="payme"
                label="Payme"
                description="Pay with Payme wallet"
                selected={form.payment === "payme"}
                onSelect={(v) => setForm({ ...form, payment: v })}
                icon="📱"
              />
              <PaymentOption
                value="click"
                label="Click"
                description="Pay with Click wallet"
                selected={form.payment === "click"}
                onSelect={(v) => setForm({ ...form, payment: v })}
                icon="💳"
              />
            </div>
          </GlassPanel>
        </div>

        <div className="lg:col-span-1">
          <GlassPanel variant="dark" blur="xl" rounded="2xl" className="p-5 sticky top-4">
            <h2 className="text-lg font-bold mb-4">Order Summary</h2>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {Object.entries(grouped).map(([storeSlug, storeItems]) => (
                <div key={storeSlug} className="border-b border-white/10 pb-3 last:border-0">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
                    From {storeItems[0].storeName}
                  </p>
                  {storeItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-1">
                      <span className="text-white/80 truncate flex-1">
                        {item.productName} ×{item.quantity}
                      </span>
                      <span className="text-white/80 ml-2">{formatUZS(item.priceUZS * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-3 mb-4 space-y-1">
              <div className="flex justify-between text-sm text-white/60">
                <span>Subtotal</span>
                <span>{formatUZS(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-white/60">
                <span>Delivery</span>
                <span className="text-emerald-400">Free</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                <span>Total</span>
                <span className="text-emerald-400">{formatUZS(total)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (form.name && form.phone && form.address) {
                  setSubmitted(true);
                }
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
              disabled={!form.name || !form.phone || !form.address}
            >
              Place Order
            </button>

            <p className="text-white/40 text-xs text-center mt-3">
              By placing this order you agree to our terms
            </p>
          </GlassPanel>
        </div>
      </main>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
        {label} {required && <span className="text-emerald-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-emerald-400"
      />
    </div>
  );
}

function PaymentOption({ value, label, description, selected, onSelect, icon }: {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  onSelect: (v: string) => void;
  icon: string;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
        selected
          ? "bg-emerald-500/20 border-emerald-400/50"
          : "bg-white/5 border-white/10 hover:border-white/30"
      )}
    >
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <p className="text-white font-medium text-sm">{label}</p>
        <p className="text-white/50 text-xs">{description}</p>
      </div>
      <div
        className={cn(
          "w-4 h-4 rounded-full border-2",
          selected ? "bg-emerald-500 border-emerald-500" : "border-white/30"
        )}
      />
    </button>
  );
}
