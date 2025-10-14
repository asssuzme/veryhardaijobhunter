import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Upload, 
  User,
  Sparkles,
  Volume2,
  ArrowRight,
  CheckCircle,
  RefreshCw,
  SkipForward,
  Pause,
  Play,
  FileText,
  Brain,
  ArrowLeft,
  Keyboard,
  AlertCircle,
  ChevronDown,
  Loader2,
  Check,
  X,
  Headphones,
  RotateCcw,
  Edit2,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AudioVisualizer } from '@/components/audio-visualizer';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface VoiceResumeBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadClick: () => void;
  onResumeGenerated: (resumeText: string) => void;
}

const INTERVIEW_QUESTIONS = [
  {
    id: 'name',
    question: "Let's start with your name. How would you like to be addressed professionally?",
    category: 'personal',
    shortTitle: 'Name',
    followUp: null,
    maxDuration: 10000
  },
  {
    id: 'contact',
    question: "What's the best email and phone number to reach you at?",
    category: 'personal',
    shortTitle: 'Contact',
    followUp: null,
    maxDuration: 15000
  },
  {
    id: 'location',
    question: "What city and state are you located in?",
    category: 'personal',
    shortTitle: 'Location',
    followUp: null,
    maxDuration: 10000
  },
  {
    id: 'summary',
    question: "Tell me about yourself in 2-3 sentences. What makes you unique as a professional?",
    category: 'professional',
    shortTitle: 'Summary',
    followUp: null,
    maxDuration: 30000
  },
  {
    id: 'recent_role',
    question: "What's your most recent job title and company? Tell me about your role there.",
    category: 'experience',
    shortTitle: 'Recent Role',
    followUp: "What were your main responsibilities in this position?",
    maxDuration: 45000
  },
  {
    id: 'achievements',
    question: "What professional achievements are you most proud of? Try to include specific numbers or results if you can.",
    category: 'experience',
    shortTitle: 'Achievements',
    followUp: null,
    maxDuration: 45000
  },
  {
    id: 'education',
    question: "What's your educational background? Include your degree, school, and graduation year if relevant.",
    category: 'education',
    shortTitle: 'Education',
    followUp: "Do you have any certifications or special training?",
    maxDuration: 30000
  },
  {
    id: 'skills',
    question: "What are your top technical skills and tools you're proficient with?",
    category: 'skills',
    shortTitle: 'Skills',
    followUp: "Any soft skills or languages you'd like to highlight?",
    maxDuration: 30000
  },
  {
    id: 'goal',
    question: "Finally, what type of role are you looking for? What's your ideal next position?",
    category: 'goals',
    shortTitle: 'Career Goals',
    followUp: null,
    maxDuration: 30000
  }
];

