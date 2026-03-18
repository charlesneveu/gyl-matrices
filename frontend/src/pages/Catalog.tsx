import React, { useEffect, useState } from 'react'
import UploadExcel from '../components/UploadExcel'
import { Search, Package, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'

// Assuming catalog has standard fields based on user request.
interface Product {
  sku: string;
  [key: string]: any;
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [columns, setColumns] = useState<string[]>(['sku', 'modele', 'categorie', 'size', 'couleur']);
  
  const DEFAULT_VISIBLE = ['sku', 'modele', 'categorie', 'size', 'couleur'];
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('catalogVisibleCols');
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch (e) {}
    }
    return new Set(DEFAULT_VISIBLE);
  });
  const [showColMenu, setShowColMenu] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/products?page=${page}&limit=50&search=${search}`);
      const data = await res.json();
      setProducts(data.data || []);
      setTotal(data.meta?.total || 0);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  const fetchColumns = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/catalog/columns`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        // Bring 'sku' to the front if it exists
        const cols: string[] = data.data;
          const filtered = cols.filter(c => c.toLowerCase() !== 'sku');
          const finalColumns = ['sku', ...filtered];
          setColumns(finalColumns);
          
          // Ensure sku is always in visible fields
          setVisibleCols(prev => {
            const newSet = new Set(prev);
            newSet.add('sku');
            return newSet;
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  
    useEffect(() => {
      fetchColumns();
    }, []);
  
    useEffect(() => {
      fetchProducts();
    }, [page, search]);

    useEffect(() => {
      localStorage.setItem('catalogVisibleCols', JSON.stringify(Array.from(visibleCols)));
    }, [visibleCols]);
  
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1); // Reset to first page
    };

    const toggleColumn = (col: string) => {
      if (col === 'sku') return;
      const newSet = new Set(visibleCols);
      if (newSet.has(col)) newSet.delete(col);
      else newSet.add(col);
      setVisibleCols(newSet);
    };

    const activeColumns = columns.filter(col => visibleCols.has(col));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Package className="w-6 h-6 mr-3 text-primary-600" />
          Catalogue Central
        </h1>
      </div>

      {/* Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Mise à jour du catalogue</h2>
        <UploadExcel onUploadSuccess={() => { fetchProducts(); fetchColumns(); }} />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Rechercher par SKU ou Modèle..."
              value={search}
              onChange={handleSearch}
            />
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              {total} produits au total
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowColMenu(!showColMenu)}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                <Settings2 className="w-4 h-4 text-gray-500" />
                <span className="hidden sm:inline">Affichage</span>
              </button>

              {showColMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColMenu(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-xl border border-gray-200 z-20 max-h-96 flex flex-col">
                    <div className="p-3 border-b border-gray-100 font-medium text-sm text-gray-900 bg-gray-50 flex-shrink-0">
                      Colonnes affichées
                    </div>
                    <div className="p-2 overflow-y-auto space-y-1">
                      {columns.map(col => {
                        const isSku = col === 'sku';
                        return (
                          <label key={col} className={`flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors ${isSku ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
                            <input
                              type="checkbox"
                              checked={visibleCols.has(col)}
                              onChange={() => toggleColumn(col)}
                              disabled={isSku}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mr-3"
                            />
                            <span className="text-sm text-gray-700 truncate" title={col}>{col}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {activeColumns.map(col => (
                  <th key={col} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={activeColumns.length || 5} className="px-6 py-10 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length || 5} className="px-6 py-10 text-center text-gray-500">
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.sku} className="hover:bg-gray-50">
                    {activeColumns.map(col => (
                      <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[200px] truncate" title={String(p[col] || '')}>
                        {p[col] !== null && p[col] !== undefined ? String(p[col]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{page}</span> sur <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Précédent</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Suivant</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
