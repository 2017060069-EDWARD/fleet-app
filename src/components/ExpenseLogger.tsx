'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface ExpenseLoggerProps {
  tripId: string
  onSuccess?: () => void
}

export default function ExpenseLogger({ tripId, onSuccess }: ExpenseLoggerProps) {
  const [expenseType, setExpenseType] = useState<string>('Fuel')
  const [amount, setAmount] = useState<string>('')
  const [currency, setCurrency] = useState<string>('ZAR')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 1. Upload receipt/image to Cloudflare R2 via Presigned URL
  const uploadImageToR2 = async (selectedFile: File): Promise<string> => {
    const contentType = selectedFile.type || 'image/jpeg'

    // Step A: Request presigned URL
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: selectedFile.name,
        contentType: contentType,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to get upload authorization')
    }

    // Step B: Direct PUT to Cloudflare R2 (Ensure headers match signed command exactly)
    const uploadRes = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: selectedFile,
    })

    if (!uploadRes.ok) {
      throw new Error(`Upload failed with status: ${uploadRes.status}`)
    }

    return data.publicUrl
  }

  // 2. Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatusMessage(null)

    try {
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid expense amount.')
      }

      let receiptUrl: string | null = null

      if (file) {
        receiptUrl = await uploadImageToR2(file)
      }

      const { error: dbError } = await supabase.from('trip_expenses').insert([
  {
    trip_id: tripId,
    category: expenseType, // Map expenseType state to 'category' column
    amount: parseFloat(amount),
    currency,
    amount_in_base: parseFloat(amount), // Assuming base currency matches input for now
    receipt_url: receiptUrl,
  },
])

      if (dbError) throw dbError

      setStatusMessage({ type: 'success', text: 'Expense logged successfully!' })
      
      setAmount('')
      setFile(null)
      
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error('Expense Logger Error:', err)
      setStatusMessage({ type: 'error', text: err.message || 'An error occurred while logging the expense.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border border-gray-200 max-w-md mx-auto text-gray-900">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Log Trip Expense</h2>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-sm mb-4 ${
            statusMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Expense Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Expense Type</label>
          <select
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value)}
            className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="Fuel" className="text-gray-900 bg-white">Fuel</option>
            <option value="Toll Gate" className="text-gray-900 bg-white">Toll Gate</option>
            <option value="Border Fee" className="text-gray-900 bg-white">Border Fee</option>
            <option value="Tyre Repair" className="text-gray-900 bg-white">Tyre Repair</option>
            <option value="Driver Allowance" className="text-gray-900 bg-white">Driver Allowance</option>
            <option value="Maintenance" className="text-gray-900 bg-white">Maintenance</option>
            <option value="Other" className="text-gray-900 bg-white">Other</option>
          </select>
        </div>

        {/* Amount & Currency */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ZAR" className="text-gray-900 bg-white">ZAR (R)</option>
              <option value="USD" className="text-gray-900 bg-white">USD ($)</option>
              <option value="BWP" className="text-gray-900 bg-white">BWP (P)</option>
            </select>
          </div>
        </div>

        {/* Receipt Attachment */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Attach Receipt / Image</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving Expense...' : 'Log Expense'}
        </button>
      </form>
    </div>
  )
}