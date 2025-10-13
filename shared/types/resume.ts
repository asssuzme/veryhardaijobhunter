export interface StructuredResume {
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
  
  experience: {
    title: string;
    company: string;
    location?: string;
    dates: string;
    description?: string;
    achievements: string[];
  }[];
  
  education: {
    degree: string;
    school: string;
    location?: string;
    dates: string;
    gpa?: string;
    relevant?: string[];
  }[];
  
  skills: {
    category: string;
    items: string[];
  }[];
  
  projects?: {
    name: string;
    description: string;
    technologies?: string[];
    link?: string;
  }[];
  
  certifications?: {
    name: string;
    issuer: string;
    date: string;
  }[];
  
  achievements?: string[];
}

export interface ResumeTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerFont: string;
  layout: 'classic' | 'modern' | 'minimal' | 'creative';
}