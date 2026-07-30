import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import { normalizeProductImageUrls } from "@/lib/product-images";
import { toast } from "sonner";
import { Search, MessageCircle, Minus, Plus, ImageOff, LogOut, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Salesperson Orders — Mayur Hardware" },
      { name: "description", content: "Mayur Hardware salesperson order-entry panel for creating WhatsApp orders and recording customer requests." },
      { property: "og:title", content: "Salesperson Orders — Mayur Hardware" },
      { property: "og:description", content: "Mayur Hardware salesperson order-entry panel for creating WhatsApp orders and recording customer requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

type Product = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  size: string | null;
  finish: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  brand: string | null;
};

function SalesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [salespersonName, setSalespersonName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate({ to: "/auth", search: { role: "salesperson" } }); return; }
      const uid = sess.session.user.id;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const hasAccess = roles?.some((r) => r.role === "salesperson" || r.role === "admin");
      if (!hasAccess) {
        toast.error("Salesperson access required");
        navigate({ to: "/" });
        return;
      }
      const meta = sess.session.user.user_metadata as { full_name?: string } | null;
      setSalespersonName(meta?.full_name || sess.session.user.email || "Salesperson");
      const [c, b] = await Promise.all([
        supabase.from("categories").select("name").order("name"),
        supabase.from("brands").select("name").order("name"),
      ]);
      setCategories(c.data?.map((r) => r.name) ?? []);
      setBrands(b.data?.map((r) => r.name) ?? []);
      setAuthorized(true);
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!authorized) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      let q = supabase.from("products").select("*").eq("is_active", true).order("name").limit(60);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`name.ilike.${term},code.ilike.${term},brand.ilike.${term},category.ilike.${term}`);
      }
      if (category) q = q.eq("category", category);
      if (brand) q = q.eq("brand", brand);
      const { data } = await q;
      setProducts(await normalizeProductImageUrls((data as Product[]) ?? []));
      setSearching(false);
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [authorized, query, category, brand]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !authorized) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-header text-header-foreground shadow-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
          <div className="font-bold">{SHOP_CONFIG.name} · Salesperson Orders</div>
          <div className="flex-1" />
          <div className="hidden sm:block text-xs opacity-80">
            <ClipboardList className="inline h-3.5 w-3.5 mr-1" />
            {salespersonName}
          </div>
          <Link to="/" className="text-sm hover:underline">Shop view</Link>
          <button onClick={signOut} className="flex items-center gap-1 rounded bg-header-accent px-3 py-1.5 text-sm hover:opacity-90">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <div className="bg-header-accent">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (required for each order)"
              className="flex-1 rounded-md bg-white px-3 py-2 text-sm text-foreground shadow"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white overflow-hidden shadow">
            <div className="pl-3 text-muted-foreground"><Search className="h-4 w-4" /></div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product name, code, brand, category..."
              className="flex-1 py-2.5 px-2 text-sm outline-none text-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded bg-white/95 px-2 py-1 text-foreground">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded bg-white/95 px-2 py-1 text-foreground">
              <option value="">All Brands</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {(query || category || brand) && (
              <button onClick={() => { setQuery(""); setCategory(""); setBrand(""); }} className="rounded bg-white/20 px-2 py-1 text-white hover:bg-white/30">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-3 text-sm text-muted-foreground">
          {searching ? "Searching..." : `${products.length} product${products.length === 1 ? "" : "s"}`}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((p) => (
            <OrderCard
              key={p.id}
              product={p}
              customerName={customerName}
              salespersonName={salespersonName}
            />
          ))}
        </div>
        {!searching && products.length === 0 && (
          <div className="mt-16 text-center text-muted-foreground">No products found.</div>
        )}
      </main>
    </div>
  );
}

type Variant = { size: string; finish: string; qty: number; unit: "Nos" | "Box" };

