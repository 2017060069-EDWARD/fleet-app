// src/components/TruckForm.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Truck } from './TripSelector'
import { uploadToR2 } from '@/lib/uploadToR2'

interface TruckFormProps {
  onTruckAdded: (newTruck: Truck) => void
  onCancel?: () => void
}

export default function TruckForm({ onTruckAdded, onCancel }: TruckFormProps) {
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [makeModel, setMakeModel] = useState('')
  const [currentOdometer, setCurrentOdometer] = useState<number | ''>('')
  const [nextServiceKm, setNextServiceKm] = useState<number | ''>('')
  const [odometerPhoto, setOdometerPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Utility helper to clean strings for URL path safety
  const sanitizePathSegment = (segment: string) =>
    segment.trim().replace(/[^a-zA-Z0-9-_]/g, '_')

  const uploadPhoto = async (
    file: File,
    make: string,
    registration: string
  ): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const cleanMake = sanitizePathSegment(make)
    const cleanReg = sanitizePathSegment(registration)

    // Save with partition path: Trucks/Make/Registration/filename
    const fileName = `Trucks/${cleanMake}/${cleanReg}/${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('odometer-photos')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage
      .from('odometer-photos')
      .getPublicUrl(fileName)

    return publicUrlData.publicUrl
  }

  const handleAddTruck = async (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault()
  e.stopPropagation()

  if (!registrationNumber || !makeModel) {
    setErrorMsg('Registration number and Make & Model are required.')
    return
  }

  setLoading(true)
  setErrorMsg('')

  try {
    const odo = Number(currentOdometer) || 0
    const service = Number(nextServiceKm)

    if (isNaN(service) || service <= 0) {
      throw new Error('Please specify a valid next service kilometer reading.')
    }

    let photoUrl: string | null = null
    if (odometerPhoto) {
      // Clean partition path: Trucks/Make/Registration
      const folderPath = `Trucks/${makeModel}/${registrationNumber}`
      photoUrl = await uploadToR2({ file: odometerPhoto, folderPath })
    }

    const { data, error } = await supabase
      .from('trucks')
      .insert([
        {
          registration_number: registrationNumber.trim().toUpperCase(),
          make_model: makeModel.trim(),
          current_odometer: odo,
          next_service_km: service,
          odometer_image_url: photoUrl,
        },
      ])
      .select()
      .single()

    if (error) throw error

    if (data) {
      onTruckAdded(data)
      setRegistrationNumber('')
      setMakeModel('')
      setCurrentOdometer('')
      setNextServiceKm('')
      setOdometerPhoto(null)
    }
  } catch (err: any) {
    setErrorMsg(err.message || 'Failed to register truck')
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="p-4 bg-slate-950 border border-slate-700 rounded-xl mb-4 text-left">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-100">Register New Fleet Truck</h4>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Registration Number *
            </label>
            <input
              type="text"
              required
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g. ND 123-456"
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Make & Model *
            </label>
            <input
              type="text"
              required
              value={makeModel}
              onChange={(e) => setMakeModel(e.target.value)}
              placeholder="e.g. Volvo FH16"
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Current Odometer (km)
            </label>
            <input
              type="number"
              required
              min="0"
              value={currentOdometer}
              onChange={(e) =>
                setCurrentOdometer(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="e.g. 120000"
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Next Service Target (km) *
            </label>
            <input
              type="number"
              required
              min="0"
              value={nextServiceKm}
              onChange={(e) =>
                setNextServiceKm(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="e.g. 135000"
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Current Odometer Photo
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setOdometerPhoto(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
          />
        </div>

        <button
          type="button"
          onClick={handleAddTruck}
          disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:bg-slate-800"
        >
          {loading ? 'Uploading Photo & Registering...' : 'Save & Register Truck'}
        </button>

        {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
      </div>
    </div>
  )
}