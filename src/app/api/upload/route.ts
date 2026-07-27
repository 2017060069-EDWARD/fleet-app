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
    const { filename, contentType, driverName, expenseDate } = await request.json()

    // 1. Sanitize inputs for safe path formatting
    const safeDriver = (driverName || 'unassigned')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')

    // Use provided date (YYYY-MM-DD) or fallback to current UTC date
    const safeDate = expenseDate || new Date().toISOString().split('T')[0]
    
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')

    // 2. Build the partitioned object key
    // Output structure: receipts/john_doe/2026-07-27/1785109393707-receipt.jpg
    const key = `receipts/${safeDriver}/${safeDate}/${Date.now()}-${safeFilename}`

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