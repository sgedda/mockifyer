import { rewriteEmulatorLoopbackUrl } from '../packages/mockifyer-dashboard/src/utils/rewrite-emulator-loopback-url';

describe('rewriteEmulatorLoopbackUrl', () => {
  it('rewrites Android emulator host loopback (10.0.2.2) to 127.0.0.1', () => {
    expect(rewriteEmulatorLoopbackUrl('http://10.0.2.2:4000/graphql')).toBe(
      'http://127.0.0.1:4000/graphql'
    );
  });

  it('rewrites Genymotion host loopback (10.0.3.2) to 127.0.0.1', () => {
    expect(rewriteEmulatorLoopbackUrl('https://10.0.3.2/v1/items')).toBe(
      'https://127.0.0.1/v1/items'
    );
  });

  it('is case-insensitive on the scheme', () => {
    expect(rewriteEmulatorLoopbackUrl('HTTP://10.0.2.2:4000/x')).toBe('HTTP://127.0.0.1:4000/x');
  });

  it('leaves LAN, localhost, and public hosts unchanged', () => {
    expect(rewriteEmulatorLoopbackUrl('http://192.168.1.10:4000/api')).toBe(
      'http://192.168.1.10:4000/api'
    );
    expect(rewriteEmulatorLoopbackUrl('http://localhost:4000/api')).toBe('http://localhost:4000/api');
    expect(rewriteEmulatorLoopbackUrl('http://127.0.0.1:4000/api')).toBe('http://127.0.0.1:4000/api');
    expect(rewriteEmulatorLoopbackUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1'
    );
  });

  it('does not rewrite the alias when it appears later in the URL', () => {
    expect(rewriteEmulatorLoopbackUrl('http://api.example.com/redirect?to=http://10.0.2.2:4000')).toBe(
      'http://api.example.com/redirect?to=http://10.0.2.2:4000'
    );
  });
});
