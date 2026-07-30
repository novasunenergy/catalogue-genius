import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import { normalizeProductImageUrls } from "@/lib/product-images";
import { SiteHeader } from "@/components/SiteHeader";
import { Search, MessageCircle, Minus, Plus, ImageOff, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mayur Hardware Catalogue" },
      { name: "description", content: "Browse Mayur Hardware products by name, code, brand, or category and enquire instantly on WhatsApp." },
      { property: "og:title", content: "Mayur Hardware Catalogue" },
      { property: "og:description", content: "Browse Mayur Hardware products by name, code, brand, or category and enquire instantly on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [c, b, n] = await Promise.all([
        supabase.from("categories").select("name").order("name"),
        supabase.from("brands").select("name").order("name"),
        supabase.from("products").select("category").eq("is_active", true).gte("created_at", since),
      ]);
      setCategories(c.data?.map((r) => r.name) ?? []);
      setBrands(b.data?.map((r) => r.name) ?? []);
      const cats = Array.from(new Set((n.data ?? []).map((r) => r.category).filter((x): x is string => !!x)));
      setNewCategories(cats);
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
      setProducts(await normalizeProductImageUrls((data as Product[]) ?? []));
      setLoading(false);
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category, brand]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
          <h1 className="text-base font-bold text-foreground sm:text-lg">Mayur Hardware Product Catalogue</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Browse our full range of hardware products and send your enquiry on WhatsApp.</p>
        </div>
      </section>


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
        {newCategories.length > 0 && (
          <div className="mb-4 space-y-1">
            {newCategories.map((cat) => (
              <div key={cat} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                🆕 New Product is added for "{cat}"
              </div>
            ))}
          </div>
        )}
        <div className="mb-3 text-sm text-muted-foreground">
          {loading ? "Searching..." : `${products.length} product${products.length === 1 ? "" : "s"}`}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((p) => <ProductCard key={p.id} product={p} onOpen={() => setSelected(p)} />)}
        </div>
        {!loading && products.length === 0 && (
          <div className="mt-16 text-center text-muted-foreground">
            No products found. Try a different search.
          </div>
        )}
      </main>

      {selected && <ProductDetailModal product={selected} onClose={() => setSelected(null)} />}

      <footer className="border-t bg-header text-header-foreground/80 py-6 mt-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm">
          © {new Date().getFullYear()} {SHOP_CONFIG.name} · Enquire on WhatsApp: +{SHOP_CONFIG.whatsappNumber}
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const [qty, setQty] = useState(1);

  const whatsappHref = useMemo(() => {
    const msg =
      `Hello, I would like to enquire about:\n\n` +
      `Product Code: ${product.code}\n` +
      `Product Name: ${product.name}\n` +
      `Brand: ${product.brand ?? "-"}\n` +
      `Quantity: ${qty}`;
    return `https://wa.me/${SHOP_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }, [product, qty]);

  return (
    <div className="flex flex-col rounded-md border bg-card p-2.5 shadow-sm hover:shadow-md transition-shadow">
      <button onClick={onOpen} className="aspect-square w-full overflow-hidden rounded bg-muted flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <ImageOff className="h-10 w-10 text-muted-foreground" />
        )}
      </button>
      <button onClick={onOpen} className="mt-2 space-y-0.5 flex-1 text-left">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{product.brand ?? " "}</div>
        <div className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem] hover:underline">{product.name}</div>
        <div className="text-[11px] text-muted-foreground">Code: {product.code}</div>
        {(product.size || product.finish) && (
          <div className="text-[11px] text-muted-foreground truncate">
            {[product.size && `Size: ${product.size}`, product.finish && `Finish: ${product.finish}`].filter(Boolean).join(" · ")}
          </div>
        )}
      </button>
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

function ProductDetailModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const sizes = useMemo(
    () => (product.size ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [product.size]
  );
  const [size, setSize] = useState(sizes[0] ?? "");
  const whatsappHref = useMemo(() => {
    const msg =
      `Hello, I would like to enquire about:\n\n` +
      `Product Code: ${product.code}\n` +
      `Product Name: ${product.name}\n` +
      `Brand: ${product.brand ?? "-"}\n` +
      (size ? `Size: ${size}\n` : "") +
      `Quantity: ${qty}`;
    return `https://wa.me/${SHOP_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }, [product, qty, size]);


  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 overflow-auto" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-lg bg-card border shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-semibold truncate">{product.name}</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="aspect-square w-full overflow-hidden rounded bg-muted flex items-center justify-center">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-2 text-sm">
            {product.brand && <div className="text-xs uppercase tracking-wide text-muted-foreground">{product.brand}</div>}
            <div><span className="text-muted-foreground">Code:</span> <span className="font-mono">{product.code}</span></div>
            {product.category && <div><span className="text-muted-foreground">Category:</span> {product.category}</div>}
            {sizes.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Size{sizes.length > 1 ? " (choose one)" : ""}:</div>
                <div className="flex flex-wrap gap-1.5">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`rounded-full border px-3 py-1 text-xs ${size === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {product.finish && <div><span className="text-muted-foreground">Finish:</span> {product.finish}</div>}
            {product.description && (
              <div className="pt-2">
                <div className="text-muted-foreground text-xs mb-1">Description</div>
                <div className="whitespace-pre-wrap">{product.description}</div>
              </div>
            )}
            <div className="pt-3 flex items-center gap-2">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="rounded border p-1.5 hover:bg-muted"><Minus className="h-4 w-4" /></button>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded border px-2 py-1.5 text-center" />
              <button onClick={() => setQty((q) => q + 1)} className="rounded border p-1.5 hover:bg-muted"><Plus className="h-4 w-4" /></button>
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md bg-whatsapp px-4 py-2 text-sm font-semibold text-whatsapp-foreground hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
