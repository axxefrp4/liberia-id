'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '@/lib/db';
import { syncOfflineAttendance } from '@/lib/sync';

interface Student {
  id: string;
  national_id: string;
  first_name: string;
  last_name: string;
  current_school: string | null;
  current_grade: string | null;
}

export default function ScannerPage() {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [offlineCount, setOfflineCount] = useState(0);
  const readerRef = useRef<HTMLDivElement>(null);

  // Check for unsynced records on mount
  useEffect(() => {
    const checkOffline = async () => {
      const unsynced = await db.getUnsynced();
      setOfflineCount(unsynced.length);
      if (unsynced.length > 0 && navigator.onLine) {
        setMessage(`📶 Syncing ${unsynced.length} offline records...`);
        const result = await syncOfflineAttendance();
        setOfflineCount(0);
        setMessage(`✅ Synced ${result.synced} records${result.errors > 0 ? `, ${result.errors} errors` : ''}`);
        setTimeout(() => setMessage(''), 3000);
      }
    };
    checkOffline();
  }, []);

  // Initialize scanner on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && readerRef.current) {
      const html5Scanner = new Html5Qrcode('reader');
      setScanner(html5Scanner);
    }
    return () => {
      if (scanner) {
        scanner.stop().catch(() => {});
        scanner.clear();
      }
    };
  }, []);

  const startScan = async () => {
    if (!scanner) return;
    setError('');
    setMessage('');
    setStudent(null);

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanError
      );
      setScanning(true);
      setMessage('📷 Camera active. Hold a QR code in front.');
    } catch (err: any) {
      setError('Cannot access camera: ' + (err.message || 'Unknown error'));
    }
  };

  const stopScan = async () => {
    if (scanner && scanning) {
      await scanner.stop();
      setScanning(false);
      setMessage('');
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScan();
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('national_id', decodedText)
        .single();

      if (fetchError || !data) {
        setError('❌ Student not found. Check the ID card.');
        setLoading(false);
        return;
      }

      setStudent(data);
      setMessage(`✅ Found: ${data.first_name} ${data.last_name}`);
    } catch (err: any) {
      setError('Error fetching student: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const onScanError = (err: any) => {
    // Ignore continuous errors
  };

  const markAttendance = async (status: 'present' | 'absent' | 'late') => {
    if (!student) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          national_id: student.national_id,
          status: status,
          school_name: student.current_school || 'Unknown',
          scanned_by: 'Teacher'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark attendance');
      }

      setMessage(`✅ ${status.toUpperCase()} recorded online for ${student.first_name} ${student.last_name}!`);
      setTimeout(() => { setStudent(null); setMessage(''); startScan(); }, 2000);
    } catch (err: any) {
      // OFFLINE FALLBACK: Save to IndexedDB
      if (err.message.includes('Failed to fetch') || !navigator.onLine) {
        try {
          await db.queueAttendance({
            national_id: student.national_id,
            student_name: `${student.first_name} ${student.last_name}`,
            status: status,
            school_name: student.current_school || 'Unknown',
            scanned_by: 'Teacher',
            timestamp: 0
          });
          const unsynced = await db.getUnsynced();
          setOfflineCount(unsynced.length);
          setMessage(`📶 OFFLINE: Saved ${status.toUpperCase()} for ${student.first_name}. Will sync when online. (${unsynced.length} offline)`);
          setTimeout(() => { setStudent(null); setMessage(''); startScan(); }, 3000);
        } catch (offlineErr) {
          setError('Failed to save offline: ' + offlineErr);
          setLoading(false);
        }
      } else {
        setError('Error: ' + err.message);
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      setError('Cannot sync: you are offline. Connect to internet and try again.');
      return;
    }
    setLoading(true);
    setMessage('🔄 Syncing offline records...');
    const result = await syncOfflineAttendance();
    const unsynced = await db.getUnsynced();
    setOfflineCount(unsynced.length);
    if (result.synced > 0 || result.errors > 0) {
      setMessage(`✅ Synced: ${result.synced} | Errors: ${result.errors}`);
    } else {
      setMessage('✅ All records synced');
    }
    setLoading(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-green-700">📸 Attendance Scanner</h1>
            <p className="text-sm text-gray-500 mt-1">Scan student QR to mark attendance</p>
            {offlineCount > 0 && (
              <div className="mt-2 inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                📶 {offlineCount} offline records waiting to sync
              </div>
            )}
          </div>

          {/* Camera feed */}
          <div 
            id="reader" 
            ref={readerRef}
            className="w-full bg-black rounded-lg overflow-hidden"
            style={{ minHeight: '250px' }}
          />

          {/* Controls */}
          <div className="mt-4 flex gap-3 flex-wrap">
            {!scanning ? (
              <button
                onClick={startScan}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
              >
                📷 Start Camera
              </button>
            ) : (
              <button
                onClick={stopScan}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
              >
                ⏹ Stop
              </button>
            )}
            <button
              onClick={handleManualSync}
              disabled={loading || offlineCount === 0}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              🔄 Sync
            </button>
          </div>

          {/* Status messages */}
          {message && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Student found */}
          {student && (
            <div className="mt-6 border-t pt-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="font-semibold text-lg">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-sm text-gray-600">ID: {student.national_id}</p>
                <p className="text-sm text-gray-600">School: {student.current_school || 'Not set'}</p>
                <p className="text-sm text-gray-600">Grade: {student.current_grade || 'Not set'}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => markAttendance('present')}
                  disabled={loading}
                  className="bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition disabled:opacity-50"
                >
                  ✅ Present
                </button>
                <button
                  onClick={() => markAttendance('late')}
                  disabled={loading}
                  className="bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  ⏰ Late
                </button>
                <button
                  onClick={() => markAttendance('absent')}
                  disabled={loading}
                  className="bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition disabled:opacity-50"
                >
                  ❌ Absent
                </button>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="mt-4 text-center text-gray-500">
              <span className="inline-block animate-spin mr-2">⏳</span> Processing...
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          Offline-capable • Liberia Student ID System
        </div>
      </div>
    </main>
  );
}
