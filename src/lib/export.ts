import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import type { PracticePlan, Drill, TimelineItem } from './types';
import { getTimelineItemDuration, secondsToDurationString, flattenTimelineDrills } from './types';
import { format } from 'date-fns';
import { ensurePlanHasTimeline } from './db';

// Helper to render timeline items recursively for PDF
function renderTimelineItemsToPDF(
  doc: jsPDF, 
  items: TimelineItem[], 
  startY: number, 
  pageWidth: number, 
  indent: number = 0,
  drillIndex: { value: number } = { value: 1 }
): number {
  let y = startY;

  for (const item of items) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    if (item.type === 'drill') {
      const duration = item.customDuration || item.drill.duration;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${drillIndex.value}. ${item.drill.name} (${duration})`, 20 + indent, y);
      drillIndex.value++;
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      if (item.drill.objective) {
        const objLines = doc.splitTextToSize(`Objective: ${item.drill.objective}`, pageWidth - 50 - indent);
        doc.text(objLines, 25 + indent, y);
        y += objLines.length * 5;
      }

      if (item.drill.execution) {
        const execLines = doc.splitTextToSize(`Execution: ${item.drill.execution}`, pageWidth - 50 - indent);
        doc.text(execLines, 25 + indent, y);
        y += execLines.length * 5;
      }

      if (item.drill.coachingPoints) {
        const cpLines = doc.splitTextToSize(`Coaching Points: ${item.drill.coachingPoints}`, pageWidth - 50 - indent);
        doc.text(cpLines, 25 + indent, y);
        y += cpLines.length * 5;
      }

      y += 6;
    } else {
      // Parallel split
      const duration = getTimelineItemDuration(item);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(59, 130, 246); // Primary blue
      doc.text(`PARALLEL GROUPS (${item.groups.length} groups, ${secondsToDurationString(duration)})`, 20 + indent, y);
      doc.setTextColor(0, 0, 0);
      y += 8;

      for (const group of item.groups) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${group.name}:`, 25 + indent, y);
        y += 6;

        if (group.items.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.text('No drills', 30 + indent, y);
          y += 5;
        } else {
          // Reset drill index for each group to show relative numbering
          const groupDrillIndex = { value: 1 };
          y = renderTimelineItemsToPDF(doc, group.items, y, pageWidth, indent + 10, groupDrillIndex);
        }
        y += 3;
      }
      y += 5;
    }
  }

  return y;
}

