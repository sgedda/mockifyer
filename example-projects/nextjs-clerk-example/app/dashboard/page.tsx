import { DashboardClient } from './dashboard-client';

export default function DashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>API dashboard</h1>
      <DashboardClient />
    </div>
  );
}
