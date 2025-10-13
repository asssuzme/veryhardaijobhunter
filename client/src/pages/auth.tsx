import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { 
  Search, MapPin, Building2, Clock, DollarSign, Bookmark, MoreHorizontal, 
  ThumbsUp, MessageSquare, Send as SendIcon, X, Home, Users, BriefcaseIcon,
  Bell, ChevronDown, Plus, Filter, TrendingUp, Eye, Terminal,
  Star, ArrowUp, ArrowDown, Mail, BarChart3, Activity, PieChart,
  Calendar, Target, Award, CheckCircle2, Paperclip, Image, Smile,
  Bold, Italic, Underline, Link2, MoreVertical, Settings, HelpCircle,
  Grid3X3, Archive, Trash2, Tag, Clock3, Zap, Shield, Globe,
  UserCheck, FileText, RefreshCw, Hash, AlertCircle, CheckCircle,
  ArrowUpRight, ArrowDownRight, Briefcase, Share2, ExternalLink,
  Maximize2, Minimize2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar, Sector } from 'recharts';
import { cn } from '../lib/utils';

// Type definitions
type TerminalCommand = {
  type: 'command' | 'output' | 'success' | 'error' | 'info' | 'progress';
  text: string;
  delay?: number;
  progress?: number;
  animate?: boolean;
};

type JobCard = {
  company: string;
  logo: string;
  title: string;
  location: string;
  salary: string;
  posted: string;
  applicants: number;
  views: number;
  remote: string;
  type: string;
  match: number;
  skills: string[];
  promoted?: boolean;
  activelyRecruiting?: boolean;
  description: string;
  benefits: string[];
  companySize: string;
  email?: string;
  isProcessing?: boolean;
  emailSent?: boolean;
};

// Custom hook for animated numbers
function useAnimatedNumber(targetValue: number, duration: number = 2000) {
  const [value, setValue] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const startValue = value;
    const difference = targetValue - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + difference * easedProgress;
      
      setValue(Math.floor(currentValue));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [targetValue, duration]);
  
  return value;
}

// Custom hook for typewriter effect with variable speed
function useTypewriter(text: string, speed: number = 30, enabled: boolean = true) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (!enabled) {
      setDisplayText('');
      setCurrentIndex(0);
      return;
    }
    
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed + Math.random() * 20); // Variable speed for realism
      
      return () => clearTimeout(timeout);
    }
  }, [text, currentIndex, speed, enabled]);
  
  return displayText;
}

