import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { users, jobScrapingRequests, emailApplications, gmailCredentials } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { registerGmailAuthRoutes } from './routes/gmail-auth';
import { registerDodoPaymentRoutes } from './routes/dodo-payments-routes';
import { refreshGmailToken } from './gmailOAuth';
import OpenAI from "openai";
import multer from "multer";
import { google } from "googleapis";
import passport from './passport-config';
import { storage } from './storage';
import { scrapeLinkedInJobs, generateLinkedInSearchUrl } from './apify-scraper';
import { ApifyClient } from 'apify-client';
import path from 'path';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string | null;
      firstName?: string | null;
      lastName?: string | null;
      profileImageUrl?: string | null;
      totalJobsScraped?: number | null;
      totalApplicationsSent?: number | null;
      resumeText?: string | null;
      resumeFileName?: string | null;
      resumeFileData?: string | null;
      resumeFileMimeType?: string | null;
      resumeUploadedAt?: Date | null;
      paymentCustomerId?: string | null;
      subscriptionId?: string | null;
      subscriptionStatus?: string | null;
      subscriptionExpiresAt?: Date | null;
      pendingPaymentOrderId?: string | null;
      createdAt?: Date | null;
      updatedAt?: Date | null;
    }
    
    interface Request {
      user?: User;
    }
  }
}

// Add session data interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Enhanced multer configuration with security features
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for large documents and images
    files: 5, // Maximum 5 files per request
    fieldSize: 10 * 1024 * 1024, // 10MB per field
    fields: 10, // Maximum number of non-file fields
  },
  fileFilter: (req, file, cb) => {
    // Security: Validate file types
    const allowedMimeTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'audio/webm',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/m4a',
      'audio/mp4',
      'image/tiff'
    ];
    
    const allowedExtensions = ['.txt', '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.webm', '.mp3', '.mpeg', '.wav', '.m4a', '.mp4'];
    const fileExtension = path.extname(file.originalname || '').toLowerCase();
    
    // Check both MIME type and file extension for security
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      // Additional security: Check for suspicious file names
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        console.log(`[SECURITY] Rejected suspicious filename: ${file.originalname}`);
        cb(new Error('Invalid file name detected') as any);
        return;
      }
      cb(null, true);
    } else {
      console.log(`[SECURITY] Rejected file: ${file.originalname}, MIME: ${file.mimetype}, Extension: ${fileExtension}`);
      cb(new Error(`Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`) as any);
    }
  }
});
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Background job processing function
// Filter jobs for quality leads
function filterJobs(jobs: any[]): any[] {
  console.log('Filtering jobs, total count:', jobs.length);
  
  if (jobs.length > 0) {
    console.log('First job sample:', JSON.stringify(jobs[0], null, 2));
  }
  
  // Map jobs to ensure all required fields are present for FilteredJobData
  return jobs.map(job => {
    // Ensure basic structure even if fields are missing
    return {
      ...job,
      // Map position/title correctly
      title: job.jobTitle || job.title || 'Position Not Specified',
      jobTitle: job.jobTitle || job.title || 'Position Not Specified',
      companyName: job.companyName || job.company || 'Company Not Specified',
      // Map LinkedIn job URL correctly 
      link: job.applyUrl || job.url || job.link || '',
      applyUrl: job.applyUrl || job.url || job.link || '',
      // Add company logo placeholder (can be enriched later)
      companyLogo: job.companyLogo || null,
      // Map description fields
      description: job.description || job.descriptionText || '',
      requirement: job.requirement || job.description || job.descriptionText || '',
      // Map location
      location: job.location || 'Not specified',
      // Map other fields
      salaryInfo: job.salary || job.salaryInfo || null,
      workType: job.workType || job.type || job.employmentType || 'Not specified',
      postedDate: job.postedDate || job.posted || job.postedAt || null,
      experienceLevel: job.experienceLevel || job.experience || job.seniorityLevel || null,
      // These will be set during enrichment
      canApply: false,
      jobPosterName: job.jobPosterName || '',
      jobPosterUrl: job.jobPosterUrl || '',
      companyWebsite: '',
      companyLinkedinUrl: ''
    };
  });
}

// Enrich jobs with LinkedIn profiles to find contact emails
async function enrichJobsWithProfiles(jobs: any[]): Promise<any[]> {
  console.log(`Starting enrichment for ${jobs.length} jobs...`);
  
  const enrichedJobs = await Promise.all(
    jobs.map(async (job) => {
      try {
        // Map the job data to FilteredJobData structure with proper field names
        const mappedJob = {
          ...job,
          // Map position/title correctly
          title: job.jobTitle || job.title || 'Position Not Specified',
          companyName: job.companyName || job.company || 'Company Not Specified',
          // Map LinkedIn job URL correctly 
          link: job.applyUrl || job.url || job.link || '',
          // Add company logo placeholder (can be enriched later with a service)
          companyLogo: job.companyLogo || null,
          // Map job description
          description: job.description || job.descriptionText || '',
          requirement: job.requirement || job.description || job.descriptionText || '',
          // Map location
          location: job.location || 'Not specified',
          // Map salary info
          salaryInfo: job.salary || job.salaryInfo || null,
          // Map work type
          workType: job.workType || job.type || job.employmentType || 'Not specified',
          // Map posted date
          postedDate: job.postedDate || job.posted || job.postedAt || null
        };
        
        // If job has a LinkedIn post URL, try to get poster profile
        if (mappedJob.link && mappedJob.link.includes('linkedin.com')) {
          const profileData = await scrapeLinkedInProfile(job);
          
          if (profileData) {
            // Only mark as can apply if we have an email address
            const hasEmail = profileData.email && profileData.email.trim() !== '';
            
            return {
              ...mappedJob,
              jobPosterName: profileData.name || job.jobPosterName || '',
              jobPosterEmail: hasEmail ? profileData.email : null,
              contactEmail: hasEmail ? profileData.email : null,  // Add contactEmail for compatibility
              jobPosterLinkedinUrl: profileData.profileUrl || job.jobPosterUrl || '', 
              jobPosterImageUrl: profileData.profilePicture || null, // Add profile picture URL
              jobPosterTitle: profileData.headline || '',
              canApply: hasEmail, // Only can apply if we have email
              // Add company website if available
              companyWebsite: job.companyWebsite || '',
              companyLinkedinUrl: job.companyLinkedinUrl || ''
            };
          }
        }
        
        return {
          ...mappedJob,
          jobPosterName: job.jobPosterName || '',
          jobPosterLinkedinUrl: job.jobPosterUrl || '',
          canApply: false,
          companyWebsite: job.companyWebsite || '',
          companyLinkedinUrl: job.companyLinkedinUrl || ''
        };
      } catch (error) {
        console.error(`Error enriching job ${job.jobTitle}:`, error);
        return {
          ...job,
          title: job.jobTitle || job.title || 'Position Not Specified',
          companyName: job.companyName || job.company || 'Company Not Specified',
          link: job.applyUrl || job.url || job.link || '',
          canApply: false
        };
      }
    })
  );
  
  return enrichedJobs;
}

