import { jsPDF } from 'jspdf';
import type { PracticePlan, Drill, TimelineItem, DrillItem, ParallelSplitItem, PracticeGroup } from './types';
import { getTimelineItemDuration, secondsToDurationString, flattenTimelineDrills, getEffectiveDrill } from './types';
import { format } from 'date-fns';
import { refreshPlanDrillData } from './db';

// Helper to extract image preview and aspect ratio from sketch data
interface SketchInfo {
  imagePreview: string;
  aspectRatio: number; // width / height
}

function getSketchInfo(sketchData?: string): SketchInfo | null {
  if (!sketchData) return null;
  try {
    const data = JSON.parse(sketchData);
    if (!data.imagePreview) return null;

    // Calculate aspect ratio based on rink view (width / height)
    // These match the canvas dimensions in DrillSketchModal.tsx
    // Full rink: 1000 x 425 = 2.35:1 ratio (200ft x 85ft)
    // Half rink: 550 x 518 = 1.06:1 ratio (85ft wide x 80ft deep)
    // Neutral zone: 550 x 324 = 1.70:1 ratio (85ft wide x 50ft deep)
    // Quarter ice: 400 x 471 = 0.85:1 ratio (42.5ft wide x 50ft deep)
    let aspectRatio: number;
    switch (data.rinkView) {
      case 'full':
        aspectRatio = 200 / 85; // ~2.35
        break;
      case 'half':
        aspectRatio = 85 / 80; // ~1.06
        break;
      case 'neutral':
        aspectRatio = 85 / 50; // ~1.70
        break;
      case 'quarter':
        aspectRatio = 42.5 / 50; // ~0.85
        break;
      default:
        // Default to half rink for backwards compatibility
        aspectRatio = 85 / 80; // ~1.06
    }

    return {
      imagePreview: data.imagePreview,
      aspectRatio,
    };
  } catch {
    return null;
  }
}

const getLocationLabel = (location: PracticePlan['location']) => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  return location.name || location.formattedAddress || '';
};

// Helper to split setup text into bullet points (by sentences)
function splitSetupIntoBullets(setup: string): string[] {
  if (!setup) return [];
  // Split by sentence endings (. ! ?) followed by space or end of string
  // Also handle cases where sentences might be separated by newlines
  const sentences = setup
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return sentences;
}

// ============================================
// PDF layout
// ============================================
// Every block is measured before it is drawn, so page breaks only fall
// between drills, and group bars are drawn one page segment at a time.

// All units in mm (jsPDF default, A4 portrait)
const MARGIN_X = 12;
const PAGE_TOP = 12;
const PAGE_BOTTOM = 285;
const LINE_HEIGHT = 3.5;
const BODY_FONT_SIZE = 8;
const TITLE_FONT_SIZE = 9;
const TITLE_BASELINE = 3; // From a block's top to its first baseline
const DESCENDER = 1; // From the last baseline to the bottom of the text
const SKETCH_COLUMN_WIDTH = 45;
const SKETCH_MIN_HEIGHT = 25;
const DIVIDER_GAP = 2.5; // Space above and below a divider
const DIVIDER_COLOR: Rgb = { r: 226, g: 228, b: 232 };
const SPLIT_COLOR: Rgb = { r: 59, g: 130, b: 246 };
const GROUP_BAR_OFFSET = 4; // From the group's left edge to its bar
const GROUP_DRILL_INDENT = 10; // From the group's left edge to its drills

interface Rgb { r: number; g: number; b: number }

function hexToRgb(hex: string): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : SPLIT_COLOR;
}

// A group's vertical bar, open while the group's drills are being drawn
interface GroupBar {
  x: number;
  color: Rgb;
  segmentStartY: number;
}

class PdfCursor {
  y = PAGE_TOP;
  private openBars: GroupBar[] = [];

  constructor(readonly doc: jsPDF) {}

  get pageWidth() {
    return this.doc.internal.pageSize.getWidth();
  }

  fits(height: number) {
    return this.y + height <= PAGE_BOTTOM;
  }

  // Start a new page unless the block fits. A block taller than a whole
  // page is drawn at the top of a fresh page and allowed to overflow.
  ensureSpace(height: number) {
    if (!this.fits(height) && this.y > PAGE_TOP) {
      this.newPage();
    }
  }

  newPage() {
    for (const bar of this.openBars) {
      this.drawBarSegment(bar, this.y);
    }
    this.doc.addPage();
    this.y = PAGE_TOP;
    for (const bar of this.openBars) {
      bar.segmentStartY = this.y;
    }
  }

