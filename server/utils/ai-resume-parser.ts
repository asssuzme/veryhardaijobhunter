import { StructuredResume } from '../../shared/types/resume';
import OpenAI from 'openai';

const systemPrompt = `You are an expert resume parser. Extract structured data from resume text into a JSON format.

CRITICAL INSTRUCTIONS:
1. Extract ALL information present in the resume - don't skip anything
2. Parse dates into a consistent format (e.g., "MM/YYYY - MM/YYYY" or "MM/YYYY - Present")
3. Extract complete job descriptions and ALL bullet points
4. Identify and categorize ALL skills mentioned anywhere in the resume
5. Extract contact information completely (name, email, phone, location, linkedin, github, website)
6. If information is not present, use empty strings or empty arrays, never null

Return ONLY valid JSON that matches this TypeScript interface:
{
  personalInfo: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  professionalSummary?: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    dates: string;
    description?: string;
    achievements: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    location?: string;
    dates: string;
    gpa?: string;
    relevant?: string[];
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    link?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
  achievements?: string[];
}

Categorize skills intelligently:
- Programming Languages (Python, JavaScript, Java, etc.)
- Frameworks & Libraries (React, Node.js, Django, etc.)
- Databases (MySQL, MongoDB, PostgreSQL, etc.)
- Cloud & DevOps (AWS, Docker, Kubernetes, etc.)
- Tools & Software (Git, VS Code, Jira, etc.)
- Soft Skills (Leadership, Communication, etc.)
- Or create appropriate categories based on the resume content`;

