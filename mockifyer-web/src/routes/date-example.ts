import express, { Request, Response } from 'express';
import { getCurrentDate } from '@sgedda/mockifyer-core';

const router = express.Router();

// Example endpoint that demonstrates date manipulation in data
router.get('/', (req: Request, res: Response) => {
  try {
    const manipulatedDate = getCurrentDate();
    
    // Create example data that uses the manipulated date
    // This simulates a real API response where dates are based on the current date
    const baseDate = new Date(manipulatedDate);
    
    // Example: Subscription data
    const subscriptionStart = new Date(baseDate);
    subscriptionStart.setDate(subscriptionStart.getDate() - 30); // Started 30 days ago (relative to manipulated date)
    
    const subscriptionEnd = new Date(baseDate);
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 335); // Ends in 335 days (relative to manipulated date)
    
    // Example: Event schedule
    const upcomingEvent = new Date(baseDate);
    upcomingEvent.setDate(upcomingEvent.getDate() + 7); // Event in 7 days
    
    const pastEvent = new Date(baseDate);
    pastEvent.setDate(pastEvent.getDate() - 14); // Event was 14 days ago
    
    // Example: User activity
    const lastLogin = new Date(baseDate);
    lastLogin.setHours(lastLogin.getHours() - 2); // Last login 2 hours ago
    
    const nextBilling = new Date(baseDate);
    nextBilling.setDate(nextBilling.getDate() + 1); // Next billing tomorrow
    
    const response = {
      message: 'This endpoint demonstrates how date manipulation affects data',
      currentDate: {
        manipulated: manipulatedDate.toISOString(),
        formatted: manipulatedDate.toLocaleString(),
        timestamp: manipulatedDate.getTime()
      },
      examples: {
        subscription: {
          status: 'active',
          startDate: subscriptionStart.toISOString(),
          endDate: subscriptionEnd.toISOString(),
          daysRemaining: Math.ceil((subscriptionEnd.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)),
          daysActive: Math.ceil((baseDate.getTime() - subscriptionStart.getTime()) / (1000 * 60 * 60 * 24)),
          note: 'Subscription dates are calculated relative to the manipulated date'
        },
        events: {
          upcoming: {
            name: 'Annual Conference',
            date: upcomingEvent.toISOString(),
            daysUntil: Math.ceil((upcomingEvent.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)),
            formatted: upcomingEvent.toLocaleString()
          },
          past: {
            name: 'Product Launch',
            date: pastEvent.toISOString(),
            daysAgo: Math.ceil((baseDate.getTime() - pastEvent.getTime()) / (1000 * 60 * 60 * 24)),
            formatted: pastEvent.toLocaleString()
          },
          note: 'Event dates are calculated relative to the manipulated date'
        },
        userActivity: {
          lastLogin: {
            timestamp: lastLogin.toISOString(),
            formatted: lastLogin.toLocaleString(),
            hoursAgo: Math.round((baseDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60))
          },
          nextBilling: {
            timestamp: nextBilling.toISOString(),
            formatted: nextBilling.toLocaleString(),
            hoursUntil: Math.round((nextBilling.getTime() - baseDate.getTime()) / (1000 * 60 * 60))
          },
          note: 'Activity timestamps are calculated relative to the manipulated date'
        },
        dateRanges: {
          thisWeek: {
            start: (() => {
              const weekStart = new Date(baseDate);
              const dayOfWeek = weekStart.getDay();
              weekStart.setDate(weekStart.getDate() - dayOfWeek);
              weekStart.setHours(0, 0, 0, 0);
              return weekStart.toISOString();
            })(),
            end: (() => {
              const weekEnd = new Date(baseDate);
              const dayOfWeek = weekEnd.getDay();
              weekEnd.setDate(weekEnd.getDate() - dayOfWeek + 6);
              weekEnd.setHours(23, 59, 59, 999);
              return weekEnd.toISOString();
            })(),
            note: 'Week boundaries are calculated from the manipulated date'
          },
          thisMonth: {
            start: new Date(baseDate.getFullYear(), baseDate.getMonth(), 1).toISOString(),
            end: new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
            note: 'Month boundaries are calculated from the manipulated date'
          }
        }
      },
      explanation: {
        title: 'How Date Manipulation Works',
        description: 'All dates in this response are calculated relative to the manipulated date configured in Mockifyer. When you change the date manipulation settings, all these dates will shift accordingly.',
        useCase: 'This is useful for testing time-dependent features like subscriptions, events, billing cycles, and activity logs without waiting for real time to pass.'
      }
    };
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(response);
  } catch (error: any) {
    console.error('[DateExample] Error:', error);
    res.status(500).json({ error: 'Failed to generate example data', details: error.message });
  }
});

export { router as dateExampleRouter };

