import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Upload, 
  Mic, 
  FileText, 
  Check,
  Edit,
  Loader2,
  ChevronRight,
  UserCircle,
  BriefcaseIcon
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { VoiceResumeBuilder } from "@/components/voice-resume-builder";
import { cn } from "@/lib/utils";

interface ResumeSectionProps {
  onResumeUploaded?: (resumeText: string, fileName: string) => void;
  className?: string;
}

export function ResumeSection({ onResumeUploaded, className }: ResumeSectionProps) {
  const [hasResume, setHasResume] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showVoiceBuilder, setShowVoiceBuilder] = useState(false);
  const [resumeFileName, setResumeFileName] = useState<string>("");
  const { toast } = useToast();

  // Check for existing resume on mount
  useEffect(() => {
    checkResumeStatus();
  }, []);

  const checkResumeStatus = async () => {
    try {
      const response = await fetch('/api/user/resume', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setHasResume(data.hasResume);
        setResumeFileName(data.fileName || 'Saved Resume');
      }
    } catch (error) {
      console.error("Error checking resume status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
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

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      
      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload resume');
      }
      
      const result = await response.json();
      
      toast({
        title: "Resume uploaded successfully!",
        description: "Your resume is now ready for job applications",
      });
      
      setHasResume(true);
      setResumeFileName(file.name);
      
      if (onResumeUploaded && result.text) {
        onResumeUploaded(result.text, file.name);
      }
    } catch (error) {
      console.error("Error uploading resume:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload your resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVoiceResumeGenerated = async (resumeText: string) => {
    setShowVoiceBuilder(false);
    setHasResume(true);
    setResumeFileName('AI Generated Resume');
    
    // Refresh resume status
    await checkResumeStatus();
    
    toast({
      title: "Resume created successfully!",
      description: "Your AI-generated resume is now ready to use",
    });
    
    if (onResumeUploaded) {
      onResumeUploaded(resumeText, 'AI Generated Resume');
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn("glass-card p-6 flex items-center justify-center", className)}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </motion.div>
    );
  }

  // Minimal view for users with existing resume
  if (hasResume) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("glass-card p-3 border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-indigo-500/5", className)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Check className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Resume Ready
              </p>
              <p className="text-xs text-muted-foreground">
                {resumeFileName}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/settings'}
            className="text-xs hover:bg-blue-500/10"
          >
            <Edit className="h-3 w-3 mr-1" />
            Update
          </Button>
        </div>
      </motion.div>
    );
  }

  // Prominent view for users without resume
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("space-y-3", className)}
      >
        {/* Header Section - More compact */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Resume Required
          </h2>
          <p className="text-sm text-muted-foreground">
            Select your preferred method to add your resume
          </p>
        </div>

        {/* Options Grid - Compact */}
        <div className="grid md:grid-cols-2 gap-3">
          {/* Upload Resume Option */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Card className="p-4 cursor-pointer hover:shadow-md transition-all border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 group">
              <label htmlFor="resume-upload" className="cursor-pointer">
                <input
                  id="resume-upload"
                  type="file"
                  accept=".txt,.pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileUpload}
                  className="sr-only"
                  disabled={isUploading}
                />
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 group-hover:from-blue-100 group-hover:to-indigo-100 dark:group-hover:from-blue-900/30 dark:group-hover:to-indigo-900/30 transition-colors">
                    <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  
                  <div>
                    <h3 className="text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">Upload Resume</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Upload your existing resume file
                    </p>
                    <div className="flex gap-1.5 justify-center text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">PDF</span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">TXT</span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Image</span>
                    </div>
                  </div>

                  <Button 
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Select File
                      </>
                    )}
                  </Button>
                </div>
              </label>
            </Card>
          </motion.div>

          {/* Pro AI Interview Option */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Card 
              className="p-4 cursor-pointer hover:shadow-md transition-all border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 group relative"
              onClick={() => setShowVoiceBuilder(true)}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 group-hover:from-indigo-100 group-hover:to-blue-100 dark:group-hover:from-indigo-900/30 dark:group-hover:to-blue-900/30 transition-colors">
                    <UserCircle className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="absolute -right-1 -top-1">
                    <div className="px-1 py-0.5 rounded text-xs bg-indigo-600 text-white font-medium">
                      PRO
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">Pro AI Interview</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Build your resume through AI conversation
                  </p>
                  <div className="flex gap-1.5 justify-center text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">Premium</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">5 min</span>
                  </div>
                </div>

                <Button 
                  size="sm"
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white transition-all"
                >
                  <Mic className="h-3.5 w-3.5 mr-1.5" />
                  Start Interview
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Compact Footer Text */}
        <p className="text-center text-xs text-muted-foreground mt-2">
          A resume is required to proceed with job applications
        </p>
      </motion.div>

      {/* Voice Resume Builder Modal */}
      <VoiceResumeBuilder 
        isOpen={showVoiceBuilder}
        onClose={() => setShowVoiceBuilder(false)}
        onUploadClick={() => {
          setShowVoiceBuilder(false);
          document.getElementById('resume-upload')?.click();
        }}
        onResumeGenerated={handleVoiceResumeGenerated}
      />
    </>
  );
}