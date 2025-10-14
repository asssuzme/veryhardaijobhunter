import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Upload, 
  Brain,
  Sparkles,
  Volume2,
  CheckCircle,
  Loader2,
  Check,
  X,
  AlertCircle,
  Pause,
  Play,
  Activity,
  Zap,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AudioVisualizer } from '@/components/audio-visualizer';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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

// Acknowledgment messages between questions
const ACKNOWLEDGMENTS = [
  "Great, thank you!",
  "Perfect, got it.",
  "Excellent response.",
  "Thanks for sharing that.",
  "Wonderful, moving on.",
  "That's helpful, thanks.",
  "I appreciate that.",
  "Great answer!",
  "Thanks for the details."
];

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  // Continuous conversation states
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState(0);
  const [noSpeechTimer, setNoSpeechTimer] = useState(0);
  const [conversationState, setConversationState] = useState<'waiting' | 'listening' | 'recording' | 'processing' | 'speaking'>('waiting');
  
  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const noSpeechTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  const currentQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex];
  const progress = ((completedQuestions.size) / INTERVIEW_QUESTIONS.length) * 100;

  // Voice Activity Detection Settings
  const VAD_THRESHOLD = 0.02; // Voice detection threshold
  const SILENCE_DURATION = 2000; // 2 seconds of silence to stop recording
  const NO_SPEECH_TIMEOUT = 10000; // 10 seconds with no speech to prompt user
  const MIN_RECORDING_DURATION = 1000; // Minimum 1 second recording
  const DEBOUNCE_TIME = 300; // Debounce for voice detection

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop all timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (noSpeechTimerRef.current) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }

    // Cancel speech synthesis
    window.speechSynthesis.cancel();
  }, [audioStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Save progress to localStorage
  useEffect(() => {
    if (mode === 'interview' && !isPaused) {
      const progress = {
        currentQuestionIndex,
        answers,
        completedQuestions: Array.from(completedQuestions)
      };
      localStorage.setItem('voiceResumeProgress', JSON.stringify(progress));
    }
  }, [currentQuestionIndex, answers, completedQuestions, mode, isPaused]);

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

  // Initialize audio context and analyser for Voice Activity Detection
  const initializeAudioContext = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      setAudioStream(stream);
      
      // Create audio context for VAD
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      const micStream = audioContext.createMediaStreamSource(stream);
      micStream.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      micStreamRef.current = micStream;
      
      // Start Voice Activity Detection
      startVAD();
      
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setErrorMessage('Unable to access microphone. Please check your permissions.');
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to continue with the interview",
        variant: "destructive"
      });
      return null;
    }
  };

  // Voice Activity Detection
  const startVAD = () => {
    if (!analyserRef.current) return;

    const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
    
    vadIntervalRef.current = setInterval(() => {
      if (!analyserRef.current || isPaused) return;
      
      analyserRef.current.getFloatTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) for volume level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setVoiceLevel(rms);
      
      // Check for voice activity
      if (conversationState === 'listening' && rms > VAD_THRESHOLD) {
        // Voice detected - start recording
        startRecording();
      } else if (conversationState === 'recording' && rms < VAD_THRESHOLD) {
        // Silence detected while recording - start silence timer
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopRecording();
          }, SILENCE_DURATION);
        }
      } else if (conversationState === 'recording' && rms > VAD_THRESHOLD) {
        // Voice resumed - clear silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
    }, 100);
  };

  // Speak with acknowledgment
  const speakWithAcknowledgment = (text: string, includeAck: boolean = false) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const fullText = includeAck 
        ? `${ACKNOWLEDGMENTS[Math.floor(Math.random() * ACKNOWLEDGMENTS.length)]} ${text}`
        : text;
      
      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        setConversationState('speaking');
      };
      
      utterance.onend = () => {
        setIsSpeaking(false);
        // After speaking, start listening
        setTimeout(() => {
          setConversationState('listening');
          setIsListening(true);
          startNoSpeechTimer();
        }, 500);
      };
      
      utterance.onerror = () => {
        setIsSpeaking(false);
        setConversationState('listening');
        setIsListening(true);
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Start no speech timer
  const startNoSpeechTimer = () => {
    if (noSpeechTimerRef.current) {
      clearTimeout(noSpeechTimerRef.current);
    }
    
    noSpeechTimerRef.current = setTimeout(() => {
      // Prompt user if no speech detected
      speakWithAcknowledgment("I'm listening. Please speak your answer when you're ready.");
      setNoSpeechTimer(0);
    }, NO_SPEECH_TIMEOUT);
  };

  // Start recording
  const startRecording = () => {
    if (!audioStream || conversationState !== 'listening') return;
    
    // Clear no-speech timer
    if (noSpeechTimerRef.current) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
    
    setConversationState('recording');
    setIsListening(false);
    setIsRecording(true);
    
    const mediaRecorder = new MediaRecorder(audioStream, {
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
      setIsRecording(false);
      await transcribeAudio(audioBlob);
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    
    // Maximum recording duration
    recordingTimerRef.current = setTimeout(() => {
      stopRecording();
    }, currentQuestion.maxDuration);
  };

  // Stop recording
  const stopRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setConversationState('processing');
    }
  };

  // Transcribe audio
  const transcribeAudio = async (audioBlob: Blob, attempt = 1) => {
    setIsProcessing(true);
    setConversationState('processing');
    
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
      
      if (transcribedText) {
        setCurrentTranscript(transcribedText);
        setAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: transcribedText
        }));
        setCompletedQuestions(prev => new Set(Array.from(prev).concat(currentQuestion.id)));
        
        // Automatically move to next question
        setTimeout(() => {
          moveToNextQuestion();
        }, 1500);
      } else {
        // No text transcribed, go back to listening
        setConversationState('listening');
        setIsListening(true);
        speakWithAcknowledgment("I didn't catch that. Could you please repeat your answer?");
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return transcribeAudio(audioBlob, attempt + 1);
      }
      
      // Failed after 3 attempts - go back to listening
      setConversationState('listening');
      setIsListening(true);
      speakWithAcknowledgment("I'm having trouble understanding. Let's try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Move to next question
  const moveToNextQuestion = () => {
    if (currentQuestionIndex < INTERVIEW_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentTranscript('');
      
      // Speak next question with acknowledgment
      setTimeout(() => {
        const nextQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex + 1];
        speakWithAcknowledgment(nextQuestion.question, true);
      }, 500);
    } else {
      // Interview complete
      generateResume();
    }
  };

  // Start interview
  const startInterview = async (resumeFromSaved = false) => {
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
    
    // Initialize audio and start conversation
    const stream = await initializeAudioContext();
    if (!stream) return;
    
    // Start the interview with the first question
    setTimeout(() => {
      speakWithAcknowledgment(INTERVIEW_QUESTIONS[currentQuestionIndex].question);
    }, 1000);
  };

  // Pause/Resume interview
  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      speakWithAcknowledgment("Let's continue. " + currentQuestion.question);
    } else {
      setIsPaused(true);
      window.speechSynthesis.cancel();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        stopRecording();
      }
      setConversationState('waiting');
      setIsListening(false);
    }
  };

  // Stop interview
  const stopInterview = () => {
    cleanup();
    setMode('choice');
    setIsPaused(false);
    setConversationState('waiting');
  };

  // Generate resume
  const generateResume = async () => {
    setMode('processing');
    cleanup();
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
      setMode('choice');
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
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-500/20 text-green-400 border-green-400/30">
                          <Zap className="h-3 w-3 mr-1" />
                          Automatic
                        </Badge>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-400/30">
                          <Headphones className="h-3 w-3 mr-1" />
                          Conversational
                        </Badge>
                      </div>
                      <h3 className="text-xl font-semibold">AI Interview</h3>
                      <p className="text-sm text-gray-400">
                        Have a natural conversation with our AI interviewer. Just speak - no buttons required!
                      </p>
                      <Button className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                        <Mic className="h-4 w-4 mr-2" />
                        Start Conversation
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
                        <Button
                          size="sm"
                          variant={isPaused ? "default" : "outline"}
                          onClick={togglePause}
                          className={isPaused ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                        >
                          {isPaused ? (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </>
                          )}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={stopInterview}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <Progress value={progress} className="h-2" />
                    
                    {/* Progress indicators */}
                    <div className="flex gap-1">
                      {INTERVIEW_QUESTIONS.map((q, idx) => (
                        <div
                          key={q.id}
                          className={cn(
                            "flex-1 h-1 rounded-full transition-all duration-500",
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
                  
                  {/* Conversation State Indicator */}
                  <div className="flex flex-col items-center justify-center py-8 space-y-6">
                    {conversationState === 'speaking' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center space-y-4"
                      >
                        <div className="relative">
                          <motion.div
                            className="absolute inset-0 rounded-full bg-purple-400/20"
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <div className="relative p-6 rounded-full bg-purple-500/10">
                            <Volume2 className="h-12 w-12 text-purple-400" />
                          </div>
                        </div>
                        <p className="text-purple-400 font-medium">AI is speaking...</p>
                      </motion.div>
                    )}
                    
                    {conversationState === 'listening' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center space-y-4"
                      >
                        <div className="relative">
                          <motion.div
                            className="absolute inset-0 rounded-full bg-blue-400/20"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                          <div className="relative p-6 rounded-full bg-blue-500/10">
                            <Mic className="h-12 w-12 text-blue-400" />
                          </div>
                        </div>
                        <div className="text-center space-y-2">
                          <p className="text-blue-400 font-medium">Listening for your voice...</p>
                          <p className="text-sm text-gray-500">Just start speaking when ready</p>
                        </div>
                        
                        {/* Voice Level Indicator */}
                        <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-blue-400"
                            animate={{ width: `${Math.min(voiceLevel * 500, 100)}%` }}
                            transition={{ duration: 0.1 }}
                          />
                        </div>
                      </motion.div>
                    )}
                    
                    {conversationState === 'recording' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center space-y-4"
                      >
                        <div className="relative">
                          <motion.div
                            className="absolute inset-0 rounded-full bg-red-400/30"
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                          <div className="relative p-6 rounded-full bg-red-500/20">
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            >
                              <Activity className="h-12 w-12 text-red-400" />
                            </motion.div>
                          </div>
                        </div>
                        <p className="text-red-400 font-medium animate-pulse">Recording your answer...</p>
                        
                        {/* Audio Visualizer */}
                        {audioStream && (
                          <div className="w-full max-w-md">
                            <AudioVisualizer
                              isActive={true}
                              audioStream={audioStream}
                              type="bars"
                              className="h-20"
                            />
                          </div>
                        )}
                      </motion.div>
                    )}
                    
                    {conversationState === 'processing' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center space-y-4"
                      >
                        <div className="relative p-6 rounded-full bg-green-500/10">
                          <Loader2 className="h-12 w-12 text-green-400 animate-spin" />
                        </div>
                        <p className="text-green-400 font-medium">Processing your response...</p>
                      </motion.div>
                    )}
                    
                    {isPaused && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center space-y-4"
                      >
                        <div className="p-6 rounded-full bg-yellow-500/10 inline-block">
                          <Pause className="h-12 w-12 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-yellow-400 font-medium text-lg">Interview Paused</p>
                          <p className="text-gray-400 text-sm mt-2">Click Resume to continue the conversation</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Current Answer Display */}
                  {currentTranscript && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Your Answer:</span>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      </div>
                      <p className="text-sm text-gray-300">
                        {currentTranscript}
                      </p>
                    </motion.div>
                  )}
                  
                  {/* Instructions */}
                  <div className="text-center text-xs text-gray-500 pt-4 border-t border-white/10">
                    <p>This interview is fully automatic - just speak naturally when prompted</p>
                    <p className="mt-1">The AI will detect when you start and stop speaking</p>
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