import { action } from "./_generated/server";
import { v } from "convex/values";

interface PlaceSuggestion {
  placeId: string;
  text: string;
}

interface AddressComponents {
  street?: string;
  buildingNumber?: string;
  city?: string;
  postalCode?: string;
}

export const searchAddresses = action({
  args: { input: v.string() },
  handler: async (_ctx, { input }): Promise<PlaceSuggestion[]> => {
    if (input.length < 3) return [];

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input,
          languageCode: "pl",
          regionCode: "PL",
          includedPrimaryTypes: ["street_address"],
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Places Autocomplete API error: ${err}`);
    }

    const data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.suggestions ?? []).map((s: any) => ({
      placeId: s.placePrediction.placeId as string,
      text: s.placePrediction.text.text as string,
    }));
  },
});

export const getPlaceDetails = action({
  args: { placeId: v.string() },
  handler: async (_ctx, { placeId }): Promise<AddressComponents> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pl`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "addressComponents",
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Places Details API error: ${err}`);
    }

    const data = await response.json();
    const components: Array<{ types: string[]; longText: string }> =
      data.addressComponents ?? [];

    const result: AddressComponents = {};

    for (const component of components) {
      const types = component.types;
      if (types.includes("route")) {
        result.street = component.longText;
      } else if (types.includes("street_number")) {
        result.buildingNumber = component.longText;
      } else if (types.includes("locality")) {
        result.city = component.longText;
      } else if (!result.city && types.includes("sublocality_level_1")) {
        result.city = component.longText;
      } else if (types.includes("postal_code")) {
        result.postalCode = component.longText;
      }
    }

    return result;
  },
});
