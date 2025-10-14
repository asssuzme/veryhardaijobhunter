import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/useAuth";
import { 
  FileText, Upload, Mic, Eye, Download, Maximize2, Printer, ZoomIn, ZoomOut, 
  Share2, Mail, Copy, CheckCircle, TrendingUp, Award, Target, Sparkles,
  FileJson, FileTextIcon, ChevronRight, BarChart3, Zap, PenTool, Layers,
  Briefcase, Calendar, FileType, Clock, Link, Loader2, AlertCircle,
  RefreshCw, Shield, Settings, Plus, Trash2, Edit3, Check, X, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ResumeUpload } from "@/components/resume-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TemplateType = 'modern' | 'classic' | 'minimal' | 'ats-friendly' | 'creative' | 'executive';

// Map extended template types to the ones supported by ResumeViewer
function mapToViewerTemplate(template: TemplateType): 'modern' | 'classic' | 'minimal' {
  switch (template) {
    case 'ats-friendly':
      return 'classic'; // ATS-friendly maps to classic (clean and professional)
    case 'creative':
      return 'modern'; // Creative maps to modern (with gradients and animations)
    case 'executive':
      return 'minimal'; // Executive maps to minimal (professional and clean)
    case 'modern':
    case 'classic':
    case 'minimal':
      return template; // These are already supported
    default:
      return 'modern'; // Default fallback
  }
}

