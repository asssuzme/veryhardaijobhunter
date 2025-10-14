import { VapiClient } from '@vapi-ai/server-sdk';
import { db } from '../db';
import { vapiCalls } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Vapi client with hardcoded key
const vapi = new VapiClient({
  token: process.env.VAPI_API_KEY || '4be7cd46-4c1e-45c8-b919-7cbabf4da23d'
});

// Interview questions for the assistant
const INTERVIEW_QUESTIONS = [
  "Let's start with your name. How would you like to be addressed professionally?",
  "What's the best email and phone number to reach you at?",
  "What city and state are you located in?",
  "Tell me about yourself in 2-3 sentences. What makes you unique as a professional?",
  "What's your most recent job title and company? Tell me about your role there.",
  "What were your main responsibilities in that position?",
  "What professional achievements are you most proud of? Try to include specific numbers or results if you can.",
  "What's your educational background? Include your degree, school, and graduation year if relevant.",
  "Do you have any certifications or special training?",
  "What are your top technical skills and tools you're proficient with?",
  "Any soft skills or languages you'd like to highlight?",
  "Finally, what type of role are you looking for? What's your ideal next position?"
];

// Create assistant configuration
export const createResumeAssistant = async () => {
  console.log('Creating new Vapi assistant...');
  
  try {
    // Simplified configuration for initial testing
    const assistantConfig: any = {
      name: "Professional Resume Builder",
      model: {
        provider: "openai" as const,
        model: "gpt-3.5-turbo", // Start with 3.5 for faster responses
        temperature: 0.7,
        messages: [
          {
            role: "system" as const,
            content: `You are a professional career coach conducting a resume interview. Be warm and professional.

Ask these questions one at a time:
${INTERVIEW_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Keep responses brief and natural. Ask one question, wait for the answer, then move to the next.`
          }
        ]
      },
      voice: {
        provider: "11labs" as const,
        voiceId: "21m00Tcm4TlvDq8ikWAM" // Rachel voice
      },
      firstMessage: "Hello! I'm your career coach. Let's create your resume. First, what's your name?",
      maxDurationSeconds: 600 // Start with 10 minutes for testing
    };
    
    console.log('Assistant config:', JSON.stringify(assistantConfig, null, 2));
    
    const assistant = await vapi.assistants.create(assistantConfig);
    
    console.log('Assistant created successfully:', {
      id: assistant.id,
      name: assistant.name
    });
    
    return assistant;
  } catch (error: any) {
    console.error('Error creating Vapi assistant:', error.message || error);
    console.error('Full error details:', error);
    
    // Try to parse error if it's a response object
    if (error.response) {
      console.error('Error response:', error.response.data || error.response);
    }
    
    throw new Error(`Failed to create assistant: ${error.message || 'Unknown error'}`);
  }
};

// Start a new Vapi interview session
export const startVapiInterview = async (userId: string, userName?: string) => {
  console.log('startVapiInterview called for user:', userId, 'userName:', userName);
  
  try {
    // Vapi API key is hardcoded, no need to check
    
    // Create or get assistant
    console.log('Listing existing assistants...');
    let assistantsList;
    let resumeAssistant: any = null;
    
    try {
      assistantsList = await vapi.assistants.list();
      console.log('Assistants list response type:', typeof assistantsList);
      console.log('Assistants list keys:', assistantsList ? Object.keys(assistantsList) : 'null');
      
      // Handle different response structures
      if (Array.isArray(assistantsList)) {
        console.log('Response is array with', assistantsList.length, 'assistants');
        resumeAssistant = assistantsList.find(a => a.name === "Professional Resume Builder");
      } else if ((assistantsList as any)?.items) {
        console.log('Response has items array with', (assistantsList as any).items.length, 'assistants');
        resumeAssistant = (assistantsList as any).items.find((a: any) => a.name === "Professional Resume Builder");
      } else if ((assistantsList as any)?.data) {
        console.log('Response has data array with', (assistantsList as any).data.length, 'assistants');
        resumeAssistant = (assistantsList as any).data.find((a: any) => a.name === "Professional Resume Builder");
      } else {
        console.log('Unknown assistants list structure:', assistantsList);
      }
    } catch (listError: any) {
      console.error('Error listing assistants:', listError.message || listError);
      // Continue - we'll create a new assistant
    }
    
    if (!resumeAssistant) {
      console.log('No existing assistant found, creating new one...');
      resumeAssistant = await createResumeAssistant();
    } else {
      console.log('Found existing assistant:', resumeAssistant.id);
    }

    console.log('Assistant ready, ID:', resumeAssistant.id);

    // For web SDK, we don't create a call server-side
    // The client will use the assistant ID to start the call
    console.log('Returning assistant info for web SDK...');
    
    // Store initial call record (will be updated via webhook)
    const callRecord = {
      userId,
      callId: `pending-${Date.now()}`, // Temporary ID until we get real call ID from webhook
      assistantId: resumeAssistant.id,
      status: 'pending',
      metadata: {
        userName,
        startedAt: new Date().toISOString()
      }
    };
    
    console.log('Inserting initial call record:', callRecord);
    await db.insert(vapiCalls).values(callRecord);

    // Return assistant info for the client to use
    const response = {
      success: true,
      callId: callRecord.callId,
      assistantId: resumeAssistant.id,
      assistantName: resumeAssistant.name
    };
    
    console.log('Returning response:', response);
    return response;
    
  } catch (error: any) {
    console.error('Error in startVapiInterview:', error.message || error);
    console.error('Full error:', error);
    
    // Provide more specific error message
    if (error.message?.includes('VAPI_API_KEY')) {
      throw new Error('Vapi API key not configured. Please set VAPI_API_KEY environment variable.');
    }
    
    throw new Error(`Failed to start interview: ${error.message || 'Unknown error'}`);
  }
};

