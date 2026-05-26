/** Local demo session only — no OAuth or third-party accounts. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  provider: 'demo';
}