export async function parseResumeWithAI(resumeText: string): Promise<StructuredResume> {
  // Check if OpenAI is configured
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, falling back to basic parser');
    throw new Error('AI parsing not available - OpenAI API key not configured');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  try {
    console.log('[AI-PARSER] Parsing resume with AI, text length:', resumeText.length);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Parse this resume into structured JSON format:\n\n${resumeText}`
        }
      ],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 4000,
      response_format: { type: "json_object" } // Force JSON response
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let parsedResume: StructuredResume;
    try {
      parsedResume = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('[AI-PARSER] Failed to parse AI response as JSON:', parseError);
      throw new Error('AI returned invalid JSON format');
    }

    // Validate and clean the parsed resume
    parsedResume = validateAndCleanResume(parsedResume);
    
    console.log('[AI-PARSER] Successfully parsed resume with AI');
    console.log('[AI-PARSER] Extracted:', {
      name: parsedResume.personalInfo?.name,
      experienceCount: parsedResume.experience?.length || 0,
      educationCount: parsedResume.education?.length || 0,
      skillCategories: parsedResume.skills?.length || 0
    });
    
    return parsedResume;
  } catch (error) {
    console.error('[AI-PARSER] Error parsing resume with AI:', error);
    throw error;
  }
}

function validateAndCleanResume(resume: any): StructuredResume {
  // Ensure the structure matches our interface
  const cleaned: StructuredResume = {
    personalInfo: {
      name: resume.personalInfo?.name || 'Unknown',
      email: resume.personalInfo?.email || undefined,
      phone: resume.personalInfo?.phone || undefined,
      location: resume.personalInfo?.location || undefined,
      linkedin: resume.personalInfo?.linkedin || undefined,
      github: resume.personalInfo?.github || undefined,
      website: resume.personalInfo?.website || undefined
    },
    professionalSummary: resume.professionalSummary || undefined,
    experience: Array.isArray(resume.experience) ? resume.experience.map((exp: any) => ({
      title: exp.title || '',
      company: exp.company || '',
      location: exp.location || undefined,
      dates: exp.dates || '',
      description: exp.description || undefined,
      achievements: Array.isArray(exp.achievements) ? exp.achievements : []
    })) : [],
    education: Array.isArray(resume.education) ? resume.education.map((edu: any) => ({
      degree: edu.degree || '',
      school: edu.school || '',
      location: edu.location || undefined,
      dates: edu.dates || '',
      gpa: edu.gpa || undefined,
      relevant: Array.isArray(edu.relevant) ? edu.relevant : undefined
    })) : [],
    skills: Array.isArray(resume.skills) ? resume.skills.map((skill: any) => ({
      category: skill.category || 'General',
      items: Array.isArray(skill.items) ? skill.items : []
    })) : [],
    projects: Array.isArray(resume.projects) ? resume.projects.map((proj: any) => ({
      name: proj.name || '',
      description: proj.description || '',
      technologies: Array.isArray(proj.technologies) ? proj.technologies : undefined,
      link: proj.link || undefined
    })) : undefined,
    certifications: Array.isArray(resume.certifications) ? resume.certifications.map((cert: any) => ({
      name: cert.name || '',
      issuer: cert.issuer || '',
      date: cert.date || ''
    })) : undefined,
    achievements: Array.isArray(resume.achievements) ? resume.achievements : undefined
  };

  // Remove empty optional arrays
  if (cleaned.projects && cleaned.projects.length === 0) {
    delete cleaned.projects;
  }
  if (cleaned.certifications && cleaned.certifications.length === 0) {
    delete cleaned.certifications;
  }
  if (cleaned.achievements && cleaned.achievements.length === 0) {
    delete cleaned.achievements;
  }

  return cleaned;
}

// Enhanced fallback parser for when AI is not available
export function parseResumeTextFallback(resumeText: string): StructuredResume {
  const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line);
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
  let currentProject: any = null;
  
  // Enhanced section detection patterns
  const sectionPatterns = {
    summary: /^(professional\s+)?summary|objective|profile|about(\s+me)?$/i,
    experience: /^(work\s+)?experience|employment|work\s+history|professional\s+experience$/i,
    education: /^education|academic|qualifications$/i,
    skills: /^skills|technical\s+skills|competencies|expertise$/i,
    projects: /^projects|portfolio|personal\s+projects$/i,
    certifications: /^certifications?|certificates?|licenses?$/i,
    achievements: /^achievements?|accomplishments?|awards?|honors?$/i
  };

  // First pass - try to extract contact info from top of resume
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    
    // Name detection (usually first non-empty line or largest text)
    if (i === 0 || (!resume.personalInfo.name && line.length > 2 && line.match(/^[A-Z][a-z]+ [A-Z][a-z]+/))) {
      resume.personalInfo.name = line.replace(/[^\w\s]/g, '').trim();
    }
    
    // Email detection
    const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      resume.personalInfo.email = emailMatch[0];
    }
    
    // Phone detection
    const phoneMatch = line.match(/[\d\s()+-]+\d{3}[\s-]?\d{4}/);
    if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10) {
      resume.personalInfo.phone = phoneMatch[0].trim();
    }
    
    // LinkedIn detection
    if (line.toLowerCase().includes('linkedin')) {
      const linkedinMatch = line.match(/linkedin\.com\/in\/[\w-]+/i);
      if (linkedinMatch) {
        resume.personalInfo.linkedin = `https://${linkedinMatch[0]}`;
      }
    }
    
    // GitHub detection
    if (line.toLowerCase().includes('github')) {
      const githubMatch = line.match(/github\.com\/[\w-]+/i);
      if (githubMatch) {
        resume.personalInfo.github = `https://${githubMatch[0]}`;
      }
    }
    
    // Location detection
    const locationMatch = line.match(/([A-Z][a-z]+,?\s*[A-Z]{2})|([A-Z][a-z]+,?\s*[A-Z][a-z]+)/);
    if (locationMatch && !resume.personalInfo.location) {
      resume.personalInfo.location = locationMatch[0];
    }
  }

  // Second pass - parse sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for section headers
    let sectionFound = false;
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(line)) {
        currentSection = section;
        sectionFound = true;
        break;
      }
    }
    
    if (sectionFound) continue;
    
    // Parse content based on current section
    switch (currentSection) {
      case 'summary':
        resume.professionalSummary = (resume.professionalSummary || '') + ' ' + line;
        break;
        
      case 'experience':
        // Detect new job entry (look for job title patterns)
        if (line.match(/(manager|engineer|developer|analyst|consultant|specialist|coordinator|director|lead|senior|junior)/i)) {
          if (currentExperience) {
            resume.experience.push(currentExperience);
          }
          currentExperience = {
            title: line,
            company: '',
            dates: '',
            achievements: []
          };
        } else if (currentExperience) {
          // Look for company name (often after title)
          if (!currentExperience.company && (line.includes('Inc') || line.includes('LLC') || line.includes('Corp'))) {
            currentExperience.company = line;
          }
          // Look for dates
          else if (!currentExperience.dates && line.match(/\d{4}/)) {
            currentExperience.dates = line;
          }
          // Bullet points
          else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
            currentExperience.achievements.push(line.replace(/^[•\-*]\s*/, ''));
          }
          // Description
          else if (line.length > 20) {
            currentExperience.description = (currentExperience.description || '') + ' ' + line;
          }
        }
        break;
        
      case 'education':
        // Detect degree/school
        if (line.match(/(bachelor|master|phd|associate|diploma|degree)/i)) {
          if (currentEducation) {
            resume.education.push(currentEducation);
          }
          currentEducation = {
            degree: line,
            school: '',
            dates: ''
          };
        } else if (currentEducation) {
          if (!currentEducation.school && (line.includes('University') || line.includes('College') || line.includes('Institute'))) {
            currentEducation.school = line;
          } else if (!currentEducation.dates && line.match(/\d{4}/)) {
            currentEducation.dates = line;
          } else if (line.toLowerCase().includes('gpa')) {
            currentEducation.gpa = line.match(/[\d.]+/)?.[0];
          }
        }
        break;
        
      case 'skills':
        // Parse skills - handle various formats
        if (line.includes(':')) {
          const [category, items] = line.split(':');
          resume.skills.push({
            category: category.trim(),
            items: items.split(',').map(s => s.trim())
          });
        } else {
          // Add to general skills
          let generalSkills = resume.skills.find(s => s.category === 'General');
          if (!generalSkills) {
            generalSkills = { category: 'General', items: [] };
            resume.skills.push(generalSkills);
          }
          generalSkills.items.push(...line.split(',').map(s => s.trim()));
        }
        break;
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