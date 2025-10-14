import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopType, TabStopPosition, BorderStyle, Packer } from 'docx';
import { StructuredResume } from '../../shared/types/resume';

export async function generateResumeDocx(resume: StructuredResume, theme: 'classic' | 'modern' | 'minimal' | 'ats-friendly' | 'creative' | 'executive' = 'modern'): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: [
        // Name
        new Paragraph({
          text: resume.personalInfo.name,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 200,
          },
        }),
        
        // Contact Information
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 400,
          },
          children: [
            ...(resume.personalInfo.email ? [
              new TextRun({
                text: resume.personalInfo.email,
                size: 20,
              }),
              new TextRun({
                text: "  |  ",
                size: 20,
              }),
            ] : []),
            ...(resume.personalInfo.phone ? [
              new TextRun({
                text: resume.personalInfo.phone,
                size: 20,
              }),
              new TextRun({
                text: "  |  ",
                size: 20,
              }),
            ] : []),
            ...(resume.personalInfo.location ? [
              new TextRun({
                text: resume.personalInfo.location,
                size: 20,
              }),
            ] : []),
          ],
        }),
        
        // Professional Summary
        ...(resume.professionalSummary ? [
          new Paragraph({
            text: "PROFESSIONAL SUMMARY",
            heading: HeadingLevel.HEADING_2,
            thematicBreak: true,
            spacing: {
              before: 400,
              after: 200,
            },
          }),
          new Paragraph({
            text: resume.professionalSummary,
            spacing: {
              after: 400,
            },
          }),
        ] : []),
        
        // Experience
        ...(resume.experience.length > 0 ? [
          new Paragraph({
            text: "EXPERIENCE",
            heading: HeadingLevel.HEADING_2,
            thematicBreak: true,
            spacing: {
              before: 400,
              after: 200,
            },
          }),
          ...resume.experience.flatMap(exp => [
            new Paragraph({
              children: [
                new TextRun({
                  text: exp.title,
                  bold: true,
                  size: 24,
                }),
                new TextRun({
                  text: ` - ${exp.company}`,
                  size: 24,
                }),
                new TextRun({
                  text: `\t${exp.dates}`,
                  size: 20,
                }),
              ],
              tabStops: [
                {
                  type: TabStopType.RIGHT,
                  position: TabStopPosition.MAX,
                },
              ],
              spacing: {
                after: 100,
              },
            }),
            ...(exp.location ? [
              new Paragraph({
                text: exp.location,
                italics: true,
                size: 20,
                spacing: {
                  after: 100,
                },
              }),
            ] : []),
            ...(exp.description ? [
              new Paragraph({
                text: exp.description,
                spacing: {
                  after: 100,
                },
              }),
            ] : []),
            ...exp.achievements.map(achievement => 
              new Paragraph({
                text: `• ${achievement}`,
                spacing: {
                  left: 400,
                  after: 50,
                },
              })
            ),
            new Paragraph({
              text: "",
              spacing: {
                after: 200,
              },
            }),
          ]),
        ] : []),
        
        // Education
        ...(resume.education.length > 0 ? [
          new Paragraph({
            text: "EDUCATION",
            heading: HeadingLevel.HEADING_2,
            thematicBreak: true,
            spacing: {
              before: 400,
              after: 200,
            },
          }),
          ...resume.education.flatMap(edu => [
            new Paragraph({
              children: [
                new TextRun({
                  text: edu.degree,
                  bold: true,
                  size: 24,
                }),
                new TextRun({
                  text: ` - ${edu.school}`,
                  size: 24,
                }),
                new TextRun({
                  text: `\t${edu.dates}`,
                  size: 20,
                }),
              ],
              tabStops: [
                {
                  type: TabStopType.RIGHT,
                  position: TabStopPosition.MAX,
                },
              ],
              spacing: {
                after: 100,
              },
            }),
            ...(edu.location ? [
              new Paragraph({
                text: edu.location,
                italics: true,
                size: 20,
                spacing: {
                  after: 100,
                },
              }),
            ] : []),
            ...(edu.gpa ? [
              new Paragraph({
                text: `GPA: ${edu.gpa}`,
                spacing: {
                  after: 100,
                },
              }),
            ] : []),
            ...(edu.relevant && edu.relevant.length > 0 ? [
              new Paragraph({
                text: `Relevant Coursework: ${edu.relevant.join(', ')}`,
                spacing: {
                  after: 200,
                },
              }),
            ] : []),
          ]),
        ] : []),
        
        // Skills
        ...(resume.skills.length > 0 ? [
          new Paragraph({
            text: "SKILLS",
            heading: HeadingLevel.HEADING_2,
            thematicBreak: true,
            spacing: {
              before: 400,
              after: 200,
            },
          }),
          ...resume.skills.map(skillGroup => 
            new Paragraph({
              children: [
                ...(skillGroup.category !== 'General' ? [
                  new TextRun({
                    text: `${skillGroup.category}: `,
                    bold: true,
                  }),
                ] : []),
                new TextRun({
                  text: skillGroup.items.join(', '),
                }),
              ],
              spacing: {
                after: 100,
              },
            })
          ),
        ] : []),
        
        // Projects
        ...(resume.projects && resume.projects.length > 0 ? [
          new Paragraph({
            text: "PROJECTS",
            heading: HeadingLevel.HEADING_2,
            thematicBreak: true,
            spacing: {
              before: 400,
              after: 200,
            },
          }),
          ...resume.projects.flatMap(project => [
            new Paragraph({
              children: [
                new TextRun({
                  text: project.name,
                  bold: true,
                  size: 24,
                }),
                ...(project.link ? [
                  new TextRun({
                    text: ` (${project.link})`,
                    size: 20,
                  }),
                ] : []),
              ],
              spacing: {
                after: 100,
              },
            }),
            new Paragraph({
              text: project.description,
              spacing: {
                after: 100,
              },
            }),
            ...(project.technologies && project.technologies.length > 0 ? [
              new Paragraph({
                text: `Technologies: ${project.technologies.join(', ')}`,
                italics: true,
                spacing: {
                  after: 200,
                },
              }),
            ] : []),
          ]),
        ] : []),
        
        // Certifications
        ...(resume.certifications && resume.certifications.length > 0 ? [
          new Paragraph({
            text: "CERTIFICATIONS",
            heading: HeadingLevel.HEADING_2,
            thematicBreak: true,
            spacing: {
              before: 400,
              after: 200,
            },
          }),
          ...resume.certifications.map(cert => 
            new Paragraph({
              children: [
                new TextRun({
                  text: cert.name,
                  bold: true,
                }),
                new TextRun({
                  text: ` - ${cert.issuer}`,
                }),
                new TextRun({
                  text: `\t${cert.date}`,
                }),
              ],
              tabStops: [
                {
                  type: TabStopType.RIGHT,
                  position: TabStopPosition.MAX,
                },
              ],
              spacing: {
                after: 100,
              },
            })
          ),
        ] : []),
        
        // Achievements
        ...(resume.achievements && resume.achievements.length > 0 ? [
          new Paragraph({
            text: "ACHIEVEMENTS",
            heading: HeadingLevel.HEADING_2,
            thematicBreak: true,
            spacing: {
              before: 400,
              after: 200,
            },
          }),
          ...resume.achievements.map(achievement => 
            new Paragraph({
              text: `• ${achievement}`,
              spacing: {
                left: 400,
                after: 50,
              },
            })
          ),
        ] : []),
      ],
    }],
    styles: {
      default: {
        document: {
          run: {
            font: theme === 'classic' ? 'Times New Roman' : 'Calibri',
            size: 22,
          },
        },
      },
    },
  });
  
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