export default function Resume() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [showVoiceResumeBuilder, setShowVoiceResumeBuilder] = useState(false);
  const [resumeTheme, setResumeTheme] = useState<TemplateType>('modern');
  const [resumeTemplate, setResumeTemplate] = useState<TemplateType>('modern');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExporting, setIsExporting] = useState<'json' | 'docx' | 'pdf' | null>(null);
  const [shareableLink, setShareableLink] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'text' | 'url'>('file');
  const [manualResumeText, setManualResumeText] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeViewerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  if (!user) return null;

  const typedUser = user as User;
  
  // Fetch structured resume data
  const { data: structuredResumeData, isLoading: isLoadingResume, error: resumeError } = useQuery({
    queryKey: ['/api/resume/structured'],
    queryFn: () => apiRequest('/api/resume/structured'),
    enabled: !!typedUser.resumeText,
    retry: 2
  });

  // Fetch resume analytics
  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['/api/resume/analytics'],
    queryFn: () => apiRequest('/api/resume/analytics'),
    enabled: !!typedUser.resumeText,
    retry: 1
  });

  const uploadResumeMutation = useMutation({
    mutationFn: async (data: { file?: File, text?: string, url?: string }) => {
      if (data.file) {
        const formData = new FormData();
        formData.append('resume', data.file);
        
        const response = await fetch('/api/resume/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to upload resume');
        }
        
        return response.json();
      } else if (data.text) {
        // Upload text directly
        const response = await fetch('/api/resume/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ resumeText: data.text }),
          credentials: 'include'
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save resume');
        }
        
        return response.json();
      } else if (data.url) {
        // Fetch resume from URL (future implementation)
        throw new Error('URL import coming soon');
      }
    },
    onSuccess: () => {
      toast({
        title: "✅ Resume uploaded successfully",
        description: "Your resume has been processed and saved",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resume/structured'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resume/analytics'] });
      setIsUploadingResume(false);
      setShowUploadDialog(false);
      setManualResumeText('');
      setResumeUrl('');
      if (typedUser.resumeText) {
        setActiveTab('view');
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Upload failed",
        description: error.message || "Failed to upload resume. Please try again.",
        variant: "destructive",
      });
      setIsUploadingResume(false);
    }
  });

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type - support multiple formats
    const validTypes = [
      'text/plain', 
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/webp'
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "❌ Invalid file type",
        description: "Please upload a .txt, .pdf, .docx, .doc, .jpg, .jpeg, .png, or .webp file",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingResume(true);
    uploadResumeMutation.mutate({ file });
  };

  const handleManualTextSubmit = () => {
    if (!manualResumeText.trim()) {
      toast({
        title: "❌ No text provided",
        description: "Please paste or type your resume text",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploadingResume(true);
    uploadResumeMutation.mutate({ text: manualResumeText });
  };

  const handleVoiceResumeGenerated = async (resumeText: string) => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    queryClient.invalidateQueries({ queryKey: ['/api/resume/structured'] });
    queryClient.invalidateQueries({ queryKey: ['/api/resume/analytics'] });
    setShowVoiceResumeBuilder(false);
    setActiveTab('view');
    
    toast({
      title: "🎉 Resume created successfully!",
      description: "Your AI-generated resume is now ready to use",
    });
  };

  const handleDownloadPDF = async () => {
    if (!structuredResumeData?.structuredResume) return;
    
    setIsExporting('pdf');
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
      a.download = `resume-${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "✅ Resume downloaded",
        description: "Your professional resume PDF has been saved",
      });
    } catch (error) {
      toast({
        title: "❌ Download failed",
        description: "Failed to download resume PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportJSON = async () => {
    if (!structuredResumeData?.structuredResume) return;
    
    setIsExporting('json');
    try {
      const blob = new Blob([JSON.stringify(structuredResumeData.structuredResume, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "✅ JSON exported",
        description: "Your resume has been exported as JSON format",
      });
    } catch (error) {
      toast({
        title: "❌ Export failed",
        description: "Failed to export resume as JSON. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportDocx = async () => {
    if (!structuredResumeData?.structuredResume) return;
    
    setIsExporting('docx');
    try {
      const response = await fetch(`/api/resume/export/docx?theme=${resumeTheme}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to export DOCX');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-${new Date().toISOString().slice(0,10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "✅ Word document exported",
        description: "Your resume has been exported as DOCX format",
      });
    } catch (error) {
      toast({
        title: "❌ Export failed",
        description: "Failed to export resume as DOCX. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleCopyShareLink = async () => {
    const link = `${window.location.origin}/shared/resume/${typedUser.id}`;
    setShareableLink(link);
    
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "✅ Link copied",
        description: "Resume link has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "❌ Copy failed",
        description: "Failed to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEmailResume = () => {
    const subject = encodeURIComponent(`Resume - ${typedUser.firstName} ${typedUser.lastName}`);
    const body = encodeURIComponent(`Please find my resume attached.\n\nBest regards,\n${typedUser.firstName}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    
    toast({
      title: "📧 Email client opened",
      description: "Please attach your downloaded resume to the email",
    });
  };

  const handlePrint = () => {
    window.print();
    toast({
      title: "🖨️ Print dialog opened",
      description: "Your resume is ready to print",
    });
  };

  return (
    <DashboardLayout 
      user={user} 
      onLogout={() => window.location.href = "/api/auth/logout"} 
      title="Resume Manager"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Resume Manager
              </h1>
              <p className="text-muted-foreground">
                Create, upload, and manage your professional resume
              </p>
            </div>
            {typedUser.resumeText && (
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Resume Active
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="view" disabled={!typedUser.resumeText}>View</TabsTrigger>
            <TabsTrigger value="analytics" disabled={!typedUser.resumeText}>Analytics</TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create Your Resume</CardTitle>
                <CardDescription>
                  Choose how you want to create your professional resume
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Interview Option */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 border rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 transition-all cursor-pointer"
                  onClick={() => setShowVoiceResumeBuilder(true)}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-full">
                      <Mic className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1 flex items-center gap-2">
                        AI Interview Resume Builder
                        <Badge variant="secondary">Pro</Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Have a conversation with our AI interviewer. Answer 14 tailored questions
                        and get a professionally formatted resume in minutes.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">🎤 Voice-based</Badge>
                        <Badge variant="outline">🤖 AI-powered</Badge>
                        <Badge variant="outline">⚡ 10-15 minutes</Badge>
                        <Badge variant="outline">✨ Enhanced quality</Badge>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Manual Entry Option */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-6 border rounded-lg hover:bg-muted/50 transition-all cursor-pointer"
                  onClick={() => {
                    setUploadMethod('text');
                    setShowUploadDialog(true);
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-full">
                      <Edit3 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Manual Entry</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Type or paste your resume content directly. Perfect for quick updates
                        or creating from scratch.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">📝 Direct input</Badge>
                        <Badge variant="outline">⏱️ Instant</Badge>
                        <Badge variant="outline">🔧 Full control</Badge>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Template Builder (Coming Soon) */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-6 border rounded-lg opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-500/20 rounded-full">
                      <Layers className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1 flex items-center gap-2">
                        Template Builder
                        <Badge>Coming Soon</Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Choose from professional templates and fill in your information
                        step by step with guided assistance.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Your Resume</CardTitle>
                <CardDescription>
                  Upload an existing resume in various formats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* File Upload Area */}
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">
                      {isUploadingResume ? "Processing..." : "Click to upload or drag and drop"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supported formats: PDF, DOCX, DOC, TXT, JPG, PNG, WEBP
                    </p>
                    <Button variant="outline" disabled={isUploadingResume}>
                      {isUploadingResume ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Browse Files
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
                    onChange={handleResumeUpload}
                    className="hidden"
                  />

                  {/* File Format Info */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Pro tip:</strong> For best results, upload a well-formatted PDF or DOCX file.
                      We use AI to extract text from images and scanned documents.
                    </AlertDescription>
                  </Alert>

                  {/* Recent Upload Status */}
                  {typedUser.resumeText && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        <strong>Current Resume:</strong> {typedUser.resumeFileName || 'Resume'} 
                        {typedUser.resumeUploadedAt && 
                          ` • Uploaded ${new Date(typedUser.resumeUploadedAt).toLocaleDateString()}`
                        }
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* View Tab */}
          <TabsContent value="view" className="space-y-4">
            {isLoadingResume ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-96 w-full" />
              </div>
            ) : structuredResumeData?.structuredResume ? (
              <>
                {/* Controls Bar */}
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Theme Selector */}
                    <div className="flex items-center gap-4">
                      <Label>Theme:</Label>
                      <Select
                        value={resumeTheme}
                        onValueChange={(value) => setResumeTheme(value as TemplateType)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modern">✨ Modern</SelectItem>
                          <SelectItem value="classic">📜 Classic</SelectItem>
                          <SelectItem value="minimal">⚡ Minimal</SelectItem>
                          <SelectItem value="ats-friendly">🤖 ATS-Friendly</SelectItem>
                          <SelectItem value="creative">🎨 Creative</SelectItem>
                          <SelectItem value="executive">💼 Executive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
                        disabled={zoomLevel <= 50}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium w-12 text-center">{zoomLevel}%</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                        disabled={zoomLevel >= 200}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {/* Export Options */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2">
                          <div className="space-y-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={handleDownloadPDF}
                              disabled={isExporting === 'pdf'}
                            >
                              {isExporting === 'pdf' ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4 mr-2" />
                              )}
                              PDF Document
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={handleExportDocx}
                              disabled={isExporting === 'docx'}
                            >
                              {isExporting === 'docx' ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileTextIcon className="h-4 w-4 mr-2" />
                              )}
                              Word Document
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={handleExportJSON}
                              disabled={isExporting === 'json'}
                            >
                              {isExporting === 'json' ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileJson className="h-4 w-4 mr-2" />
                              )}
                              JSON Data
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Share Options */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline">
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2">
                          <div className="space-y-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={handleCopyShareLink}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={handleEmailResume}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Email Resume
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button variant="outline" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                      </Button>

                      <Button variant="outline" onClick={() => setIsFullscreen(true)}>
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Fullscreen
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Resume Preview */}
                <Card className="overflow-hidden">
                  <div
                    className="bg-white overflow-auto"
                    style={{ maxHeight: '80vh' }}
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
                        theme={mapToViewerTemplate(resumeTheme)}
                        className="w-full"
                      />
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Resume Data</h3>
                <p className="text-muted-foreground mb-4">
                  Upload a resume or create one to view it here
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  Create Resume
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            {isLoadingAnalytics ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : analyticsData ? (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        ATS Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div className="text-2xl font-bold">
                          {analyticsData.atsScore}%
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-500">Good</span>
                        </div>
                      </div>
                      <Progress value={analyticsData.atsScore} className="mt-3" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Completeness
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div className="text-2xl font-bold">
                          {analyticsData.sectionsCompleted}/{analyticsData.sectionsTotal}
                        </div>
                        <div className="flex items-center gap-1">
                          {analyticsData.sectionsCompleted === analyticsData.sectionsTotal ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-xs text-green-500">Complete</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                              <span className="text-xs text-yellow-500">Incomplete</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Progress 
                        value={(analyticsData.sectionsCompleted / analyticsData.sectionsTotal) * 100} 
                        className="mt-3" 
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Word Count
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div className="text-2xl font-bold">
                          {analyticsData.wordCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-muted-foreground">
                            {analyticsData.fileSizeFormatted}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Optimal range: 400-800 words
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Section Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Section Analysis</CardTitle>
                    <CardDescription>
                      Detailed breakdown of your resume sections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.sections?.map((section: any) => (
                        <div key={section.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {section.isComplete ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-yellow-500" />
                            )}
                            <span className="font-medium">{section.name}</span>
                          </div>
                          <Badge variant={section.isComplete ? "default" : "secondary"}>
                            {section.isComplete ? "Complete" : "Missing"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* ATS Keywords */}
                <Card>
                  <CardHeader>
                    <CardTitle>ATS Keywords Analysis</CardTitle>
                    <CardDescription>
                      Key terms that improve your resume's visibility
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>
                          Your resume contains <strong>{analyticsData.keywordCount || 0}</strong> industry-relevant keywords.
                          Consider adding more technical skills and action verbs to improve ATS compatibility.
                        </AlertDescription>
                      </Alert>
                      
                      <div className="flex flex-wrap gap-2">
                        {analyticsData.topKeywords?.map((keyword: string) => (
                          <Badge key={keyword} variant="outline">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Improvement Recommendations</CardTitle>
                    <CardDescription>
                      Suggestions to enhance your resume
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.recommendations?.map((rec: string, index: number) => (
                        <div key={index} className="flex items-start gap-3">
                          <Target className="h-5 w-5 text-primary mt-0.5" />
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Analytics Available</h3>
                <p className="text-muted-foreground">
                  Analytics will appear once you have a resume
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
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

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Resume Content</DialogTitle>
            <DialogDescription>
              Paste or type your resume content below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Paste your resume content here..."
              value={manualResumeText}
              onChange={(e) => setManualResumeText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowUploadDialog(false);
                setManualResumeText('');
              }}>
                Cancel
              </Button>
              <Button onClick={handleManualTextSubmit} disabled={!manualResumeText.trim()}>
                Save Resume
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Resume Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span>Resume Preview</span>
              <div className="flex items-center gap-4">
                <Select
                  value={resumeTheme}
                  onValueChange={(value) => setResumeTheme(value as TemplateType)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">✨ Modern</SelectItem>
                    <SelectItem value="classic">📜 Classic</SelectItem>
                    <SelectItem value="minimal">⚡ Minimal</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium w-12 text-center">{zoomLevel}%</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={handleDownloadPDF}>
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
                  theme={mapToViewerTemplate(resumeTheme)}
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