import React from 'react';
import { StructuredResume } from '../../../shared/types/resume';
import { Mail, Phone, MapPin, Linkedin, Github, Globe, Download, FileText } from 'lucide-react';
import { Button } from './ui/button';

interface ResumeViewerProps {
  resume: StructuredResume;
  theme?: 'classic' | 'modern' | 'minimal';
  onDownload?: () => void;
  className?: string;
}

export function ResumeViewer({ 
  resume, 
  theme = 'modern',
  onDownload,
  className = '' 
}: ResumeViewerProps) {
  
  const themeStyles = {
    classic: {
      container: 'bg-white text-gray-900',
      header: 'border-b-2 border-gray-800 pb-4',
      name: 'text-4xl font-serif text-gray-900',
      sectionTitle: 'text-lg font-bold border-b border-gray-400 pb-1 mb-3 text-gray-800',
      accent: 'text-blue-700'
    },
    modern: {
      container: 'bg-gradient-to-br from-slate-50 to-gray-50 text-gray-900',
      header: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 -m-8 mb-6 rounded-t-lg',
      name: 'text-4xl font-bold',
      sectionTitle: 'text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4',
      accent: 'text-purple-600'
    },
    minimal: {
      container: 'bg-white text-gray-800',
      header: 'border-b border-gray-200 pb-6',
      name: 'text-3xl font-light tracking-wide text-gray-900',
      sectionTitle: 'text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3',
      accent: 'text-gray-600'
    }
  };
  
  const styles = themeStyles[theme];
  
  return (
    <div className={`relative ${className}`}>
      {/* Download Button */}
      {onDownload && (
        <Button
          onClick={onDownload}
          className="absolute top-4 right-4 z-10"
          variant="outline"
          size="sm"
        >
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      )}
      
      {/* Resume Content */}
      <div className={`p-8 rounded-lg shadow-lg ${styles.container} max-w-4xl mx-auto`}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.name}>{resume.personalInfo.name}</h1>
          <div className={`flex flex-wrap gap-4 mt-3 ${theme === 'modern' ? 'text-white/90' : 'text-gray-600'} text-sm`}>
            {resume.personalInfo.email && (
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                <span>{resume.personalInfo.email}</span>
              </div>
            )}
            {resume.personalInfo.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                <span>{resume.personalInfo.phone}</span>
              </div>
            )}
            {resume.personalInfo.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{resume.personalInfo.location}</span>
              </div>
            )}
            {resume.personalInfo.linkedin && (
              <div className="flex items-center gap-1">
                <Linkedin className="h-4 w-4" />
                <a href={resume.personalInfo.linkedin} className="hover:underline">
                  LinkedIn
                </a>
              </div>
            )}
            {resume.personalInfo.github && (
              <div className="flex items-center gap-1">
                <Github className="h-4 w-4" />
                <a href={resume.personalInfo.github} className="hover:underline">
                  GitHub
                </a>
              </div>
            )}
            {resume.personalInfo.website && (
              <div className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                <a href={resume.personalInfo.website} className="hover:underline">
                  Portfolio
                </a>
              </div>
            )}
          </div>
        </header>

        {/* Professional Summary */}
        {resume.professionalSummary && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>Professional Summary</h2>
            <p className="text-gray-700 leading-relaxed">
              {resume.professionalSummary}
            </p>
          </section>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>Work Experience</h2>
            <div className="space-y-4">
              {resume.experience.map((exp, idx) => (
                <div key={idx} className="relative">
                  {theme === 'modern' && idx > 0 && (
                    <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 to-purple-200" />
                  )}
                  <div className={theme === 'modern' ? 'ml-2' : ''}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{exp.title}</h3>
                        <p className={`${styles.accent} font-medium`}>{exp.company}</p>
                        {exp.location && (
                          <p className="text-sm text-gray-500">{exp.location}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 font-medium">{exp.dates}</span>
                    </div>
                    {exp.description && (
                      <p className="mt-2 text-gray-700">{exp.description}</p>
                    )}
                    {exp.achievements.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {exp.achievements.map((achievement, i) => (
                          <li key={i} className="text-gray-700 flex">
                            <span className={`mr-2 ${styles.accent}`}>•</span>
                            <span>{achievement}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>Education</h2>
            <div className="space-y-3">
              {resume.education.map((edu, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                      <p className={styles.accent}>{edu.school}</p>
                      {edu.location && (
                        <p className="text-sm text-gray-500">{edu.location}</p>
                      )}
                      {edu.gpa && (
                        <p className="text-sm text-gray-600">GPA: {edu.gpa}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 font-medium">{edu.dates}</span>
                  </div>
                  {edu.relevant && edu.relevant.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Relevant Coursework: {edu.relevant.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>Skills</h2>
            <div className="space-y-2">
              {resume.skills.map((skillGroup, idx) => (
                <div key={idx} className="flex flex-wrap gap-2">
                  {skillGroup.category !== 'General' && (
                    <span className="font-semibold text-gray-700">{skillGroup.category}:</span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.items.map((skill, i) => (
                      <span
                        key={i}
                        className={`
                          ${theme === 'modern' 
                            ? 'px-3 py-1 bg-gradient-to-r from-blue-50 to-purple-50 text-gray-700 rounded-full text-sm border border-purple-200' 
                            : theme === 'minimal'
                            ? 'text-gray-700'
                            : 'px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm'
                          }
                        `}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {resume.projects && resume.projects.length > 0 && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>Projects</h2>
            <div className="space-y-3">
              {resume.projects.map((project, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-gray-900">
                    {project.name}
                    {project.link && (
                      <a href={project.link} className={`ml-2 text-sm ${styles.accent} hover:underline`}>
                        View Project →
                      </a>
                    )}
                  </h3>
                  <p className="text-gray-700 mt-1">{project.description}</p>
                  {project.technologies && project.technologies.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Technologies: {project.technologies.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications */}
        {resume.certifications && resume.certifications.length > 0 && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>Certifications</h2>
            <div className="space-y-2">
              {resume.certifications.map((cert, idx) => (
                <div key={idx} className="flex justify-between">
                  <div>
                    <span className="font-semibold text-gray-900">{cert.name}</span>
                    <span className="text-gray-600 ml-2">• {cert.issuer}</span>
                  </div>
                  <span className="text-sm text-gray-500">{cert.date}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Achievements */}
        {resume.achievements && resume.achievements.length > 0 && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>Achievements</h2>
            <ul className="space-y-1">
              {resume.achievements.map((achievement, idx) => (
                <li key={idx} className="text-gray-700 flex">
                  <span className={`mr-2 ${styles.accent}`}>•</span>
                  <span>{achievement}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}