export function calculateATSScore(resume: StructuredResume): {
  score: number;
  feedback: string[];
  strongPoints: string[];
  improvements: string[];
} {
  let score = 0;
  const feedback: string[] = [];
  const strongPoints: string[] = [];
  const improvements: string[] = [];
  
  // Check contact information (10 points)
  if (resume.personalInfo.email) score += 5;
  if (resume.personalInfo.phone) score += 5;
  
  // Check professional summary (10 points)
  if (resume.professionalSummary) {
    score += 10;
    if (resume.professionalSummary.length > 100 && resume.professionalSummary.length < 300) {
      strongPoints.push("Professional summary is well-sized");
    } else {
      improvements.push("Professional summary should be 100-300 characters");
    }
  } else {
    improvements.push("Add a professional summary");
  }
  
  // Check experience (30 points)
  if (resume.experience.length > 0) {
    score += 15;
    if (resume.experience.length >= 2) score += 10;
    
    const hasQuantifiableAchievements = resume.experience.some(exp => 
      exp.achievements.some(a => /\d+/.test(a))
    );
    if (hasQuantifiableAchievements) {
      score += 5;
      strongPoints.push("Experience includes quantifiable achievements");
    } else {
      improvements.push("Add numbers/percentages to your achievements");
    }
  } else {
    improvements.push("Add work experience");
  }
  
  // Check education (15 points)
  if (resume.education.length > 0) {
    score += 15;
    strongPoints.push("Education section is complete");
  } else {
    improvements.push("Add education details");
  }
  
  // Check skills (20 points)
  if (resume.skills.length > 0) {
    score += 10;
    const totalSkills = resume.skills.reduce((acc, group) => acc + group.items.length, 0);
    if (totalSkills >= 5) {
      score += 10;
      strongPoints.push("Good range of skills listed");
    } else {
      improvements.push("Add more relevant skills");
    }
  } else {
    improvements.push("Add a skills section");
  }
  
  // Check for action verbs in experience
  const actionVerbs = ['achieved', 'improved', 'managed', 'developed', 'created', 'led', 'increased', 'decreased', 'implemented'];
  const hasActionVerbs = resume.experience.some(exp => 
    exp.achievements.some(a => actionVerbs.some(verb => a.toLowerCase().includes(verb)))
  );
  if (hasActionVerbs) {
    score += 5;
    strongPoints.push("Uses strong action verbs");
  } else {
    improvements.push("Start achievements with action verbs");
  }
  
  // Check for keywords (10 points)
  const hasKeywords = resume.skills.length > 0 || 
    (resume.professionalSummary && resume.professionalSummary.length > 50);
  if (hasKeywords) {
    score += 10;
  } else {
    improvements.push("Include industry-specific keywords");
  }
  
  // Generate overall feedback
  if (score >= 80) {
    feedback.push("Excellent ATS compatibility! Your resume is well-optimized.");
  } else if (score >= 60) {
    feedback.push("Good ATS compatibility with room for improvement.");
  } else {
    feedback.push("Your resume needs optimization for ATS systems.");
  }
  
  return {
    score,
    feedback,
    strongPoints,
    improvements,
  };
}

