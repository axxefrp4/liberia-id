'use client';

import { useState } from 'react';

export default function BulkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ total: number; registered: number; errors: number } | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    setError('');
    setResult(null);

    // Preview the CSV content
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((h, i) => {
            obj[h] = values[i] || '';
          });
          return obj;
        });

        setPreview(data.slice(0, 5)); // Show first 5 rows as preview
        setMessage(`📄 Loaded ${data.length} students. Preview shows first 5.`);
      } catch (err) {
        setError('Error parsing CSV. Make sure it has headers: first_name,last_name,dob,guardian_phone,school,grade');
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const reader = new FileReader();
      const text = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least one student.');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const required = ['first_name', 'last_name'];
      const missing = required.filter(r => !headers.includes(r));
      if (missing.length > 0) {
        throw new Error(`Missing required columns: ${missing.join(', ')}`);
      }

      const students = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || '';
        });
        return obj;
      });

      const response = await fetch('/api/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bulk registration failed');
      }

      setResult({
        total: data.total,
        registered: data.registered,
        errors: data.errors
      });

      setMessage(`✅ Registered ${data.registered} of ${data.total} students successfully.`);
      if (data.errors > 0) {
        setError(`⚠️ ${data.errors} students had errors. Check the console for details.`);
        console.error('Bulk registration errors:', data.errorDetails);
      }
    } catch (err: any) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'first_name,last_name,dob,guardian_phone,school,grade\n';
    const sample = 'John,Doe,2010-05-15,0777-123-456,Monrovia High,Grade 6\n';
    const sample2 = 'Jane,Smith,2011-08-20,0777-789-123,Monrovia High,Grade 5\n';
    const content = headers + sample + sample2;
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-purple-700">📊 Bulk Import</h1>
            <p className="text-sm text-gray-500 mt-1">Upload a CSV to register multiple students at once</p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            <p className="text-xs text-gray-400 mt-2">CSV format: first_name,last_name,dob,guardian_phone,school,grade</p>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={downloadTemplate}
              className="bg-gray-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-gray-700 transition"
            >
              📄 Download Template
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="flex-1 bg-purple-600 text-white py-2 rounded-md font-semibold hover:bg-purple-700 transition disabled:opacity-50"
            >
              {loading ? '⏳ Uploading...' : '🚀 Upload & Register'}
            </button>
          </div>

          {message && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-wrap">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-semibold text-green-700">✅ Import Complete</p>
              <p className="text-sm text-gray-600">Total: {result.total}</p>
              <p className="text-sm text-green-600">Registered: {result.registered}</p>
              {result.errors > 0 && (
                <p className="text-sm text-red-600">Errors: {result.errors}</p>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h2 className="font-semibold text-gray-700 mb-2">📋 Preview (first 5 rows)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(preview[0] || {}).map((key) => (
                        <th key={key} className="border px-2 py-1 text-left text-gray-600 capitalize">
                          {key.replace('_', ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="border px-2 py-1 text-gray-700">
                            {val || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          <a href="/" className="text-blue-600 hover:underline">🏠 Home</a> •{' '}
          <a href="/scanner" className="text-blue-600 hover:underline">📸 Scanner</a> •{' '}
          <a href="/manual" className="text-blue-600 hover:underline">⌨️ Manual</a>
        </div>
      </div>
    </main>
  );
}
