import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon, User as UserIcon, Bell, Shield, Globe, Save, FileText, Upload, Mic, Eye, Download, Maximize2, Printer, ZoomIn, ZoomOut, RefreshCw, Calendar, FileType, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { VoiceResumeBuilder } from "@/components/voice-resume-builder";
import { ResumeViewer } from "@/components/resume-viewer";
import type { StructuredResume } from "@shared/types/resume";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [showVoiceResumeBuilder, setShowVoiceResumeBuilder] = useState(false);
  const [showResumeViewer, setShowResumeViewer] = useState(false);
  const [resumeTheme, setResumeTheme] = useState<'classic' | 'modern' | 'minimal'>('modern');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resumeMetadata, setResumeMetadata] = useState<{
    uploadedDate?: string;
    fileType?: string;
    lastModified?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeViewerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  if (!user) return null;

  // Type assertion for proper typing
  const typedUser = user as User;
  
  // Fetch structured resume data
  const { data: structuredResumeData, isLoading: isLoadingResume, error: resumeError } = useQuery({
    queryKey: ['/api/resume/structured'],
    queryFn: () => apiRequest('/api/resume/structured'),
    enabled: !!typedUser.resumeText,
    retry: 2
  });

  // Update metadata when resume changes
  useEffect(() => {
    if (typedUser.resumeText) {
      setResumeMetadata({
        uploadedDate: typedUser.resumeUploadedAt || new Date().toISOString(),
        fileType: typedUser.resumeFileType || 'text/plain',
        lastModified: typedUser.resumeUpdatedAt || new Date().toISOString()
      });
    }
  }, [typedUser.resumeText]);

  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('resume', file);
      
      const endpoint = '/api/resume/upload';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload resume');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Resume updated",
        description: "Your resume has been successfully updated",
      });
      // Invalidate both user and resume queries to clear cache
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/resume'] });
      setIsUploadingResume(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload resume. Please try again.",
        variant: "destructive",
      });
      setIsUploadingResume(false);
    }
  });

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['text/plain', 'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .txt, .pdf, .jpg, .jpeg, .png, or .webp file",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingResume(true);
    
    // All file types go through the same endpoint
    uploadResumeMutation.mutate(file);
  };

  const handleVoiceResumeGenerated = async (resumeText: string) => {
    // Resume has already been saved by the API, just refresh the user data
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/resume'] });
    queryClient.invalidateQueries({ queryKey: ['/api/resume/structured'] });
    setShowVoiceResumeBuilder(false);
    
    toast({
      title: "Resume created successfully!",
      description: "Your AI-generated resume is now ready to use",
    });
  };

  const handleDownloadPDF = async () => {
    if (!structuredResumeData?.structuredResume) return;
    
    try {
      const response = await fetch('/api/resume/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          structuredResume: structuredResumeData.structuredResume,
          theme: resumeTheme
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Resume downloaded",
        description: "Your professional resume PDF has been downloaded",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download resume PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    if (!structuredResumeData?.structuredResume) return;
    
    const printWindow = window.open('', 'PRINT', 'height=800,width=600');
    
    if (printWindow) {
      printWindow.document.write('<html><head><title>Resume Print</title>');
      printWindow.document.write(`
        <style>
          @media print {
            body { margin: 0; padding: 10mm; font-family: system-ui, -apple-system, sans-serif; }
            .no-print { display: none !important; }
            @page { margin: 10mm; }
          }
          body { font-size: 14px; line-height: 1.6; color: #000; }
          h1 { font-size: 24px; margin: 0 0 10px; }
          h2 { font-size: 18px; margin: 20px 0 10px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          h3 { font-size: 16px; margin: 10px 0 5px; }
          .header { margin-bottom: 20px; }
          .contact { display: flex; flex-wrap: wrap; gap: 15px; font-size: 12px; margin-top: 10px; }
          .section { margin-bottom: 20px; }
          .experience-item, .education-item { margin-bottom: 15px; }
          .skills { display: flex; flex-wrap: wrap; gap: 8px; }
          .skill-tag { background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        </style>
      `);
      printWindow.document.write('</head><body>');
      
      // Get the resume content from the ResumeViewer component
      const resumeContent = resumeViewerRef.current?.innerHTML || '';
      printWindow.document.write(resumeContent);
      
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        toast({
          title: "Print dialog opened",
          description: "Your resume is ready to print",
        });
      }, 250);
    }
  };

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    toast({
      title: `Zoom: ${newZoom}%`,
      description: "Resume zoom level updated",
    });
  };

  const handleFullscreen = () => {
    setIsFullscreen(true);
  };

  const handleRetryUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully",
    });
  };

  return (
    <DashboardLayout 
      user={user} 
      onLogout={() => window.location.href = "/api/auth/logout"} 
      title="Settings"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="glass-card p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">Settings</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Manage your account and application preferences
              </p>
            </div>
            <SettingsIcon className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
          </div>
        </div>

        {/* Profile Settings */}
        <Card className="glass-card p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
            <UserIcon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Profile Information
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  defaultValue={typedUser.firstName || ""}
                  className="glass-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  defaultValue={typedUser.lastName || ""}
                  className="glass-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue={typedUser.email || ""}
                className="glass-input"
                disabled
              />
            </div>
          </div>
        </Card>

        {/* Resume Management */}
        <Card className="glass-card p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Resume Management
          </h3>
          
          {!typedUser.resumeText ? (
            // No resume uploaded yet
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm mb-4">
                  No resume uploaded yet. You can upload one or create one with our AI interview.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                  <Button
                    variant="outline"
                    onClick={() => setShowVoiceResumeBuilder(true)}
                    className="flex-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border-purple-500/20"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Create with AI Interview
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingResume}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Resume
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-3">
                  Accepts .txt, .pdf, .jpg, .jpeg, .png, and .webp files. 
                  We use AI to extract text from image resumes.
                </p>
              </div>
            </div>
          ) : (
            // Resume exists - show tabs
            <Tabs defaultValue="view" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="view">View Resume</TabsTrigger>
                <TabsTrigger value="edit">Edit & Upload</TabsTrigger>
              </TabsList>
              
              <TabsContent value="view" className="space-y-4">
                {/* Resume Metadata */}
                {resumeMetadata.uploadedDate && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap gap-4 text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Uploaded: {new Date(resumeMetadata.uploadedDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileType className="h-4 w-4" />
                      <span>Type: {resumeMetadata.fileType?.split('/')[1]?.toUpperCase() || 'TEXT'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      <span>Modified: {new Date(resumeMetadata.lastModified || '').toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                )}

                {isLoadingResume ? (
                  <div className="space-y-4 p-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : resumeError ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center"
                  >
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Error Loading Resume</h3>
                    <p className="text-muted-foreground mb-4">
                      We encountered an error while processing your resume. Please try again.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={handleRetryUpload} variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Upload
                      </Button>
                      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/resume/structured'] })}>
                        Refresh
                      </Button>
                    </div>
                  </motion.div>
                ) : structuredResumeData?.structuredResume ? (
                  <>
                    {/* Controls Bar */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-sm">Theme:</Label>
                        <select
                          value={resumeTheme}
                          onChange={(e) => setResumeTheme(e.target.value as any)}
                          className="px-3 py-1.5 rounded-md border bg-background text-sm"
                        >
                          <option value="modern">✨ Modern</option>
                          <option value="classic">📜 Classic</option>
                          <option value="minimal">⚡ Minimal</option>
                        </select>
                        
                        <div className="flex items-center gap-1 ml-2">
                          <Label className="text-sm">Zoom:</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleZoomChange(Math.max(50, zoomLevel - 25))}
                                  disabled={zoomLevel <= 50}
                                >
                                  <ZoomOut className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Zoom Out</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <select
                            value={zoomLevel}
                            onChange={(e) => handleZoomChange(Number(e.target.value))}
                            className="px-2 py-1 mx-1 rounded-md border bg-background text-sm w-20"
                          >
                            <option value="50">50%</option>
                            <option value="75">75%</option>
                            <option value="100">100%</option>
                            <option value="125">125%</option>
                            <option value="150">150%</option>
                            <option value="200">200%</option>
                          </select>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleZoomChange(Math.min(200, zoomLevel + 25))}
                                  disabled={zoomLevel >= 200}
                                >
                                  <ZoomIn className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Zoom In</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={handleFullscreen}
                                variant="outline"
                                size="sm"
                              >
                                <Maximize2 className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Full Screen</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View in full screen</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={handlePrint}
                                variant="outline"
                                size="sm"
                              >
                                <Printer className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Print</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Print resume</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={handleDownloadPDF}
                                variant="default"
                                size="sm"
                              >
                                <Download className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Download PDF</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download as PDF</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    {/* Resume Viewer with responsive zoom */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="border rounded-lg overflow-auto bg-white"
                      style={{
                        maxHeight: '80vh',
                      }}
                    >
                      <div
                        ref={resumeViewerRef}
                        className="transition-transform duration-300 origin-top-left"
                        style={{
                          transform: `scale(${zoomLevel / 100})`,
                          width: `${100 / (zoomLevel / 100)}%`,
                        }}
                      >
                        <ResumeViewer
                          resume={structuredResumeData.structuredResume}
                          theme={resumeTheme}
                          className="w-full"
                        />
                      </div>
                    </motion.div>
                    
                    {/* Re-upload button in View tab */}
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={handleRetryUpload}
                        className="group"
                      >
                        <Upload className="h-4 w-4 mr-2 group-hover:animate-bounce" />
                        Re-upload Resume
                      </Button>
                    </div>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center"
                  >
                    <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Resume Data Available</h3>
                    <p className="text-muted-foreground mb-4">
                      We couldn't process your resume. Please try uploading again.
                    </p>
                    <Button onClick={handleRetryUpload}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Resume
                    </Button>
                  </motion.div>
                )}
              </TabsContent>
              
              <TabsContent value="edit" className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm mb-3">
                    Your resume is uploaded and ready. You can update it anytime.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingResume}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New Resume
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const text = typedUser.resumeText || "";
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'my-resume.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download as Text
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleResumeUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground mt-3">
                    Upload a new resume to replace the current one.
                  </p>
                  
                  {/* Show plain text preview */}
                  {typedUser.resumeText && (
                    <div className="mt-4">
                      <Label className="text-xs">Current Resume (Plain Text):</Label>
                      <div className="mt-2 p-3 bg-background rounded-md border max-h-64 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {typedUser.resumeText}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </Card>

        {/* Notification Settings */}
        <Card className="glass-card p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Notification Preferences
          </h3>
          <div className="space-y-4">
            <div className="flex items-start md:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-medium">Email Notifications</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Receive updates about your job applications
                </p>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
            <div className="flex items-start md:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-medium">Weekly Summary</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Get a weekly summary of your job search activity
                </p>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
            <div className="flex items-start md:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-medium">New Features</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Be notified about new features and updates
                </p>
              </div>
              <Switch className="flex-shrink-0" />
            </div>
          </div>
        </Card>

        {/* Privacy Settings */}
        <Card className="glass-card p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Privacy & Security
          </h3>
          <div className="space-y-4">
            <div className="flex items-start md:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-medium">Profile Visibility</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Make your profile visible to recruiters
                </p>
              </div>
              <Switch className="flex-shrink-0" />
            </div>
            <div className="flex items-start md:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-medium">Data Sharing</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Share anonymous data to improve our service
                </p>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
          </div>
        </Card>

        {/* Regional Settings */}
        <Card className="glass-card p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Regional Settings
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                className="w-full glass-input"
                defaultValue="en"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                className="w-full glass-input"
                defaultValue="America/New_York"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            className="btn-primary"
            size="lg"
          >
            <Save className="h-5 w-5 mr-2" />
            Save Changes
          </Button>
        </div>
      </motion.div>

      {/* Voice Resume Builder Modal */}
      <VoiceResumeBuilder 
        isOpen={showVoiceResumeBuilder}
        onClose={() => setShowVoiceResumeBuilder(false)}
        onUploadClick={() => {
          setShowVoiceResumeBuilder(false);
          fileInputRef.current?.click();
        }}
        onResumeGenerated={handleVoiceResumeGenerated}
      />

      {/* Fullscreen Resume Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span>Resume Preview</span>
              <div className="flex items-center gap-4">
                <select
                  value={resumeTheme}
                  onChange={(e) => setResumeTheme(e.target.value as any)}
                  className="px-3 py-1.5 rounded-md border bg-background text-sm"
                >
                  <option value="modern">✨ Modern</option>
                  <option value="classic">📜 Classic</option>
                  <option value="minimal">⚡ Minimal</option>
                </select>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleZoomChange(Math.max(50, zoomLevel - 25))}
                    disabled={zoomLevel <= 50}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium w-12 text-center">{zoomLevel}%</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleZoomChange(Math.min(200, zoomLevel + 25))}
                    disabled={zoomLevel >= 200}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleDownloadPDF} variant="default" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto p-4 bg-gray-50" style={{ height: 'calc(100% - 73px)' }}>
            {structuredResumeData?.structuredResume && (
              <div
                className="transition-transform duration-300 origin-top-left mx-auto"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  width: `${100 / (zoomLevel / 100)}%`,
                  maxWidth: '1200px',
                }}
              >
                <ResumeViewer
                  resume={structuredResumeData.structuredResume}
                  theme={resumeTheme}
                  className="w-full shadow-xl"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}