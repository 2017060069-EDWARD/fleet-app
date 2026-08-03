// src/app/api/upload/route.ts
import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT?.trim(),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() || '',
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

export async function POST(request: Request) {
  try {
    const { filename, contentType, driverName, expenseDate, folderPath } = await request.json()

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 })
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    let key = ''

    if (folderPath) {
      // 1. Custom Partition Path (e.g. "Trucks/Volvo_FH16/ND_123-456")
      const safePath = folderPath
        .split('/')
        .map((segment: string) => segment.trim().replace(/[^a-zA-Z0-9-_]/g, '_'))
        .filter(Boolean)
        .join('/')

      key = `${safePath}/${Date.now()}-${safeFilename}`
    } else {
      // 2. Default Receipt Partition Path
      const safeDriver = (driverName || 'unassigned')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')

      const safeDate = expenseDate || new Date().toISOString().split('T')[0]
      key = `receipts/${safeDriver}/${safeDate}/${Date.now()}-${safeFilename}`
    }

    const command = new PutObjectCommand({
      Bucket: 'fleet-app-media',
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    })

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`

    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (error: any) {
    console.error('Presigned URL Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}