import Constants from "expo-constants";
import * as Location from "expo-location";

/** Suffixes tried in order — native geocoders often need city/country for partial addresses. */
const REGION_HINTS = ["", ", South Africa", ", ZA"];

/** Google `location_type` — lower rank = more accurate */
const LOCATION_TYPE_RANK = {
  ROOFTOP: 0,
  RANGE_INTERPOLATED: 1,
  GEOMETRIC_CENTER: 2,
  APPROXIMATE: 3,
};

function rankLocationType(t) {
  if (t == null) return 99;
  return LOCATION_TYPE_RANK[t] ?? 50;
}

function normalizeAddress(input) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueVariants(base) {
  const seen = new Set();
  const out = [];
  for (const hint of REGION_HINTS) {
    const v = (base + hint).trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Prefer `extra.googleGeocodingApiKey` when set — use a key with Geocoding API allowed and
 * Application restrictions set to "None" (Android-restricted keys often fail for HTTPS Geocoding).
 */
function getGoogleGeocodingKey() {
  const cfg = Constants.expoConfig;
  const extraKey = cfg?.extra?.googleGeocodingApiKey;
  if (extraKey && String(extraKey).trim()) {
    return String(extraKey).trim();
  }
  return (
    cfg?.android?.config?.googleMaps?.apiKey ||
    cfg?.ios?.config?.googleMaps?.apiKey ||
    null
  );
}

function googleApiError(status, apiMessage) {
  const e = new Error(apiMessage || status || "Geocoding request failed");
  e.code = `GOOGLE_${status}`;
  return e;
}

/**
 * @typedef {{ latitude: number, longitude: number, formattedAddress: string | null, locationType: string | null }} GeocodeCandidate
 */

/**
 * @returns {Promise<{ type: 'ok', candidates: GeocodeCandidate[] } | { type: 'zero' } | { type: 'skip' }>}
 */
async function geocodeWithGoogle(query) {
  const key = getGoogleGeocodingKey();
  if (!key) return { type: "skip" };

  const params = new URLSearchParams({
    address: query,
    key,
    region: "za",
    components: "country:ZA",
  });

  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status === "OK" && data.results?.length) {
    const candidates = data.results
      .slice(0, 8)
      .map((r) => ({
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        formattedAddress: r.formatted_address ?? null,
        locationType: r.geometry?.location_type ?? null,
      }))
      .sort(
        (a, b) =>
          rankLocationType(a.locationType) - rankLocationType(b.locationType)
      );

    return { type: "ok", candidates };
  }

  if (data.status === "ZERO_RESULTS") {
    return { type: "zero" };
  }

  throw googleApiError(data.status, data.error_message);
}

/**
 * Forward-geocode a free-text address (Google when key present, then native geocoder).
 * @param {string} rawAddress
 * @returns {Promise<{ results: import('expo-location').LocationGeocodedLocation[], queryUsed: string, candidates: GeocodeCandidate[] }>}
 */
export async function geocodeAddressString(rawAddress) {
  const base = normalizeAddress(rawAddress);
  if (!base) {
    throw new Error("EMPTY_ADDRESS");
  }

  const variants = uniqueVariants(base);
  const hasGoogleKey = !!getGoogleGeocodingKey();
  let lastNativeError = null;

  for (const query of variants) {
    if (hasGoogleKey) {
      try {
        const g = await geocodeWithGoogle(query);
        if (g.type === "ok" && g.candidates?.length) {
          const { candidates } = g;
          const results = candidates.map((c) => ({
            latitude: c.latitude,
            longitude: c.longitude,
          }));
          return { results, queryUsed: query, candidates };
        }
      } catch (e) {
        if (
          e?.code === "GOOGLE_REQUEST_DENIED" ||
          e?.code === "GOOGLE_OVER_QUERY_LIMIT"
        ) {
          throw e;
        }
      }
    }

    try {
      const results = await Location.geocodeAsync(query);
      if (results?.length > 0) {
        const candidates = results.map((r) => ({
          latitude: r.latitude,
          longitude: r.longitude,
          formattedAddress: null,
          locationType: null,
        }));
        return { results, queryUsed: query, candidates };
      }
    } catch (e) {
      lastNativeError = e;
    }
  }

  if (lastNativeError) throw lastNativeError;
  throw new Error("ZERO_RESULTS");
}
