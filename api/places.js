export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, type, radius } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'Missing lat/lng' });

  const body = {
    includedTypes: [type || 'restaurant'],
    maxResultCount: 10,
    locationRestriction: {
      circle: {
        center: { latitude: +lat, longitude: +lng },
        radius: +(radius || 1000),
      },
    },
    rankPreference: 'POPULARITY',
  };

  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.photos',
        'places.regularOpeningHours',
        'places.googleMapsUri',
        'places.editorialSummary',
        'places.location',
      ].join(','),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  res.status(response.ok ? 200 : 500).json(data);
}