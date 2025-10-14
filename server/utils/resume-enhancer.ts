// Resume Enhancement Utilities for Post-Processing

// Strong action verbs categorized by type
export const ACTION_VERBS = {
  leadership: [
    'Spearheaded', 'Orchestrated', 'Championed', 'Pioneered', 'Transformed',
    'Directed', 'Guided', 'Mentored', 'Coached', 'Facilitated'
  ],
  achievement: [
    'Exceeded', 'Surpassed', 'Delivered', 'Accomplished', 'Attained',
    'Achieved', 'Earned', 'Generated', 'Produced', 'Realized'
  ],
  improvement: [
    'Optimized', 'Streamlined', 'Enhanced', 'Revitalized', 'Modernized',
    'Upgraded', 'Refined', 'Improved', 'Strengthened', 'Elevated'
  ],
  growth: [
    'Expanded', 'Accelerated', 'Amplified', 'Scaled', 'Maximized',
    'Increased', 'Boosted', 'Advanced', 'Grew', 'Extended'
  ],
  innovation: [
    'Innovated', 'Designed', 'Architected', 'Engineered', 'Developed',
    'Created', 'Launched', 'Initiated', 'Established', 'Founded'
  ],
  analysis: [
    'Analyzed', 'Evaluated', 'Assessed', 'Investigated', 'Diagnosed',
    'Researched', 'Examined', 'Audited', 'Reviewed', 'Studied'
  ],
  management: [
    'Managed', 'Coordinated', 'Administered', 'Supervised', 'Oversaw',
    'Organized', 'Executed', 'Implemented', 'Maintained', 'Operated'
  ]
};

// Weak phrases to replace
const WEAK_PHRASES = [
  'responsible for',
  'helped with',
  'assisted in',
  'worked on',
  'involved in',
  'participated in',
  'contributed to',
  'duties included',
  'tasks included'
];

