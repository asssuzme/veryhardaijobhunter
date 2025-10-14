import { VapiClient } from '@vapi-ai/server-sdk';
import { db } from '../db';
import { vapiCalls } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Vapi client with hardcoded key
const vapi = new VapiClient({
  token: process.env.VAPI_API_KEY || '4be7cd46-4c1e-45c8-b919-7cbabf4da23d'
});

// Enhanced interview questions for the assistant
const INTERVIEW_QUESTIONS = [
  "Let's start with your name. How would you like to be addressed professionally?",
  "What's the best email and phone number to reach you at? Also, do you have a LinkedIn profile or professional website to include?",
  "What city and state are you located in? Are you open to relocation or remote work?",
  "Describe yourself as a professional in 3-4 sentences. What's your biggest strength and what value do you bring to employers?",
  "What's your most recent or current job title and company? How long have you been in this role?",
  "Walk me through your key responsibilities and the size of your team or budget if applicable.",
  "What are your top 3-5 professional achievements? Please be specific with numbers - like percentages improved, money saved, team sizes, or projects delivered.",
  "Tell me about your previous work experience before your current role. Include company names, titles, and major accomplishments.",
  "What's your educational background? Include your degree, major, university, and graduation year.",
  "Do you have any certifications, professional licenses, or specialized training?",
  "What are your technical skills? Include programming languages, software, tools, frameworks, and platforms you're proficient with.",
  "What are your key soft skills and professional competencies? Also, any languages you speak?",
  "Tell me about any notable projects you've led or contributed to. What was the outcome?",
  "What type of role are you targeting? What's your ideal position, industry, and company size?"
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
            content: `You are an elite career coach with 20 years of experience helping professionals craft compelling resumes. Your goal is to extract detailed, quantified achievements and specific accomplishments that will make their resume stand out.

INTERVIEW APPROACH:
- Be warm, encouraging, and professional
- Probe for specific numbers, metrics, and results
- Ask follow-up questions when answers are vague
- Encourage the candidate to quantify their achievements
- Help them remember important details they might forget

Ask these questions one at a time, and feel free to ask follow-ups:
${INTERVIEW_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

PROBING TECHNIQUES:
- If they mention a project, ask: "What was the impact? Any metrics?"
- If they mention a team, ask: "How many people? What was your role?"
- If they mention improvement, ask: "By how much? What was the before/after?"
- If they mention saving money/time, ask: "Can you estimate how much?"
- If they mention leadership, ask: "What specific results did you achieve?"

Remember: The more specific details we gather, the stronger their resume will be. Help them shine!`
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
          content: `You are an elite professional resume writer with 15+ years of experience. Extract information from the interview transcript and create a powerful, ATS-optimized resume.

FORMAT THE RESUME EXACTLY AS FOLLOWS:

**[Full Name]**
[Email] | [Phone] | [City, State] | [LinkedIn URL if provided] | [Website if provided]

---

**PROFESSIONAL SUMMARY**
[3-4 powerful sentences capturing their expertise, unique value, and career objectives. Make it compelling!]

**PROFESSIONAL EXPERIENCE**

**[Job Title] | [Company Name]**
[City, State] | [MM/YYYY] - [MM/YYYY or Present]
• [Quantified achievement with strong action verb and specific metrics]
• [Another measurable accomplishment showing impact]
• [Leadership or collaboration achievement with team size/scope]
• [Process improvement or innovation with results]
• [Additional significant contribution]
[Include 4-6 bullets per role, all starting with powerful action verbs]

**EDUCATION**

**[Degree] in [Major]**
[University] | [City, State] | [MM/YYYY]
• GPA: [if mentioned and 3.5+]
• Relevant Coursework: [if mentioned]
• Achievements: [honors, awards if mentioned]

**CERTIFICATIONS & TRAINING**
• [Certification Name] | [Issuer] | [Date]
[List all mentioned certifications]

**TECHNICAL SKILLS**
• Programming: [Languages with proficiency levels]
• Frameworks: [All mentioned frameworks]
• Tools & Platforms: [Development tools, cloud platforms]
• Databases: [Database technologies]

**PROFESSIONAL COMPETENCIES**
• Leadership: [Specific leadership skills demonstrated]
• Communication: [Communication strengths]
• Other: [Problem-solving, analytical skills, etc.]

**NOTABLE PROJECTS** (if mentioned)
**[Project Name]**
• Technologies: [Tech stack]
• Impact: [Business value and results]

ACTION VERBS TO USE:
Spearheaded, Orchestrated, Championed, Pioneered, Transformed, Optimized, 
Streamlined, Enhanced, Accelerated, Delivered, Architected, Innovated

CRITICAL RULES:
- Extract EVERY specific number, percentage, or metric mentioned
- Use the strongest action verbs possible
- Ensure dates are in MM/YYYY format
- Make every bullet point show measurable impact
- If numbers aren't exact in transcript, use ranges (e.g., "10-15 team members")
- NO generic phrases like "responsible for" or "helped with"`
        },
        {
          role: "user",
          content: `Create a professional resume from this interview transcript. Extract ALL details, metrics, and accomplishments:\n\n${callRecord.transcript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 3000
    });

    let resumeText = completion.choices[0].message.content || '';

    // Import enhancement utilities and post-process the resume
    const { enhanceResumeText, validateResume } = await import('../utils/resume-enhancer');
    
    // Enhance the generated resume
    resumeText = enhanceResumeText(resumeText);
    
    // Validate the resume quality
    const validation = validateResume(resumeText);
    if (!validation.isValid) {
      console.log('[VAPI-RESUME] Quality issues detected:', validation.issues);
      // Continue anyway, but log the issues for monitoring
    }

    // Update call record with enhanced resume
    await db
      .update(vapiCalls)
      .set({
        generatedResume: resumeText,
        metadata: {
          ...(callRecord.metadata || {}),
          resumeGeneratedAt: new Date().toISOString(),
          qualityValidation: validation
        }
      })
      .where(eq(vapiCalls.callId, callId));

    return {
      success: true,
      resume: resumeText,
      qualityValidation: validation
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