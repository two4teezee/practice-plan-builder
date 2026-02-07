import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import type { PracticePlan, Drill, TimelineItem } from './types';
import { getTimelineItemDuration, secondsToDurationString, flattenTimelineDrills } from './types';
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
    
    // Calculate aspect ratio based on rink view
    // Full rink: 200 x 85 ft = 2.35:1 ratio
    // Half rink: 85 x 80 ft = ~1.06:1 ratio (width x depth)
    let aspectRatio: number;
    if (data.rinkView === 'full') {
      aspectRatio = 200 / 85; // ~2.35
    } else {
      // Half rink - canvas is oriented with width being rink width
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

// Backward compatible helper that just returns the image
function getSketchImagePreview(sketchData?: string): string | null {
  const info = getSketchInfo(sketchData);
  return info?.imagePreview || null;
}

// Helper to convert base64 data URL to binary for Word export
function base64ToUint8Array(base64: string): Uint8Array {
  const base64Data = base64.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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

// Helper to render timeline items recursively for PDF (compact version)
function renderTimelineItemsToPDF(
  doc: jsPDF, 
  items: TimelineItem[], 
  startY: number, 
  pageWidth: number, 
  indent: number = 0,
  drillIndex: { value: number } = { value: 1 }
): number {
  let y = startY;
  const lineHeight = 3.5; // Compact line height
  const fontSize = 8;

  for (const item of items) {
    if (y > 275) {
      doc.addPage();
      y = 12;
    }

    if (item.type === 'drill') {
      const duration = item.customDuration || item.drill.duration;
      const sketchInfo = getSketchInfo(item.drill.sketchData);
      
      // Reserve space for sketch column - fixed width regardless of aspect ratio
      const sketchColumnWidth = sketchInfo ? 45 : 0;
      const textWidth = sketchInfo 
        ? pageWidth - 25 - indent - sketchColumnWidth - 3 
        : pageWidth - 25 - indent;
      
      const drillStartY = y;
      
      // Title - compact
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${drillIndex.value}. ${item.drill.name} (${duration})`, 12 + indent, y);
      drillIndex.value++;
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);

      if (item.drill.objective) {
        const objLines = doc.splitTextToSize(`Objective: ${item.drill.objective}`, textWidth);
        doc.text(objLines, 14 + indent, y);
        y += objLines.length * lineHeight;
      }

      if (item.drill.setup) {
        const setupBullets = splitSetupIntoBullets(item.drill.setup);
        if (setupBullets.length > 1) {
          // Render as bulleted list
          for (const bullet of setupBullets) {
            const bulletLines = doc.splitTextToSize(`• ${bullet}`, textWidth - 4);
            doc.text(bulletLines, 16 + indent, y);
            y += bulletLines.length * lineHeight;
          }
        } else {
          // Single sentence - render inline
          const setupLines = doc.splitTextToSize(item.drill.setup, textWidth);
          doc.text(setupLines, 14 + indent, y);
          y += setupLines.length * lineHeight;
        }
      }

      if (item.drill.execution) {
        const execLines = doc.splitTextToSize(`Execution: ${item.drill.execution}`, textWidth);
        doc.text(execLines, 14 + indent, y);
        y += execLines.length * lineHeight;
      }

      if (item.drill.coachingPoints) {
        doc.setFont('helvetica', 'bold');
        doc.text('Coaching Points: ', 14 + indent, y);
        const labelWidth = doc.getTextWidth('Coaching Points: ');
        doc.setFont('helvetica', 'normal');
        const cpLines = doc.splitTextToSize(item.drill.coachingPoints, textWidth - labelWidth);
        doc.text(cpLines[0], 14 + indent + labelWidth, y);
        if (cpLines.length > 1) {
          for (let i = 1; i < cpLines.length; i++) {
            y += lineHeight;
            doc.text(cpLines[i], 14 + indent, y);
          }
        }
        y += lineHeight;
      }

      if (item.selectedVariations && item.selectedVariations.length > 0) {
        const varLines = doc.splitTextToSize(`Variations: ${item.selectedVariations.join(', ')}`, textWidth);
        doc.text(varLines, 14 + indent, y);
        y += varLines.length * lineHeight;
      }

      // Sketch image - dynamically sized to fit text height
      if (sketchInfo) {
        const textHeight = y - drillStartY;
        const maxSketchHeight = Math.max(textHeight, 18); // Minimum height of 18
        
        // Calculate sketch dimensions to fit within text height while preserving aspect ratio
        let sketchWidth: number;
        let sketchHeight: number;
        
        if (sketchInfo.aspectRatio >= 1) {
          // Wide image (full rink) - width is limiting factor
          sketchWidth = sketchColumnWidth;
          sketchHeight = sketchWidth / sketchInfo.aspectRatio;
          // If too tall, scale down
          if (sketchHeight > maxSketchHeight) {
            sketchHeight = maxSketchHeight;
            sketchWidth = sketchHeight * sketchInfo.aspectRatio;
          }
        } else {
          // Tall image (half rink) - height is limiting factor
          sketchHeight = maxSketchHeight;
          sketchWidth = sketchHeight * sketchInfo.aspectRatio;
          // If too wide, scale down
          if (sketchWidth > sketchColumnWidth) {
            sketchWidth = sketchColumnWidth;
            sketchHeight = sketchWidth / sketchInfo.aspectRatio;
          }
        }
        
        const imgX = pageWidth - 10 - sketchWidth;
        try {
          doc.addImage(sketchInfo.imagePreview, 'PNG', imgX, drillStartY - 1, sketchWidth, sketchHeight);
          y = Math.max(y, drillStartY + sketchHeight);
        } catch {
          // Skip on error
        }
      }

      y += 3; // Minimal spacing between drills
    } else {
      // Parallel split - compact
      const duration = getTimelineItemDuration(item);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(59, 130, 246);
      doc.text(`PARALLEL (${item.groups.length} groups, ${secondsToDurationString(duration)})`, 12 + indent, y);
      doc.setTextColor(0, 0, 0);
      y += 4;

      for (const group of item.groups) {
        if (y > 275) {
          doc.addPage();
          y = 12;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`${group.name}:`, 14 + indent, y);
        y += 3.5;

        if (group.items.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.text('No drills', 16 + indent, y);
          y += 3;
        } else {
          const groupDrillIndex = { value: 1 };
          y = renderTimelineItemsToPDF(doc, group.items, y, pageWidth, indent + 6, groupDrillIndex);
        }
        y += 1;
      }
      y += 2;
    }
  }

  return y;
}

export async function exportPracticePlanToPDF(plan: PracticePlan) {
  // Refresh drill data to get latest sketches and updates
  const normalizedPlan = await refreshPlanDrillData(plan);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 12;

  // Title - compact
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(normalizedPlan.name, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Practice Info - single line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const practiceDate = normalizedPlan.date instanceof Date ? normalizedPlan.date : new Date(normalizedPlan.date);
  const infoLine = `${format(practiceDate, 'MMM d, yyyy')} | ${normalizedPlan.duration} | ${normalizedPlan.location}`;
  doc.text(infoLine, pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Equipment - inline if short
  if (normalizedPlan.equipment) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Equipment: ', 12, y);
    doc.setFont('helvetica', 'normal');
    const eqText = doc.splitTextToSize(normalizedPlan.equipment, pageWidth - 40);
    doc.text(eqText, 32, y);
    y += eqText.length * 3.5 + 2;
  }

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(12, y, pageWidth - 12, y);
  y += 4;

  // Practice Plan header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const allDrills = flattenTimelineDrills(normalizedPlan.timeline);
  doc.text(`Drills (${allDrills.length})`, 12, y);
  y += 5;

  // Render timeline items
  if (normalizedPlan.timeline && normalizedPlan.timeline.length > 0) {
    y = renderTimelineItemsToPDF(doc, normalizedPlan.timeline, y, pageWidth);
  } else {
    // Fallback to legacy drills - compact
    doc.setFontSize(8);
    normalizedPlan.drills.forEach((item, index) => {
      if (y > 275) {
        doc.addPage();
        y = 12;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${index + 1}. ${item.drill.name} (${item.drill.duration})`, 12, y);
      y += 4;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      if (item.drill.objective) {
        const objLines = doc.splitTextToSize(`Objective: ${item.drill.objective}`, pageWidth - 25);
        doc.text(objLines, 14, y);
        y += objLines.length * 3.5;
      }
      
      if (item.drill.setup) {
        const setupBullets = splitSetupIntoBullets(item.drill.setup);
        if (setupBullets.length > 1) {
          for (const bullet of setupBullets) {
            const bulletLines = doc.splitTextToSize(`• ${bullet}`, pageWidth - 27);
            doc.text(bulletLines, 16, y);
            y += bulletLines.length * 3.5;
          }
        } else {
          const setupLines = doc.splitTextToSize(item.drill.setup, pageWidth - 25);
          doc.text(setupLines, 14, y);
          y += setupLines.length * 3.5;
        }
      }
      
      if (item.drill.execution) {
        const execLines = doc.splitTextToSize(`Execution: ${item.drill.execution}`, pageWidth - 25);
        doc.text(execLines, 14, y);
        y += execLines.length * 3.5;
      }
      
      if (item.drill.coachingPoints) {
        doc.setFont('helvetica', 'bold');
        doc.text('Coaching Points: ', 14, y);
        const labelWidth = doc.getTextWidth('Coaching Points: ');
        doc.setFont('helvetica', 'normal');
        const cpLines = doc.splitTextToSize(item.drill.coachingPoints, pageWidth - 25 - labelWidth);
        doc.text(cpLines[0], 14 + labelWidth, y);
        if (cpLines.length > 1) {
          for (let i = 1; i < cpLines.length; i++) {
            y += 3.5;
            doc.text(cpLines[i], 14, y);
          }
        }
        y += 3.5;
      }
      
      y += 3;
    });
  }

  // Notes - compact
  if (normalizedPlan.notes) {
    if (y > 265) {
      doc.addPage();
      y = 12;
    }
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(12, y, pageWidth - 12, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', 12, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(normalizedPlan.notes, pageWidth - 24);
    doc.text(noteLines, 12, y + 4);
  }

  doc.save(`${normalizedPlan.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

// Helper to generate Word paragraphs for timeline items
function generateTimelineItemParagraphs(
  items: TimelineItem[], 
  drillIndex: { value: number } = { value: 1 },
  indent: number = 0
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const fontSize = 18; // 9pt (size is in half-points)
  const smallIndent = 200; // Compact indent (was 720)

  for (const item of items) {
    if (item.type === 'drill') {
      const duration = item.customDuration || item.drill.duration;
      const sketchInfo = getSketchInfo(item.drill.sketchData);
      
      // Build all content as TextRuns for compact single-paragraph approach
      const contentRuns: TextRun[] = [];
      
      // Title
      contentRuns.push(new TextRun({ text: `${drillIndex.value}. ${item.drill.name}`, bold: true, size: 20 }));
      contentRuns.push(new TextRun({ text: ` (${duration})`, size: fontSize }));
      drillIndex.value++;

      // Content on same/next lines with minimal spacing
      if (item.drill.objective) {
        contentRuns.push(new TextRun({ text: ' | ', size: fontSize, color: '999999' }));
        contentRuns.push(new TextRun({ text: 'Obj: ', bold: true, size: fontSize }));
        contentRuns.push(new TextRun({ text: item.drill.objective, size: fontSize }));
      }
      if (item.drill.setup) {
        const setupBullets = splitSetupIntoBullets(item.drill.setup);
        contentRuns.push(new TextRun({ text: ' | ', size: fontSize, color: '999999' }));
        if (setupBullets.length > 1) {
          // Multiple sentences - show as bullet points
          setupBullets.forEach((bullet, idx) => {
            if (idx > 0) contentRuns.push(new TextRun({ text: ' ', size: fontSize }));
            contentRuns.push(new TextRun({ text: `• ${bullet}`, size: fontSize }));
          });
        } else {
          // Single sentence - show inline without label
          contentRuns.push(new TextRun({ text: item.drill.setup, size: fontSize }));
        }
      }
      if (item.drill.execution) {
        contentRuns.push(new TextRun({ text: ' | ', size: fontSize, color: '999999' }));
        contentRuns.push(new TextRun({ text: 'Exec: ', bold: true, size: fontSize }));
        contentRuns.push(new TextRun({ text: item.drill.execution, size: fontSize }));
      }
      if (item.drill.coachingPoints) {
        contentRuns.push(new TextRun({ text: ' | ', size: fontSize, color: '999999' }));
        contentRuns.push(new TextRun({ text: 'Tips: ', bold: true, size: fontSize }));
        contentRuns.push(new TextRun({ text: item.drill.coachingPoints, size: fontSize }));
      }
      if (item.selectedVariations && item.selectedVariations.length > 0) {
        contentRuns.push(new TextRun({ text: ' | ', size: fontSize, color: '999999' }));
        contentRuns.push(new TextRun({ text: 'Vars: ', bold: true, size: fontSize }));
        contentRuns.push(new TextRun({ text: item.selectedVariations.join(', '), size: fontSize }));
      }

      // If there's a sketch, use a compact table layout
      if (sketchInfo) {
        try {
          const imageData = base64ToUint8Array(sketchInfo.imagePreview);
          
          // Dynamic sizing: constrain by height for half-rink, by width for full-rink
          const maxHeight = 70; // Max height in pixels - keeps sketches compact
          const maxWidth = 100;
          let imgWidth: number;
          let imgHeight: number;
          
          if (sketchInfo.aspectRatio >= 1) {
            // Wide image (full rink) - constrain by width
            imgWidth = maxWidth;
            imgHeight = Math.round(imgWidth / sketchInfo.aspectRatio);
          } else {
            // Tall image (half rink) - constrain by height
            imgHeight = maxHeight;
            imgWidth = Math.round(imgHeight * sketchInfo.aspectRatio);
          }
          
          const table = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: 'none' as const, size: 0, color: 'FFFFFF' },
              bottom: { style: 'none' as const, size: 0, color: 'FFFFFF' },
              left: { style: 'none' as const, size: 0, color: 'FFFFFF' },
              right: { style: 'none' as const, size: 0, color: 'FFFFFF' },
              insideHorizontal: { style: 'none' as const, size: 0, color: 'FFFFFF' },
              insideVertical: { style: 'none' as const, size: 0, color: 'FFFFFF' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 75, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                      bottom: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                      left: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                      right: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                    },
                    children: [new Paragraph({ indent: { left: indent * smallIndent }, children: contentRuns })],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                      bottom: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                      left: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                      right: { style: 'none' as const, size: 0, color: 'FFFFFF' },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: imageData,
                            transformation: { width: imgWidth, height: imgHeight },
                            type: 'png',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          });
          paragraphs.push(table as unknown as Paragraph);
        } catch {
          // Fallback to text-only
          paragraphs.push(new Paragraph({ indent: { left: indent * smallIndent }, children: contentRuns }));
        }
      } else {
        paragraphs.push(new Paragraph({ indent: { left: indent * smallIndent }, children: contentRuns }));
      }
    } else {
      // Parallel split - compact
      const duration = getTimelineItemDuration(item);
      paragraphs.push(
        new Paragraph({
          indent: { left: indent * smallIndent },
          spacing: { before: 100 },
          children: [
            new TextRun({ text: `PARALLEL `, bold: true, size: 18, color: '3B82F6' }),
            new TextRun({ text: `(${item.groups.length} groups, ${secondsToDurationString(duration)})`, size: 16, color: '6B7280' }),
          ],
        })
      );

      for (const group of item.groups) {
        paragraphs.push(
          new Paragraph({
            indent: { left: (indent + 1) * smallIndent },
            children: [new TextRun({ text: `${group.name}:`, bold: true, size: 18 })],
          })
        );

        if (group.items.length === 0) {
          paragraphs.push(new Paragraph({
            indent: { left: (indent + 2) * smallIndent },
            children: [new TextRun({ text: 'No drills', italics: true, size: 16 })],
          }));
        } else {
          const groupDrillIndex = { value: 1 };
          paragraphs.push(...generateTimelineItemParagraphs(group.items, groupDrillIndex, indent + 2));
        }
      }
    }
  }

  return paragraphs;
}

export async function exportPracticePlanToWord(plan: PracticePlan) {
  // Refresh drill data to get latest sketches and updates
  const normalizedPlan = await refreshPlanDrillData(plan);
  
  const practiceDate = normalizedPlan.date instanceof Date ? normalizedPlan.date : new Date(normalizedPlan.date);
  const allDrills = flattenTimelineDrills(normalizedPlan.timeline);
  
  // Generate timeline content
  let timelineContent: Paragraph[];
  if (normalizedPlan.timeline && normalizedPlan.timeline.length > 0) {
    timelineContent = generateTimelineItemParagraphs(normalizedPlan.timeline);
  } else {
    // Fallback to legacy table format
    const drillRows = normalizedPlan.drills.map((item, index) => 
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: `${index + 1}`, bold: true })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: item.drill.name, bold: true })] })],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            children: [new Paragraph(item.drill.duration)],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [
              item.drill.objective ? new Paragraph({ children: [new TextRun({ text: 'Objective: ', bold: true }), new TextRun(item.drill.objective)] }) : new Paragraph(''),
              ...(item.drill.setup ? (() => {
                const bullets = splitSetupIntoBullets(item.drill.setup);
                if (bullets.length > 1) {
                  return bullets.map(bullet => new Paragraph({ children: [new TextRun({ text: `• ${bullet}` })] }));
                }
                return [new Paragraph({ children: [new TextRun(item.drill.setup)] })];
              })() : [new Paragraph('')]),
              item.drill.execution ? new Paragraph({ children: [new TextRun({ text: 'Execution: ', bold: true }), new TextRun(item.drill.execution)] }) : new Paragraph(''),
              item.drill.coachingPoints ? new Paragraph({ children: [new TextRun({ text: 'Coaching Points: ', bold: true }), new TextRun(item.drill.coachingPoints)] }) : new Paragraph(''),
            ],
          }),
        ],
      })
    );

    timelineContent = [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Drill', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Time', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Details', bold: true })] })] }),
            ],
          }),
          ...drillRows,
        ],
      }) as unknown as Paragraph, // Type workaround
    ];
  }

  // Build compact document
  const headerChildren: Paragraph[] = [
    // Title
    new Paragraph({
      children: [new TextRun({ text: normalizedPlan.name, bold: true, size: 28 })],
      spacing: { after: 100 },
    }),
    // Info line - all on one line
    new Paragraph({
      children: [
        new TextRun({ text: format(practiceDate, 'MMM d, yyyy'), size: 20 }),
        new TextRun({ text: ' | ', size: 20, color: '999999' }),
        new TextRun({ text: normalizedPlan.duration, size: 20 }),
        new TextRun({ text: ' | ', size: 20, color: '999999' }),
        new TextRun({ text: normalizedPlan.location, size: 20 }),
      ],
      spacing: { after: 50 },
    }),
  ];

  // Equipment - compact inline
  if (normalizedPlan.equipment) {
    headerChildren.push(new Paragraph({
      children: [
        new TextRun({ text: 'Equipment: ', bold: true, size: 18 }),
        new TextRun({ text: normalizedPlan.equipment, size: 18 }),
      ],
      spacing: { after: 50 },
    }));
  }

  // Drills header
  headerChildren.push(new Paragraph({
    children: [new TextRun({ text: `Drills (${allDrills.length})`, bold: true, size: 22 })],
    spacing: { before: 150, after: 100 },
    border: { bottom: { style: 'single' as const, size: 6, color: 'CCCCCC' } },
  }));

  // Notes at the end - compact
  const footerChildren: Paragraph[] = [];
  if (normalizedPlan.notes) {
    footerChildren.push(new Paragraph({
      children: [
        new TextRun({ text: 'Notes: ', bold: true, size: 18 }),
        new TextRun({ text: normalizedPlan.notes, size: 18 }),
      ],
      spacing: { before: 150 },
      border: { top: { style: 'single' as const, size: 6, color: 'CCCCCC' } },
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 inch margins
        },
      },
      children: [
        ...headerChildren,
        ...timelineContent,
        ...footerChildren,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${normalizedPlan.name.replace(/[^a-z0-9]/gi, '_')}.docx`);
}

// Helper to generate HTML for timeline items (compact version)
function generateTimelineItemsHtml(
  items: TimelineItem[], 
  drillIndex: { value: number } = { value: 1 }
): string {
  let html = '';

  for (const item of items) {
    if (item.type === 'drill') {
      const duration = item.customDuration || item.drill.duration;
      const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
      const sketchImage = getSketchImagePreview(item.drill.sketchData);
      
      // Compact: combine fields with separators
      const details: string[] = [];
      if (item.drill.objective) details.push(`<strong>Obj:</strong> ${item.drill.objective}`);
      if (item.drill.setup) {
        const setupBullets = splitSetupIntoBullets(item.drill.setup);
        if (setupBullets.length > 1) {
          details.push(`<ul style="margin:0;padding-left:16px;">${setupBullets.map(b => `<li>${b}</li>`).join('')}</ul>`);
        } else {
          details.push(item.drill.setup);
        }
      }
      if (item.drill.execution) details.push(`<strong>Exec:</strong> ${item.drill.execution}`);
      if (item.drill.coachingPoints) details.push(`<strong>Tips:</strong> ${item.drill.coachingPoints}`);
      if (hasVariations) details.push(`<strong>Vars:</strong> ${item.selectedVariations!.join(', ')}`);
      
      const textContent = `
        <div class="drill-text">
          <h3>${drillIndex.value}. ${item.drill.name} <span class="time">(${duration})</span></h3>
          ${details.length > 0 ? `<p>${details.join(' <span style="color:#ccc">|</span> ')}</p>` : ''}
        </div>
      `;
      
      const sketchContent = sketchImage ? `
        <div class="drill-sketch">
          <img src="${sketchImage}" alt="Drill sketch" />
        </div>
      ` : '';
      
      html += `
        <div class="drill ${sketchImage ? 'has-sketch' : ''}">
          ${textContent}
          ${sketchContent}
        </div>
      `;
      drillIndex.value++;
    } else {
      // Parallel split
      const duration = getTimelineItemDuration(item);
      html += `
        <div class="parallel-split">
          <div class="parallel-header">
            <strong>PARALLEL GROUPS</strong> 
            <span class="meta">(${item.groups.length} groups, ${secondsToDurationString(duration)})</span>
          </div>
          <div class="parallel-groups" style="display: grid; grid-template-columns: repeat(${item.groups.length}, 1fr); gap: 15px;">
      `;

      for (const group of item.groups) {
        html += `
          <div class="group" style="border: 2px solid ${group.color}40; border-radius: 8px; overflow: hidden;">
            <div class="group-header" style="background: ${group.color}20; padding: 8px 12px; font-weight: bold; color: ${group.color};">
              ${group.name}
            </div>
            <div class="group-content" style="padding: 10px;">
        `;

        if (group.items.length === 0) {
          html += `<p class="no-drills" style="color: #9ca3af; font-style: italic; text-align: center;">No drills</p>`;
        } else {
          const groupDrillIndex = { value: 1 };
          html += generateTimelineItemsHtml(group.items, groupDrillIndex);
        }

        html += `
            </div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }
  }

  return html;
}

export async function printPracticePlan(plan: PracticePlan) {
  // Refresh drill data to get latest sketches and updates
  const normalizedPlan = await refreshPlanDrillData(plan);
  
  const practiceDate = normalizedPlan.date instanceof Date ? normalizedPlan.date : new Date(normalizedPlan.date);
  const allDrills = flattenTimelineDrills(normalizedPlan.timeline);
  
  // Generate timeline HTML
  let timelineHtml: string;
  if (normalizedPlan.timeline && normalizedPlan.timeline.length > 0) {
    timelineHtml = generateTimelineItemsHtml(normalizedPlan.timeline);
  } else {
    // Fallback to legacy drills
    timelineHtml = normalizedPlan.drills.map((item, index) => {
      let setupHtml = '';
      if (item.drill.setup) {
        const bullets = splitSetupIntoBullets(item.drill.setup);
        if (bullets.length > 1) {
          setupHtml = `<ul style="margin:4px 0;padding-left:16px;">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
        } else {
          setupHtml = `<p>${item.drill.setup}</p>`;
        }
      }
      return `
      <div class="drill">
        <h3>${index + 1}. ${item.drill.name} <span class="time">(${item.drill.duration})</span></h3>
        ${item.drill.objective ? `<p><strong>Objective:</strong> ${item.drill.objective}</p>` : ''}
        ${setupHtml}
        ${item.drill.execution ? `<p><strong>Execution:</strong> ${item.drill.execution}</p>` : ''}
        ${item.drill.coachingPoints ? `<p><strong>Coaching Points:</strong> ${item.drill.coachingPoints}</p>` : ''}
      </div>
    `;
    }).join('');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${normalizedPlan.name}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 10px; font-size: 11px; line-height: 1.3; }
        h1 { text-align: center; color: #1e3a8a; margin: 0 0 4px 0; font-size: 16px; }
        .info-line { text-align: center; color: #666; margin-bottom: 8px; font-size: 10px; }
        .equipment { background: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px; font-size: 10px; }
        h2 { color: #1e3a8a; border-bottom: 1px solid #1e3a8a; padding-bottom: 2px; margin: 8px 0 6px 0; font-size: 12px; }
        .drill { margin-bottom: 6px; padding: 6px 8px; background: #f9fafb; border-left: 3px solid #3b82f6; }
        .drill h3 { margin: 0 0 3px 0; color: #1f2937; font-size: 11px; }
        .drill .time { color: #6b7280; font-weight: normal; font-size: 10px; }
        .drill p { margin: 2px 0; color: #374151; font-size: 10px; }
        .drill.has-sketch { display: flex; gap: 8px; align-items: flex-start; }
        .drill.has-sketch .drill-text { flex: 1; min-width: 0; }
        .drill.has-sketch .drill-sketch { flex-shrink: 0; display: flex; align-items: flex-start; }
        .drill.has-sketch .drill-sketch img { max-width: 100px; max-height: 70px; width: auto; height: auto; border: 1px solid #e5e7eb; border-radius: 4px; object-fit: contain; }
        .notes { background: #e0f2fe; padding: 6px 8px; border-radius: 4px; font-size: 10px; }
        .parallel-split { margin: 8px 0; padding: 8px; border: 1px dashed #3b82f6; border-radius: 6px; background: #eff6ff; }
        .parallel-header { margin-bottom: 6px; color: #1e40af; font-size: 10px; }
        .group-content .drill { background: white; margin-bottom: 4px; padding: 4px 6px; }
        .group-content .drill h3 { font-size: 10px; }
        .group-content .drill p { font-size: 9px; }
        .group-content .drill.has-sketch .drill-sketch img { max-width: 80px; max-height: 55px; }
        @media print { 
          body { padding: 0; margin: 0; } 
          .parallel-split { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${normalizedPlan.name}</h1>
      <div class="info-line">${format(practiceDate, 'MMM d, yyyy')} | ${normalizedPlan.duration} | ${normalizedPlan.location}</div>
      ${normalizedPlan.equipment ? `<div class="equipment"><strong>Equipment:</strong> ${normalizedPlan.equipment}</div>` : ''}
      <h2>Drills (${allDrills.length})</h2>
      ${timelineHtml}
      ${normalizedPlan.notes ? `<div class="notes" style="margin-top: 8px;"><strong>Notes:</strong> ${normalizedPlan.notes}</div>` : ''}
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
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

export async function exportDrillsLibraryToWord(drills: Drill[]) {
  const drillParagraphs = drills.flatMap((drill, index) => [
    new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${drill.name}`, bold: true, size: 28 })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Category: ', bold: true }),
        new TextRun(drill.category),
        new TextRun(' | '),
        new TextRun({ text: 'Duration: ', bold: true }),
        new TextRun(drill.duration),
        new TextRun(' | '),
        new TextRun({ text: 'Focus: ', bold: true }),
        new TextRun(drill.skillFocus),
      ],
    }),
    drill.objective ? new Paragraph({
      children: [new TextRun({ text: 'Objective: ', bold: true }), new TextRun(drill.objective)],
    }) : new Paragraph(''),
    drill.execution ? new Paragraph({
      children: [new TextRun({ text: 'Execution: ', bold: true }), new TextRun(drill.execution)],
    }) : new Paragraph(''),
    drill.equipment ? new Paragraph({
      children: [new TextRun({ text: 'Equipment: ', bold: true }), new TextRun(drill.equipment)],
    }) : new Paragraph(''),
    new Paragraph(''),
  ]);

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Hockey Drills Library',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [new TextRun({ text: `Generated on ${format(new Date(), 'MMMM d, yyyy')}`, italics: true })],
        }),
        new Paragraph(''),
        ...drillParagraphs,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'Drills_Library.docx');
}
