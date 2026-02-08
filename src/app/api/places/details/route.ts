import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Location } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('placeId');
  const name = searchParams.get('name'); // Place name from autocomplete

  if (!placeId) {
    return NextResponse.json(
      { error: 'placeId is required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY is not configured');
    return NextResponse.json(
      { error: 'Google Places API is not configured' },
      { status: 500 }
    );
  }

  try {
    // Use Google Places Details API to get coordinates
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', apiKey);
    // Only request the fields we need to minimize API costs
    url.searchParams.set('fields', 'place_id,formatted_address,geometry');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places Details API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: 'Failed to fetch place details' },
        { status: 500 }
      );
    }

    const result = data.result;
    const location: Location = {
      placeId: result.place_id,
      name: name || result.formatted_address, // Use provided name, fallback to address
      formattedAddress: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };

    return NextResponse.json({ location });
  } catch (error) {
    console.error('Error fetching place details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch place details' },
      { status: 500 }
    );
  }
}
