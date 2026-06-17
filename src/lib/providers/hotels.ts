import type { HotelOption, TravelRequest } from "../types";
import { liteapiConfigured, liteapiGet, liteapiPost } from "./liteapi";

// ---------------------------------------------------------------------------
// LiteAPI Hotels (two-step):
//  1. GET  /data/hotels   -> metadata (id, name, stars, rating, photo)
//  2. POST /hotels/rates  -> live prices keyed by hotelId
// ---------------------------------------------------------------------------
interface LiteHotelMeta {
  id: string;
  name: string;
  stars?: number;
  rating?: number;
  reviewCount?: number;
  main_photo?: string;
  thumbnail?: string;
  city?: string;
}
interface LiteHotelListResponse {
  data?: LiteHotelMeta[];
}

interface LiteRate {
  name?: string;
  boardName?: string;
}
interface LiteRoomType {
  rates?: LiteRate[];
  offerRetailRate?: { amount?: number; currency?: string };
}
interface LiteRatesResponse {
  data?: Array<{ hotelId: string; roomTypes?: LiteRoomType[] }>;
}

async function fetchLiteHotels(req: TravelRequest): Promise<HotelOption[]> {
  if (!liteapiConfigured()) {
    throw new Error(
      "LITEAPI_API_KEY is not configured. The Hotel Agent requires live LiteAPI data."
    );
  }
  // 1. Hotel metadata for the destination city.
  const list = await liteapiGet<LiteHotelListResponse>("/data/hotels", {
    countryCode: req.destinationCountry,
    cityName: req.destinationCity,
    limit: 15,
  });
  const metas = list?.data ?? [];
  if (!metas.length) {
    throw new Error(`No hotels found in ${req.destinationCity}, ${req.destinationCountry}.`);
  }

  const metaById = new Map(metas.map((m) => [m.id, m]));
  const hotelIds = metas.slice(0, 12).map((m) => m.id);

  // 2. Live rates for those hotels.
  const rates = await liteapiPost<LiteRatesResponse>("/hotels/rates", {
    hotelIds,
    occupancies: [{ adults: Math.min(Math.max(req.travelers, 1), 4) }],
    currency: req.currency,
    guestNationality: "IN",
    checkin: req.departDate,
    checkout: req.returnDate,
    roomMapping: false,
    timeout: 8,
  });

  const nights = Math.max(1, req.days - 1);
  const priced = rates?.data ?? [];
  if (!priced.length) {
    throw new Error(
      `No available hotel rates in ${req.destinationCity} for ${req.departDate} → ${req.returnDate}.`
    );
  }

  const options: HotelOption[] = [];
  for (const p of priced) {
    const meta = metaById.get(p.hotelId);
    const offer = (p.roomTypes ?? [])
      .map((rt) => rt.offerRetailRate?.amount ?? Infinity)
      .sort((a, b) => a - b)[0];
    if (!offer || offer === Infinity) continue;
    const best = (p.roomTypes ?? []).find(
      (rt) => rt.offerRetailRate?.amount === offer
    );
    const total = Math.round(offer);
    options.push({
      id: p.hotelId,
      name: meta?.name ?? "Hotel",
      area: req.destinationCity,
      rating: meta?.stars ?? meta?.rating ?? 4,
      reviewCount: meta?.reviewCount,
      photo: meta?.main_photo ?? meta?.thumbnail,
      board: best?.rates?.[0]?.boardName,
      pricePerNight: Math.round(total / nights),
      nights,
      totalPrice: total,
      currency: best?.offerRetailRate?.currency ?? req.currency,
      source: "liteapi",
    });
  }
  if (!options.length) {
    throw new Error("LiteAPI returned hotels but none had a bookable rate.");
  }
  return options;
}

/**
 * Returns ranked hotel options (price ascending) from live LiteAPI data.
 * Throws if no live data is available — there is no sample fallback.
 */
export async function searchHotels(req: TravelRequest): Promise<HotelOption[]> {
  const options = await fetchLiteHotels(req);
  return options.sort((a, b) => a.totalPrice - b.totalPrice);
}