export function VoiceResumeBuilder({ isOpen, onClose, onUploadClick, onResumeGenerated }: VoiceResumeBuilderProps) {
  const [mode, setMode] = useState<'choice' | 'interview' | 'processing'>('choice');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [showNavigator, setShowNavigator] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const currentQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex];
  const progress = ((completedQuestions.size) / INTERVIEW_QUESTIONS.length) * 100;

  // Keyboard shortcuts
  useEffect(() => {
    if (mode !== 'interview') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (isTyping) return;

      switch(e.code) {
        case 'Space':
          e.preventDefault();
          if (!isProcessing) {
            if (isRecording && !isPaused) {
              pauseRecording();
            } else if (isRecording && isPaused) {
              resumeRecording();
            } else {
              startRecording();
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (!isRecording && !isProcessing && (currentTranscript || typedAnswer)) {
            nextQuestion();
          }
          break;
        case 'ArrowLeft':
          if (!isRecording && !isProcessing && currentQuestionIndex > 0) {
            previousQuestion();
          }
          break;
        case 'ArrowRight':
          if (!isRecording && !isProcessing) {
            skipQuestion();
          }
          break;
        case 'KeyT':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setIsTyping(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, isRecording, isPaused, isProcessing, isTyping, currentTranscript, typedAnswer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      window.speechSynthesis.cancel();
    };
  }, [isRecording, audioStream]);

  // Save progress to localStorage
  useEffect(() => {
    if (mode === 'interview') {
      const progress = {
        currentQuestionIndex,
        answers,
        completedQuestions: Array.from(completedQuestions)
      };
      localStorage.setItem('voiceResumeProgress', JSON.stringify(progress));
    }
  }, [currentQuestionIndex, answers, completedQuestions, mode]);

  // Load saved progress
  const loadSavedProgress = () => {
    const saved = localStorage.getItem('voiceResumeProgress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        setCurrentQuestionIndex(progress.currentQuestionIndex || 0);
        setAnswers(progress.answers || {});
        setCompletedQuestions(new Set(progress.completedQuestions || []));
        return true;
      } catch (error) {
        console.error('Error loading saved progress:', error);
      }
    }
    return false;
  };

  // Speak question using Web Speech API
  const speakQuestion = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const startInterview = (resumeFromSaved = false) => {
    setMode('interview');
    setErrorMessage('');
    
    if (resumeFromSaved && loadSavedProgress()) {
      toast({
        title: "Progress restored",
        description: "Continuing from where you left off"
      });
    } else {
      setCurrentQuestionIndex(0);
      setAnswers({});
      setCompletedQuestions(new Set());
    }
    
    setTimeout(() => {
      speakQuestion(INTERVIEW_QUESTIONS[currentQuestionIndex].question);
    }, 500);
  };

  const startRecording = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      setAudioStream(stream);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 100);
      }, 100);
      
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, currentQuestion.maxDuration);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setErrorMessage('Unable to access microphone. Please check your permissions.');
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access or use the text input option",
        variant: "destructive"
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 100);
      }, 100);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && 
        (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingTime(0);
    }
  };

  const transcribeAudio = async (audioBlob: Blob, attempt = 1) => {
    setIsProcessing(true);
    setCurrentTranscript('Transcribing your response...');
    setRetryCount(attempt - 1);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('questionId', currentQuestion.id);
      
      const response = await fetch('/api/resume/transcribe', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }
      
      const data = await response.json();
      const transcribedText = data.text || '';
      
      if (!transcribedText && attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return transcribeAudio(audioBlob, attempt + 1);
      }
      
      setCurrentTranscript(transcribedText);
      setRetryCount(0);
      setErrorMessage('');
      
      if (transcribedText) {
        setAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: transcribedText
        }));
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      
      if (attempt < 3) {
        toast({
          title: `Retrying transcription (${attempt}/3)`,
          description: "Having trouble transcribing. Trying again...",
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        return transcribeAudio(audioBlob, attempt + 1);
      }
      
      setErrorMessage('Unable to transcribe audio after 3 attempts. Please try again or use text input.');
      toast({
        title: "Transcription failed",
        description: "Please try recording again or use the text input option",
        variant: "destructive"
      });
      setCurrentTranscript('');
    } finally {
      setIsProcessing(false);
    }
  };

  const playRecording = () => {
    if (recordedAudio && !isPlaying) {
      const audio = new Audio(URL.createObjectURL(recordedAudio));
      audioElementRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
      };
      
      audio.play();
      setIsPlaying(true);
    } else if (audioElementRef.current && isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  };

  const reRecord = () => {
    setCurrentTranscript('');
    setRecordedAudio(null);
    setTypedAnswer('');
    setErrorMessage('');
    if (answers[currentQuestion.id]) {
      const newAnswers = { ...answers };
      delete newAnswers[currentQuestion.id];
      setAnswers(newAnswers);
    }
    startRecording();
  };

  const saveTypedAnswer = () => {
    if (typedAnswer.trim()) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: typedAnswer
      }));
      setCurrentTranscript(typedAnswer);
      setIsTyping(false);
      setCompletedQuestions(prev => new Set(Array.from(prev).concat(currentQuestion.id)));
    }
  };

  const nextQuestion = () => {
    const answer = currentTranscript || typedAnswer || answers[currentQuestion.id];
    if (answer) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: answer
      }));
      setCompletedQuestions(prev => new Set(Array.from(prev).concat(currentQuestion.id)));
    }
    
    if (currentQuestionIndex < INTERVIEW_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
      setTimeout(() => {
        speakQuestion(INTERVIEW_QUESTIONS[currentQuestionIndex + 1].question);
      }, 500);
    } else {
      generateResume();
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      resetQuestionState();
      const prevQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex - 1];
      setCurrentTranscript(answers[prevQuestion.id] || '');
      setTimeout(() => {
        speakQuestion(prevQuestion.question);
      }, 500);
    }
  };

  const skipQuestion = () => {
    nextQuestion();
  };

  const jumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    resetQuestionState();
    const question = INTERVIEW_QUESTIONS[index];
    setCurrentTranscript(answers[question.id] || '');
    setShowNavigator(false);
    setTimeout(() => {
      speakQuestion(question.question);
    }, 500);
  };

  const resetQuestionState = () => {
    setCurrentTranscript('');
    setRecordedAudio(null);
    setTypedAnswer('');
    setIsTyping(false);
    setErrorMessage('');
    window.speechSynthesis.cancel();
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  };

  const generateResume = async () => {
    setMode('processing');
    window.speechSynthesis.cancel();
    localStorage.removeItem('voiceResumeProgress');
    
    try {
      const response = await apiRequest('/api/resume/generate-from-interview', {
        method: 'POST',
        body: JSON.stringify({ 
          answers,
          questions: INTERVIEW_QUESTIONS 
        })
      });
      
      if (response.resumeText) {
        onResumeGenerated(response.resumeText);
        toast({
          title: "Resume created!",
          description: "Your professional resume has been generated from the interview"
        });
        onClose();
      } else {
        throw new Error('Failed to generate resume');
      }
    } catch (error) {
      console.error('Resume generation error:', error);
      toast({
        title: "Generation failed",
        description: "Failed to create resume. Please try again.",
        variant: "destructive"
      });
      setMode('interview');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && mode === 'choice') {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-5xl max-h-[90vh] overflow-y-auto"
          >
            {mode === 'choice' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Create Your Resume
                  </h2>
                  <p className="text-gray-400">Choose how you'd like to create your professional resume</p>
                  
                  {/* Check for saved progress */}
                  {localStorage.getItem('voiceResumeProgress') && (
                    <Alert className="mt-4 bg-purple-900/20 border-purple-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Resume in Progress</AlertTitle>
                      <AlertDescription>
                        You have a saved interview session. Would you like to continue?
                        <div className="mt-2 flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => startInterview(true)}
                            className="bg-purple-500 hover:bg-purple-600"
                          >
                            Continue Interview
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              localStorage.removeItem('voiceResumeProgress');
                              startInterview(false);
                            }}
                          >
                            Start Over
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Upload Option */}
                  <Card 
                    className="glass-card p-6 cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={onUploadClick}
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 rounded-full bg-blue-500/10">
                        <Upload className="h-12 w-12 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-semibold">Upload Resume</h3>
                      <p className="text-sm text-gray-400">
                        Have a resume ready? Upload your PDF, Word doc, or text file
                      </p>
                      <Button className="w-full mt-4 bg-blue-500 hover:bg-blue-600">
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                    </div>
                  </Card>
                  
                  {/* Voice Interview Option */}
                  <Card 
                    className="glass-card p-6 cursor-pointer hover:scale-[1.02] transition-transform border-purple-500/20"
                    onClick={() => startInterview(false)}
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 rounded-full bg-purple-500/10 relative">
                        <Brain className="h-12 w-12 text-purple-400" />
                        <Sparkles className="h-6 w-6 text-yellow-400 absolute -top-1 -right-1" />
                      </div>
                      <h3 className="text-xl font-semibold">AI Interview</h3>
                      <p className="text-sm text-gray-400">
                        No resume? Let our AI interview you and create one in minutes
                      </p>
                      <Button className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                        <Mic className="h-4 w-4 mr-2" />
                        Start Interview
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}
            
            {mode === 'interview' && (
              <Card className="glass-card p-6">
                <div className="space-y-4">
                  {/* Header with Progress */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={previousQuestion}
                          disabled={currentQuestionIndex === 0 || isRecording || isProcessing}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        
                        <div>
                          <span className="text-sm text-gray-400">
                            Question {currentQuestionIndex + 1} of {INTERVIEW_QUESTIONS.length}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            {completedQuestions.has(currentQuestion.id) && (
                              <Badge variant="outline" className="text-green-400 border-green-400/30">
                                <Check className="h-3 w-3 mr-1" />
                                Answered
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                              {currentQuestion.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DropdownMenu open={showNavigator} onOpenChange={setShowNavigator}>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Navigate
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
                            {INTERVIEW_QUESTIONS.map((q, idx) => (
                              <DropdownMenuItem
                                key={q.id}
                                onClick={() => jumpToQuestion(idx)}
                                className={cn(
                                  "flex items-center justify-between",
                                  idx === currentQuestionIndex && "bg-purple-900/30"
                                )}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">{idx + 1}.</span>
                                  {q.shortTitle}
                                </span>
                                {completedQuestions.has(q.id) && (
                                  <Check className="h-3 w-3 text-green-400" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            window.speechSynthesis.cancel();
                            onClose();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <Progress value={progress} className="h-2" />
                    
                    {/* Progress indicators */}
                    <div className="flex gap-1">
                      {INTERVIEW_QUESTIONS.map((q, idx) => (
                        <button
                          key={q.id}
                          onClick={() => !isRecording && !isProcessing && jumpToQuestion(idx)}
                          disabled={isRecording || isProcessing}
                          className={cn(
                            "flex-1 h-1 rounded-full transition-colors",
                            completedQuestions.has(q.id) 
                              ? "bg-green-400" 
                              : idx === currentQuestionIndex 
                              ? "bg-purple-400 animate-pulse" 
                              : "bg-gray-600"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Question Display */}
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      {isSpeaking && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <Volume2 className="h-5 w-5 text-purple-400 mt-1" />
                        </motion.div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-medium mb-2">
                          {currentQuestion.question}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {isTyping ? 
                            "Type your answer below" : 
                            `Speak clearly • Max ${currentQuestion.maxDuration / 1000}s • Press Space to record`
                          }
                        </p>
                      </div>
                    </div>
                    
                    {errorMessage && (
                      <Alert className="bg-red-900/20 border-red-500/30">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {errorMessage}
                        </AlertDescription>
                      </Alert>
                    )}
                  </motion.div>
                  
                  {/* Audio Visualizer */}
                  {isRecording && audioStream && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-black/30 rounded-lg p-4"
                    >
                      <AudioVisualizer
                        isActive={isRecording && !isPaused}
                        audioStream={audioStream}
                        type="bars"
                        className="h-24"
                      />
                    </motion.div>
                  )}
                  
                  {/* Recording Controls */}
                  <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center gap-4">
                      {!isTyping ? (
                        <>
                          {/* Record/Stop Button */}
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              if (isRecording) {
                                stopRecording();
                              } else {
                                startRecording();
                              }
                            }}
                            disabled={isProcessing}
                            className={cn(
                              "relative p-6 rounded-full transition-all",
                              isRecording 
                                ? "bg-red-500/20 hover:bg-red-500/30" 
                                : "bg-purple-500/20 hover:bg-purple-500/30",
                              isProcessing && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isRecording && !isPaused && (
                              <motion.div
                                className="absolute inset-0 rounded-full border-4 border-red-400"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              />
                            )}
                            {isRecording ? (
                              isPaused ? (
                                <Play className="h-10 w-10 text-yellow-400" />
                              ) : (
                                <MicOff className="h-10 w-10 text-red-400" />
                              )
                            ) : (
                              <Mic className="h-10 w-10 text-purple-400" />
                            )}
                          </motion.button>
                          
                          {/* Pause/Resume Button */}
                          {isRecording && (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={isPaused ? resumeRecording : pauseRecording}
                              className="rounded-full"
                            >
                              {isPaused ? (
                                <Play className="h-5 w-5" />
                              ) : (
                                <Pause className="h-5 w-5" />
                              )}
                            </Button>
                          )}
                          
                          {/* Re-record Button */}
                          {recordedAudio && !isRecording && (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={reRecord}
                              className="rounded-full"
                            >
                              <RotateCcw className="h-5 w-5" />
                            </Button>
                          )}
                          
                          {/* Play Recording Button */}
                          {recordedAudio && !isRecording && (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={playRecording}
                              className="rounded-full"
                            >
                              {isPlaying ? (
                                <Pause className="h-5 w-5" />
                              ) : (
                                <Headphones className="h-5 w-5" />
                              )}
                            </Button>
                          )}
                          
                          {/* Type Answer Button */}
                          {!isRecording && (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                setIsTyping(true);
                                setTypedAnswer(currentTranscript || answers[currentQuestion.id] || '');
                              }}
                              className="rounded-full"
                            >
                              <Keyboard className="h-5 w-5" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="w-full space-y-3">
                          <Textarea
                            value={typedAnswer}
                            onChange={(e) => setTypedAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="min-h-[120px]"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={saveTypedAnswer}
                              disabled={!typedAnswer.trim()}
                              className="bg-purple-500 hover:bg-purple-600"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save Answer
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsTyping(false);
                                setTypedAnswer('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Status Text */}
                    <div className="text-center">
                      {isRecording && (
                        <motion.p 
                          className={cn(
                            "font-medium",
                            isPaused ? "text-yellow-400" : "text-red-400 animate-pulse"
                          )}
                        >
                          {isPaused ? 'Paused' : 'Recording...'} ({(recordingTime / 1000).toFixed(1)}s / {currentQuestion.maxDuration / 1000}s)
                        </motion.p>
                      )}
                      {isProcessing && (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          <p className="text-blue-400 font-medium">
                            Processing your response{retryCount > 0 && ` (Retry ${retryCount}/3)`}...
                          </p>
                        </div>
                      )}
                      {!isRecording && !isProcessing && !isTyping && (
                        <div className="space-y-1">
                          <p className="text-gray-400 text-sm">
                            Press <kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">Space</kbd> to record or 
                            <kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs mx-1">Ctrl+T</kbd> to type
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Transcript/Answer Display */}
                  {(currentTranscript || answers[currentQuestion.id]) && !isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-white/5 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Your Answer:</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsTyping(true);
                            setTypedAnswer(currentTranscript || answers[currentQuestion.id] || '');
                          }}
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm text-gray-300">
                        {currentTranscript || answers[currentQuestion.id]}
                      </p>
                    </motion.div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex justify-between pt-4 border-t border-white/10">
                    <Button
                      variant="outline"
                      onClick={skipQuestion}
                      disabled={isRecording || isProcessing}
                    >
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip
                    </Button>
                    
                    <div className="flex gap-2">
                      {currentQuestionIndex > 0 && (
                        <Button
                          variant="outline"
                          onClick={previousQuestion}
                          disabled={isRecording || isProcessing}
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Previous
                        </Button>
                      )}
                      
                      <Button
                        onClick={nextQuestion}
                        disabled={
                          (!currentTranscript && !typedAnswer && !answers[currentQuestion.id]) || 
                          isRecording || 
                          isProcessing
                        }
                        className="bg-gradient-to-r from-blue-500 to-purple-500"
                      >
                        {currentQuestionIndex === INTERVIEW_QUESTIONS.length - 1 ? 'Finish' : 'Next'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Keyboard Shortcuts Help */}
                  <div className="text-center text-xs text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">Space</kbd> Record
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">Enter</kbd> Next
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">←/→</kbd> Navigate
                    </span>
                  </div>
                </div>
              </Card>
            )}
            
            {mode === 'processing' && (
              <Card className="glass-card p-12">
                <div className="flex flex-col items-center space-y-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Brain className="h-16 w-16 text-purple-400" />
                  </motion.div>
                  <h3 className="text-2xl font-semibold">Creating Your Resume</h3>
                  <p className="text-gray-400 text-center">
                    Our AI is crafting your professional resume based on your interview responses...
                  </p>
                  <div className="w-full max-w-xs">
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 4, ease: 'easeInOut' }}
                    >
                      <Progress value={75} className="h-2" />
                    </motion.div>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}