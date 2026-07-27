import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import { createProductImageUrl, normalizeProductImageUrls } from "@/lib/product-images";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { LogOut, Trash2, Upload, Plus, Save, X, ImageIcon, FileSpreadsheet, QrCode, Download } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Mayur Hardware" },
      { name: "description", content: "Mayur Hardware admin panel for managing products, brands, categories, images, QR code, and monthly orders." },
      { property: "og:title", content: "Admin Panel — Mayur Hardware" },
      { property: "og:description", content: "Mayur Hardware admin panel for managing products, brands, categories, images, QR code, and monthly orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type OrderStatus = "Ordered" | "Delivered" | "Cancelled";
type PaymentStatus = "Done" | "Pending" | "On Credit";

type Order = {
  id: string;
  salesperson_name: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  finish: string | null;
  price: number;
  quantity: number;
  unit: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
};

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
  is_active: boolean;
};

function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderMonth, setOrderMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate({ to: "/auth", search: { role: "admin" } }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", sess.session.user.id);
      if (!roles?.some((r) => r.role === "admin")) {
        toast.error("Admin access required");
        navigate({ to: "/" });
        return;
      }
      setAuthorized(true);
      await refresh();
      setLoading(false);
    })();
  }, [navigate]);

  const refresh = async () => {
    const [p, c, b] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("categories").select("name").order("name"),
      supabase.from("brands").select("name").order("name"),
    ]);
    setProducts(await normalizeProductImageUrls((p.data as Product[]) ?? []));
    setCategories(c.data?.map((r) => r.name) ?? []);
    setBrands(b.data?.map((r) => r.name) ?? []);
  };

  const loadOrders = async () => {
    const [y, m] = orderMonth.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 1).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    setOrders((data as Order[]) ?? []);
  };

  useEffect(() => {
    if (!authorized) return;
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, orderMonth]);

  const updateOrderField = async (id: string, patch: Partial<Order>) => {
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) { toast.error(error.message); loadOrders(); }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order deleted");
    setOrders((os) => os.filter((o) => o.id !== id));
  };

  const exportOrdersCsv = () => {
    if (!orders.length) { toast.error("No orders in this month"); return; }
    const cols = [
      "Date", "Salesperson", "Customer", "Product Code", "Product Name",
      "Brand", "Category", "Size", "Finish", "Price", "Quantity", "Unit",
      "Status", "Payment",
    ];
    const rows = orders.map((o) => [
      new Date(o.created_at).toLocaleString("en-IN"),
      o.salesperson_name, o.customer_name, o.product_code, o.product_name,
      o.brand ?? "", o.category ?? "", o.size ?? "", o.finish ?? "",
      String(o.price), String(o.quantity), o.unit,
      o.status, o.payment_status,
    ]);
    const csv = [cols, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${orderMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shopUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/`;
  }, []);
  const qrSrc = shopUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(shopUrl)}`
    : "";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const filtered = search.trim()
    ? products.filter((p) => {
        const t = search.toLowerCase();
        return p.code.toLowerCase().includes(t) || p.name.toLowerCase().includes(t) ||
          (p.brand ?? "").toLowerCase().includes(t) || (p.category ?? "").toLowerCase().includes(t);
      })
    : products;

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    const { error } = await supabase.from("categories").insert({ name });
    if (error) toast.error(error.message); else { toast.success("Category added"); setNewCategory(""); refresh(); }
  };
  const addBrand = async () => {
    const name = newBrand.trim();
    if (!name) return;
    const { error } = await supabase.from("brands").insert({ name });
    if (error) toast.error(error.message); else { toast.success("Brand added"); setNewBrand(""); refresh(); }
  };
  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refresh(); }
  };

  const handleExcelImport = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!rows.length) { toast.error("Sheet is empty"); return; }

      const norm = (r: Record<string, unknown>) => {
        const lower: Record<string, unknown> = {};
        for (const k of Object.keys(r)) lower[k.trim().toLowerCase().replace(/\s+/g, "_")] = r[k];
        const price = Number(lower["price"] ?? 0);
        return {
          code: String(lower["code"] ?? lower["product_code"] ?? "").trim(),
          name: String(lower["name"] ?? lower["product_name"] ?? "").trim(),
          description: String(lower["description"] ?? "").trim() || null,
          size: String(lower["size"] ?? "").trim() || null,
          finish: String(lower["finish"] ?? "").trim() || null,
          price: isFinite(price) ? price : 0,
          image_url: String(lower["image_url"] ?? lower["image"] ?? "").trim() || null,
          category: String(lower["category"] ?? "").trim() || null,
          brand: String(lower["brand"] ?? "").trim() || null,
          is_active: true,
        };
      };
      const cleaned = rows.map(norm).filter((r) => r.code && r.name);
      if (!cleaned.length) { toast.error("No valid rows (need 'code' and 'name' columns)"); return; }

      // Upsert in batches of 500
      let ok = 0;
      for (let i = 0; i < cleaned.length; i += 500) {
        const batch = cleaned.slice(i, i + 500);
        const { error } = await supabase.from("products").upsert(batch, { onConflict: "code" });
        if (error) { toast.error(`Row ${i}: ${error.message}`); break; }
        ok += batch.length;
      }
      toast.success(`Imported ${ok} products`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (xlsxRef.current) xlsxRef.current.value = "";
    }
  };

  if (loading || !authorized) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <header className="bg-header text-header-foreground sticky top-0 z-30 shadow">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <div className="font-bold">{SHOP_CONFIG.name} · Admin</div>
          <div className="flex-1" />
          <Link to="/" className="text-sm hover:underline">View shop</Link>
          <button onClick={signOut} className="flex items-center gap-1 rounded bg-header-accent px-3 py-1.5 text-sm hover:opacity-90">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Toolbar */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Import from Excel">
            <p className="text-xs text-muted-foreground mb-2">
              Columns: code, name, description, size, finish, price, image_url, category, brand.
              Rows with matching code will update.
            </p>
            <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleExcelImport(e.target.files[0])} className="hidden" />
            <button onClick={() => xlsxRef.current?.click()} disabled={importing} className="w-full flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60">
              <FileSpreadsheet className="h-4 w-4" /> {importing ? "Importing..." : "Choose Excel file"}
            </button>
          </Card>

          <Card title="Add Category">
            <div className="flex gap-2">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Door Handles" className="flex-1 rounded border px-2 py-1.5 text-sm" />
              <button onClick={addCategory} className="rounded bg-primary px-3 text-sm text-primary-foreground"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {categories.map((c) => <span key={c} className="rounded bg-secondary px-2 py-0.5 text-xs">{c}</span>)}
            </div>
          </Card>

          <Card title="Add Brand">
            <div className="flex gap-2">
              <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="e.g. Godrej" className="flex-1 rounded border px-2 py-1.5 text-sm" />
              <button onClick={addBrand} className="rounded bg-primary px-3 text-sm text-primary-foreground"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {brands.map((b) => <span key={b} className="rounded bg-secondary px-2 py-0.5 text-xs">{b}</span>)}
            </div>
          </Card>
        </div>

        {/* Products */}
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <div className="font-semibold">Products ({products.length})</div>
            <div className="flex-1" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded border px-2 py-1 text-sm w-full sm:w-64" />
            <button onClick={() => setEditing({ id: "", code: "", name: "", description: "", size: "", finish: "", price: 0, image_url: "", category: "", brand: "", is_active: true } as Product)} className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Image</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Brand</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">{p.brand}</td>
                    <td className="px-3 py-2">{p.category}</td>
                    <td className="px-3 py-2 text-right">{SHOP_CONFIG.currency}{Number(p.price).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setEditing(p)} className="text-primary hover:underline mr-3">Edit</button>
                      <button onClick={() => deleteProduct(p.id)} className="text-destructive hover:underline"><Trash2 className="h-4 w-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No products.</div>}
            {filtered.length > 200 && <div className="p-3 text-center text-xs text-muted-foreground">Showing first 200. Use search to narrow.</div>}
          </div>
        </div>

        {/* Orders */}
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <div className="font-semibold">Orders ({orders.length})</div>
            <div className="flex-1" />
            <label className="text-xs text-muted-foreground">Month</label>
            <input type="month" value={orderMonth} onChange={(e) => setOrderMonth(e.target.value)} className="rounded border px-2 py-1 text-sm" />
            <button onClick={exportOrdersCsv} className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Salesperson</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Brand</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Finish</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Payment</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(o.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2">{o.salesperson_name}</td>
                    <td className="px-3 py-2">{o.customer_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{o.product_code}</td>
                    <td className="px-3 py-2">{o.product_name}</td>
                    <td className="px-3 py-2">{o.brand}</td>
                    <td className="px-3 py-2">{o.size}</td>
                    <td className="px-3 py-2">{o.finish}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{o.quantity} {o.unit}</td>
                    <td className="px-3 py-2">
                      <select
                        value={o.status}
                        onChange={(e) => updateOrderField(o.id, { status: e.target.value as OrderStatus })}
                        className={`rounded border px-1.5 py-1 text-xs ${o.status === "Delivered" ? "bg-green-50 text-green-700" : o.status === "Cancelled" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}
                      >
                        <option value="Ordered">Ordered</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={o.payment_status}
                        onChange={(e) => updateOrderField(o.id, { payment_status: e.target.value as PaymentStatus })}
                        className={`rounded border px-1.5 py-1 text-xs ${o.payment_status === "Done" ? "bg-green-50 text-green-700" : o.payment_status === "On Credit" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-700"}`}
                      >
                        <option value="Done">Done</option>
                        <option value="Pending">Pending</option>
                        <option value="On Credit">On Credit</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditingOrder(o)} className="text-primary hover:underline mr-3 text-xs">Edit</button>
                      <button onClick={() => deleteOrder(o.id)} className="text-destructive hover:underline" aria-label="Delete order"><Trash2 className="h-4 w-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No orders this month.</div>}
          </div>
        </div>

        {/* QR Code for shop link */}
        <div className="rounded-lg border bg-card p-4">
          <div className="font-semibold text-sm mb-2 flex items-center gap-1">
            <QrCode className="h-4 w-4 text-primary" /> Shop QR Code
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Print this QR code — anyone who scans it opens the shop catalogue directly. Share the link below on WhatsApp or social media.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {qrSrc && <img src={qrSrc} alt="Shop QR code" width={280} height={280} className="rounded border bg-white p-2" />}
            <div className="flex-1 w-full space-y-2">
              <div className="text-xs text-muted-foreground">Shop link</div>
              <input readOnly value={shopUrl} className="w-full rounded border bg-background px-2 py-1.5 text-sm" onFocus={(e) => e.currentTarget.select()} />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { navigator.clipboard.writeText(shopUrl); toast.success("Link copied"); }} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">Copy link</button>
                {qrSrc && <a href={qrSrc} download="shop-qr-code.png" className="rounded border px-3 py-1.5 text-xs hover:bg-muted">Download QR</a>}
                <Link to="/sales" className="rounded border px-3 py-1.5 text-xs hover:bg-muted">Open Sales panel</Link>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2">
                Note: always share the shop link above with customers — not the admin/auth pages.
              </p>
            </div>
          </div>
        </div>
      </main>


      {editing && <ProductEditor initial={editing} categories={categories} brands={brands} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {editingOrder && <OrderEditor initial={editingOrder} onClose={() => setEditingOrder(null)} onSaved={(updated) => { setOrders((os) => os.map((o) => o.id === updated.id ? updated : o)); setEditingOrder(null); }} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="font-semibold text-sm mb-2 flex items-center gap-1"><Upload className="h-4 w-4 text-primary" />{title}</div>
      {children}
    </div>
  );
}

function ProductEditor({ initial, categories, brands, onClose, onSaved }: {
  initial: Product; categories: string[]; brands: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Product>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      const imageUrl = await createProductImageUrl(path);
      setForm((f) => ({ ...f, image_url: imageUrl }));
      toast.success("Image uploaded — click Save to keep it");
    } catch (e) {
      console.error("[upload]", e);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Code and name are required"); return; }
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description || null,
      size: form.size || null,
      finish: form.finish || null,
      price: Number(form.price) || 0,
      image_url: form.image_url || null,
      category: form.category || null,
      brand: form.brand || null,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); onSaved(); }
  };

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto">
      <div className="w-full max-w-lg rounded-lg bg-card border shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-semibold">{form.id ? "Edit product" : "New product"}</div>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product Code *"><input value={form.code} onChange={(e) => set("code", e.target.value)} className="input" /></Field>
            <Field label="Price"><input type="number" step="0.01" value={form.price} onChange={(e) => set("price", Number(e.target.value))} className="input" /></Field>
          </div>
          <Field label="Product Name *"><input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" /></Field>
          <Field label="Description"><textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size"><input value={form.size ?? ""} onChange={(e) => set("size", e.target.value)} className="input" /></Field>
            <Field label="Finish"><input value={form.finish ?? ""} onChange={(e) => set("finish", e.target.value)} className="input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input list="cats" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} className="input" />
              <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Brand">
              <input list="brs" value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} className="input" />
              <datalist id="brs">{brands.map((b) => <option key={b} value={b} />)}</datalist>
            </Field>
          </div>
          <Field label="Product Image">
            <div className="flex items-center gap-3">
              {form.image_url && <img src={form.image_url} alt="" className="h-14 w-14 rounded object-cover border" />}
              <label className="flex-1 cursor-pointer rounded border border-dashed p-2 text-xs text-center hover:bg-muted">
                {uploading ? "Uploading..." : "Click to upload image"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              {form.image_url && <button onClick={() => set("image_url", "")} className="text-xs text-destructive">Remove</button>}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Active (visible to customers)
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <style>{`.input{width:100%;border:1px solid var(--color-border);border-radius:6px;padding:6px 10px;font-size:14px;background:var(--color-background)}.input:focus{outline:none;box-shadow:0 0 0 2px var(--color-primary)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function OrderEditor({ initial, onClose, onSaved }: {
  initial: Order; onClose: () => void; onSaved: (updated: Order) => void;
}) {
  const [form, setForm] = useState<Order>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Order>(k: K, v: Order[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const patch = {
      size: form.size || null,
      finish: form.finish || null,
      quantity: Number(form.quantity) || 1,
      unit: form.unit,
      status: form.status,
      payment_status: form.payment_status,
    };
    const { error } = await supabase.from("orders").update(patch).eq("id", form.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Order updated");
    onSaved({ ...form, ...patch });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto">
      <div className="w-full max-w-md rounded-lg bg-card border shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-semibold">Edit order</div>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            <div><span className="font-medium">{form.product_name}</span> · <span className="font-mono">{form.product_code}</span></div>
            <div>Customer: {form.customer_name} · Salesperson: {form.salesperson_name}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size"><input value={form.size ?? ""} onChange={(e) => set("size", e.target.value)} className="input" /></Field>
            <Field label="Finish"><input value={form.finish ?? ""} onChange={(e) => set("finish", e.target.value)} className="input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><input type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} className="input" /></Field>
            <Field label="Unit">
              <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className="input">
                <option value="Nos">Nos</option>
                <option value="Box">Box</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value as OrderStatus)} className="input">
                <option value="Ordered">Ordered</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Payment">
              <select value={form.payment_status} onChange={(e) => set("payment_status", e.target.value as PaymentStatus)} className="input">
                <option value="Done">Done</option>
                <option value="Pending">Pending</option>
                <option value="On Credit">On Credit</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <style>{`.input{width:100%;border:1px solid var(--color-border);border-radius:6px;padding:6px 10px;font-size:14px;background:var(--color-background)}.input:focus{outline:none;box-shadow:0 0 0 2px var(--color-primary)}`}</style>
    </div>
  );
}
