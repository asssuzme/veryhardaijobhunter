import React from 'react';
import { StructuredResume } from '../../../shared/types/resume';
import { Mail, Phone, MapPin, Linkedin, Github, Globe, Download, FileText, Briefcase, GraduationCap, Award, Code, FolderOpen, Star, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { motion } from 'framer-motion';

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
      container: 'bg-gradient-to-b from-white to-gray-50 text-gray-900 print:bg-white',
      header: 'border-b-4 border-double border-gray-800 pb-6 mb-8',
      name: 'text-5xl font-serif text-gray-900 mb-2 tracking-tight',
      sectionTitle: 'text-xl font-serif font-bold border-b-2 border-gray-400 pb-2 mb-4 text-gray-800 flex items-center gap-2',
      accent: 'text-blue-700 hover:text-blue-800 transition-colors',
      contactIcon: 'h-5 w-5 text-blue-600',
      bulletIcon: 'text-blue-600',
      skillBadge: 'px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm font-medium transition-all hover:shadow-sm',
      experienceCard: 'hover:bg-gray-50 p-4 -mx-4 rounded-lg transition-all duration-200',
      sectionIcon: 'h-5 w-5 text-gray-600',
      shadow: 'shadow-lg',
      animation: 'hover:shadow-xl transition-shadow duration-300'
    },
    modern: {
      container: 'bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 text-gray-900 print:bg-white',
      header: 'bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white p-10 -m-8 mb-8 rounded-t-2xl shadow-2xl relative overflow-hidden',
      name: 'text-5xl font-extrabold mb-3 tracking-tight animate-fade-in',
      sectionTitle: 'text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-6 flex items-center gap-3 relative after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gradient-to-r after:from-blue-600 after:to-purple-600 after:opacity-20 pb-2',
      accent: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 font-semibold hover:from-purple-700 hover:to-pink-700 transition-all',
      contactIcon: 'h-5 w-5 text-white/90',
      bulletIcon: 'text-purple-600',
      skillBadge: 'px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 hover:from-blue-200 hover:to-purple-200 text-gray-800 rounded-full text-sm font-semibold border border-purple-200/50 transition-all transform hover:scale-105 hover:shadow-md',
      experienceCard: 'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 p-5 -mx-5 rounded-xl transition-all duration-300 hover:shadow-lg',
      sectionIcon: 'h-6 w-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600',
      shadow: 'shadow-2xl',
      animation: 'hover:shadow-3xl transition-all duration-300 hover:scale-[1.01]'
    },
    minimal: {
      container: 'bg-white text-gray-800 print:bg-white',
      header: 'border-b-2 border-gray-100 pb-8 mb-8',
      name: 'text-4xl font-light tracking-widest text-gray-900 mb-3 uppercase',
      sectionTitle: 'text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-3 border-b border-gray-100 pb-3',
      accent: 'text-gray-700 hover:text-black transition-colors font-medium',
      contactIcon: 'h-4 w-4 text-gray-400',
      bulletIcon: 'text-gray-400',
      skillBadge: 'text-gray-700 text-sm after:content-["•"] last:after:content-[""] after:ml-3 after:mr-3 after:text-gray-300',
      experienceCard: 'hover:bg-gray-50/50 py-4 transition-colors duration-200',
      sectionIcon: 'h-4 w-4 text-gray-400',
      shadow: 'shadow-md',
      animation: 'hover:shadow-lg transition-shadow duration-300'
    }
  };
  
  const styles = themeStyles[theme];
  
  // Animation variants for sections
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* Download Button */}
      {onDownload && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            onClick={onDownload}
            className="absolute top-4 right-4 z-10 shadow-lg hover:shadow-xl transition-all no-print"
            variant="outline"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </motion.div>
      )}
      
      {/* Resume Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`p-10 rounded-2xl ${styles.shadow} ${styles.container} ${styles.animation} max-w-4xl mx-auto print:shadow-none print:p-0`}
      >
        {/* Header with decorative background for modern theme */}
        {theme === 'modern' && (
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-blue-400/10 via-purple-400/10 to-pink-400/10 rounded-t-2xl pointer-events-none no-print" />
        )}
        
        <header className={`relative ${styles.header}`}>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={styles.name}
          >
            {resume.personalInfo.name}
          </motion.h1>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className={`flex flex-wrap gap-4 mt-4 ${theme === 'modern' ? 'text-white/95' : 'text-gray-600'} text-sm`}
          >
            {resume.personalInfo.email && (
              <div className="flex items-center gap-2 group">
                <Mail className={`${styles.contactIcon} transition-transform group-hover:scale-110`} />
                <a href={`mailto:${resume.personalInfo.email}`} className="hover:underline">
                  {resume.personalInfo.email}
                </a>
              </div>
            )}
            {resume.personalInfo.phone && (
              <div className="flex items-center gap-2 group">
                <Phone className={`${styles.contactIcon} transition-transform group-hover:scale-110`} />
                <span>{resume.personalInfo.phone}</span>
              </div>
            )}
            {resume.personalInfo.location && (
              <div className="flex items-center gap-2 group">
                <MapPin className={`${styles.contactIcon} transition-transform group-hover:scale-110`} />
                <span>{resume.personalInfo.location}</span>
              </div>
            )}
            {resume.personalInfo.linkedin && (
              <div className="flex items-center gap-2 group">
                <Linkedin className={`${styles.contactIcon} transition-transform group-hover:scale-110`} />
                <a href={resume.personalInfo.linkedin} className="hover:underline">
                  LinkedIn
                </a>
              </div>
            )}
            {resume.personalInfo.github && (
              <div className="flex items-center gap-2 group">
                <Github className={`${styles.contactIcon} transition-transform group-hover:scale-110`} />
                <a href={resume.personalInfo.github} className="hover:underline">
                  GitHub
                </a>
              </div>
            )}
            {resume.personalInfo.website && (
              <div className="flex items-center gap-2 group">
                <Globe className={`${styles.contactIcon} transition-transform group-hover:scale-110`} />
                <a href={resume.personalInfo.website} className="hover:underline">
                  Portfolio
                </a>
              </div>
            )}
          </motion.div>
        </header>

        {/* Professional Summary */}
        {resume.professionalSummary && (
          <motion.section 
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="mt-8"
          >
            <h2 className={styles.sectionTitle}>
              {theme === 'modern' && <Star className={styles.sectionIcon} />}
              Professional Summary
            </h2>
            <p className="text-gray-700 leading-relaxed text-base">
              {resume.professionalSummary}
            </p>
          </motion.section>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <motion.section 
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="mt-8"
          >
            <h2 className={styles.sectionTitle}>
              <Briefcase className={styles.sectionIcon} />
              Work Experience
            </h2>
            <div className="space-y-6">
              {resume.experience.map((exp, idx) => (
                <motion.div 
                  key={idx} 
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: idx * 0.1 }}
                  className={`relative ${styles.experienceCard}`}
                >
                  {theme === 'modern' && idx > 0 && (
                    <div className="absolute -left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-purple-300 no-print" />
                  )}
                  <div className={theme === 'modern' ? 'ml-3' : ''}>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{exp.title}</h3>
                        <p className={`${styles.accent} font-semibold text-base`}>{exp.company}</p>
                        {exp.location && (
                          <p className="text-sm text-gray-500 mt-1">{exp.location}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 font-medium whitespace-nowrap bg-gray-100 px-3 py-1 rounded-full">
                        {exp.dates}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="mt-3 text-gray-700 leading-relaxed">{exp.description}</p>
                    )}
                    {exp.achievements.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {exp.achievements.map((achievement, i) => (
                          <motion.li 
                            key={i} 
                            className="text-gray-700 flex"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 + i * 0.05 }}
                          >
                            <ChevronRight className={`h-4 w-4 mr-2 mt-0.5 flex-shrink-0 ${styles.bulletIcon}`} />
                            <span className="text-sm leading-relaxed">{achievement}</span>
                          </motion.li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <motion.section 
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="mt-8"
          >
            <h2 className={styles.sectionTitle}>
              <GraduationCap className={styles.sectionIcon} />
              Education
            </h2>
            <div className="space-y-4">
              {resume.education.map((edu, idx) => (
                <motion.div 
                  key={idx}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: idx * 0.1 }}
                  className="group hover:bg-gray-50/50 p-3 -mx-3 rounded-lg transition-all"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{edu.degree}</h3>
                      <p className={`${styles.accent} font-medium`}>{edu.school}</p>
                      {edu.location && (
                        <p className="text-sm text-gray-500 mt-1">{edu.location}</p>
                      )}
                      {edu.gpa && (
                        <span className="inline-block mt-2 text-sm font-medium bg-green-100 text-green-800 px-2 py-1 rounded">
                          GPA: {edu.gpa}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      {edu.dates}
                    </span>
                  </div>
                  {edu.relevant && edu.relevant.length > 0 && (
                    <p className="text-sm text-gray-600 mt-3">
                      <span className="font-semibold">Relevant Coursework:</span> {edu.relevant.join(', ')}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <motion.section 
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="mt-8"
          >
            <h2 className={styles.sectionTitle}>
              <Code className={styles.sectionIcon} />
              Skills
            </h2>
            <div className="space-y-4">
              {resume.skills.map((skillGroup, idx) => (
                <motion.div 
                  key={idx} 
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: idx * 0.1 }}
                  className="flex flex-wrap items-start gap-3"
                >
                  {skillGroup.category !== 'General' && (
                    <span className="font-bold text-gray-700 min-w-[100px]">
                      {skillGroup.category}:
                    </span>
                  )}
                  <div className="flex flex-wrap gap-2 flex-1">
                    {theme === 'minimal' ? (
                      <span className="text-gray-700 text-sm">
                        {skillGroup.items.map((skill, i) => (
                          <span key={i} className={styles.skillBadge}>
                            {skill}
                          </span>
                        ))}
                      </span>
                    ) : (
                      skillGroup.items.map((skill, i) => (
                        <motion.span
                          key={i}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={styles.skillBadge}
                        >
                          {skill}
                        </motion.span>
                      ))
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Projects */}
        {resume.projects && resume.projects.length > 0 && (
          <motion.section 
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="mt-8"
          >
            <h2 className={styles.sectionTitle}>
              <FolderOpen className={styles.sectionIcon} />
              Projects
            </h2>
            <div className="space-y-4">
              {resume.projects.map((project, idx) => (
                <motion.div 
                  key={idx}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: idx * 0.1 }}
                  className="group p-4 -mx-4 hover:bg-gray-50/50 rounded-lg transition-all"
                >
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {project.name}
                    {project.link && (
                      <a 
                        href={project.link} 
                        className={`text-sm ${styles.accent} hover:underline inline-flex items-center gap-1 transition-all hover:gap-2`}
                      >
                        View Project <ChevronRight className="h-3 w-3" />
                      </a>
                    )}
                  </h3>
                  <p className="text-gray-700 mt-2 leading-relaxed">{project.description}</p>
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {project.technologies.map((tech, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Certifications */}
        {resume.certifications && resume.certifications.length > 0 && (
          <motion.section 
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="mt-8"
          >
            <h2 className={styles.sectionTitle}>
              <Award className={styles.sectionIcon} />
              Certifications
            </h2>
            <div className="space-y-3">
              {resume.certifications.map((cert, idx) => (
                <motion.div 
                  key={idx} 
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: idx * 0.1 }}
                  className="flex flex-col sm:flex-row justify-between items-start gap-2 p-3 -mx-3 hover:bg-gray-50/50 rounded-lg transition-all"
                >
                  <div>
                    <span className="font-semibold text-gray-900">{cert.name}</span>
                    <span className="text-gray-600 ml-2">• {cert.issuer}</span>
                  </div>
                  <span className="text-sm text-gray-500 font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded">
                    {cert.date}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Achievements */}
        {resume.achievements && resume.achievements.length > 0 && (
          <motion.section 
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="mt-8"
          >
            <h2 className={styles.sectionTitle}>
              <Star className={styles.sectionIcon} />
              Achievements
            </h2>
            <ul className="space-y-2">
              {resume.achievements.map((achievement, idx) => (
                <motion.li 
                  key={idx} 
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: idx * 0.1 }}
                  className="text-gray-700 flex group p-2 -mx-2 hover:bg-gray-50/50 rounded transition-all"
                >
                  <ChevronRight className={`h-4 w-4 mr-2 mt-0.5 flex-shrink-0 ${styles.bulletIcon} transition-transform group-hover:translate-x-1`} />
                  <span className="leading-relaxed">{achievement}</span>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}