'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import imageCompression from 'browser-image-compression'

export default function ExpenseLogger({ tripId }: { tripId: string }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('Fuel')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('ZAR')
  const [file, setFile] = useState<File | null>(null)

  // Multi-Currency Exchange Rates (Base: ZAR)
  const exchangeRates: Record<string, number> = { ZAR: 1.0, USD: 18.50, ZMW: 0.72, ZWG: 0.65 }

  const handleUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let receiptUrl = ''

      // 1. Compress Image before upload if photo exists
      if (file) {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.2, // Compress to ~200KB
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        })

        const formData = new FormData()
        formData.append('file', compressedFile)

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json()
        receiptUrl = uploadData.url
      }

      // 2. Convert to Base Operational Currency (ZAR)
      const numericAmount = parseFloat(amount)
      const amountInBase = numericAmount * (exchangeRates[currency] || 1.0)

      // 3. Save to Supabase
      const { error } = await supabase.from('trip_expenses').insert({
        trip_id: tripId,
        category,
        amount: numericAmount,
        currency,
        amount_in_base: amountInBase,
        receipt_url: receiptUrl,
      })

      if (error) throw error

      alert('Expense logged successfully!')
      setAmount('')
      setFile(null)
    } catch (err: any) {
      alert(err.message || 'Error saving expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleUploadAndSave} className="p-4 bg-slate-900 text-white rounded-lg space-y-4 max-w-md">
      <h3 className="text-lg font-bold">Log Trip Expense</h3>
      
      <div>
        <label className="block text-sm">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-800 p-2 rounded border border-slate-700">
          <option value="Fuel">Fuel</option>
          <option value="Tolls">Tolls</option>
          <option value="Border">Border Fees / Gate Pass</option>
          <option value="Fine">Police Fine</option>
          <option value="Tyre">Tyre Repair</option>
        </select>
      </div>

      <div className="flex gap-2">
        <div className="w-1/3">
          <label className="block text-sm">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-slate-800 p-2 rounded border border-slate-700">
            <option value="ZAR">ZAR (R)</option>
            <option value="USD">USD ($)</option>
            <option value="ZMW">ZMW (K)</option>
          </select>
        </div>
        <div className="w-2/3">
          <label className="block text-sm">Amount</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full bg-slate-800 p-2 rounded border border-slate-700" placeholder="0.00" />
        </div>
      </div>

      <div>
        <label className="block text-sm">Receipt / Photo Scan</label>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-400" />
      </div>

      <button type="submit" disabled={loading} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold p-2 rounded transition">
        {loading ? 'Compressing & Saving...' : 'Save Expense Log'}
      </button>
    </form>
  )
}