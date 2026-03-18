import React, { useEffect, useState } from 'react'
import UploadExcel, { UploadMode } from '../components/UploadExcel'
import { Search, Package, ChevronLeft, ChevronRight, Settings2, Database, GitMerge, X } from 'lucide-react'

interface Product {
  sku: string;
  [key: string]: any;
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [columns, setColumns] = useState<string[]>(['sku', 'modele', 'categorie', 'size', 'couleur']);
  const DEFAULT_VISIBLE = ['sku', 'modele', 'categorie', 'size', 'couleur'];
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('catalogVisibleCols') || '[]')); } catch { return new Set(DEFAULT_VISIBLE); }
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Import panel
  const [activeMode, setActiveMode] = useState<UploadMode | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
  const authHeader = { Authorization: `Bearer ${localStorage.getItem('gyl_auth_token')}` };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/products?page=${page}&limit=50&search=${encodeURIComponent(search)}`, { headers: authHeader });
      const data = await res.json();
      setProducts(data.data || []);
      setTotal(data.meta?.total || 0);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const fetchColumns = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/catalog/columns`, { headers: authHeader });
      const data = await res.json();
      if (data.data?.length > 0) {
        const cols: string[] = data.data;
        const final = ['sku', ...cols.filter(c => c !== 'sku')];
        setColumns(final);
        setVisibleCols(prev => { const s = new Set(prev); s.add('sku'); return s; });
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchColumns(); }, []);
  useEffect(() => { fetchProducts(); }, [page, search]);
  useEffect(() => { localStorage.setItem('catalogVisibleCols', JSON.stringify(Array.from(visibleCols))); }, [visibleCols]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); };
  const toggleColumn = (col: string) => {
    if (col === 'sku') return;
    const s = new Set(visibleCols);
    if (s.has(col)) s.delete(col); else s.add(col);
    setVisibleCols(s);
  };

  const onUploadSuccess = () => {
    setActiveMode(null);
    fetchProducts();
    fetchColumns();
  };

  const activeColumns = columns.filter(col => visibleCols.has(col));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-600" />
          Catalogue Central
          {total > 0 && <span className="text-sm font-normal text-gray-400 ml-2">{total} produits</span>}
        </h1>
      </div>

      {/* Import actions */}
      {!activeMode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveMode('base')}
            className="flex items-start gap-4 p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Importer le catalogue</p>
              <p className="text-sm text-gray-500 mt-0.5">Création initiale ou remplacement complet. Importe tous les champs d'un fichier Excel.</p>
            </div>
          </button>

          <button
            onClick={() => setActiveMode('enrich')}
            className="flex items-start gap-4 p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group"
          >
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
              <GitMerge className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Enrichir les données</p>
              <p className="text-sm text-gray-500 mt-0.5">Merge ciblé sur les SKU existants. URLs photos, liens Drive, nouvelles colonnes…</p>
            </div>
          </button>
        </div>
      )}

      {/* Import panel */}
      {activeMode && (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {activeMode === 'base'
                ? <Database className="w-5 h-5 text-blue-600" />
                : <GitMerge className="w-5 h-5 text-emerald-600" />
              }
              <h2 className="font-semibold text-gray-900">
                {activeMode === 'base' ? 'Importer le catalogue' : 'Enrichir les données'}
              </h2>
            </div>
            <button onClick={() => setActiveMode(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <UploadExcel mode={activeMode} onUploadSuccess={onUploadSuccess} onCancel={() => setActiveMode(null)} />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Rechercher par SKU ou Modèle…"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <div className="relative">
            <button onClick={() => setShowColMenu(!showColMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
              <Settings2 className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Colonnes</span>
            </button>
            {showColMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-96 flex flex-col">
                  <div className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900 bg-gray-50">Colonnes affichées</div>
                  <div className="p-2 overflow-y-auto space-y-0.5">
                    {columns.map(col => (
                      <label key={col} className={`flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer ${col === 'sku' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input type="checkbox" checked={visibleCols.has(col)} onChange={() => toggleColumn(col)} disabled={col === 'sku'}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-3" />
                        <span className="text-sm text-gray-700 truncate">{col}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {activeColumns.map(col => (
                  <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={activeColumns.length || 5} className="px-6 py-12 text-center text-gray-400 text-sm">Chargement…</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={activeColumns.length || 5} className="px-6 py-12 text-center text-gray-400 text-sm">Aucun produit. Importez votre catalogue pour commencer.</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.sku} className="hover:bg-gray-50">
                    {activeColumns.map(col => (
                      <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[200px] truncate" title={String(p[col] || '')}>
                        {p[col] != null && p[col] !== '' ? String(p[col]) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span></p>
          <nav className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