  openBar(x: number, color: Rgb) {
    this.openBars.push({ x, color, segmentStartY: this.y });
  }

  closeBar() {
    const bar = this.openBars.pop();
    if (bar) this.drawBarSegment(bar, this.y);
  }

  private drawBarSegment(bar: GroupBar, endY: number) {
    if (endY <= bar.segmentStartY) return;
    this.doc.setDrawColor(bar.color.r, bar.color.g, bar.color.b);
    this.doc.setLineWidth(0.5);
    this.doc.line(bar.x, bar.segmentStartY, bar.x, endY);
  }

  divider(left: number) {
    this.y += DIVIDER_GAP;
    this.doc.setDrawColor(DIVIDER_COLOR.r, DIVIDER_COLOR.g, DIVIDER_COLOR.b);
    this.doc.setLineWidth(0.2);
    this.doc.line(left, this.y, this.pageWidth - MARGIN_X, this.y);
    this.y += DIVIDER_GAP;
  }
}

// A positioned run of text inside a drill block, relative to the block's top
interface TextOp {
  text: string | string[];
  dx: number;
  dy: number;
  bold: boolean;
  fontSize: number;
}

interface DrillLayout {
  height: number;
  draw: (cursor: PdfCursor, left: number) => void;
}

function layoutDrill(doc: jsPDF, item: DrillItem, number: number, availableWidth: number): DrillLayout {
  const drill = getEffectiveDrill(item);
  const duration = item.customDuration || drill.duration;
  const sketchInfo = getSketchInfo(drill.sketchData);
  const textWidth = sketchInfo ? availableWidth - SKETCH_COLUMN_WIDTH - 3 : availableWidth;
  const bodyIndent = 2;

  const ops: TextOp[] = [];
  let baseline = TITLE_BASELINE;

  ops.push({ text: `${number}. ${drill.name} (${duration})`, dx: 0, dy: baseline, bold: true, fontSize: TITLE_FONT_SIZE });
  baseline += 4;

  doc.setFontSize(BODY_FONT_SIZE);
  doc.setFont('helvetica', 'normal');

  const addBody = (text: string, dx = bodyIndent, width = textWidth) => {
    const lines: string[] = doc.splitTextToSize(text, width);
    ops.push({ text: lines, dx, dy: baseline, bold: false, fontSize: BODY_FONT_SIZE });
    baseline += lines.length * LINE_HEIGHT;
  };

  if (drill.objective) {
    addBody(`Objective: ${drill.objective}`);
  }

  if (drill.setup) {
    const setupBullets = splitSetupIntoBullets(drill.setup);
    if (setupBullets.length > 1) {
      for (const bullet of setupBullets) {
        addBody(`• ${bullet}`, bodyIndent + 2, textWidth - 4);
      }
    } else {
      addBody(drill.setup);
    }
  }

  if (drill.execution) {
    addBody(`Execution: ${drill.execution}`);
  }

  if (drill.coachingPoints) {
    const label = 'Coaching Points: ';
    doc.setFont('helvetica', 'bold');
    const labelWidth = doc.getTextWidth(label);
    doc.setFont('helvetica', 'normal');
    ops.push({ text: label, dx: bodyIndent, dy: baseline, bold: true, fontSize: BODY_FONT_SIZE });

    // Hanging indent: every line of the points lines up after the label
    addBody(drill.coachingPoints.trim(), bodyIndent + labelWidth, textWidth - labelWidth);
  }

  if (item.selectedVariations && item.selectedVariations.length > 0) {
    addBody(`Variations: ${item.selectedVariations.join(', ')}`);
  }

  const textHeight = baseline - LINE_HEIGHT + DESCENDER;

  let sketchWidth = 0;
  let sketchHeight = 0;
  if (sketchInfo) {
    // Sketches match the text height (with a floor), scaled down to fit the column
    sketchHeight = Math.max(textHeight, SKETCH_MIN_HEIGHT);
    sketchWidth = sketchHeight * sketchInfo.aspectRatio;
    if (sketchWidth > SKETCH_COLUMN_WIDTH) {
      sketchWidth = SKETCH_COLUMN_WIDTH;
      sketchHeight = sketchWidth / sketchInfo.aspectRatio;
    }
  }

  return {
    height: Math.max(textHeight, sketchHeight),
    draw: (cursor, left) => {
      const top = cursor.y;
      for (const op of ops) {
        cursor.doc.setFont('helvetica', op.bold ? 'bold' : 'normal');
        cursor.doc.setFontSize(op.fontSize);
        cursor.doc.text(op.text, left + op.dx, top + op.dy);
      }
      if (sketchInfo) {
        try {
          const imgX = cursor.pageWidth - MARGIN_X - sketchWidth;
          cursor.doc.addImage(sketchInfo.imagePreview, 'PNG', imgX, top, sketchWidth, sketchHeight);
        } catch {
          // Skip on error
        }
      }
      cursor.y = top + Math.max(textHeight, sketchHeight);
    },
  };
}

