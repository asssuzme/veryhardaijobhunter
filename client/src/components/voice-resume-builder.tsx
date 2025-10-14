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
  Headphones,
  Phone,
  Star,
  Shield,
  MessageSquare,
  Clock,
  TrendingUp,
  CreditCard,
  Crown,
  Settings
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Vapi from '@vapi-ai/web';
import { VapiConfigHelper } from '@/components/vapi-config-helper';

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
  const [mode, setMode] = useState<'choice' | 'interview' | 'processing' | 'calibration' | 'pro-interview'>('choice');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  // Pro mode states
  const [isProMode, setIsProMode] = useState(false);
  const [vapiClient, setVapiClient] = useState<any>(null);
  const [vapiCallId, setVapiCallId] = useState<string | null>(null);
  const [vapiStatus, setVapiStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle');
  const [showVapiConfig, setShowVapiConfig] = useState(false);
  
  // Continuous conversation states
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState(0);
  const [noSpeechTimer, setNoSpeechTimer] = useState(0);
  const [conversationState, setConversationState] = useState<'waiting' | 'listening' | 'recording' | 'processing' | 'speaking'>('waiting');
  
  // Enhanced VAD states
  const [showManualTrigger, setShowManualTrigger] = useState(false);
  const [adaptiveThreshold, setAdaptiveThreshold] = useState(0.005); // Start with very low threshold
  const [ambientNoiseLevel, setAmbientNoiseLevel] = useState(0);
  const [silenceCountdown, setSilenceCountdown] = useState(0);
  const [calibrationData, setCalibrationData] = useState<number[]>([]);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [peakVoiceLevel, setPeakVoiceLevel] = useState(0);
  
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
  const manualTriggerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCountdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  const currentQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex];
  const progress = ((completedQuestions.size) / INTERVIEW_QUESTIONS.length) * 100;

  // Enhanced Voice Activity Detection Settings
  const BASE_VAD_THRESHOLD = 0.005; // Much lower base threshold for sensitivity
  const SILENCE_DURATION = 1500; // Reduced to 1.5 seconds
  const NO_SPEECH_TIMEOUT = 15000; // 15 seconds before showing manual option
  const MIN_RECORDING_DURATION = 1000; // Minimum 1 second recording
  const DEBOUNCE_TIME = 200; // Faster debounce
  const CALIBRATION_DURATION = 3000; // 3 seconds for calibration
  const DEBUG_MODE = true; // Enable debug logging

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
    if (manualTriggerTimerRef.current) {
      clearTimeout(manualTriggerTimerRef.current);
      manualTriggerTimerRef.current = null;
    }
    if (silenceCountdownTimerRef.current) {
      clearInterval(silenceCountdownTimerRef.current);
      silenceCountdownTimerRef.current = null;
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

  // Keyboard event handler for spacebar manual trigger
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && conversationState === 'listening' && !isPaused) {
        event.preventDefault();
        if (DEBUG_MODE) console.log('🎤 Manual trigger via spacebar');
        startRecording();
      }
    };

    if (mode === 'interview') {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [mode, conversationState, isPaused]);

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

  // Voice Activity Detection with adaptive threshold
  const startVAD = () => {
    if (!analyserRef.current) return;

    const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
    let consecutiveDetections = 0;
    
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
      
      // Track peak level
      if (rms > peakVoiceLevel) {
        setPeakVoiceLevel(rms);
      }
      
      // Debug logging
      if (DEBUG_MODE && conversationState === 'listening') {
        console.log(`🎤 Audio Level: ${rms.toFixed(4)} | Threshold: ${adaptiveThreshold.toFixed(4)} | State: ${conversationState}`);
      }
      
      // Use adaptive threshold
      const currentThreshold = isCalibrated ? adaptiveThreshold : BASE_VAD_THRESHOLD;
      
      // Check for voice activity with debouncing
      if (conversationState === 'listening' && rms > currentThreshold) {
        consecutiveDetections++;
        if (consecutiveDetections >= 2) { // Require 2 consecutive detections
          if (DEBUG_MODE) console.log('✅ Voice detected! Starting recording...');
          startRecording();
          consecutiveDetections = 0;
        }
      } else if (conversationState === 'recording' && rms < currentThreshold) {
        // Silence detected while recording - start countdown
        if (!silenceTimerRef.current) {
          setSilenceCountdown(SILENCE_DURATION / 1000); // Convert to seconds
          
          // Start countdown display
          let countdown = SILENCE_DURATION / 1000;
          silenceCountdownTimerRef.current = setInterval(() => {
            countdown -= 0.1;
            setSilenceCountdown(Math.max(0, countdown));
          }, 100);
          
          silenceTimerRef.current = setTimeout(() => {
            if (DEBUG_MODE) console.log('🛑 Silence detected. Stopping recording...');
            stopRecording();
          }, SILENCE_DURATION);
        }
      } else if (conversationState === 'recording' && rms > currentThreshold) {
        // Voice resumed - clear silence timer and countdown
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (silenceCountdownTimerRef.current) {
          clearInterval(silenceCountdownTimerRef.current);
          silenceCountdownTimerRef.current = null;
          setSilenceCountdown(0);
        }
      } else if (conversationState === 'listening') {
        consecutiveDetections = 0;
      }
    }, 50); // Faster polling for better responsiveness
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
    
    // Reset manual trigger state
    setShowManualTrigger(false);
    
    noSpeechTimerRef.current = setTimeout(() => {
      // Show manual trigger option after timeout
      setShowManualTrigger(true);
      if (DEBUG_MODE) console.log('⚠️ No speech detected for 15 seconds. Showing manual trigger...');
      speakWithAcknowledgment("I'm still listening. You can speak now, or press the button or spacebar to start recording manually.");
    }, NO_SPEECH_TIMEOUT);
  };

  // Start recording (manual or automatic)
  const startRecording = (isManual: boolean = false) => {
    if (!audioStream || (conversationState !== 'listening' && !isManual)) return;
    
    // Clear timers
    if (noSpeechTimerRef.current) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
    
    // Hide manual trigger button
    setShowManualTrigger(false);
    
    setConversationState('recording');
    setIsListening(false);
    setIsRecording(true);
    
    if (DEBUG_MODE) console.log(`🎙️ Recording started ${isManual ? '(manual trigger)' : '(voice activated)'}`);
    
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
      if (DEBUG_MODE) console.log('⏱️ Max recording duration reached');
      stopRecording();
    }, currentQuestion.maxDuration);
  };

  // Stop recording
  const stopRecording = () => {
    // Clear all recording-related timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (silenceCountdownTimerRef.current) {
      clearInterval(silenceCountdownTimerRef.current);
      silenceCountdownTimerRef.current = null;
      setSilenceCountdown(0);
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

  // Calibrate microphone
  const calibrateMicrophone = async () => {
    setMode('calibration');
    setCalibrationData([]);
    
    const stream = await initializeAudioContext();
    if (!stream) return;
    
    // Speak calibration instructions
    speakWithAcknowledgment("Let's calibrate your microphone. Please speak normally for a few seconds when you hear the beep.");
    
    // Wait for speech to finish, then start calibration
    setTimeout(() => {
      const calibrationSamples: number[] = [];
      const calibrationInterval = setInterval(() => {
        if (analyserRef.current) {
          const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getFloatTimeDomainData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);
          calibrationSamples.push(rms);
        }
      }, 100);
      
      // Stop calibration after duration
      setTimeout(() => {
        clearInterval(calibrationInterval);
        
        // Calculate adaptive threshold from calibration data
        if (calibrationSamples.length > 0) {
          // Filter out silence (bottom 20%) and get average of speaking levels
          const sortedSamples = [...calibrationSamples].sort((a, b) => a - b);
          const topSamples = sortedSamples.slice(Math.floor(sortedSamples.length * 0.2));
          
          if (topSamples.length > 0) {
            const avgSpeaking = topSamples.reduce((a, b) => a + b, 0) / topSamples.length;
            const minSpeaking = topSamples[0];
            
            // Set threshold to 50% of minimum speaking level for better sensitivity
            const newThreshold = minSpeaking * 0.5;
            setAdaptiveThreshold(Math.max(BASE_VAD_THRESHOLD, Math.min(0.02, newThreshold)));
            setAmbientNoiseLevel(sortedSamples[0]);
            setIsCalibrated(true);
            
            if (DEBUG_MODE) {
              console.log('📊 Calibration complete:');
              console.log(`   Ambient noise: ${sortedSamples[0].toFixed(4)}`);
              console.log(`   Min speaking: ${minSpeaking.toFixed(4)}`);
              console.log(`   Avg speaking: ${avgSpeaking.toFixed(4)}`);
              console.log(`   New threshold: ${adaptiveThreshold.toFixed(4)}`);
            }
          }
        }
        
        // Start interview after calibration
        setMode('interview');
        setTimeout(() => {
          speakWithAcknowledgment(INTERVIEW_QUESTIONS[currentQuestionIndex].question);
        }, 500);
      }, CALIBRATION_DURATION);
    }, 3000);
  };

  // Start interview
  const startInterview = async (resumeFromSaved = false) => {
    setErrorMessage('');
    setIsProMode(false);
    
    if (resumeFromSaved && loadSavedProgress()) {
      toast({
        title: "Progress restored",
        description: "Continuing from where you left off"
      });
      setMode('interview');
      
      // Initialize audio and start conversation
      const stream = await initializeAudioContext();
      if (!stream) return;
      
      // Start the interview with the current question
      setTimeout(() => {
        speakWithAcknowledgment(INTERVIEW_QUESTIONS[currentQuestionIndex].question);
      }, 1000);
    } else {
      setCurrentQuestionIndex(0);
      setAnswers({});
      setCompletedQuestions(new Set());
      
      // Start with calibration for new interviews
      calibrateMicrophone();
    }
  };

  // Start Pro interview with Vapi - IMPROVED VERSION
  const startProInterview = async () => {
    setErrorMessage('');
    setIsProMode(true);
    setMode('pro-interview');
    setVapiStatus('connecting');
    
    console.log('🚀 Starting Pro Interview...');
    
    try {
      // Get public key from localStorage or fallback
      let publicKey = localStorage.getItem('vapi_public_key') || '668f8fb5-3aac-45f9-ab43-591b20c985d4';
      
      // Try to get from server if not in localStorage
      if (!localStorage.getItem('vapi_public_key')) {
        try {
          const response = await apiRequest('/api/resume/vapi/start-interview', 'POST', {
            userName: 'User'
          });
          
          if (response.publicKey) {
            publicKey = response.publicKey;
            console.log('📌 Got public key from server');
          }
        } catch (err) {
          console.log('Could not get public key from server, using fallback');
        }
      }
      
      console.log('📌 Using public key:', publicKey.substring(0, 10) + '...');
      
      const vapi = new Vapi(publicKey);
      setVapiClient(vapi);
      
      // Set up only the essential event listeners
      vapi.on('call-start', () => {
        console.log('✅ Vapi call started successfully!');
        setVapiStatus('connected');
        setErrorMessage('');
      });
      
      vapi.on('call-end', async () => {
        console.log('📞 Vapi call ended');
        setVapiStatus('ended');
        // Only generate resume if we have a valid call
        if (vapiCallId) {
          await handleVapiCallEnd(vapiCallId);
        }
      });
      
      vapi.on('error', (error: any) => {
        console.error('❌ Vapi error event:', error);
        
        // Better error message handling
        let errorMsg = 'Connection error: ';
        
        if (error?.type === 'start-method-error') {
          const origin = window.location.origin;
          errorMsg = `Failed to start call. The public key may be invalid or not configured for this domain (${origin}). `;
          errorMsg += `Click "Configure Vapi" button to set up your public key.`;
          
          // Show configuration dialog
          setShowVapiConfig(true);
        } else if (error?.message) {
          errorMsg += error.message;
        } else if (error?.error) {
          errorMsg += JSON.stringify(error.error);
        } else {
          errorMsg += 'Unknown error occurred';
        }
        
        setErrorMessage(errorMsg);
        console.error('Full error object:', JSON.stringify(error, null, 2));
      });
      
      // Try Method 1: Direct assistant ID (hardcoded for testing)
      const assistantId = '86969d3b-28ef-4967-9841-3919f448c64c';
      console.log('🎯 Attempting to start with assistant ID:', assistantId);
      
      try {
        // Simple start with just the assistant ID
        await vapi.start(assistantId);
        console.log('✅ Vapi.start() completed successfully with assistant ID');
        setVapiCallId('temp-call-id'); // Set a temporary call ID
      } catch (startError: any) {
        console.error('❌ Assistant ID method failed:', startError);
        console.log('🔄 Trying inline configuration method...');
        
        // Method 2: Fallback to inline configuration
        try {
          const inlineConfig = {
            transcriber: {
              provider: 'deepgram',
              model: 'nova-2',
              language: 'en',
            },
            model: {
              provider: 'openai',
              model: 'gpt-3.5-turbo',
              messages: [{
                role: 'system',
                content: `You are a professional career coach conducting a resume-building interview. 
                         Ask the user about their work experience, education, skills, and career goals.
                         Keep questions concise and conversational. 
                         Start by asking for their name and current role.`
              }],
            },
            voice: {
              provider: '11labs',
              voiceId: 'paula',
            },
          };
          
          console.log('📋 Using inline config:', JSON.stringify(inlineConfig, null, 2));
          await vapi.start(inlineConfig as any);
          console.log('✅ Vapi.start() completed successfully with inline config');
          setVapiCallId('inline-config-call');
        } catch (inlineError: any) {
          console.error('❌ Inline config method also failed:', inlineError);
          throw new Error(`Both methods failed. Last error: ${inlineError.message || JSON.stringify(inlineError)}`);
        }
      }
      
    } catch (error: any) {
      console.error('❌ Complete failure in startProInterview:', error);
      setVapiStatus('idle');
      setMode('choice');
      
      // Detailed error message for debugging
      const errorDetails = error.stack || error.message || JSON.stringify(error) || 'Unknown error';
      setErrorMessage(`Failed to start: ${errorDetails}`);
      
      toast({
        title: "Connection Failed",
        description: "Could not connect to AI coach. Check console for details.",
        variant: "destructive"
      });
    }
  };

  // Handle Vapi call end
  const handleVapiCallEnd = async (callId: string) => {
    setMode('processing');
    
    try {
      // Get transcript
      const transcriptResponse = await apiRequest(`/api/resume/vapi/transcript/${callId}`);
      
      if (transcriptResponse.success && transcriptResponse.transcript) {
        // Generate resume from transcript
        const resumeResponse = await apiRequest('/api/resume/vapi/generate', {
          method: 'POST',
          body: JSON.stringify({ callId })
        });
        
        if (resumeResponse.success && resumeResponse.resume) {
          onResumeGenerated(resumeResponse.resume);
          toast({
            title: "Resume Created!",
            description: "Your professional resume has been generated from your Pro interview"
          });
          onClose();
        }
      }
    } catch (error) {
      console.error('Error processing Vapi call:', error);
      toast({
        title: "Error",
        description: "Failed to generate resume. Please contact support.",
        variant: "destructive"
      });
    }
    
    setMode('choice');
    setVapiStatus('idle');
  };

  // End Pro interview
  const endProInterview = async () => {
    console.log('🛑 Ending Pro Interview...');
    try {
      if (vapiClient) {
        console.log('Stopping Vapi client...');
        await vapiClient.stop();
        console.log('✅ Vapi client stopped successfully');
      }
    } catch (error) {
      console.error('Error stopping Vapi client:', error);
    }
    
    // Reset states regardless of stop result
    setMode('choice');
    setVapiStatus('idle');
    setVapiClient(null);
    setVapiCallId(null);
    setErrorMessage('');
    console.log('✅ States reset, back to choice mode');
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
    <>
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
                
                <div className="grid md:grid-cols-3 gap-6">
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
                  
                  {/* Free Voice Interview Option */}
                  <Card 
                    className="glass-card p-6 cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() => startInterview(false)}
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 rounded-full bg-purple-500/10">
                        <Mic className="h-12 w-12 text-purple-400" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-500/20 text-green-400 border-green-400/30">
                          Free
                        </Badge>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-400/30">
                          <Headphones className="h-3 w-3 mr-1" />
                          Voice
                        </Badge>
                      </div>
                      <h3 className="text-xl font-semibold">Free AI Interview</h3>
                      <ul className="text-sm text-gray-400 text-left space-y-2 mt-3">
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                          <span>Browser-based recording</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                          <span>AI-generated questions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                          <span>Basic transcription</span>
                        </li>
                      </ul>
                      <Button className="w-full mt-4 bg-purple-500 hover:bg-purple-600">
                        <Mic className="h-4 w-4 mr-2" />
                        Start Free Interview
                      </Button>
                    </div>
                  </Card>
                  
                  {/* Pro Voice Interview Option */}
                  <Card 
                    className="glass-card p-6 cursor-pointer hover:scale-[1.02] transition-transform border-gradient-to-r from-yellow-500/30 to-orange-500/30 relative"
                    onClick={() => startProInterview()}
                  >
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1">
                        <Crown className="h-3 w-3 mr-1" />
                        PREMIUM
                      </Badge>
                    </div>
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 relative">
                        <Phone className="h-12 w-12 text-yellow-400" />
                        <Sparkles className="h-6 w-6 text-orange-400 absolute -top-1 -right-1 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-400/30">
                          <Star className="h-3 w-3 mr-1" />
                          Pro
                        </Badge>
                        <Badge className="bg-green-500/20 text-green-400 border-green-400/30">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          95% Accuracy
                        </Badge>
                      </div>
                      <h3 className="text-xl font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        Pro AI Interview
                      </h3>
                      <ul className="text-sm text-gray-300 text-left space-y-2 mt-3">
                        <li className="flex items-start gap-2">
                          <Star className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                          <span>Natural conversation - interrupt anytime</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Star className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                          <span>Professional AI voice (ElevenLabs)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Star className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                          <span>Smart follow-up questions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Star className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                          <span>95%+ accurate transcription</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Star className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                          <span>Context-aware responses</span>
                        </li>
                      </ul>
                      <div className="w-full space-y-2 mt-4">
                        <Button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold">
                          <Phone className="h-4 w-4 mr-2" />
                          Start Pro Interview
                        </Button>
                        <p className="text-xs text-gray-500">Natural AI conversation</p>
                      </div>
                    </div>
                  </Card>
                </div>
                
                {/* Feature comparison */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-500">
                    <Shield className="h-4 w-4 inline mr-1" />
                    All interviews are private and secure. Your data is never shared.
                  </p>
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
                          <div>{errorMessage}</div>
                          {errorMessage.includes('public key') && (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                onClick={() => setShowVapiConfig(true)}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Configure Vapi
                              </Button>
                            </div>
                          )}
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
                          <p className="text-sm text-gray-500">
                            Just start speaking when ready{showManualTrigger ? ' or use the button below' : ''}
                          </p>
                          {!showManualTrigger && (
                            <p className="text-xs text-gray-600">Press spacebar to manually start recording</p>
                          )}
                        </div>
                        
                        {/* Enhanced Voice Level Indicator */}
                        <div className="w-full max-w-md space-y-2">
                          <div className="relative">
                            <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                              <motion.div 
                                className={cn(
                                  "h-full transition-colors",
                                  voiceLevel > adaptiveThreshold ? "bg-green-400" : "bg-blue-400"
                                )}
                                animate={{ width: `${Math.min(voiceLevel * 2000, 100)}%` }}
                                transition={{ duration: 0.05 }}
                              />
                            </div>
                            {/* Threshold indicator */}
                            <div 
                              className="absolute top-0 h-full w-[2px] bg-yellow-400"
                              style={{ left: `${Math.min(adaptiveThreshold * 2000, 100)}%` }}
                            >
                              <span className="absolute -top-6 -left-12 text-xs text-yellow-400 whitespace-nowrap">
                                Threshold
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Current: {voiceLevel.toFixed(4)}</span>
                            <span>Threshold: {adaptiveThreshold.toFixed(4)}</span>
                          </div>
                        </div>
                        
                        {/* Manual trigger button */}
                        {showManualTrigger && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <Button
                              onClick={() => startRecording(true)}
                              className="bg-blue-500 hover:bg-blue-600"
                            >
                              <Mic className="h-4 w-4 mr-2" />
                              Press to Start Recording
                            </Button>
                            <p className="text-xs text-gray-500 mt-2">Or press spacebar</p>
                          </motion.div>
                        )}
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
                        
                        {/* Silence countdown */}
                        {silenceCountdown > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2"
                          >
                            <p className="text-yellow-400 text-sm font-medium">
                              Stopping in {silenceCountdown.toFixed(1)}s...
                            </p>
                            <p className="text-xs text-gray-500">Keep speaking to continue</p>
                          </motion.div>
                        )}
                        
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
            
            {mode === 'pro-interview' && (
              <Card className="glass-card p-8">
                <div className="space-y-6">
                  {/* Pro Interview Header */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 mb-4">
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-1.5 text-sm">
                        <Crown className="h-4 w-4 mr-1" />
                        PRO INTERVIEW IN PROGRESS
                      </Badge>
                    </div>
                    <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                      Professional AI Interview
                    </h3>
                    <p className="text-gray-400 max-w-md mx-auto">
                      Have a natural conversation with our AI career coach. Speak naturally - you can interrupt anytime.
                    </p>
                  </div>

                  {/* Vapi Status */}
                  <div className="flex flex-col items-center space-y-6">
                    {vapiStatus === 'connecting' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center space-y-4"
                      >
                        <div className="relative">
                          <motion.div
                            className="absolute inset-0 rounded-full bg-yellow-400/20"
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <div className="relative p-6 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
                            <Phone className="h-12 w-12 text-yellow-400 animate-pulse" />
                          </div>
                        </div>
                        <p className="text-yellow-400 font-medium">Connecting to AI Coach...</p>
                        <div className="w-64">
                          <Progress value={30} className="h-2" />
                        </div>
                      </motion.div>
                    )}

                    {vapiStatus === 'connected' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center space-y-6 w-full"
                      >
                        {/* Active Call Indicator */}
                        <div className="relative">
                          <motion.div
                            className="absolute inset-0 rounded-full bg-green-400/20"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                          <div className="relative p-6 rounded-full bg-green-500/10">
                            <motion.div
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            >
                              <MessageSquare className="h-12 w-12 text-green-400" />
                            </motion.div>
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-green-400 font-medium text-lg mb-2">Interview Active</p>
                          <p className="text-gray-400 text-sm">Speak naturally - the AI is listening</p>
                        </div>

                        {/* Voice Level Indicator */}
                        <div className="w-full max-w-md">
                          <div className="flex items-center gap-3 mb-2">
                            <Activity className="h-4 w-4 text-gray-400" />
                            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-green-400 to-blue-400"
                                animate={{ width: `${Math.min(voiceLevel * 1000, 100)}%` }}
                                transition={{ duration: 0.1 }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Features during call */}
                        <div className="grid grid-cols-3 gap-4 mt-6">
                          <div className="text-center">
                            <div className="p-3 rounded-lg bg-purple-500/10 inline-block mb-2">
                              <Zap className="h-6 w-6 text-purple-400" />
                            </div>
                            <p className="text-xs text-gray-400">Natural Conversation</p>
                          </div>
                          <div className="text-center">
                            <div className="p-3 rounded-lg bg-blue-500/10 inline-block mb-2">
                              <Shield className="h-6 w-6 text-blue-400" />
                            </div>
                            <p className="text-xs text-gray-400">95% Accuracy</p>
                          </div>
                          <div className="text-center">
                            <div className="p-3 rounded-lg bg-green-500/10 inline-block mb-2">
                              <Star className="h-6 w-6 text-green-400" />
                            </div>
                            <p className="text-xs text-gray-400">Smart AI</p>
                          </div>
                        </div>

                        {/* End Call Button */}
                        <Button
                          onClick={endProInterview}
                          variant="outline"
                          className="mt-4 border-red-500/30 hover:bg-red-500/10 text-red-400"
                        >
                          <Phone className="h-4 w-4 mr-2 rotate-[135deg]" />
                          End Interview
                        </Button>
                      </motion.div>
                    )}

                    {vapiStatus === 'ended' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center space-y-4"
                      >
                        <Loader2 className="h-16 w-16 text-yellow-400 animate-spin" />
                        <p className="text-yellow-400 font-medium text-lg">Call Ended</p>
                        <p className="text-gray-400">The conversation has ended. Processing may take a moment...</p>
                        <Button
                          onClick={() => {
                            setMode('choice');
                            setVapiStatus('idle');
                          }}
                          className="mt-4"
                        >
                          Back to Options
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  {/* Error Display */}
                  {errorMessage && (
                    <Alert className="bg-red-900/20 border-red-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </Card>
            )}
            
            {mode === 'calibration' && (
              <Card className="glass-card p-12">
                <div className="flex flex-col items-center space-y-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center space-y-4"
                  >
                    <div className="relative">
                      <motion.div
                        className="absolute inset-0 rounded-full bg-purple-400/20"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <div className="relative p-6 rounded-full bg-purple-500/10">
                        <Activity className="h-12 w-12 text-purple-400" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold">Microphone Calibration</h3>
                    <p className="text-gray-400 text-center max-w-md">
                      Speak normally for a few seconds so I can adjust to your voice and environment
                    </p>
                    
                    {/* Calibration progress */}
                    <div className="w-full max-w-md space-y-2">
                      <div className="w-full h-6 bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
                          animate={{ width: `${Math.min(voiceLevel * 2000, 100)}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                      <p className="text-sm text-gray-500 text-center">
                        {voiceLevel > 0.001 ? 'Good! Keep speaking...' : 'Start speaking when ready...'}
                      </p>
                    </div>
                    
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 3, ease: 'linear' }}
                      className="w-full max-w-xs"
                    >
                      <Progress value={100} className="h-2" />
                    </motion.div>
                  </motion.div>
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
      
      {/* Vapi Configuration Dialog */}
      <Dialog open={showVapiConfig} onOpenChange={setShowVapiConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Vapi for Voice Interview</DialogTitle>
            <DialogDescription>
              Set up your Vapi public key to enable AI-powered voice interviews
            </DialogDescription>
          </DialogHeader>
          
          <VapiConfigHelper
            assistantId="86969d3b-28ef-4967-9841-3919f448c64c"
            onSuccess={(publicKey) => {
              // Store the public key and retry
              localStorage.setItem('vapi_public_key', publicKey);
              setShowVapiConfig(false);
              setErrorMessage('');
              
              // Retry the interview with the new key
              startProInterview();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}