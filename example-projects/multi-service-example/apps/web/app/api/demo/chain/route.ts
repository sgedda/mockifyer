export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const gatewayBase = (process.env.GATEWAY_URL ?? 'http://127.0.0.1:4101').replace(/\/$/, '');

  const res = await fetch(`${gatewayBase}/aggregate`, {
    headers: { Accept: 'application/json' },
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
