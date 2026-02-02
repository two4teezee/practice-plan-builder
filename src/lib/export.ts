import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { PracticePlan, Drill } from './types';
import { format } from 'date-fns';

export async function exportPracticePlanToPDF(plan: PracticePlan) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(plan.name, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Practice Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const practiceDate = plan.date instanceof Date ? plan.date : new Date(plan.date);
  doc.text(`Date: ${format(practiceDate, 'MMMM d, yyyy')}`, 20, y);
  y += 7;
  doc.text(`Duration: ${plan.duration}`, 20, y);
  y += 7;
  doc.text(`Location: ${plan.location}`, 20, y);
  y += 12;

  if (plan.description) {
    doc.setFont('helvetica', 'italic');
    const lines = doc.splitTextToSize(plan.description, pageWidth - 40);
    doc.text(lines, 20, y);
    y += lines.length * 6 + 8;
  }

  // Equipment
  if (plan.equipment) {
    doc.setFont('helvetica', 'bold');
    doc.text('Equipment Needed:', 20, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const eqLines = doc.splitTextToSize(plan.equipment, pageWidth - 40);
    doc.text(eqLines, 20, y);
    y += eqLines.length * 6 + 10;
  }

  // Drills
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Practice Drills', 20, y);
  y += 10;

  doc.setFontSize(11);
  plan.drills.forEach((item, index) => {
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

  // Notes
  if (plan.notes) {
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
    const noteLines = doc.splitTextToSize(plan.notes, pageWidth - 40);
    doc.text(noteLines, 20, y);
  }

  doc.save(`${plan.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

export async function exportPracticePlanToWord(plan: PracticePlan) {
  const practiceDate = plan.date instanceof Date ? plan.date : new Date(plan.date);
  
  const drillRows = plan.drills.map((item, index) => 
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

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: plan.name,
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
            new TextRun(plan.duration),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Location: ', bold: true }),
            new TextRun(plan.location),
          ],
        }),
        new Paragraph(''),
        plan.description ? new Paragraph({
          children: [new TextRun({ text: plan.description, italics: true })],
        }) : new Paragraph(''),
        new Paragraph(''),
        plan.equipment ? new Paragraph({
          children: [
            new TextRun({ text: 'Equipment Needed: ', bold: true }),
            new TextRun(plan.equipment),
          ],
        }) : new Paragraph(''),
        new Paragraph(''),
        new Paragraph({
          text: 'Practice Drills',
          heading: HeadingLevel.HEADING_2,
        }),
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
        }),
        new Paragraph(''),
        plan.notes ? new Paragraph({
          text: 'Notes',
          heading: HeadingLevel.HEADING_2,
        }) : new Paragraph(''),
        plan.notes ? new Paragraph(plan.notes) : new Paragraph(''),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${plan.name.replace(/[^a-z0-9]/gi, '_')}.docx`);
}

export function printPracticePlan(plan: PracticePlan) {
  const practiceDate = plan.date instanceof Date ? plan.date : new Date(plan.date);
  
  const drillsHtml = plan.drills.map((item, index) => `
    <div class="drill">
      <h3>${index + 1}. ${item.drill.name} <span class="time">(${item.drill.duration})</span></h3>
      ${item.drill.objective ? `<p><strong>Objective:</strong> ${item.drill.objective}</p>` : ''}
      ${item.drill.execution ? `<p><strong>Execution:</strong> ${item.drill.execution}</p>` : ''}
      ${item.drill.coachingPoints ? `<p><strong>Coaching Points:</strong> ${item.drill.coachingPoints}</p>` : ''}
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${plan.name}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { text-align: center; color: #1e3a8a; margin-bottom: 5px; }
        .meta { text-align: center; color: #666; margin-bottom: 20px; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; }
        .info p { margin: 5px 0; }
        h2 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; }
        .drill { margin-bottom: 20px; padding: 15px; background: #f9fafb; border-left: 4px solid #3b82f6; }
        .drill h3 { margin: 0 0 10px 0; color: #1f2937; }
        .drill .time { color: #6b7280; font-weight: normal; }
        .drill p { margin: 5px 0; color: #374151; }
        .equipment { background: #fef3c7; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; }
        .notes { background: #e0f2fe; padding: 15px; border-radius: 8px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${plan.name}</h1>
      <div class="info">
        <p><strong>Date:</strong> ${format(practiceDate, 'MMMM d, yyyy')}</p>
        <p><strong>Duration:</strong> ${plan.duration}</p>
        <p><strong>Location:</strong> ${plan.location}</p>
      </div>
      ${plan.description ? `<p><em>${plan.description}</em></p>` : ''}
      ${plan.equipment ? `<div class="equipment"><strong>Equipment Needed:</strong> ${plan.equipment}</div>` : ''}
      <h2>Practice Drills</h2>
      ${drillsHtml}
      ${plan.notes ? `<h2>Notes</h2><div class="notes">${plan.notes}</div>` : ''}
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
