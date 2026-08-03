// src/app/admin/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function checkAdmin() {
      // Get current auth session
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.warn('Admin Guard: No valid session. Redirecting to /login')
        router.push('/login')
        return
      }

      // Fetch user profile from Supabase
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching profile for admin check:', profileError)
      }

      console.log('Admin Check Log:', { userId: user.id, email: user.email, role: profile?.role })

      if (profile?.role !== 'admin') {
        alert(`Access Denied: Your profile role is "${profile?.role || 'none'}". Required: "admin". Redirecting to driver view.`)
        router.push('/')
        return
      }

      setIsAdmin(true)
      setLoading(false)
    }

    checkAdmin()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Verifying administrative privileges...
      </div>
    )
  }

  return isAdmin ? <>{children}</> : null
}