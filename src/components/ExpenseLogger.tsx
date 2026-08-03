'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
)

interface ExpenseLoggerProps {
  tripId: string
}

export default function ExpenseLogger({ tripId }: ExpenseLoggerProps) {
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null)
  const [expenseType, setExpenseType] = useState('Fuel')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('ZAR')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // Fetch logged-in user profile on load
  useEffect(() => {
    async function getDriverProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('full_name')
          .eq('id', user.id)
          .single()

        setDriver({
          id: user.id,
          name: driverData?.full_name || user.email || 'Driver',
        })
      }
    }
    getDriverProfile()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!driver) {
      setStatusMessage('Error: You must be logged in as a driver.')
      return
    }

    setIsUploading(true)
    setStatusMessage('Processing...')

    try {
      let receiptUrl: string | null = null

      // Step A: Handle R2 Upload with Driver's Name & Date Partitioning
      if (file) {
        setStatusMessage('Generating secure upload link...')
        
        const presignRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            driverName: driver.name,
            expenseDate,
          }),
        })

        if (!presignRes.ok) throw new Error('Failed to get presigned URL from server')
        const { uploadUrl, publicUrl } = await presignRes.json()

        setStatusMessage('Uploading receipt to R2...')
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        if (!uploadRes.ok) throw new Error('Failed to upload file directly to Cloudflare R2')
        receiptUrl = publicUrl
      }

      // Step B: Save directly to Supabase attaching driver_id
      setStatusMessage('Saving expense entry...')
      const { error: dbError } = await supabase.from('trip_expenses').insert([
        {
          trip_id: tripId,
          driver_id: driver.id,
          category: expenseType,
          amount: parseFloat(amount),
          currency,
          amount_in_base: parseFloat(amount),
          receipt_url: receiptUrl,
          created_at: new Date(expenseDate).toISOString(),
        },
      ])

      if (dbError) throw dbError

      setStatusMessage('Expense successfully logged!')
      setAmount('')
      setFile(null)
    } catch (err: any) {
      console.error('Expense Logger Error:', err)
      setStatusMessage(`Error: ${err.message || 'Something went wrong'}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full max-w-lg p-6 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200">
      <h2 className="text-xl font-bold mb-5 text-slate-900 border-b border-slate-100 pb-3">
        Log Trip Expense
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Driver Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Authenticated Driver
          </label>
          <input
            type="text"
            value={driver?.name || 'Loading driver profile...'}
            disabled
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-medium cursor-not-allowed"
          />
        </div>

        {/* Date Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Expense Date
          </label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Expense Category */}
       <div>
  <label className="block text-sm font-semibold text-slate-800 mb-1">
    Category
  </label>
  <select
    value={expenseType}
    onChange={(e) => setExpenseType(e.target.value)}
    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
  >
    <option value="FUEL" className="text-slate-900">FUEL</option>
    <option value="TRAFFIC_FINE" className="text-slate-900">TRAFFIC FINE</option>
    <option value="TOLL" className="text-slate-900">TOLL</option>
    <option value="BORDER_POST" className="text-slate-900">BORDER</option>
    <option value="MAINTENANCE" className="text-slate-900">MAINTENANCE</option>
    <option value="REPAIRS" className="text-slate-900">REPAIRS</option>
    <option value="COOL_DRINK" className="text-slate-900">COOL DRINK</option>
    <option value="FOOD" className="text-slate-900">FOOD</option>
    <option value="OTHER" className="text-slate-900">OTHER</option>
  </select>
</div>

        {/* Amount & Currency */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ZAR" className="text-slate-900">ZAR (R)</option>
              <option value="USD" className="text-slate-900">USD ($)</option>
              <option value="BWP" className="text-slate-900">BWP (P)</option>
              <option value="MZN" className="text-slate-900">MZN (MT)</option>
            </select>
          </div>
        </div>

        {/* Attachment */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Attach Receipt Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isUploading || !driver}
          className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition-colors disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Uploading...' : 'Save Expense Log'}
        </button>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-sm mt-3 border font-medium ${
              statusMessage.startsWith('Error')
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {statusMessage}
          </div>
        )}
      </form>
    </div>
  )
}