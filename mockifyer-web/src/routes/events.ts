import express, { Request, Response } from 'express';
import { getCurrentDate } from '@sgedda/mockifyer-core';
import axios from 'axios';

const router = express.Router();

// Simulated events data - in a real app, this would come from a database or external API
// We'll fetch from a mockable endpoint to demonstrate date filtering
const EVENTS_API_BASE = 'https://jsonplaceholder.typicode.com';

interface Event {
  id: number;
  title: string;
  date: string; // ISO date string
  location: string;
  description: string;
  status: 'upcoming' | 'past' | 'today';
}

// Generate realistic events data with dates relative to current date
function generateEvents(baseDate: Date): Event[] {
  const events: Event[] = [];
  
  // Generate events in the past
  for (let i = 1; i <= 3; i++) {
    const eventDate = new Date(baseDate);
    eventDate.setDate(eventDate.getDate() - (i * 7)); // 1, 2, 3 weeks ago
    events.push({
      id: i,
      title: `Past Event ${i}`,
      date: eventDate.toISOString(),
      location: `Location ${i}`,
      description: `This event happened ${i} week(s) ago`,
      status: 'past'
    });
  }
  
  // Generate event today
  const todayEvent = new Date(baseDate);
  todayEvent.setHours(14, 0, 0, 0); // 2 PM today
  events.push({
    id: 4,
    title: 'Event Happening Today',
    date: todayEvent.toISOString(),
    location: 'Main Hall',
    description: 'This event is happening today',
    status: 'today'
  });
  
  // Generate upcoming events
  for (let i = 1; i <= 5; i++) {
    const eventDate = new Date(baseDate);
    eventDate.setDate(eventDate.getDate() + (i * 3)); // 3, 6, 9, 12, 15 days in the future
    events.push({
      id: 4 + i,
      title: `Upcoming Event ${i}`,
      date: eventDate.toISOString(),
      location: `Venue ${i}`,
      description: `This event is in ${i * 3} days`,
      status: 'upcoming'
    });
  }
  
  return events;
}

// Endpoint that demonstrates date-based filtering using manipulated date
router.get('/filtered', async (req: Request, res: Response) => {
  try {
    const manipulatedDate = getCurrentDate();
    const systemDate = new Date();
    
    // Generate events (in a real app, this would fetch from an API)
    // For demo purposes, we'll generate events relative to the manipulated date
    const allEvents = generateEvents(manipulatedDate);
    
    // Filter events based on the manipulated date
    const now = manipulatedDate.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Categorize events based on manipulated date
    const filteredEvents = allEvents.map(event => {
      const eventDate = new Date(event.date);
      const eventTime = eventDate.getTime();
      const daysDiff = Math.floor((eventTime - now) / oneDayMs);
      
      let status: 'upcoming' | 'past' | 'today';
      if (daysDiff < 0) {
        status = 'past';
      } else if (daysDiff === 0) {
        status = 'today';
      } else {
        status = 'upcoming';
      }
      
      return {
        ...event,
        status,
        daysFromNow: daysDiff,
        relativeTime: daysDiff === 0 
          ? 'Today' 
          : daysDiff < 0 
            ? `${Math.abs(daysDiff)} day(s) ago`
            : `In ${daysDiff} day(s)`
      };
    });
    
    // Get filter parameter
    const filter = req.query.filter as string | undefined;
    let filteredResults = filteredEvents;
    
    if (filter === 'upcoming') {
      filteredResults = filteredEvents.filter(e => e.status === 'upcoming' || e.status === 'today');
    } else if (filter === 'past') {
      filteredResults = filteredEvents.filter(e => e.status === 'past');
    } else if (filter === 'today') {
      filteredResults = filteredEvents.filter(e => e.status === 'today');
    }
    
    // Sort by date
    filteredResults.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const response = {
      message: 'Events filtered using manipulated date',
      currentDate: {
        manipulated: manipulatedDate.toISOString(),
        manipulatedFormatted: manipulatedDate.toLocaleString(),
        system: systemDate.toISOString(),
        systemFormatted: systemDate.toLocaleString(),
        difference: {
          milliseconds: manipulatedDate.getTime() - systemDate.getTime(),
          days: Math.round((manipulatedDate.getTime() - systemDate.getTime()) / oneDayMs)
        }
      },
      filter: filter || 'all',
      totalEvents: allEvents.length,
      filteredCount: filteredResults.length,
      events: filteredResults,
      explanation: {
        title: 'Date-Based Filtering',
        description: `This endpoint uses getCurrentDate() to filter events. The manipulated date (${manipulatedDate.toLocaleString()}) is used to determine which events are "upcoming", "past", or "today".`,
        note: 'Change the date manipulation settings to see how the filtered results change!',
        queryParams: {
          filter: 'Optional: "upcoming", "past", or "today". Omit for all events.'
        }
      }
    };
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(response);
  } catch (error: any) {
    console.error('[Events] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch and filter events', 
      details: error.message 
    });
  }
});

export { router as eventsRouter };

