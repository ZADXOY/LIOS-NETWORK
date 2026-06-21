import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { appendFileSync } from 'fs'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const SERVICE_DIR = '/home/z/my-project/mini-services/chat-service'
const LOG_FILE = '/home/z/my-project/.zscripts/chat-service-api.log'

// Track if we've already started the service in this server instance
declare global {
  var __chatServiceStarted: boolean | undefined
}

export async function GET() {
  try {
    if (!global.__chatServiceStarted) {
      global.__chatServiceStarted = true

      const child = spawn('node', ['--experimental-strip-types', 'index.ts'], {
        cwd: SERVICE_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true, // detach so it survives this request
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      })

      child.unref() // allow the parent to exit independently

      child.stdout?.on('data', (data) => {
        appendFileSync(LOG_FILE, data.toString())
      })
      child.stderr?.on('data', (data) => {
        appendFileSync(LOG_FILE, data.toString())
      })

      appendFileSync(LOG_FILE, `[api] spawned chat-service with PID ${child.pid}\n`)
    }

    // Check if the port is listening by trying a simple TCP connection
    const { createConnection } = await import('net')
    const isListening = await new Promise<boolean>((resolve) => {
      const conn = createConnection(3003, 'localhost')
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
      portListening: isListening,
      message: isListening ? 'Chat service is running' : 'Chat service starting...',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start chat service' },
      { status: 500 },
    )
  }
}
