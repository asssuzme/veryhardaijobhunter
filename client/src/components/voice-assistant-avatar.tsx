import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, Activity } from 'lucide-react';

interface VoiceAssistantAvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  voiceLevel?: number;
  className?: string;
}

export function VoiceAssistantAvatar({
  isListening,
  isSpeaking,
  isProcessing,
  voiceLevel = 0,
  className = ''
}: VoiceAssistantAvatarProps) {
  // Determine the current state
  const state = isProcessing ? 'processing' : isSpeaking ? 'speaking' : isListening ? 'listening' : 'idle';

  // Dynamic scale based on voice level
  const dynamicScale = 1 + (voiceLevel * 2);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer ripple effect */}
      {(isSpeaking || isListening) && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full bg-blue-500/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [1, 1.5, 2],
              opacity: [0.5, 0.2, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-full bg-blue-500/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [1, 1.3, 1.8],
              opacity: [0.4, 0.15, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.5,
            }}
          />
        </>
      )}

      {/* Main orb */}
      <motion.div
        className={`
          relative w-32 h-32 rounded-full flex items-center justify-center
          ${state === 'speaking' ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 
            state === 'listening' ? 'bg-gradient-to-br from-green-500 to-teal-600' :
            state === 'processing' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
            'bg-gradient-to-br from-gray-400 to-gray-600'}
        `}
        animate={{
          scale: state === 'speaking' ? [1, 1.1, 1] : 
                 state === 'listening' ? dynamicScale :
                 state === 'processing' ? [1, 1.05, 1] : 1,
        }}
        transition={{
          duration: state === 'speaking' ? 0.5 : 
                   state === 'processing' ? 0.8 : 0.3,
          repeat: state === 'speaking' || state === 'processing' ? Infinity : 0,
          ease: "easeInOut",
        }}
        style={{
          boxShadow: `
            0 0 60px ${state === 'speaking' ? 'rgba(59, 130, 246, 0.6)' :
                       state === 'listening' ? 'rgba(34, 197, 94, 0.6)' :
                       state === 'processing' ? 'rgba(245, 158, 11, 0.6)' :
                       'rgba(156, 163, 175, 0.3)'}
          `
        }}
      >
        {/* Inner glow effect */}
        <motion.div
          className="absolute inset-2 rounded-full bg-white/30"
          animate={{
            opacity: state === 'idle' ? 0.1 : [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Icon in center */}
        <motion.div
          className="relative z-10 text-white"
          animate={{
            rotate: state === 'processing' ? 360 : 0,
          }}
          transition={{
            duration: state === 'processing' ? 2 : 0,
            repeat: state === 'processing' ? Infinity : 0,
            ease: "linear",
          }}
        >
          {state === 'speaking' ? (
            <Volume2 className="w-10 h-10" />
          ) : state === 'listening' ? (
            <Mic className="w-10 h-10" />
          ) : state === 'processing' ? (
            <Activity className="w-10 h-10" />
          ) : (
            <MicOff className="w-10 h-10" />
          )}
        </motion.div>

        {/* Voice activity indicator bars */}
        {(isListening || isSpeaking) && (
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center h-full pointer-events-none">
            <div className="flex items-end gap-1 mb-8">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white/60 rounded-full"
                  animate={{
                    height: isListening ? 
                      [4, Math.random() * 20 + 4, 4] :
                      [4, (i % 2 === 0 ? 20 : 12), 4],
                  }}
                  transition={{
                    duration: isListening ? 0.3 : 0.5,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Status text */}
      <motion.div
        className="absolute -bottom-10 left-0 right-0 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {state === 'speaking' ? 'Speaking...' :
           state === 'listening' ? 'Listening...' :
           state === 'processing' ? 'Processing...' :
           'Ready'}
        </p>
      </motion.div>

      {/* Decorative particles */}
      {(isSpeaking || isListening) && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-blue-400 rounded-full"
              style={{
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: [0, Math.cos((i * 60) * Math.PI / 180) * 80, 0],
                y: [0, Math.sin((i * 60) * Math.PI / 180) * 80, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}