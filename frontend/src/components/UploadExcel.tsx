import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, ListChecks, DatabaseZap } from 'lucide-react';

interface UploadExcelProps {
  onUploadSuccess: () => void;
}

export default function UploadExcel({ onUploadSuccess }: UploadExcelProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New advanced import states
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [insertHeaders, setInsertHeaders] = useState<Set<string>>(new Set());
  const [updateHeaders, setUpdateHeaders] = useState<Set<string>>(new Set());

  const handleFileUpload = useCallback(async (file: File) => {
    setIsParsing(true);
    setError(null);
    setSuccessMsg(null);
    setFileData(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (jsonData.length === 0) {
          throw new Error("Le fichier est vide.");
        }

        // Extract headers from the object keys, excluding __EMPTY
        const headersSet = new Set<string>();
        jsonData.forEach((row: any) => Object.keys(row).forEach(k => {
          if (!k.startsWith('__EMPTY')) headersSet.add(k);
        }));

        const headers = Array.from(headersSet);
        if (!headers.includes('sku') && !headers.includes('SKU')) {
          throw new Error("La colonne 'sku' est obligatoire dans le fichier Excel.");
        }

        setFileHeaders(headers);
        setInsertHeaders(new Set(headers)); // All checked by default for creation
        setUpdateHeaders(new Set(headers)); // All checked by default for update
        setFileData(jsonData);
      } catch (err) {
        setError((err as Error).message || 'Erreur inconnue lors du parsing');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

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
         throw new Error(err.error || 'Erreur lors de l\'importation');
      }

      const resData = await response.json();
      setSuccessMsg(`${resData.count} produits traités avec succès!`);
      setFileData(null); // Reset UI after success
      onUploadSuccess();
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleInsertHeader = (header: string) => {
    if (header.toLowerCase() === 'sku') return;
    const newSet = new Set(insertHeaders);
    if (newSet.has(header)) newSet.delete(header);
    else newSet.add(header);
    setInsertHeaders(newSet);
  };

  const toggleUpdateHeader = (header: string) => {
    if (header.toLowerCase() === 'sku') return;
    const newSet = new Set(updateHeaders);
    if (newSet.has(header)) newSet.delete(header);
    else newSet.add(header);
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

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  return (
    <div className="w-full">
      {!fileData && (
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
            <input type="file" className="hidden" accept=".xlsx, .csv" onChange={onChange} />
          </label>
        </div>
      )}

      {fileData && (
        <div className="bg-white border text-left border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Configuration de l'Import</h3>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              {fileData.length} lignes détectées
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Insert Select */}
            <div>
              <h4 className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                <ListChecks className="w-4 h-4 mr-2 text-primary-600" />
                Nouveaux SKU (Création)
              </h4>
              <p className="text-xs text-gray-500 mb-3">Sélectionnez les colonnes à injecter lorsqu'un SKU n'existe pas encore en base.</p>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
                {fileHeaders.map(header => {
                  const isSku = header.toLowerCase() === 'sku';
                  return (
                    <label key={`ins_${header}`} className={`flex items-center space-x-3 text-sm ${isSku ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 p-1 rounded'}`}>
                      <input
                        type="checkbox"
                        checked={insertHeaders.has(header)}
                        onChange={() => toggleInsertHeader(header)}
                        disabled={isSku}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-gray-700 font-medium truncate" title={header}>
                        {header} {isSku && '(Obligatoire)'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Update Select */}
            <div>
              <h4 className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                <DatabaseZap className="w-4 h-4 mr-2 text-primary-600" />
                SKU Existants (Mise à jour)
              </h4>
              <p className="text-xs text-gray-500 mb-3">Sélectionnez UNIQUEMENT les colonnes dont la valeur doit être remplacée si le produit existe déjà.</p>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
                {fileHeaders.map(header => {
                  const isSku = header.toLowerCase() === 'sku';
                  return (
                    <label key={`upd_${header}`} className={`flex items-center space-x-3 text-sm ${isSku ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 p-1 rounded'}`}>
                      <input
                        type="checkbox"
                        checked={updateHeaders.has(header)}
                        onChange={() => toggleUpdateHeader(header)}
                        disabled={isSku}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-gray-700 font-medium truncate" title={header}>
                        {header} {isSku && '(Obligatoire)'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3 border-t border-gray-100 pt-5">
            <button
              onClick={() => setFileData(null)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              Annuler
            </button>
            <button
              onClick={confirmUpload}
              disabled={isUploading}
              className="flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 focus:outline-none disabled:opacity-50"
            >
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isUploading ? 'Importation...' : 'Lancer l\'importation'}
            </button>
          </div>
        </div>
      )}

      {isParsing && !fileData && (
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
  )
}
