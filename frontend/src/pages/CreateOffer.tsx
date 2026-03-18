import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Download, Save, Search, Settings, FolderOpen } from 'lucide-react';

interface Product {
  sku: string;
  modele: string;
  categorie: string;
  [key: string]: any;
}

interface Template {
  id: number;
  partner_name: string;
  mapping_json: Record<string, string>;
}

export default function CreateOffer() {
  const [partnerHeaders, setPartnerHeaders] = useState<string[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // { partnerHeader: catalogField }
  const [partnerName, setPartnerName] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [catalogFields, setCatalogFields] = useState<string[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [templates, setTemplates] = useState<Template[]>([]);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
  const authHeader = { Authorization: `Bearer ${localStorage.getItem('gyl_auth_token')}` };

  // Fetch products for selection
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/products?limit=500&search=${search}`, {
        headers: authHeader
      });
      const data = await res.json();
      setProducts(data.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [search]);

  const fetchCatalogFields = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/catalog/columns`, { headers: authHeader });
      const data = await res.json();
      setCatalogFields(data.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/templates`, { headers: authHeader });
      const data = await res.json();
      setTemplates(data.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCatalogFields();
    fetchTemplates();
  }, [fetchProducts, fetchCatalogFields, fetchTemplates]);

  // Auto-map once both parsedHeaders and catalogFields are available
  useEffect(() => {
    if (parsedHeaders.length === 0 || catalogFields.length === 0) return;
    const newMapping: Record<string, string> = {};
    parsedHeaders.forEach((header) => {
      const match = catalogFields.find(f => f.toLowerCase() === header.toString().toLowerCase());
      if (match) newMapping[header] = match;
    });
    setMapping(newMapping);
  }, [parsedHeaders, catalogFields]);

  const handlePartnerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (json.length > 0) {
        const headers = json[0] as string[];
        setPartnerHeaders(headers);
        setParsedHeaders(headers);
        setMapping({}); // Reset mapping, auto-map effect will trigger
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadTemplate = (templateId: string) => {
    if (!templateId) return;
    const template = templates.find(t => t.id === Number(templateId));
    if (!template) return;
    const headers = Object.keys(template.mapping_json);
    setPartnerName(template.partner_name);
    setPartnerHeaders(headers);
    setParsedHeaders([]);
    setMapping(template.mapping_json);
  };

  const saveTemplate = async () => {
    if (!partnerName) {
      alert("Veuillez saisir un nom pour le partenaire.");
      return;
    }
    try {
      await fetch(`${apiUrl}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ partner_name: partnerName, mapping_json: mapping })
      });
      alert('Modèle sauvegardé !');
      fetchTemplates();
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la sauvegarde du modèle');
    }
  };

  const handleExport = () => {
    if (selectedSkus.size === 0) {
      alert('Sélectionnez au moins un produit.');
      return;
    }
    if (partnerHeaders.length === 0) {
      alert('Uploadez d\'abord le fichier partenaire ou chargez un modèle pour définir les colonnes.');
      return;
    }

    const selectedProducts = products.filter(p => selectedSkus.has(p.sku));

    const exportData = selectedProducts.map(product => {
      const row: any = {};
      partnerHeaders.forEach(header => {
        const catalogField = mapping[header];
        row[header] = catalogField ? (product[catalogField] || '') : '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData, { header: partnerHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    XLSX.writeFile(workbook, `Matrice_${partnerName || 'Partenaire'}.xlsx`);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSkus(new Set(products.map(p => p.sku)));
    } else {
      setSelectedSkus(new Set());
    }
  };

  const toggleSelect = (sku: string) => {
    const newSet = new Set(selectedSkus);
    if (newSet.has(sku)) newSet.delete(sku);
    else newSet.add(sku);
    setSelectedSkus(newSet);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <FileSpreadsheet className="w-6 h-6 mr-3 text-primary-600" />
          Générateur de Matrice
        </h1>
        <button
          onClick={handleExport}
          className="flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 focus:outline-none"
        >
          <Download className="w-4 h-4 mr-2" />
          Générer l'offre
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Mapping Section */}
        <div className="col-span-1 border border-gray-200 bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-500" />
              Mapping Partenaire
            </h2>
          </div>
          <div className="p-4 space-y-4">

            {/* Load template */}
            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <FolderOpen className="w-4 h-4 mr-1 text-gray-400" />
                  Charger un modèle existant
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => loadTemplate(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md border"
                >
                  <option value="">-- Sélectionner un modèle --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.partner_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload matrice partenaire (vide)</label>
              <input type="file" accept=".xlsx, .csv" onChange={handlePartnerUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
            </div>

            {partnerHeaders.length > 0 && (
              <>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {partnerHeaders.map(header => (
                    <div key={header} className="flex flex-col">
                      <label className="text-xs font-medium text-gray-700 truncate" title={header}>{header}</label>
                      <select
                        value={mapping[header] || ''}
                        onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                        className="mt-1 block w-full pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md border"
                      >
                        <option value="">-- Ignorer --</option>
                        {catalogFields.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <input
                    type="text"
                    placeholder="Nom du partenaire"
                    className="mb-2 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                  />
                  <button onClick={saveTemplate} className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder le modèle
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Product Selection Section */}
        <div className="col-span-1 lg:col-span-2 border border-gray-200 bg-white rounded-lg shadow-sm flex flex-col h-fit max-h-[700px]">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Sélection des produits</h2>
            <div className="relative w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher (SKU, Modèle)..."
                className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input type="checkbox" onChange={toggleSelectAll} checked={selectedSkus.size > 0 && selectedSkus.size === products.length} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modèle</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500 text-sm">Aucun produit...</td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.sku} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <input type="checkbox" checked={selectedSkus.has(p.sku)} onChange={() => toggleSelect(p.sku)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{p.sku}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{p.modele}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{p.categorie}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600 font-medium flex justify-between items-center">
            <span>{selectedSkus.size} produit(s) sélectionné(s)</span>
            <span className="text-xs text-gray-400 font-normal">{products.length} affiché(s) — utilisez la recherche pour affiner</span>
          </div>
        </div>

      </div>
    </div>
  )
}