// Scrape company profile for additional context
async function scrapeCompanyProfile(companyUrl: string): Promise<any> {
  if (!process.env.APIFY_API_KEY) {
    return null;
  }
  
  try {
    const apifyClient = new ApifyClient({
      token: process.env.APIFY_API_KEY,
    });
    
    // Use dev_fusion Company Scraper
    const run = await apifyClient.actor('dev_fusion/linkedin-company-scraper').call({
      companyUrls: [companyUrl],
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    });
    
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (items && items.length > 0) {
      const company = items[0];
      return {
        name: company.name,
        website: company.websiteUrl,
        industry: company.industry,
        size: company.companySize,
        description: company.description,
        specialties: company.specialties,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Company scraping error:', error);
    return null;
  }
}

// Scrape LinkedIn profile to find contact information
async function scrapeLinkedInProfile(job: any): Promise<any> {
  if (!process.env.APIFY_API_KEY) {
    console.error('APIFY_API_KEY not configured for profile scraping');
    return null;
  }
  
  // Check if we have a LinkedIn profile URL for the job poster
  if (!job.jobPosterUrl || !job.jobPosterUrl.includes('linkedin.com/in/')) {
    console.log('No LinkedIn profile URL available for job:', job.jobTitle);
    return null;
  }
  
  console.log('✅ Found job poster URL for:', job.jobTitle, '→', job.jobPosterUrl);
  
  try {
    const apifyClient = new ApifyClient({
      token: process.env.APIFY_API_KEY,
    });
    
    // Use dev_fusion/Linkedin-Profile-Scraper to scrape LinkedIn profiles
    console.log('Scraping LinkedIn profile:', job.jobPosterUrl);
    const run = await apifyClient.actor('dev_fusion/Linkedin-Profile-Scraper').call({
      profileUrls: [job.jobPosterUrl]
    });
    
    // Get the results
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (items && items.length > 0) {
      const profile = items[0];
      console.log('Profile scraped successfully:', profile.name || profile.fullName);
      
      // Always extract profile information when available
      const profileData = {
        name: profile.name || profile.fullName || job.jobPosterName || 'Hiring Manager',
        email: (profile as any).email || (profile as any).contactInfo?.email || null,
        profileUrl: job.jobPosterUrl,
        headline: profile.headline || `Hiring for ${job.jobTitle}`,
        company: profile.company || job.companyName,
        phone: (profile as any).phone || (profile as any).contactInfo?.phone || null,
        profilePicture: profile.profilePicture || profile.avatar || profile.imageUrl || profile.photoUrl || profile.picture || null,
      };
      
      console.log('Profile scraped:', profileData.name, profileData.email ? '(with email)' : '(no email)', profileData.profilePicture ? '(with photo)' : '(no photo)');
      return profileData;
    }
    
    return null;
  } catch (error) {
    console.error('Profile scraping error:', error);
    return null;
  }
}

// Helper function to ensure Gmail credentials are valid and refresh if needed
async function ensureValidGmailCredentials(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  isValid: boolean;
  needsReauth: boolean;
}> {
  try {
    // Get Gmail credentials from database
    const [creds] = await db
      .select()
      .from(gmailCredentials)
      .where(eq(gmailCredentials.userId, userId))
      .limit(1);

    if (!creds || !creds.isActive) {
      console.log(`Gmail not connected for user ${userId}`);
      return { 
        accessToken: '', 
        refreshToken: '', 
        isValid: false, 
        needsReauth: true 
      };
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(creds.expiresAt);
    const isExpired = expiresAt <= now;

    if (!isExpired) {
      // Token is still valid
      console.log(`Gmail token still valid for user ${userId}, expires at ${expiresAt}`);
      return {
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken || '',
        isValid: true,
        needsReauth: false
      };
    }

    // Token is expired, try to refresh
    console.log(`Gmail token expired for user ${userId}, attempting refresh...`);
    
    if (!creds.refreshToken) {
      console.error(`No refresh token available for user ${userId}`);
      return {
        accessToken: '',
        refreshToken: '',
        isValid: false,
        needsReauth: true
      };
    }

    const newAccessToken = await refreshGmailToken(creds.refreshToken);
    
    if (!newAccessToken) {
      console.error(`Failed to refresh Gmail token for user ${userId}`);
      // Mark credentials as inactive if refresh fails
      await db
        .update(gmailCredentials)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(gmailCredentials.userId, userId));
      
      return {
        accessToken: '',
        refreshToken: '',
        isValid: false,
        needsReauth: true
      };
    }

    // Update database with new access token
    const newExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    await db
      .update(gmailCredentials)
      .set({
        accessToken: newAccessToken,
        expiresAt: newExpiresAt,
        updatedAt: new Date()
      })
      .where(eq(gmailCredentials.userId, userId));

    console.log(`Gmail token refreshed successfully for user ${userId}`);
    
    return {
      accessToken: newAccessToken,
      refreshToken: creds.refreshToken,
      isValid: true,
      needsReauth: false
    };
  } catch (error) {
    console.error(`Error managing Gmail credentials for user ${userId}:`, error);
    return {
      accessToken: '',
      refreshToken: '',
      isValid: false,
      needsReauth: true
    };
  }
}

// Helper function to generate job application email using AI
async function generateJobApplicationEmail(job: any, resumeText: string): Promise<{ subject: string; body: string }> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const jobUrl = job.applyUrl || job.jobUrl || job.url || job.link || 'LinkedIn';
  
  const prompt = `You must generate a compelling cold email with a STRONG HOOK by following these proven templates that have successfully gotten people jobs at top companies:

== PROVEN EMAIL TEMPLATES (USE FOR INSPIRATION) ==

TEMPLATE 1 - Nick Singh's "Hail Mary" (Got him into Meta/Microsoft/NVIDIA):
Subject: Ex-Google & Microsoft Intern Interested in Working FT at Periscope Data

"Hi [Name],

Found your email on Hacker news. I'm a former Software Engineering intern @ Google's Nest Labs and Microsoft who will be graduating from college May'17. I'm interested in working full time at Periscope Data because of my interest in data engineering (spent the summer on the Data Infrastructure team @ Nest) and my interest in turning data into insights (built dashboards to do just that the past two summers). How can I start the interview process?

Best, Nick Singh"

TEMPLATE 2 - Soham Parekh's Happenstance Email (Got him the job):
"Hi,

Really loved what you were building at Happenstance and wanted to reach out to see if there were any openings for Engineers in the early team. I have 5 years of relevant experience building full-stack applications primarily data-driven at DynamoAI (https://dynamo.ai), Antimetal (https://antimetal.com) Union.ai (https://union.ai), Synthesia (https://synthesia.io) and Alan (https://alan.app) as a part of their early teams. I helped create internal micro-services to thousands of workflows and users.

Being a part of super lean teams, one of my strongest suites has been ability to work across the stack from building scalable, robust backend systems to high throughput data ingestion pipelines to production grade frontend components in React. As a part, I have build several end-to-end systems that involve several layers at the intersection of UI (Next.js), Backend (Python, Node + Go based services using GraphQL and GRPC) as well as infrastructure pieces (AWS + GCP over k8s) from building complex workflows, DAG visualizations and drag and drop component canvas for Union cloud to architecting the entire platform for Alan Studio and Synthesia.

I would love to be a part of the early team at Happenstance and define its work and culture. Looking forward to hearing from you soon!

Best, Soham"

TEMPLATE 3 - Reddit/Hacker News Viral Template:
"Hello [Name],

I saw your post on Hacker News and wanted to reach out regarding why I'm a good fit to be a Software Engineering Intern at Reddit for Summer 2016. I interned at Microsoft this past summer on the Payments Team where I helped the team turn data into insight to diagnose payment issues faster.

In my free time (when I'm not on Reddit) I built RapStock.io which grew to 2000 users. 1400 out of the 2000 users came from Reddit when we went viral so I have a soft spot for the community and product.

Let me know what next steps I should take.

Thanks, Nick Singh"

== NOW GENERATE THE EMAIL ==

TARGET JOB:
Position: ${job.jobTitle}
Company: ${job.companyName}
Description: ${job.description || 'Not provided'}
Job URL: ${jobUrl}

CANDIDATE'S RESUME:
${resumeText}

CRITICAL INSTRUCTIONS:
1. START WITH A CREATIVE HOOK - Something specific about the company/role that shows genuine interest
2. Use the templates for INSPIRATION but make it unique and compelling
3. Include 3-4 SPECIFIC achievements with REAL numbers from the resume
4. Show how your experience DIRECTLY RELATES to their needs
5. Be CONVERSATIONAL but SUBSTANTIVE - imagine you're genuinely excited about this opportunity
6. Include personal projects or unique experiences that make you memorable
7. End with a clear call to action
8. ADD THE JOB LINK at the end: "P.S. - I'm specifically interested in this role: ${jobUrl}"
9. Aim for 250-350 words - enough to be compelling but not overwhelming

OUTPUT FORMAT:
Hi ${job.companyName} Team,

[Your generated email with strong hook and compelling content]

Best,
[Candidate Name]

P.S. - I'm specifically interested in this role: ${jobUrl}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an expert cold email writer who has studied successful job application emails. These templates got people hired at Google, Microsoft, Meta, and other top companies. Your emails must have CREATIVE HOOKS that immediately grab attention, be SUBSTANTIVE (250-350 words with rich details), SPECIFIC (with real numbers and achievements), and CONVERSATIONAL (genuine excitement, not formal). Start with something unique about the company or role that shows you've done your research. Never use generic phrases like "Dear Hiring Manager" or "I am writing to apply". Always include the job link as a P.S. at the end. Make the recruiter WANT to respond.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  let emailContent = completion.choices[0]?.message?.content || '';

  // ALWAYS append the P.S. with job link at the end if not already present
  if (!emailContent.includes('P.S.') && !emailContent.toLowerCase().includes('specifically interested in this role')) {
    emailContent = emailContent.trim() + `\n\nP.S. - I'm specifically interested in this role: ${jobUrl}`;
  }

  // Generate a compelling subject line based on the email content
  let subject = `Application for ${job.jobTitle} position at ${job.companyName}`;
  
  // Try to extract key credentials from the email to create a better subject
  if (emailContent.includes('years')) {
    const yearsMatch = emailContent.match(/(\d+)\s+years/);
    if (yearsMatch) {
      subject = `${yearsMatch[1]}+ Years Experience - ${job.jobTitle} at ${job.companyName}`;
    }
  } else if (emailContent.toLowerCase().includes('former')) {
    const formerMatch = emailContent.match(/former\s+([^,\.]+)/i);
    if (formerMatch) {
      subject = `Ex-${formerMatch[1].trim()} Interested in ${job.jobTitle} at ${job.companyName}`;
    }
  } else if (emailContent.toLowerCase().includes('built') || emailContent.toLowerCase().includes('created')) {
    subject = `Experienced ${job.jobTitle} - Ready to Build at ${job.companyName}`;
  }
  
  // Keep subjects concise and impactful
  if (subject.length > 80) {
    subject = `${job.jobTitle} Application - ${job.companyName}`;
  }

  return {
    subject,
    body: emailContent
  };
}

