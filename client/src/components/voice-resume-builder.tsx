import React, { useState, useRef, useEffect } from 'react';
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
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
    followUp: null,
    maxDuration: 10000
  },
  {
    id: 'contact',
    question: "What's the best email and phone number to reach you at?",
    category: 'personal',
    followUp: null,
    maxDuration: 15000
  },
  {
    id: 'location',
    question: "What city and state are you located in?",
    category: 'personal',
    followUp: null,
    maxDuration: 10000
  },
  {
    id: 'summary',
    question: "Tell me about yourself in 2-3 sentences. What makes you unique as a professional?",
    category: 'professional',
    followUp: null,
    maxDuration: 30000
  },
  {
    id: 'recent_role',
    question: "What's your most recent job title and company? Tell me about your role there.",
    category: 'experience',
    followUp: "What were your main responsibilities in this position?",
    maxDuration: 45000
  },
  {
    id: 'achievements',
    question: "What professional achievements are you most proud of? Try to include specific numbers or results if you can.",
    category: 'experience',
    followUp: null,
    maxDuration: 45000
  },
  {
    id: 'education',
    question: "What's your educational background? Include your degree, school, and graduation year if relevant.",
    category: 'education',
    followUp: "Do you have any certifications or special training?",
    maxDuration: 30000
  },
  {
    id: 'skills',
    question: "What are your top technical skills and tools you're proficient with?",
    category: 'skills',
    followUp: "Any soft skills or languages you'd like to highlight?",
    maxDuration: 30000
  },
  {
    id: 'goal',
    question: "Finally, what type of role are you looking for? What's your ideal next position?",
    category: 'goals',
    followUp: null,
    maxDuration: 30000
  }
];

export function VoiceResumeBuilder({ isOpen, onClose, onUploadClick, onResumeGenerated }: VoiceResumeBuilderProps) {
  const [mode, setMode] = useState<'choice' | 'interview' | 'processing'>('choice');
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const currentQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / INTERVIEW_QUESTIONS.length) * 100;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Speak question using Web Speech API
  const speakQuestion = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const startInterview = () => {
    setMode('interview');
    setCurrentQuestionIndex(0);
    setAnswers({});
    // Speak the first question
    setTimeout(() => {
      speakQuestion(INTERVIEW_QUESTIONS[0].question);
    }, 500);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 100);
      }, 100);
      
      // Auto-stop after max duration
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, currentQuestion.maxDuration);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice interview",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingTime(0);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setCurrentTranscript('Transcribing your response...');
    
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
        throw new Error('Transcription failed');
      }
      
      const data = await response.json();
      const transcribedText = data.text || '';
      
      setCurrentTranscript(transcribedText);
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: transcribedText
      }));
      
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription failed",
        description: "Please try recording your answer again",
        variant: "destructive"
      });
      setCurrentTranscript('');
    } finally {
      setIsProcessing(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < INTERVIEW_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentTranscript('');
      // Speak the next question
      setTimeout(() => {
        speakQuestion(INTERVIEW_QUESTIONS[currentQuestionIndex + 1].question);
      }, 500);
    } else {
      // Interview complete, generate resume
      generateResume();
    }
  };

  const skipQuestion = () => {
    nextQuestion();
  };

  const generateResume = async () => {
    setMode('processing');
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    
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
            className="w-full max-w-4xl"
          >
            {mode === 'choice' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Create Your Resume
                  </h2>
                  <p className="text-gray-400">Choose how you'd like to create your professional resume</p>
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
                    onClick={startInterview}
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
              <Card className="glass-card p-8">
                <div className="space-y-6">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Question {currentQuestionIndex + 1} of {INTERVIEW_QUESTIONS.length}</span>
                      <span>{Math.round(progress)}% Complete</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  
                  {/* Question Display */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      {isSpeaking && (
                        <Volume2 className="h-5 w-5 text-purple-400 animate-pulse mt-1" />
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-medium mb-2">
                          {currentQuestion.question}
                        </h3>
                        <p className="text-sm text-gray-400">
                          Speak clearly and take your time. You have up to {currentQuestion.maxDuration / 1000} seconds.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recording Interface */}
                  <div className="flex flex-col items-center space-y-6 py-6">
                    {/* Microphone Button */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                      className={cn(
                        "relative p-8 rounded-full transition-all",
                        isRecording 
                          ? "bg-red-500/20 hover:bg-red-500/30" 
                          : "bg-purple-500/20 hover:bg-purple-500/30",
                        isProcessing && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isRecording && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-4 border-red-400"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                      {isRecording ? (
                        <MicOff className="h-12 w-12 text-red-400" />
                      ) : (
                        <Mic className="h-12 w-12 text-purple-400" />
                      )}
                    </motion.button>
                    
                    {/* Status Text */}
                    <div className="text-center">
                      {isRecording && (
                        <p className="text-red-400 font-medium animate-pulse">
                          Recording... ({(recordingTime / 1000).toFixed(1)}s)
                        </p>
                      )}
                      {isProcessing && (
                        <p className="text-blue-400 font-medium">
                          Processing your response...
                        </p>
                      )}
                      {!isRecording && !isProcessing && (
                        <p className="text-gray-400">
                          Click the microphone to start recording
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Transcript Display */}
                  {currentTranscript && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-white/5 rounded-lg"
                    >
                      <p className="text-sm text-gray-300">{currentTranscript}</p>
                    </motion.div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={skipQuestion}
                      disabled={isRecording || isProcessing}
                    >
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip Question
                    </Button>
                    
                    <Button
                      onClick={nextQuestion}
                      disabled={!currentTranscript || isRecording || isProcessing}
                      className="bg-gradient-to-r from-blue-500 to-purple-500"
                    >
                      {currentQuestionIndex === INTERVIEW_QUESTIONS.length - 1 ? 'Finish' : 'Next'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
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
                    <Progress value={75} className="h-2" />
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