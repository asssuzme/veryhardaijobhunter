import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { StructuredResume } from '../../shared/types/resume';

export async function generateResumePDF(resume: StructuredResume, theme: 'classic' | 'modern' | 'minimal' = 'modern'): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size
  
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const fonts = {
    classic: { regular: timesRoman, bold: timesBold },
    modern: { regular: helvetica, bold: helveticaBold },
    minimal: { regular: helvetica, bold: helveticaBold }
  };
  
  const colors = {
    classic: {
      primary: rgb(0.1, 0.1, 0.1),
      secondary: rgb(0.3, 0.3, 0.3),
      accent: rgb(0.1, 0.3, 0.6)
    },
    modern: {
      primary: rgb(0.05, 0.05, 0.15),
      secondary: rgb(0.4, 0.4, 0.5),
      accent: rgb(0.4, 0.2, 0.8)
    },
    minimal: {
      primary: rgb(0.2, 0.2, 0.2),
      secondary: rgb(0.5, 0.5, 0.5),
      accent: rgb(0.3, 0.3, 0.3)
    }
  };
  
  const themeColors = colors[theme];
  const themeFonts = fonts[theme];
  
  let yPosition = 750;
  const leftMargin = 50;
  const rightMargin = 545;
  const lineSpacing = 18;
  
  // Helper function to add text
  function addText(
    text: string, 
    x: number, 
    y: number, 
    font: PDFFont, 
    size: number, 
    color = themeColors.primary
  ): number {
    page.drawText(text, { x, y, size, font, color });
    return y - lineSpacing;
  }
  
  // Helper function to wrap text
  function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      
      if (width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }
  
  // Helper to add wrapped text
  function addWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    font: PDFFont,
    size: number,
    color = themeColors.primary
  ): number {
    const lines = wrapText(text, maxWidth, font, size);
    let currentY = y;
    for (const line of lines) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineSpacing;
    }
    return currentY;
  }
  
  // Check if we need a new page
  function checkNewPage(requiredSpace: number): void {
    if (yPosition - requiredSpace < 50) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = 750;
    }
  }
  
  // Header with gradient effect for modern theme
  if (theme === 'modern') {
    // Draw gradient background (simplified as solid color)
    page.drawRectangle({
      x: 0,
      y: 720,
      width: 595,
      height: 122,
      color: rgb(0.25, 0.4, 0.8),
    });
  }
  
  // Name
  const nameColor = theme === 'modern' ? rgb(1, 1, 1) : themeColors.primary;
  yPosition = addText(
    resume.personalInfo.name,
    leftMargin,
    yPosition,
    themeFonts.bold,
    28,
    nameColor
  );
  
  // Contact Info
  const contactColor = theme === 'modern' ? rgb(0.95, 0.95, 0.95) : themeColors.secondary;
  let contactInfo = [];
  if (resume.personalInfo.email) contactInfo.push(resume.personalInfo.email);
  if (resume.personalInfo.phone) contactInfo.push(resume.personalInfo.phone);
  if (resume.personalInfo.location) contactInfo.push(resume.personalInfo.location);
  
  if (contactInfo.length > 0) {
    yPosition = addText(
      contactInfo.join(' | '),
      leftMargin,
      yPosition,
      themeFonts.regular,
      10,
      contactColor
    );
  }
  
  // Links
  const links = [];
  if (resume.personalInfo.linkedin) links.push('LinkedIn');
  if (resume.personalInfo.github) links.push('GitHub');
  if (resume.personalInfo.website) links.push('Portfolio');
  
  if (links.length > 0) {
    yPosition = addText(
      links.join(' | '),
      leftMargin,
      yPosition - 5,
      themeFonts.regular,
      9,
      contactColor
    );
  }
  
  yPosition -= theme === 'modern' ? 25 : 15; // Space after header
  
  // Professional Summary
  if (resume.professionalSummary) {
    checkNewPage(60);
    yPosition = addText('PROFESSIONAL SUMMARY', leftMargin, yPosition, themeFonts.bold, 11, themeColors.accent);
    yPosition -= 5;
    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 0.5,
      color: themeColors.accent,
    });
    yPosition -= 10;
    
    yPosition = addWrappedText(
      resume.professionalSummary,
      leftMargin,
      yPosition,
      rightMargin - leftMargin,
      themeFonts.regular,
      10
    );
    yPosition -= 15;
  }
  
  // Experience
  if (resume.experience.length > 0) {
    checkNewPage(60);
    yPosition = addText('WORK EXPERIENCE', leftMargin, yPosition, themeFonts.bold, 11, themeColors.accent);
    yPosition -= 5;
    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 0.5,
      color: themeColors.accent,
    });
    yPosition -= 10;
    
    for (const exp of resume.experience) {
      checkNewPage(80);
      
      // Job title and dates
      page.drawText(exp.title, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: themeFonts.bold,
        color: themeColors.primary
      });
      
      const dateWidth = themeFonts.regular.widthOfTextAtSize(exp.dates, 9);
      page.drawText(exp.dates, {
        x: rightMargin - dateWidth,
        y: yPosition,
        size: 9,
        font: themeFonts.regular,
        color: themeColors.secondary
      });
      
      yPosition -= lineSpacing;
      
      // Company and location
      const companyLocation = exp.location ? `${exp.company} | ${exp.location}` : exp.company;
      yPosition = addText(companyLocation, leftMargin, yPosition, themeFonts.regular, 9, themeColors.accent);
      
      // Description
      if (exp.description) {
        yPosition = addWrappedText(
          exp.description,
          leftMargin,
          yPosition,
          rightMargin - leftMargin,
          themeFonts.regular,
          9,
          themeColors.secondary
        );
      }
      
      // Achievements
      for (const achievement of exp.achievements) {
        checkNewPage(30);
        yPosition = addWrappedText(
          `• ${achievement}`,
          leftMargin + 10,
          yPosition,
          rightMargin - leftMargin - 10,
          themeFonts.regular,
          9
        );
      }
      
      yPosition -= 10;
    }
    yPosition -= 5;
  }
  
  // Education
  if (resume.education.length > 0) {
    checkNewPage(60);
    yPosition = addText('EDUCATION', leftMargin, yPosition, themeFonts.bold, 11, themeColors.accent);
    yPosition -= 5;
    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 0.5,
      color: themeColors.accent,
    });
    yPosition -= 10;
    
    for (const edu of resume.education) {
      checkNewPage(50);
      
      // Degree and dates
      page.drawText(edu.degree, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: themeFonts.bold,
        color: themeColors.primary
      });
      
      const dateWidth = themeFonts.regular.widthOfTextAtSize(edu.dates, 9);
      page.drawText(edu.dates, {
        x: rightMargin - dateWidth,
        y: yPosition,
        size: 9,
        font: themeFonts.regular,
        color: themeColors.secondary
      });
      
      yPosition -= lineSpacing;
      
      // School and location
      const schoolLocation = edu.location ? `${edu.school} | ${edu.location}` : edu.school;
      yPosition = addText(schoolLocation, leftMargin, yPosition, themeFonts.regular, 9, themeColors.accent);
      
      if (edu.gpa) {
        yPosition = addText(`GPA: ${edu.gpa}`, leftMargin, yPosition, themeFonts.regular, 9, themeColors.secondary);
      }
      
      yPosition -= 10;
    }
    yPosition -= 5;
  }
  
  // Skills
  if (resume.skills.length > 0) {
    checkNewPage(60);
    yPosition = addText('SKILLS', leftMargin, yPosition, themeFonts.bold, 11, themeColors.accent);
    yPosition -= 5;
    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 0.5,
      color: themeColors.accent,
    });
    yPosition -= 10;
    
    for (const skillGroup of resume.skills) {
      checkNewPage(30);
      const skillText = skillGroup.category !== 'General' 
        ? `${skillGroup.category}: ${skillGroup.items.join(', ')}`
        : skillGroup.items.join(', ');
      
      yPosition = addWrappedText(
        skillText,
        leftMargin,
        yPosition,
        rightMargin - leftMargin,
        themeFonts.regular,
        9
      );
    }
    yPosition -= 10;
  }
  
  // Projects
  if (resume.projects && resume.projects.length > 0) {
    checkNewPage(60);
    yPosition = addText('PROJECTS', leftMargin, yPosition, themeFonts.bold, 11, themeColors.accent);
    yPosition -= 5;
    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 0.5,
      color: themeColors.accent,
    });
    yPosition -= 10;
    
    for (const project of resume.projects) {
      checkNewPage(50);
      yPosition = addText(project.name, leftMargin, yPosition, themeFonts.bold, 10);
      yPosition = addWrappedText(
        project.description,
        leftMargin,
        yPosition,
        rightMargin - leftMargin,
        themeFonts.regular,
        9,
        themeColors.secondary
      );
      
      if (project.technologies && project.technologies.length > 0) {
        yPosition = addText(
          `Technologies: ${project.technologies.join(', ')}`,
          leftMargin,
          yPosition,
          themeFonts.regular,
          9,
          themeColors.secondary
        );
      }
      yPosition -= 5;
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}