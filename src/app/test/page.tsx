// src/app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ExpenseLogger from '@/components/ExpenseLogger'
import Auth from '@/components/Auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
)

export default function TestPage() {
  // Dummy UUID for testing database FK constraints
  const dummyTripId = '00000000-0000-0000-0000-000000000000'

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Check current session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // 2. Listen for auth changes (sign in, sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center text-white">
        <p className="text-slate-400 font-medium">Checking authentication status...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center text-white">
      <div className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Boulevard Logistics — System Test
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {session ? 'Driver portal active' : 'Please authenticate to log trip expenses'}
        </p>
      </div>

      {!session ? (
        /* Show Auth UI if not logged in */
        <Auth onAuthSuccess={() => setLoading(false)} />
      ) : (
        /* Show Expense Logger if session exists */
        <div className="w-full max-w-lg space-y-4">
          <ExpenseLogger tripId={dummyTripId} />
          
          <button
            onClick={handleSignOut}
            className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-lg border border-slate-700 transition-colors"
          >
            Sign Out Driver
          </button>
        </div>
      )}
    </main>
  )
}