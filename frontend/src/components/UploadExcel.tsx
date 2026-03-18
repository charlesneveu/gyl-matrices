import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, Layers, Key, GitMerge, Database } from 'lucide-react';

export type UploadMode = 'base' | 'enrich';

interface UploadExcelProps {
  mode: UploadMode;
  onUploadSuccess: () => void;
  onCancel: () => void;
}

type Step = 'drop' | 'sheet' | 'sku' | 'columns';

export default function UploadExcel({ mode, onUploadSuccess, onCancel }: UploadExcelProps) {
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
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());

  const resetToStep = (target: Step) => {
    setError(null);
    if (target === 'drop') {
      setWorkbook(null); setSheetNames([]); setSelectedSheet(null);
      setRawData(null); setFileHeaders([]); setSkuColumn(null);
      setFileData(null); setSelectedCols(new Set());
    }
    if (target === 'sheet') {
      setSelectedSheet(null); setRawData(null); setFileHeaders([]);
      setSkuColumn(null); setFileData(null); setSelectedCols(new Set());
    }
    if (target === 'sku') {
      setSkuColumn(null); setFileData(null); setSelectedCols(new Set());
    }
    setStep(target);
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
    const autoSku = headers.find(h => h.toLowerCase() === 'sku') || null;
    setSkuColumn(autoSku);
  };

  const handleFileUpload = useCallback(async (file: File) => {
    setIsParsing(true);
    setError(null);
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
        setError((err as Error).message || 'Erreur lors du parsing');
        setStep('drop');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleSheetSelect = (sheetName: string) => {
    if (!workbook) return;
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
    const remapped = rawData.map((row: any) => {
      if (skuColumn === 'sku') return row;
      const { [skuColumn]: skuVal, ...rest } = row;
      return { sku: skuVal, ...rest };
    });
    const headers = fileHeaders.map(h => h === skuColumn ? 'sku' : h);
    setFileData(remapped);
    // Mode base: tout coché. Mode enrich: rien coché par défaut (utilisateur choisit)
    setSelectedCols(mode === 'base' ? new Set(headers) : new Set());
    setFileHeaders(headers);
    setStep('columns');
  };

  const confirmUpload = async () => {
    if (!fileData) return;
    setIsUploading(true);
    setError(null);
    try {
      const cols = Array.from(selectedCols);
      const payload = mode === 'base'
        ? { products: fileData, insertCols: cols, updateCols: cols }
        : { products: fileData, insertCols: [], updateCols: cols }; // enrich = update only

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
      setSuccessMsg(`${resData.count} produits traités avec succès !`);
      onUploadSuccess();
    } catch (err) {
      setError((err as Error).message || "Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleCol = (header: string) => {
    if (header === 'sku') return;
    const newSet = new Set(selectedCols);
    if (newSet.has(header)) newSet.delete(header); else newSet.add(header);
    setSelectedCols(newSet);
  };

  return (
    <div className="w-full space-y-4">

      {/* Step 1: Drop */}
      {step === 'drop' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center bg-white hover:bg-gray-50 transition-colors"
        >
          <UploadCloud className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 mb-4">Glissez-déposez ou choisissez un fichier .xlsx</p>
          <label className="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
            Choisir un fichier
            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
          </label>
        </div>
      )}

      {/* Step 2: Sheet selection */}
      {step === 'sheet' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-500" />
            <h3 className="font-medium text-gray-900">Choisir une feuille</h3>
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded">{sheetNames.length} feuilles</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {sheetNames.map(name => (
              <button key={name} onClick={() => handleSheetSelect(name)}
                className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
                <Layers className="w-4 h-4 shrink-0 text-gray-400" />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
          <button onClick={() => resetToStep('drop')} className="mt-3 text-sm text-gray-400 hover:text-gray-600">← Changer de fichier</button>
        </div>
      )}

      {/* Step 3: SKU picker */}
      {step === 'sku' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-5 h-5 text-amber-500" />
            <h3 className="font-medium text-gray-900">Quelle colonne est l'identifiant unique (SKU) ?</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">Sert à faire correspondre les lignes de ton fichier avec les produits en base.</p>
          {selectedSheet && <p className="text-xs text-gray-400 mb-3 flex items-center gap-1"><Layers className="w-3 h-3" />{selectedSheet}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {fileHeaders.map(h => (
              <button key={h} onClick={() => setSkuColumn(h)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium text-left truncate transition-colors ${skuColumn === h ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50'}`}>
                {h}
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-between items-center border-t border-gray-100 pt-4">
            <button onClick={() => sheetNames.length > 1 ? resetToStep('sheet') : resetToStep('drop')} className="text-sm text-gray-400 hover:text-gray-600">← Retour</button>
            <button onClick={handleSkuConfirm} disabled={!skuColumn}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40">
              Confirmer — <span className="font-bold">{skuColumn || '...'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Column selection */}
      {step === 'columns' && fileData && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h3 className="font-medium text-gray-900">
                {mode === 'base' ? 'Colonnes à importer' : 'Colonnes à fusionner'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {mode === 'base'
                  ? 'Toutes les colonnes sont sélectionnées. Décoche celles à ignorer.'
                  : 'Coche uniquement les colonnes à écrire sur les produits existants.'}
              </p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                {selectedSheet && <><Layers className="w-3 h-3" />{selectedSheet} ·</>}
                <Key className="w-3 h-3 text-amber-500" />SKU : <span className="font-medium">{skuColumn}</span>
              </p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded shrink-0">{fileData.length} lignes</span>
          </div>

          {mode === 'enrich' && (
            <div className="mb-4 flex gap-2">
              <button onClick={() => setSelectedCols(new Set(fileHeaders.filter(h => h !== 'sku')))}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50">Tout sélectionner</button>
              <button onClick={() => setSelectedCols(new Set())}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50">Tout déselectionner</button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50">
            {fileHeaders.map(header => {
              const isSku = header === 'sku';
              return (
                <label key={header} className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${isSku ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white'}`}>
                  <input type="checkbox" checked={selectedCols.has(header) || isSku} onChange={() => toggleCol(header)} disabled={isSku}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <span className="truncate text-gray-700">{header}{isSku && ' (SKU)'}</span>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex justify-between items-center border-t border-gray-100 pt-4">
            <button onClick={() => resetToStep('sku')} className="text-sm text-gray-400 hover:text-gray-600">← Retour</button>
            <div className="flex gap-2">
              <button onClick={onCancel} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={confirmUpload} disabled={isUploading || selectedCols.size === 0}
                className="flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40">
                {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'base' ? 'Importer' : 'Fusionner'} {!isUploading && selectedCols.size > 0 && `(${selectedCols.size} col.)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {isParsing && (
        <div className="flex items-center text-blue-600 bg-blue-50 p-4 rounded-md">
          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
          <span className="text-sm font-medium">Lecture du fichier...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md">
          <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center text-green-600 bg-green-50 p-4 rounded-md">
          <CheckCircle className="w-5 h-5 mr-3 shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}
    </div>
  );
}
