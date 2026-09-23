import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][];
}

interface OsrmRouteResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
}

const OSRM_URL = process.env.OSRM_URL ?? 'http://localhost:5001';

@Injectable()
export class RoutingService {
  async route(
    originLat: number,
    originLng: number,
    destinationLat: number,
    destinationLng: number,
  ): Promise<RouteResult> {
    const url =
      `${OSRM_URL}/route/v1/driving/` +
      `${originLng},${originLat};${destinationLng},${destinationLat}` +
      `?overview=full&geometries=geojson`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new ServiceUnavailableException(
        'Routing service is unreachable. Is the osrm container running (docker compose up -d osrm)?',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Routing service returned an error');
    }

    const data = (await response.json()) as OsrmRouteResponse;
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) {
      throw new ServiceUnavailableException(
        'No route could be found between these coordinates',
      );
    }

    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry: route.geometry.coordinates,
    };
  }
}