export default function AuthPage() {
  const [animationStep, setAnimationStep] = useState(0);
  const [terminalCommands, setTerminalCommands] = useState<TerminalCommand[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [emailTyping, setEmailTyping] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [selectedJobIndex, setSelectedJobIndex] = useState(0);
  const [showCharts, setShowCharts] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Animated metrics with spring physics
  const jobsFound = useAnimatedNumber(animationStep >= 1 ? 847 : 0, 3000);
  const emailsSent = useAnimatedNumber(animationStep >= 2 ? 623 : 0, 2500);
  const responseRate = useAnimatedNumber(animationStep >= 3 ? 18 : 0, 2000);
  const interviews = useAnimatedNumber(animationStep >= 3 ? 12 : 0, 1800);
  
  // Initial job data
  const initialJobs: JobCard[] = useMemo(() => [
    { 
      company: 'Stripe', 
      logo: '🟦',
      title: 'Senior Software Engineer, Infrastructure',
      location: 'San Francisco, CA',
      salary: '$180,000 - $260,000',
      posted: '2 hours ago',
      applicants: 98,
      views: 1243,
      remote: 'Remote',
      type: 'Full-time',
      match: 98,
      skills: ['React', 'Node.js', 'AWS', 'Kubernetes', 'TypeScript'],
      promoted: true,
      activelyRecruiting: true,
      description: 'Build the financial infrastructure that powers internet businesses worldwide.',
      benefits: ['Health insurance', '401(k)', 'Unlimited PTO'],
      companySize: '5,000-10,000',
      email: 'hiring@stripe.com'
    },
    {
      company: 'Linear',
      logo: '◈',
      title: 'Staff Engineer, Product Infrastructure',
      location: 'San Francisco, CA',
      salary: '$220,000 - $300,000',
      posted: '3 hours ago',
      applicants: 156,
      views: 2341,
      remote: 'Remote',
      type: 'Full-time',
      match: 95,
      skills: ['TypeScript', 'GraphQL', 'PostgreSQL', 'React', 'Node.js'],
      activelyRecruiting: true,
      description: 'Shape the future of modern software development tools.',
      benefits: ['Equity', 'Health insurance', 'Remote work'],
      companySize: '50-200',
      email: 'careers@linear.app'
    },
    {
      company: 'Notion',
      logo: '⬜',
      title: 'Principal Engineer, Core Platform',
      location: 'San Francisco, CA',
      salary: '$280,000 - $350,000',
      posted: '1 day ago',
      applicants: 243,
      views: 4567,
      remote: 'Hybrid',
      type: 'Full-time',
      match: 92,
      skills: ['React', 'Electron', 'SQLite', 'TypeScript', 'WebAssembly'],
      description: 'Build the blocks that power millions of workflows.',
      benefits: ['Unlimited PTO', 'Health insurance', 'Learning budget'],
      companySize: '200-500',
      email: 'talent@notion.so'
    },
    {
      company: 'Vercel',
      logo: '▲',
      title: 'Lead Engineer, Edge Platform',
      location: 'Remote',
      salary: '$200,000 - $280,000',
      posted: '2 days ago',
      applicants: 312,
      views: 5432,
      remote: 'Remote',
      type: 'Full-time',
      match: 89,
      skills: ['Next.js', 'Edge Functions', 'CDN', 'TypeScript', 'Go'],
      description: 'Develop the future of web deployment.',
      benefits: ['Stock options', 'Health insurance', 'WFH stipend'],
      companySize: '100-500',
      email: 'jobs@vercel.com'
    }
  ], []);
  
  useEffect(() => {
    setJobCards(initialJobs);
  }, [initialJobs]);
  
  // Chart data for analytics
  const chartData = useMemo(() => {
    if (!showCharts) return [];
    
    return [
      { name: 'Mon', applications: 89, emails: 67, responses: 12 },
      { name: 'Tue', applications: 124, emails: 98, responses: 18 },
      { name: 'Wed', applications: 156, emails: 134, responses: 24 },
      { name: 'Thu', applications: 189, emails: 156, responses: 31 },
      { name: 'Fri', applications: 234, emails: 198, responses: 42 },
      { name: 'Sat', applications: 289, emails: 245, responses: 56 },
      { name: 'Sun', applications: 347, emails: 312, responses: 68 }
    ];
  }, [showCharts]);
  
  const pieData = [
    { name: 'Responded', value: 18, color: '#10b981' },
    { name: 'Pending', value: 62, color: '#3b82f6' },
    { name: 'No Response', value: 20, color: '#6b7280' }
  ];
  
  const skillMatchData = [
    { name: 'Technical Skills', value: 95, fill: '#8b5cf6' },
    { name: 'Experience', value: 88, fill: '#3b82f6' },
    { name: 'Education', value: 92, fill: '#10b981' }
  ];
  
  // Email template with realistic formatting
  const emailTemplate = `Hi ${jobCards[selectedJobIndex]?.company || 'Hiring'} Team,

I discovered your ${jobCards[selectedJobIndex]?.title || 'position'} on LinkedIn and I'm genuinely excited about the opportunity.

With 5+ years building scalable systems at Google, I've led projects that:
• Reduced infrastructure costs by 40% while improving performance
• Built microservices handling 100K+ requests per second
• Mentored teams through complex technical migrations

Your focus on ${jobCards[selectedJobIndex]?.company === 'Stripe' ? 'financial infrastructure' : 
  jobCards[selectedJobIndex]?.company === 'Linear' ? 'developer tools' :
  jobCards[selectedJobIndex]?.company === 'Notion' ? 'productivity platforms' : 'edge computing'} 
aligns perfectly with my expertise in distributed systems and ${jobCards[selectedJobIndex]?.skills?.[0] || 'modern tech'}.

I'd love to discuss how my background in ${jobCards[selectedJobIndex]?.skills?.slice(0, 2).join(' and ') || 'relevant technologies'} 
could contribute to your team's success.

Best regards,
Sarah Chen
linkedin.com/in/sarahchen`;
  
  // Realistic terminal commands sequence
  const terminalSequence: TerminalCommand[] = [
    { type: 'command', text: '$ ai-jobhunter scan --platform linkedin --role "Software Engineer" --location "San Francisco"', delay: 100 },
    { type: 'info', text: '→ Initializing LinkedIn scraper...', delay: 500 },
    { type: 'output', text: '→ Authenticating session...', delay: 300 },
    { type: 'success', text: '✓ Session authenticated', delay: 200 },
    { type: 'output', text: '→ Searching for jobs matching criteria...', delay: 400 },
    { type: 'progress', text: 'Scanning job listings', progress: 0, animate: true },
    { type: 'info', text: `✓ Found ${jobsFound} matching positions`, delay: 300 },
    { type: 'command', text: '$ ai-jobhunter extract --emails --verify', delay: 500 },
    { type: 'output', text: '→ Extracting company contact information...', delay: 400 },
    { type: 'progress', text: 'Verifying email addresses', progress: 0, animate: true },
    { type: 'success', text: '✓ Extracted 623 valid email addresses', delay: 300 },
    { type: 'command', text: '$ ai-jobhunter compose --personalized --attach-resume', delay: 500 },
    { type: 'info', text: '→ Generating personalized emails with AI...', delay: 400 },
    { type: 'output', text: '→ Analyzing job requirements...', delay: 300 },
    { type: 'output', text: '→ Matching skills and experience...', delay: 300 },
    { type: 'progress', text: 'Composing personalized emails', progress: 0, animate: true },
    { type: 'success', text: '✓ Generated 623 personalized emails', delay: 300 },
    { type: 'command', text: '$ ai-jobhunter send --batch 50 --delay 30s', delay: 500 },
    { type: 'info', text: '→ Sending emails via Gmail API...', delay: 400 },
    { type: 'progress', text: 'Sending batch', progress: 0, animate: true },
    { type: 'success', text: '✓ All emails sent successfully', delay: 300 },
    { type: 'info', text: '→ Tracking engagement metrics...', delay: 400 },
    { type: 'success', text: `✓ Current response rate: ${responseRate}%`, delay: 300 },
    { type: 'success', text: `✓ Interview requests: ${interviews}`, delay: 300 }
  ];
  
  // Animation cycle management with sophisticated transitions
  useEffect(() => {
    const totalSteps = 4;
    const stepDuration = 10000; // 10 seconds per step
    
    const interval = setInterval(() => {
      setAnimationStep((prev) => {
        const nextStep = (prev + 1) % totalSteps;
        
        // Reset states for new cycle
        if (nextStep === 0) {
          setTerminalCommands([]);
          setJobCards(initialJobs);
          setEmailTyping(false);
          setCurrentProgress(0);
          setShowCharts(false);
        }
        
        return nextStep;
      });
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, [initialJobs]);
  
  // LinkedIn job feed animation
  useEffect(() => {
    if (animationStep === 0) {
      // Animate job cards appearing with stagger
      jobCards.forEach((job, index) => {
        setTimeout(() => {
          setJobCards(prev => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index].isProcessing = false;
            }
            return updated;
          });
        }, index * 300);
      });
    }
  }, [animationStep, jobCards]);
  
  // Terminal animation with realistic typing
  useEffect(() => {
    if (animationStep === 1) {
      setTerminalCommands([]);
      let commandIndex = 0;
      
      const addCommand = () => {
        if (commandIndex < terminalSequence.length) {
          const command = terminalSequence[commandIndex];
          
          setTimeout(() => {
            setTerminalCommands(prev => [...prev, command]);
            
            // Handle progress bars
            if (command.animate && command.progress !== undefined) {
              let progress = 0;
              const progressInterval = setInterval(() => {
                progress += 2;
                setCurrentProgress(progress);
                
                if (progress >= 100) {
                  clearInterval(progressInterval);
                  setCurrentProgress(0);
                }
              }, 30);
            }
            
            // Auto-scroll terminal
            if (terminalRef.current) {
              terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }
            
            commandIndex++;
            addCommand();
          }, command.delay || 100);
        }
      };
      
      addCommand();
    }
  }, [animationStep]);
  
  // Email composition animation
  useEffect(() => {
    if (animationStep === 2) {
      setEmailTyping(true);
      
      // Simulate selecting and processing jobs
      const processJobs = async () => {
        for (let i = 0; i < jobCards.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          setSelectedJobIndex(i);
          setJobCards(prev => {
            const updated = [...prev];
            updated[i].isProcessing = true;
            return updated;
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          setJobCards(prev => {
            const updated = [...prev];
            updated[i].isProcessing = false;
            updated[i].emailSent = true;
            return updated;
          });
        }
      };
      
      processJobs();
    }
  }, [animationStep, jobCards.length]);
  
  // Analytics dashboard animation
  useEffect(() => {
    if (animationStep === 3) {
      setShowCharts(true);
    }
  }, [animationStep]);
  
  // Parallax mouse effect for depth
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  
  const rotateX = useTransform(mouseY, [-300, 300], [5, -5]);
  const rotateY = useTransform(mouseX, [-300, 300], [-5, 5]);
  
  const springConfig = { stiffness: 150, damping: 20 };
  const rotateXSpring = useSpring(rotateX, springConfig);
  const rotateYSpring = useSpring(rotateY, springConfig);
  
  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Left Panel - Keep Original */}
      <div className="w-1/2 p-8 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10" />
        
        <div className="max-w-md w-full relative z-10">
          <h1 className="text-5xl font-bold mb-2">
            Get hired faster <span className="bg-gradient-to-r from-blue-400 to-purple-600 text-transparent bg-clip-text">effortlessly</span>
          </h1>
          <h2 className="text-4xl font-bold mb-6">with AI JobHunter</h2>
          
          <p className="text-gray-400 mb-8">
            Create a free account to discover ai-jobhunter.com's best marketing channels.
          </p>
          
          <Button
            className="w-full bg-white text-black hover:bg-gray-100 py-6 text-lg font-medium rounded-lg flex items-center justify-center gap-3"
            onClick={() => window.location.href = '/api/auth/google'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </Button>
          
          <p className="text-center mt-6 text-sm text-gray-500">
            By signing up, you agree to our Terms of Service
          </p>
          
          <p className="text-center mt-4 text-sm text-gray-500">
            Need help?
          </p>
        </div>
      </div>
      
      {/* Right Panel - Hyper-Realistic Animation */}
      <div 
        className="w-1/2 relative overflow-hidden bg-black"
        onMouseMove={handleMouseMove}
      >
        {/* Gradient overlay matching left panel */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 pointer-events-none" />
        <AnimatePresence mode="wait">
          {/* Step 1: LinkedIn Job Search */}
          {animationStep === 0 && (
            <motion.div
              key="linkedin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 p-8"
              style={{
                rotateX: rotateXSpring,
                rotateY: rotateYSpring,
                transformPerspective: 1200,
              }}
            >
              <div className="bg-white rounded-xl shadow-2xl h-full overflow-hidden">
                {/* LinkedIn Header */}
                <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <svg className="w-8 h-8 text-[#0077B5]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                    <div className="flex items-center gap-1">
                      <Home className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-gray-700">Home</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-gray-700">Network</span>
                    </div>
                    <div className="flex items-center gap-1 border-b-2 border-black pb-1">
                      <BriefcaseIcon className="w-5 h-5" />
                      <span className="text-sm font-semibold">Jobs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Bell className="w-5 h-5 text-gray-600" />
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full" />
                  </div>
                </div>
                
                {/* Search Bar */}
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center gap-2 border">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value="Software Engineer"
                        readOnly
                        className="flex-1 text-sm outline-none text-gray-900"
                      />
                    </div>
                    <div className="bg-white rounded-full px-4 py-2 flex items-center gap-2 border">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">San Francisco, CA</span>
                    </div>
                  </div>
                </div>
                
                {/* Job Feed with Animation */}
                <div className="flex h-[calc(100%-140px)]">
                  {/* Sidebar */}
                  <div className="w-64 border-r bg-white p-4">
                    <div className="mb-4">
                      <h3 className="font-semibold text-sm text-gray-900 mb-2">Job Filters</h3>
                      <div className="space-y-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-green-700">Remote opportunities</span>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Date Posted</label>
                          <select className="w-full mt-1 text-sm border rounded px-2 py-1 text-gray-900">
                            <option>Past 24 hours</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Experience Level</label>
                          <div className="mt-1 space-y-1">
                            <label className="flex items-center text-sm text-gray-900">
                              <input type="checkbox" checked readOnly className="mr-2" />
                              Senior (5+ years)
                            </label>
                            <label className="flex items-center text-sm text-gray-900">
                              <input type="checkbox" checked readOnly className="mr-2" />
                              Mid-level (2-5 years)
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Salary Range</label>
                          <select className="w-full mt-1 text-sm border rounded px-2 py-1 text-gray-900">
                            <option>$150k - $300k+</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Job Cards */}
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Jobs recommended for you</h2>
                      <p className="text-sm text-gray-600">Based on your profile and search history</p>
                      <div className="flex items-center gap-2 mt-2">
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-600">Found {jobsFound} jobs matching your skills</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {jobCards.map((job, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ 
                            opacity: job.isProcessing ? 0.6 : 1, 
                            x: 0,
                            scale: job.isProcessing ? 0.98 : 1
                          }}
                          transition={{ 
                            delay: index * 0.1,
                            duration: 0.3
                          }}
                          className={cn(
                            "bg-white rounded-lg border p-4 hover:shadow-lg transition-all cursor-pointer",
                            job.emailSent && "border-green-200 bg-green-50/30",
                            job.isProcessing && "animate-pulse"
                          )}
                        >
                          {/* Job Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded flex items-center justify-center text-white text-xl">
                                {job.logo}
                              </div>
                              <div>
                                <h3 className="font-semibold text-blue-600 hover:underline text-base">
                                  {job.title}
                                </h3>
                                <p className="text-sm text-gray-900">{job.company}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                                  <span>{job.location}</span>
                                  <span>•</span>
                                  <span className="text-green-600 font-medium">{job.remote}</span>
                                  <span>•</span>
                                  <span>{job.posted}</span>
                                </div>
                              </div>
                            </div>
                            <Bookmark className={cn(
                              "w-5 h-5 text-gray-400 hover:text-gray-600",
                              job.emailSent && "text-green-500 fill-green-500"
                            )} />
                          </div>
                          
                          {/* Salary and Match */}
                          <div className="flex items-center gap-4 mb-3">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-gray-900">{job.salary}</span>
                            </div>
                            {job.promoted && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                Promoted
                              </span>
                            )}
                            {job.activelyRecruiting && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                Actively recruiting
                              </span>
                            )}
                          </div>
                          
                          {/* Match Score */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">Match score</span>
                              <span className="text-xs font-bold text-green-600">{job.match}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${job.match}%` }}
                                transition={{ delay: index * 0.2, duration: 1 }}
                                className="h-full bg-gradient-to-r from-green-400 to-green-600"
                              />
                            </div>
                          </div>
                          
                          {/* Stats and Skills */}
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {job.views} views
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {job.applicants} applicants
                              </span>
                            </div>
                            {job.emailSent && (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle className="w-3 h-3" />
                                Email sent
                              </span>
                            )}
                          </div>
                          
                          {/* Skills */}
                          <div className="flex flex-wrap gap-1">
                            {job.skills.slice(0, 4).map((skill, skillIndex) => (
                              <span
                                key={skillIndex}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                              >
                                {skill}
                              </span>
                            ))}
                            {job.skills.length > 4 && (
                              <span className="text-xs text-gray-500">+{job.skills.length - 4}</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Step 2: Terminal CLI */}
          {animationStep === 1 && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 p-8 flex items-center justify-center"
            >
              <div className="w-full max-w-4xl h-[80%] bg-[#1e1e1e] rounded-lg shadow-2xl overflow-hidden border border-gray-700">
                {/* Terminal Header */}
                <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Terminal className="w-4 h-4" />
                    <span className="text-xs font-mono">ai-jobhunter-cli</span>
                  </div>
                </div>
                
                {/* Terminal Content */}
                <div
                  ref={terminalRef}
                  className="p-4 h-[calc(100%-40px)] overflow-y-auto font-mono text-sm"
                  style={{ fontFamily: 'SF Mono, Monaco, Cascadia Code, monospace' }}
                >
                  {terminalCommands.map((cmd, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="mb-2"
                    >
                      {cmd.type === 'command' && (
                        <div className="flex items-start">
                          <span className="text-green-400 mr-2">➜</span>
                          <TypewriterText text={cmd.text} speed={20} className="text-white" />
                        </div>
                      )}
                      {cmd.type === 'info' && (
                        <div className="text-blue-400 pl-4">{cmd.text}</div>
                      )}
                      {cmd.type === 'output' && (
                        <div className="text-gray-300 pl-4">{cmd.text}</div>
                      )}
                      {cmd.type === 'success' && (
                        <div className="text-green-400 pl-4 font-semibold">{cmd.text}</div>
                      )}
                      {cmd.type === 'error' && (
                        <div className="text-red-400 pl-4">{cmd.text}</div>
                      )}
                      {cmd.type === 'progress' && (
                        <div className="pl-4">
                          <div className="text-gray-300 mb-1">{cmd.text}...</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${currentProgress}%` }}
                              transition={{ duration: 0.1 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{currentProgress}%</div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  
                  {/* Blinking Cursor */}
                  <span className="inline-block w-2 h-4 bg-white animate-pulse" />
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Step 3: Gmail Compose */}
          {animationStep === 2 && (
            <motion.div
              key="gmail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 p-8 flex items-center justify-center"
            >
              <div className="w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden">
                {/* Gmail Header */}
                <div className="bg-white px-4 py-2 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src="https://ssl.gstatic.com/ui/v1/icons/mail/rfr/logo_gmail_lockup_default_1x_r5.png"
                      alt="Gmail"
                      className="h-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <HelpCircle className="w-5 h-5 text-gray-600" />
                    <Grid3X3 className="w-5 h-5 text-gray-600" />
                  </div>
                </div>
                
                {/* Compose Window */}
                <div className="p-4">
                  <div className="bg-white rounded-lg border shadow-lg">
                    {/* Compose Header */}
                    <div className="bg-[#404040] text-white px-4 py-2 rounded-t-lg flex items-center justify-between">
                      <span className="text-sm">New Message</span>
                      <div className="flex items-center gap-2">
                        <Minimize2 className="w-4 h-4" />
                        <Maximize2 className="w-4 h-4" />
                        <X className="w-4 h-4" />
                      </div>
                    </div>
                    
                    {/* Recipients */}
                    <div className="border-b px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-sm">To</span>
                        <div className="flex-1 flex items-center gap-2">
                          {jobCards[selectedJobIndex]?.email && (
                            <span className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-800 flex items-center gap-1">
                              {jobCards[selectedJobIndex].email}
                              <X className="w-3 h-3 text-gray-500" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Subject */}
                    <div className="border-b px-4 py-2">
                      <input
                        type="text"
                        value={`${jobCards[selectedJobIndex]?.title} - Experienced Engineer Interested`}
                        readOnly
                        className="w-full outline-none text-sm text-gray-900"
                        placeholder="Subject"
                      />
                    </div>
                    
                    {/* Email Body */}
                    <div className="p-4 min-h-[300px]">
                      {emailTyping && (
                        <TypewriterText
                          text={emailTemplate}
                          speed={15}
                          className="text-sm text-gray-900 whitespace-pre-wrap"
                        />
                      )}
                    </div>
                    
                    {/* Attachment */}
                    {emailTyping && (
                      <div className="px-4 pb-2">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 3 }}
                          className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded"
                        >
                          <Paperclip className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-700">Sarah_Chen_Resume.pdf</span>
                        </motion.div>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="border-t px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700"
                        >
                          Send
                          <SendIcon className="w-4 h-4" />
                        </motion.button>
                        <div className="flex items-center gap-2 ml-4">
                          <Bold className="w-4 h-4 text-gray-600" />
                          <Italic className="w-4 h-4 text-gray-600" />
                          <Underline className="w-4 h-4 text-gray-600" />
                          <Link2 className="w-4 h-4 text-gray-600" />
                          <Image className="w-4 h-4 text-gray-600" />
                          <Smile className="w-4 h-4 text-gray-600" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-gray-600" />
                        <Trash2 className="w-4 h-4 text-gray-600" />
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Step 4: Analytics Dashboard */}
          {animationStep === 3 && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 p-6"
            >
              <div className="h-full">
                {/* Dashboard Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Campaign Analytics</h2>
                  <p className="text-gray-400">Real-time performance metrics</p>
                </div>
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Briefcase className="w-5 h-5 text-blue-400" />
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {jobsFound}
                    </div>
                    <div className="text-sm text-gray-400">Jobs Found</div>
                    <div className="mt-2 text-xs text-green-400">+12% from yesterday</div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Mail className="w-5 h-5 text-purple-400" />
                      <ArrowUpRight className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {emailsSent}
                    </div>
                    <div className="text-sm text-gray-400">Emails Sent</div>
                    <div className="mt-2 text-xs text-green-400">98% delivered</div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Activity className="w-5 h-5 text-green-400" />
                      <ArrowUpRight className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {responseRate}%
                    </div>
                    <div className="text-sm text-gray-400">Response Rate</div>
                    <div className="mt-2 text-xs text-green-400">Above industry avg</div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Calendar className="w-5 h-5 text-orange-400" />
                      <Star className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {interviews}
                    </div>
                    <div className="text-sm text-gray-400">Interviews</div>
                    <div className="mt-2 text-xs text-yellow-400">3 this week</div>
                  </motion.div>
                </div>
                
                {/* Charts Grid */}
                <div className="grid grid-cols-2 gap-4 h-[calc(100%-280px)]">
                  {/* Activity Chart */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
                  >
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                      Weekly Activity
                    </h3>
                    <ResponsiveContainer width="100%" height="90%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="applications"
                          stroke="#3b82f6"
                          fillOpacity={1}
                          fill="url(#colorApplications)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="emails"
                          stroke="#8b5cf6"
                          fillOpacity={1}
                          fill="url(#colorEmails)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                  
                  {/* Combined Response & Skills Chart */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
                  >
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-purple-400" />
                      Response Distribution & Skill Match
                    </h3>
                    <div className="grid grid-cols-2 gap-4 h-[calc(100%-40px)]">
                      {/* Pie Chart */}
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value}%`}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      
                      {/* Radial Bar Chart */}
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="80%" data={skillMatchData}>
                          <RadialBar
                            background
                            dataKey="value"
                          />
                          <Legend
                            iconSize={10}
                            wrapperStyle={{
                              fontSize: '10px',
                              color: '#9ca3af'
                            }}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Progress Indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          {[0, 1, 2, 3].map((step) => (
            <motion.div
              key={step}
              className={cn(
                "w-2 h-2 rounded-full",
                animationStep === step ? "bg-white" : "bg-white/30"
              )}
              animate={{
                scale: animationStep === step ? 1.5 : 1
              }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper component for typewriter effect
function TypewriterText({ text, speed, className }: { text: string; speed: number; className?: string }) {
  const displayText = useTypewriter(text, speed);
  
  return <span className={className}>{displayText}</span>;
}