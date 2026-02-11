'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Save, X, Eraser, Pencil, Minus, SplineIcon, GitBranch, MousePointer2, Trash2 } from 'lucide-react';

interface DrillSketchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sketchData: string) => void;
  initialSketchData?: string;
}

type RinkView = 'full' | 'half' | 'neutral' | 'quarter';
type LineColor = 'blue' | 'red' | 'black' | 'gray';
type LineType = 'solid' | 'dashed' | 'double' | 'squiggly';
type DrawMode = 'freehand' | 'line' | 'curve' | 'polyline';
type PlaceableType = 'player' | 'cone' | 'net' | 'smallNet' | 'pucks';
type PlayerColor = 'blue' | 'red' | 'black' | 'gray';
type PlayerMarkerType = 'plain' | 'numbered' | 'F' | 'D' | 'G' | 'Fx' | 'Dx' | 'Xx' | 'Ox' | 'X' | 'O' | 'C' | 'LW' | 'RW';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  points: Point[];
  color: string;
  lineType: LineType;
  lineWidth: number;
  drawMode: DrawMode;
}

interface PlacedObject {
  id: string;
  type: PlaceableType;
  x: number;
  y: number;
  rotation?: number; // Radians, for rotatable objects (nets)
  playerNumber?: number; // Legacy: 1-5 for player type, 0 for coach
  playerColor?: PlayerColor; // blue, red, black, or gray for player type
  playerMarkerType?: PlayerMarkerType; // New: type of marker (plain, numbered, F, D, G, Fx, Dx, Xx, Ox)
  playerSequence?: number; // For auto-numbered types (numbered, Fx, Dx, Xx, Ox)
  puckOffsets?: Array<{ dx: number; dy: number }>; // Random offsets for puck pile
}

const COLOR_MAP: Record<LineColor, string> = {
  blue: '#2563EB',
  red: '#DC2626',
  black: '#1F2937',
  gray: '#6B7280',
};

// NHL Rink Dimensions (in feet)
const NHL = {
  rinkLength: 200,
  rinkWidth: 85,
  cornerRadius: 28,
  goalLineFromEnd: 11,
  blueLineFromGoalLine: 64,  // 75 ft from end boards
  centerCircleRadius: 15,    // 30 ft diameter
  faceOffCircleRadius: 15,   // 30 ft diameter
  faceOffDotRadius: 1,       // 2 ft diameter
  faceOffDotsFromCenter: 22, // lateral distance from center
  faceOffDotsFromGoalLine: 20,
  goalWidth: 6,
  goalDepth: 3.33,           // ~40 inches
  creaseRadius: 6,           // Extends 6 ft from goal line (actually 4.5 ft but 6ft for the full arc)
  creaseWidth: 8,            // 8 ft wide crease
  neutralZoneDotFromBlue: 5,
};

const NET_DIMENSIONS = {
  net: { width: 30, height: 20 },
  smallNet: { width: 18, height: 12 },
};

const NET_ROTATION_HANDLE_OFFSET = 10;
const NET_ROTATION_HANDLE_RADIUS = 4;

