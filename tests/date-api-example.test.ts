import { setupMockifyer, getCurrentDate, resetDateManipulation } from '../src';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

describe('Date-based API Examples', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    resetDateManipulation();
    // Clear any environment variables that might affect tests
    delete process.env.MOCKIFYER_DATE;
    delete process.env.MOCKIFYER_DATE_OFFSET;
    delete process.env.MOCKIFYER_TIMEZONE;

    // Setup axios mock
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    // Restore all clocks set by setupMockifyer
    resetDateManipulation();
    mock.restore();
  });

  describe('Movie Release API Example', () => {
    const movieApi = 'https://api.example.com/movies/upcoming';
    
    // Base movie data
    const movies = [
      {
        id: 1,
        title: 'Future Blockbuster',
        releaseDate: '2024-06-15T00:00:00.000Z'
      },
      {
        id: 2,
        title: 'Summer Hit',
        releaseDate: '2024-07-01T00:00:00.000Z'
      }
    ];

    // Helper function to calculate movie status and days until release
    function calculateMovieStatus(movie: typeof movies[0], currentDate: Date) {
      const releaseDate = new Date(movie.releaseDate);
      const diffTime = releaseDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...movie,
        status: diffDays <= 0 ? 'released' : 'upcoming',
        daysUntilRelease: diffDays <= 0 ? 0 : diffDays
      };
    }

    it('should show days until release when current date is before release', async () => {
      // Set current date to January 2024
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate: '2024-01-01T00:00:00.000Z'
        }
      });

      // Mock API response
      mock.onGet(movieApi).reply(() => {
        const currentDate = getCurrentDate();
        console.log('Current date:', currentDate.toISOString());
        
        // Calculate status and days for each movie
        const moviesWithStatus = movies.map(movie => 
          calculateMovieStatus(movie, currentDate)
        );
        
        return [200, moviesWithStatus];
      });

      const response = await axios.get(movieApi);
      expect(response.data[0].status).toBe('upcoming');
      expect(response.data[0].daysUntilRelease).toBe(166); // Jan 1 to June 15
      expect(response.data[1].status).toBe('upcoming');
      expect(response.data[1].daysUntilRelease).toBe(182); // Jan 1 to July 1
    });

    it('should show some movies as released with 0 days remaining when after release date', async () => {
      // Set current date to June 20, 2024 (after first movie's release)
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate: '2024-06-20T00:00:00.000Z'
        }
      });

      // Mock API response
      mock.onGet(movieApi).reply(() => {
        const currentDate = getCurrentDate();
        console.log('Current date:', currentDate.toISOString());
        
        // Calculate status and days for each movie
        const moviesWithStatus = movies.map(movie => 
          calculateMovieStatus(movie, currentDate)
        );
        
        return [200, moviesWithStatus];
      });

      const response = await axios.get(movieApi);
      expect(response.data[0].status).toBe('released');
      expect(response.data[0].daysUntilRelease).toBe(0); // Already released
      expect(response.data[1].status).toBe('upcoming');
      expect(response.data[1].daysUntilRelease).toBe(11); // June 20 to July 1
    });
  });

  describe('Subscription API Example', () => {
    const subscriptionApi = 'https://api.example.com/subscription/status';
    
    // Base subscription data
    const subscription = {
      id: 'sub_123',
      validUntil: '2024-03-01T00:00:00.000Z',
      plan: 'premium'
    };

    // Helper function to calculate subscription status and remaining days
    function calculateSubscriptionStatus(sub: typeof subscription, currentDate: Date) {
      const expirationDate = new Date(sub.validUntil);
      const diffTime = expirationDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...sub,
        status: diffDays <= 0 ? 'expired' : 'active',
        daysRemaining: diffDays <= 0 ? 0 : diffDays,
        gracePeriod: diffDays <= 0 && diffDays > -7, // 7-day grace period
        renewalUrgency: diffDays <= 7 ? 'high' : diffDays <= 30 ? 'medium' : 'low'
      };
    }

    it('should show subscription details when active', async () => {
      // Set current date to February 15, 2024
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate: '2024-02-15T00:00:00.000Z'
        }
      });

      // Mock API response
      mock.onGet(subscriptionApi).reply(() => {
        const currentDate = getCurrentDate();
        console.log('Current date:', currentDate.toISOString());
        
        const subStatus = calculateSubscriptionStatus(subscription, currentDate);
        return [200, subStatus];
      });

      const response = await axios.get(subscriptionApi);
      expect(response.data.status).toBe('active');
      expect(response.data.daysRemaining).toBe(15); // Feb 15 to March 1
      expect(response.data.renewalUrgency).toBe('medium');
      expect(response.data.gracePeriod).toBe(false);
    });

    it('should show expired status with grace period info', async () => {
      // Set current date to March 3, 2024 (2 days after expiration)
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate: '2024-03-03T00:00:00.000Z'
        }
      });

      // Mock API response
      mock.onGet(subscriptionApi).reply(() => {
        const currentDate = getCurrentDate();
        console.log('Current date:', currentDate.toISOString());
        
        const subStatus = calculateSubscriptionStatus(subscription, currentDate);
        return [200, subStatus];
      });

      const response = await axios.get(subscriptionApi);
      expect(response.data.status).toBe('expired');
      expect(response.data.daysRemaining).toBe(0);
      expect(response.data.gracePeriod).toBe(true); // Within 7-day grace period
    });

    it('should show urgent renewal status when close to expiration', async () => {
      // Set current date to February 25, 2024 (5 days before expiration)
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate: '2024-02-25T00:00:00.000Z'
        }
      });

      // Mock API response
      mock.onGet(subscriptionApi).reply(() => {
        const currentDate = getCurrentDate();
        console.log('Current date:', currentDate.toISOString());
        
        const subStatus = calculateSubscriptionStatus(subscription, currentDate);
        return [200, subStatus];
      });

      const response = await axios.get(subscriptionApi);
      expect(response.data.status).toBe('active');
      expect(response.data.daysRemaining).toBe(5);
      expect(response.data.renewalUrgency).toBe('high');
      expect(response.data.gracePeriod).toBe(false);
    });
  });
}); 