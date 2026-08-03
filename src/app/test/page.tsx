// src/app/test/page.tsx or src/app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ExpenseLogger from '@/components/ExpenseLogger'
import Auth from '@/components/Auth'
import TripSelector, { Trip } from '@/components/TripSelector'

export default function TestPage() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuthAndRole(currentSession: any) {
      if (!currentSession) {
        setSession(null)
        setLoading(false)
        return
      }

      setSession(currentSession)

      // Query the profile table to verify driver vs admin role
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentSession.user.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching role:', error)
      }

      // If user is admin, redirect to admin dashboard
      if (profile?.role === 'admin') {
        router.push('/admin/dashboard')
        return
      }

      setLoading(false)
    }

    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuthAndRole(session)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAuthAndRole(session)
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setSelectedTrip(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center text-white">
        <p className="text-slate-400 font-medium">Checking authentication and permissions...</p>
      </main>
    )
  }

  const isTripClosed = selectedTrip?.status === 'COMPLETED'

  return (
    <main className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center text-white">
      <div className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Boulevard Logistics — Fleet Portal
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {session ? 'Driver portal active' : 'Please authenticate to continue'}
        </p>
      </div>

      {!session ? (
        <Auth onAuthSuccess={() => setLoading(true)} />
      ) : (
        <div className="w-full max-w-lg">
          <TripSelector
            selectedTrip={selectedTrip}
            onSelectTrip={(trip) => setSelectedTrip(trip)}
          />

          {selectedTrip ? (
            isTripClosed ? (
              <div className="p-6 bg-slate-900 border border-red-900/40 rounded-xl text-center">
                <p className="text-red-400 font-semibold text-sm">
                  This trip is closed ({selectedTrip.origin} ➔ {selectedTrip.destination})
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Further expense entries are locked. Select an active trip or create a new trip to log expenses.
                </p>
              </div>
            ) : (
              <ExpenseLogger tripId={selectedTrip.id} />
            )
          ) : (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-sm">
              Please create or select an active trip above to log expenses.
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full mt-6 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-lg border border-slate-700 transition-colors"
          >
            Sign Out Driver
          </button>
        </div>
      )}
    </main>
  )
}