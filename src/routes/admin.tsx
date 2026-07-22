import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { LogOut, Trash2, Upload, Plus, Save, X, ImageIcon, FileSpreadsheet, QrCode, Download } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

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

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate({ to: "/auth" }); return; }
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
    setProducts((p.data as Product[]) ?? []);
    setCategories(c.data?.map((r) => r.name) ?? []);
    setBrands(b.data?.map((r) => r.name) ?? []);
  };

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
      </main>

      {editing && <ProductEditor initial={editing} categories={categories} brands={brands} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
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
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) throw error;
      // Bucket is private (public buckets are blocked by workspace policy), so use a long-lived signed URL
      const { data: signed, error: signErr } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years
      if (signErr || !signed) throw signErr ?? new Error("Failed to create signed URL");
      setForm((f) => ({ ...f, image_url: signed.signedUrl }));
      toast.success("Image uploaded");
    } catch (e) {
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
