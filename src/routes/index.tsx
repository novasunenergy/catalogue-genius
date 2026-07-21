import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import { SiteHeader } from "@/components/SiteHeader";
import { Search, MessageCircle, Minus, Plus, ImageOff } from "lucide-react";

export const Route = createFileRoute("/")({
  component: CataloguePage,
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

function CataloguePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [c, b] = await Promise.all([
        supabase.from("categories").select("name").order("name"),
        supabase.from("brands").select("name").order("name"),
      ]);
      setCategories(c.data?.map((r) => r.name) ?? []);
      setBrands(b.data?.map((r) => r.name) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      let q = supabase.from("products").select("*").eq("is_active", true).order("name").limit(60);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`name.ilike.${term},code.ilike.${term},brand.ilike.${term},category.ilike.${term}`);
      }
      if (category) q = q.eq("category", category);
      if (brand) q = q.eq("brand", brand);
      const { data } = await q;
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category, brand]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Search bar row */}
      <div className="bg-header-accent">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2 rounded-md bg-white overflow-hidden shadow">
            <div className="pl-3 text-muted-foreground"><Search className="h-4 w-4" /></div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product name, code, brand or category..."
              className="flex-1 py-2.5 px-2 text-sm outline-none text-foreground"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
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
          {loading ? "Searching..." : `${products.length} product${products.length === 1 ? "" : "s"}`}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
        {!loading && products.length === 0 && (
          <div className="mt-16 text-center text-muted-foreground">
            No products found. Try a different search.
          </div>
        )}
      </main>

      <footer className="border-t bg-header text-header-foreground/80 py-6 mt-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm">
          © {new Date().getFullYear()} {SHOP_CONFIG.name} · Enquire on WhatsApp: +{SHOP_CONFIG.whatsappNumber}
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const priceStr = useMemo(
    () => `${SHOP_CONFIG.currency}${Number(product.price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
    [product.price]
  );

  const whatsappHref = useMemo(() => {
    const msg =
      `Hello, I would like to enquire about:\n\n` +
      `Product Code: ${product.code}\n` +
      `Product Name: ${product.name}\n` +
      `Brand: ${product.brand ?? "-"}\n` +
      `Price: ${priceStr}\n` +
      `Quantity: ${qty}`;
    return `https://wa.me/${SHOP_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }, [product, qty, priceStr]);

  return (
    <div className="flex flex-col rounded-md border bg-card p-2.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-square w-full overflow-hidden rounded bg-muted flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <ImageOff className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 space-y-0.5 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{product.brand ?? " "}</div>
        <div className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]">{product.name}</div>
        <div className="text-[11px] text-muted-foreground">Code: {product.code}</div>
        {(product.size || product.finish) && (
          <div className="text-[11px] text-muted-foreground truncate">
            {[product.size && `Size: ${product.size}`, product.finish && `Finish: ${product.finish}`].filter(Boolean).join(" · ")}
          </div>
        )}
        {product.description && (
          <div className="text-[11px] text-muted-foreground line-clamp-2">{product.description}</div>
        )}
      </div>
      <div className="mt-2 text-lg font-bold text-price">{priceStr}</div>
      <div className="mt-2 flex items-center gap-1">
        <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="rounded border p-1 hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded border px-2 py-1 text-center text-sm" />
        <button onClick={() => setQty((q) => q + 1)} className="rounded border p-1 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-whatsapp px-3 py-2 text-sm font-semibold text-whatsapp-foreground hover:opacity-90"
      >
        <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
      </a>
    </div>
  );
}