// Get call transcript
export const getCallTranscript = async (callId: string, userId: string) => {
  try {
    // Verify call belongs to user
    const [callRecord] = await db
      .select()
      .from(vapiCalls)
      .where(eq(vapiCalls.callId, callId))
      .limit(1);

    if (!callRecord || callRecord.userId !== userId) {
      throw new Error('Call not found or unauthorized');
    }

    // Get call details from Vapi
    const call = await vapi.calls.get(callId);
    
    // Extract transcript from messages
    const transcript = call.messages?.map((msg: any) => 
      `${msg.role}: ${msg.content}`
    ).join('\n');
    
    // Calculate duration if endedAt and startedAt exist
    const duration = call.endedAt && call.startedAt 
      ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000 
      : undefined;
    
    // Update database with transcript
    if (transcript) {
      await db
        .update(vapiCalls)
        .set({
          transcript: transcript,
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(vapiCalls.callId, callId));
    }

    return {
      success: true,
      transcript: transcript,
      messages: call.messages,
      duration: duration,
      endedReason: call.endedReason
    };
  } catch (error) {
    console.error('Error getting call transcript:', error);
    throw error;
  }
};

// Handle Vapi webhook events
export const handleVapiWebhook = async (event: any) => {
  try {
    const { type, call, message } = event;

    switch (type) {
      case 'call-started':
        await db
          .update(vapiCalls)
          .set({
            status: 'in_progress',
            metadata: {
              ...(call.metadata || {}),
              startedAt: new Date().toISOString()
            }
          })
          .where(eq(vapiCalls.callId, call.id));
        break;

      case 'call-ended':
        // Extract transcript from messages
        const transcript = call.messages?.map((msg: any) => 
          `${msg.role}: ${msg.content}`
        ).join('\n');
        
        // Calculate duration if endedAt and startedAt exist
        const duration = call.endedAt && call.startedAt 
          ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000 
          : undefined;
        
        await db
          .update(vapiCalls)
          .set({
            status: 'completed',
            transcript: transcript,
            duration: duration,
            completedAt: new Date(),
            metadata: {
              ...(call.metadata || {}),
              endedAt: new Date().toISOString(),
              endedReason: call.endedReason
            }
          })
          .where(eq(vapiCalls.callId, call.id));
        break;

      case 'transcript':
        // Update transcript in real-time
        if (message && message.transcript) {
          await db
            .update(vapiCalls)
            .set({
              transcript: message.transcript
            })
            .where(eq(vapiCalls.callId, call.id));
        }
        break;

      case 'error':
        await db
          .update(vapiCalls)
          .set({
            status: 'failed',
            errorMessage: event.error?.message || 'Unknown error'
          })
          .where(eq(vapiCalls.callId, call.id));
        break;

      default:
        console.log(`Unhandled Vapi webhook event: ${type}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling Vapi webhook:', error);
    throw error;
  }
};

// Generate resume from Vapi transcript
export const generateResumeFromTranscript = async (callId: string, userId: string) => {
  try {
    // Get call record with transcript
    const [callRecord] = await db
      .select()
      .from(vapiCalls)
      .where(eq(vapiCalls.callId, callId))
      .limit(1);

    if (!callRecord || callRecord.userId !== userId) {
      throw new Error('Call not found or unauthorized');
    }

    if (!callRecord.transcript) {
      throw new Error('No transcript available for this call');
    }

    // Extract information from transcript using OpenAI
    const openai = (await import('openai')).default;
    const client = new openai({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a professional resume writer. Extract information from the interview transcript and create a well-formatted resume.

Format the resume with the following sections:
1. Name and Contact Information
2. Professional Summary (2-3 sentences)
3. Work Experience (with bullet points for achievements)
4. Education
5. Skills
6. Additional Information (if relevant)

Use professional language and action verbs. Include specific metrics and achievements when mentioned.`
        },
        {
          role: "user",
          content: `Create a professional resume from this interview transcript:\n\n${callRecord.transcript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const resumeText = completion.choices[0].message.content;

    // Update call record with generated resume
    await db
      .update(vapiCalls)
      .set({
        generatedResume: resumeText,
        metadata: {
          ...(callRecord.metadata || {}),
          resumeGeneratedAt: new Date().toISOString()
        }
      })
      .where(eq(vapiCalls.callId, callId));

    return {
      success: true,
      resume: resumeText
    };
  } catch (error) {
    console.error('Error generating resume from transcript:', error);
    throw error;
  }
};

// Check if user has available Vapi credits
export const checkVapiCredits = async (userId: string) => {
  try {
    // Get user's Vapi usage
    const calls = await db
      .select()
      .from(vapiCalls)
      .where(eq(vapiCalls.userId, userId));

    // Check if user has pro subscription
    const [user] = await db
      .select()
      .from((await import('@shared/schema')).users)
      .where(eq((await import('@shared/schema')).users.id, userId))
      .limit(1);

    const hasProSubscription = user?.subscriptionStatus === 'active';
    const freeCallsUsed = calls.filter(c => !c.isPaid).length;
    const freeCallsLimit = 1; // 1 free trial call

    return {
      hasProSubscription,
      freeCallsUsed,
      freeCallsLimit,
      canUseVapi: hasProSubscription || freeCallsUsed < freeCallsLimit,
      requiresPayment: !hasProSubscription && freeCallsUsed >= freeCallsLimit
    };
  } catch (error) {
    console.error('Error checking Vapi credits:', error);
    throw error;
  }
};