// Helper function to send job application email via Gmail
async function sendJobApplicationEmail(user: any, job: any, emailContent: { subject: string; body: string }, requestId: string): Promise<boolean> {
  try {
    // Ensure Gmail credentials are valid and refresh if needed
    const credentials = await ensureValidGmailCredentials(user.id);
    
    if (!credentials.isValid) {
      console.log(`Gmail credentials invalid or expired for user ${user.id} - skipping email`);
      if (credentials.needsReauth) {
        console.log(`User ${user.id} needs to re-authorize Gmail`);
      }
      return false;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get resume for attachment
    const userResume = await storage.getUserResume(user.id);
    const contactEmail = job.contactEmail || job.jobPosterEmail;

    // Create email with attachment if resume exists
    let emailMessage: string;
    
    if (userResume?.resumeFileData && userResume?.resumeFileName) {
      // Create multipart MIME message with attachment
      const boundary = `====boundary${Date.now()}====`;
      const htmlBody = emailContent.body.replace(/\n/g, '<br>');
      
      const messageParts = [];
      messageParts.push(`To: ${contactEmail}`);
      messageParts.push(`Subject: ${emailContent.subject}`);
      messageParts.push('MIME-Version: 1.0');
      messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      messageParts.push('');
      messageParts.push(`--${boundary}`);
      messageParts.push('Content-Type: text/html; charset=utf-8');
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push('');
      messageParts.push(Buffer.from(htmlBody).toString('base64'));
      messageParts.push('');
      messageParts.push(`--${boundary}`);
      messageParts.push(`Content-Type: ${userResume.resumeFileMimeType || 'application/octet-stream'}; name="${userResume.resumeFileName}"`);
      messageParts.push(`Content-Disposition: attachment; filename="${userResume.resumeFileName}"`);
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push('');
      messageParts.push(userResume.resumeFileData);
      messageParts.push('');
      messageParts.push(`--${boundary}--`);
      
      emailMessage = messageParts.join('\r\n');
    } else {
      // Simple email without attachment
      emailMessage = [
        `To: ${contactEmail}`,
        `Subject: ${emailContent.subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        emailContent.body.replace(/\n/g, '<br>')
      ].join('\r\n');
    }

    // Send the email
    const encodedMessage = Buffer.from(emailMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const sendResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    // Log the application
    await db.insert(emailApplications).values({
      userId: user.id,
      companyEmail: contactEmail,
      emailSubject: emailContent.subject,
      emailBody: emailContent.body,
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      jobUrl: job.link || '',
      companyWebsite: job.companyWebsite || '',
      gmailMessageId: sendResult.data.id || '',
    });

    console.log(`Automated email sent: ${emailContent.subject} to ${contactEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send automated email:', error);
    return false;
  }
}

async function processJobScrapingAsync(requestId: string, linkedinUrl: string) {
  try {
    console.log(`Starting background job scraping for request ${requestId}`);
    
    // Update status to processing
    await db
      .update(jobScrapingRequests)
      .set({ status: 'processing' })
      .where(eq(jobScrapingRequests.id, requestId));

    // Scrape jobs using Apify
    const scrapedJobs = await scrapeLinkedInJobs({
      linkedinUrl,
      maxResults: 50
    });

    console.log(`Scraped ${scrapedJobs.length} jobs for request ${requestId}`);

    // Filter for quality leads (jobs with company info)
    const qualityJobs = filterJobs(scrapedJobs);
    console.log(`Filtered to ${qualityJobs.length} quality leads`);

    // Enrich jobs with LinkedIn profiles to find contact emails
    const enrichedJobs = await enrichJobsWithProfiles(qualityJobs);
    console.log(`Enriched ${enrichedJobs.filter(j => j.contactEmail).length} jobs with contact emails`);

    // COMPLETE AUTOMATION: Generate and send emails for jobs with contacts
    const jobsWithContacts = enrichedJobs.filter(job => job.contactEmail || job.jobPosterEmail);
    let emailsSent = 0;
    
    if (jobsWithContacts.length > 0) {
      console.log(`Starting automated email generation and sending for ${jobsWithContacts.length} jobs`);
      
      // Get job request first to get the correct user ID
      const [jobRequest] = await db
        .select()
        .from(jobScrapingRequests)
        .where(eq(jobScrapingRequests.id, requestId))
        .limit(1);

      if (!jobRequest) {
        console.error(`Job request ${requestId} not found - cannot send emails`);
        return;
      }

      // Get user data using the correct user ID from job request
      if (!jobRequest.userId) {
        console.error(`Job request ${requestId} has no user ID - cannot send emails`);
        return;
      }
      
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, jobRequest.userId))
        .limit(1);

      if (!user) {
        console.error(`User ${jobRequest.userId} not found - cannot send emails`);
        return;
      }

      const resumeText = jobRequest.resumeText || 'Experienced professional seeking new opportunities';

      for (const job of jobsWithContacts.slice(0, 3)) { // Limit to first 3 to control costs
        try {
          // Defensive check for contact email
          const contactEmail = job.contactEmail || job.jobPosterEmail;
          if (!contactEmail) {
            console.log(`Skipping ${job.jobTitle} at ${job.companyName} - no contact email found`);
            continue;
          }

          console.log(`Generating automated email for ${job.jobTitle} at ${job.companyName} (contact: ${contactEmail})`);
          
          // Generate email using AI
          const emailContent = await generateJobApplicationEmail(job, resumeText);
          
          // Send email automatically
          const emailSent = await sendJobApplicationEmail(user, job, emailContent, requestId);
          
          if (emailSent) {
            emailsSent++;
            console.log(`✅ Automated email sent for ${job.jobTitle} at ${job.companyName} to ${contactEmail}`);
          }
        } catch (error) {
          console.error(`❌ Failed to send automated email for ${job.jobTitle} at ${job.companyName}:`, error);
        }
      }
    }

    // Mark jobs with contacts as canApply: true for Free plan
    const jobsWithCanApplyStatus = enrichedJobs.map(job => ({
      ...job,
      canApply: !!(job.contactEmail || job.jobPosterEmail)
    }));
    
    // Calculate free/pro plan counts
    const freeJobsCount = jobsWithCanApplyStatus.filter(job => job.canApply).length;
    const proJobsCount = jobsWithCanApplyStatus.filter(job => !job.canApply).length;

    // Update with results - save to separate columns for proper workflow tracking
    await db
      .update(jobScrapingRequests)
      .set({
        status: 'completed',
        results: scrapedJobs, // Original scraped jobs
        filteredResults: jobsWithCanApplyStatus, // Jobs with proper canApply status
        enrichedResults: enrichedJobs, // Raw enriched jobs with contact emails
        totalJobsFound: scrapedJobs.length,
        freeJobsShown: freeJobsCount, // Jobs with contacts (Free plan)
        proJobsShown: proJobsCount, // Jobs without contacts (Pro plan)
        completedAt: new Date()
      })
      .where(eq(jobScrapingRequests.id, requestId));

    console.log(`COMPLETE AUTOMATION FINISHED for request ${requestId}: Scraped ${scrapedJobs.length} jobs, filtered to ${qualityJobs.length}, enriched ${jobsWithContacts.length} with contacts, sent ${emailsSent} emails automatically`);
  } catch (error) {
    console.error(`Job scraping failed for request ${requestId}:`, error);
    
    // Update with error
    await db
      .update(jobScrapingRequests)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date()
      })
      .where(eq(jobScrapingRequests.id, requestId));
  }
}

