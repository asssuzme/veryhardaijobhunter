import { VapiClient } from '@vapi-ai/server-sdk';
import { db } from '../db';
import { vapiCalls } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Vapi client
const vapi = new VapiClient({
  token: process.env.VAPI_API_KEY || ''
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
  try {
    const assistant = await vapi.assistants.create({
      name: "Professional Resume Builder",
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a professional career coach conducting a resume interview. Your goal is to gather comprehensive information about the candidate's professional background to create a compelling resume.

Guidelines:
1. Be warm, professional, and encouraging
2. Ask one question at a time
3. Listen carefully and ask relevant follow-up questions
4. Keep the conversation natural and flowing
5. Acknowledge responses positively before moving to the next question
6. If the candidate seems stuck, offer helpful prompts or examples
7. Keep responses concise but informative
8. Extract key achievements with specific metrics when possible

Interview Questions to Cover (in order):
${INTERVIEW_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

After gathering all information, summarize the key points and confirm you have everything needed to create a professional resume.`
          }
        ]
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - Professional female voice
        stability: 0.5,
        similarityBoost: 0.8,
        style: 0,
        useSpeakerBoost: true
      },
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
        smartFormat: true,
        keywords: ["resume", "experience", "education", "skills", "achievement"]
      },
      firstMessage: "Hello! I'm your professional career coach, and I'm here to help you create an outstanding resume. We'll have a natural conversation about your background and experience. Feel free to interrupt me or ask questions at any time. Let's start with your name. How would you like to be addressed professionally?",
      endCallMessage: "Thank you for sharing your professional background with me. I have all the information I need to create your resume. Have a great day!",
      server: {
        url: `${process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS : 'http://localhost:5000'}/api/resume/vapi/webhook`
      },
      maxDurationSeconds: 1800, // 30 minutes max
      backgroundSound: "office"
    });

    return assistant;
  } catch (error) {
    console.error('Error creating Vapi assistant:', error);
    throw error;
  }
};

// Start a new Vapi interview session
export const startVapiInterview = async (userId: string, userName?: string) => {
  try {
    // Create or get assistant
    let assistantsList = await vapi.assistants.list();
    let resumeAssistant: any = null;
    
    // Handle different response structures
    if (Array.isArray(assistantsList)) {
      resumeAssistant = assistantsList.find(a => a.name === "Professional Resume Builder");
    } else if ((assistantsList as any)?.items) {
      resumeAssistant = (assistantsList as any).items.find((a: any) => a.name === "Professional Resume Builder");
    } else if ((assistantsList as any)?.data) {
      resumeAssistant = (assistantsList as any).data.find((a: any) => a.name === "Professional Resume Builder");
    }
    
    if (!resumeAssistant) {
      resumeAssistant = await createResumeAssistant();
    }

    // Create web call
    const callResponse = await vapi.calls.create({
      assistantId: resumeAssistant.id,
      customer: {
        name: userName || "User",
        number: "+10000000000" // Placeholder number for web calls
      },
      phoneNumberId: undefined // Web call, no phone number needed
    });

    // Handle both single call response and batch response
    const call = 'id' in callResponse ? callResponse : (callResponse as any).calls?.[0];
    
    if (!call || !call.id) {
      throw new Error('Failed to create call');
    }

    // Store call in database
    await db.insert(vapiCalls).values({
      userId,
      callId: call.id,
      assistantId: resumeAssistant.id,
      status: 'started',
      metadata: {
        userName,
        startedAt: new Date().toISOString()
      }
    });

    // Return the web call URL for the client
    return {
      success: true,
      callId: call.id,
      webCallUrl: `https://vapi.ai/call/${call.id}`,
      assistantId: resumeAssistant.id
    };
  } catch (error) {
    console.error('Error starting Vapi interview:', error);
    throw error;
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