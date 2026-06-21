import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Allowed mime types and extensions for legion logos
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const ALLOWED_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
}

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('logo')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded. Use form field "logo".' }, { status: 400 })
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type "${file.type}". Allowed: PNG, JPEG, WebP, GIF, SVG.` },
        { status: 415 },
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${file.size} bytes). Max 2 MB.` },
        { status: 413 },
      )
    }

    // Ensure upload directory exists under public/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'legions')
    await mkdir(uploadDir, { recursive: true })

    const ext = ALLOWED_EXT[file.type] || '.bin'
    const filename = `${randomUUID()}${ext}`
    const filePath = path.join(uploadDir, filename)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(filePath, buffer)

    // Return a relative URL path the client can use directly
    const publicUrl = `/uploads/legions/${filename}`

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type,
    })
  } catch (err) {
    console.error('[legion-upload] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/legion-upload',
    usage: 'multipart/form-data with field "logo" (PNG/JPEG/WebP/GIF/SVG, max 2MB)',
  })
}
