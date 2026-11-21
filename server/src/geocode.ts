export type Geocode = (lat: number, lng: number) => Promise<string | null>;

const NAME_KEYS = ["amenity", "building", "tourism", "shop", "office", "leisure", "residential", "neighbourhood", "suburb", "road"];
const CITY_KEYS = ["city", "town", "village", "municipality", "state"];

/** Turns coordinates into a short place name such as "Dubai World Trade Centre, Dubai" using OpenStreetMap Nominatim (free, max 1 request/second). */
export const nominatimReverse: Geocode = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&accept-language=en`, {
      headers: { "user-agent": "we-just-met-poc/0.1" }, signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const a = ((await res.json()) as { address?: Record<string, string> }).address ?? {};
    const pick = (keys: string[]) => keys.map((k) => a[k]).find(Boolean);
    const name = pick(NAME_KEYS), city = pick(CITY_KEYS);
    return [name, city !== name ? city : undefined].filter(Boolean).join(", ").slice(0, 200) || null;
  } catch {
    return null;
  }
};
