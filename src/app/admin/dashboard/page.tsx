// src/app/admin/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface ActiveTrip {
  id: string
  origin: string
  destination: string
  start_time: string
  start_odometer: number
  driver: {
    full_name: string
  } | null
  truck: {
    registration_number: string
    make_model: string
  } | null
}

interface DriverFine {
  driver_id: string
  driver_name: string
  fine_count: number
  total_fine_amount: number
}

interface TruckService {
  truck_id: string
  registration_number: string
  make_model: string
  current_odometer: number
  next_service_km: number
  km_until_service: number
  service_status: 'OVERDUE' | 'WARNING' | 'OK'
}

interface FuelConsumption {
  trip_id: string
  driver_name: string
  truck_reg: string
  origin: string
  destination: string
  distance_km: number
  fuel_spent: number
  cost_per_km: number
}

export default function AdminDashboard() {
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([])
  const [driverFines, setDriverFines] = useState<DriverFine[]>([])
  const [serviceTrucks, setServiceTrucks] = useState<TruckService[]>([])
  const [fuelMetrics, setFuelMetrics] = useState<FuelConsumption[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)

      // 1. Fetch Drives in Progress
      const { data: tripsData } = await supabase
        .from('trips')
        .select(`
          id,
          origin,
          destination,
          start_time,
          start_odometer,
          driver:profiles!trips_driver_id_fkey(full_name),
          truck:trucks!trips_truck_id_fkey(registration_number, make_model)
        `)
        .eq('status', 'IN_PROGRESS')
        .order('start_time', { ascending: false })

      if (tripsData) {
        const formattedTrips = tripsData.map((t: any) => ({
          ...t,
          driver: Array.isArray(t.driver) ? t.driver[0] : t.driver,
          truck: Array.isArray(t.truck) ? t.truck[0] : t.truck,
        }))
        setActiveTrips(formattedTrips)
      }

      // 2. Fetch Drivers with Traffic Fines (Supports 'TRAFFIC_FINE', 'Traffic Fine', etc.)
      const { data: finesData } = await supabase
        .from('trip_expenses')
        .select(`
          amount,
          category,
          trip:trips!inner(
            driver:profiles!trips_driver_id_fkey(id, full_name)
          )
        `)
        .in('category', ['TRAFFIC_FINE', 'Traffic Fine', 'traffic_fine'])

      if (finesData) {
        const finesMap: Record<string, DriverFine> = {}
        finesData.forEach((item: any) => {
          const rawDriver = Array.isArray(item.trip?.driver) ? item.trip.driver[0] : item.trip?.driver
          const driverId = rawDriver?.id || 'unknown'
          const driverName = rawDriver?.full_name || 'Unknown Driver'

          if (!finesMap[driverId]) {
            finesMap[driverId] = {
              driver_id: driverId,
              driver_name: driverName,
              fine_count: 0,
              total_fine_amount: 0,
            }
          }
          finesMap[driverId].fine_count += 1
          finesMap[driverId].total_fine_amount += Number(item.amount ?? 0)
        })
        setDriverFines(Object.values(finesMap))
      }

      // 3. Fetch Fleet Service Status from SQL View
      const { data: serviceData } = await supabase
        .from('fleet_service_status')
        .select('*')
        .order('km_until_service', { ascending: true })

      if (serviceData) {
        setServiceTrucks(serviceData as TruckService[])
      }

      // 4. Fetch Fuel Cost per KM (Matches 'Fuel', 'FUEL', etc.)
      const { data: completedTrips } = await supabase
        .from('trips')
        .select(`
          id,
          origin,
          destination,
          start_odometer,
          end_odometer,
          driver:profiles!trips_driver_id_fkey(full_name),
          truck:trucks!trips_truck_id_fkey(registration_number),
          trip_expenses(amount, category)
        `)
        .eq('status', 'COMPLETED')

      if (completedTrips) {
        const fuelList: FuelConsumption[] = []

        completedTrips.forEach((t: any) => {
          const startOdo = t.start_odometer ?? 0
          const endOdo = t.end_odometer ?? 0
          const distance = endOdo - startOdo

          if (distance > 0) {
            const fuelExpenses = t.trip_expenses?.filter(
              (e: any) => (e.category || '').toUpperCase() === 'FUEL'
            ) || []
            
            const totalFuelSpent = fuelExpenses.reduce((sum: number, e: any) => sum + Number(e.amount ?? 0), 0)

            if (totalFuelSpent > 0) {
              const rawDriver = Array.isArray(t.driver) ? t.driver[0] : t.driver
              const rawTruck = Array.isArray(t.truck) ? t.truck[0] : t.truck

              fuelList.push({
                trip_id: t.id,
                driver_name: rawDriver?.full_name || 'Unknown',
                truck_reg: rawTruck?.registration_number || 'Unknown',
                origin: t.origin,
                destination: t.destination,
                distance_km: distance,
                fuel_spent: totalFuelSpent,
                cost_per_km: totalFuelSpent / distance,
              })
            }
          }
        })

        fuelList.sort((a, b) => b.cost_per_km - a.cost_per_km)
        setFuelMetrics(fuelList)
      }

      setLoading(false)
    }

    loadDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-slate-400 flex items-center justify-center">
        Loading fleet metrics...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white space-y-6">
      <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet Management Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time operations tracking, traffic fine reports, fuel efficiency, and vehicle maintenance status.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-lg border border-slate-700 transition-colors"
        >
          Sign Out Admin
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Drives in Progress */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-sky-400">Drives in Progress</h2>
            <span className="text-xs px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 rounded-full font-medium">
              {activeTrips.length} Active
            </span>
          </div>

          {activeTrips.length === 0 ? (
            <p className="text-xs text-slate-500">No trips currently in progress.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeTrips.map((trip) => (
                <div key={trip.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-200">
                    <span>{trip.driver?.full_name || 'Driver N/A'}</span>
                    <span className="text-sky-400">{trip.origin} ➔ {trip.destination}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Truck: {trip.truck?.registration_number} ({trip.truck?.make_model})
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Started: {trip.start_time ? new Date(trip.start_time).toLocaleString() : 'N/A'} | Start Odo: {(trip.start_odometer ?? 0).toLocaleString()} km
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 2: Drivers with Traffic Fines */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-red-400">Drivers with Traffic Fines</h2>
            <span className="text-xs px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded-full font-medium">
              {driverFines.length} Flagged
            </span>
          </div>

          {driverFines.length === 0 ? (
            <p className="text-xs text-slate-500">No traffic fines recorded.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {driverFines.map((driver) => (
                <div key={driver.driver_id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <p className="font-semibold text-slate-200">{driver.driver_name}</p>
                    <p className="text-[11px] text-slate-400">{driver.fine_count} total fine(s) logged</p>
                  </div>
                  <div className="font-bold text-red-400">
                    R {(driver.total_fine_amount ?? 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 3: Fleet Service & Maintenance Status */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-amber-400">Fleet Service & Maintenance Status</h2>
            <span className="text-[11px] text-slate-400">
              Warning threshold: ≤ 3,000 km
            </span>
          </div>

          {serviceTrucks.length === 0 ? (
            <p className="text-xs text-slate-500">No trucks registered in the system.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {serviceTrucks.map((truck) => {
                const isOverdue = truck.service_status === 'OVERDUE'
                const isWarning = truck.service_status === 'WARNING'

                return (
                  <div
                    key={truck.truck_id}
                    className={`p-3 rounded-lg border text-xs flex justify-between items-center transition-colors ${
                      isOverdue
                        ? 'bg-red-950/30 border-red-900/50 text-red-200'
                        : isWarning
                        ? 'bg-amber-950/30 border-amber-900/50 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-200">
                        {truck.registration_number} <span className="text-slate-400 font-normal">({truck.make_model})</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Odo: {(truck.current_odometer ?? 0).toLocaleString()} km | Target Service: {(truck.next_service_km ?? 0).toLocaleString()} km
                      </div>
                    </div>

                    <div>
                      {isOverdue ? (
                        <span className="px-2 py-1 bg-red-600/30 text-red-400 border border-red-500/40 rounded font-semibold text-[10px] uppercase tracking-wider">
                          Overdue by {Math.abs(truck.km_until_service).toLocaleString()} km
                        </span>
                      ) : isWarning ? (
                        <span className="px-2 py-1 bg-amber-600/30 text-amber-400 border border-amber-500/40 rounded font-semibold text-[10px] uppercase tracking-wider">
                          Due in {(truck.km_until_service ?? 0).toLocaleString()} km
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded font-semibold text-[10px] uppercase tracking-wider">
                          {(truck.km_until_service ?? 0).toLocaleString()} km left
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel 4: Fuel Cost per KM */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-emerald-400">Fuel Cost per KM Analysis</h2>
            <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full font-medium">
              Completed Trips
            </span>
          </div>

          {fuelMetrics.length === 0 ? (
            <p className="text-xs text-slate-500">No completed trip fuel metrics recorded.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {fuelMetrics.map((item) => (
                <div key={item.trip_id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-200">{item.driver_name} ({item.truck_reg})</span>
                    <span className="text-emerald-400 font-bold">R {item.cost_per_km.toFixed(2)} / km</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex justify-between">
                    <span>Route: {item.origin} ➔ {item.destination}</span>
                    <span>Distance: {(item.distance_km ?? 0).toLocaleString()} km</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">
                    Total Fuel Spent: R {(item.fuel_spent ?? 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}