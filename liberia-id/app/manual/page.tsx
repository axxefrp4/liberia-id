'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { db } from '@/lib/db';
import { syncOfflineAttendance } from '@/lib/sync';

export default function ManualPage() {
  const [nationalId, setNationalId] = useState('');
  const [student, setStudent] = useState<{ name: string; id: string; school: string; grade: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    const checkOffline = async () => {
      const unsynced = await db.getUnsynced();
      setOfflineCount(unsynced.length);
    };
    checkOffline();
  }, []);

  const lookupStudent = async () => {
    if (!nationalId.trim()) {
      setError('Please enter a National ID');
      return;
    }
    setLoading(true);
    setError('');
    setStudent(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('national_id', nationalId.trim().toUpperCase())
        .single();

      if (fetchError || !data) {
        setError('❌ Student not found. Check the ID.');
        setLoading(false);
        return;
      }

      setStudent({
        name: `${data.first_name} ${data.last_name}`,
        id: data.national_id,
        school: data.current_school || 'Not set',
        grade: data.current_grade || 'Not set'
      });
      setMessage(`✅ Found: ${data.first_name} ${data.last_name}`);
    } catch (err: any) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
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
          national_id: student.id,
          status: status,
          school_name: 'Manual Entry',
          scanned_by: 'Teacher'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark attendance');
      }

      setMessage(`✅ ${status.toUpperCase()} recorded online for ${student.name}!`);
      setTimeout(() => { setStudent(null); setNationalId(''); setMessage(''); }, 2000);
    } catch (err: any) {
      if (err.message.includes('Failed to fetch') || !navigator.onLine) {
        try {
          await db.queueAttendance({
            national_id: student.id,
            student_name: student.name,
            status: status,
            school_name: 'Manual Entry',
            scanned_by: 'Teacher'
          });
          const unsynced = await db.getUnsynced();
          setOfflineCount(unsynced.length);
          setMessage(`📶 OFFLINE: Saved ${status.toUpperCase()} for ${student.name}. (${unsynced.length} offline)`);
          setTimeout(() => { setStudent(null); setNationalId(''); setMessage(''); }, 3000);
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
      setError('Cannot sync: offline.');
      return;
    }
    setLoading(true);
    setMessage('🔄 Syncing...');
    const result = await syncOfflineAttendance();
    const unsynced = await db.getUnsynced();
    setOfflineCount(unsynced.length);
    setMessage(`✅ Synced: ${result.synced} | Errors: ${result.errors}`);
    setLoading(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-blue-700">⌨️ Manual Entry</h1>
            <p className="text-sm text-gray-500 mt-1">Enter National ID to mark attendance</p>
            {offlineCount > 0 && (
              <div className="mt-2 inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                📶 {offlineCount} offline records
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="e.g., LBR-2026-0001"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              onKeyDown={(e) => { if (e.key === 'Enter') lookupStudent(); }}
            />
            <button
              onClick={lookupStudent}
              disabled={loading || !nationalId.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              🔍 Find
            </button>
            <button
              onClick={handleManualSync}
              disabled={loading || offlineCount === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              🔄 Sync
            </button>
          </div>

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

          {student && (
            <div className="mt-6 border-t pt-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="font-semibold text-lg">{student.name}</p>
                <p className="text-sm text-gray-600">ID: {student.id}</p>
                <p className="text-sm text-gray-600">School: {student.school}</p>
                <p className="text-sm text-gray-600">Grade: {student.grade}</p>
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

          {loading && (
            <div className="mt-4 text-center text-gray-500">
              <span className="inline-block animate-spin mr-2">⏳</span> Processing...
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          <a href="/" className="text-blue-600 hover:underline">🏠 Home</a> •{' '}
          <a href="/scanner" className="text-blue-600 hover:underline">📸 Scanner</a>
        </div>
      </div>
    </main>
  );
}
