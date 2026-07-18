'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';

export default function Home() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    guardian_phone: '',
    school: '',
    grade: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ national_id: string; qrData: string } | null>(null);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setResult({
        national_id: data.student.national_id,
        qrData: data.student.national_id // QR codes work with just the ID
      });
      
      // Clear form
      setForm({ first_name: '', last_name: '', dob: '', guardian_phone: '', school: '', grade: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-green-700">🇱🇷 Liberia Student ID</h1>
            <p className="text-gray-600 mt-2">Register a new student</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center">
              <p className="text-green-700 font-semibold">✅ Student Registered!</p>
              <p className="text-sm text-gray-600 mt-1">National ID: <strong>{result.national_id}</strong></p>
              <div className="flex justify-center mt-3">
                <QRCode value={result.qrData} size={120} />
              </div>
              <p className="text-xs text-gray-500 mt-2">Scan this QR to take attendance</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  required
                  value={form.first_name}
                  onChange={handleChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  required
                  value={form.last_name}
                  onChange={handleChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={form.dob}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Guardian Phone</label>
              <input
                type="tel"
                name="guardian_phone"
                placeholder="e.g., 0777-123-456"
                value={form.guardian_phone}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">School Name</label>
              <input
                type="text"
                name="school"
                placeholder="e.g., Monrovia Central High"
                value={form.school}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Grade</label>
              <input
                type="text"
                name="grade"
                placeholder="e.g., Grade 6 or Form 1"
                value={form.grade}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : '🎓 Register Student'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          Student ID persists across schools • Built for Liberia
        </div>
      </div>
    </main>
  );
}
