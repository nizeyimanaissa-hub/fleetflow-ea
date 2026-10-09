import { ServiceUnavailableException } from '@nestjs/common';
import { RoutingService } from './routing.service.js';

const okResponse = (body: unknown, ok = true) =>
  ({ ok, json: () => Promise.resolve(body) }) as Response;

describe('RoutingService', () => {
  const service = new RoutingService();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks OSRM for a lng,lat route and converts the units', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        code: 'Ok',
        routes: [
          {
            distance: 12_345,
            duration: 900,
            geometry: {
              coordinates: [
                [30.06, -1.95],
                [29.74, -2.6],
              ],
            },
          },
        ],
      }),
    );

    const route = await service.route(-1.95, 30.06, -2.6, 29.74);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(
      /\/route\/v1\/driving\/30\.06,-1\.95;29\.74,-2\.6\?overview=full&geometries=geojson$/,
    );
    expect(route).toEqual({
      distanceKm: 12.345,
      durationMin: 15,
      geometry: [
        [30.06, -1.95],
        [29.74, -2.6],
      ],
    });
  });

  it('reports OSRM being unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = service.route(0, 0, 1, 1);
    await expect(result).rejects.toThrow(ServiceUnavailableException);
    await expect(result).rejects.toThrow(/unreachable/);
  });

  it('reports an HTTP error from OSRM', async () => {
    fetchMock.mockResolvedValue(okResponse({}, false));
    await expect(service.route(0, 0, 1, 1)).rejects.toThrow(
      /returned an error/,
    );
  });

  it.each([
    ['a non-Ok code', { code: 'NoRoute', routes: [] }],
    ['no routes', { code: 'Ok', routes: [] }],
    ['a missing routes field', { code: 'Ok' }],
  ])('reports no route for %s', async (_name, body) => {
    fetchMock.mockResolvedValue(okResponse(body));
    await expect(service.route(0, 0, 1, 1)).rejects.toThrow(
      /No route could be found/,
    );
  });
});