export async function exportPracticePlanToPDF(plan: PracticePlan) {
  // Ensure plan has timeline
  const normalizedPlan = ensurePlanHasTimeline(plan);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(normalizedPlan.name, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Practice Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const practiceDate = normalizedPlan.date instanceof Date ? normalizedPlan.date : new Date(normalizedPlan.date);
  doc.text(`Date: ${format(practiceDate, 'MMMM d, yyyy')}`, 20, y);
  y += 7;
  doc.text(`Duration: ${normalizedPlan.duration}`, 20, y);
  y += 7;
  doc.text(`Location: ${normalizedPlan.location}`, 20, y);
  y += 12;

  if (normalizedPlan.description) {
    doc.setFont('helvetica', 'italic');
    const lines = doc.splitTextToSize(normalizedPlan.description, pageWidth - 40);
    doc.text(lines, 20, y);
    y += lines.length * 6 + 8;
  }

  // Equipment
  if (normalizedPlan.equipment) {
    doc.setFont('helvetica', 'bold');
    doc.text('Equipment Needed:', 20, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const eqLines = doc.splitTextToSize(normalizedPlan.equipment, pageWidth - 40);
    doc.text(eqLines, 20, y);
    y += eqLines.length * 6 + 10;
  }

  // Practice Plan (Timeline)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const allDrills = flattenTimelineDrills(normalizedPlan.timeline);
  doc.text(`Practice Plan (${allDrills.length} drills)`, 20, y);
  y += 10;

  // Render timeline items (handles both sequential and parallel)
  if (normalizedPlan.timeline && normalizedPlan.timeline.length > 0) {
    y = renderTimelineItemsToPDF(doc, normalizedPlan.timeline, y, pageWidth);
  } else {
    // Fallback to legacy drills
    doc.setFontSize(11);
    normalizedPlan.drills.forEach((item, index) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${item.drill.name} (${item.drill.duration})`, 20, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      if (item.drill.objective) {
        const objLines = doc.splitTextToSize(`Objective: ${item.drill.objective}`, pageWidth - 50);
        doc.text(objLines, 25, y);
        y += objLines.length * 5;
      }
      
      if (item.drill.execution) {
        const execLines = doc.splitTextToSize(`Execution: ${item.drill.execution}`, pageWidth - 50);
        doc.text(execLines, 25, y);
        y += execLines.length * 5;
      }
      
      if (item.drill.coachingPoints) {
        const cpLines = doc.splitTextToSize(`Coaching Points: ${item.drill.coachingPoints}`, pageWidth - 50);
        doc.text(cpLines, 25, y);
        y += cpLines.length * 5;
      }
      
      y += 8;
      doc.setFontSize(11);
    });
  }

  // Notes
  if (normalizedPlan.notes) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Notes', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const noteLines = doc.splitTextToSize(normalizedPlan.notes, pageWidth - 40);
    doc.text(noteLines, 20, y);
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

  for (const item of items) {
    if (item.type === 'drill') {
      const duration = item.customDuration || item.drill.duration;
      paragraphs.push(
        new Paragraph({
          indent: { left: indent * 720 }, // 720 twips = 0.5 inch
          children: [
            new TextRun({ text: `${drillIndex.value}. ${item.drill.name}`, bold: true }),
            new TextRun({ text: ` (${duration})` }),
          ],
        })
      );
      drillIndex.value++;

      if (item.drill.objective) {
        paragraphs.push(new Paragraph({
          indent: { left: (indent + 1) * 720 },
          children: [new TextRun({ text: 'Objective: ', bold: true }), new TextRun(item.drill.objective)],
        }));
      }
      if (item.drill.execution) {
        paragraphs.push(new Paragraph({
          indent: { left: (indent + 1) * 720 },
          children: [new TextRun({ text: 'Execution: ', bold: true }), new TextRun(item.drill.execution)],
        }));
      }
      if (item.drill.coachingPoints) {
        paragraphs.push(new Paragraph({
          indent: { left: (indent + 1) * 720 },
          children: [new TextRun({ text: 'Coaching Points: ', bold: true }), new TextRun(item.drill.coachingPoints)],
        }));
      }
      paragraphs.push(new Paragraph(''));
    } else {
      // Parallel split
      const duration = getTimelineItemDuration(item);
      paragraphs.push(
        new Paragraph({
          indent: { left: indent * 720 },
          children: [
            new TextRun({ text: `PARALLEL GROUPS `, bold: true, color: '3B82F6' }),
            new TextRun({ text: `(${item.groups.length} groups, ${secondsToDurationString(duration)})`, color: '6B7280' }),
          ],
        })
      );
      paragraphs.push(new Paragraph(''));

      for (const group of item.groups) {
        paragraphs.push(
          new Paragraph({
            indent: { left: (indent + 1) * 720 },
            children: [new TextRun({ text: `${group.name}:`, bold: true })],
          })
        );

        if (group.items.length === 0) {
          paragraphs.push(new Paragraph({
            indent: { left: (indent + 2) * 720 },
            children: [new TextRun({ text: 'No drills', italics: true })],
          }));
        } else {
          const groupDrillIndex = { value: 1 };
          paragraphs.push(...generateTimelineItemParagraphs(group.items, groupDrillIndex, indent + 2));
        }
      }
      paragraphs.push(new Paragraph(''));
    }
  }

  return paragraphs;
}

export async function exportPracticePlanToWord(plan: PracticePlan) {
  // Ensure plan has timeline
  const normalizedPlan = ensurePlanHasTimeline(plan);
  
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

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: normalizedPlan.name,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Date: ', bold: true }),
            new TextRun(format(practiceDate, 'MMMM d, yyyy')),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Duration: ', bold: true }),
            new TextRun(normalizedPlan.duration),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Location: ', bold: true }),
            new TextRun(normalizedPlan.location),
          ],
        }),
        new Paragraph(''),
        normalizedPlan.description ? new Paragraph({
          children: [new TextRun({ text: normalizedPlan.description, italics: true })],
        }) : new Paragraph(''),
        new Paragraph(''),
        normalizedPlan.equipment ? new Paragraph({
          children: [
            new TextRun({ text: 'Equipment Needed: ', bold: true }),
            new TextRun(normalizedPlan.equipment),
          ],
        }) : new Paragraph(''),
        new Paragraph(''),
        new Paragraph({
          text: `Practice Plan (${allDrills.length} drills)`,
          heading: HeadingLevel.HEADING_2,
        }),
        ...timelineContent,
        new Paragraph(''),
        normalizedPlan.notes ? new Paragraph({
          text: 'Notes',
          heading: HeadingLevel.HEADING_2,
        }) : new Paragraph(''),
        normalizedPlan.notes ? new Paragraph(normalizedPlan.notes) : new Paragraph(''),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${normalizedPlan.name.replace(/[^a-z0-9]/gi, '_')}.docx`);
}

// Helper to generate HTML for timeline items
function generateTimelineItemsHtml(
  items: TimelineItem[], 
  drillIndex: { value: number } = { value: 1 }
): string {
  let html = '';

  for (const item of items) {
    if (item.type === 'drill') {
      const duration = item.customDuration || item.drill.duration;
      html += `
        <div class="drill">
          <h3>${drillIndex.value}. ${item.drill.name} <span class="time">(${duration})</span></h3>
          ${item.drill.objective ? `<p><strong>Objective:</strong> ${item.drill.objective}</p>` : ''}
          ${item.drill.execution ? `<p><strong>Execution:</strong> ${item.drill.execution}</p>` : ''}
          ${item.drill.coachingPoints ? `<p><strong>Coaching Points:</strong> ${item.drill.coachingPoints}</p>` : ''}
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

export function printPracticePlan(plan: PracticePlan) {
  // Ensure plan has timeline
  const normalizedPlan = ensurePlanHasTimeline(plan);
  
  const practiceDate = normalizedPlan.date instanceof Date ? normalizedPlan.date : new Date(normalizedPlan.date);
  const allDrills = flattenTimelineDrills(normalizedPlan.timeline);
  
  // Generate timeline HTML
  let timelineHtml: string;
  if (normalizedPlan.timeline && normalizedPlan.timeline.length > 0) {
    timelineHtml = generateTimelineItemsHtml(normalizedPlan.timeline);
  } else {
    // Fallback to legacy drills
    timelineHtml = normalizedPlan.drills.map((item, index) => `
      <div class="drill">
        <h3>${index + 1}. ${item.drill.name} <span class="time">(${item.drill.duration})</span></h3>
        ${item.drill.objective ? `<p><strong>Objective:</strong> ${item.drill.objective}</p>` : ''}
        ${item.drill.execution ? `<p><strong>Execution:</strong> ${item.drill.execution}</p>` : ''}
        ${item.drill.coachingPoints ? `<p><strong>Coaching Points:</strong> ${item.drill.coachingPoints}</p>` : ''}
      </div>
    `).join('');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${normalizedPlan.name}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
        h1 { text-align: center; color: #1e3a8a; margin-bottom: 5px; }
        .meta { color: #666; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; }
        .info p { margin: 5px 0; }
        h2 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; }
        .drill { margin-bottom: 15px; padding: 12px; background: #f9fafb; border-left: 4px solid #3b82f6; }
        .drill h3 { margin: 0 0 8px 0; color: #1f2937; font-size: 14px; }
        .drill .time { color: #6b7280; font-weight: normal; }
        .drill p { margin: 4px 0; color: #374151; font-size: 13px; }
        .equipment { background: #fef3c7; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; }
        .notes { background: #e0f2fe; padding: 15px; border-radius: 8px; }
        .parallel-split { margin: 20px 0; padding: 15px; border: 2px dashed #3b82f6; border-radius: 12px; background: #eff6ff; }
        .parallel-header { margin-bottom: 15px; color: #1e40af; }
        .group-content .drill { background: white; margin-bottom: 8px; padding: 8px; }
        .group-content .drill h3 { font-size: 13px; }
        .group-content .drill p { font-size: 12px; }
        @media print { 
          body { padding: 0; } 
          .parallel-split { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${normalizedPlan.name}</h1>
      <div class="info">
        <p><strong>Date:</strong> ${format(practiceDate, 'MMMM d, yyyy')}</p>
        <p><strong>Duration:</strong> ${normalizedPlan.duration}</p>
        <p><strong>Location:</strong> ${normalizedPlan.location}</p>
      </div>
      ${normalizedPlan.description ? `<p><em>${normalizedPlan.description}</em></p>` : ''}
      ${normalizedPlan.equipment ? `<div class="equipment"><strong>Equipment Needed:</strong> ${normalizedPlan.equipment}</div>` : ''}
      <h2>Practice Plan (${allDrills.length} drills)</h2>
      ${timelineHtml}
      ${normalizedPlan.notes ? `<h2>Notes</h2><div class="notes">${normalizedPlan.notes}</div>` : ''}
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
