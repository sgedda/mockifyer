/**
 * Tiny backend for drift detection demo
 * Modes: v1 (stable), v2 (breaking changes)
 *
 * Changes in v2:
 * - trips[].departureDate renamed to departsAt (breaking)
 * - trips[].passengers changes from number to string (breaking)
 * - trips[].class added (new field, warning)
 * - id and timestamp stay volatile (must be ignored)
 */

const express = require('express');
const app = express();

// Switch between v1 and v2 via env
const VERSION = process.env.API_VERSION || 'v1';
const PORT = process.env.PORT || 4100;

function generateId() {
  return Math.random().toString(36).substring(7);
}

app.get('/api/trips', (req, res) => {
  const baseTrips = [
    {
      id: 'TRP-001',
      destination: 'Paris',
      duration: 5,
      passengers: 2,
    },
    {
      id: 'TRP-002',
      destination: 'Tokyo',
      duration: 10,
      passengers: 1,
    },
  ];

  let trips;
  if (VERSION === 'v2') {
    // v2: breaking changes
    trips = baseTrips.map((trip) => ({
      ...trip,
      departsAt: '2026-12-01', // renamed from departureDate
      passengers: trip.passengers.toString(), // type change: number → string
      class: 'economy', // new field
    }));
  } else {
    // v1: original schema
    trips = baseTrips.map((trip) => ({
      ...trip,
      departureDate: '2026-12-01',
    }));
  }

  res.json({
    trips,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/booking/:id', (req, res) => {
  const baseBooking = {
    id: req.params.id,
    bookingId: 'BK-2026-001',  // Fixed ID for demo consistency
    status: 'confirmed',
    price: 1250,
  };

  let booking;
  if (VERSION === 'v2') {
    // v2: breaking changes
    booking = {
      ...baseBooking,
      confirmedAt: '2026-11-13T10:00:00Z', // renamed from confirmationDate
      price: baseBooking.price.toString(), // type change: number → string
      currency: 'USD', // new field
    };
  } else {
    // v1: original schema
    booking = {
      ...baseBooking,
      confirmationDate: '2026-11-13T10:00:00Z',
    };
  }

  res.json({
    booking,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Backend ${VERSION} running on http://localhost:${PORT}`);
  console.log(`Change version with: API_VERSION=v2 node backend.js`);
});