const SPLIT_HEADER_HEIGHT = 4;
const GROUP_HEADER_HEIGHT = 4.5;
const EMPTY_GROUP_HEIGHT = 3.5;

function groupLabel(group: PracticeGroup) {
  const name = group.name.toUpperCase();
  return /\bGROUP\b/.test(name) ? `${name}:` : `${name} GROUP:`;
}

// Height of the part of an item that must stay on the same page as whatever
// precedes it: a whole drill, or a split's headers plus its first drill.
function leadingBlockHeight(doc: jsPDF, item: TimelineItem, availableWidth: number): number {
  if (item.type === 'drill') {
    return layoutDrill(doc, item, 1, availableWidth).height;
  }
  const firstGroup = item.groups[0];
  return SPLIT_HEADER_HEIGHT + (firstGroup ? groupLeadingHeight(doc, firstGroup, availableWidth) : 0);
}

function groupLeadingHeight(doc: jsPDF, group: PracticeGroup, availableWidth: number): number {
  const first = group.items[0];
  return GROUP_HEADER_HEIGHT + (first
    ? leadingBlockHeight(doc, first, availableWidth - GROUP_DRILL_INDENT)
    : EMPTY_GROUP_HEIGHT);
}

function renderTimelineItemsToPDF(cursor: PdfCursor, items: TimelineItem[], left: number) {
  const { doc } = cursor;
  const availableWidth = cursor.pageWidth - MARGIN_X - left;
  let drillNumber = 1;

  items.forEach((item, index) => {
    const leadingHeight = leadingBlockHeight(doc, item, availableWidth);
    if (index > 0) {
      // Skip the divider when the next block starts a new page anyway
      if (cursor.fits(DIVIDER_GAP * 2 + leadingHeight)) {
        cursor.divider(left);
      } else {
        cursor.newPage();
      }
    }
    cursor.ensureSpace(leadingHeight);

    if (item.type === 'drill') {
      layoutDrill(doc, item, drillNumber++, availableWidth).draw(cursor, left);
    } else {
      renderSplitToPDF(cursor, item, left, availableWidth);
    }
  });
}

