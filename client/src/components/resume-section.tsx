import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Upload, 
  Mic, 
  FileText, 
  Sparkles, 
  Check,
  Edit,
  Loader2,
  ChevronRight,
  Brain
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
        className={cn("glass-card p-4 border-green-500/20 bg-gradient-to-r from-green-500/5 to-emerald-500/5", className)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
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
            className="text-xs hover:bg-white/10"
          >
            <Edit className="h-3 w-3 mr-1" />
            Update Resume
          </Button>
        </div>
      </motion.div>
    );
  }

  // Prominent view for users without resume
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("space-y-4", className)}
      >
        {/* Header Section */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex p-3 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10"
          >
            <Sparkles className="h-8 w-8 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Let's Get Your Resume Ready!
          </h2>
          <p className="text-muted-foreground">
            Choose how you'd like to add your resume for better job matches
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Upload Resume Option */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card className="glass-card p-6 cursor-pointer hover:shadow-xl transition-all hover:border-blue-500/30 group">
              <label htmlFor="resume-upload" className="cursor-pointer">
                <input
                  id="resume-upload"
                  type="file"
                  accept=".txt,.pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileUpload}
                  className="sr-only"
                  disabled={isUploading}
                />
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 group-hover:from-blue-500/20 group-hover:to-cyan-500/20 transition-all">
                      <Upload className="h-10 w-10 text-blue-500" />
                    </div>
                    <motion.div
                      className="absolute -right-1 -top-1"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <FileText className="h-5 w-5 text-blue-400" />
                    </motion.div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Upload Existing Resume</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Have a resume? Upload it in seconds
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center text-xs">
                      <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">PDF</span>
                      <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">TXT</span>
                      <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">Images</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-blue-500 hover:bg-blue-600 group-hover:shadow-lg transition-all"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </div>
              </label>
            </Card>
          </motion.div>

          {/* Voice Builder Option */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card 
              className="glass-card p-6 cursor-pointer hover:shadow-xl transition-all hover:border-purple-500/30 group relative overflow-hidden"
              onClick={() => setShowVoiceBuilder(true)}
            >
              {/* Animated background gradient */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-purple-500/5"
                animate={{ 
                  backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
                }}
                transition={{ duration: 10, repeat: Infinity }}
                style={{ backgroundSize: "200% 200%" }}
              />
              
              <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 group-hover:from-purple-500/20 group-hover:to-pink-500/20 transition-all">
                    <Brain className="h-10 w-10 text-purple-500" />
                  </div>
                  <motion.div
                    className="absolute -right-2 -top-2"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-6 w-6 text-yellow-400" />
                  </motion.div>
                  <motion.div
                    className="absolute -left-1 -bottom-1"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Mic className="h-5 w-5 text-purple-400" />
                  </motion.div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Build with AI Interview</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    No resume? Create one in minutes with our AI
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center text-xs">
                    <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">AI-Powered</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">Voice-Based</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">Quick</span>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 group-hover:shadow-lg transition-all">
                  <Mic className="h-4 w-4 mr-2" />
                  Start AI Interview
                  <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Help Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-sm text-muted-foreground"
        >
          🎯 Having a resume helps us create personalized job applications
        </motion.p>
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