// Simple auth middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1);
  
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  req.user = user as Express.User;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Register Dodo Payments routes
  registerDodoPaymentRoutes(app);

  // CORS configuration for production
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.REPLIT_DOMAINS ? 
      process.env.REPLIT_DOMAINS.split(',').map(d => `https://${d}`) : 
      ['http://localhost:5000', 'http://localhost:3000'];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });

  // === AUTHENTICATION ROUTES ===
  
  // OAuth Debug Endpoint - Remove this after testing
  app.get('/api/debug/oauth-config', (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const hasSecret = !!process.env.GOOGLE_CLIENT_SECRET;
    const secretLength = process.env.GOOGLE_CLIENT_SECRET?.length || 0;
    
    res.json({
      configured: !!clientId && hasSecret,
      clientId: clientId || 'NOT_SET',
      clientIdLength: clientId?.length || 0,
      hasClientSecret: hasSecret,
      clientSecretLength: secretLength,
      // Show first 4 and last 4 chars of secret for verification (safe to show partial)
      secretPreview: hasSecret && secretLength > 8 
        ? `${process.env.GOOGLE_CLIENT_SECRET?.substring(0, 4)}...${process.env.GOOGLE_CLIENT_SECRET?.substring(secretLength - 4)}`
        : 'TOO_SHORT_OR_MISSING',
      redirectUri: `https://${req.get('host')}/api/auth/google/callback`,
      host: req.get('host'),
      expectedFormat: 'Client secret should be around 32-35 characters, starting with GOCSPX- for newer clients'
    });
  });
  
  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    console.log('Auth check - Session ID:', req.sessionID);
    console.log('Auth check - User ID:', req.session.userId);
    
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);
      
      if (!user) {
        console.log('No user found for ID:', req.session.userId);
        req.session.destroy(() => {});
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      console.log('User found:', user.email);
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Google OAuth login
  app.get('/api/auth/google', (req, res, next) => {
    // Override the callback URL based on the current request
    const host = req.get('host') || '';
    let callbackURL: string;
    
    if (host.includes('ai-jobhunter.com')) {
      callbackURL = 'https://ai-jobhunter.com/api/auth/google/callback';
    } else if (host.includes('replit.dev')) {
      callbackURL = `https://${host}/api/auth/google/callback`;
    } else if (host.includes('localhost')) {
      callbackURL = `http://${host}/api/auth/google/callback`;
    } else {
      callbackURL = `${req.protocol}://${host}/api/auth/google/callback`;
    }
    
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      state: Buffer.from(JSON.stringify({ callbackURL })).toString('base64')
    } as any)(req, res, next);
  });

  // TEMPORARY: Development bypass for testing
  app.get('/api/auth/dev-login', async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).send('Not found');
    }
    
    // Create or get test user
    const testEmail = 'test@example.com';
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);
    
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          id: 'dev-user-123',
          email: testEmail,
          firstName: 'Test',
          lastName: 'User',
        })
        .returning();
    }
    
    req.session.userId = user.id;
    await new Promise<void>((resolve) => {
      req.session.save(() => resolve());
    });
    
    res.redirect('/');
  });

  // Google OAuth callback
  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req, res) => {
      try {
        // Successful authentication
        const user = req.user as any;
        if (!user || !user.id) {
          console.error('No user or user ID after authentication');
          return res.redirect('/?error=no_user');
        }
        
        req.session.userId = user.id;
        console.log('Setting session userId:', user.id);
        
        // Force session save and wait for it
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
              reject(err);
            } else {
              console.log('Session saved successfully');
              resolve();
            }
          });
        });
        
        // Add a small delay to ensure session is propagated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Redirect to frontend
        res.redirect('/');
      } catch (error) {
        console.error('Auth callback error:', error);
        res.redirect('/?error=session_error');
      }
    }
  );

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout' });
      }
      req.session.destroy((err: any) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to destroy session' });
        }
        res.json({ success: true });
      });
    });
  });

  // === GMAIL ROUTES ===
  // Register Gmail auth routes
  registerGmailAuthRoutes(app);

  // === DASHBOARD ROUTES ===
  
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    // Get total counts
    const [scrapingCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(jobScrapingRequests)
      .where(eq(jobScrapingRequests.userId, req.user!.id));

    const [applicationCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(emailApplications)
      .where(eq(emailApplications.userId, req.user!.id));

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentScrapingCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(jobScrapingRequests)
      .where(
        and(
          eq(jobScrapingRequests.userId, req.user!.id),
          gte(jobScrapingRequests.createdAt, sevenDaysAgo)
        )
      );

    // Get recent searches for history display
    const recentSearches = await db
      .select()
      .from(jobScrapingRequests)
      .where(eq(jobScrapingRequests.userId, req.user!.id))
      .orderBy(desc(jobScrapingRequests.createdAt))
      .limit(10);

    // Format recent searches with proper enrichedResults structure
    const formattedSearches = recentSearches.map(search => {
      // Calculate fake total for display consistency
      let fakeTotalJobs = 1315;
      if (search.id) {
        let hash = 0;
        for (let i = 0; i < search.id.length; i++) {
          hash = ((hash << 5) - hash) + search.id.charCodeAt(i);
          hash = hash & hash;
        }
        fakeTotalJobs = 500 + Math.abs(hash % 1501);
      }
      
      // Handle snake_case fields from database
      const freeJobs = (search as any).freeJobsShown || (search as any).free_jobs_shown || 0;
      const lockedJobs = (search as any).proJobsShown || (search as any).pro_jobs_shown || 0;

      return {
        ...search,
        enrichedResults: {
          jobs: (search as any).filteredResults || (search as any).filtered_results || [],
          freeJobs: freeJobs,
          lockedJobs: lockedJobs,
          canApplyCount: freeJobs,
          fakeTotalJobs: fakeTotalJobs
        }
      };
    });

    res.json({
      totalJobsScraped: scrapingCount?.count || 0,
      totalApplicationsSent: applicationCount?.count || 0,
      activeJobSearches: recentScrapingCount?.count || 0,
      pendingApplications: 0,
      recentSearches: formattedSearches,
    });
  });

  // === JOB SCRAPING ROUTES ===
  
  // Scrape job endpoint
  app.post("/api/scrape-job", requireAuth, async (req, res) => {
    const { linkedinUrl, resumeText } = req.body;
    
    if (!linkedinUrl) {
      return res.status(400).json({ error: 'LinkedIn URL is required' });
    }

    // If resumeText is provided, also save it to user's profile for persistence
    if (resumeText && req.user?.id) {
      try {
        // Extract file name from resume text if it contains metadata
        let fileName = 'Resume';
        const fileMatch = resumeText.match(/\[Resume file: (.+?)\]/);
        if (fileMatch) {
          fileName = fileMatch[1];
        }
        
        // Save resume to user profile for permanent storage
        await db
          .update(users)
          .set({
            resumeText: resumeText,
            resumeFileName: fileName,
            resumeUploadedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(users.id, req.user.id));
          
        console.log(`[SCRAPE-JOB] Resume saved to user profile for user ${req.user.id}`);
      } catch (error) {
        console.error('[SCRAPE-JOB] Error saving resume to user profile:', error);
        // Don't fail the request if resume save fails, just log it
      }
    }

    // Create job scraping request
    const [request] = await db
      .insert(jobScrapingRequests)
      .values({
        userId: req.user!.id,
        linkedinUrl,
        resumeText,
        status: 'pending',
      })
      .returning();

    // Process job scraping in background
    processJobScrapingAsync(request.id, linkedinUrl);
    
    res.json({ requestId: request.id });
  });

  // Get scraping status
  app.get("/api/scrape-job/:requestId", requireAuth, async (req, res) => {
    const { requestId } = req.params;
    
    const [request] = await db
      .select()
      .from(jobScrapingRequests)
      .where(
        and(
          eq(jobScrapingRequests.id, requestId),
          eq(jobScrapingRequests.userId, req.user!.id)
        )
      )
      .limit(1);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Disable caching to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Calculate fake total for display consistency
    let fakeTotalJobs = 1315; // Default for consistency with UI
    if (request.id) {
      // Generate consistent number based on request ID
      let hash = 0;
      for (let i = 0; i < request.id.length; i++) {
        hash = ((hash << 5) - hash) + request.id.charCodeAt(i);
        hash = hash & hash;
      }
      fakeTotalJobs = 500 + Math.abs(hash % 1501); // 500-2000
    }

    res.json({
      id: request.id,
      status: request.status,
      resumeText: request.resumeText, // Include resume text from job search request
      results: request.results, // Original scraped jobs
      filteredResults: (request as any).filteredResults || (request as any).filtered_results, // Quality filtered jobs with canApply status
      enrichedJobs: (request as any).filteredResults || (request as any).filtered_results, // Jobs array with canApply status
      enrichedResults: {
        // Frontend expects an object with these fields!
        jobs: (request as any).filteredResults || (request as any).filtered_results || [],
        freeJobs: (request as any).freeJobsShown || (request as any).free_jobs_shown || 0,
        lockedJobs: (request as any).proJobsShown || (request as any).pro_jobs_shown || 0,
        canApplyCount: (request as any).freeJobsShown || (request as any).free_jobs_shown || 0,
        fakeTotalJobs: fakeTotalJobs
      },
      totalJobsFound: (request as any).totalJobsFound || (request as any).total_jobs_found,
      freeJobsShown: (request as any).freeJobsShown || (request as any).free_jobs_shown || 0, // Jobs with contacts (Free plan)
      proJobsShown: (request as any).proJobsShown || (request as any).pro_jobs_shown || 0, // Jobs without contacts (Pro plan)
      error: request.errorMessage,
    });
  });

  // Company scraping endpoint
  app.post("/api/scrape-company", requireAuth, async (req, res) => {
    const { companyLinkedinUrl } = req.body;
    
    if (!companyLinkedinUrl) {
      return res.status(400).json({ error: 'Company LinkedIn URL is required' });
    }

    try {
      const companyData = await scrapeCompanyProfile(companyLinkedinUrl);
      
      if (!companyData) {
        return res.json({ 
          success: false, 
          message: 'Could not scrape company profile' 
        });
      }

      res.json({ 
        success: true, 
        company: companyData 
      });
    } catch (error) {
      console.error('Company scraping error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to scrape company profile' 
      });
    }
  });

  // Email generation endpoint
  app.post("/api/generate-email", requireAuth, async (req, res) => {
    console.log('Email generation request body:', JSON.stringify(req.body, null, 2));
    const { jobTitle, companyName, jobDescription, resumeText, jobUrl, applyUrl } = req.body;
    
    console.log('Extracted fields:', { 
      jobTitle: !!jobTitle, 
      companyName: !!companyName, 
      jobDescription: !!jobDescription, 
      resumeText: !!resumeText,
      jobUrl: !!jobUrl,
      applyUrl: !!applyUrl
    });
    
    if (!jobTitle || !companyName) {
      console.log('Validation failed - missing fields:', { 
        jobTitle: !jobTitle ? 'MISSING' : 'OK', 
        companyName: !companyName ? 'MISSING' : 'OK'
      });
      return res.status(400).json({ error: 'Missing required fields: job title and company name are required' });
    }
    
    // If no resume text or it's a placeholder, provide a helpful message
    if (!resumeText || resumeText.startsWith('[Resume file:')) {
      return res.status(400).json({ 
        error: 'Resume text could not be extracted', 
        message: 'Unable to generate email without resume content. Please upload a text-based PDF, DOCX, or TXT file in Settings.',
        suggestion: 'Go to Settings and re-upload your resume in a supported format'
      });
    }

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI not configured' });
    }

    try {
      const prompt = `You must generate a cold email by EXACTLY following one of these proven templates that have successfully gotten people jobs at top companies:

== PROVEN EMAIL TEMPLATES (MUST FOLLOW ONE OF THESE) ==

TEMPLATE 1 - Nick Singh's "Hail Mary" (Got him into Meta/Microsoft/NVIDIA):
Subject: Ex-Google & Microsoft Intern Interested in Working FT at Periscope Data

"Hi [Name],

Found your email on Hacker news. I'm a former Software Engineering intern @ Google's Nest Labs and Microsoft who will be graduating from college May'17. I'm interested in working full time at Periscope Data because of my interest in data engineering (spent the summer on the Data Infrastructure team @ Nest) and my interest in turning data into insights (built dashboards to do just that the past two summers). How can I start the interview process?

Best, Nick Singh"

TEMPLATE 2 - Soham Parekh's Happenstance Email (Got him the job):
"Hi,

Really loved what you were building at Happenstance and wanted to reach out to see if there were any openings for Engineers in the early team. I have 5 years of relevant experience building full-stack applications primarily data-driven at DynamoAI (https://dynamo.ai), Antimetal (https://antimetal.com) Union.ai (https://union.ai), Synthesia (https://synthesia.io) and Alan (https://alan.app) as a part of their early teams. I helped create internal micro-services to thousands of workflows and users.

Being a part of super lean teams, one of my strongest suites has been ability to work across the stack from building scalable, robust backend systems to high throughput data ingestion pipelines to production grade frontend components in React. As a part, I have build several end-to-end systems that involve several layers at the intersection of UI (Next.js), Backend (Python, Node + Go based services using GraphQL and GRPC) as well as infrastructure pieces (AWS + GCP over k8s) from building complex workflows, DAG visualizations and drag and drop component canvas for Union cloud to architecting the entire platform for Alan Studio and Synthesia.

I would love to be a part of the early team at Happenstance and define its work and culture. Looking forward to hearing from you soon!

Best, Soham"

TEMPLATE 3 - Reddit/Hacker News Viral Template:
"Hello [Name],

I saw your post on Hacker News and wanted to reach out regarding why I'm a good fit to be a Software Engineering Intern at Reddit for Summer 2016. I interned at Microsoft this past summer on the Payments Team where I helped the team turn data into insight to diagnose payment issues faster.

In my free time (when I'm not on Reddit) I built RapStock.io which grew to 2000 users. 1400 out of the 2000 users came from Reddit when we went viral so I have a soft spot for the community and product.

Let me know what next steps I should take.

Thanks, Nick Singh"

== NOW GENERATE THE EMAIL ==

TARGET JOB:
Position: ${jobTitle}
Company: ${companyName}
Description: ${jobDescription || 'Not provided'}

CANDIDATE'S RESUME:
${resumeText}

CRITICAL INSTRUCTIONS:
1. Choose the template that best matches the candidate's experience level
2. Follow the EXACT structure of your chosen template
3. Replace template details with SPECIFIC information from THIS resume and THIS job
4. Start with either "I found your ${jobTitle} opening on LinkedIn" OR "Really loved what ${companyName} is building"
5. Include 2-3 SPECIFIC achievements with REAL numbers from the resume
6. End with one of these: "How can I start the interview process?" OR "When would be a good time to connect?" OR "Let me know what next steps I should take"
7. Keep it UNDER 200 words (Nick Singh's was 72 words!)
8. Write conversationally - imagine texting a friend about an exciting opportunity

OUTPUT FORMAT:
Hi ${companyName} Team,

[Your generated email following the template structure]

Best,
[Candidate Name]`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert cold email writer who has studied successful job application emails. You MUST follow the exact structure of the proven templates provided - these are real emails that got people hired at Google, Microsoft, Meta, and other top companies. Your emails must be SHORT (under 200 words), SPECIFIC (with real numbers and achievements), and CONVERSATIONAL (like texting a friend). Never use generic phrases or formal language. Always follow the template structure exactly.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      let emailContent = completion.choices[0]?.message?.content || '';
      
      // ALWAYS append the P.S. with job link at the end
      const actualJobUrl = jobUrl || applyUrl || 'the LinkedIn job posting';
      if (!emailContent.includes('P.S.') && !emailContent.toLowerCase().includes('specifically interested in this role')) {
        emailContent = emailContent.trim() + `\n\nP.S. - I'm specifically interested in this role: ${actualJobUrl}`;
      }
      
      // Generate a compelling subject line based on the email content
      let subject = `Application for ${jobTitle} position at ${companyName}`;
      
      // Try to extract key credentials from the email to create a better subject
      if (emailContent.includes('years')) {
        const yearsMatch = emailContent.match(/(\d+)\s+years/);
        if (yearsMatch) {
          subject = `${yearsMatch[1]}+ Years Experience - ${jobTitle} at ${companyName}`;
        }
      } else if (emailContent.toLowerCase().includes('former')) {
        const formerMatch = emailContent.match(/former\s+([^,\.]+)/i);
        if (formerMatch) {
          subject = `Ex-${formerMatch[1].trim()} Interested in ${jobTitle} at ${companyName}`;
        }
      } else if (emailContent.toLowerCase().includes('built') || emailContent.toLowerCase().includes('created')) {
        subject = `Experienced ${jobTitle} - Ready to Build at ${companyName}`;
      }
      
      // Keep subjects concise and impactful
      if (subject.length > 80) {
        subject = `${jobTitle} Application - ${companyName}`;
      }

      res.json({
        email: emailContent,
        subject,
      });
    } catch (error) {
      console.error('Email generation error:', error);
      res.status(500).json({ error: 'Failed to generate email' });
    }
  });
  
  // Generate LinkedIn URL from search parameters
  app.post("/api/generate-linkedin-url", requireAuth, async (req, res) => {
    const { keyword, location, workType } = req.body;
    
    if (!keyword || !location) {
      return res.status(400).json({ error: 'Missing required parameters: keyword and location' });
    }

    try {
      const linkedinUrl = await generateLinkedInSearchUrl(
        keyword,
        location,
        workType || 'remote'
      );
      
      res.json({ 
        linkedinUrl,
        message: `Generated LinkedIn search URL for ${keyword} in ${location}`
      });
    } catch (error) {
      console.error('Error generating LinkedIn URL:', error);
      res.status(500).json({ error: 'Failed to generate LinkedIn URL' });
    }
  });
  
  app.post("/api/job-scraping/submit", requireAuth, async (req, res) => {
    const { search, location } = req.body;
    
    const [request] = await db
      .insert(jobScrapingRequests)
      .values({
        userId: req.user!.id,
        linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(search)}&location=${encodeURIComponent(location)}`,
        status: 'pending',
        results: [],
      })
      .returning();

    res.json({
      requestId: request.id,
      status: 'pending',
      message: 'Job scraping request submitted',
    });
  });




  app.post("/api/send-email", requireAuth, async (req, res) => {
    const { to, subject, body, jobTitle, companyName } = req.body;
    
    try {
      // Get user's resume data if available
      const userResume = await storage.getUserResume(req.user!.id);
      
      console.log('Email send - Resume data:', {
        userId: req.user!.id,
        hasResume: !!userResume,
        hasFileData: !!userResume?.resumeFileData,
        fileName: userResume?.resumeFileName,
        fileDataLength: userResume?.resumeFileData?.length,
        mimeType: userResume?.resumeFileMimeType,
        fileDataSample: userResume?.resumeFileData?.substring(0, 50) // First 50 chars of base64
      });
      
      // Ensure Gmail credentials are valid and refresh if needed
      const credentials = await ensureValidGmailCredentials(req.user!.id);
      
      if (!credentials.isValid) {
        console.log(`Gmail credentials invalid or expired for user ${req.user!.id}`);
        return res.json({ 
          success: false,
          needsGmailAuth: true,
          error: 'Gmail authorization expired or invalid. Please re-authorize Gmail.' 
        });
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Create email with attachment if resume exists
      let emailMessage: string;
      
      if (userResume?.resumeFileData && userResume?.resumeFileName) {
        console.log('Creating email with attachment:', {
          fileName: userResume.resumeFileName,
          mimeType: userResume.resumeFileMimeType,
          dataLength: userResume.resumeFileData.length
        });
        
        // Create multipart MIME message with attachment
        const boundary = `====boundary${Date.now()}====`;
        const htmlBody = body.replace(/\n/g, '<br>');
        
        // Build the MIME message parts
        const messageParts = [];
        
        // Headers
        messageParts.push(`To: ${to}`);
        messageParts.push(`Subject: ${subject}`);
        messageParts.push('MIME-Version: 1.0');
        messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        messageParts.push('');
        
        // Email body part
        messageParts.push(`--${boundary}`);
        messageParts.push('Content-Type: text/html; charset=utf-8');
        messageParts.push('Content-Transfer-Encoding: base64');
        messageParts.push('');
        messageParts.push(Buffer.from(htmlBody).toString('base64'));
        messageParts.push('');
        
        // Attachment part
        messageParts.push(`--${boundary}`);
        messageParts.push(`Content-Type: ${userResume.resumeFileMimeType || 'application/octet-stream'}; name="${userResume.resumeFileName}"`);
        messageParts.push('Content-Transfer-Encoding: base64');
        messageParts.push(`Content-Disposition: attachment; filename="${userResume.resumeFileName}"`);
        messageParts.push('');
        messageParts.push(userResume.resumeFileData);
        messageParts.push('');
        
        // End boundary
        messageParts.push(`--${boundary}--`);
        
        emailMessage = messageParts.join('\r\n');
      } else {
        // Simple email without attachment
        console.log('Creating email WITHOUT attachment - no resume data found');
        emailMessage = [
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          body.replace(/\n/g, '<br>'),
        ].join('\r\n');
      }

      const encodedMessage = Buffer.from(emailMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      console.log('Sending Gmail with attachment:', !!userResume?.resumeFileData);
      
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      // Record the email
      await db.insert(emailApplications).values({
        userId: req.user!.id,
        jobTitle: jobTitle || 'Unknown Position',
        companyName: companyName || 'Unknown Company',
        companyEmail: to,
        emailSubject: subject,
        emailBody: body,
      });

      res.json({ 
        success: true, 
        sentViaGmail: true,
        hasAttachment: !!userResume?.resumeFileData 
      });
    } catch (error) {
      console.error('Email send error:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // === RESUME ROUTES ===
  
  // Enhanced error handling middleware for file uploads
  const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      console.log(`[UPLOAD-ERROR] MulterError: ${error.message}, Code: ${error.code}`);
      
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(413).json({ 
            error: 'File too large', 
            details: 'Maximum file size is 25MB. Please compress your file or use a smaller image.',
            code: 'FILE_TOO_LARGE'
          });
        case 'LIMIT_FILE_COUNT' as any:
          return res.status(413).json({ 
            error: 'Too many files', 
            details: 'Maximum 5 files allowed per upload.',
            code: 'TOO_MANY_FILES'
          });
        case 'LIMIT_FIELD_COUNT':
          return res.status(413).json({ 
            error: 'Too many form fields', 
            details: 'Please reduce the number of form fields.',
            code: 'TOO_MANY_FIELDS'
          });
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({ 
            error: 'Unexpected file field', 
            details: 'The uploaded file field is not recognized.',
            code: 'UNEXPECTED_FIELD'
          });
        default:
          return res.status(400).json({ 
            error: 'File upload error', 
            details: error.message,
            code: 'UPLOAD_ERROR'
          });
      }
    } else if (error.message?.includes('Unsupported file type')) {
      return res.status(400).json({ 
        error: 'Invalid file type', 
        details: error.message,
        code: 'INVALID_FILE_TYPE'
      });
    } else if (error.message?.includes('Invalid file name')) {
      return res.status(400).json({ 
        error: 'Invalid file name', 
        details: 'File name contains invalid characters. Please rename your file.',
        code: 'INVALID_FILENAME'
      });
    }
    
    console.error('[UPLOAD-ERROR] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: 'An unexpected error occurred during file upload.',
      code: 'INTERNAL_ERROR'
    });
  };

  // Comprehensive resume upload endpoint supporting multiple file types
  app.post("/api/resume/upload", requireAuth, upload.single('resume'), async (req, res) => {
    console.log('[RESUME-UPLOAD] Endpoint reached!');
    console.log(`[RESUME-UPLOAD] User ID: ${req.user?.id}`);
    console.log(`[RESUME-UPLOAD] File received:`, req.file ? 'Yes' : 'No');
    if (req.file) {
      console.log(`[RESUME-UPLOAD] File details:`, {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    }
    try {
      let resumeText = '';
      let fileData: string | undefined;
      let fileName: string | undefined;
      let mimeType: string | undefined;
      
      const uploadedFile = req.file;
      if (uploadedFile) {
        // Handle file upload (PDF, TXT, DOCX, Images, etc.)
        fileName = uploadedFile.originalname;
        mimeType = uploadedFile.mimetype;
        fileData = uploadedFile.buffer.toString('base64');
        
        console.log(`Processing file: ${fileName}, type: ${mimeType}, size: ${uploadedFile.buffer.length} bytes`);
        
        if (uploadedFile.mimetype === 'application/pdf') {
          // Extract text from PDF using pdf-parse
          try {
            // Dynamic import for CommonJS module - pdf-parse exports a 'pdf' function
            const pdfParseModule = await import('pdf-parse');
            const pdfParse = pdfParseModule.pdf || pdfParseModule;
            const pdfData = await pdfParse(uploadedFile.buffer);
            resumeText = pdfData.text.trim();
            console.log(`Extracted ${resumeText.length} characters from PDF (${(pdfData as any).numpages || (pdfData as any).numPages || 'unknown'} pages)`);
            
            // Validate that we actually extracted meaningful text
            if (!resumeText || resumeText.length < 50) {
              console.error('PDF parsing failed: No meaningful text extracted');
              return res.status(422).json({ 
                error: 'PDF text extraction failed', 
                details: 'Unable to extract text from this PDF. Please ensure your PDF contains selectable text (not scanned images) or upload a DOCX/TXT file instead.',
                code: 'PDF_NO_TEXT'
              });
            }
          } catch (error) {
            console.error('PDF parsing error:', error);
            return res.status(422).json({ 
              error: 'PDF processing failed', 
              details: 'Unable to parse the PDF file. Please ensure the file is not corrupted or password-protected.',
              code: 'PDF_PARSE_ERROR'
            });
          }
        } else if (uploadedFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // Extract text from DOCX
          try {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer: uploadedFile.buffer });
            resumeText = result.value;
            console.log(`Extracted ${resumeText.length} characters from DOCX`);
            
            // Validate that we actually extracted meaningful text
            if (!resumeText || resumeText.length < 50) {
              console.error('DOCX parsing failed: No meaningful text extracted');
              return res.status(422).json({ 
                error: 'Document text extraction failed', 
                details: 'Unable to extract text from this document. Please ensure your document contains text content.',
                code: 'DOCX_NO_TEXT'
              });
            }
          } catch (error) {
            console.error('DOCX parsing error:', error);
            return res.status(422).json({ 
              error: 'Document processing failed', 
              details: 'Unable to parse the Word document. Please ensure the file is not corrupted.',
              code: 'DOCX_PARSE_ERROR'
            });
          }
        } else if (uploadedFile.mimetype.startsWith('text/')) {
          // For text files, use the content directly
          resumeText = uploadedFile.buffer.toString('utf-8');
          console.log(`Read ${resumeText.length} characters from text file`);
        } else if (uploadedFile.mimetype.startsWith('image/')) {
          // Extract text from images using OCR
          try {
            const Tesseract = await import('tesseract.js');
            const { data: { text } } = await Tesseract.default.recognize(uploadedFile.buffer, 'eng');
            resumeText = text.trim();
            console.log(`Extracted ${resumeText.length} characters from image via OCR`);
            
            // Validate that we actually extracted meaningful text
            if (!resumeText || resumeText.length < 50) {
              console.error('OCR failed: No meaningful text extracted from image');
              return res.status(422).json({ 
                error: 'Image text extraction failed', 
                details: 'Unable to extract text from this image. Please upload a PDF, DOCX, or TXT file instead.',
                code: 'OCR_NO_TEXT'
              });
            }
          } catch (error) {
            console.error('OCR parsing error:', error);
            return res.status(422).json({ 
              error: 'Image processing failed', 
              details: 'Unable to process the image for text extraction. Please upload a PDF, DOCX, or TXT file instead.',
              code: 'OCR_ERROR'
            });
          }
        }
      } else if (req.body.resumeText) {
        // Text upload (from textarea)
        resumeText = req.body.resumeText;
        fileName = 'resume.txt';
        mimeType = 'text/plain';
        fileData = Buffer.from(resumeText).toString('base64');
        console.log(`Received text upload: ${resumeText.length} characters`);
      }

      // Validate that we have file data
      if (!fileData) {
        return res.status(400).json({ error: 'No resume file provided' });
      }
      
      // Validate that we have meaningful resume text
      if (!resumeText || resumeText.trim().length < 50) {
        console.error('Resume text extraction failed or insufficient content:', {
          textLength: resumeText?.length || 0,
          fileName,
          mimeType
        });
        
        // DO NOT save the file if text extraction failed - return error instead
        return res.status(422).json({ 
          error: 'Text extraction failed', 
          details: 'Unable to extract sufficient text from your resume. Please upload a text-based PDF, DOCX, or TXT file.',
          code: 'TEXT_EXTRACTION_FAILED',
          minTextLength: 50,
          extractedLength: resumeText?.length || 0,
          supportedFormats: ['.txt', '.pdf', '.doc', '.docx']
        });
      }
      
      // Additional validation: Check for error message patterns that should never be saved
      if (resumeText.startsWith('[Resume file:') || resumeText.includes('Text extraction failed')) {
        console.error('Detected error message pattern in resume text - rejecting');
        return res.status(422).json({ 
          error: 'Invalid resume content', 
          details: 'The resume contains error message text. Please re-upload a valid resume file.',
          code: 'INVALID_RESUME_CONTENT'
        });
      }

      // Update user's resume with both text and file data
      await storage.updateUserResume(
        req.user!.id,
        resumeText || '',
        fileName || 'resume.txt',
        fileData,
        mimeType
      );

      console.log('Resume uploaded successfully:', { 
        userId: req.user!.id, 
        fileName, 
        hasFileData: !!fileData,
        fileDataLength: fileData?.length,
        mimeType,
        textLength: resumeText?.length || 0
      });

      // Determine if text extraction was successful
      const textExtractionSuccess = resumeText && resumeText.length > 50 && !resumeText.startsWith('[Resume file:');
      
      res.json({ 
        success: true, 
        message: textExtractionSuccess 
          ? 'Resume uploaded and processed successfully'
          : 'Resume uploaded but text extraction failed. Email generation may not work properly. Please upload a text-based PDF or DOCX file.',
        fileName,
        textExtracted: textExtractionSuccess,
        textLength: resumeText?.length || 0,
        warning: !textExtractionSuccess 
          ? 'Unable to extract text from this file. For best results, upload a text-based PDF, DOCX, or TXT file.'
          : undefined,
        supportedFormats: ['.txt', '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp']
      });
    } catch (error) {
      console.error('[RESUME-UPLOAD] Processing error:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('PDF parsing')) {
        res.status(422).json({ 
          error: 'PDF processing failed', 
          details: 'Unable to extract text from PDF. File saved but text extraction failed.',
          code: 'PDF_PARSE_ERROR'
        });
      } else if (errorMessage.includes('DOCX parsing')) {
        res.status(422).json({ 
          error: 'Document processing failed', 
          details: 'Unable to extract text from Word document. File saved but text extraction failed.',
          code: 'DOCX_PARSE_ERROR'
        });
      } else if (errorMessage.includes('OCR')) {
        res.status(422).json({ 
          error: 'Image processing failed', 
          details: 'Unable to extract text from image. File saved but OCR failed.',
          code: 'OCR_ERROR'
        });
      } else {
        res.status(500).json({ 
          error: 'Resume processing failed', 
          details: 'An error occurred while processing your resume.',
          code: 'PROCESSING_ERROR'
        });
      }
    }
  });
  

  // === FEEDBACK ROUTES ===
  
  app.post("/api/feedback/payment-interest", async (req, res) => {
    try {
      const { wouldPay } = req.body;
      const userId = req.session?.userId || 'anonymous';
      
      // Log the feedback (you could store this in a database if needed)
      console.log(`Payment Interest Feedback: User ${userId} - Would Pay: ${wouldPay}`);
      
      // You could also track this in a database table if you want
      // For now, just log it
      
      res.json({ 
        success: true,
        message: wouldPay ? 'Thanks for your enthusiasm!' : 'Thanks for your honesty!'
      });
    } catch (error) {
      console.error('Feedback error:', error);
      res.status(500).json({ error: 'Failed to record feedback' });
    }
  });

  // === APPLICATION ROUTES ===
  
  app.get("/api/applications", requireAuth, async (req, res) => {
    const applications = await db
      .select()
      .from(emailApplications)
      .where(eq(emailApplications.userId, req.user!.id))
      .orderBy(desc(emailApplications.sentAt));

    res.json(applications);
  });
  
  // Get user's resume text endpoint
  app.get("/api/user/resume", requireAuth, async (req, res) => {
    try {
      const resumeData = await storage.getUserResume(req.user!.id);
      
      if (!resumeData?.resumeText) {
        return res.status(404).json({ 
          hasResume: false,
          error: 'No resume found',
          message: 'Please upload your resume first'
        });
      }
      
      res.json({ 
        hasResume: true,
        resumeText: resumeData.resumeText,
        fileName: resumeData.resumeFileName,
        uploadedAt: resumeData.resumeUploadedAt
      });
    } catch (error) {
      console.error('Error fetching user resume:', error);
      res.status(500).json({ 
        hasResume: false,
        error: 'Failed to fetch resume',
        message: 'An error occurred while retrieving your resume'
      });
    }
  });

  // Debug endpoint to check resume data
  app.get("/api/debug/resume", requireAuth, async (req, res) => {
    const resumeData = await storage.getUserResume(req.user!.id);
    
    res.json({
      hasResume: !!resumeData,
      hasFileData: !!resumeData?.resumeFileData,
      fileName: resumeData?.resumeFileName,
      mimeType: resumeData?.resumeFileMimeType,
      fileDataLength: resumeData?.resumeFileData?.length,
      fileDataSample: resumeData?.resumeFileData?.substring(0, 100), // First 100 chars
      uploadedAt: resumeData?.resumeUploadedAt
    });
  });
  
  // Voice Interview - Transcribe audio using OpenAI Whisper
  app.post("/api/resume/transcribe", requireAuth, upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || ''
      });

      // Create a File object from the buffer for OpenAI
      const file = new File([req.file.buffer], req.file.originalname || 'recording.webm', {
        type: req.file.mimetype || 'audio/webm'
      });

      // Transcribe using Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "en",
        temperature: 0.2, // Lower temperature for more accurate transcription
      });

      console.log('[VOICE-TRANSCRIBE] Successfully transcribed audio for user:', req.user?.id);
      
      res.json({ 
        text: transcription.text,
        questionId: req.body.questionId 
      });

    } catch (error) {
      console.error('[VOICE-TRANSCRIBE] Error:', error);
      res.status(500).json({ 
        error: "Failed to transcribe audio",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate resume from interview answers
  app.post("/api/resume/generate-from-interview", requireAuth, async (req, res) => {
    try {
      const { answers, questions } = req.body;
      
      if (!answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ error: "No interview answers provided" });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || ''
      });

      // Create a structured prompt from the interview answers
      const interviewSummary = questions.map((q: any) => {
        const answer = answers[q.id] || 'Not provided';
        return `Question: ${q.question}\nAnswer: ${answer}`;
      }).join('\n\n');

      // Generate professional resume using OpenAI with structured format
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional resume writer. Transform interview responses into a polished, ATS-optimized resume.
            
            Format the resume EXACTLY as follows using markdown:
            
            **[Full Name]**
            [Email]
            [Phone]
            [Location]
            
            ---
            
            **Professional Summary**
            [2-3 impactful sentences describing the candidate's value proposition, key strengths, and career objectives]
            
            **Work Experience**
            
            **[Job Title], [Company Name]**
            [Location, if mentioned]
            [Start Date] - [End Date or Present]
            - [Achievement/responsibility with quantified results where possible]
            - [Achievement/responsibility with action verbs]
            - [Achievement/responsibility demonstrating impact]
            
            [Repeat for each position]
            
            **Education**
            
            **[Degree/Certification]**
            [School/Institution Name]
            [Graduation Date or Expected Date]
            
            **Skills**
            - Technical Skills: [List relevant technical skills]
            - Professional Skills: [List soft/professional skills]
            - Tools & Technologies: [List tools, software, platforms]
            
            Use strong action verbs (achieved, led, implemented, increased, managed, developed, etc.).
            Quantify achievements where possible (increased revenue by X%, managed team of Y, etc.).
            Ensure professional tone throughout.
            Return ONLY the formatted resume text, no explanations or metadata.`
          },
          {
            role: "user",
            content: `Create a professional resume from these interview responses:\n\n${interviewSummary}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const resumeText = completion.choices[0]?.message?.content || '';
      
      if (!resumeText) {
        throw new Error('Failed to generate resume content');
      }

      // Save the generated resume to database
      await storage.saveUserResume(req.user!.id, {
        resumeText,
        resumeFileName: 'ai_generated_resume.txt',
        resumeFileData: Buffer.from(resumeText).toString('base64'),
        resumeFileMimeType: 'text/plain'
      });

      console.log('[VOICE-RESUME] Successfully generated resume for user:', req.user?.id);
      
      res.json({ 
        success: true,
        resumeText,
        message: 'Resume generated and saved successfully'
      });

    } catch (error) {
      console.error('[VOICE-RESUME] Generation error:', error);
      res.status(500).json({ 
        error: "Failed to generate resume",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test endpoint to send email with attachment
  app.post("/api/test/send-email-with-resume", requireAuth, async (req, res) => {
    try {
      const { email } = req.body;
      const testEmail = email || req.user?.email || 'test@example.com';
      
      // Get user's resume data
      const userResume = await storage.getUserResume(req.user!.id);
      
      console.log('TEST EMAIL - Resume check:', {
        userId: req.user!.id,
        hasResume: !!userResume,
        hasFileData: !!userResume?.resumeFileData,
        fileName: userResume?.resumeFileName,
        fileDataLength: userResume?.resumeFileData?.length,
        mimeType: userResume?.resumeFileMimeType
      });
      
      if (!userResume?.resumeFileData) {
        return res.status(400).json({ 
          error: 'No resume found. Please upload a resume first.',
          debug: {
            hasResume: !!userResume,
            hasFileData: false
          }
        });
      }
      
      // Ensure Gmail credentials are valid and refresh if needed
      const credentials = await ensureValidGmailCredentials(req.user!.id);
      
      if (!credentials.isValid) {
        console.log(`Gmail credentials invalid or expired for user ${req.user!.id}`);
        return res.status(400).json({ 
          error: 'Gmail authorization expired or invalid. Please re-authorize Gmail.' 
        });
      }
      
      // Send with Gmail ONLY
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
      });
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Create multipart MIME message with attachment
      const boundary = `====testboundary${Date.now()}====`;
      const testBody = `This is a test email to verify resume attachment.<br><br>Your resume should be attached to this email.`;
      
      const messageParts = [];
      messageParts.push(`To: ${testEmail}`);
      messageParts.push(`Subject: Test Email - Resume Attachment Verification`);
      messageParts.push('MIME-Version: 1.0');
      messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      messageParts.push('');
      messageParts.push(`--${boundary}`);
      messageParts.push('Content-Type: text/html; charset=utf-8');
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push('');
      messageParts.push(Buffer.from(testBody).toString('base64'));
      messageParts.push('');
      messageParts.push(`--${boundary}`);
      messageParts.push(`Content-Type: ${userResume.resumeFileMimeType || 'application/octet-stream'}; name="${userResume.resumeFileName}"`);
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push(`Content-Disposition: attachment; filename="${userResume.resumeFileName}"`);
      messageParts.push('');
      messageParts.push(userResume.resumeFileData);
      messageParts.push('');
      messageParts.push(`--${boundary}--`);
      
      const emailMessage = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(emailMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      
      res.json({ 
        success: true, 
        message: 'Test email sent with resume attachment via Gmail',
        details: {
          to: testEmail,
          attachmentName: userResume.resumeFileName,
          attachmentSize: userResume.resumeFileData.length
        }
      });
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({ 
        error: 'Failed to send test email', 
        details: error.message 
      });
    }
  });

  // Parse plain text resume to structured format
  app.post("/api/resume/parse", requireAuth, async (req, res) => {
    try {
      const { resumeText } = req.body;
      
      if (!resumeText) {
        return res.status(400).json({ error: 'Resume text is required' });
      }
      
      const { parseResumeText } = await import('./utils/resume-parser');
      const structuredResume = parseResumeText(resumeText);
      
      res.json({ 
        success: true,
        structuredResume 
      });
    } catch (error) {
      console.error('Resume parsing error:', error);
      res.status(500).json({ 
        error: 'Failed to parse resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate PDF from structured resume
  app.post("/api/resume/generate-pdf", requireAuth, async (req, res) => {
    try {
      const { structuredResume, theme = 'modern' } = req.body;
      
      if (!structuredResume) {
        return res.status(400).json({ error: 'Structured resume data is required' });
      }
      
      const { generateResumePDF } = await import('./utils/resume-pdf-generator');
      const pdfBytes = await generateResumePDF(structuredResume, theme);
      
      // Convert Uint8Array to Buffer for response
      const pdfBuffer = Buffer.from(pdfBytes);
      
      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user's resume as structured data and PDF
  app.get("/api/resume/structured", requireAuth, async (req, res) => {
    try {
      const userResume = await storage.getUserResume(req.user!.id);
      
      if (!userResume?.resumeText) {
        return res.status(404).json({ error: 'No resume found' });
      }
      
      const { parseResumeText } = await import('./utils/resume-parser');
      const structuredResume = parseResumeText(userResume.resumeText);
      
      res.json({
        success: true,
        structuredResume,
        plainText: userResume.resumeText
      });
      
    } catch (error) {
      console.error('Get structured resume error:', error);
      res.status(500).json({ 
        error: 'Failed to get structured resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // TEMPORARY TEST ENDPOINT - Remove after testing poster URL detection
  app.get('/api/test-scraping/:requestId', async (req, res) => {
    try {
      const requestId = req.params.requestId;
      console.log('🧪 TESTING: Starting job scraping for request:', requestId);
      
      // Get the request from database
      const request = await db.select().from(jobScrapingRequests).where(eq(jobScrapingRequests.id, requestId)).limit(1);
      if (request.length === 0) {
        return res.status(404).json({ error: 'Request not found' });
      }
      
      const jobRequest = request[0];
      console.log('🧪 TESTING: Found request:', jobRequest.linkedinUrl);
      
      // Call the async processing function directly
      await processJobScrapingAsync(requestId, jobRequest.linkedinUrl);
      
      res.json({ message: 'Test scraping completed', requestId });
    } catch (error) {
      console.error('🧪 TESTING: Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}