function OrderCard({ product, customerName, salespersonName }: { product: Product; customerName: string; salespersonName: string }) {
  const sizes = useMemo(
    () => (product.size ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [product.size]
  );
  const [variants, setVariants] = useState<Variant[]>([
    { size: sizes[0] ?? "", finish: product.finish ?? "", qty: 1, unit: "Nos" },
  ]);
  const [sending, setSending] = useState(false);


  const priceStr = useMemo(
    () => `${SHOP_CONFIG.currency}${Number(product.price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
    [product.price]
  );

  const updateVariant = (i: number, patch: Partial<Variant>) => {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };
  const addVariant = () => setVariants((prev) => [...prev, { size: "", finish: "", qty: 1, unit: "Nos" }]);
  const removeVariant = (i: number) => setVariants((prev) => prev.filter((_, idx) => idx !== i));

  const sendOrder = async () => {
    if (!customerName.trim()) { toast.error("Enter customer name at top first"); return; }
    const validVariants = variants.filter((v) => v.qty > 0);
    if (validVariants.length === 0) { toast.error("Add at least one row with quantity"); return; }
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("Not signed in");
      const rows = validVariants.map((v) => ({
        salesperson_id: sess.session!.user.id,
        salesperson_name: salespersonName,
        customer_name: customerName.trim(),
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        brand: product.brand,
        category: product.category,
        size: v.size || null,
        finish: v.finish || null,
        price: product.price,
        quantity: v.qty,
        unit: v.unit,
      }));
      const { error } = await supabase.from("orders").insert(rows);
      if (error) throw error;

      const lines = validVariants
        .map((v, i) => {
          const parts = [
            `${i + 1}) Qty: ${v.qty} ${v.unit}`,
            v.size ? `Size: ${v.size}` : null,
            v.finish ? `Finish: ${v.finish}` : null,
          ].filter(Boolean);
          return parts.join(" | ");
        })
        .join("\n");

      const msg =
        `Hello, New Order From "${salespersonName}"\n\n` +
        `Customer Name - ${customerName.trim()}\n\n` +
        `Product Code: ${product.code}\n\n` +
        `Product Name: ${product.name}\n\n` +
        `Brand: ${product.brand ?? "-"}\n\n` +
        `Items:\n${lines}`;
      const href = `https://wa.me/${SHOP_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
      window.open(href, "_blank", "noopener,noreferrer");
      toast.success("Order recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send order");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col rounded-md border bg-card p-2.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-square w-full overflow-hidden rounded bg-muted flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <ImageOff className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 space-y-0.5 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{product.brand ?? " "}</div>
        <div className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]">{product.name}</div>
        <div className="text-[11px] text-muted-foreground">Code: {product.code}</div>
      </div>
      <div className="mt-2 text-lg font-bold text-price">{priceStr}</div>

      <div className="mt-2 space-y-2">
        {variants.map((v, i) => (
          <div key={i} className="rounded border bg-muted/30 p-1.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
              <span>Variant {i + 1}</span>
              {variants.length > 1 && (
                <button onClick={() => removeVariant(i)} className="text-destructive hover:underline">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {sizes.length > 0 ? (
                <select
                  value={v.size}
                  onChange={(e) => updateVariant(i, { size: e.target.value })}
                  className="rounded border px-1.5 py-1 text-xs"
                >
                  <option value="">Size</option>
                  {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  value={v.size}
                  onChange={(e) => updateVariant(i, { size: e.target.value })}
                  placeholder="Size"
                  className="rounded border px-1.5 py-1 text-xs"
                />
              )}
              <input
                value={v.finish}
                onChange={(e) => updateVariant(i, { finish: e.target.value })}
                placeholder="Finish"
                className="rounded border px-1.5 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => updateVariant(i, { qty: Math.max(1, v.qty - 1) })} className="rounded border p-1 hover:bg-muted"><Minus className="h-3 w-3" /></button>
              <input
                type="number"
                min={1}
                value={v.qty}
                onChange={(e) => updateVariant(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                className="w-full rounded border px-1.5 py-1 text-center text-xs"
              />
              <button onClick={() => updateVariant(i, { qty: v.qty + 1 })} className="rounded border p-1 hover:bg-muted"><Plus className="h-3 w-3" /></button>
              <select
                value={v.unit}
                onChange={(e) => updateVariant(i, { unit: e.target.value as "Nos" | "Box" })}
                className="rounded border px-1 py-1 text-xs"
              >
                <option value="Nos">Nos</option>
                <option value="Box">Box</option>
              </select>
            </div>
          </div>
        ))}
        <button onClick={addVariant} className="w-full rounded border border-dashed py-1 text-xs text-primary hover:bg-primary/5">
          + Add size / finish
        </button>
      </div>

      <button
        onClick={sendOrder}
        disabled={sending}
        className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-whatsapp px-3 py-2 text-sm font-semibold text-whatsapp-foreground hover:opacity-90 disabled:opacity-60"
      >
        <MessageCircle className="h-4 w-4" /> {sending ? "Sending..." : "Send Order"}
      </button>
    </div>
  );
}