// Format date to MM/YYYY format
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // If already in correct format, return as is
  if (/^\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  
  // Handle "Present" or "Current"
  if (dateStr.toLowerCase().includes('present') || dateStr.toLowerCase().includes('current')) {
    return 'Present';
  }
  
  // Try to parse various date formats
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${year}`;
  }
  
  // Handle year-only format
  if (/^\d{4}$/.test(dateStr)) {
    return `01/${dateStr}`;
  }
  
  // Handle Month Year format (e.g., "January 2023")
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                     'july', 'august', 'september', 'october', 'november', 'december'];
  const parts = dateStr.toLowerCase().split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const monthIndex = monthNames.indexOf(parts[i]);
    if (monthIndex !== -1) {
      const year = parts.find(p => /^\d{4}$/.test(p));
      if (year) {
        const month = (monthIndex + 1).toString().padStart(2, '0');
        return `${month}/${year}`;
      }
    }
  }
  
  return dateStr; // Return original if can't parse
}

// Ensure bullet point starts with strong action verb
export function enhanceBulletPoint(bullet: string): string {
  let enhanced = bullet.trim();
  
  // Remove bullet markers if present
  enhanced = enhanced.replace(/^[•\-\*]\s*/, '');
  
  // Check if it starts with a weak phrase
  const lowerBullet = enhanced.toLowerCase();
  for (const weakPhrase of WEAK_PHRASES) {
    if (lowerBullet.startsWith(weakPhrase)) {
      // Replace with a strong action verb
      const category = detectBulletCategory(enhanced);
      const actionVerbs = ACTION_VERBS[category as keyof typeof ACTION_VERBS] || ACTION_VERBS.achievement;
      const verb = actionVerbs[Math.floor(Math.random() * Math.min(3, actionVerbs.length))];
      enhanced = enhanced.substring(weakPhrase.length).trim();
      enhanced = verb + ' ' + enhanced;
      break;
    }
  }
  
  // Ensure first letter is capitalized
  if (enhanced.length > 0) {
    enhanced = enhanced[0].toUpperCase() + enhanced.slice(1);
  }
  
  // Ensure it ends with proper punctuation
  if (!enhanced.match(/[.!?]$/)) {
    enhanced += '.';
  }
  
  return '• ' + enhanced;
}

// Detect the category of achievement for appropriate action verb
function detectBulletCategory(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('led') || lower.includes('managed') || lower.includes('team')) {
    return 'leadership';
  }
  if (lower.includes('increased') || lower.includes('grew') || lower.includes('expanded')) {
    return 'growth';
  }
  if (lower.includes('improved') || lower.includes('optimized') || lower.includes('reduced')) {
    return 'improvement';
  }
  if (lower.includes('created') || lower.includes('developed') || lower.includes('designed')) {
    return 'innovation';
  }
  if (lower.includes('analyzed') || lower.includes('researched') || lower.includes('evaluated')) {
    return 'analysis';
  }
  
  return 'achievement'; // Default category
}

// Add quantification to bullets where possible
export function addQuantification(bullet: string): string {
  let enhanced = bullet;
  
  // Pattern replacements for common improvements without numbers
  const patterns = [
    { pattern: /improved\s+(\w+)/i, replace: 'improved $1 by 20-30%' },
    { pattern: /increased\s+(\w+)/i, replace: 'increased $1 by 25%' },
    { pattern: /reduced\s+(\w+)/i, replace: 'reduced $1 by 15-20%' },
    { pattern: /streamlined\s+(\w+)/i, replace: 'streamlined $1, improving efficiency by 30%' },
    { pattern: /enhanced\s+(\w+)/i, replace: 'enhanced $1, resulting in 20% improvement' },
    { pattern: /managed\s+team/i, replace: 'managed cross-functional team of 5-10 members' },
    { pattern: /led\s+team/i, replace: 'led team of 8-12 professionals' }
  ];
  
  // Only add quantification if none exists
  if (!enhanced.match(/\d+/)) {
    for (const { pattern, replace } of patterns) {
      if (pattern.test(enhanced) && !enhanced.match(/\d+/)) {
        enhanced = enhanced.replace(pattern, replace);
        break;
      }
    }
  }
  
  return enhanced;
}

// Categorize and organize skills
export function categorizeSkills(skills: string[]): Record<string, string[]> {
  const categorized: Record<string, string[]> = {
    'Programming Languages': [],
    'Frameworks & Libraries': [],
    'Databases': [],
    'Cloud & DevOps': [],
    'Tools & Software': [],
    'Soft Skills': [],
    'Languages': [],
    'Other Technical': []
  };
  
  const programmingLangs = ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'php', 'r', 'scala', 'perl'];
  const frameworks = ['react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'rails', '.net', 'laravel', 'nextjs', 'gatsby'];
  const databases = ['mysql', 'postgresql', 'mongodb', 'redis', 'oracle', 'sql server', 'dynamodb', 'cassandra', 'elasticsearch'];
  const cloudTools = ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible', 'ci/cd'];
  const softSkills = ['leadership', 'communication', 'teamwork', 'problem-solving', 'analytical', 'project management', 'agile', 'scrum'];
  const languages = ['english', 'spanish', 'french', 'german', 'chinese', 'japanese', 'arabic', 'hindi', 'portuguese'];
  
  for (const skill of skills) {
    const lowerSkill = skill.toLowerCase().trim();
    
    if (programmingLangs.some(lang => lowerSkill.includes(lang))) {
      categorized['Programming Languages'].push(skill);
    } else if (frameworks.some(fw => lowerSkill.includes(fw))) {
      categorized['Frameworks & Libraries'].push(skill);
    } else if (databases.some(db => lowerSkill.includes(db))) {
      categorized['Databases'].push(skill);
    } else if (cloudTools.some(tool => lowerSkill.includes(tool))) {
      categorized['Cloud & DevOps'].push(skill);
    } else if (softSkills.some(soft => lowerSkill.includes(soft))) {
      categorized['Soft Skills'].push(skill);
    } else if (languages.some(lang => lowerSkill.includes(lang))) {
      categorized['Languages'].push(skill);
    } else if (lowerSkill.includes('microsoft') || lowerSkill.includes('adobe') || lowerSkill.includes('office')) {
      categorized['Tools & Software'].push(skill);
    } else {
      categorized['Other Technical'].push(skill);
    }
  }
  
  // Remove empty categories
  Object.keys(categorized).forEach(key => {
    if (categorized[key].length === 0) {
      delete categorized[key];
    }
  });
  
  return categorized;
}

// Enhance professional summary
export function enhanceProfessionalSummary(summary: string, role?: string): string {
  if (!summary) return '';
  
  let enhanced = summary.trim();
  
  // Ensure it starts strong
  const starterPhrases = [
    'Results-driven',
    'Accomplished',
    'Strategic',
    'Innovative',
    'Dynamic',
    'Experienced'
  ];
  
  // Check if summary starts with a weak beginning
  if (!starterPhrases.some(phrase => enhanced.toLowerCase().startsWith(phrase.toLowerCase()))) {
    // Add a strong starter if the role is known
    if (role) {
      enhanced = `Accomplished ${role} with ${enhanced.toLowerCase()}`;
    }
  }
  
  // Ensure summary is substantial (at least 3 sentences)
  const sentences = enhanced.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 3) {
    enhanced += ' Proven track record of delivering results and exceeding expectations.';
    enhanced += ' Seeking to leverage expertise to drive organizational success.';
  }
  
  return enhanced;
}

// Main function to enhance entire resume text
export function enhanceResumeText(resumeText: string): string {
  let enhanced = resumeText;
  
  // Process all bullet points
  const bulletRegex = /^[\s]*[•\-\*]\s*.+$/gm;
  const bullets = enhanced.match(bulletRegex) || [];
  
  bullets.forEach(bullet => {
    let enhancedBullet = enhanceBulletPoint(bullet);
    enhancedBullet = addQuantification(enhancedBullet);
    enhanced = enhanced.replace(bullet, enhancedBullet);
  });
  
  // Format all dates
  const dateRegex = /\b(\w+\s+\d{4}|\d{4}|\d{1,2}\/\d{4})\s*[-–]\s*(\w+\s+\d{4}|\d{4}|\d{1,2}\/\d{4}|Present|Current)\b/gi;
  enhanced = enhanced.replace(dateRegex, (match, start, end) => {
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);
    return `${formattedStart} - ${formattedEnd}`;
  });
  
  // Ensure consistent formatting
  enhanced = enhanced.replace(/\n{3,}/g, '\n\n'); // Remove excessive line breaks
  enhanced = enhanced.replace(/\s+$/gm, ''); // Remove trailing spaces
  
  return enhanced;
}

// Validate resume completeness
export function validateResume(resumeText: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for essential sections
  const sections = {
    'Contact': /email|phone|@|\d{3}.*\d{4}/i,
    'Summary': /professional summary|summary|objective/i,
    'Experience': /experience|work history|employment/i,
    'Education': /education|degree|university|college/i,
    'Skills': /skills|technical|competencies/i
  };
  
  for (const [section, pattern] of Object.entries(sections)) {
    if (!pattern.test(resumeText)) {
      issues.push(`Missing ${section} section`);
    }
  }
  
  // Check for bullet points in experience
  const bulletCount = (resumeText.match(/^[\s]*[•\-\*]/gm) || []).length;
  if (bulletCount < 3) {
    issues.push('Insufficient bullet points for achievements');
  }
  
  // Check for action verbs
  const hasActionVerbs = Object.values(ACTION_VERBS).flat()
    .some(verb => resumeText.includes(verb));
  if (!hasActionVerbs) {
    issues.push('Lacking strong action verbs');
  }
  
  // Check for quantification
  if (!resumeText.match(/\d+%|\$\d+|\d+\+/)) {
    issues.push('Missing quantified achievements');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}