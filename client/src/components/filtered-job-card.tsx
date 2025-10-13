import { useState, useRef, useEffect } from "react";
import { FilteredJobData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  MapPin, 
  ExternalLink, 
  User, 
  Briefcase, 
  DollarSign, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Send, 
  Loader2, 
  Sparkles, 
  Globe, 
  Building2, 
  Clock, 
  Shield, 
  Users, 
  GraduationCap, 
  RotateCcw,
  Bookmark,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { CompanyProfileModal } from "./company-profile-modal";
import { EmailComposerModal } from "./email-composer-modal";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { getRelativeTime } from "@/lib/time-utils";
import { useToast } from "@/hooks/use-toast";

interface FilteredJobCardProps {
  job: FilteredJobData;
  resumeText?: string | null;
}

export function FilteredJobCard({ job, resumeText: propsResumeText }: FilteredJobCardProps) {
  const { toast } = useToast();
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showGmailAuth, setShowGmailAuth] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [generatedEmail, setGeneratedEmail] = useState<string>("");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [applyStep, setApplyStep] = useState<'idle' | 'checking-gmail' | 'scraping-company' | 'generating-email' | 'ready'>('idle');
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [hasCheckedAutoApply, setHasCheckedAutoApply] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // New states for enhanced UI
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Fetch fresh resume data using React Query to get the latest version
  const { data: resumeData, refetch: refetchResume } = useQuery({
    queryKey: ['/api/user/resume'],
    queryFn: async () => {
      const response = await fetch('/api/user/resume');
      if (response.ok) {
        return await response.json();
      }
      return { hasResume: false, resumeText: null };
    },
    staleTime: 0, // Always considered stale to ensure fresh data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false // Don't refetch on every focus to avoid too many requests
  });
  
  // Use the fresh resume data from React Query, fallback to props if needed
  const resumeText = resumeData?.resumeText || propsResumeText || null;

  // Check Gmail authorization status - fetch once on mount and cache
  const { data: gmailStatus, refetch: refetchGmailStatus } = useQuery({
    queryKey: ['/api/auth/gmail/status'],
    enabled: true, // Always fetch to keep status updated
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  }) as { data?: { authorized?: boolean; needsRefresh?: boolean; isConnected?: boolean; email?: string }; refetch: () => Promise<any> };

  const companyMutation = useMutation({
    mutationFn: async (companyLinkedinUrl: string) => {
      return await apiRequest('/api/scrape-company', {
        method: 'POST',
        body: JSON.stringify({ companyLinkedinUrl })
      });
    },
    onSuccess: async (data) => {
      if (data.success) {
        setCompanyProfile(data.company);
        // After company data is loaded, generate the email
        // The email composer will be shown automatically after generation
        await generateApplicationEmail(data.company);
      } else {
        // Company scraping failed, generate email without company data
        console.warn('Company scraping failed, generating email without company data');
        setShowLoadingModal(false);
        await generateApplicationEmail(null);
      }
    },
    onError: async (error) => {
      console.error('Company scraping error:', error);
      // Fallback: generate email without company data
      setShowLoadingModal(false);
      await generateApplicationEmail(null);
    },
  });

  const generateApplicationEmail = async (companyData: any) => {
    setIsGeneratingEmail(true);
    setApplyStep('generating-email');
    
    try {
      const jobPosterData = {
        name: job.jobPosterName || "Hiring Manager",
        headline: job.jobPosterName ? `Professional at ${job.companyName}` : "",
        about: ""
      };

      // Ensure we have all required fields
      if (!resumeText) {
        console.error('No resume text available, attempting to refetch...');
        
        // Try to refetch resume data first
        const freshResume = await refetchResume();
        const freshResumeText = freshResume?.data?.resumeText;
        
        if (!freshResumeText) {
          setApplyStep('idle');
          setShowLoadingModal(false);
          
          // Show error with retry option
          toast({
            title: "Resume Required",
            description: `Please upload your resume to continue. ${retryCount > 0 ? 'Still unable to find your resume after retrying.' : 'You can upload it during a new job search or in Settings.'}`,
            variant: "destructive",
            action: (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setRetryCount(prev => prev + 1);
                    // Refetch resume and retry
                    const result = await refetchResume();
                    if (result?.data?.resumeText) {
                      // Resume found, retry email generation
                      handleApplyClick();
                    }
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = '/settings'}
                >
                  Go to Settings
                </Button>
              </div>
            )
          });
          setIsGeneratingEmail(false);
          return;
        }
        
        // Resume was refetched successfully, use the fresh data
        console.log('Resume refetched successfully, continuing with email generation');
        // Update the requestBody to use fresh resume
        const requestBody = {
          jobTitle: job.title || 'Position Not Specified',
          companyName: job.companyName || 'Company Not Specified',
          jobDescription: job.description || job.requirement || `${job.title || 'Position'} position at ${job.companyName || 'Company'}`,
          resumeText: freshResumeText, // Use the freshly fetched resume
          jobUrl: job.applyUrl || job.url || job.link || 'LinkedIn',
          applyUrl: job.applyUrl || job.url || job.link || 'LinkedIn'
        };
        
        // Continue with the request using fresh resume
        console.log('Sending email generation request with fresh resume:', requestBody);

        const data = await apiRequest('/api/generate-email', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          timeout: 35000 // 35 seconds timeout for email generation
        });
        
        if (data.email) {
          setGeneratedEmail(data.email);
          setApplyStep('ready');
          setShowCompanyModal(false);
          setShowLoadingModal(false);
          setShowEmailComposer(true);
        } else {
          console.error("Email generation failed:", data.error);
          setApplyStep('idle');
          setShowLoadingModal(false);
          alert(`Email generation failed: ${data.error || 'Unknown error'}`);
        }
        setIsGeneratingEmail(false);
        return; // Exit early since we handled the request
      }

      // Normal flow - resume exists
      const requestBody = {
        jobTitle: job.title || 'Position Not Specified',
        companyName: job.companyName || 'Company Not Specified',
        jobDescription: job.description || job.requirement || `${job.title || 'Position'} position at ${job.companyName || 'Company'}`,
        resumeText: resumeText,
        jobUrl: job.applyUrl || job.url || job.link || 'LinkedIn',
        applyUrl: job.applyUrl || job.url || job.link || 'LinkedIn'
      };
      
      console.log('Sending email generation request:', requestBody);

      const data = await apiRequest('/api/generate-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        timeout: 35000 // 35 seconds timeout for email generation
      });
      
      if (data.email) {
        setGeneratedEmail(data.email);
        setApplyStep('ready');
        // Close any loading modals
        setShowCompanyModal(false);
        setShowLoadingModal(false);
        // Show the email composer with generated email
        setShowEmailComposer(true);
      } else {
        console.error("Email generation failed:", data.error);
        setApplyStep('idle');
        setShowLoadingModal(false);
        alert(`Email generation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("Error generating email:", error);
      setApplyStep('idle');
      setShowLoadingModal(false);
      alert(`Error generating email: ${error.message || 'Please check if you are logged in'}`);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleApplyClick = async () => {
    // Check if we have an email address to send to
    if (!job.jobPosterEmail) {
      toast({
        title: "Email address not available",
        description: "This job posting doesn't have a contact email address. You may need to apply on the company website.",
        variant: "destructive",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewJob}
          >
            View Job
          </Button>
        )
      });
      return;
    }
    
    try {
      // Step 1: Check Gmail authorization using cached status first
      setApplyStep('checking-gmail');
      
      // Use cached status if available, otherwise refetch
      let status = gmailStatus;
      if (!status) {
        const result = await refetchGmailStatus();
        status = result?.data as any;
      }
      
      // Only show auth prompt if user truly hasn't authorized Gmail yet
      if (!status?.authorized && !status?.isConnected) {
        // User needs Gmail authorization first - redirect to Gmail auth
        setApplyStep('idle');
        
        // Store job info for auto-apply after Gmail auth
        sessionStorage.setItem('pendingApplyJob', JSON.stringify({
          job: {
            companyName: job.companyName,
            title: job.title
          }
        }));
        
        // Redirect to Gmail authorization with return URL
        const currentUrl = window.location.pathname + window.location.search;
        window.location.href = `/api/auth/gmail/authorize?returnUrl=${encodeURIComponent(currentUrl)}&autoApply=true`;
        return;
      }
      
      // If credentials exist but need refresh, try to proceed anyway
      // The backend will handle token refresh automatically

      // Step 2: Scrape company data if available
      if (job.companyLinkedinUrl) {
        setApplyStep('scraping-company');
        setShowLoadingModal(true);
        companyMutation.mutate(job.companyLinkedinUrl);
      } else {
        // Step 3: Generate email directly
        setApplyStep('generating-email');
        setShowLoadingModal(true);
        await generateApplicationEmail(null);
      }
    } catch (error) {
      console.error('Error in apply flow:', error);
      setApplyStep('idle');
      // Fallback: show email composer with empty email
      setShowEmailComposer(true);
    }
  };

  const handleProceedToApply = () => {
    setShowCompanyModal(false);
    setShowEmailComposer(true);
  };

  const handleRegenerateEmail = () => {
    // Prevent multiple concurrent requests
    if (isGeneratingEmail || applyStep !== 'idle') {
      console.log("Email generation already in progress");
      return;
    }
    
    // Reset generated email and regenerate
    setGeneratedEmail("");
    setApplyStep('generating-email');
    
    // Generate email immediately without delay
    if (job.companyLinkedinUrl && !companyProfile) {
      setApplyStep('scraping-company');
      companyMutation.mutate(job.companyLinkedinUrl);
    } else {
      generateApplicationEmail(companyProfile);
    }
  };
  const handleViewJob = () => {
    window.open(job.link, "_blank", "noopener,noreferrer");
  };

  const handleViewCompany = () => {
    window.open(job.companyWebsite, "_blank", "noopener,noreferrer");
  };

  const handleViewCompanyLinkedIn = () => {
    window.open(job.companyLinkedinUrl, "_blank", "noopener,noreferrer");
  };
  
  // Handle auto-apply after Gmail authorization
  useEffect(() => {
    if (hasCheckedAutoApply) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const autoApply = urlParams.get('auto_apply') === 'true';
    const gmailSuccess = urlParams.get('gmail') === 'success';
    
    if (autoApply && gmailSuccess) {
      setHasCheckedAutoApply(true);
      
      // Check if this is the correct job from session storage
      const pendingJobData = sessionStorage.getItem('pendingApplyJob');
      if (pendingJobData) {
        const { job: storedJob } = JSON.parse(pendingJobData);
        
        // Check if this is the same job
        if (storedJob.companyName === job.companyName && storedJob.title === job.title) {
          // Clear the stored data
          sessionStorage.removeItem('pendingApplyJob');
          
          // Clean up URL parameters
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('gmail');
          newUrl.searchParams.delete('auto_apply');
          window.history.replaceState({}, document.title, newUrl.toString());
          
          // Automatically trigger the apply flow
          setTimeout(() => {
            if (job.companyLinkedinUrl) {
              setApplyStep('scraping-company');
              setShowLoadingModal(true);
              companyMutation.mutate(job.companyLinkedinUrl);
            } else {
              setApplyStep('generating-email');
              setShowLoadingModal(true);
              generateApplicationEmail(null);
            }
          }, 500);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCheckedAutoApply, job.companyName, job.title, job.companyLinkedinUrl]);

  const handleViewPoster = () => {
    if (job.jobPosterLinkedinUrl) {
      window.open(job.jobPosterLinkedinUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Extract company from recruiter title if available (define function first)
  const getRecruiterCompany = () => {
    if (!job.jobPosterTitle) return null;
    // Handle both "@ Company" and "at Company" patterns
    const atMatch = job.jobPosterTitle.match(/\s+at\s+([^|]+)/i);
    const symbolMatch = job.jobPosterTitle.match(/@\s*([^|]+)/);
    const match = atMatch || symbolMatch;
    return match ? match[1].trim() : null;
  };

  // Detect EXTERNAL recruiters (not internal HR) based on title patterns and company context
  const isExternalRecruiter = job.jobPosterTitle && (
    job.jobPosterTitle.toLowerCase().includes('talent acquisition') ||
    job.jobPosterTitle.toLowerCase().includes('recruiter') ||
    job.jobPosterTitle.toLowerCase().includes('ta consultant') ||
    job.jobPosterTitle.toLowerCase().includes('ta professional') ||
    job.jobPosterTitle.toLowerCase().includes('talent scout') ||
    job.jobPosterTitle.toLowerCase().includes('talent specialist') ||
    job.jobPosterTitle.toLowerCase().includes('tech-recruitment') ||
    job.jobPosterTitle.toLowerCase().includes('technical recruitment') ||
    // Match TA Group/Team patterns
    (job.jobPosterTitle.toLowerCase().includes('ta') && (
      job.jobPosterTitle.toLowerCase().includes('group') ||
      job.jobPosterTitle.toLowerCase().includes('team')
    ))
  );
  
  // Check if this is likely an external recruitment agency
  const recruiterCompany = getRecruiterCompany();
  const isRecruiter = isExternalRecruiter && (
    // Has company context different from job company (external agency)
    (recruiterCompany && recruiterCompany.toLowerCase() !== job.companyName.toLowerCase()) ||
    // Or is clearly an external recruiter based on title alone
    (job.jobPosterTitle && job.jobPosterTitle.toLowerCase().includes('recruitment'))
  );

  // Handle save job toggle
  const handleSaveJob = () => {
    setIsSaved(!isSaved);
    toast({
      title: isSaved ? "Job Removed" : "Job Saved",
      description: isSaved ? "Removed from your saved jobs" : "Added to your saved jobs",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
      className="group"
    >
      <Card className={`bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${isExpanded ? '' : 'max-h-[180px]'}`}>
        <CardHeader className="p-3 space-y-2">
          {/* Ultra-Compact Top Row */}
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {/* Job Title - Smaller */}
              <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer leading-tight"
                  onClick={handleViewJob}>
                {job.title}
              </h3>
              
              {/* Company Info - Single Line with Small Logo */}
              <div className="flex items-center gap-2 mt-1">
                {job.companyLogo ? (
                  <img 
                    src={job.companyLogo} 
                    alt={`${job.companyName} logo`} 
                    className="w-6 h-6 rounded object-cover border border-gray-200"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`${!job.companyLogo ? '' : 'hidden'} w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center`}>
                  <Building2 className="h-3 w-3 text-white" />
                </div>
                <p className="text-sm text-gray-700 hover:text-blue-600 cursor-pointer transition-colors"
                   onClick={handleViewCompany}>
                  {job.companyName}
                </p>
              </div>
              
              {/* Metadata - Single Compact Line */}
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <MapPin className="h-3 w-3" />
                <span>{job.location}</span>
                {job.postedDate && (
                  <>
                    <span className="mx-1">•</span>
                    <Clock className="h-3 w-3" />
                    <span>{getRelativeTime(job.postedDate)}</span>
                  </>
                )}
                {job.workType && (
                  <>
                    <span className="mx-1">•</span>
                    <span>{job.workType}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Small Save Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSaveJob}
              className="h-8 w-8 rounded-full hover:bg-gray-100"
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-blue-600 text-blue-600' : 'text-gray-600'}`} />
            </Button>
          </div>
          
          {/* Compact Action Row */}
          <div className="flex items-center gap-2 pt-1">
            {job.canApply ? (
              <Badge className="bg-green-600 text-white text-xs px-2 py-0.5">
                <CheckCircle className="h-3 w-3 mr-1" />
                Can Apply
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5">
                <XCircle className="h-3 w-3 mr-1" />
                Cannot Apply
              </Badge>
            )}
            
            {job.canApply && (
              <Button 
                className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleApplyClick}
                disabled={applyStep !== 'idle'}
              >
                {applyStep === 'idle' ? 'Apply' : 
                 applyStep === 'checking-gmail' ? 'Checking...' :
                 applyStep === 'scraping-company' ? 'Loading...' :
                 applyStep === 'generating-email' ? 'Generating...' :
                 'Ready'}
              </Button>
            )}
            
            <Button 
              variant="outline"
              className="h-7 px-3 text-xs"
              onClick={handleViewJob}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              LinkedIn
            </Button>
            
            <Button
              variant="ghost"
              className="h-7 px-3 text-xs ml-auto"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>Collapse <ChevronUp className="h-3 w-3 ml-1" /></>
              ) : (
                <>View Details <ChevronDown className="h-3 w-3 ml-1" /></>
              )}
            </Button>
          </div>
        </CardHeader>
        
        {/* Expandable Content - Hidden by default */}
        {isExpanded && (
          <CardContent className="p-3 pt-0 space-y-3 transition-all duration-300">
            {job.description && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Job Description</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {job.description}
                </p>
              </div>
            )}
            
            {job.requirement && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Requirements</h4>
                <div className="bg-blue-50 rounded p-2 border border-blue-200">
                  <p className="text-sm text-blue-800 leading-relaxed">
                    {job.requirement}
                  </p>
                </div>
              </div>
            )}
            
            {/* Job Poster Information - Compact */}
            {job.jobPosterName && (
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex items-center gap-2">
                  {job.jobPosterImageUrl ? (
                    <img 
                      src={job.jobPosterImageUrl}
                      alt={`${job.jobPosterName} profile`}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`${!job.jobPosterImageUrl ? '' : 'hidden'} w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center`}>
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 hover:text-blue-600 cursor-pointer transition-colors"
                       onClick={handleViewPoster}>
                      {job.jobPosterName}
                    </p>
                    {job.jobPosterTitle && (
                      <p className="text-xs text-gray-600">{job.jobPosterTitle}</p>
                    )}
                  </div>
                  {job.jobPosterEmail && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      <Mail className="h-3 w-3 mr-1" />
                      Contact
                    </Badge>
                  )}
                </div>
                {isRecruiter && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-0.5 w-fit">
                    <Users className="h-3 w-3" />
                    <span>External Recruiter</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
      
      {/* Loading Modal for Company Scraping */}
      <Dialog open={showLoadingModal} onOpenChange={setShowLoadingModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
              Preparing Your Application
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-4">
              <div className="flex items-center gap-3">
                {applyStep === 'checking-gmail' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span>Checking Gmail authorization...</span>
                  </>
                )}
                {applyStep === 'scraping-company' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span>Analyzing company profile...</span>
                  </>
                )}
                {applyStep === 'generating-email' && (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse text-blue-600" />
                    <span>Crafting personalized email...</span>
                  </>
                )}
                {applyStep === 'ready' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Email ready!</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">
                This may take a few moments as we personalize your application for {job.companyName}.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      
      {/* Company Profile Modal */}
      {showCompanyModal && (
        <CompanyProfileModal
          isOpen={showCompanyModal}
          onClose={() => setShowCompanyModal(false)}
          companyProfile={companyProfile}
          isLoading={false}
          jobEmail={job.jobPosterEmail}
          onProceedToApply={handleProceedToApply}
          generatedEmail={generatedEmail}
          isGeneratingEmail={isGeneratingEmail}
        />
      )}
      
      {/* Email Composer Modal */}
      {showEmailComposer && (
        <EmailComposerModal
          isOpen={showEmailComposer}
          onClose={() => {
            setShowEmailComposer(false);
            setApplyStep('idle');
          }}
          recipientEmail={job.jobPosterEmail || ''}
          jobTitle={job.title || 'Position Not Specified'}
          companyName={job.companyName || 'Company Not Specified'}
          jobUrl={job.link}
          companyWebsite={job.companyWebsite}
          generatedEmail={generatedEmail}
          isGeneratingEmail={isGeneratingEmail}
          onRegenerateEmail={handleRegenerateEmail}
          showRegenerateButton={true}
        />
      )}
      
      {/* Gmail Auth Dialog */}
      <Dialog open={showGmailAuth} onOpenChange={setShowGmailAuth}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Gmail Authorization Required
            </DialogTitle>
            <DialogDescription className="text-left space-y-4 pt-4">
              <p className="text-sm">
                To send applications directly through our platform, you need to authorize Gmail access.
              </p>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>What we'll do:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Send emails on your behalf</li>
                    <li>Track sent applications</li>
                    <li>Never read your personal emails</li>
                  </ul>
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => {
                    sessionStorage.setItem('pendingApplyJob', JSON.stringify({
                      job: {
                        companyName: job.companyName,
                        title: job.title
                      }
                    }));
                    const currentUrl = window.location.pathname + window.location.search;
                    window.location.href = `/api/auth/gmail/authorize?returnUrl=${encodeURIComponent(currentUrl)}&autoApply=true`;
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Authorize Gmail
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowGmailAuth(false)}
                >
                  Cancel
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}