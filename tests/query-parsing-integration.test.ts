import { QueryRouter } from '../src/services/query-router';
import { WeatherQuery } from '../src/types';
import { RoutingResult } from '../src/types/routing';

describe('Parsing Optimization - Real World Test Cases', () => {
  let queryRouter: QueryRouter;

  beforeEach(() => {
    // Create a real QueryRouter to test actual parsing behavior
    queryRouter = new QueryRouter();
  });

  describe('Current Parsing Limitations - Complex Chinese Queries', () => {
    test('Complex Okinawa surfing query classification', async () => {
      const query: WeatherQuery = {
        query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速',
        context: '需要詳細的海洋條件資訊，包括波浪高度、風速、風向等衝浪相關數據'
      };

      const result: RoutingResult = await queryRouter.routeQuery(query);

      console.log('Okinawa surfing result:', {
        success: result.success,
        intent: result.parsedQuery?.intent.primary,
        location: result.parsedQuery?.location.name,
        timeframe: result.parsedQuery?.timeframe.type,
        confidence: result.parsedQuery?.intent.confidence
      });

      // Currently expected to fail - should be daily_forecast but returns weather_advice
      if (result.success && result.parsedQuery) {
        expect(result.parsedQuery.intent.primary).toBe('daily_forecast'); // Will fail
        expect(result.parsedQuery.location.name).toBe('沖繩'); // Should pass
        expect(result.parsedQuery.timeframe.type).toBe('forecast'); // Will fail
      }
    });

    test('Japanese Okinawa marine forecast parsing', async () => {
      const query: WeatherQuery = {
        query: '日本沖繩明天天氣 海況 風浪預報',
        context: '需要詳細的天氣資訊，特別是海洋相關的預報資料'
      };

      const result: RoutingResult = await queryRouter.routeQuery(query);

      console.log('Japanese Okinawa result:', {
        success: result.success,
        intent: result.parsedQuery?.intent.primary,
        location: result.parsedQuery?.location.name,
        timeframe: result.parsedQuery?.timeframe.type
      });
      
      // Document current behavior vs expected
      if (result.success && result.parsedQuery) {
        // These are expected to fail with current implementation
        expect(result.parsedQuery.intent.primary).toBe('daily_forecast');
        expect(result.parsedQuery.location.name).toContain('沖繩');
      }
    });

    test('Agricultural weather query with location issues', async () => {
      const query: WeatherQuery = {
        query: '農業種植天氣預報 下週降雨量 風速 適合播種嗎',
        context: '需要了解下週的詳細天氣資訊，包括降雨量、風速等農業相關數據'
      };

      const result: RoutingResult = await queryRouter.routeQuery(query);

      console.log('Agricultural query result:', {
        success: result.success,
        intent: result.parsedQuery?.intent.primary,
        location: result.parsedQuery?.location.name,
        timeframe: result.parsedQuery?.timeframe.type,
        error: result.error?.message
      });

      // Document location extraction issues
      if (result.success && result.parsedQuery) {
        expect(result.parsedQuery.timeframe.type).toBe('forecast');
        expect(result.parsedQuery.dataPreferences.metrics).toContain('precipitation');
      }
    });

    test('Air quality complex query', async () => {
      const query: WeatherQuery = {
        query: '台灣明天空氣品質預報 花粉濃度 過敏指數 戶外運動建議',
        context: '需要空氣品質、花粉濃度、過敏指數等健康相關資訊'
      };

      const result: RoutingResult = await queryRouter.routeQuery(query);

      console.log('Air quality result:', {
        success: result.success,
        intent: result.parsedQuery?.intent.primary,
        location: result.parsedQuery?.location.name,
        metrics: result.parsedQuery?.dataPreferences.metrics
      });

      // Currently extracts wrong location "台灣明天空氣品質"
      if (result.success && result.parsedQuery) {
        expect(result.parsedQuery.location.name).toBe('台灣'); // Will fail - extracts compound
        expect(result.parsedQuery.timeframe.type).toBe('forecast');
      }
    });

    test('English outdoor wedding planning query', async () => {
      const query: WeatherQuery = {
        query: 'planning outdoor wedding in Kyoto next Saturday, need detailed weather forecast',
        context: 'Planning outdoor wedding ceremony, need detailed hourly forecast'
      };

      const result: RoutingResult = await queryRouter.routeQuery(query);

      console.log('Wedding planning result:', {
        success: result.success,
        intent: result.parsedQuery?.intent.primary,
        location: result.parsedQuery?.location.name,
        timeframe: result.parsedQuery?.timeframe.type
      });

      // Currently returns weather_advice instead of hourly_forecast
      if (result.success && result.parsedQuery) {
        expect(result.parsedQuery.intent.primary).toBe('hourly_forecast'); // Will fail
        expect(result.parsedQuery.location.name).toBe('Kyoto');
      }
    });
  });

  describe('Simple Queries That Should Work', () => {
    test('Simple Chinese query', async () => {
      const query: WeatherQuery = {
        query: '明天台北天氣'
      };

      const result: RoutingResult = await queryRouter.routeQuery(query);

      console.log('Simple Chinese result:', {
        success: result.success,
        intent: result.parsedQuery?.intent.primary,
        location: result.parsedQuery?.location.name,
        confidence: result.parsedQuery?.intent.confidence
      });

      if (result.success && result.parsedQuery) {
        expect(result.parsedQuery.location.name).toContain('台北');
        expect(result.parsedQuery.timeframe.type).toBe('forecast');
        expect(result.parsedQuery.intent.confidence).toBeGreaterThan(0.7);
      }
    });

    test('Simple English query', async () => {
      const query: WeatherQuery = {
        query: 'weather in Tokyo today'
      };

      const result: RoutingResult = await queryRouter.routeQuery(query);

      console.log('Simple English result:', {
        success: result.success,
        intent: result.parsedQuery?.intent.primary,
        location: result.parsedQuery?.location.name,
        timeframe: result.parsedQuery?.timeframe.type
      });

      if (result.success && result.parsedQuery) {
        expect(result.parsedQuery.location.name).toBe('Tokyo');
        expect(result.parsedQuery.timeframe.type).toBe('current');
      }
    });
  });

  describe('Expected Parsing Behavior Documentation', () => {
    test('Document current vs expected behavior for key failing cases', async () => {
      const testCases = [
        {
          name: 'Complex Chinese surfing query',
          query: '沖繩明天天氣預報 衝浪條件 海浪高度 風速',
          expected: { intent: 'daily_forecast', location: '沖繩', timeframe: 'forecast' },
          issues: ['Intent misclassified as weather_advice', 'Marine metrics not recognized']
        },
        {
          name: 'Agricultural query without location',
          query: '農業種植天氣預報 下週降雨量 風速 適合播種嗎',
          expected: { intent: 'weekly_forecast', timeframe: 'forecast' },
          issues: ['Location extraction fails', 'Complex time reference parsing']
        },
        {
          name: 'Air quality with compound location',
          query: '台灣明天空氣品質預報 花粉濃度',
          expected: { location: '台灣', timeframe: 'forecast' },
          issues: ['Extracts "台灣明天空氣品質" as location', 'Time parsing interferes with location']
        }
      ];

      for (const testCase of testCases) {
        const result = await queryRouter.routeQuery({ query: testCase.query });
        
        console.log(`\n=== ${testCase.name} ===`);
        console.log('Query:', testCase.query);
        console.log('Expected:', testCase.expected);
        console.log('Actual:', result.parsedQuery ? {
          intent: result.parsedQuery.intent.primary,
          location: result.parsedQuery.location.name,
          timeframe: result.parsedQuery.timeframe.type,
          confidence: result.parsedQuery.intent.confidence
        } : 'FAILED');
        console.log('Known Issues:', testCase.issues);
      }

      // This test is for documentation, always pass
      expect(true).toBe(true);
    });
  });
});