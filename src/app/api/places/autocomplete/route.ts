import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input');

  if (!input || input.trim().length < 2) {
    return NextResponse.json({ predictions: [] });
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
    // Use Google Places Autocomplete API
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    // Focus on establishments and addresses (arenas, parks, etc.)
    url.searchParams.set('types', 'establishment|geocode');
    
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: 'Failed to fetch place predictions' },
        { status: 500 }
      );
    }

    const predictions: PlacePrediction[] = (data.predictions || []).map(
      (prediction: {
        place_id: string;
        description: string;
        structured_formatting?: {
          main_text?: string;
          secondary_text?: string;
        };
      }) => ({
        placeId: prediction.place_id,
        description: prediction.description,
        mainText: prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || '',
      })
    );

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error('Error fetching place predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch place predictions' },
      { status: 500 }
    );
  }
}
