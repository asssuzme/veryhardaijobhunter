import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_KEY,
});

export interface JobScrapingResult {
  jobTitle: string;
  companyName: string;
  location: string;
  salary?: string;
  description: string;
  applyUrl: string;
  postedDate?: string;
  experienceLevel?: string;
  workType?: string;
  jobPosterUrl?: string;
  jobPosterName?: string;
}

export interface ApifyJobScrapingRequest {
  linkedinUrl: string;
  maxResults?: number;
}

/**
 * Scrape LinkedIn jobs using Apify
 */
export async function scrapeLinkedInJobs(
  request: ApifyJobScrapingRequest
): Promise<JobScrapingResult[]> {
  if (!process.env.APIFY_API_KEY) {
    throw new Error('APIFY_API_KEY is not configured');
  }

  try {
    console.log('Starting LinkedIn job scraping with Apify...', { linkedinUrl: request.linkedinUrl });

    // Use curious_coder LinkedIn Jobs Scraper actor (free alternative)
    const run = await apifyClient.actor('curious_coder/linkedin-jobs-scraper').call({
      count: 100,
      scrapeCompany: true,
      urls: [request.linkedinUrl]
    });

    console.log('Apify run started:', run.id);

    // Wait for the run to complete
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    console.log(`Scraped ${items.length} jobs from LinkedIn`);
    
    // Debug: log the structure of the first item
    if (items.length > 0) {
      console.log('Sample Apify item structure:', JSON.stringify(items[0], null, 2));
    }
    
    // Check ALL jobs for job poster URLs - log any that have them
    console.log('🔍 Checking all', items.length, 'jobs for poster URLs...');
    let foundPosterCount = 0;
    items.forEach((item: any, index: number) => {
      const allKeys = Object.keys(item);
      const posterKeys = allKeys.filter(key => 
        key.toLowerCase().includes('poster') || 
        key.toLowerCase().includes('recruiter') || 
        key.toLowerCase().includes('hiring') ||
        key.toLowerCase().includes('contact') ||
        (typeof item[key] === 'string' && item[key].includes('linkedin.com/in/'))
      );
      
      if (posterKeys.length > 0) {
        foundPosterCount++;
        console.log(`✅ Job ${index + 1} (${item.title}) has poster fields:`, posterKeys.map(k => `${k}: ${item[k]}`));
      }
    });
    console.log(`🎯 Found ${foundPosterCount} jobs with potential poster information out of ${items.length} total jobs`);

    // Transform Apify results to our format
    const results: JobScrapingResult[] = items.map((item: any, index: number) => {
      // More flexible field mapping - check multiple possible field names
      const jobTitle = item.title || item.jobTitle || item.position || '';
      const companyName = item.company || item.companyName || item.employer || '';
      
      // Extract job poster information - using the CORRECT field names from Apify response
      let jobPosterUrl = item.jobPosterProfileUrl || item.jobPosterUrl || item.postedByUrl || item.recruiterUrl || 
                         item.hrUrl || item.contactUrl || item.postedBy?.url || 
                         item.poster?.url || item.recruiter?.profileUrl || null;
      
      let jobPosterName = item.jobPosterName || item.postedByName || item.recruiterName || 
                          item.hrName || item.contactName || item.postedBy?.name || 
                          item.poster?.name || item.recruiter?.name || null;
      
      // If not found in fields, try to extract from description text
      if (!jobPosterName && item.descriptionText) {
        const posterMatch = item.descriptionText.match(/This job was posted by ([^\.]+)/i);
        if (posterMatch) {
          jobPosterName = posterMatch[1].trim();
        }
      }
      
      // Also check other possible field names in the response
      if (!jobPosterUrl) {
        // Check if there are any LinkedIn profile URLs in the raw response
        const possibleFields = ['jobPoster', 'hiringManager', 'recruiter', 'contactPerson', 'postedBy'];
        for (const field of possibleFields) {
          if (item[field] && typeof item[field] === 'object') {
            if (item[field].linkedinUrl) jobPosterUrl = item[field].linkedinUrl;
            if (item[field].profileUrl) jobPosterUrl = item[field].profileUrl;
            if (item[field].url && item[field].url.includes('linkedin.com/in/')) jobPosterUrl = item[field].url;
            if (!jobPosterName && item[field].name) jobPosterName = item[field].name;
          }
        }
      }
      
      // Extract company logo URL - check various possible field names
      let companyLogo = item.companyLogoUrl || item.companyLogo || item.logoUrl || 
                        item.companyPictureUrl || item.companyImageUrl || item.companyImage ||
                        item.company?.logoUrl || item.company?.logo || item.company?.imageUrl ||
                        item.companyDetails?.logo || item.companyDetails?.logoUrl || 
                        item.employer?.logo || item.employer?.logoUrl || null;
      
      // If no logo found, use a fallback placeholder service with company name
      if (!companyLogo && companyName && companyName !== 'Unknown Company') {
        // Use UI Avatars service as fallback for company initials
        const initials = companyName.split(' ').slice(0, 2).map((word: string) => word[0]).join('').toUpperCase();
        companyLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=0D8ABC&color=fff&size=200&bold=true`;
      }
      
      const mapped = {
        jobTitle: jobTitle || 'Unknown Position',
        companyName: companyName || 'Unknown Company',
        companyLogo: companyLogo,
        location: item.location || 'Not specified',
        salary: item.salary,
        description: item.description || item.descriptionText || '',
        applyUrl: item.url || item.link || request.linkedinUrl,
        postedDate: item.postedDate || item.posted || item.postedAt,
        experienceLevel: item.experienceLevel || item.experience || item.seniorityLevel,
        workType: item.workType || item.type || item.employmentType,
        jobPosterUrl: jobPosterUrl,
        jobPosterName: jobPosterName,
      };
      
      // Debug log for first few items
      if (index < 3) {
        console.log('Mapped job:', mapped);
      }
      
      return mapped;
    });

    return results;
  } catch (error) {
    console.error('Apify scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to scrape LinkedIn jobs: ${errorMessage}`);
  }
}

/**
 * Generate LinkedIn search URL using OpenAI for better query formatting
 */
export async function generateLinkedInSearchUrl(
  jobTitle: string,
  location: string,
  workType: 'remote' | 'onsite' | 'hybrid' = 'remote'
): Promise<string> {
  // Simple LinkedIn URL generation
  const baseUrl = 'https://www.linkedin.com/jobs/search';
  const params = new URLSearchParams({
    keywords: jobTitle,
    location: location,
  });

  // Add work type filter
  if (workType === 'remote') {
    params.append('f_WT', '2');
  } else if (workType === 'hybrid') {
    params.append('f_WT', '3');
  } else {
    params.append('f_WT', '1');
  }

  return `${baseUrl}?${params.toString()}`;
}