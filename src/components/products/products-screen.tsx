"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icon";
import { defaultCategories, productRequest, type Product } from "./product";
import { ProductDialog, DeleteDialog } from "./product-dialog";
import { ProductTable } from "./product-table";
import s from "./products.module.css";

const navigation: { label: string; icon: IconName }[] = [
  { label: "Dashboard", icon: "grid" }, { label: "Products", icon: "box" },
  { label: "Sales", icon: "cart" }, { label: "Inventory", icon: "stock" },
  { label: "Reports", icon: "chart" }, { label: "Settings", icon: "settings" },
];
const pageSize = 12;

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ product: Product | null } | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const requestId = useRef(0);

  async function load() {
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const data = await productRequest<Product[]>("/api/products");
      if (id === requestId.current) setProducts(data);
    } catch (err) { if (id === requestId.current) setError(err instanceof Error ? err.message : "Unable to load products."); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  useEffect(() => {
    // Fetch the inventory when this screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const activeRequest = requestId;
    return () => { activeRequest.current++; };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const categories = [...new Set([...defaultCategories, ...products.map(p => p.category)])];
  const query = search.trim().toLocaleLowerCase();
  const filtered = products.filter(p => (!category || p.category === category) &&
    (!query || p.name.toLocaleLowerCase().includes(query) || p.barcode?.toLocaleLowerCase().includes(query)) &&
    (stock === "all" || (stock === "low" ? Number(p.quantity) > 0 && Number(p.quantity) <= 5 : stock === "out" ? Number(p.quantity) === 0 : Number(p.quantity) > 5)));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const lowStock = products.filter(p => Number(p.quantity) > 0 && Number(p.quantity) <= 5).length;
  const outOfStock = products.filter(p => Number(p.quantity) === 0).length;
  const stats: { label: string; value: number; detail: string; icon: IconName; tone: string }[] = [
    { label: "Total Products", value: products.length, detail: "In your catalogue", icon: "box", tone: s.blue },
    { label: "Available Products", value: products.filter(p => Number(p.quantity) > 0).length, detail: "Products with stock", icon: "stock", tone: s.teal },
    { label: "Low Stock", value: lowStock, detail: `${outOfStock} out of stock · Up to 5 selected units is low`, icon: "alert", tone: s.amber },
    { label: "Categories", value: new Set(products.map(p => p.category)).size, detail: "Across your products", icon: "tag", tone: s.violet },
  ];
  function resetFilters() { setSearch(""); setCategory(""); setStock("all"); setPage(1); }
  function saved(product: Product) {
    const editing = Boolean(editor?.product);
    setProducts(list => editing ? list.map(p => p.id === product.id ? product : p) : [product, ...list]);
    setEditor(null); setNotice(editing ? `${product.name} updated.` : `${product.name} added to your catalogue.`);
    if (!editing) resetFilters();
  }

  return <div className={s.app}>
    <aside className={s.sidebar}>
      <div className={s.brand}><span className={s.brandMark}><Icon name="shop" size={25} /></span><div>Grocery <b>POS</b><small>YOUR EVERYDAY STORE COMPANION</small></div></div>
      <span className={s.navLabel}>WORKSPACE</span>
      <nav aria-label="Main navigation">{navigation.map(item => item.label === "Products" ? <Link key={item.label} href="/" aria-label={item.label} className={s.activeNav} aria-current="page"><Icon name={item.icon} /><span>{item.label}</span><span className={s.activeDot} /></Link> : <button key={item.label} aria-label={item.label + " (coming soon)"} disabled title="Coming soon"><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav>
      <div className={s.sidebarBottom}><div className={s.localNote}><Icon name="shop" size={18} /><div>Made for your shop<small>Local workspace · LKR</small></div></div><div className={s.version}><span>Grocery POS</span><span>v0.1</span></div></div>
    </aside>
    <div className={s.workspace}>
      <header className={s.header}><div className={s.breadcrumb}>Workspace <Icon name="right" size={13} /><strong>Products</strong></div><div className={s.headerRight}><span className={s.currency}>LKR <span>·</span> Sri Lanka</span><span className={s.storeAvatar}><Icon name="shop" size={18} /></span></div></header>
      <main className={s.main}>
        <div className={s.pageHeading}><div><div className={s.eyebrow}>YOUR SHOP, ORGANIZED</div><h1>Products<span className={s.titleDot}>.</span></h1><p>Manage products and inventory, all in one place.</p></div><div className={s.headingActions}><label className={s.search}><Icon name="search" size={18} /><input aria-label="Search products by name or barcode" placeholder="Search name or barcode…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />{search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }}><Icon name="close" size={15} /></button>}</label><button className={s.primary} disabled={loading} onClick={() => setEditor({ product: null })}><Icon name="plus" size={18} />Add Product</button></div></div>
        <section className={s.stats} aria-label="Inventory summary">{stats.map(stat => <article className={s.stat} key={stat.label}><div><p>{stat.label}</p><strong>{loading ? "—" : error && !products.length ? "—" : stat.value.toLocaleString("en-LK")}</strong><small>{stat.detail}</small></div><span className={`${s.statIcon} ${stat.tone}`}><Icon name={stat.icon} size={23} /></span></article>)}</section>
        <section className={s.panel} aria-labelledby="catalogue-title" aria-busy={loading}>
          <div className={s.panelHeader}><div><h2 id="catalogue-title">Product catalogue <span>{products.length}</span></h2><p>A clear view of everything on your shelves.</p></div><button className={s.secondary} onClick={() => void load()} disabled={loading}><Icon name="refresh" size={16} />{loading ? "Loading…" : "Refresh"}</button></div>
          <div className={s.toolbar}><div className={s.categories} aria-label="Filter by category"><button aria-pressed={!category} className={!category ? s.selectedCategory : ""} onClick={() => { setCategory(""); setPage(1); }}>All products</button>{categories.map(c => <button key={c} aria-pressed={category === c} className={category === c ? s.selectedCategory : ""} onClick={() => { setCategory(c); setPage(1); }}>{c}</button>)}</div><select className={s.stockSelect} aria-label="Filter by stock status" value={stock} onChange={e => { setStock(e.target.value); setPage(1); }}><option value="all">All stock levels</option><option value="in">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option></select></div>
          {error && <div role="alert" className={`${s.error} ${s.loadError}`}><Icon name="alert" />{error}<button className={s.secondary} onClick={() => void load()}>Try again</button></div>}
          {loading ? <div className={s.empty} role="status"><span className={s.emptyIcon}><Icon name="box" size={30} /></span><h3>Loading your catalogue</h3><p>Getting the latest products from your shop.</p></div> : !error && !filtered.length ? <div className={s.empty}><span className={s.emptyIcon}><Icon name={products.length ? "search" : "box"} size={32} /></span><h3>{products.length ? "No matching products" : "Your shelves start here"}</h3><p>{products.length ? "Try a different search or clear your filters." : "Add your first product to start keeping track of your stock."}</p><button className={s.primary} onClick={() => products.length ? resetFilters() : setEditor({ product: null })}><Icon name={products.length ? "refresh" : "plus"} size={17} />{products.length ? "Clear filters" : "Add your first product"}</button></div> : !loading && visible.length > 0 ? <ProductTable products={visible} onEdit={product => setEditor({ product })} onDelete={setDeleting} /> : null}
          <div className={s.tableFooter}><span>{filtered.length ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} products` : "0 products"}{error && products.length > 0 ? " · Last loaded data" : ""}</span><div className={s.pagination}><button aria-label="Previous page" disabled={currentPage === 1 || loading} onClick={() => setPage(currentPage - 1)}><Icon name="left" size={16} /></button><span>Page {currentPage} of {pages}</span><button aria-label="Next page" disabled={currentPage === pages || loading} onClick={() => setPage(currentPage + 1)}><Icon name="right" size={16} /></button></div></div>
        </section>
        <footer className={s.workspaceFooter}><span><Icon name="box" size={14} />Good stock management. Better days at the shop.</span><span>All prices in Sri Lankan Rupees</span></footer>
      </main>
    </div>
    {notice && <div className={s.toast} role="status"><span><Icon name="check" size={19} /></span>{notice}<button aria-label="Dismiss notification" className={s.iconButton} onClick={() => setNotice("")}><Icon name="close" size={16} /></button></div>}
    {editor && <ProductDialog product={editor.product} categories={categories} onClose={() => setEditor(null)} onSaved={saved} />}
    {deleting && <DeleteDialog product={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setProducts(list => list.filter(p => p.id !== deleting.id)); setNotice(`${deleting.name} deleted.`); setDeleting(null); }} />}
  </div>;
}
