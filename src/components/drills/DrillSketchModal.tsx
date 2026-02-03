'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Save, X, Eraser, Maximize2, Minimize2, Pencil, Minus, SplineIcon, GitBranch, MousePointer2, Trash2 } from 'lucide-react';

interface DrillSketchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sketchData: string) => void;
  initialSketchData?: string;
}

type RinkView = 'full' | 'half';
type LineColor = 'blue' | 'red' | 'black' | 'gray';
type LineType = 'solid' | 'dashed' | 'squiggly';
type DrawMode = 'freehand' | 'line' | 'curve' | 'polyline';
type PlaceableType = 'player' | 'cone' | 'net' | 'smallNet';
type PlayerColor = 'blue' | 'red';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
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
  playerNumber?: number; // 1-5 for player type
  playerColor?: PlayerColor; // blue or red for player type
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
  const [playerNumber, setPlayerNumber] = useState<number>(1);
  const [playerColor, setPlayerColor] = useState<PlayerColor>('blue');
  
  // Selection state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  
  // Canvas dimensions - maintain proper NHL aspect ratios
  // Full rink: 200 x 85 ft = 2.35:1 ratio
  // Half rink: ~80 x 85 ft (goal line to past blue line) = ~0.94:1 ratio
  const CANVAS_WIDTH_FULL = 800;
  const CANVAS_HEIGHT_FULL = Math.round(800 * (NHL.rinkWidth / NHL.rinkLength)); // ~340px
  const CANVAS_WIDTH_HALF = 550; // Smaller width to fit in modal
  const CANVAS_HEIGHT_HALF = Math.round(550 * (80 / NHL.rinkWidth)); // ~518px, maintains proper aspect
  
  const canvasWidth = rinkView === 'full' ? CANVAS_WIDTH_FULL : CANVAS_WIDTH_HALF;
  const canvasHeight = rinkView === 'full' ? CANVAS_HEIGHT_FULL : CANVAS_HEIGHT_HALF;

  // Load initial sketch data
  useEffect(() => {
    if (initialSketchData && isOpen) {
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
        }
      } catch {
        // Invalid data, start fresh
        setStrokes([]);
        setPlacedObjects([]);
      }
    }
  }, [initialSketchData, isOpen]);

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
      
    } else {
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

  // Helper to draw a squiggly line along a path of points with consistent wavelength
  const drawSquigglyPath = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;
    
    const waveLength = 20; // Fixed wavelength in pixels
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

  // Draw all strokes
  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D, strokesToDraw: Stroke[]) => {
    strokesToDraw.forEach(stroke => {
      if (stroke.points.length < 2) return;
      
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
          drawSquigglyLine(ctx, stroke.points[0].x, stroke.points[0].y, stroke.points[1].x, stroke.points[1].y);
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
          ctx.stroke();
        }
      } else if (stroke.drawMode === 'curve' && stroke.points.length === 3) {
        // Curved line mode - sample curve into points for squiggly
        if (stroke.lineType === 'squiggly') {
          const curvePoints: Point[] = [];
          const segments = 20;
          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            curvePoints.push({
              x: (1-t)*(1-t)*stroke.points[0].x + 2*(1-t)*t*stroke.points[1].x + t*t*stroke.points[2].x,
              y: (1-t)*(1-t)*stroke.points[0].y + 2*(1-t)*t*stroke.points[1].y + t*t*stroke.points[2].y,
            });
          }
          drawSquigglyPath(ctx, curvePoints);
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          ctx.quadraticCurveTo(stroke.points[1].x, stroke.points[1].y, stroke.points[2].x, stroke.points[2].y);
          ctx.stroke();
        }
      } else if (stroke.drawMode === 'polyline' && stroke.points.length >= 2) {
        // Polyline mode - connected line segments
        if (stroke.lineType === 'squiggly') {
          drawSquigglyPath(ctx, stroke.points);
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        }
      } else {
        // Freehand mode
        if (stroke.lineType === 'squiggly') {
          drawSquigglyPath(ctx, stroke.points);
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
      } else {
        // For all other modes, use average direction from last ~30px
        const result = getAverageEndDirection(stroke.points);
        arrowAngle = result.angle;
        arrowEndPoint = result.endPoint;
      }
      
      drawArrowheadAtAngle(ctx, arrowEndPoint, arrowAngle, stroke.color);
    });
  }, [drawSquigglyLine, drawSquigglyPath, getAverageEndDirection, drawArrowheadAtAngle]);

  // Hit test for placed objects - returns object id if point is inside
  const hitTestObject = useCallback((point: Point, objects: PlacedObject[]): string | null => {
    // Check in reverse order (top objects first)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const dx = point.x - obj.x;
      const dy = point.y - obj.y;
      
      if (obj.type === 'player') {
        const radius = 12;
        if (dx * dx + dy * dy <= radius * radius) return obj.id;
      } else if (obj.type === 'cone') {
        const hitRadius = 12;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) return obj.id;
      } else if (obj.type === 'net') {
        const width = 30, height = 20;
        if (Math.abs(dx) <= width / 2 && Math.abs(dy) <= height / 2) return obj.id;
      } else if (obj.type === 'smallNet') {
        const width = 18, height = 12;
        if (Math.abs(dx) <= width / 2 && Math.abs(dy) <= height / 2) return obj.id;
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
          ctx.arc(obj.x, obj.y, 18, 0, Math.PI * 2);
          ctx.stroke();
        } else if (obj.type === 'cone') {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 16, 0, Math.PI * 2);
          ctx.stroke();
        } else if (obj.type === 'net') {
          ctx.strokeRect(obj.x - 18, obj.y - 13, 36, 26);
        } else if (obj.type === 'smallNet') {
          ctx.strokeRect(obj.x - 12, obj.y - 9, 24, 18);
        }
        ctx.setLineDash([]);
      }
      
      if (obj.type === 'player') {
        // Draw numbered player circle (matching selection bar size ~14px radius)
        const radius = 12;
        const color = obj.playerColor === 'red' ? '#DC2626' : '#2563EB';
        
        // Circle fill
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Circle border
        ctx.strokeStyle = obj.playerColor === 'red' ? '#991B1B' : '#1D4ED8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Number text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(obj.playerNumber || 1), obj.x, obj.y);
        
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
        const width = 30;
        const height = 20;
        
        // Net frame
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 3;
        ctx.strokeRect(obj.x - width / 2, obj.y - height / 2, width, height);
        
        // Net mesh lines
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          const xOffset = (width / 4) * i;
          ctx.beginPath();
          ctx.moveTo(obj.x - width / 2 + xOffset, obj.y - height / 2);
          ctx.lineTo(obj.x - width / 2 + xOffset, obj.y + height / 2);
          ctx.stroke();
        }
        for (let i = 1; i < 3; i++) {
          const yOffset = (height / 3) * i;
          ctx.beginPath();
          ctx.moveTo(obj.x - width / 2, obj.y - height / 2 + yOffset);
          ctx.lineTo(obj.x + width / 2, obj.y - height / 2 + yOffset);
          ctx.stroke();
        }
        
      } else if (obj.type === 'smallNet') {
        // Draw small net (mini goal)
        const width = 18;
        const height = 12;
        
        // Net frame
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x - width / 2, obj.y - height / 2, width, height);
        
        // Net mesh
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y - height / 2);
        ctx.lineTo(obj.x, obj.y + height / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obj.x - width / 2, obj.y);
        ctx.lineTo(obj.x + width / 2, obj.y);
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
    drawStrokes(ctx, strokes);
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
          drawSquigglyLine(ctx, currentStroke[0].x, currentStroke[0].y, currentStroke[1].x, currentStroke[1].y);
        } else {
          ctx.beginPath();
          ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
          ctx.lineTo(currentStroke[1].x, currentStroke[1].y);
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
          if (lineType === 'squiggly') {
            const curvePoints: Point[] = [];
            const segments = 20;
            for (let i = 0; i <= segments; i++) {
              const t = i / segments;
              curvePoints.push({
                x: (1-t)*(1-t)*currentStroke[0].x + 2*(1-t)*t*currentStroke[1].x + t*t*currentStroke[2].x,
                y: (1-t)*(1-t)*currentStroke[0].y + 2*(1-t)*t*currentStroke[1].y + t*t*currentStroke[2].y,
              });
            }
            drawSquigglyPath(ctx, curvePoints);
          } else {
            ctx.beginPath();
            ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
            ctx.quadraticCurveTo(currentStroke[1].x, currentStroke[1].y, currentStroke[2].x, currentStroke[2].y);
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
        if (lineType === 'squiggly') {
          drawSquigglyPath(ctx, currentStroke);
        } else {
          ctx.beginPath();
          ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
          for (let i = 1; i < currentStroke.length; i++) {
            ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
          }
          ctx.stroke();
        }
        // Use average direction for arrowhead
        const result = getAverageEndDirection(currentStroke);
        previewArrowAngle = result.angle;
        previewArrowEndPoint = result.endPoint;
      }
      
      ctx.setLineDash([]);
      
      // Draw arrowhead on preview
      if (previewArrowEndPoint && previewArrowAngle !== null) {
        drawArrowheadAtAngle(ctx, previewArrowEndPoint, previewArrowAngle, COLOR_MAP[lineColor]);
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
  }, [canvasWidth, canvasHeight, rinkView, strokes, currentStroke, lineColor, lineType, drawMode, lineStartPoint, curvePoints, polylinePoints, placedObjects, selectedObjectId, drawRink, drawStrokes, drawPlacedObjects, drawSquigglyLine, drawSquigglyPath, getAverageEndDirection, drawArrowheadAtAngle]);

  // Redraw when dependencies change
  useEffect(() => {
    if (isOpen) {
      redrawCanvas();
    }
  }, [isOpen, redrawCanvas]);

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
    
    // Handle select mode - click to select objects
    if (isSelectMode && !isDraggingObject) {
      const hitId = hitTestObject(point, placedObjects);
      setSelectedObjectId(hitId);
      return;
    }
    
    // Handle place mode - add object to canvas
    if (isPlaceMode) {
      const newObject: PlacedObject = {
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: placeableType,
        x: point.x,
        y: point.y,
        ...(placeableType === 'player' && {
          playerNumber,
          playerColor,
        }),
      };
      setPlacedObjects(prev => [...prev, newObject]);
      
      // Auto-increment player number after placing (1->2->3->4->5->1)
      if (placeableType === 'player' && playerNumber < 5) {
        setPlayerNumber(playerNumber + 1);
      }
      return;
    }
    
    if (drawMode === 'line') {
      // Line mode: click start, click end
      if (!lineStartPoint) {
        setLineStartPoint(point);
      } else {
        const newStroke: Stroke = {
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
      setPolylinePoints(prev => [...prev, point]);
    }
  };

  const handleCanvasDoubleClick = () => {
    if (drawMode === 'polyline' && polylinePoints.length >= 2) {
      // Finish polyline on double-click
      const newStroke: Stroke = {
        points: polylinePoints,
        color: COLOR_MAP[lineColor],
        lineType,
        lineWidth: 3,
        drawMode: 'polyline',
      };
      setStrokes(prev => [...prev, newStroke]);
      setPolylinePoints([]);
      setCurrentStroke([]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    if (!point) return;
    
    // Handle select mode - start dragging if clicking on an object
    if (isSelectMode) {
      const hitId = hitTestObject(point, placedObjects);
      if (hitId) {
        const obj = placedObjects.find(o => o.id === hitId);
        if (obj) {
          setSelectedObjectId(hitId);
          setIsDraggingObject(true);
          setDragOffset({ x: point.x - obj.x, y: point.y - obj.y });
        }
      } else {
        setSelectedObjectId(null);
      }
      return;
    }
    
    if (drawMode !== 'freehand') return;
    
    setIsDrawing(true);
    setCurrentStroke([point]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    if (!point) return;
    
    // Handle dragging in select mode
    if (isSelectMode && isDraggingObject && selectedObjectId) {
      setPlacedObjects(prev => prev.map(obj => 
        obj.id === selectedObjectId 
          ? { ...obj, x: point.x - dragOffset.x, y: point.y - dragOffset.y }
          : obj
      ));
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
    if (isSelectMode && isDraggingObject) {
      setIsDraggingObject(false);
      return;
    }
    
    if (drawMode !== 'freehand') return;
    
    if (isDrawing && currentStroke.length > 1) {
      const newStroke: Stroke = {
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

  // Delete selected object
  const handleDeleteSelected = () => {
    if (selectedObjectId) {
      setPlacedObjects(prev => prev.filter(obj => obj.id !== selectedObjectId));
      setSelectedObjectId(null);
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

  const toggleRinkView = () => {
    setRinkView(prev => prev === 'full' ? 'half' : 'full');
  };

  const colorButtons: { color: LineColor; label: string }[] = [
    { color: 'blue', label: 'Blue' },
    { color: 'red', label: 'Red' },
    { color: 'black', label: 'Black' },
    { color: 'gray', label: 'Gray' },
  ];

  const lineTypeButtons: { type: LineType; label: string }[] = [
    { type: 'solid', label: 'Solid' },
    { type: 'dashed', label: 'Dashed' },
    { type: 'squiggly', label: 'Squiggly' },
  ];

  const drawModeButtons: { mode: DrawMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'freehand', label: 'Freehand', icon: <Pencil className="w-4 h-4" /> },
    { mode: 'line', label: 'Line', icon: <Minus className="w-4 h-4" /> },
    { mode: 'curve', label: 'Curve', icon: <SplineIcon className="w-4 h-4" /> },
    { mode: 'polyline', label: 'Polyline', icon: <GitBranch className="w-4 h-4" /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Sketch Drill" size="xl">
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {/* Rink View Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">View:</span>
            <Button
              type="button"
              size="sm"
              variant={rinkView === 'half' ? 'primary' : 'outline'}
              onClick={toggleRinkView}
            >
              {rinkView === 'full' ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
              {rinkView === 'full' ? 'Full Rink' : 'Half Rink'}
            </Button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

          {/* Color Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Color:</span>
            <div className="flex gap-1">
              {colorButtons.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setLineColor(color)}
                  className={`
                    w-7 h-7 rounded-full border-2 transition-all
                    ${lineColor === color ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800' : ''}
                  `}
                  style={{ backgroundColor: COLOR_MAP[color], borderColor: color === 'black' ? '#374151' : COLOR_MAP[color] }}
                  title={label}
                  aria-label={label}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

          {/* Line Type Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Style:</span>
            <div className="flex gap-1">
              {lineTypeButtons.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  title={label}
                  onClick={() => setLineType(type)}
                  className={`
                    p-1.5 rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                    ${lineType === type 
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' 
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
                  `}
                >
                  {type === 'solid' ? (
                    <svg className="w-6 h-4" viewBox="0 0 24 6" aria-hidden="true">
                      <line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="3" />
                    </svg>
                  ) : type === 'dashed' ? (
                    <svg className="w-6 h-4" viewBox="0 0 24 6" aria-hidden="true">
                      <line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="3" strokeDasharray="5 3" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-4" viewBox="0 0 24 6" aria-hidden="true">
                      <path d="M0,3 Q3,0 6,3 Q9,6 12,3 Q15,0 18,3 Q21,6 24,3" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

          {/* Select Tool */}
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
              p-1.5 rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
              ${isSelectMode
                ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
            `}
          >
            <MousePointer2 className="w-4 h-4" />
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

          {/* Draw Mode Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Draw:</span>
            <div className="flex gap-1">
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
                    setLineStartPoint(null);
                    setCurvePoints([]);
                    setPolylinePoints([]);
                    setCurrentStroke([]);
                  }}
                  className={`
                    p-1.5 rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
                    ${!isPlaceMode && !isSelectMode && drawMode === mode 
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' 
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
                  `}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Objects Toolbar */}
        <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Place:</span>
          
          {/* Player circles */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {/* Blue players 1-5 */}
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={`blue-${num}`}
                  type="button"
                  title={`Blue Player ${num}`}
                  onClick={() => {
                    setIsPlaceMode(true);
                    setIsSelectMode(false);
                    setSelectedObjectId(null);
                    setPlaceableType('player');
                    setPlayerNumber(num);
                    setPlayerColor('blue');
                  }}
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all
                    ${isPlaceMode && placeableType === 'player' && playerNumber === num && playerColor === 'blue'
                      ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800'
                      : ''}
                  `}
                  style={{ backgroundColor: '#2563EB' }}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {/* Red players 1-5 */}
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={`red-${num}`}
                  type="button"
                  title={`Red Player ${num}`}
                  onClick={() => {
                    setIsPlaceMode(true);
                    setIsSelectMode(false);
                    setSelectedObjectId(null);
                    setPlaceableType('player');
                    setPlayerNumber(num);
                    setPlayerColor('red');
                  }}
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all
                    ${isPlaceMode && placeableType === 'player' && playerNumber === num && playerColor === 'red'
                      ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800'
                      : ''}
                  `}
                  style={{ backgroundColor: '#DC2626' }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

          {/* Cone */}
          <button
            type="button"
            title="Cone"
            onClick={() => {
              setIsPlaceMode(true);
              setIsSelectMode(false);
              setSelectedObjectId(null);
              setPlaceableType('cone');
            }}
            className={`
              p-1.5 rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
              ${isPlaceMode && placeableType === 'cone'
                ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
            `}
          >
            <svg className="w-5 h-6" viewBox="0 0 24 28" fill="none" aria-hidden="true">
              {/* Traffic cone - tapered trapezoid shape */}
              <path d="M9 2L15 2L19 22L5 22Z" fill="#F97316" stroke="#C2410C" strokeWidth="1.5" />
              {/* White stripes */}
              <path d="M6.5 17L17.5 17" stroke="white" strokeWidth="2.5" />
              <path d="M8 9L16 9" stroke="white" strokeWidth="2" />
              {/* Base */}
              <rect x="3" y="22" width="18" height="4" fill="#1F2937" rx="1" />
            </svg>
          </button>

          {/* Net */}
          <button
            type="button"
            title="Net"
            onClick={() => {
              setIsPlaceMode(true);
              setIsSelectMode(false);
              setSelectedObjectId(null);
              setPlaceableType('net');
            }}
            className={`
              p-1.5 rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
              ${isPlaceMode && placeableType === 'net'
                ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
            `}
          >
            <svg className="w-6 h-5" viewBox="0 0 28 22" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="24" height="18" stroke="#DC2626" strokeWidth="3" fill="none" />
              <line x1="8" y1="2" x2="8" y2="20" stroke="#9CA3AF" strokeWidth="1" />
              <line x1="14" y1="2" x2="14" y2="20" stroke="#9CA3AF" strokeWidth="1" />
              <line x1="20" y1="2" x2="20" y2="20" stroke="#9CA3AF" strokeWidth="1" />
              <line x1="2" y1="8" x2="26" y2="8" stroke="#9CA3AF" strokeWidth="1" />
              <line x1="2" y1="14" x2="26" y2="14" stroke="#9CA3AF" strokeWidth="1" />
            </svg>
          </button>

          {/* Small Net */}
          <button
            type="button"
            title="Small Net"
            onClick={() => {
              setIsPlaceMode(true);
              setIsSelectMode(false);
              setSelectedObjectId(null);
              setPlaceableType('smallNet');
            }}
            className={`
              p-1.5 rounded-lg border-2 transition-all text-gray-800 dark:text-gray-200
              ${isPlaceMode && placeableType === 'smallNet'
                ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400'}
            `}
          >
            <svg className="w-5 h-4" viewBox="0 0 20 16" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="16" height="12" stroke="#3B82F6" strokeWidth="2" fill="none" />
              <line x1="10" y1="2" x2="10" y2="14" stroke="#9CA3AF" strokeWidth="1" />
              <line x1="2" y1="8" x2="18" y2="8" stroke="#9CA3AF" strokeWidth="1" />
            </svg>
          </button>
        </div>

        {/* Canvas */}
        <div className="flex justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-auto">
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
              selectedObjectId 
                ? 'Drag to move, or click Delete' 
                : 'Click an object to select it'
            ) : isPlaceMode ? (
              placeableType === 'player' 
                ? `Click to place ${playerColor} player ${playerNumber}`
                : placeableType === 'cone'
                  ? 'Click to place cone'
                  : placeableType === 'net'
                    ? 'Click to place net'
                    : 'Click to place small net'
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
          
          {/* Delete button - only shown when object is selected */}
          {isSelectMode && selectedObjectId && (
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
    </Modal>
  );
}
