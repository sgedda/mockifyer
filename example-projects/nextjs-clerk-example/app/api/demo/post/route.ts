import { fetchDemoPost } from '@/lib/demo-upstream';
import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  try {
    const body = await fetchDemoPost();
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
