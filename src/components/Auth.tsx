'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const cleanEmail = email.trim().toLowerCase()

    try {
      if (isSignUp) {
        // Step A: Register in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        })
        if (error) throw error

        if (data.user) {
          // Step B: Create corresponding Driver record with full profile details
          const { error: profileError } = await supabase.from('drivers').insert([
            {
              id: data.user.id,
              full_name: fullName.trim(),
              license_number: licenseNumber.trim() || null,
              phone_number: phoneNumber.trim() || null,
            },
          ])
          if (profileError) throw profileError
        }
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        if (error) throw error
      }

      onAuthSuccess()
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
        {isSignUp ? 'Driver Registration' : 'Driver Login'}
      </h2>

      <form onSubmit={handleAuth} className="space-y-4">
        {isSignUp && (
          <>
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. Sibusiso Khumalo"
              />
            </div>

            {/* License Number */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Driver License Number
              </label>
              <input
                type="text"
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. DL-987654321"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. +27 82 123 4567"
              />
            </div>
          </>
        )}

        {/* Email Address */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="driver@fleet.com"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition-colors disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : isSignUp ? 'Register Account' : 'Sign In'}
        </button>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {errorMsg}
          </div>
        )}
      </form>

      {/* Toggle Sign Up / Sign In */}
      <button
        type="button"
        onClick={() => setIsSignUp(!isSignUp)}
        className="mt-5 text-sm text-blue-600 hover:text-blue-700 font-medium w-full text-center block transition-colors"
      >
        {isSignUp ? 'Already have an account? Sign In' : 'New driver? Register here'}
      </button>
    </div>
  )
}