// js/places.js
// Google Maps Places API (New) — Nearby Search
// Uses fetch directly (no SDK needed), entirely free within $200/month credit

const PLACE_TYPES = {
  'All':      'restaurant',
  'Japanese': 'japanese_restaurant',
  'Korean':   'korean_restaurant',
  'Chinese':  'chinese_restaurant',
  'Western':  'american_restaurant',
  'Thai':     'thai_restaurant',
  'Indian':   'indian_restaurant',
  'Italian':  'italian_restaurant',
  'Seafood':  'seafood_restaurant',
  'Cafe':     'cafe',
};

const PRICE_LABELS = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

/**
 * Get browser GPS location as { lat, lng }
 */
export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by your browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(new Error('Location access denied. Please allow location and try again.')),
      { timeout: 10000 }
    );
  });
}

/**
 * Fetch nearby restaurants using Places API (New) — Nearby Search
 * Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search
 *
 * @param {string} apiKey      - Google Maps API key
 * @param {{ lat, lng }} coords - centre of search
 * @param {string} cuisine     - one of the PLACE_TYPES keys
 * @param {number} radius      - search radius in metres
 * @param {number} count       - how many to return (max 20)
 */
export async function fetchNearbyRestaurants(apiKey, coords, cuisine = 'All', radius = 1000, count = 8) {
  const type = PLACE_TYPES[cuisine] || 'restaurant';
  const url = `/api/places?lat=${coords.lat}&lng=${coords.lng}&type=${type}&radius=${radius}&count=${count}`;

  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Places API error ${res.status}`);
  }

  const data = await res.json();
  const places = data.places || [];

  return places.map(p => ({
    id: p.id,
    name: p.displayName?.text || 'Unknown',
    address: p.formattedAddress || '',
    rating: p.rating ? Number(p.rating.toFixed(1)) : null,
    ratingCount: p.userRatingCount || 0,
    price: PRICE_LABELS[p.priceLevel] || null,
    types: p.types || [],
    photoRef: p.photos?.[0]?.name || null,
    isOpen: p.regularOpeningHours?.openNow ?? null,
    mapsUri: p.googleMapsUri || null,
    summary: p.editorialSummary?.text || null,
  }));
}

/**
 * Build a photo URL from a place photo resource name.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-photos
 *
 * @param {string} photoName  - e.g. "places/ChIJ.../photos/AXCi2y..."
 * @param {string} apiKey
 * @param {number} maxWidth   - pixel width (default 600)
 */
export function buildPhotoUrl(photoName, apiKey, maxWidth = 600) {
  if (!photoName) return null;
  return `/api/photo?name=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}`;
}