function renderSplitToPDF(cursor: PdfCursor, split: ParallelSplitItem, left: number, availableWidth: number) {
  const { doc } = cursor;
  const duration = getTimelineItemDuration(split);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(SPLIT_COLOR.r, SPLIT_COLOR.g, SPLIT_COLOR.b);
  doc.text(`PARALLEL GROUPS (${split.groups.length} groups, ${secondsToDurationString(duration)})`, left, cursor.y + TITLE_BASELINE);
  doc.setTextColor(0, 0, 0);
  cursor.y += SPLIT_HEADER_HEIGHT;

  split.groups.forEach((group, index) => {
    if (index > 0) cursor.y += 3;
    cursor.ensureSpace(groupLeadingHeight(doc, group, availableWidth));

    const color = hexToRgb(group.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(groupLabel(group), left + 2, cursor.y + TITLE_BASELINE);
    doc.setTextColor(0, 0, 0);
    cursor.y += GROUP_HEADER_HEIGHT;

    cursor.openBar(left + GROUP_BAR_OFFSET, color);
    if (group.items.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.text('No drills', left + GROUP_DRILL_INDENT, cursor.y + TITLE_BASELINE);
      cursor.y += EMPTY_GROUP_HEIGHT;
    } else {
      renderTimelineItemsToPDF(cursor, group.items, left + GROUP_DRILL_INDENT);
    }
    cursor.closeBar();
  });
}

// Plans saved before timelines existed only have the flat drills list
function getPlanTimeline(plan: PracticePlan): TimelineItem[] {
  if (plan.timeline && plan.timeline.length > 0) return plan.timeline;
  return plan.drills.map((item): DrillItem => ({
    type: 'drill',
    id: item.id,
    drillId: item.drillId,
    drill: item.drill,
    customDuration: item.customDuration,
    customNotes: item.customNotes,
  }));
}

async function buildPracticePlanPDF(plan: PracticePlan): Promise<jsPDF> {
  // Refresh drill data to get latest sketches and updates
  const normalizedPlan = await refreshPlanDrillData(plan);

  // Without compress, jsPDF stores each sketch as raw uncompressed pixels (~1.7MB per full-rink sketch)
  const doc = new jsPDF({ compress: true });
  const cursor = new PdfCursor(doc);
  const pageWidth = cursor.pageWidth;

  // Title - compact
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(normalizedPlan.name, pageWidth / 2, cursor.y, { align: 'center' });
  cursor.y += 6;

  // Practice Info - single line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const practiceDate = normalizedPlan.date instanceof Date ? normalizedPlan.date : new Date(normalizedPlan.date);
  const infoParts = [
    format(practiceDate, 'MMM d, yyyy'),
    normalizedPlan.duration,
    getLocationLabel(normalizedPlan.location) || '',
    normalizedPlan.teamName || '',
  ].filter(Boolean);
  doc.text(infoParts.join(' | '), pageWidth / 2, cursor.y, { align: 'center' });
  cursor.y += 5;

  // Equipment - inline if short
  if (normalizedPlan.equipment) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Equipment: ', MARGIN_X, cursor.y);
    const labelWidth = doc.getTextWidth('Equipment: ');
    doc.setFont('helvetica', 'normal');
    const eqText = doc.splitTextToSize(normalizedPlan.equipment, pageWidth - MARGIN_X * 2 - labelWidth);
    doc.text(eqText, MARGIN_X + labelWidth, cursor.y);
    cursor.y += eqText.length * LINE_HEIGHT + 2;
  }

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, cursor.y, pageWidth - MARGIN_X, cursor.y);
  cursor.y += 4;

  // Practice Plan header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const timeline = getPlanTimeline(normalizedPlan);
  doc.text(`Drills (${flattenTimelineDrills(timeline).length})`, MARGIN_X, cursor.y);
  cursor.y += 2;

  renderTimelineItemsToPDF(cursor, timeline, MARGIN_X);

  // Notes - compact, may flow across pages line by line
  if (normalizedPlan.notes) {
    cursor.ensureSpace(14);
    cursor.y += 3;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, cursor.y, pageWidth - MARGIN_X, cursor.y);
    cursor.y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', MARGIN_X, cursor.y);
    cursor.y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteLines: string[] = doc.splitTextToSize(normalizedPlan.notes, pageWidth - MARGIN_X * 2);
    for (const line of noteLines) {
      cursor.ensureSpace(LINE_HEIGHT);
      doc.text(line, MARGIN_X, cursor.y);
      cursor.y += LINE_HEIGHT;
    }
  }

  return doc;
}

function pdfFileName(plan: PracticePlan) {
  return `${plan.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
}

export async function exportPracticePlanToPDF(plan: PracticePlan) {
  const doc = await buildPracticePlanPDF(plan);
  doc.save(pdfFileName(plan));
}

// Prints the same PDF the export produces, via a hidden iframe
const PRINT_FRAME_ID = 'practice-plan-print-frame';

export async function printPracticePlan(plan: PracticePlan) {
  const doc = await buildPracticePlanPDF(plan);
  const url = URL.createObjectURL(doc.output('blob'));

  // Reuse one frame; the previous print job is finished by the time another starts
  const previous = document.getElementById(PRINT_FRAME_ID) as HTMLIFrameElement | null;
  if (previous) {
    URL.revokeObjectURL(previous.src);
    previous.remove();
  }

  const frame = document.createElement('iframe');
  frame.id = PRINT_FRAME_ID;
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  frame.src = url;
  document.body.appendChild(frame);
}

// Export drills library functions
export async function exportDrillsLibraryToPDF(drills: Drill[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Hockey Drills Library', pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  drills.forEach((drill, index) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${index + 1}. ${drill.name}`, 20, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Category: ${drill.category} | Duration: ${drill.duration} | Focus: ${drill.skillFocus}`, 25, y);
    y += 5;

    if (drill.objective) {
      const lines = doc.splitTextToSize(`Objective: ${drill.objective}`, pageWidth - 50);
      doc.text(lines, 25, y);
      y += lines.length * 4;
    }

    if (drill.equipment) {
      doc.text(`Equipment: ${drill.equipment}`, 25, y);
      y += 5;
    }

    y += 8;
  });

  doc.save('Drills_Library.pdf');
}
