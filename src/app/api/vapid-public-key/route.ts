import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// VAPID public key for web push notifications.
// Must match the private key in mini-services/chat-service/vapid-config.ts
const VAPID_PUBLIC_KEY = 'BOrVMzzcgLomI6lOHtcJVkv1lydr5jo75h_A8rcPzFpt_5qX2ZD4THP2B8G9H5_m84jqcvet6Ae9ykRSChnXsOg'

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY })
}
