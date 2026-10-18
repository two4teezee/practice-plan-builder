// Drill sketches are stored as JSON ({ strokes, rinkView, placedObjects, imagePreview }),
// where imagePreview is a full-size PNG data URL. Very old sketches are a bare data URL.

// Wide enough to stay sharp in the largest card on a high-density screen
const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_QUALITY = 0.85;

export function getSketchImagePreview(sketchData?: string | null): string | null {
  if (!sketchData) return null;
  try {
    const data = JSON.parse(sketchData);
    return data.imagePreview || null;
  } catch {
    return sketchData.startsWith('data:') ? sketchData : null;
  }
}

// A small JPEG of the sketch for drill cards, or '' when there's no sketch to draw.
// Browser only (uses a canvas).
export async function createSketchThumbnail(sketchData?: string | null): Promise<string> {
  const preview = getSketchImagePreview(sketchData);
  if (!preview || typeof document === 'undefined') return '';
  try {
    const image = new Image();
    image.src = preview;
    await image.decode();
    const scale = Math.min(1, THUMBNAIL_WIDTH / image.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    // JPEG has no transparency; match the white card background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY);
  } catch (error) {
    console.warn('Could not create sketch thumbnail:', error);
    return '';
  }
}