export function DrillSketchModal({ isOpen, onClose, onSave, initialSketchData }: DrillSketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rinkView, setRinkView] = useState<RinkView>('half');
  const [lineColor, setLineColor] = useState<LineColor>('black');
  const [lineType, setLineType] = useState<LineType>('solid');
  const [drawMode, setDrawMode] = useState<DrawMode>('freehand');
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [lineStartPoint, setLineStartPoint] = useState<Point | null>(null);
  const [curvePoints, setCurvePoints] = useState<Point[]>([]); // For curve mode: start, control, end
  const [polylinePoints, setPolylinePoints] = useState<Point[]>([]); // For polyline mode: multiple connected points
  
  // Placeable objects state
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [isPlaceMode, setIsPlaceMode] = useState(false);
  const [placeableType, setPlaceableType] = useState<PlaceableType>('player');
  const [playerColor, setPlayerColor] = useState<PlayerColor>('blue');
  const [playerMarkerType, setPlayerMarkerType] = useState<PlayerMarkerType>('numbered');
  
  // Auto-increment counters for each color and marker type
  // Key format: "color-markerType" e.g., "blue-numbered", "red-Fx"
  const [markerCounters, setMarkerCounters] = useState<Record<string, number>>({});
  
  // Selection state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [isDraggingStroke, setIsDraggingStroke] = useState(false);
  const [isRotatingObject, setIsRotatingObject] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [rotateStartAngle, setRotateStartAngle] = useState(0);
  const [rotateStartRotation, setRotateStartRotation] = useState(0);

  const resetSketchState = useCallback(() => {
    setRinkView('half');
    setLineColor('black');
    setLineType('solid');
    setDrawMode('freehand');
    setIsDrawing(false);
    setStrokes([]);
    setCurrentStroke([]);
    setLineStartPoint(null);
    setCurvePoints([]);
    setPolylinePoints([]);
    setPlacedObjects([]);
    setIsPlaceMode(false);
    setPlaceableType('player');
    setPlayerColor('blue');
    setPlayerMarkerType('numbered');
    setMarkerCounters({});
    setIsSelectMode(false);
    setSelectedObjectId(null);
    setSelectedStrokeId(null);
    setIsDraggingObject(false);
    setIsDraggingStroke(false);
    setIsRotatingObject(false);
    setDragOffset({ x: 0, y: 0 });
    setDragStartPoint(null);
    setRotateStartAngle(0);
    setRotateStartRotation(0);
  }, []);
  
  // Canvas dimensions - maintain proper NHL aspect ratios
  // Full rink: 200 x 85 ft = 2.35:1 ratio
  // Half rink: ~80 x 85 ft (goal line to past blue line) = ~0.94:1 ratio
  // Neutral zone: ~50 x 85 ft (between blue lines) = ~0.59:1 ratio
  // Quarter ice: ~40 x 42.5 ft (half width, offensive zone) = ~0.94:1 ratio
  const CANVAS_WIDTH_FULL = 1000; // Wider for better visibility
  const CANVAS_HEIGHT_FULL = Math.round(1000 * (NHL.rinkWidth / NHL.rinkLength)); // ~425px
  const CANVAS_WIDTH_HALF = 550; // Smaller width to fit in modal
  const CANVAS_HEIGHT_HALF = Math.round(550 * (80 / NHL.rinkWidth)); // ~518px, maintains proper aspect
  const CANVAS_WIDTH_NEUTRAL = 550; // Same width as half rink
  const CANVAS_HEIGHT_NEUTRAL = Math.round(550 * (50 / NHL.rinkWidth)); // ~324px for neutral zone
  const CANVAS_WIDTH_QUARTER = 400; // Smaller for quarter ice
  const CANVAS_HEIGHT_QUARTER = Math.round(400 * (50 / (NHL.rinkWidth / 2))); // ~471px, half width, 50ft depth
  
  const getCanvasDimensions = () => {
    switch (rinkView) {
      case 'full':
        return { width: CANVAS_WIDTH_FULL, height: CANVAS_HEIGHT_FULL };
      case 'half':
        return { width: CANVAS_WIDTH_HALF, height: CANVAS_HEIGHT_HALF };
      case 'neutral':
        return { width: CANVAS_WIDTH_NEUTRAL, height: CANVAS_HEIGHT_NEUTRAL };
      case 'quarter':
        return { width: CANVAS_WIDTH_QUARTER, height: CANVAS_HEIGHT_QUARTER };
      default:
        return { width: CANVAS_WIDTH_HALF, height: CANVAS_HEIGHT_HALF };
    }
  };
  
  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();

  // Load initial sketch data
  useEffect(() => {
    if (!isOpen) return;
    if (initialSketchData) {
      try {
        const data = JSON.parse(initialSketchData);
        if (data.strokes) {
          setStrokes(data.strokes);
        }
        if (data.rinkView) {
          setRinkView(data.rinkView);
        }
        if (data.placedObjects) {
          setPlacedObjects(data.placedObjects);
          
          // Reconstruct marker counters from placed objects
          const counters: Record<string, number> = {};
          const autoNumberedTypes: PlayerMarkerType[] = ['numbered', 'Fx', 'Dx', 'Xx', 'Ox'];
          
          for (const obj of data.placedObjects as PlacedObject[]) {
            if (obj.type === 'player' && obj.playerMarkerType && obj.playerSequence) {
              if (autoNumberedTypes.includes(obj.playerMarkerType)) {
                const key = `${obj.playerColor}-${obj.playerMarkerType}`;
                counters[key] = Math.max(counters[key] || 0, obj.playerSequence);
              }
            }
          }
          setMarkerCounters(counters);
        }
      } catch {
        // Invalid data, start fresh
        resetSketchState();
      }
    } else {
      resetSketchState();
    }
  }, [initialSketchData, isOpen, resetSketchState]);

  // Draw hockey rink with NHL-accurate proportions
  const drawRink = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, view: RinkView) => {
    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    const padding = 20;
    const rinkPixelWidth = width - padding * 2;
    const rinkPixelHeight = height - padding * 2;
    
    if (view === 'full') {
      // Full rink: scale based on 200 ft length
      const scale = rinkPixelWidth / NHL.rinkLength;
      const actualRinkHeight = NHL.rinkWidth * scale;
      const verticalOffset = (rinkPixelHeight - actualRinkHeight) / 2;
      
      const rinkTop = padding + verticalOffset;
      const rinkBottom = rinkTop + actualRinkHeight;
      const rinkLeft = padding;
      const rinkRight = width - padding;
      const rinkCenterX = width / 2;
      const rinkCenterY = rinkTop + actualRinkHeight / 2;
      
      // Corner radius - use 20 ft for better visual appearance (NHL is 28 ft)
      const cornerRadius = 20 * scale;
      
      // Draw rink outline using arcTo for proper circular corners
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rinkLeft + cornerRadius, rinkTop);
      ctx.lineTo(rinkRight - cornerRadius, rinkTop);
      ctx.arcTo(rinkRight, rinkTop, rinkRight, rinkTop + cornerRadius, cornerRadius);
      ctx.lineTo(rinkRight, rinkBottom - cornerRadius);
      ctx.arcTo(rinkRight, rinkBottom, rinkRight - cornerRadius, rinkBottom, cornerRadius);
      ctx.lineTo(rinkLeft + cornerRadius, rinkBottom);
      ctx.arcTo(rinkLeft, rinkBottom, rinkLeft, rinkBottom - cornerRadius, cornerRadius);
      ctx.lineTo(rinkLeft, rinkTop + cornerRadius);
      ctx.arcTo(rinkLeft, rinkTop, rinkLeft + cornerRadius, rinkTop, cornerRadius);
      ctx.closePath();
      ctx.fillStyle = '#F0F9FF';
      ctx.fill();
      ctx.stroke();
      
      // Center red line
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = Math.max(3, scale * 1);
      ctx.beginPath();
      ctx.moveTo(rinkCenterX, rinkTop);
      ctx.lineTo(rinkCenterX, rinkBottom);
      ctx.stroke();
      
      // Center ice circle (15 ft radius)
      const centerCircleRadius = NHL.centerCircleRadius * scale;
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rinkCenterX, rinkCenterY, centerCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Center dot
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(rinkCenterX, rinkCenterY, Math.max(3, NHL.faceOffDotRadius * scale), 0, Math.PI * 2);
      ctx.fill();
      
      // Blue lines (75 ft from end = 25 ft from center)
      const blueLineFromCenter = 25 * scale;
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = Math.max(3, scale * 1);
      
      ctx.beginPath();
      ctx.moveTo(rinkCenterX - blueLineFromCenter, rinkTop);
      ctx.lineTo(rinkCenterX - blueLineFromCenter, rinkBottom);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(rinkCenterX + blueLineFromCenter, rinkTop);
      ctx.lineTo(rinkCenterX + blueLineFromCenter, rinkBottom);
      ctx.stroke();
      
      // Goal lines (11 ft from end boards)
      // Need to calculate proper Y bounds accounting for corner curves
      const goalLineFromEnd = NHL.goalLineFromEnd * scale;
      
      // Helper to get Y bounds at a given X position (accounting for corners)
      const getYBoundsAtX = (x: number): { top: number; bottom: number } => {
        // Check if we're in the left corner region
        if (x < rinkLeft + cornerRadius) {
          const dx = (rinkLeft + cornerRadius) - x;
          const dy = Math.sqrt(cornerRadius * cornerRadius - dx * dx);
          return {
            top: (rinkTop + cornerRadius) - dy,
            bottom: (rinkBottom - cornerRadius) + dy,
          };
        }
        // Check if we're in the right corner region
        if (x > rinkRight - cornerRadius) {
          const dx = x - (rinkRight - cornerRadius);
          const dy = Math.sqrt(cornerRadius * cornerRadius - dx * dx);
          return {
            top: (rinkTop + cornerRadius) - dy,
            bottom: (rinkBottom - cornerRadius) + dy,
          };
        }
        // In the straight middle section
        return { top: rinkTop, bottom: rinkBottom };
      };
      
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      
      // Left goal line
      const leftGoalLineX = rinkLeft + goalLineFromEnd;
      const leftBounds = getYBoundsAtX(leftGoalLineX);
      ctx.beginPath();
      ctx.moveTo(leftGoalLineX, leftBounds.top);
      ctx.lineTo(leftGoalLineX, leftBounds.bottom);
      ctx.stroke();
      
      // Right goal line
      const rightGoalLineX = rinkRight - goalLineFromEnd;
      const rightBounds = getYBoundsAtX(rightGoalLineX);
      ctx.beginPath();
      ctx.moveTo(rightGoalLineX, rightBounds.top);
      ctx.lineTo(rightGoalLineX, rightBounds.bottom);
      ctx.stroke();
      
      // Goals and creases
      const goalWidth = NHL.goalWidth * scale;
      const goalDepth = NHL.goalDepth * scale;
      const creaseRadius = NHL.creaseRadius * scale;
      
      // Left goal crease (semicircle)
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rinkLeft + goalLineFromEnd, rinkCenterY, creaseRadius, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      
      // Left goal (net outline)
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#FECACA';
      ctx.beginPath();
      ctx.rect(rinkLeft + goalLineFromEnd - goalDepth, rinkCenterY - goalWidth / 2, goalDepth, goalWidth);
      ctx.fill();
      ctx.stroke();
      
      // Right goal crease
      ctx.beginPath();
      ctx.arc(rinkRight - goalLineFromEnd, rinkCenterY, creaseRadius, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
      
      // Right goal
      ctx.beginPath();
      ctx.rect(rinkRight - goalLineFromEnd, rinkCenterY - goalWidth / 2, goalDepth, goalWidth);
      ctx.fill();
      ctx.stroke();
      
      // Face-off circles in zones (15 ft radius, positioned 20 ft from goal line, 22 ft from center)
      const faceOffCircleRadius = NHL.faceOffCircleRadius * scale;
      const faceOffFromGoalLine = NHL.faceOffDotsFromGoalLine * scale;
      const faceOffFromCenter = NHL.faceOffDotsFromCenter * scale;
      
      const leftFaceOffX = rinkLeft + goalLineFromEnd + faceOffFromGoalLine;
      const rightFaceOffX = rinkRight - goalLineFromEnd - faceOffFromGoalLine;
      const faceOffY1 = rinkCenterY - faceOffFromCenter;
      const faceOffY2 = rinkCenterY + faceOffFromCenter;
      
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      
      // Left zone face-off circles
      ctx.beginPath();
      ctx.arc(leftFaceOffX, faceOffY1, faceOffCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(leftFaceOffX, faceOffY2, faceOffCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Right zone face-off circles
      ctx.beginPath();
      ctx.arc(rightFaceOffX, faceOffY1, faceOffCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightFaceOffX, faceOffY2, faceOffCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw hash marks on face-off circles (full rink view)
      // Hash marks are at the TOP and BOTTOM of each circle (facing the boards)
      // Two parallel vertical lines on each side, OUTSIDE the circle only
      const hashLineLength = 3 * scale; // Length of each hash line (outside circle)
      const hashSpacing = 2 * scale; // Space between the two parallel lines
      
      const drawFullRinkHashMarks = (centerX: number, centerY: number, radius: number) => {
        // Top side (toward top boards) and Bottom side (toward bottom boards)
        const sides = [
          { y: centerY - radius, dir: -1 }, // top side
          { y: centerY + radius, dir: 1 },  // bottom side
        ];
        
        sides.forEach(({ y, dir }) => {
          // Two parallel vertical lines (parallel to goal line)
          // Lines extend OUTSIDE the circle only
          ctx.beginPath();
          ctx.moveTo(centerX - hashSpacing / 2, y);
          ctx.lineTo(centerX - hashSpacing / 2, y + hashLineLength * dir);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(centerX + hashSpacing / 2, y);
          ctx.lineTo(centerX + hashSpacing / 2, y + hashLineLength * dir);
          ctx.stroke();
        });
      };
      
      // Draw hash marks for all 4 zone face-off circles
      drawFullRinkHashMarks(leftFaceOffX, faceOffY1, faceOffCircleRadius);
      drawFullRinkHashMarks(leftFaceOffX, faceOffY2, faceOffCircleRadius);
      drawFullRinkHashMarks(rightFaceOffX, faceOffY1, faceOffCircleRadius);
      drawFullRinkHashMarks(rightFaceOffX, faceOffY2, faceOffCircleRadius);
      
      // Face-off dots (center of circles)
      const dotRadius = Math.max(3, NHL.faceOffDotRadius * scale);
      ctx.fillStyle = '#DC2626';
      
      [leftFaceOffX, rightFaceOffX].forEach(x => {
        [faceOffY1, faceOffY2].forEach(y => {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      
      // Neutral zone face-off dots (5 ft from blue lines, 22 ft from center)
      const neutralDotFromBlue = NHL.neutralZoneDotFromBlue * scale;
      const leftNeutralDotX = rinkCenterX - blueLineFromCenter + neutralDotFromBlue;
      const rightNeutralDotX = rinkCenterX + blueLineFromCenter - neutralDotFromBlue;
      
      [leftNeutralDotX, rightNeutralDotX].forEach(x => {
        [faceOffY1, faceOffY2].forEach(y => {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      
    } else if (view === 'half') {
      // Half rink view (offensive zone) - show from behind goal to past blue line
      // We'll show ~80 ft of length (11 behind goal + 64 to blue + 5 into neutral zone)
      const halfRinkLength = 80;
      const scale = rinkPixelWidth / NHL.rinkWidth; // Scale based on width (85 ft)
      
      // Adjust if rink would be taller than canvas
      const effectiveScale = Math.min(scale, rinkPixelHeight / halfRinkLength);
      const actualRinkWidth = NHL.rinkWidth * effectiveScale;
      const actualRinkDepth = halfRinkLength * effectiveScale;
      
      const horizontalOffset = (rinkPixelWidth - actualRinkWidth) / 2;
      const verticalOffset = (rinkPixelHeight - actualRinkDepth) / 2;
      
      const rinkLeft = padding + horizontalOffset;
      const rinkRight = rinkLeft + actualRinkWidth;
      const rinkTop = padding + verticalOffset;
      const rinkBottom = rinkTop + actualRinkDepth;
      const rinkCenterX = (rinkLeft + rinkRight) / 2;
      
      // Position of key lines from rinkTop
      const goalLineY = rinkTop + NHL.goalLineFromEnd * effectiveScale;
      const blueLineY = rinkTop + (NHL.goalLineFromEnd + NHL.blueLineFromGoalLine) * effectiveScale;
      
      // Corner radius - NHL is 28 ft, but visually scale it slightly smaller for better appearance
      const cornerRadius = 20 * effectiveScale; // Slightly reduced for visual clarity
      
      // Helper function to get X position at a given Y within the corner curve
      const getCornerX = (y: number, isLeft: boolean): number => {
        const cornerCenterX = isLeft ? rinkLeft + cornerRadius : rinkRight - cornerRadius;
        const cornerCenterY = rinkTop + cornerRadius;
        
        if (y >= cornerCenterY) {
          // Below the curve, straight edge
          return isLeft ? rinkLeft : rinkRight;
        }
        
        // Within the curve - calculate X on the arc
        const dy = cornerCenterY - y;
        if (dy > cornerRadius) {
          return cornerCenterX; // Above the curve entirely
        }
        const dx = Math.sqrt(cornerRadius * cornerRadius - dy * dy);
        return isLeft ? cornerCenterX - dx : cornerCenterX + dx;
      };
      
      // Draw rink outline (only top corners rounded)
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rinkLeft + cornerRadius, rinkTop);
      ctx.lineTo(rinkRight - cornerRadius, rinkTop);
      ctx.arcTo(rinkRight, rinkTop, rinkRight, rinkTop + cornerRadius, cornerRadius);
      ctx.lineTo(rinkRight, rinkBottom);
      ctx.lineTo(rinkLeft, rinkBottom);
      ctx.lineTo(rinkLeft, rinkTop + cornerRadius);
      ctx.arcTo(rinkLeft, rinkTop, rinkLeft + cornerRadius, rinkTop, cornerRadius);
      ctx.closePath();
      ctx.fillStyle = '#F0F9FF';
      ctx.fill();
      ctx.stroke();
      
      // Blue line
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = Math.max(3, effectiveScale * 1);
      ctx.beginPath();
      ctx.moveTo(rinkLeft, blueLineY);
      ctx.lineTo(rinkRight, blueLineY);
      ctx.stroke();
      
      // Goal line - calculate proper X bounds accounting for corner curve
      const goalLineLeftX = getCornerX(goalLineY, true);
      const goalLineRightX = getCornerX(goalLineY, false);
      
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(goalLineLeftX, goalLineY);
      ctx.lineTo(goalLineRightX, goalLineY);
      ctx.stroke();
      
      // Goal crease (6 ft radius semicircle)
      const creaseRadius = NHL.creaseRadius * effectiveScale;
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rinkCenterX, goalLineY, creaseRadius, 0, Math.PI);
      ctx.stroke();
      
      // Goal (6 ft wide x 3.33 ft deep)
      const goalWidth = NHL.goalWidth * effectiveScale;
      const goalDepth = NHL.goalDepth * effectiveScale;
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#FECACA';
      ctx.beginPath();
      ctx.rect(rinkCenterX - goalWidth / 2, goalLineY - goalDepth, goalWidth, goalDepth);
      ctx.fill();
      ctx.stroke();
      
      // Face-off circles (15 ft radius, 20 ft from goal line, 22 ft from center)
      const faceOffCircleRadius = NHL.faceOffCircleRadius * effectiveScale;
      const faceOffFromGoalLine = NHL.faceOffDotsFromGoalLine * effectiveScale;
      const faceOffFromCenter = NHL.faceOffDotsFromCenter * effectiveScale;
      
      const faceOffY = goalLineY + faceOffFromGoalLine;
      const faceOffXLeft = rinkCenterX - faceOffFromCenter;
      const faceOffXRight = rinkCenterX + faceOffFromCenter;
      
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      
      // Draw face-off circles
      ctx.beginPath();
      ctx.arc(faceOffXLeft, faceOffY, faceOffCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(faceOffXRight, faceOffY, faceOffCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw hash marks on face-off circles (half rink view)
      // Hash marks are at the LEFT and RIGHT sides of each circle
      // Two parallel HORIZONTAL lines on each side, OUTSIDE the circle only
      const hashLineLength = 3 * effectiveScale; // Length of each hash line (outside circle)
      const hashSpacing = 2 * effectiveScale; // Space between the two parallel lines
      
      const drawHashMarks = (centerX: number, centerY: number, radius: number) => {
        // Left side and Right side of each circle
        const sides = [
          { x: centerX - radius, dir: -1 }, // left side
          { x: centerX + radius, dir: 1 },  // right side
        ];
        
        sides.forEach(({ x, dir }) => {
          // Two parallel HORIZONTAL lines (parallel to goal line)
          // Lines extend OUTSIDE the circle only
          ctx.beginPath();
          ctx.moveTo(x, centerY - hashSpacing / 2);
          ctx.lineTo(x + hashLineLength * dir, centerY - hashSpacing / 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(x, centerY + hashSpacing / 2);
          ctx.lineTo(x + hashLineLength * dir, centerY + hashSpacing / 2);
          ctx.stroke();
        });
      };
      
      drawHashMarks(faceOffXLeft, faceOffY, faceOffCircleRadius);
      drawHashMarks(faceOffXRight, faceOffY, faceOffCircleRadius);
      
      // Face-off dots
      const dotRadius = Math.max(3, NHL.faceOffDotRadius * effectiveScale);
      ctx.fillStyle = '#DC2626';
      
      ctx.beginPath();
      ctx.arc(faceOffXLeft, faceOffY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(faceOffXRight, faceOffY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Neutral zone dots (5 ft past blue line toward center)
      const neutralDotY = blueLineY + NHL.neutralZoneDotFromBlue * effectiveScale;
      
      ctx.beginPath();
      ctx.arc(faceOffXLeft, neutralDotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(faceOffXRight, neutralDotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (view === 'neutral') {
      // Neutral zone view - area between blue lines
      // 50 ft long (from blue line to blue line), 85 ft wide
      const neutralZoneLength = 50;
      const scale = rinkPixelWidth / NHL.rinkWidth; // Scale based on width (85 ft)
      
      const effectiveScale = Math.min(scale, rinkPixelHeight / neutralZoneLength);
      const actualRinkWidth = NHL.rinkWidth * effectiveScale;
      const actualRinkDepth = neutralZoneLength * effectiveScale;
      
      const horizontalOffset = (rinkPixelWidth - actualRinkWidth) / 2;
      const verticalOffset = (rinkPixelHeight - actualRinkDepth) / 2;
      
      const rinkLeft = padding + horizontalOffset;
      const rinkRight = rinkLeft + actualRinkWidth;
      const rinkTop = padding + verticalOffset;
      const rinkBottom = rinkTop + actualRinkDepth;
      const rinkCenterX = (rinkLeft + rinkRight) / 2;
      const rinkCenterY = (rinkTop + rinkBottom) / 2;
      
      // Draw rink outline (no rounded corners - straight edges at blue lines)
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(rinkLeft, rinkTop, actualRinkWidth, actualRinkDepth);
      ctx.fillStyle = '#F0F9FF';
      ctx.fill();
      ctx.stroke();
      
      // Blue lines at top and bottom
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = Math.max(3, effectiveScale * 1);
      
      ctx.beginPath();
      ctx.moveTo(rinkLeft, rinkTop);
      ctx.lineTo(rinkRight, rinkTop);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(rinkLeft, rinkBottom);
      ctx.lineTo(rinkRight, rinkBottom);
      ctx.stroke();
      
      // Center red line
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = Math.max(3, effectiveScale * 1);
      ctx.beginPath();
      ctx.moveTo(rinkLeft, rinkCenterY);
      ctx.lineTo(rinkRight, rinkCenterY);
      ctx.stroke();
      
      // Center ice circle (15 ft radius)
      const centerCircleRadius = NHL.centerCircleRadius * effectiveScale;
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rinkCenterX, rinkCenterY, centerCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Center dot
      const dotRadius = Math.max(3, NHL.faceOffDotRadius * effectiveScale);
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(rinkCenterX, rinkCenterY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Neutral zone face-off dots (5 ft from blue lines, 22 ft from center)
      const faceOffFromCenter = NHL.faceOffDotsFromCenter * effectiveScale;
      const neutralDotFromBlue = NHL.neutralZoneDotFromBlue * effectiveScale;
      
      const faceOffX1 = rinkCenterX - faceOffFromCenter;
      const faceOffX2 = rinkCenterX + faceOffFromCenter;
      const topDotY = rinkTop + neutralDotFromBlue;
      const bottomDotY = rinkBottom - neutralDotFromBlue;
      
      ctx.fillStyle = '#DC2626';
      
      // Top neutral zone dots
      ctx.beginPath();
      ctx.arc(faceOffX1, topDotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(faceOffX2, topDotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Bottom neutral zone dots
      ctx.beginPath();
      ctx.arc(faceOffX1, bottomDotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(faceOffX2, bottomDotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (view === 'quarter') {
      // Quarter ice view - half width, offensive zone corner
      // ~50 ft deep (from end boards to fully contain faceoff circle), ~42.5 ft wide (half rink width)
      // Faceoff circle bottom is at: 11ft (goal line) + 20ft (dot from goal line) + 15ft (radius) = 46ft
      const quarterRinkWidth = NHL.rinkWidth / 2;
      const quarterRinkLength = 50;
      const scale = rinkPixelWidth / quarterRinkWidth;
      
      const effectiveScale = Math.min(scale, rinkPixelHeight / quarterRinkLength);
      const actualRinkWidth = quarterRinkWidth * effectiveScale;
      const actualRinkDepth = quarterRinkLength * effectiveScale;
      
      const horizontalOffset = (rinkPixelWidth - actualRinkWidth) / 2;
      const verticalOffset = (rinkPixelHeight - actualRinkDepth) / 2;
      
      const rinkLeft = padding + horizontalOffset;
      const rinkRight = rinkLeft + actualRinkWidth;
      const rinkTop = padding + verticalOffset;
      const rinkBottom = rinkTop + actualRinkDepth;
      
      // Position of key lines from rinkTop
      const goalLineY = rinkTop + NHL.goalLineFromEnd * effectiveScale;
      
      // Corner radius
      const cornerRadius = 20 * effectiveScale;
      
      // Helper function to get X position at a given Y within the corner curve
      const getCornerX = (y: number): number => {
        const cornerCenterX = rinkLeft + cornerRadius;
        const cornerCenterY = rinkTop + cornerRadius;
        
        if (y >= cornerCenterY) {
          return rinkLeft;
        }
        
        const dy = cornerCenterY - y;
        if (dy > cornerRadius) {
          return cornerCenterX;
        }
        const dx = Math.sqrt(cornerRadius * cornerRadius - dy * dy);
        return cornerCenterX - dx;
      };
      
      // Draw rink outline (only top-left corner rounded, right side is center line)
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rinkLeft + cornerRadius, rinkTop);
      ctx.lineTo(rinkRight, rinkTop);
      ctx.lineTo(rinkRight, rinkBottom);
      ctx.lineTo(rinkLeft, rinkBottom);
      ctx.lineTo(rinkLeft, rinkTop + cornerRadius);
      ctx.arcTo(rinkLeft, rinkTop, rinkLeft + cornerRadius, rinkTop, cornerRadius);
      ctx.closePath();
      ctx.fillStyle = '#F0F9FF';
      ctx.fill();
      ctx.stroke();
      
      // Center line on right side (dashed to indicate it's the center)
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(rinkRight, rinkTop);
      ctx.lineTo(rinkRight, rinkBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Goal line - calculate proper X bounds accounting for corner curve
      const goalLineLeftX = getCornerX(goalLineY);
      
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(goalLineLeftX, goalLineY);
      ctx.lineTo(rinkRight, goalLineY);
      ctx.stroke();
      
      // Goal crease (6 ft radius semicircle) - positioned at center line (right edge)
      const creaseRadius = NHL.creaseRadius * effectiveScale;
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Draw only the left half of the crease arc
      ctx.arc(rinkRight, goalLineY, creaseRadius, Math.PI / 2, Math.PI);
      ctx.stroke();
      
      // Goal (half visible at center line)
      const goalWidth = NHL.goalWidth * effectiveScale;
      const goalDepth = NHL.goalDepth * effectiveScale;
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#FECACA';
      ctx.beginPath();
      ctx.rect(rinkRight - goalDepth, goalLineY - goalWidth / 2, goalDepth, goalWidth / 2);
      ctx.fill();
      ctx.stroke();
      
      // Face-off circle (only the left one, and only the visible portion)
      const faceOffCircleRadius = NHL.faceOffCircleRadius * effectiveScale;
      const faceOffFromGoalLine = NHL.faceOffDotsFromGoalLine * effectiveScale;
      const faceOffFromCenter = NHL.faceOffDotsFromCenter * effectiveScale;
      
      const faceOffY = goalLineY + faceOffFromGoalLine;
      const faceOffX = rinkRight - faceOffFromCenter; // Left circle, measured from center (right edge)
      
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      
      // Draw full face-off circle if it fits, otherwise clip
      ctx.beginPath();
      ctx.arc(faceOffX, faceOffY, faceOffCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw hash marks
      const hashLineLength = 3 * effectiveScale;
      const hashSpacing = 2 * effectiveScale;
      
      // Left and right sides of the circle
      const leftX = faceOffX - faceOffCircleRadius;
      const rightX = faceOffX + faceOffCircleRadius;
      
      // Left hash marks
      ctx.beginPath();
      ctx.moveTo(leftX, faceOffY - hashSpacing / 2);
      ctx.lineTo(leftX - hashLineLength, faceOffY - hashSpacing / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(leftX, faceOffY + hashSpacing / 2);
      ctx.lineTo(leftX - hashLineLength, faceOffY + hashSpacing / 2);
      ctx.stroke();
      
      // Right hash marks (if visible)
      if (rightX < rinkRight) {
        ctx.beginPath();
        ctx.moveTo(rightX, faceOffY - hashSpacing / 2);
        ctx.lineTo(rightX + hashLineLength, faceOffY - hashSpacing / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightX, faceOffY + hashSpacing / 2);
        ctx.lineTo(rightX + hashLineLength, faceOffY + hashSpacing / 2);
        ctx.stroke();
      }
      
      // Face-off dot
      const dotRadius = Math.max(3, NHL.faceOffDotRadius * effectiveScale);
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(faceOffX, faceOffY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  // Helper to calculate average direction from a set of points (looking back ~30 pixels)
  const getAverageEndDirection = useCallback((points: Point[]): { angle: number; endPoint: Point } => {
    if (points.length < 2) {
      return { angle: 0, endPoint: points[0] || { x: 0, y: 0 } };
    }
    
    const endPoint = points[points.length - 1];
    const targetDistance = 30; // Look back ~30 pixels for direction
    let accumulatedDistance = 0;
    let startIdx = points.length - 1;
    
    // Walk backwards along the path until we've covered enough distance
    for (let i = points.length - 1; i > 0; i--) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      accumulatedDistance += Math.sqrt(dx * dx + dy * dy);
      startIdx = i - 1;
      if (accumulatedDistance >= targetDistance) break;
    }
    
    const startPoint = points[startIdx];
    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
    return { angle, endPoint };
  }, []);

  // Helper to draw an arrowhead at the end of a line
  const drawArrowheadAtAngle = useCallback((ctx: CanvasRenderingContext2D, endPoint: Point, angle: number, color: string) => {
    const headLength = 12;
    const headAngle = Math.PI / 6; // 30 degrees
    
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(endPoint.x, endPoint.y);
    ctx.lineTo(
      endPoint.x - headLength * Math.cos(angle - headAngle),
      endPoint.y - headLength * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      endPoint.x - headLength * Math.cos(angle + headAngle),
      endPoint.y - headLength * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, []);

  // Helper to draw a larger arrowhead for double lines
  const drawLargeArrowheadAtAngle = useCallback((ctx: CanvasRenderingContext2D, endPoint: Point, angle: number, color: string) => {
    const headLength = 16;
    const headAngle = Math.PI / 5; // Wider angle for larger arrowhead
    
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(endPoint.x, endPoint.y);
    ctx.lineTo(
      endPoint.x - headLength * Math.cos(angle - headAngle),
      endPoint.y - headLength * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      endPoint.x - headLength * Math.cos(angle + headAngle),
      endPoint.y - headLength * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, []);

  // Helper to draw a squiggly line along a path of points with consistent wavelength
  const drawSquigglyPath = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;
    
    const waveLength = 13; // Fixed wavelength in pixels (smaller = higher frequency)
    const waveHeight = 8; // Wave amplitude
    
    // Calculate total path length and segment lengths
    const segmentLengths: number[] = [];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segmentLengths.push(len);
      totalLength += len;
    }
    
    if (totalLength < 1) return;
    
    const waveCount = Math.max(2, Math.floor(totalLength / waveLength));
    
    // Function to get point and perpendicular at a given distance along the path
    const getPointAtDistance = (targetDist: number): { point: Point; perpX: number; perpY: number } => {
      let accDist = 0;
      for (let i = 0; i < segmentLengths.length; i++) {
        if (accDist + segmentLengths[i] >= targetDist || i === segmentLengths.length - 1) {
          const segmentT = segmentLengths[i] > 0 ? (targetDist - accDist) / segmentLengths[i] : 0;
          const clampedT = Math.max(0, Math.min(1, segmentT));
          const dx = points[i + 1].x - points[i].x;
          const dy = points[i + 1].y - points[i].y;
          const len = segmentLengths[i] || 1;
          return {
            point: {
              x: points[i].x + dx * clampedT,
              y: points[i].y + dy * clampedT,
            },
            perpX: -dy / len,
            perpY: dx / len,
          };
        }
        accDist += segmentLengths[i];
      }
      return { point: points[points.length - 1], perpX: 0, perpY: -1 };
    };
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i <= waveCount; i++) {
      const endDist = (i / waveCount) * totalLength;
      const midDist = ((i - 0.5) / waveCount) * totalLength;
      
      const endInfo = getPointAtDistance(endDist);
      const midInfo = getPointAtDistance(midDist);
      
      const waveDir = (i % 2 === 0) ? 1 : -1;
      const cpX = midInfo.point.x + midInfo.perpX * waveHeight * waveDir;
      const cpY = midInfo.point.y + midInfo.perpY * waveHeight * waveDir;
      
      ctx.quadraticCurveTo(cpX, cpY, endInfo.point.x, endInfo.point.y);
    }
    
    ctx.stroke();
  }, []);

  // Helper to draw a squiggly line between two points (for straight lines)
  const drawSquigglyLine = useCallback((ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    drawSquigglyPath(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }]);
  }, [drawSquigglyPath]);

  // Helper to draw a double line path (two parallel lines)
  const drawDoublePath = useCallback((ctx: CanvasRenderingContext2D, points: Point[], lineWidth: number, trimEnd: number = 16) => {
    if (points.length < 2) return;
    
    const offset = lineWidth + 1; // Gap between the two lines
    
    // Trim points from the end to stop before arrowhead
    let trimmedPoints = points;
    if (trimEnd > 0 && points.length >= 2) {
      // Calculate total length from the end and find where to trim
      let accumulatedLength = 0;
      let trimIndex = points.length - 1;
      let trimT = 1;
      
      for (let i = points.length - 1; i > 0; i--) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        
        if (accumulatedLength + segmentLength >= trimEnd) {
          // Trim within this segment
          const remaining = trimEnd - accumulatedLength;
          trimT = 1 - remaining / segmentLength;
          trimIndex = i;
          break;
        }
        accumulatedLength += segmentLength;
        trimIndex = i - 1;
      }
      
      // Create trimmed path
      if (trimIndex < points.length - 1 || trimT < 1) {
        trimmedPoints = points.slice(0, trimIndex);
        if (trimIndex > 0 && trimIndex < points.length) {
          const prevPoint = points[trimIndex - 1];
          const currPoint = points[trimIndex];
          trimmedPoints.push({
            x: prevPoint.x + (currPoint.x - prevPoint.x) * trimT,
            y: prevPoint.y + (currPoint.y - prevPoint.y) * trimT,
          });
        }
      }
    }
    
    if (trimmedPoints.length < 2) return;
    
    // For each segment, calculate perpendicular offset
    const getOffsetPoints = (pts: Point[], offsetDir: number): Point[] => {
      const result: Point[] = [];
      for (let i = 0; i < pts.length; i++) {
        let perpX = 0, perpY = 0;
        if (i === 0 && pts.length > 1) {
          const dx = pts[1].x - pts[0].x;
          const dy = pts[1].y - pts[0].y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          perpX = -dy / len;
          perpY = dx / len;
        } else if (i === pts.length - 1 && pts.length > 1) {
          const dx = pts[i].x - pts[i - 1].x;
          const dy = pts[i].y - pts[i - 1].y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          perpX = -dy / len;
          perpY = dx / len;
        } else if (pts.length > 2) {
          // Average of adjacent segments
          const dx1 = pts[i].x - pts[i - 1].x;
          const dy1 = pts[i].y - pts[i - 1].y;
          const dx2 = pts[i + 1].x - pts[i].x;
          const dy2 = pts[i + 1].y - pts[i].y;
          const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
          perpX = (-dy1 / len1 - dy2 / len2) / 2;
          perpY = (dx1 / len1 + dx2 / len2) / 2;
          const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
          perpX /= perpLen;
          perpY /= perpLen;
        }
        result.push({
          x: pts[i].x + perpX * offset * offsetDir,
          y: pts[i].y + perpY * offset * offsetDir,
        });
      }
      return result;
    };
    
    // Draw first line (offset one way)
    const line1 = getOffsetPoints(trimmedPoints, 0.5);
    ctx.beginPath();
    ctx.moveTo(line1[0].x, line1[0].y);
    for (let i = 1; i < line1.length; i++) {
      ctx.lineTo(line1[i].x, line1[i].y);
    }
    ctx.stroke();
    
    // Draw second line (offset other way)
    const line2 = getOffsetPoints(trimmedPoints, -0.5);
    ctx.beginPath();
    ctx.moveTo(line2[0].x, line2[0].y);
    for (let i = 1; i < line2.length; i++) {
      ctx.lineTo(line2[i].x, line2[i].y);
    }
    ctx.stroke();
  }, []);

  // Helper to generate spline points for smoother polylines
  const getSplinePoints = useCallback((points: Point[], segmentsPerCurve: number = 16): Point[] => {
    if (points.length <= 2) return points;
    
    const result: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 < points.length ? points[i + 2] : p2;
      
      for (let t = 0; t < segmentsPerCurve; t++) {
        const tt = t / segmentsPerCurve;
        const tt2 = tt * tt;
        const tt3 = tt2 * tt;
        
        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * tt + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tt2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * tt3);
        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * tt + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tt2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * tt3);
        
        result.push({ x, y });
      }
    }
    
    result.push(points[points.length - 1]);
    return result;
  }, []);

  const getTrimmedLineEnd = useCallback((start: Point, end: Point, trimDistance: number): Point => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length <= trimDistance || length === 0) return start;
    const ux = dx / length;
    const uy = dy / length;
    return {
      x: end.x - ux * trimDistance,
      y: end.y - uy * trimDistance,
    };
  }, []);

  const trimPathPoints = useCallback((points: Point[], trimEnd: number): Point[] => {
    if (points.length < 2 || trimEnd <= 0) return points;
    
    let accumulatedLength = 0;
    let trimIndex = points.length - 1;
    let trimT = 1;
    
    for (let i = points.length - 1; i > 0; i--) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      if (accumulatedLength + segmentLength >= trimEnd) {
        const remaining = trimEnd - accumulatedLength;
        trimT = 1 - remaining / segmentLength;
        trimIndex = i;
        break;
      }
      accumulatedLength += segmentLength;
      trimIndex = i - 1;
    }
    
    if (trimIndex < 1) return [points[0]];
    
    const trimmedPoints = points.slice(0, trimIndex);
    const prevPoint = points[trimIndex - 1];
    const currPoint = points[trimIndex];
    trimmedPoints.push({
      x: prevPoint.x + (currPoint.x - prevPoint.x) * trimT,
      y: prevPoint.y + (currPoint.y - prevPoint.y) * trimT,
    });
    
    return trimmedPoints;
  }, []);

  // Draw all strokes
  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D, strokesToDraw: Stroke[], selectedId: string | null) => {
    strokesToDraw.forEach(stroke => {
      if (stroke.points.length < 2) return;
      
      const isSelected = stroke.id === selectedId;
      
      // Draw selection highlight behind the stroke
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#8B5CF6'; // Purple highlight
        ctx.lineWidth = stroke.lineWidth + 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.4;
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
      
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (stroke.lineType === 'dashed') {
        ctx.setLineDash([10, 5]);
      } else {
        ctx.setLineDash([]);
      }
      
      // Handle different draw modes
      if (stroke.drawMode === 'line' && stroke.points.length === 2) {
        // Straight line mode
        if (stroke.lineType === 'squiggly') {
          const trimmedEnd = getTrimmedLineEnd(stroke.points[0], stroke.points[1], 12);
          drawSquigglyLine(ctx, stroke.points[0].x, stroke.points[0].y, trimmedEnd.x, trimmedEnd.y);
        } else if (stroke.lineType === 'double') {
          drawDoublePath(ctx, stroke.points, stroke.lineWidth);
        } else {
          const trimmedEnd = getTrimmedLineEnd(stroke.points[0], stroke.points[1], 12);
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          ctx.lineTo(trimmedEnd.x, trimmedEnd.y);
          ctx.stroke();
        }
      } else if (stroke.drawMode === 'curve' && stroke.points.length === 3) {
        // Curved line mode - sample curve into points for squiggly/double
        if (stroke.lineType === 'squiggly' || stroke.lineType === 'double') {
          const curvePoints: Point[] = [];
          const segments = 20;
          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            curvePoints.push({
              x: (1-t)*(1-t)*stroke.points[0].x + 2*(1-t)*t*stroke.points[1].x + t*t*stroke.points[2].x,
              y: (1-t)*(1-t)*stroke.points[0].y + 2*(1-t)*t*stroke.points[1].y + t*t*stroke.points[2].y,
            });
          }
          if (stroke.lineType === 'squiggly') {
            const trimmedCurvePoints = trimPathPoints(curvePoints, 12);
            drawSquigglyPath(ctx, trimmedCurvePoints);
          } else {
            drawDoublePath(ctx, curvePoints, stroke.lineWidth);
          }
        } else {
          const trimmedEnd = getTrimmedLineEnd(stroke.points[1], stroke.points[2], 12);
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          ctx.quadraticCurveTo(stroke.points[1].x, stroke.points[1].y, trimmedEnd.x, trimmedEnd.y);
          ctx.stroke();
        }
      } else if (stroke.drawMode === 'polyline' && stroke.points.length >= 2) {
        // Polyline mode - spline fit through points
        const splinePoints = getSplinePoints(stroke.points);
        if (stroke.lineType === 'squiggly') {
          drawSquigglyPath(ctx, splinePoints);
        } else if (stroke.lineType === 'double') {
          drawDoublePath(ctx, splinePoints, stroke.lineWidth);
        } else {
          ctx.beginPath();
          ctx.moveTo(splinePoints[0].x, splinePoints[0].y);
          for (let i = 1; i < splinePoints.length; i++) {
            ctx.lineTo(splinePoints[i].x, splinePoints[i].y);
          }
          ctx.stroke();
        }
      } else {
        // Freehand mode
        if (stroke.lineType === 'squiggly') {
          drawSquigglyPath(ctx, stroke.points);
        } else if (stroke.lineType === 'double') {
          drawDoublePath(ctx, stroke.points, stroke.lineWidth);
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        }
      }
      
      ctx.setLineDash([]);
      
      // Calculate arrowhead direction based on average of last segment
      let arrowAngle: number;
      let arrowEndPoint: Point;
      
      if (stroke.drawMode === 'curve' && stroke.points.length === 3) {
        // For curves, sample end of bezier for direction
        const t1 = 0.9;
        const t2 = 1.0;
        const p1 = {
          x: (1-t1)*(1-t1)*stroke.points[0].x + 2*(1-t1)*t1*stroke.points[1].x + t1*t1*stroke.points[2].x,
          y: (1-t1)*(1-t1)*stroke.points[0].y + 2*(1-t1)*t1*stroke.points[1].y + t1*t1*stroke.points[2].y,
        };
        const p2 = {
          x: (1-t2)*(1-t2)*stroke.points[0].x + 2*(1-t2)*t2*stroke.points[1].x + t2*t2*stroke.points[2].x,
          y: (1-t2)*(1-t2)*stroke.points[0].y + 2*(1-t2)*t2*stroke.points[1].y + t2*t2*stroke.points[2].y,
        };
        arrowAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        arrowEndPoint = p2;
      } else if (stroke.drawMode === 'polyline' && stroke.points.length >= 2) {
        // For spline polylines, use the spline for end direction
        const splinePoints = getSplinePoints(stroke.points);
        const result = getAverageEndDirection(splinePoints);
        arrowAngle = result.angle;
        arrowEndPoint = result.endPoint;
      } else {
        // For all other modes, use average direction from last ~30px
        const result = getAverageEndDirection(stroke.points);
        arrowAngle = result.angle;
        arrowEndPoint = result.endPoint;
      }
      
      // For double lines, draw a larger arrowhead
      if (stroke.lineType === 'double') {
        drawLargeArrowheadAtAngle(ctx, arrowEndPoint, arrowAngle, stroke.color);
      } else {
        drawArrowheadAtAngle(ctx, arrowEndPoint, arrowAngle, stroke.color);
      }
    });
  }, [drawSquigglyLine, drawSquigglyPath, drawDoublePath, getSplinePoints, getTrimmedLineEnd, trimPathPoints, getAverageEndDirection, drawArrowheadAtAngle, drawLargeArrowheadAtAngle]);

  // Helper to calculate distance from point to line segment
  const distanceToSegment = useCallback((point: Point, p1: Point, p2: Point): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      // p1 and p2 are the same point
      return Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
    }
    
    // Project point onto line segment
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    
    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
  }, []);

  // Hit test for strokes - returns stroke id if point is near a stroke
  const hitTestStroke = useCallback((point: Point, strokeList: Stroke[]): string | null => {
    const hitThreshold = 8; // Pixels tolerance for hit detection
    
    // Check in reverse order (top strokes first)
    for (let i = strokeList.length - 1; i >= 0; i--) {
      const stroke = strokeList[i];
      if (stroke.points.length < 2) continue;
      
      const pointsToTest = stroke.drawMode === 'polyline'
        ? getSplinePoints(stroke.points)
        : stroke.points;
      
      // Check distance to each segment
      for (let j = 0; j < pointsToTest.length - 1; j++) {
        const dist = distanceToSegment(point, pointsToTest[j], pointsToTest[j + 1]);
        if (dist <= hitThreshold) {
          return stroke.id;
        }
      }
    }
    return null;
  }, [distanceToSegment, getSplinePoints]);

  // Hit test for placed objects - returns object id if point is inside
  const hitTestObject = useCallback((point: Point, objects: PlacedObject[]): string | null => {
    // Check in reverse order (top objects first)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const dx = point.x - obj.x;
      const dy = point.y - obj.y;
      
      if (obj.type === 'player') {
        const radius = 16;
        if (dx * dx + dy * dy <= radius * radius) return obj.id;
      } else if (obj.type === 'cone') {
        const hitRadius = 12;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) return obj.id;
      } else if (obj.type === 'net' || obj.type === 'smallNet') {
        const { width, height } = NET_DIMENSIONS[obj.type];
        const rotation = obj.rotation || 0;
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        if (Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2) return obj.id;
      } else if (obj.type === 'pucks') {
        const hitRadius = 14;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) return obj.id;
      }
    }
    return null;
  }, []);

  // Draw placed objects (players, cones, nets)
  const drawPlacedObjects = useCallback((ctx: CanvasRenderingContext2D, objects: PlacedObject[], selectedId: string | null) => {
    objects.forEach(obj => {
      ctx.save();
      
      const isSelected = obj.id === selectedId;
      
      // Draw selection highlight
      if (isSelected) {
        ctx.strokeStyle = '#8B5CF6'; // Purple highlight
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        
        if (obj.type === 'player') {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 22, 0, Math.PI * 2);
          ctx.stroke();
        } else if (obj.type === 'cone') {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 16, 0, Math.PI * 2);
          ctx.stroke();
        } else if (obj.type === 'net' || obj.type === 'smallNet') {
          const { width, height } = NET_DIMENSIONS[obj.type];
          const rotation = obj.rotation || 0;
          const padding = 6;
          ctx.save();
          ctx.translate(obj.x, obj.y);
          ctx.rotate(rotation);
          ctx.strokeRect(-width / 2 - padding / 2, -height / 2 - padding / 2, width + padding, height + padding);
          ctx.restore();
        } else if (obj.type === 'pucks') {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      
      if (obj.type === 'player') {
        // Draw player circle marker
        const radius = 16;
        const colorMap: Record<PlayerColor, string> = {
          blue: '#2563EB',
          red: '#DC2626',
          black: '#1F2937',
          gray: '#6B7280',
        };
        const borderColorMap: Record<PlayerColor, string> = {
          blue: '#1D4ED8',
          red: '#991B1B',
          black: '#6B7280', // Lighter gray border for visibility in dark mode
          gray: '#4B5563',
        };
        const color = colorMap[obj.playerColor || 'blue'];
        const borderColor = borderColorMap[obj.playerColor || 'blue'];
        
        // Circle fill
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Circle border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Determine the label based on marker type
        let label = '';
        const markerType = obj.playerMarkerType;
        
        // Legacy support: gray color with no markerType defaults to 'C'
        if ((obj.playerColor === 'gray' || obj.playerNumber === 0) && !markerType) {
          label = 'C';
        } else if (markerType === 'plain') {
          // Plain - no label
          label = '';
        } else if (markerType === 'numbered') {
          // Auto-numbered: 1, 2, 3...
          label = String(obj.playerSequence || 1);
        } else if (markerType === 'F') {
          label = 'F';
        } else if (markerType === 'D') {
          label = 'D';
        } else if (markerType === 'G') {
          label = 'G';
        } else if (markerType === 'Fx') {
          label = `F${obj.playerSequence || 1}`;
        } else if (markerType === 'Dx') {
          label = `D${obj.playerSequence || 1}`;
        } else if (markerType === 'Xx') {
          label = `X${obj.playerSequence || 1}`;
        } else if (markerType === 'Ox') {
          label = `O${obj.playerSequence || 1}`;
        } else if (markerType === 'X') {
          label = 'X';
        } else if (markerType === 'O') {
          label = 'O';
        } else if (markerType === 'C') {
          label = 'C';
        } else if (markerType === 'LW') {
          label = 'LW';
        } else if (markerType === 'RW') {
          label = 'RW';
        } else if (obj.playerNumber !== undefined) {
          // Legacy support for old data
          if (obj.playerNumber === 0) label = 'C';
          else if (obj.playerNumber === -1) label = 'F';
          else if (obj.playerNumber === -2) label = 'D';
          else if (obj.playerNumber === -3) label = 'G';
          else label = String(obj.playerNumber);
        }
        
        // Draw label text
        if (label) {
          ctx.fillStyle = '#FFFFFF';
          // Adjust font size based on label length (scaled for 16px radius circles)
          const fontSize = label.length > 2 ? 12 : label.length > 1 ? 14 : 16;
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, obj.x, obj.y);
        }
        
      } else if (obj.type === 'cone') {
        // Draw traffic cone
        const height = 18;
        const topWidth = 4;
        const bottomWidth = 14;
        
        // Cone body
        ctx.beginPath();
        ctx.moveTo(obj.x - topWidth / 2, obj.y - height / 2);
        ctx.lineTo(obj.x + topWidth / 2, obj.y - height / 2);
        ctx.lineTo(obj.x + bottomWidth / 2, obj.y + height / 2 - 3);
        ctx.lineTo(obj.x - bottomWidth / 2, obj.y + height / 2 - 3);
        ctx.closePath();
        ctx.fillStyle = '#F97316'; // Orange
        ctx.fill();
        ctx.strokeStyle = '#C2410C';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // White stripes
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(obj.x - bottomWidth / 2 + 3, obj.y + 2);
        ctx.lineTo(obj.x + bottomWidth / 2 - 3, obj.y + 2);
        ctx.stroke();
        
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.x - topWidth / 2 - 1, obj.y - 5);
        ctx.lineTo(obj.x + topWidth / 2 + 1, obj.y - 5);
        ctx.stroke();
        
        // Base
        ctx.fillStyle = '#1F2937';
        ctx.fillRect(obj.x - bottomWidth / 2 - 1, obj.y + height / 2 - 3, bottomWidth + 2, 4);
        
      } else if (obj.type === 'net') {
        // Draw full-size net
        const { width, height } = NET_DIMENSIONS.net;
        const rotation = obj.rotation || 0;
        
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(rotation);
        
        // Net frame
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 3;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        
        // Net mesh lines
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          const xOffset = (width / 4) * i;
          ctx.beginPath();
          ctx.moveTo(-width / 2 + xOffset, -height / 2);
          ctx.lineTo(-width / 2 + xOffset, height / 2);
          ctx.stroke();
        }
        for (let i = 1; i < 3; i++) {
          const yOffset = (height / 3) * i;
          ctx.beginPath();
          ctx.moveTo(-width / 2, -height / 2 + yOffset);
          ctx.lineTo(width / 2, -height / 2 + yOffset);
          ctx.stroke();
        }
        
        ctx.restore();
        
      } else if (obj.type === 'smallNet') {
        // Draw small net (mini goal)
        const { width, height } = NET_DIMENSIONS.smallNet;
        const rotation = obj.rotation || 0;
        
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(rotation);
        
        // Net frame
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        
        // Net mesh
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -height / 2);
        ctx.lineTo(0, height / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-width / 2, 0);
        ctx.lineTo(width / 2, 0);
        ctx.stroke();
        
        ctx.restore();
        
      } else if (obj.type === 'pucks') {
        // Draw pile of pucks with random positions
        const puckRadius = 4;
        const puckColor = '#1F2937'; // Dark gray/black for pucks
        const puckBorder = '#374151';
        
        // Use stored random offsets, or generate default if not present (for legacy data)
        const offsets = obj.puckOffsets || [
          { dx: -6, dy: 4 }, { dx: 6, dy: 4 }, { dx: 0, dy: -5 },
          { dx: -3, dy: -2 }, { dx: 3, dy: -2 }, { dx: 0, dy: 6 },
          { dx: -8, dy: 0 }, { dx: 8, dy: 0 },
        ];
        
        offsets.forEach(offset => {
          ctx.beginPath();
          ctx.arc(obj.x + offset.dx, obj.y + offset.dy, puckRadius, 0, Math.PI * 2);
          ctx.fillStyle = puckColor;
          ctx.fill();
          ctx.strokeStyle = puckBorder;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });
      }
      
      // Rotation handle for selected nets
      if (isSelected && (obj.type === 'net' || obj.type === 'smallNet')) {
        const { height } = NET_DIMENSIONS[obj.type];
        const rotation = obj.rotation || 0;
        const offset = height / 2 + NET_ROTATION_HANDLE_OFFSET;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const handleX = obj.x + 0 * cos - (-offset) * sin;
        const handleY = obj.y + 0 * sin + (-offset) * cos;
        
        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        ctx.lineTo(handleX, handleY);
        ctx.stroke();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(handleX, handleY, NET_ROTATION_HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      
      ctx.restore();
    });
  }, []);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    drawRink(ctx, canvasWidth, canvasHeight, rinkView);
    drawStrokes(ctx, strokes, selectedStrokeId);
    drawPlacedObjects(ctx, placedObjects, selectedObjectId);
    
    // Draw current stroke preview
    if (currentStroke.length > 0) {
      ctx.strokeStyle = COLOR_MAP[lineColor];
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (lineType === 'dashed') {
        ctx.setLineDash([10, 5]);
      } else {
        ctx.setLineDash([]);
      }
      
      let previewArrowAngle: number | null = null;
      let previewArrowEndPoint: Point | null = null;
      
      if (drawMode === 'line' && currentStroke.length === 2) {
        // Preview straight line
        if (lineType === 'squiggly') {
          const trimmedEnd = getTrimmedLineEnd(currentStroke[0], currentStroke[1], 12);
          drawSquigglyLine(ctx, currentStroke[0].x, currentStroke[0].y, trimmedEnd.x, trimmedEnd.y);
        } else if (lineType === 'double') {
          drawDoublePath(ctx, currentStroke, 3);
        } else {
          const trimmedEnd = getTrimmedLineEnd(currentStroke[0], currentStroke[1], 12);
          ctx.beginPath();
          ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
          ctx.lineTo(trimmedEnd.x, trimmedEnd.y);
          ctx.stroke();
        }
        previewArrowEndPoint = currentStroke[1];
        previewArrowAngle = Math.atan2(currentStroke[1].y - currentStroke[0].y, currentStroke[1].x - currentStroke[0].x);
      } else if (drawMode === 'curve' && currentStroke.length >= 2) {
        if (currentStroke.length === 2) {
          ctx.beginPath();
          ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
          ctx.lineTo(currentStroke[1].x, currentStroke[1].y);
          ctx.stroke();
        } else if (currentStroke.length === 3) {
          if (lineType === 'squiggly' || lineType === 'double') {
            const curvePoints: Point[] = [];
            const segments = 20;
            for (let i = 0; i <= segments; i++) {
              const t = i / segments;
              curvePoints.push({
                x: (1-t)*(1-t)*currentStroke[0].x + 2*(1-t)*t*currentStroke[1].x + t*t*currentStroke[2].x,
                y: (1-t)*(1-t)*currentStroke[0].y + 2*(1-t)*t*currentStroke[1].y + t*t*currentStroke[2].y,
              });
            }
            if (lineType === 'squiggly') {
              const trimmedCurvePoints = trimPathPoints(curvePoints, 12);
              drawSquigglyPath(ctx, trimmedCurvePoints);
            } else {
              drawDoublePath(ctx, curvePoints, 3);
            }
          } else {
            const trimmedEnd = getTrimmedLineEnd(currentStroke[1], currentStroke[2], 12);
            ctx.beginPath();
            ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
            ctx.quadraticCurveTo(currentStroke[1].x, currentStroke[1].y, trimmedEnd.x, trimmedEnd.y);
            ctx.stroke();
          }
          // Calculate tangent at end of curve
          const t1 = 0.9;
          const t2 = 1.0;
          const p1 = {
            x: (1-t1)*(1-t1)*currentStroke[0].x + 2*(1-t1)*t1*currentStroke[1].x + t1*t1*currentStroke[2].x,
            y: (1-t1)*(1-t1)*currentStroke[0].y + 2*(1-t1)*t1*currentStroke[1].y + t1*t1*currentStroke[2].y,
          };
          const p2 = {
            x: (1-t2)*(1-t2)*currentStroke[0].x + 2*(1-t2)*t2*currentStroke[1].x + t2*t2*currentStroke[2].x,
            y: (1-t2)*(1-t2)*currentStroke[0].y + 2*(1-t2)*t2*currentStroke[1].y + t2*t2*currentStroke[2].y,
          };
          previewArrowAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          previewArrowEndPoint = p2;
        }
      } else if ((drawMode === 'polyline' || drawMode === 'freehand') && currentStroke.length > 1) {
        // Polyline or Freehand preview
        const previewPoints = drawMode === 'polyline'
          ? getSplinePoints(currentStroke)
          : currentStroke;
        
        if (lineType === 'squiggly') {
          drawSquigglyPath(ctx, previewPoints);
        } else if (lineType === 'double') {
          drawDoublePath(ctx, previewPoints, 3);
        } else {
          ctx.beginPath();
          ctx.moveTo(previewPoints[0].x, previewPoints[0].y);
          for (let i = 1; i < previewPoints.length; i++) {
            ctx.lineTo(previewPoints[i].x, previewPoints[i].y);
          }
          ctx.stroke();
        }
        // Use average direction for arrowhead
        const result = getAverageEndDirection(previewPoints);
        previewArrowAngle = result.angle;
        previewArrowEndPoint = result.endPoint;
      }
      
      ctx.setLineDash([]);
      
      // Draw arrowhead on preview
      if (previewArrowEndPoint && previewArrowAngle !== null) {
        if (lineType === 'double') {
          drawLargeArrowheadAtAngle(ctx, previewArrowEndPoint, previewArrowAngle, COLOR_MAP[lineColor]);
        } else {
          drawArrowheadAtAngle(ctx, previewArrowEndPoint, previewArrowAngle, COLOR_MAP[lineColor]);
        }
      }
    }
    
    // Draw point markers for line/curve/polyline modes
    if (drawMode === 'line' && lineStartPoint) {
      ctx.fillStyle = COLOR_MAP[lineColor];
      ctx.beginPath();
      ctx.arc(lineStartPoint.x, lineStartPoint.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (drawMode === 'curve' && curvePoints.length > 0) {
      ctx.fillStyle = COLOR_MAP[lineColor];
      curvePoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    if (drawMode === 'polyline' && polylinePoints.length > 0) {
      ctx.fillStyle = COLOR_MAP[lineColor];
      polylinePoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [canvasWidth, canvasHeight, rinkView, strokes, currentStroke, lineColor, lineType, drawMode, lineStartPoint, curvePoints, polylinePoints, placedObjects, selectedObjectId, selectedStrokeId, drawRink, drawStrokes, drawPlacedObjects, drawSquigglyLine, drawSquigglyPath, drawDoublePath, getSplinePoints, getTrimmedLineEnd, trimPathPoints, getAverageEndDirection, drawArrowheadAtAngle, drawLargeArrowheadAtAngle]);

  // Redraw when dependencies change
  useEffect(() => {
    if (isOpen) {
      redrawCanvas();
    }
  }, [isOpen, redrawCanvas]);

  // Keyboard event handler for delete/backspace
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedObjectId || selectedStrokeId) {
          e.preventDefault();
          if (selectedObjectId) {
            setPlacedObjects(prev => prev.filter(obj => obj.id !== selectedObjectId));
            setSelectedObjectId(null);
          }
          if (selectedStrokeId) {
            setStrokes(prev => prev.filter(s => s.id !== selectedStrokeId));
            setSelectedStrokeId(null);
          }
        }
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedObjectId(null);
        setSelectedStrokeId(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedObjectId, selectedStrokeId]);

  // Get canvas coordinates from mouse/touch event
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    if (!point) return;
    
    // Handle select mode - don't do anything else when in select mode
    // (handleMouseDown already handles selection and dragging)
    if (isSelectMode) {
      return;
    }
    
    // Handle place mode - add object to canvas
    if (isPlaceMode) {
      if (placeableType === 'player') {
        // Determine the actual color to use:
        // - If playerColor is 'gray', keep it (Coach button was clicked)
        // - Otherwise, use the current lineColor (mapped: gray -> black for circles)
        const effectiveColor: PlayerColor = playerColor === 'gray' 
          ? 'gray' 
          : (lineColor === 'gray' ? 'black' : lineColor);
        
        // Determine if this marker type needs auto-numbering
        const autoNumberedTypes: PlayerMarkerType[] = ['numbered', 'Fx', 'Dx', 'Xx', 'Ox'];
        const needsSequence = autoNumberedTypes.includes(playerMarkerType);
        
        // Get the counter key and next sequence number
        const counterKey = `${effectiveColor}-${playerMarkerType}`;
        const nextSequence = needsSequence ? (markerCounters[counterKey] || 0) + 1 : undefined;
        
        const newObject: PlacedObject = {
          id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: placeableType,
          x: point.x,
          y: point.y,
          playerColor: effectiveColor,
          playerMarkerType,
          playerSequence: nextSequence,
          // Keep playerNumber for legacy/coach support
          playerNumber: effectiveColor === 'gray' ? 0 : undefined,
        };
        setPlacedObjects(prev => [...prev, newObject]);
        
        // Update counter for auto-numbered types
        if (needsSequence && nextSequence !== undefined) {
          setMarkerCounters(prev => ({
            ...prev,
            [counterKey]: nextSequence,
          }));
        }
      } else {
        // Non-player objects (cone, net, smallNet, pucks)
        const newObject: PlacedObject = {
          id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: placeableType,
          x: point.x,
          y: point.y,
          ...(placeableType === 'net' || placeableType === 'smallNet'
            ? { rotation: 0 }
            : {}),
          // Generate random puck offsets for pucks type
          ...(placeableType === 'pucks' && {
            puckOffsets: Array.from({ length: 8 + Math.floor(Math.random() * 5) }, () => ({
              dx: (Math.random() - 0.5) * 20,
              dy: (Math.random() - 0.5) * 20,
            })),
          }),
        };
        setPlacedObjects(prev => [...prev, newObject]);
      }
      return;
    }
    
    if (drawMode === 'line') {
      // Line mode: click start, click end
      if (!lineStartPoint) {
        setLineStartPoint(point);
      } else {
        const newStroke: Stroke = {
          id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          points: [lineStartPoint, point],
          color: COLOR_MAP[lineColor],
          lineType,
          lineWidth: 3,
          drawMode: 'line',
        };
        setStrokes(prev => [...prev, newStroke]);
        setLineStartPoint(null);
        setCurrentStroke([]);
      }
    } else if (drawMode === 'curve') {
      // Curve mode: click start, click control point, click end
      if (curvePoints.length < 2) {
        setCurvePoints(prev => [...prev, point]);
      } else {
        const newStroke: Stroke = {
          id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          points: [...curvePoints, point],
          color: COLOR_MAP[lineColor],
          lineType,
          lineWidth: 3,
          drawMode: 'curve',
        };
        setStrokes(prev => [...prev, newStroke]);
        setCurvePoints([]);
        setCurrentStroke([]);
      }
    } else if (drawMode === 'polyline') {
      // Polyline mode: click to add points, double-click to finish
      if (e.detail > 1) return;
      setPolylinePoints(prev => [...prev, point]);
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode !== 'polyline') return;
    
    const point = getCanvasCoords(e);
    if (!point) return;
    
    setPolylinePoints(prev => {
      if (prev.length === 0) return prev;
      
      let nextPoints = prev;
      const lastPoint = prev[prev.length - 1];
      const dx = lastPoint.x - point.x;
      const dy = lastPoint.y - point.y;
      const isDuplicate = dx * dx + dy * dy <= 4;
      
      if (!isDuplicate) {
        nextPoints = [...prev, point];
      }
      
      if (nextPoints.length >= 2) {
        const newStroke: Stroke = {
          id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          points: nextPoints,
          color: COLOR_MAP[lineColor],
          lineType,
          lineWidth: 3,
          drawMode: 'polyline',
        };
        setStrokes(strokesPrev => [...strokesPrev, newStroke]);
      }
      
      return [];
    });
    
    setCurrentStroke([]);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    if (!point) return;
    
    // Handle select mode - start dragging if clicking on an object or stroke
    if (isSelectMode) {
      if (selectedObjectId) {
        const selectedObj = placedObjects.find(o => o.id === selectedObjectId);
        if (selectedObj && (selectedObj.type === 'net' || selectedObj.type === 'smallNet')) {
          const { height } = NET_DIMENSIONS[selectedObj.type];
          const rotation = selectedObj.rotation || 0;
          const offset = height / 2 + NET_ROTATION_HANDLE_OFFSET;
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          const handleX = selectedObj.x + 0 * cos - (-offset) * sin;
          const handleY = selectedObj.y + 0 * sin + (-offset) * cos;
          const dx = point.x - handleX;
          const dy = point.y - handleY;
          const hitRadius = NET_ROTATION_HANDLE_RADIUS + 3;
          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
            setIsRotatingObject(true);
            setRotateStartAngle(Math.atan2(point.y - selectedObj.y, point.x - selectedObj.x));
            setRotateStartRotation(selectedObj.rotation || 0);
            return;
          }
        }
      }
      
      // First check objects (they're drawn on top)
      const hitObjectId = hitTestObject(point, placedObjects);
      if (hitObjectId) {
        const obj = placedObjects.find(o => o.id === hitObjectId);
        if (obj) {
          setSelectedObjectId(hitObjectId);
          setSelectedStrokeId(null);
          setIsDraggingObject(true);
          setDragOffset({ x: point.x - obj.x, y: point.y - obj.y });
        }
        return;
      }
      
      // Then check strokes
      const hitStrokeId = hitTestStroke(point, strokes);
      if (hitStrokeId) {
        setSelectedStrokeId(hitStrokeId);
        setSelectedObjectId(null);
        setIsDraggingStroke(true);
        setDragStartPoint(point);
        return;
      }
      
      // Clicked on empty space - deselect
      setSelectedObjectId(null);
      setSelectedStrokeId(null);
      return;
    }
    
    if (drawMode !== 'freehand') return;
    
    setIsDrawing(true);
    setCurrentStroke([point]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    if (!point) return;
    
    // Handle rotating object in select mode
    if (isSelectMode && isRotatingObject && selectedObjectId) {
      setPlacedObjects(prev => prev.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        const rotation = rotateStartRotation + (Math.atan2(point.y - obj.y, point.x - obj.x) - rotateStartAngle);
        return { ...obj, rotation };
      }));
      return;
    }
    
    // Handle dragging object in select mode
    if (isSelectMode && isDraggingObject && selectedObjectId) {
      setPlacedObjects(prev => prev.map(obj => 
        obj.id === selectedObjectId 
          ? { ...obj, x: point.x - dragOffset.x, y: point.y - dragOffset.y }
          : obj
      ));
      return;
    }
    
    // Handle dragging stroke in select mode
    if (isSelectMode && isDraggingStroke && selectedStrokeId && dragStartPoint) {
      const dx = point.x - dragStartPoint.x;
      const dy = point.y - dragStartPoint.y;
      setStrokes(prev => prev.map(stroke => 
        stroke.id === selectedStrokeId 
          ? { ...stroke, points: stroke.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
          : stroke
      ));
      setDragStartPoint(point);
      return;
    }
    
    if (drawMode === 'freehand' && isDrawing) {
      setCurrentStroke(prev => [...prev, point]);
    }
    
    // Update preview for line/curve/polyline modes
    if (drawMode === 'line' && lineStartPoint) {
      setCurrentStroke([lineStartPoint, point]);
    } else if (drawMode === 'curve' && curvePoints.length > 0) {
      setCurrentStroke([...curvePoints, point]);
    } else if (drawMode === 'polyline' && polylinePoints.length > 0) {
      setCurrentStroke([...polylinePoints, point]);
    }
  };

  const handleMouseUp = () => {
    // Handle end of drag in select mode
    if (isSelectMode && isRotatingObject) {
      setIsRotatingObject(false);
      return;
    }
    
    if (isSelectMode && isDraggingObject) {
      setIsDraggingObject(false);
      return;
    }
    
    // Handle end of stroke drag in select mode
    if (isSelectMode && isDraggingStroke) {
      setIsDraggingStroke(false);
      setDragStartPoint(null);
      return;
    }
    
    if (drawMode !== 'freehand') return;
    
    if (isDrawing && currentStroke.length > 1) {
      const newStroke: Stroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        points: currentStroke,
        color: COLOR_MAP[lineColor],
        lineType,
        lineWidth: 3,
        drawMode: 'freehand',
      };
      setStrokes(prev => [...prev, newStroke]);
    }
    setIsDrawing(false);
    setCurrentStroke([]);
  };

  // Delete selected item (object or stroke)
  const handleDeleteSelected = () => {
    if (selectedObjectId) {
      setPlacedObjects(prev => prev.filter(obj => obj.id !== selectedObjectId));
      setSelectedObjectId(null);
    }
    if (selectedStrokeId) {
      setStrokes(prev => prev.filter(s => s.id !== selectedStrokeId));
      setSelectedStrokeId(null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (drawMode !== 'freehand') {
      // For line/curve modes, treat touch as click
      const point = getCanvasCoords(e);
      if (!point) return;
      
      if (drawMode === 'line') {
        if (!lineStartPoint) {
          setLineStartPoint(point);
        } else {
          const newStroke: Stroke = {
            id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            points: [lineStartPoint, point],
            color: COLOR_MAP[lineColor],
            lineType,
            lineWidth: 3,
            drawMode: 'line',
          };
          setStrokes(prev => [...prev, newStroke]);
          setLineStartPoint(null);
        }
      } else if (drawMode === 'curve') {
        if (curvePoints.length < 2) {
          setCurvePoints(prev => [...prev, point]);
        } else {
          const newStroke: Stroke = {
            id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            points: [...curvePoints, point],
            color: COLOR_MAP[lineColor],
            lineType,
            lineWidth: 3,
            drawMode: 'curve',
          };
          setStrokes(prev => [...prev, newStroke]);
          setCurvePoints([]);
        }
      }
      return;
    }
    
    const point = getCanvasCoords(e);
    if (point) {
      setIsDrawing(true);
      setCurrentStroke([point]);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (drawMode !== 'freehand' || !isDrawing) return;
    
    const point = getCanvasCoords(e);
    if (point) {
      setCurrentStroke(prev => [...prev, point]);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (drawMode === 'freehand') {
      handleMouseUp();
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setLineStartPoint(null);
    setCurvePoints([]);
    setPolylinePoints([]);
    setPlacedObjects([]);
    setSelectedObjectId(null);
    setSelectedStrokeId(null);
    setMarkerCounters({});
  };

  const handleSave = () => {
    // Generate image preview from canvas
    const canvas = canvasRef.current;
    let imagePreview = '';
    if (canvas) {
      imagePreview = canvas.toDataURL('image/png');
    }
    
    const data = JSON.stringify({
      strokes,
      rinkView,
      placedObjects,
      imagePreview,
    });
    onSave(data);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Rink view options for toolbar
  const rinkViewButtons: { view: RinkView; label: string; abbrev: string }[] = [
    { view: 'full', label: 'Full Rink', abbrev: 'F' },
    { view: 'half', label: 'Half Rink', abbrev: 'H' },
    { view: 'neutral', label: 'Neutral Zone', abbrev: 'N' },
    { view: 'quarter', label: 'Quarter Ice', abbrev: 'Q' },
  ];

  const colorButtons: { color: LineColor; label: string }[] = [
    { color: 'blue', label: 'Blue' },
    { color: 'red', label: 'Red' },
    { color: 'black', label: 'Black' },
    { color: 'gray', label: 'Gray' },
  ];

  const lineTypeButtons: { type: LineType; label: string }[] = [
    { type: 'solid', label: 'Solid' },
    { type: 'dashed', label: 'Dashed' },
    { type: 'double', label: 'Double' },
    { type: 'squiggly', label: 'Squiggly' },
  ];

  const drawModeButtons: { mode: DrawMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'freehand', label: 'Freehand', icon: <Pencil className="w-4 h-4" /> },
    { mode: 'line', label: 'Line', icon: <Minus className="w-4 h-4" /> },
    { mode: 'curve', label: 'Curve', icon: <SplineIcon className="w-4 h-4" /> },
    { mode: 'polyline', label: 'Polyline', icon: <GitBranch className="w-4 h-4" /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Sketch Drill" size={rinkView === 'full' ? 'fullRink' : 'xl'}>
      <div className="flex gap-3">
        {/* Vertical Toolbar - Left Side (2 columns) */}
        <div className="flex flex-col gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg shrink-0">
          {/* Rink View Selection - 2x2 grid */}
          <div className="grid grid-cols-2 gap-1">
            {rinkViewButtons.map(({ view, label, abbrev }) => (
              <button
                key={view}
                type="button"
                title={label}
                onClick={() => setRinkView(view)}
                className={`
                  w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-xs font-bold
                  ${rinkView === view
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400 text-gray-800 dark:text-gray-200'}
                `}
              >
                {abbrev}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-300 dark:bg-gray-600" />

          {/* Select Tool */}
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              title="Select & Move"
              onClick={() => {
                setIsSelectMode(true);
                setIsPlaceMode(false);
                setLineStartPoint(null);
                setCurvePoints([]);
                setPolylinePoints([]);
                setCurrentStroke([]);
              }}
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                ${isSelectMode
                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
              `}
            >
              <MousePointer2 className="w-4 h-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-300 dark:bg-gray-600" />

          {/* Draw Mode Selection - 2x2 grid */}
          <div className="grid grid-cols-2 gap-1">
            {drawModeButtons.map(({ mode, label, icon }) => (
              <button
                key={mode}
                type="button"
                title={label}
                onClick={() => {
                  setDrawMode(mode);
                  setIsPlaceMode(false);
                  setIsSelectMode(false);
                  setSelectedObjectId(null);
                  setSelectedStrokeId(null);
                  setLineStartPoint(null);
                  setCurvePoints([]);
                  setPolylinePoints([]);
                  setCurrentStroke([]);
                }}
                className={`
                  w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                  ${!isPlaceMode && !isSelectMode && drawMode === mode 
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' 
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
                `}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-300 dark:bg-gray-600" />

          {/* Line Type Selection - 2 columns (3rd wraps) */}
          <div className="grid grid-cols-2 gap-1">
            {lineTypeButtons.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                title={label}
                onClick={() => setLineType(type)}
                className={`
                  w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                  ${lineType === type 
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' 
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
                `}
              >
                {type === 'solid' ? (
                  <svg className="w-5 h-3" viewBox="0 0 24 6" aria-hidden="true">
                    <line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="3" />
                  </svg>
                ) : type === 'dashed' ? (
                  <svg className="w-5 h-3" viewBox="0 0 24 6" aria-hidden="true">
                    <line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="3" strokeDasharray="5 3" />
                  </svg>
                ) : type === 'double' ? (
                  <svg className="w-5 h-3" viewBox="0 0 24 6" aria-hidden="true">
                    <line x1="0" y1="1" x2="24" y2="1" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="0" y1="5" x2="24" y2="5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                ) : (
                  <svg className="w-5 h-3" viewBox="0 0 24 6" aria-hidden="true">
                    <path d="M0,3 Q3,0 6,3 Q9,6 12,3 Q15,0 18,3 Q21,6 24,3" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-300 dark:bg-gray-600" />

          {/* Color Selection - 2x2 grid */}
          <div className="grid grid-cols-2 gap-1">
            {colorButtons.map(({ color, label }) => (
              <button
                key={color}
                type="button"
                onClick={() => setLineColor(color)}
                className={`
                  w-6 h-6 rounded-full border-2 transition-all mx-auto
                  ${lineColor === color ? 'ring-2 ring-offset-1 ring-primary-500 dark:ring-offset-gray-800' : ''}
                `}
                style={{ backgroundColor: COLOR_MAP[color], borderColor: color === 'black' ? '#374151' : COLOR_MAP[color] }}
                title={label}
                aria-label={label}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-300 dark:bg-gray-600" />

          {/* Player Markers - uses selected line color */}
          <div className="grid grid-cols-2 gap-1">
            {([
              { type: 'plain' as PlayerMarkerType, label: '', title: 'Plain (no label)' },
              { type: 'numbered' as PlayerMarkerType, label: '#', title: 'Auto-numbered (1, 2, 3...)' },
              { type: 'X' as PlayerMarkerType, label: 'X', title: 'X' },
              { type: 'O' as PlayerMarkerType, label: 'O', title: 'O' },
              { type: 'C' as PlayerMarkerType, label: 'C', title: 'Center' },
              { type: 'F' as PlayerMarkerType, label: 'F', title: 'Forward' },
              { type: 'LW' as PlayerMarkerType, label: 'LW', title: 'Left Wing' },
              { type: 'RW' as PlayerMarkerType, label: 'RW', title: 'Right Wing' },
              { type: 'D' as PlayerMarkerType, label: 'D', title: 'Defense' },
              { type: 'G' as PlayerMarkerType, label: 'G', title: 'Goalie' },
              { type: 'Fx' as PlayerMarkerType, label: 'F#', title: 'Forward numbered (F1, F2...)' },
              { type: 'Dx' as PlayerMarkerType, label: 'D#', title: 'Defense numbered (D1, D2...)' },
              { type: 'Xx' as PlayerMarkerType, label: 'X#', title: 'X numbered (X1, X2...)' },
              { type: 'Ox' as PlayerMarkerType, label: 'O#', title: 'O numbered (O1, O2...)' },
            ]).map(({ type, label, title }) => (
              <button
                key={type}
                type="button"
                title={title}
                onClick={() => {
                  setIsPlaceMode(true);
                  setIsSelectMode(false);
                  setSelectedObjectId(null);
                  setSelectedStrokeId(null);
                  setPlaceableType('player');
                  // Use lineColor but map gray to black for players
                  setPlayerColor(lineColor === 'gray' ? 'black' : lineColor);
                  setPlayerMarkerType(type);
                }}
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-white font-bold transition-all border border-transparent
                  ${isPlaceMode && placeableType === 'player' && playerMarkerType === type
                    ? 'ring-2 ring-offset-1 ring-primary-500 dark:ring-offset-gray-800'
                    : ''}
                `}
                style={{ 
                  backgroundColor: COLOR_MAP[lineColor === 'gray' ? 'black' : lineColor],
                  fontSize: label.length > 1 ? '8px' : '10px',
                  borderColor: lineColor === 'black' ? 'rgba(229, 231, 235, 0.35)' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Coach (Gray) - special marker */}
          <div className="flex justify-center">
            <button
              type="button"
              title="Coach (Gray)"
              onClick={() => {
                setIsPlaceMode(true);
                setIsSelectMode(false);
                setSelectedObjectId(null);
                setSelectedStrokeId(null);
                setPlaceableType('player');
                setPlayerColor('gray');
                setPlayerMarkerType('C');
              }}
              className={`
                w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-all
                ${isPlaceMode && placeableType === 'player' && playerColor === 'gray'
                  ? 'ring-2 ring-offset-1 ring-primary-500 dark:ring-offset-gray-800'
                  : ''}
              `}
              style={{ backgroundColor: '#6B7280' }}
            >
              C
            </button>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-300 dark:bg-gray-600" />

          {/* Equipment - 2 columns */}
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              title="Cone"
              onClick={() => {
                setIsPlaceMode(true);
                setIsSelectMode(false);
                setSelectedObjectId(null);
                setSelectedStrokeId(null);
                setPlaceableType('cone');
              }}
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                ${isPlaceMode && placeableType === 'cone'
                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
              `}
            >
              <svg className="w-4 h-5" viewBox="0 0 24 28" fill="none" aria-hidden="true">
                <path d="M9 2L15 2L19 22L5 22Z" fill="#F97316" stroke="#C2410C" strokeWidth="1.5" />
                <path d="M6.5 17L17.5 17" stroke="white" strokeWidth="2.5" />
                <path d="M8 9L16 9" stroke="white" strokeWidth="2" />
                <rect x="3" y="22" width="18" height="4" fill="#1F2937" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              title="Net"
              onClick={() => {
                setIsPlaceMode(true);
                setIsSelectMode(false);
                setSelectedObjectId(null);
                setSelectedStrokeId(null);
                setPlaceableType('net');
              }}
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                ${isPlaceMode && placeableType === 'net'
                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
              `}
            >
              <svg className="w-5 h-4" viewBox="0 0 28 22" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="24" height="18" stroke="#DC2626" strokeWidth="3" fill="none" />
                <line x1="8" y1="2" x2="8" y2="20" stroke="#9CA3AF" strokeWidth="1" />
                <line x1="14" y1="2" x2="14" y2="20" stroke="#9CA3AF" strokeWidth="1" />
                <line x1="20" y1="2" x2="20" y2="20" stroke="#9CA3AF" strokeWidth="1" />
                <line x1="2" y1="8" x2="26" y2="8" stroke="#9CA3AF" strokeWidth="1" />
                <line x1="2" y1="14" x2="26" y2="14" stroke="#9CA3AF" strokeWidth="1" />
              </svg>
            </button>
            <button
              type="button"
              title="Small Net"
              onClick={() => {
                setIsPlaceMode(true);
                setIsSelectMode(false);
                setSelectedObjectId(null);
                setSelectedStrokeId(null);
                setPlaceableType('smallNet');
              }}
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                ${isPlaceMode && placeableType === 'smallNet'
                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
              `}
            >
              <svg className="w-4 h-3" viewBox="0 0 20 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="16" height="12" stroke="#3B82F6" strokeWidth="2" fill="none" />
                <line x1="10" y1="2" x2="10" y2="14" stroke="#9CA3AF" strokeWidth="1" />
                <line x1="2" y1="8" x2="18" y2="8" stroke="#9CA3AF" strokeWidth="1" />
              </svg>
            </button>
            <button
              type="button"
              title="Pucks"
              onClick={() => {
                setIsPlaceMode(true);
                setIsSelectMode(false);
                setSelectedObjectId(null);
                setSelectedStrokeId(null);
                setPlaceableType('pucks');
              }}
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                ${isPlaceMode && placeableType === 'pucks'
                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
              `}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {/* Three pucks in a triangular pile */}
                <circle cx="8" cy="16" r="5" fill="#1F2937" stroke="#111827" strokeWidth="1" />
                <circle cx="16" cy="16" r="5" fill="#1F2937" stroke="#111827" strokeWidth="1" />
                <circle cx="12" cy="9" r="5" fill="#1F2937" stroke="#111827" strokeWidth="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content - Canvas and Controls */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Canvas */}
          <div className="flex justify-center items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-auto min-h-[300px]">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="border border-gray-300 dark:border-gray-600 rounded cursor-crosshair bg-white touch-none"
              style={{ maxWidth: '100%', height: 'auto' }}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>

          {/* Action Buttons with Mode Instructions */}
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={handleClear}>
              <Eraser className="w-4 h-4" />
              Clear
            </Button>
            
            {/* Mode instructions - centered */}
            <div className="flex-1 text-xs text-center text-gray-500 dark:text-gray-400">
              {isSelectMode ? (
                (selectedObjectId || selectedStrokeId)
                  ? 'Drag to move, or click Delete' 
                  : 'Click an object or line to select it'
              ) : isPlaceMode ? (
                placeableType === 'player' 
                  ? (playerColor === 'gray' 
                      ? 'Click to place coach' 
                      : (() => {
                          const markerLabels: Record<PlayerMarkerType, string> = {
                            plain: 'plain circle',
                            numbered: 'numbered circle',
                            X: 'X',
                            O: 'O',
                            C: 'center (C)',
                            F: 'forward (F)',
                            LW: 'left wing (LW)',
                            RW: 'right wing (RW)',
                            D: 'defense (D)',
                            G: 'goalie (G)',
                            Fx: 'forward numbered (F1, F2...)',
                            Dx: 'defense numbered (D1, D2...)',
                            Xx: 'X numbered (X1, X2...)',
                            Ox: 'O numbered (O1, O2...)',
                          };
                          return `Click to place ${playerColor} ${markerLabels[playerMarkerType]}`;
                        })()
                    )
                  : placeableType === 'cone'
                    ? 'Click to place cone'
                    : placeableType === 'net'
                      ? 'Click to place net'
                      : placeableType === 'smallNet'
                        ? 'Click to place small net'
                        : 'Click to place pucks'
              ) : drawMode === 'freehand' ? (
                'Click and drag to draw'
              ) : drawMode === 'line' ? (
                lineStartPoint 
                  ? 'Click to set the end point' 
                  : 'Click to set the start point'
              ) : drawMode === 'curve' ? (
                curvePoints.length === 0 
                  ? 'Click to set the start point' 
                  : curvePoints.length === 1 
                    ? 'Click to set the control point' 
                    : 'Click to set the end point'
              ) : drawMode === 'polyline' ? (
                polylinePoints.length === 0 
                  ? 'Click to add points, double-click to finish' 
                  : `${polylinePoints.length} point(s) - double-click to finish`
              ) : null}
            </div>
            
            {/* Delete button - shown when object or stroke is selected */}
            {isSelectMode && (selectedObjectId || selectedStrokeId) && (
              <Button type="button" variant="outline" onClick={handleDeleteSelected} className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
            
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button type="button" onClick={handleSave}>
                <Save className="w-4 h-4" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
