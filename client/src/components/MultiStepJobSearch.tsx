import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Briefcase,
  MapPin,
  Building2,
  Home,
  Globe,
  Upload,
  Mic,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  X,
  FileText,
  UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { VoiceResumeBuilder } from "@/components/voice-resume-builder";
import { cn } from "@/lib/utils";

interface MultiStepJobSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (requestId: string) => void;
}

// Popular job roles for suggestions
const popularRoles = [
  "Software Engineer",
  "Product Manager",
  "Data Scientist",
  "Marketing Manager",
  "Sales Executive",
  "UI/UX Designer"
];

// Popular locations for suggestions
const popularLocations = [
  "San Francisco",
  "New York",
  "Remote",
  "London",
  "Austin",
  "Seattle"
];

export function MultiStepJobSearch({ isOpen, onClose, onComplete }: MultiStepJobSearchProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingResume, setHasExistingResume] = useState(false);
  const [showVoiceBuilder, setShowVoiceBuilder] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Form data state
  const [formData, setFormData] = useState({
    jobRole: "",
    location: "",
    workType: "",
    resumeText: "",
    resumeFileName: ""
  });

  // Check for existing resume on mount
  useEffect(() => {
    const checkExistingResume = async () => {
      try {
        const response = await fetch('/api/user/resume', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.hasResume && data.resumeText) {
            setFormData(prev => ({
              ...prev,
              resumeText: data.resumeText,
              resumeFileName: data.fileName || 'Saved Resume'
            }));
            setHasExistingResume(true);
          }
        }
      } catch (error) {
        console.error("Error checking for existing resume:", error);
      }
    };

    if (isOpen) {
      checkExistingResume();
    }
  }, [isOpen]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setFormData(prev => ({
        jobRole: "",
        location: "",
        workType: "",
        resumeText: prev.resumeText, // Keep resume data
        resumeFileName: prev.resumeFileName
      }));
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRoleSelect = (role: string) => {
    setFormData(prev => ({ ...prev, jobRole: role }));
    setTimeout(handleNext, 300); // Auto advance with small delay
  };

  const handleLocationSelect = (location: string) => {
    setFormData(prev => ({ ...prev, location }));
    setTimeout(handleNext, 300); // Auto advance with small delay
  };

  const handleWorkTypeSelect = (type: string) => {
    setFormData(prev => ({ ...prev, workType: type }));
    setTimeout(handleNext, 300); // Auto advance with small delay
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'text/plain', 
      'application/pdf',
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/webp'
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .txt, .pdf, .jpg, .jpeg, .png, or .webp file",
        variant: "destructive",
      });
      return;
    }

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('resume', file);
      
      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload resume');
      }
      
      const result = await response.json();
      
      setFormData(prev => ({
        ...prev,
        resumeText: result.text,
        resumeFileName: file.name
      }));
      
      toast({
        title: "Resume uploaded successfully!",
        description: "Ready to search for jobs"
      });
      
      // Auto submit after successful upload
      setTimeout(() => handleSubmit(), 500);
    } catch (error) {
      console.error("Error uploading resume:", error);
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleVoiceResumeComplete = (resumeText: string) => {
    setShowVoiceBuilder(false);
    setFormData(prev => ({
      ...prev,
      resumeText,
      resumeFileName: 'AI Generated Resume'
    }));
    
    toast({
      title: "Resume created successfully!",
      description: "Ready to search for jobs"
    });
    
    // Auto submit after AI generation
    setTimeout(() => handleSubmit(), 500);
  };

  const handleSubmit = async () => {
    // Map work type to backend expected values
    const workTypeMap: { [key: string]: string } = {
      'onsite': '1',
      'remote': '2',
      'hybrid': '3'
    };

    setIsSubmitting(true);

    try {
      // First, generate the LinkedIn URL
      const urlResponse = await apiRequest('/api/generate-linkedin-url', {
        method: 'POST',
        body: JSON.stringify({
          keyword: formData.jobRole,
          location: formData.location,
          workType: workTypeMap[formData.workType] || '1'
        })
      });

      if (!urlResponse.linkedinUrl) {
        throw new Error(urlResponse.error || "Failed to generate LinkedIn URL");
      }

      // Then, start the scraping process
      const response = await apiRequest('/api/scrape-job', {
        method: 'POST',
        body: JSON.stringify({
          linkedinUrl: urlResponse.linkedinUrl,
          resumeText: formData.resumeText || undefined,
          jobCount: 100
        }),
      });

      toast({
        title: "Search Started",
        description: "Finding the best jobs for you..."
      });

      // Invalidate dashboard stats to refresh
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

      // Close dialog and navigate to results
      onClose();
      
      if (onComplete) {
        onComplete(response.requestId);
      } else {
        setTimeout(() => {
          setLocation(`/results/${response.requestId}`);
        }, 500);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start job search",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.jobRole.trim().length > 0;
      case 2:
        return formData.location.trim().length > 0;
      case 3:
        return formData.workType.length > 0;
      case 4:
        return true; // Resume is optional if user already has one
      default:
        return false;
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showVoiceBuilder} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl h-[85vh] sm:h-[75vh] p-0 gap-0 overflow-hidden">
          {/* Header with progress */}
          <div className="px-8 pt-8 pb-4 border-b">
            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                      currentStep >= step 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {currentStep > step ? <Check className="h-4 w-4" /> : step}
                    </div>
                    {step < 4 && (
                      <div className={cn(
                        "w-12 h-0.5 ml-1",
                        currentStep > step ? "bg-primary" : "bg-muted"
                      )} />
                    )}
                  </div>
                ))}
              </div>
              <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>

            <p className="text-sm text-muted-foreground">
              Step {currentStep} of 4
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {/* Step 1: Job Role */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-8 py-12 space-y-8"
                >
                  <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-full bg-primary/10 mb-4">
                      <Briefcase className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">What job are you looking for?</h2>
                    <p className="text-muted-foreground">
                      Enter the role you're interested in
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-6">
                    <Input
                      placeholder="e.g. Software Engineer, Product Manager"
                      value={formData.jobRole}
                      onChange={(e) => setFormData(prev => ({ ...prev, jobRole: e.target.value }))}
                      className="h-14 text-lg text-center"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canProceed()) {
                          handleNext();
                        }
                      }}
                    />

                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Popular searches:
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {popularRoles.map((role) => (
                          <motion.button
                            key={role}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRoleSelect(role)}
                            className="px-4 py-2 rounded-full border bg-background hover:bg-primary/10 hover:border-primary transition-all text-sm"
                          >
                            {role}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Location */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-8 py-12 space-y-8"
                >
                  <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-full bg-primary/10 mb-4">
                      <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Where do you want to work?</h2>
                    <p className="text-muted-foreground">
                      Choose your preferred location
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-6">
                    <Input
                      placeholder="e.g. San Francisco, Remote, New York"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="h-14 text-lg text-center"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canProceed()) {
                          handleNext();
                        }
                      }}
                    />

                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Popular locations:
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {popularLocations.map((location) => (
                          <motion.button
                            key={location}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleLocationSelect(location)}
                            className="px-4 py-2 rounded-full border bg-background hover:bg-primary/10 hover:border-primary transition-all text-sm"
                          >
                            {location}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Work Type */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-8 py-12 space-y-8"
                >
                  <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-full bg-primary/10 mb-4">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">How do you prefer to work?</h2>
                    <p className="text-muted-foreground">
                      Select your ideal work arrangement
                    </p>
                  </div>

                  <div className="max-w-lg mx-auto grid gap-4">
                    {[
                      { value: 'onsite', label: 'On-site', icon: Building2, description: 'Work from office' },
                      { value: 'remote', label: 'Remote', icon: Globe, description: 'Work from anywhere' },
                      { value: 'hybrid', label: 'Hybrid', icon: Home, description: 'Mix of office and home' }
                    ].map((type) => (
                      <motion.button
                        key={type.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleWorkTypeSelect(type.value)}
                        className={cn(
                          "p-6 rounded-lg border-2 text-left transition-all",
                          formData.workType === type.value 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-lg",
                            formData.workType === type.value 
                              ? "bg-primary/10" 
                              : "bg-muted"
                          )}>
                            <type.icon className={cn(
                              "h-6 w-6",
                              formData.workType === type.value 
                                ? "text-primary" 
                                : "text-muted-foreground"
                            )} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{type.label}</h3>
                            <p className="text-sm text-muted-foreground">
                              {type.description}
                            </p>
                          </div>
                          {formData.workType === type.value && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Resume */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-8 py-8 space-y-6"
                >
                  <div className="text-center space-y-2">
                    <div className="inline-flex p-2.5 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-3">
                      <FileText className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-xl font-semibold">Resume Required</h2>
                    <p className="text-sm text-muted-foreground">
                      {hasExistingResume 
                        ? "You already have a resume on file. You can proceed or update it."
                        : "Select your preferred method to add your resume"}
                    </p>
                  </div>

                  {hasExistingResume ? (
                    <div className="max-w-lg mx-auto space-y-6">
                      <div className="p-6 rounded-lg border bg-green-500/5 border-green-500/20">
                        <div className="flex items-center gap-3 mb-4">
                          <Check className="h-6 w-6 text-green-600" />
                          <div className="flex-1">
                            <h3 className="font-semibold">Resume Ready</h3>
                            <p className="text-sm text-muted-foreground">
                              {formData.resumeFileName}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleSubmit()}
                            className="flex-1"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              "Search Jobs"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setHasExistingResume(false)}
                          >
                            Update Resume
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-2xl mx-auto grid md:grid-cols-2 gap-3">
                      {/* Upload Resume Card */}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="relative"
                      >
                        <label htmlFor="resume-upload-wizard" className="cursor-pointer">
                          <input
                            id="resume-upload-wizard"
                            type="file"
                            accept=".txt,.pdf,.jpg,.jpeg,.png,.webp"
                            onChange={handleFileUpload}
                            className="sr-only"
                          />
                          <div className="p-5 rounded-lg border hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all text-center space-y-3 bg-white dark:bg-gray-900">
                            <div className="inline-flex p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-base mb-1">Upload Resume</h3>
                              <p className="text-xs text-muted-foreground">
                                Select or drag your file
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                PDF, TXT, or Image
                              </p>
                            </div>
                          </div>
                        </label>
                      </motion.div>

                      {/* Pro AI Interview Card */}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setShowVoiceBuilder(true)}
                        className="relative p-5 rounded-lg border hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all cursor-pointer text-center space-y-3 bg-white dark:bg-gray-900"
                      >
                        <div className="inline-flex p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                          <UserCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="absolute top-3 right-3">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-600 text-white font-medium">
                            PRO
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-base mb-1">Pro AI Interview</h3>
                          <p className="text-xs text-muted-foreground">
                            Build resume via conversation
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            5 minutes
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Skip option for users with existing resume */}
                  {!hasExistingResume && formData.resumeText && (
                    <div className="max-w-lg mx-auto">
                      <Button
                        onClick={() => handleSubmit()}
                        className="w-full"
                        size="lg"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Starting Search...
                          </>
                        ) : (
                          "Search Jobs"
                        )}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer with navigation */}
          <div className="px-8 py-4 border-t">
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
                className={cn(
                  "transition-opacity",
                  currentStep === 1 && "opacity-0 pointer-events-none"
                )}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {currentStep < 4 && (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {currentStep === 4 && !formData.resumeText && !hasExistingResume && (
                <Button
                  variant="ghost"
                  onClick={() => handleSubmit()}
                >
                  Skip for now
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voice Resume Builder Modal */}
      {showVoiceBuilder && (
        <VoiceResumeBuilder 
          isOpen={showVoiceBuilder}
          onClose={() => setShowVoiceBuilder(false)}
          onUploadClick={() => {
            setShowVoiceBuilder(false);
            document.getElementById('resume-upload-wizard')?.click();
          }}
          onResumeGenerated={handleVoiceResumeComplete}
        />
      )}
    </>
  );
}