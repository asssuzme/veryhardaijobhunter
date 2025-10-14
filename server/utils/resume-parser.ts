import { StructuredResume } from '../../shared/types/resume';
import { parseResumeWithAI, parseResumeTextFallback } from './ai-resume-parser';

// Main export function that uses AI when available, fallback otherwise
export async function parseResumeText(resumeText: string): Promise<StructuredResume> {
  try {
    // Try AI parsing first if available
    if (process.env.OPENAI_API_KEY) {
      console.log('[RESUME-PARSER] Using AI parser for resume');
      return await parseResumeWithAI(resumeText);
    }
  } catch (error) {
    console.error('[RESUME-PARSER] AI parsing failed, using fallback:', error);
  }
  
  // Fallback to enhanced rule-based parser
  console.log('[RESUME-PARSER] Using fallback parser for resume');
  return parseResumeTextFallback(resumeText);
}

// Synchronous version for backward compatibility (uses basic parser)
export function parseResumeTextSync(resumeText: string): StructuredResume {
  const lines = resumeText.split('\n').map(line => line.trim());
  const resume: StructuredResume = {
    personalInfo: {
      name: '',
    },
    experience: [],
    education: [],
    skills: []
  };

  let currentSection = '';
  let currentExperience: any = null;
  let currentEducation: any = null;
  let inExperienceDetails = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Parse personal info from top
    if (i < 5 && !currentSection) {
      if (line.match(/^\*\*.*\*\*$/)) {
        resume.personalInfo.name = line.replace(/\*\*/g, '').trim();
      } else if (line.includes('@')) {
        resume.personalInfo.email = line.replace(/^Email:\s*/i, '').trim();
      } else if (line.match(/\d{3}-?\d{3}-?\d{4}/) || line.match(/\+\d+/)) {
        resume.personalInfo.phone = line.replace(/^Phone:\s*/i, '').trim();
      } else if (line.match(/^[A-Za-z\s,]+$/)) {
        resume.personalInfo.location = line.trim();
      }
    }
    
    // Detect section headers
    if (line.match(/^\*\*.*Summary.*\*\*$/i) || line.startsWith('---')) {
      currentSection = 'summary';
      continue;
    } else if (line.match(/^\*\*.*Experience.*\*\*$/i)) {
      currentSection = 'experience';
      continue;
    } else if (line.match(/^\*\*.*Education.*\*\*$/i)) {
      currentSection = 'education';
      continue;
    } else if (line.match(/^\*\*.*Skills.*\*\*$/i)) {
      currentSection = 'skills';
      continue;
    } else if (line.match(/^\*\*.*Projects.*\*\*$/i)) {
      currentSection = 'projects';
      continue;
    }
    
    // Parse sections
    if (currentSection === 'summary') {
      if (!line.startsWith('**') && !line.startsWith('---')) {
        resume.professionalSummary = (resume.professionalSummary || '') + ' ' + line;
      }
    }
    
    else if (currentSection === 'experience') {
      // New job entry
      if (line.startsWith('**') && line.endsWith('**')) {
        if (currentExperience) {
          resume.experience.push(currentExperience);
        }
        const jobTitle = line.replace(/\*\*/g, '').trim();
        currentExperience = {
          title: jobTitle.split(',')[0] || jobTitle,
          company: jobTitle.split(',')[1]?.trim() || '',
          location: '',
          dates: '',
          achievements: []
        };
        inExperienceDetails = true;
      }
      // Company/location line
      else if (currentExperience && !currentExperience.dates && (lines[i-1]?.startsWith('**') || inExperienceDetails)) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          currentExperience.company = currentExperience.company || parts[0];
          currentExperience.location = parts[1] || '';
        } else {
          currentExperience.company = currentExperience.company || line;
        }
      }
      // Date line
      else if (currentExperience && (line.includes(' - ') || line.match(/\d{4}/))) {
        currentExperience.dates = line;
      }
      // Achievement bullet
      else if (currentExperience && (line.startsWith('-') || line.startsWith('•'))) {
        currentExperience.achievements.push(line.replace(/^[-•]\s*/, '').trim());
      }
      // Description
      else if (currentExperience && line && !line.startsWith('**')) {
        currentExperience.description = (currentExperience.description || '') + ' ' + line;
      }
    }
    
    else if (currentSection === 'education') {
      if (line.startsWith('**') && line.endsWith('**')) {
        if (currentEducation) {
          resume.education.push(currentEducation);
        }
        currentEducation = {
          degree: line.replace(/\*\*/g, '').trim(),
          school: '',
          dates: '',
          relevant: []
        };
      } else if (currentEducation && !currentEducation.school) {
        currentEducation.school = line;
      } else if (currentEducation && (line.includes(' - ') || line.match(/\d{4}/))) {
        currentEducation.dates = line;
      }
    }
    
    else if (currentSection === 'skills') {
      if (line.startsWith('-') || line.startsWith('•')) {
        const skillLine = line.replace(/^[-•]\s*/, '').trim();
        const parts = skillLine.split(':');
        if (parts.length > 1) {
          resume.skills.push({
            category: parts[0].trim(),
            items: parts[1].split(',').map(s => s.trim())
          });
        } else {
          // Single skills line
          if (!resume.skills.find(s => s.category === 'General')) {
            resume.skills.push({ category: 'General', items: [] });
          }
          resume.skills.find(s => s.category === 'General')?.items.push(skillLine);
        }
      }
    }
  }
  
  // Add remaining items
  if (currentExperience) {
    resume.experience.push(currentExperience);
  }
  if (currentEducation) {
    resume.education.push(currentEducation);
  }
  
  // Clean up
  resume.professionalSummary = resume.professionalSummary?.trim();
  
  return resume;
}