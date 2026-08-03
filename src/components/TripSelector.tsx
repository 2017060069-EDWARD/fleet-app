// src/components/TripSelector.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TruckForm from './TruckForm'
import { uploadToR2 } from '@/lib/uploadToR2'

export interface Truck {
  id: string
  registration_number: string
  make_model: string
  current_odometer: number
  odometer_image_url?: string
}

export interface Trip {
  id: string
  truck_id?: string
  driver_id?: string
  origin: string
  destination: string
  status: string
  start_time: string
  end_time?: string
  start_odometer?: number
  start_odometer_image_url?: string
  end_odometer?: number
  end_odometer_image_url?: string
  trucks?: Truck
}

interface TripSelectorProps {
  onSelectTrip: (trip: Trip | null) => void
  selectedTrip: Trip | null
}

export default function TripSelector({ onSelectTrip, selectedTrip }: TripSelectorProps) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [selectedTruckId, setSelectedTruckId] = useState<string>('')
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [isAddingTruck, setIsAddingTruck] = useState(false)

  // Start Trip State
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [startOdometer, setStartOdometer] = useState<number | ''>('')
  const [startPhoto, setStartPhoto] = useState<File | null>(null)

  // Close Trip State
  const [endOdometer, setEndOdometer] = useState<number | ''>('')
  const [endPhoto, setEndPhoto] = useState<File | null>(null)
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchTripsAndTrucks()
  }, [])

  const fetchTripsAndTrucks = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: truckData } = await supabase
      .from('trucks')
      .select('id, registration_number, make_model, current_odometer, odometer_image_url')
      .order('registration_number', { ascending: true })

    if (truckData) {
      setTrucks(truckData)
      if (truckData.length > 0 && !selectedTruckId) {
        setSelectedTruckId(truckData[0].id)
      }
    }

    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select(`
        id, truck_id, driver_id, origin, destination, status, start_time, end_time,
        start_odometer, start_odometer_image_url, end_odometer, end_odometer_image_url,
        trucks ( id, registration_number, make_model, current_odometer, odometer_image_url )
      `)
      .eq('driver_id', user.id)
      .order('start_time', { ascending: false })
      .limit(15)

    if (tripError) {
      console.error('Error fetching trips:', tripError)
      return
    }

    if (tripData && tripData.length > 0) {
      setTrips(tripData as unknown as Trip[])
      if (!selectedTrip) {
        onSelectTrip(tripData[0] as unknown as Trip)
      }
    } else {
      setTrips([])
      onSelectTrip(null)
    }
  }

  const handleTruckAdded = (newTruck: Truck) => {
    setTrucks((prev) => [...prev, newTruck])
    setSelectedTruckId(newTruck.id)
    setIsAddingTruck(false)
  }

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    if (!selectedTruckId) {
      setErrorMsg('Please select or add a truck for this trip.')
      setLoading(false)
      return
    }

    if (!startOdometer || Number(startOdometer) <= 0) {
      setErrorMsg('Please enter a valid start odometer reading.')
      setLoading(false)
      return
    }

    if (!startPhoto) {
      setErrorMsg('A picture of the starting odometer reading is required.')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User session not found')

      // Fetch driver profile name for partition path
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const driverName = profile?.full_name || user.email || 'unknown_driver'
      const activeTruck = trucks.find((t) => t.id === selectedTruckId)
      const truckMake = activeTruck?.make_model || 'unknown_make'
      const today = new Date().toISOString().split('T')[0]

      // Upload to R2: trips/start/<driver_name>/<truck_make>/<YYYY-MM-DD>
      const photoUrl = await uploadToR2({
        file: startPhoto,
        tripStage: 'start',
        driverName,
        truckMake,
        date: today,
      })

      const { data, error } = await supabase
        .from('trips')
        .insert([
          {
            driver_id: user.id,
            truck_id: selectedTruckId,
            origin: origin.trim() || 'Depot',
            destination: destination.trim() || 'Destination',
            start_odometer: Number(startOdometer),
            start_odometer_image_url: photoUrl,
            status: 'IN_PROGRESS',
            start_time: new Date().toISOString(),
          },
        ])
        .select(`
          id, truck_id, driver_id, origin, destination, status, start_time, end_time,
          start_odometer, start_odometer_image_url, end_odometer, end_odometer_image_url,
          trucks ( id, registration_number, make_model, current_odometer, odometer_image_url )
        `)
        .single()

      if (error) throw error

      if (data) {
        // Sync starting odometer to truck
        await supabase
          .from('trucks')
          .update({ current_odometer: Number(startOdometer) })
          .eq('id', selectedTruckId)

        const newTrip = data as unknown as Trip
        setTrips((prev) => [newTrip, ...prev])
        onSelectTrip(newTrip)
        setIsCreatingNew(false)
        setOrigin('')
        setDestination('')
        setStartOdometer('')
        setStartPhoto(null)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create trip')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTrip || selectedTrip.status === 'COMPLETED') return

    const closingReading = Number(endOdometer)
    const startingReading = selectedTrip.start_odometer || 0

    if (!endOdometer || closingReading <= 0) {
      alert('Please enter a valid closing odometer reading.')
      return
    }

    if (startingReading > 0 && closingReading < startingReading) {
      alert(`Closing odometer reading (${closingReading} km) cannot be less than starting reading (${startingReading} km).`)
      return
    }

    if (!endPhoto) {
      alert('Please attach a photo of the ending odometer reading.')
      return
    }

    setClosing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single()

      const driverName = profile?.full_name || user?.email || 'unknown_driver'
      const truckMake = selectedTrip.trucks?.make_model || 'unknown_make'
      const today = new Date().toISOString().split('T')[0]

      // Upload to R2: trips/end/<driver_name>/<truck_make>/<YYYY-MM-DD>
      const photoUrl = await uploadToR2({
        file: endPhoto,
        tripStage: 'end',
        driverName,
        truckMake,
        date: today,
      })

      const updatedEndTime = new Date().toISOString()

      const { data, error } = await supabase
        .from('trips')
        .update({
          status: 'COMPLETED',
          end_time: updatedEndTime,
          end_odometer: closingReading,
          end_odometer_image_url: photoUrl,
        })
        .eq('id', selectedTrip.id)
        .select(`
          id, truck_id, driver_id, origin, destination, status, start_time, end_time,
          start_odometer, start_odometer_image_url, end_odometer, end_odometer_image_url,
          trucks ( id, registration_number, make_model, current_odometer, odometer_image_url )
        `)
        .single()

      if (error) throw error

      if (data) {
        // Sync final closing odometer back to fleet vehicle record
        if (selectedTrip.truck_id) {
          await supabase
            .from('trucks')
            .update({ current_odometer: closingReading })
            .eq('id', selectedTrip.truck_id)
        }

        const updatedTrip = data as unknown as Trip
        setTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)))
        onSelectTrip(updatedTrip)
        setIsClosingModalOpen(false)
        setEndOdometer('')
        setEndPhoto(null)
      }
    } catch (err: any) {
      alert(`Error closing trip: ${err.message}`)
    } finally {
      setClosing(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date'
    const parsed = new Date(dateString)
    return isNaN(parsed.getTime()) ? 'Invalid Date' : parsed.toLocaleDateString()
  }

  return (
    <div className="w-full max-w-lg p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-lg mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white">Driver & Vehicle Trip Context</h3>
        <button
          type="button"
          onClick={() => {
            setIsCreatingNew(!isCreatingNew)
            setIsAddingTruck(false)
            setIsClosingModalOpen(false)
          }}
          className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
        >
          {isCreatingNew ? 'Select Existing' : '+ New Trip'}
        </button>
      </div>

      {isCreatingNew ? (
        <form onSubmit={handleCreateTrip} className="space-y-3">
          {/* Truck Selection & Add Truck Block */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Assigned Fleet Vehicle
              </label>
              <button
                type="button"
                onClick={() => setIsAddingTruck(!isAddingTruck)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                {isAddingTruck ? 'Cancel Add Truck' : '+ Add New Truck'}
              </button>
            </div>

            {isAddingTruck ? (
              <TruckForm
                onTruckAdded={handleTruckAdded}
                onCancel={() => setIsAddingTruck(false)}
              />
            ) : (
              <select
                required
                value={selectedTruckId}
                onChange={(e) => setSelectedTruckId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
              >
                {trucks.length === 0 ? (
                  <option value="">No trucks found. Click "+ Add New Truck" above.</option>
                ) : (
                  trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.registration_number} — {truck.make_model} ({truck.current_odometer} km)
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Origin</label>
              <input
                type="text"
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Pretoria Depot"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Destination</label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Durban Port"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Start Odometer & Photo */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Odometer (km) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={startOdometer}
                onChange={(e) =>
                  setStartOdometer(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="e.g. 125000"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Odometer Photo *
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setStartPhoto(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isAddingTruck}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:bg-slate-700"
          >
            {loading ? 'Uploading to R2 & Starting Trip...' : 'Assign Truck & Start Trip'}
          </button>

          {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
        </form>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Active Trip
            </label>
            <select
              value={selectedTrip?.id || ''}
              onChange={(e) => {
                const found = trips.find((t) => t.id === e.target.value) || null
                onSelectTrip(found)
                setIsClosingModalOpen(false)
              }}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
            >
              {trips.length === 0 ? (
                <option value="">No active trips found. Create one above.</option>
              ) : (
                trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.origin} ➔ {trip.destination}{' '}
                    {trip.trucks ? `[${trip.trucks.registration_number}]` : ''} (
                    {formatDate(trip.start_time)})
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedTrip && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Vehicle Assigned:</span>
                <strong className="text-white">
                  {selectedTrip.trucks
                    ? `${selectedTrip.trucks.registration_number} (${selectedTrip.trucks.make_model})`
                    : 'Unassigned'}
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Start Odometer:</span>
                <span className="text-slate-200">
                  {selectedTrip.start_odometer ? `${selectedTrip.start_odometer.toLocaleString()} km` : 'N/A'}{' '}
                  {selectedTrip.start_odometer_image_url && (
                    <a
                      href={selectedTrip.start_odometer_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 underline ml-1"
                    >
                      (View Photo)
                    </a>
                  )}
                </span>
              </div>

              {selectedTrip.status === 'COMPLETED' && (
                <div className="flex justify-between text-slate-300">
                  <span>Closing Odometer:</span>
                  <span className="text-slate-200">
                    {selectedTrip.end_odometer ? `${selectedTrip.end_odometer.toLocaleString()} km` : 'N/A'}{' '}
                    {selectedTrip.end_odometer_image_url && (
                      <a
                        href={selectedTrip.end_odometer_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 underline ml-1"
                      >
                        (View Photo)
                      </a>
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                <span>Status:</span>
                <strong
                  className={
                    selectedTrip.status === 'COMPLETED'
                      ? 'text-red-400'
                      : 'text-emerald-400 font-semibold'
                  }
                >
                  {selectedTrip.status}
                </strong>
              </div>

              {selectedTrip.status !== 'COMPLETED' && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsClosingModalOpen(!isClosingModalOpen)}
                    className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-semibold border border-red-500/30 rounded-lg transition-colors"
                  >
                    {isClosingModalOpen ? 'Cancel Close' : 'Close & Finalize Trip'}
                  </button>
                </div>
              )}

              {/* Close Trip Form / Modal */}
              {isClosingModalOpen && (
                <form
                  onSubmit={handleCloseTrip}
                  className="mt-3 p-3 bg-slate-900 border border-red-900/40 rounded-lg space-y-3"
                >
                  <h4 className="font-semibold text-red-300 text-xs">Finalize Trip & Closing Odometer</h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Closing Odometer Reading (km) *
                    </label>
                    <input
                      type="number"
                      required
                      min={selectedTrip.start_odometer || 0}
                      value={endOdometer}
                      onChange={(e) =>
                        setEndOdometer(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder={`Min: ${selectedTrip.start_odometer || 0} km`}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Closing Odometer Photo *
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => setEndPhoto(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={closing}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {closing ? 'Uploading to R2 & Finalizing...' : 'Confirm Closing Odometer & Finalize'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}