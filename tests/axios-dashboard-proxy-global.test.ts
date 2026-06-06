import axios from 'axios';
import http from 'http';
import { initMockifyerForDashboardProxy } from '@sgedda/mockifyer-axios';

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected server to listen on a TCP port');
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

describe('axios dashboard proxy global preset', () => {
  it('routes ordinary global axios calls through the dashboard proxy adapter', async () => {
    const proxiedRequests: Array<Record<string, unknown>> = [];
    const server = http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/api/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', provider: 'sqlite', centralStoreOk: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/proxy') {
        proxiedRequests.push(await readJsonBody(req));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            source: 'upstream',
            response: {
              status: 202,
              headers: { 'x-from-dashboard-proxy': 'true' },
              data: { proxied: true },
            },
            scenarioResolution: { scenario: 'default' },
          })
        );
        return;
      }

      res.writeHead(404);
      res.end('not found');
    });

    const dashboardBaseUrl = await listen(server);
    const axiosInstance = axios.create();
    const originalAdapter = axiosInstance.defaults.adapter;

    try {
      await initMockifyerForDashboardProxy({
        dashboardBaseUrl,
        clientId: 'lane-a',
        config: {
          axiosInstance,
          mockDataPath: '/tmp/mockifyer-unused',
        },
      });

      const response = await axiosInstance.get('http://upstream.example.test/widgets', {
        params: { page: '1' },
      });

      expect(response.status).toBe(202);
      expect(response.data).toEqual({ proxied: true });
      expect(response.headers.get('x-from-dashboard-proxy')).toBe('true');
      expect(proxiedRequests).toHaveLength(1);
      expect(proxiedRequests[0]).toMatchObject({
        method: 'GET',
        url: 'http://upstream.example.test/widgets?page=1',
        lane: 'lane-a',
      });
    } finally {
      axiosInstance.defaults.adapter = originalAdapter;
      axiosInstance.interceptors.request.clear();
      axiosInstance.interceptors.response.clear();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
