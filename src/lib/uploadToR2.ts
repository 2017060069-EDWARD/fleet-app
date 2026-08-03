// src/lib/uploadToR2.ts

interface R2UploadOptions {
  file: File
  folderPath?: string
  driverName?: string
  truckMake?: string
  tripStage?: 'start' | 'end'
  date?: string
}

export async function uploadToR2({
  file,
  folderPath,
  driverName,
  truckMake,
  tripStage,
  date,
}: R2UploadOptions): Promise<string> {
  // If specific trip details are provided, construct the partition path
  let path = folderPath

  if (tripStage && driverName && truckMake) {
    const formattedDate = date || new Date().toISOString().split('T')[0]
    path = `trips/${tripStage}/${driverName}/${truckMake}/${formattedDate}`
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      folderPath: path,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to generate upload URL')

  const uploadRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  })

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to Cloudflare R2')
  }

  return data.publicUrl
}