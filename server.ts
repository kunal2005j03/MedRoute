import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const GMP_SOLUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

function getMapsApiKey(): string {
  return (process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

function isQuotaError(status: number, body: unknown): boolean {
  if (status === 429) return true;
  if (body && typeof body === 'object') {
    const err = (body as { error?: { status?: string; message?: string } }).error;
    if (err?.status === 'RESOURCE_EXHAUSTED') return true;
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('rate limit')) return true;
    const geocodeStatus = (body as { status?: string }).status;
    if (geocodeStatus === 'OVER_QUERY_LIMIT' || geocodeStatus === 'OVER_DAILY_LIMIT') {
      return true;
    }
  }
  return false;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function parseDurationSeconds(durationStr?: string): number | null {
  if (!durationStr || typeof durationStr !== 'string') return null;
  const match = durationStr.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.round(Number(match[1])) : null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health & API readiness endpoint (never exposes API keys)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      mapsConfigured: Boolean(getMapsApiKey()),
    });
  });

  // Forward or reverse geocoding via Google Geocoding REST API (India-biased)
  app.post('/api/maps/geocode', async (req: Request, res: Response) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'Google Maps Platform API key is not configured on the server.',
      });
      return;
    }

    const { address, lat, lng } = req.body ?? {};

    try {
      let url = '';
      if (typeof lat === 'number' && typeof lng === 'number') {
        url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&language=en&key=${encodeURIComponent(apiKey)}`;
      } else if (typeof address === 'string' && address.trim().length >= 2) {
        const cleanAddress = address.trim().slice(0, 180);
        url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&components=country:IN&region=in&language=en&key=${encodeURIComponent(apiKey)}`;
      } else {
        res.status(400).json({ error: 'Provide either a valid address string or numeric lat/lng.' });
        return;
      }

      const response = await fetch(url, {
        headers: { 'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID },
      });
      const data = await response.json();

      if (isQuotaError(response.status, data)) {
        res.status(429).json({
          error: 'Google Maps Platform quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      if (data.status === 'ZERO_RESULTS') {
        res.status(404).json({ error: 'No matching location found in India. Try adding a city or state name.' });
        return;
      }

      if (data.status !== 'OK') {
        res.status(502).json({ error: data.error_message || `Geocoding failed (${data.status}).` });
        return;
      }

      if (!Array.isArray(data.results) || data.results.length === 0) {
        res.status(404).json({ error: 'No matching location found in India. Try adding a city or state name.' });
        return;
      }

      const top = data.results[0];
      const resolvedLat = Number(top?.geometry?.location?.lat);
      const resolvedLng = Number(top?.geometry?.location?.lng);
      if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
        res.status(502).json({ error: 'Geocoding response did not include valid coordinates.' });
        return;
      }

      res.json({
        label: top.formatted_address || 'Selected Location',
        lat: resolvedLat,
        lng: resolvedLng,
        placeId: top.place_id || undefined,
      });
    } catch (error) {
      console.error('Geocode proxy error:', error);
      res.status(500).json({ error: 'Unable to contact Google Geocoding service.' });
    }
  });

  // Autocomplete predictions across India via Places API (New)
  app.post('/api/maps/autocomplete', async (req: Request, res: Response) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'Google Maps Platform API key is not configured on the server.',
      });
      return;
    }

    const input = typeof req.body?.input === 'string' ? req.body.input.trim().slice(0, 140) : '';
    const sessionToken =
      typeof req.body?.sessionToken === 'string' ? req.body.sessionToken.slice(0, 80) : undefined;

    if (input.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['in'],
          languageCode: 'en',
          regionCode: 'IN',
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });

      const data = await response.json();
      if (isQuotaError(response.status, data)) {
        res.status(429).json({
          error: 'Google Maps Platform quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      if (!response.ok) {
        res.status(response.status).json({
          error: data?.error?.message || 'Unable to fetch location suggestions.',
        });
        return;
      }

      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions
            .filter((item: { placePrediction?: { placeId?: string } }) => Boolean(item?.placePrediction?.placeId))
            .slice(0, 6)
            .map((item: {
              placePrediction: {
                placeId: string;
                text?: { text?: string };
                structuredFormat?: {
                  mainText?: { text?: string };
                  secondaryText?: { text?: string };
                };
              };
            }) => ({
              placeId: item.placePrediction.placeId,
              mainText:
                item.placePrediction.structuredFormat?.mainText?.text ||
                item.placePrediction.text?.text ||
                '',
              secondaryText: item.placePrediction.structuredFormat?.secondaryText?.text || '',
              fullText: item.placePrediction.text?.text || '',
            }))
        : [];

      res.json({ suggestions });
    } catch (error) {
      console.error('Autocomplete proxy error:', error);
      res.status(500).json({ error: 'Unable to contact Google Places Autocomplete service.' });
    }
  });

  // Resolve a Place ID into coordinates via Places API (New)
  app.post('/api/maps/place-details', async (req: Request, res: Response) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'Google Maps Platform API key is not configured on the server.',
      });
      return;
    }

    const placeId = typeof req.body?.placeId === 'string' ? req.body.placeId.trim() : '';
    const sessionToken =
      typeof req.body?.sessionToken === 'string' ? req.body.sessionToken.trim() : '';

    if (!placeId || placeId.length > 180) {
      res.status(400).json({ error: 'Invalid Place ID.' });
      return;
    }

    try {
      const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
      if (sessionToken) {
        url.searchParams.set('sessionToken', sessionToken);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
          'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
        },
      });

      const data = await response.json();
      if (isQuotaError(response.status, data)) {
        res.status(429).json({
          error: 'Google Maps Platform quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      const resolvedLat = Number(data?.location?.latitude);
      const resolvedLng = Number(data?.location?.longitude);
      if (!response.ok || !Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
        res.status(response.status && !response.ok ? response.status : 502).json({
          error: data?.error?.message || 'Unable to resolve selected place location.',
        });
        return;
      }

      res.json({
        placeId: data.id || placeId,
        label: data.formattedAddress || data.displayName?.text || 'Selected Location',
        lat: resolvedLat,
        lng: resolvedLng,
      });
    } catch (error) {
      console.error('Place details proxy error:', error);
      res.status(500).json({ error: 'Unable to fetch place coordinates.' });
    }
  });

  // Discover real nearby hospitals/clinics via Places API (New) + live travel via Routes API
  app.post('/api/maps/providers', async (req: Request, res: Response) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'Google Maps Platform API key is not configured on the server.',
      });
      return;
    }

    const { originLat, originLng, searchQuery, radiusMeters } = req.body ?? {};
    if (
      typeof originLat !== 'number' ||
      typeof originLng !== 'number' ||
      typeof searchQuery !== 'string' ||
      searchQuery.trim().length < 2
    ) {
      res.status(400).json({ error: 'Valid origin coordinates and search query are required.' });
      return;
    }

    const radius = Math.min(Math.max(Number(radiusMeters) || 25000, 2000), 50000);

    try {
      // 1. Places API (New) Text Search biased around the user's starting location
      const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.types,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus',
          'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
        },
        body: JSON.stringify({
          textQuery: searchQuery.trim().slice(0, 140),
          languageCode: 'en',
          regionCode: 'IN',
          pageSize: 20,
          rankPreference: 'DISTANCE',
          locationBias: {
            circle: {
              center: { latitude: originLat, longitude: originLng },
              radius,
            },
          },
        }),
      });

      const searchData = await searchResponse.json();
      if (isQuotaError(searchResponse.status, searchData)) {
        res.status(429).json({
          error: 'Google Maps Platform quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      if (!searchResponse.ok) {
        res.status(searchResponse.status).json({
          error: searchData?.error?.message || 'Unable to search healthcare providers.',
        });
        return;
      }

      const rawPlaces = Array.isArray(searchData.places) ? searchData.places : [];
      const activePlaces = rawPlaces
        .filter(
          (p: { location?: { latitude?: number; longitude?: number }; businessStatus?: string }) =>
            p?.location?.latitude != null &&
            p?.location?.longitude != null &&
            p.businessStatus !== 'CLOSED_PERMANENTLY'
        )
        .map((p: {
          id: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location: { latitude: number; longitude: number };
          primaryTypeDisplayName?: { text?: string };
          types?: string[];
          nationalPhoneNumber?: string;
          websiteUri?: string;
          googleMapsUri?: string;
        }) => {
          const straightLineKm = haversineKm(
            originLat,
            originLng,
            p.location.latitude,
            p.location.longitude
          );
          return {
            placeId: p.id,
            name: p.displayName?.text || 'Unnamed Healthcare Facility',
            address: p.formattedAddress || 'Address unavailable',
            lat: p.location.latitude,
            lng: p.location.longitude,
            facilityType: p.primaryTypeDisplayName?.text || 'Healthcare Facility',
            types: p.types || [],
            phone: p.nationalPhoneNumber || null,
            website: p.websiteUri || null,
            googleMapsUri: p.googleMapsUri || null,
            straightLineKm,
            routeDistanceKm: null as number | null,
            routeDurationMinutes: null as number | null,
            routeSource: 'straight-line' as 'routes-api' | 'straight-line',
          };
        })
        // Strict proximity sort before requesting Routes Matrix
        .sort((a: { straightLineKm: number }, b: { straightLineKm: number }) => a.straightLineKm - b.straightLineKm)
        .slice(0, 15);

      // 2. Routes API Compute Route Matrix for live driving distance and duration
      if (activePlaces.length > 0) {
        try {
          const matrixResponse = await fetch(
            'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask':
                  'originIndex,destinationIndex,duration,distanceMeters,status,condition',
                'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
              },
              body: JSON.stringify({
                origins: [
                  {
                    waypoint: {
                      location: {
                        latLng: { latitude: originLat, longitude: originLng },
                      },
                    },
                  },
                ],
                destinations: activePlaces.map((p: { lat: number; lng: number }) => ({
                  waypoint: {
                    location: {
                      latLng: { latitude: p.lat, longitude: p.lng },
                    },
                  },
                })),
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE',
              }),
            }
          );

          const matrixData = await matrixResponse.json();
          if (isQuotaError(matrixResponse.status, matrixData)) {
            res.status(429).json({
              error: 'Google Maps Platform quota exceeded while calculating travel routes.',
              quotaExceeded: true,
            });
            return;
          }

          if (matrixResponse.ok && Array.isArray(matrixData)) {
            for (const entry of matrixData) {
              const idx = entry?.destinationIndex;
              if (
                typeof idx === 'number' &&
                activePlaces[idx] &&
                entry.condition === 'ROUTE_EXISTS' &&
                typeof entry.distanceMeters === 'number'
              ) {
                activePlaces[idx].routeDistanceKm =
                  Math.round((entry.distanceMeters / 1000) * 10) / 10;
                const seconds = parseDurationSeconds(entry.duration);
                activePlaces[idx].routeDurationMinutes =
                  seconds !== null ? Math.max(1, Math.round(seconds / 60)) : null;
                activePlaces[idx].routeSource = 'routes-api';
              }
            }
          }
        } catch (matrixErr) {
          console.error('Routes Matrix non-fatal error (falling back to straight-line proximity):', matrixErr);
        }
      }

      // Final strict geographical proximity sort (using route distance where available, else straight-line distance)
      activePlaces.sort(
        (
          a: { routeDistanceKm: number | null; straightLineKm: number },
          b: { routeDistanceKm: number | null; straightLineKm: number }
        ) => {
          const distA = a.routeDistanceKm ?? a.straightLineKm;
          const distB = b.routeDistanceKm ?? b.straightLineKm;
          return distA - distB;
        }
      );

      res.json({ providers: activePlaces });
    } catch (error) {
      console.error('Providers proxy error:', error);
      res.status(500).json({ error: 'Unable to fetch nearby healthcare providers.' });
    }
  });

  // Discover real nearby accommodations ONLY when requested for a specific hospital
  app.post('/api/maps/accommodations', async (req: Request, res: Response) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'Google Maps Platform API key is not configured on the server.',
      });
      return;
    }

    const { hospitalLat, hospitalLng } = req.body ?? {};
    if (typeof hospitalLat !== 'number' || typeof hospitalLng !== 'number') {
      res.status(400).json({ error: 'Valid hospital coordinates are required.' });
      return;
    }

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.googleMapsUri,places.primaryTypeDisplayName,places.businessStatus',
          'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
        },
        body: JSON.stringify({
          includedTypes: ['hotel', 'lodging', 'guest_house'],
          maxResultCount: 6,
          rankPreference: 'DISTANCE',
          languageCode: 'en',
          regionCode: 'IN',
          locationRestriction: {
            circle: {
              center: { latitude: hospitalLat, longitude: hospitalLng },
              radius: 4000.0,
            },
          },
        }),
      });

      const data = await response.json();
      if (isQuotaError(response.status, data)) {
        res.status(429).json({
          error: 'Google Maps Platform quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      if (!response.ok) {
        res.status(response.status).json({
          error: data?.error?.message || 'Unable to search nearby accommodations.',
        });
        return;
      }

      const rawStays = Array.isArray(data.places) ? data.places : [];
      const accommodations = rawStays
        .filter(
          (p: { location?: { latitude?: number; longitude?: number }; businessStatus?: string }) =>
            p?.location?.latitude != null &&
            p?.location?.longitude != null &&
            p.businessStatus !== 'CLOSED_PERMANENTLY'
        )
        .map((p: {
          id: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location: { latitude: number; longitude: number };
          priceLevel?: string;
          googleMapsUri?: string;
          primaryTypeDisplayName?: { text?: string };
        }) => ({
          id: p.id,
          name: p.displayName?.text || 'Nearby Lodging',
          propertyType: p.primaryTypeDisplayName?.text || 'Lodging',
          address: p.formattedAddress || 'Address unavailable',
          lat: p.location.latitude,
          lng: p.location.longitude,
          distanceFromHospitalKm: haversineKm(
            hospitalLat,
            hospitalLng,
            p.location.latitude,
            p.location.longitude
          ),
          priceLevel: p.priceLevel || null,
          googleMapsUri: p.googleMapsUri || null,
        }))
        .sort(
          (a: { distanceFromHospitalKm: number }, b: { distanceFromHospitalKm: number }) =>
            a.distanceFromHospitalKm - b.distanceFromHospitalKm
        );

      res.json({ accommodations });
    } catch (error) {
      console.error('Accommodations proxy error:', error);
      res.status(500).json({ error: 'Unable to fetch nearby accommodations.' });
    }
  });

  // Server-proxied Google Maps Static API image so the API key never touches the browser
  app.get('/api/maps/static-map', async (req: Request, res: Response) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'GOOGLE_MAPS_API_KEY is not configured on the server.',
      });
      return;
    }

    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) {
      res.status(400).json({ error: 'Valid numeric originLat and originLng are required.' });
      return;
    }

    // Parse optional provider pins: "lat,lng,label,selected;..."
    const pinsParam = typeof req.query.pins === 'string' ? req.query.pins.trim() : '';
    const parsedPins: Array<{ lat: number; lng: number; label: string; selected: boolean }> = [];

    if (pinsParam) {
      const entries = pinsParam.split(';').slice(0, 15);
      for (const entry of entries) {
        const [latStr, lngStr, rawLabel, selStr] = entry.split(',');
        const lat = Number(latStr);
        const lng = Number(lngStr);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const cleanLabel = (rawLabel || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
        parsedPins.push({
          lat,
          lng,
          label: cleanLabel,
          selected: selStr === '1',
        });
      }
    }

    try {
      const params = new URLSearchParams({
        size: '640x360',
        scale: '2',
        maptype: 'roadmap',
        language: 'en',
        region: 'IN',
        solution_id: GMP_SOLUTION_ID,
        key: apiKey,
      });

      if (parsedPins.length === 0) {
        params.set('center', `${originLat},${originLng}`);
        params.set('zoom', '13');
      }

      // Starting location pin (Navy, labeled S)
      params.append('markers', `color:0x0F2A44|label:S|${originLat},${originLng}`);

      // Provider pins (Teal default, Red/Highlighted when selected)
      for (const pin of parsedPins) {
        const color = pin.selected ? '0xB91C1C' : '0x0F766E';
        const labelPart = pin.label ? `label:${pin.label}|` : '';
        params.append('markers', `color:${color}|${labelPart}${pin.lat},${pin.lng}`);
      }

      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
      const response = await fetch(staticMapUrl, {
        headers: { 'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID },
      });

      if (response.status === 429) {
        res.status(429).json({
          error: 'Google Maps Platform quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        res.status(response.status).json({
          error:
            errorText.trim() ||
            `Google Maps Static API returned HTTP ${response.status}. Ensure Maps Static API is enabled on your key.`,
        });
        return;
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=120');
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error('Static map proxy error:', error);
      res.status(500).json({ error: 'Unable to load map image from Google Maps Platform.' });
    }
  });

  // Never let unknown /api/* requests fall through to Vite/SPA index.html (200 HTML)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Mount Vite dev middleware or serve static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MedRoute server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MedRoute server:', err);
  process.exit(1);
});
