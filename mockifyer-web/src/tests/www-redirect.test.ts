import request from 'supertest';
import app from '../index';

describe('WWW to apex redirect', () => {
  it('should redirect www.mockifyer.dev to apex domain with path and query', async () => {
    const response = await request(app)
      .get('/features?utm_source=test')
      .set('X-Forwarded-Host', 'www.mockifyer.dev');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('https://mockifyer.dev/features?utm_source=test');
  });

  it('should redirect www.mockifyer.dev root path', async () => {
    const response = await request(app)
      .get('/')
      .set('X-Forwarded-Host', 'www.mockifyer.dev');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('https://mockifyer.dev/');
  });

  it('should not redirect apex domain', async () => {
    const response = await request(app)
      .get('/')
      .set('X-Forwarded-Host', 'mockifyer.dev');

    expect(response.status).toBe(200);
  });

  it('should not redirect railway.app preview domains', async () => {
    const response = await request(app)
      .get('/')
      .set('X-Forwarded-Host', 'mockifyer-web-production-abc123.up.railway.app');

    expect(response.status).toBe(200);
  });

  it('should not redirect localhost', async () => {
    const response = await request(app)
      .get('/')
      .set('Host', 'localhost:3000');

    expect(response.status).toBe(200);
  });

  it('should handle Host header when X-Forwarded-Host is not present', async () => {
    const response = await request(app)
      .get('/features')
      .set('Host', 'www.mockifyer.dev');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('https://mockifyer.dev/features');
  });
});
