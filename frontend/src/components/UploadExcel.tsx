import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, ListChecks, DatabaseZap, Layers, Key } from 'lucide-react';

interface UploadExcelProps {
  onUploadSuccess: () => void;
}

type Step = 'drop' | 'sheet' | 'sku' | 'columns';

export default function UploadExcel({ onUploadSuccess }: UploadExcelProps) {
  const [step, setStep] = useState<Step>('drop');
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

  const [rawData, setRawData] = useState<any[] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [skuColumn, setSkuColumn] = useState<string | null>(null);

  const [fileData, setFileData] = useState<any[] | null>(null);
  const [insertHeaders, setInsertHeaders] = useState<Set<string>>(new Set());
  const [updateHeaders, setUpdateHeaders] = useState<Set<string>>(new Set());

  const reset = () => {
    setStep('drop');
    setError(null);
    setSuccessMsg(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet(null);
    setRawData(null);
    setFileHeaders([]);
    setSkuColumn(null);
    setFileData(null);
    setInsertHeaders(new Set());
    setUpdateHeaders(new Set());
  };

  const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const worksheet = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    if (jsonData.length === 0) throw new Error("La feuille sélectionnée est vide.");

    const headersSet = new Set<string>();
    jsonData.forEach((row: any) => Object.keys(row).forEach(k => {
      if (!k.startsWith('__EMPTY')) headersSet.add(k);
    }));

    const headers = Array.from(headersSet);
    setRawData(jsonData);
    setFileHeaders(headers);

    // Auto-detect SKU column
    const autoSku = headers.find(h => h.toLowerCase() === 'sku') || null;
    setSkuColumn(autoSku);
  };

  const handleFileUpload = useCallback(async (file: File) => {
    setIsParsing(true);
    setError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);

        if (wb.SheetNames.length === 1) {
          parseSheet(wb, wb.SheetNames[0]);
          setSelectedSheet(wb.SheetNames[0]);
          setStep('sku');
        } else {
          setStep('sheet');
        }
      } catch (err) {
        setError((err as Error).message || 'Erreur inconnue lors du parsing');
        setStep('drop');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleSheetSelect = (sheetName: string) => {
    if (!workbook) return;
    setError(null);
    try {
      setSelectedSheet(sheetName);
      parseSheet(workbook, sheetName);
      setStep('sku');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSkuConfirm = () => {
    if (!skuColumn || !rawData) return;

    // Remap selected column to "sku"
    const remapped = rawData.map((row: any) => {
      if (skuColumn === 'sku') return row;
      const { [skuColumn]: skuVal, ...rest } = row;
      return { sku: skuVal, ...rest };
    });

    const headers = fileHeaders.map(h => h === skuColumn ? 'sku' : h);
    setFileData(remapped);
    setInsertHeaders(new Set(headers));
    setUpdateHeaders(new Set(headers));
    setFileHeaders(headers);
    setStep('columns');
  };

  const confirmUpload = async () => {
    if (!fileData) return;
    setIsUploading(true);
    setError(null);

    try {
      const payload = {
        products: fileData,
        insertCols: Array.from(insertHeaders),
        updateCols: Array.from(updateHeaders)
      };

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const response = await fetch(`${apiUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gyl_auth_token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erreur lors de l'importation");
      }

      const resData = await response.json();
      setSuccessMsg(`${resData.count} produits traités avec succès!`);
      reset();
      onUploadSuccess();
    } catch (err) {
      setError((err as Error).message || "Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleInsertHeader = (header: string) => {
    if (header === 'sku') return;
    const newSet = new Set(insertHeaders);
    if (newSet.has(header)) newSet.delete(header); else newSet.add(header);
    setInsertHeaders(newSet);
  };

  const toggleUpdateHeader = (header: string) => {
    if (header === 'sku') return;
    const newSet = new Set(updateHeaders);
    if (newSet.has(header)) newSet.delete(header); else newSet.add(header);
    setUpdateHeaders(newSet);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.csv'))) {
      handleFileUpload(file);
    } else {
      setError('Veuillez uploader un fichier .xlsx ou .csv');
    }
  };

  return (
    <div className="w-full">
      {/* Step 1: Drop zone */}
      {step === 'drop' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center bg-white hover:bg-gray-50 transition-colors"
        >
          <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Upload le catalogue</h3>
          <p className="text-sm text-gray-500 mb-4">Glissez-déposez le fichier Excel pour commencer la configuration</p>
          <label className="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
            Choisir un fichier
            <input type="file" className="hidden" accept=".xlsx, .csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
          </label>
        </div>
      )}

      {/* Step 2: Sheet selection */}
      {step === 'sheet' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Choisir une feuille</h3>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded ml-auto">
              {sheetNames.length} feuilles détectées
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sheetNames.map(name => (
              <button
                key={name}
                onClick={() => handleSheetSelect(name)}
                className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
              >
                <Layers className="w-4 h-4 shrink-0 text-gray-400" />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
          <button onClick={reset} className="mt-4 text-sm text-gray-400 hover:text-gray-600">← Changer de fichier</button>
        </div>
      )}

      {/* Step 3: SKU column selection */}
      {step === 'sku' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-medium text-gray-900">Quelle colonne est le SKU ?</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Le SKU est l'identifiant unique de chaque produit.</p>
          {selectedSheet && (
            <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Feuille : <span className="font-medium">{selectedSheet}</span>
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {fileHeaders.map(header => (
              <button
                key={header}
                onClick={() => setSkuColumn(header)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-colors truncate ${
                  skuColumn === header
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                {header}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-between items-center border-t border-gray-100 pt-4">
            <button onClick={() => sheetNames.length > 1 ? setStep('sheet') : reset()} className="text-sm text-gray-400 hover:text-gray-600">
              ← Retour
            </button>
            <button
              onClick={handleSkuConfirm}
              disabled={!skuColumn}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmer — <span className="font-bold">{skuColumn || '...'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Column config */}
      {step === 'columns' && fileData && (
        <div className="bg-white border text-left border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Configuration de l'Import</h3>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                {selectedSheet && <><Layers className="w-3 h-3" /> {selectedSheet} ·</>}
                <Key className="w-3 h-3 text-amber-500" /> SKU : <span className="font-medium">{skuColumn}</span>
              </p>
            </div>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              {fileData.length} lignes détectées
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                <ListChecks className="w-4 h-4 mr-2 text-primary-600" />
                Nouveaux SKU (Création)
              </h4>
              <p className="text-xs text-gray-500 mb-3">Colonnes à injecter quand le SKU n'existe pas encore.</p>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
                {fileHeaders.map(header => {
                  const isSku = header === 'sku';
                  return (
                    <label key={`ins_${header}`} className={`flex items-center space-x-3 text-sm ${isSku ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 p-1 rounded'}`}>
                      <input type="checkbox" checked={insertHeaders.has(header)} onChange={() => toggleInsertHeader(header)} disabled={isSku} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                      <span className="text-gray-700 font-medium truncate">{header} {isSku && '(SKU)'}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                <DatabaseZap className="w-4 h-4 mr-2 text-primary-600" />
                SKU Existants (Mise à jour)
              </h4>
              <p className="text-xs text-gray-500 mb-3">Colonnes à écraser si le produit existe déjà.</p>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
                {fileHeaders.map(header => {
                  const isSku = header === 'sku';
                  return (
                    <label key={`upd_${header}`} className={`flex items-center space-x-3 text-sm ${isSku ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 p-1 rounded'}`}>
                      <input type="checkbox" checked={updateHeaders.has(header)} onChange={() => toggleUpdateHeader(header)} disabled={isSku} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                      <span className="text-gray-700 font-medium truncate">{header} {isSku && '(SKU)'}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3 border-t border-gray-100 pt-5">
            <button onClick={() => setStep('sku')} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
              ← Retour
            </button>
            <button onClick={confirmUpload} disabled={isUploading} className="flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isUploading ? 'Importation...' : "Lancer l'importation"}
            </button>
          </div>
        </div>
      )}

      {isParsing && (
        <div className="mt-4 flex items-center text-blue-600 bg-blue-50 p-4 rounded-md">
          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
          <span className="text-sm font-medium">Lecture du fichier Excel...</span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center text-red-600 bg-red-50 p-4 rounded-md">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 flex items-center text-green-600 bg-green-50 p-4 rounded-md">
          <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}
    </div>
  );
}
