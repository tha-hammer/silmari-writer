import { NextRequest, NextResponse } from 'next/server';

/**
 * Analytics endpoint - accepts telemetry events from ButtonRibbon
 * MVP: Just acknowledges receipt. Future: store/forward to analytics service.
 */
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();

    // MVP: Log to server console for debugging, acknowledge receipt
    console.log('[Analytics]', event.eventType, event.buttonType, event.messageId?.slice(0, 8));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid event data' }, { status: 400 });
  }
}