export function getWordCount(resume: StructuredResume): number {
  let wordCount = 0;
  
  // Personal info
  wordCount += resume.personalInfo.name.split(' ').length;
  
  // Professional summary
  if (resume.professionalSummary) {
    wordCount += resume.professionalSummary.split(' ').length;
  }
  
  // Experience
  resume.experience.forEach(exp => {
    wordCount += exp.title.split(' ').length;
    wordCount += exp.company.split(' ').length;
    if (exp.description) wordCount += exp.description.split(' ').length;
    exp.achievements.forEach(a => {
      wordCount += a.split(' ').length;
    });
  });
  
  // Education
  resume.education.forEach(edu => {
    wordCount += edu.degree.split(' ').length;
    wordCount += edu.school.split(' ').length;
    if (edu.relevant) {
      edu.relevant.forEach(r => {
        wordCount += r.split(' ').length;
      });
    }
  });
  
  // Skills
  resume.skills.forEach(skillGroup => {
    wordCount += skillGroup.category.split(' ').length;
    skillGroup.items.forEach(item => {
      wordCount += item.split(' ').length;
    });
  });
  
  // Projects
  if (resume.projects) {
    resume.projects.forEach(project => {
      wordCount += project.name.split(' ').length;
      wordCount += project.description.split(' ').length;
      if (project.technologies) {
        project.technologies.forEach(t => {
          wordCount += t.split(' ').length;
        });
      }
    });
  }
  
  // Certifications
  if (resume.certifications) {
    resume.certifications.forEach(cert => {
      wordCount += cert.name.split(' ').length;
      wordCount += cert.issuer.split(' ').length;
    });
  }
  
  // Achievements
  if (resume.achievements) {
    resume.achievements.forEach(a => {
      wordCount += a.split(' ').length;
    });
  }
  
  return wordCount;
}

export function getSectionsCompleted(resume: StructuredResume): {
  completed: number;
  total: number;
  sections: { name: string; isComplete: boolean }[];
} {
  const sections = [
    { name: 'Contact Information', isComplete: !!(resume.personalInfo.email && resume.personalInfo.phone) },
    { name: 'Professional Summary', isComplete: !!resume.professionalSummary },
    { name: 'Experience', isComplete: resume.experience.length > 0 },
    { name: 'Education', isComplete: resume.education.length > 0 },
    { name: 'Skills', isComplete: resume.skills.length > 0 },
    { name: 'Projects', isComplete: !!(resume.projects && resume.projects.length > 0) },
    { name: 'Certifications', isComplete: !!(resume.certifications && resume.certifications.length > 0) },
    { name: 'Achievements', isComplete: !!(resume.achievements && resume.achievements.length > 0) },
  ];
  
  const completed = sections.filter(s => s.isComplete).length;
  
  return {
    completed,
    total: sections.length,
    sections,
  };
}