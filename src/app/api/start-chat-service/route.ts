import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { appendFileSync } from 'fs'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const SERVICE_DIR = '/home/z/my-project/mini-services/chat-service'
const LOG_FILE = '/home/z/my-project/.zscripts/chat-service-api.log'

export async function GET() {
  try {
    // First, check if the port is already listening (port 3003 = chat-service)
    const { createConnection } = await import('net')
    const isListening = await new Promise<boolean>((resolve) => {
      const conn = createConnection(3003, 'localhost')
      conn.setTimeout(800)
      conn.on('connect', () => {
        conn.destroy()
        resolve(true)
      })
      conn.on('error', () => resolve(false))
      conn.on('timeout', () => {
        conn.destroy()
        resolve(false)
      })
    })

    // If not listening, spawn a fresh instance
    if (!isListening) {
      // Kill any stale instances first
      try {
        const { execSync } = await import('child_process')
        execSync('pkill -f "node.*chat-service/index" 2>/dev/null || true', { stdio: 'ignore' })
      } catch {
        // ignore
      }

      const child = spawn('node', ['--experimental-strip-types', 'index.ts'], {
        cwd: SERVICE_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      })

      child.unref()

      child.stdout?.on('data', (data) => {
        appendFileSync(LOG_FILE, data.toString())
      })
      child.stderr?.on('data', (data) => {
        appendFileSync(LOG_FILE, data.toString())
      })

      appendFileSync(LOG_FILE, `[api] spawned chat-service with PID ${child.pid}\n`)

      // Wait briefly for it to come up
      await new Promise((r) => setTimeout(r, 1500))
    }

    // Re-check the port
    const { createConnection: cc } = await import('net')
    const nowListening = await new Promise<boolean>((resolve) => {
      const conn = cc(3003, 'localhost')
      conn.setTimeout(1000)
      conn.on('connect', () => {
        conn.destroy()
        resolve(true)
      })
      conn.on('error', () => resolve(false))
      conn.on('timeout', () => {
        conn.destroy()
        resolve(false)
      })
    })

    return NextResponse.json({
      started: true,
      portListening: nowListening,
      message: nowListening ? 'Chat service is running' : 'Chat service starting...',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start chat service' },
      { status: 500 },
    )
  }
}
