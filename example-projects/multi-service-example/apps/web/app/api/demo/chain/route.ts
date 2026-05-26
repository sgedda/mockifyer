import { MOCKIFYER_CLIENT_ID_HEADER } from '../../../../../../../../packages/mockifyer-core';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const gatewayBase = (process.env.GATEWAY_URL ?? 'http://127.0.0.1:4101').replace(/\/$/, '');
  const lane = process.env.MOCKIFYER_CLIENT_ID?.trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (lane) {
    headers[MOCKIFYER_CLIENT_ID_HEADER] = lane;
  }

  const res = await fetch(`${gatewayBase}/aggregate`, {
    headers,
    cache: 'no-store',
  });

  const body: unknown = await res.json().catch(async () => ({ parseError: await res.text() }));

  return Response.json(
    {
      service: 'web-api-route',
      gatewayUrl: gatewayBase,
      gatewayStatus: res.status,
      gatewayBody: body,
    },
    { status: res.ok ? 200 : 502 }
  );
}
