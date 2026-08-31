/** Hosts Android emulators use to reach the machine running the emulator. */
export const ANDROID_EMULATOR_LOOPBACK_HOSTS = ['10.0.2.2', '10.0.3.2'] as const;

const HOST_LOOPBACK_REPLACEMENT = '127.0.0.1';

const EMULATOR_LOOPBACK_HOST_RE = /^(https?:\/\/)(10\.0\.2\.2|10\.0\.3\.2)(?=[:/?#]|$)/i;

/**
 * Rewrites Android emulator host-loopback aliases to `127.0.0.1`.
 *
 * The dashboard `/api/proxy` runs on the host. `10.0.2.2` (AVD) and `10.0.3.2`
 * (Genymotion) only mean "host loopback" *inside* an emulator, so fetching them
 * from the host hangs until `UND_ERR_CONNECT_TIMEOUT`.
 *
 * Host-only rewrite — path, query, and port are unchanged so mock keys stay stable
 * relative to the client's URL aside from the emulator alias.
 */
export function rewriteEmulatorLoopbackUrl(url: string): string {
  return url.replace(EMULATOR_LOOPBACK_HOST_RE, `$1${HOST_LOOPBACK_REPLACEMENT}`);
}
