import { Router } from 'express';
import { 
  startVapiInterview, 
  getCallTranscript, 
  handleVapiWebhook, 
  generateResumeFromTranscript,
  checkVapiCredits 
} from '../services/vapi';
import { db } from '../db';
import { users, dodoPayments, vapiCalls } from '@shared/schema';
import { eq } from 'drizzle-orm';
import DodoPayments from 'dodopayments';

const router = Router();

// Initialize Dodo Payments client (only if key is available)
let dodo: any = null;
if (process.env.DODO_SECRET_KEY) {
  dodo = new DodoPayments({ 
    bearerToken: process.env.DODO_SECRET_KEY,
    environment: (process.env.DODO_ENVIRONMENT || 'test_mode') as 'test_mode' | 'live_mode'
  });
}

// Middleware to check if user is authenticated
const requireAuth = async (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Check user's Vapi credits
router.get('/api/resume/vapi/credits', requireAuth, async (req: any, res) => {
  try {
    const credits = await checkVapiCredits(req.session.userId);
    res.json(credits);
  } catch (error) {
    console.error('Error checking Vapi credits:', error);
    res.status(500).json({ error: 'Failed to check credits' });
  }
});

// Start a new Vapi interview session (FREE - no payment required)
router.post('/api/resume/vapi/start-interview', requireAuth, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const { userName } = req.body;

    console.log('Starting Vapi interview for user:', userId, 'with name:', userName);

    // Start Vapi interview directly - no payment checks
    const result = await startVapiInterview(userId, userName);
    
    console.log('Vapi interview started successfully:', result);
    
    // Add the Vapi public key to the response
    const response = {
      ...result,
      publicKey: process.env.VAPI_PUBLIC_KEY || '668f8fb5-3aac-45f9-ab43-591b20c985d4'
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('Error starting Vapi interview:', error.message || error);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Failed to start interview',
      details: error.message || 'Unknown error occurred',
      success: false 
    });
  }
});

// Get transcript for a specific call
router.get('/api/resume/vapi/transcript/:callId', requireAuth, async (req: any, res) => {
  try {
    const { callId } = req.params;
    const userId = req.session.userId;

    const transcript = await getCallTranscript(callId, userId);
    res.json(transcript);
  } catch (error) {
    console.error('Error getting transcript:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

// Generate resume from Vapi transcript
router.post('/api/resume/vapi/generate', requireAuth, async (req: any, res) => {
  try {
    const { callId, transcript } = req.body;
    const userId = req.session.userId;

    let result;
    
    // If transcript is provided directly, use it
    if (transcript) {
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
            content: `Create a professional resume from this interview transcript:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const resumeText = completion.choices[0].message.content;
      
      result = {
        success: true,
        resume: resumeText
      };
    } else if (callId) {
      // Fallback to fetching transcript from database
      result = await generateResumeFromTranscript(callId, userId);
    } else {
      throw new Error('No transcript or callId provided');
    }
    
    // Save resume to user's profile
    if (result.success && result.resume) {
      await db
        .update(users)
        .set({
          resumeText: result.resume,
          resumeUploadedAt: new Date()
        })
        .where(eq(users.id, userId));
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating resume:', error);
    res.status(500).json({ error: 'Failed to generate resume' });
  }
});

// Webhook endpoint for Vapi events
router.post('/api/resume/vapi/webhook', async (req, res) => {
  try {
    // Verify webhook signature if needed
    const signature = req.headers['x-vapi-signature'] as string;
    
    // TODO: Verify signature with Vapi secret
    
    const result = await handleVapiWebhook(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error handling Vapi webhook:', error);
    res.status(500).json({ error: 'Failed to handle webhook' });
  }
});

// Handle payment success callback for Vapi
router.post('/api/resume/vapi/payment-success', requireAuth, async (req: any, res) => {
  try {
    const { paymentId, sessionId } = req.body;
    const userId = req.session.userId;

    // Check if payment service is configured
    if (!dodo) {
      return res.status(503).json({ error: 'Payment service not configured' });
    }

    // Verify payment with Dodo
    const payment = await dodo.payment.getPayment(paymentId);
    
    if (payment.status === 'succeeded') {
      // Create a new payment record
      await db.insert(dodoPayments).values({
        userId,
        paymentId: payment.id,
        checkoutSessionId: sessionId,
        amount: 299, // $2.99 in cents
        currency: 'USD',
        status: 'succeeded',
        productId: 'vapi_interview',
        metadata: {
          type: 'vapi_interview',
          timestamp: new Date().toISOString()
        }
      });

      // Mark that user can now start interview
      res.json({
        success: true,
        message: 'Payment successful. You can now start your Pro Voice Interview.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }
  } catch (error) {
    console.error('Error processing payment success:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Get user's Vapi call history
router.get('/api/resume/vapi/history', requireAuth, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    
    const calls = await db
      .select()
      .from(vapiCalls)
      .where(eq(vapiCalls.userId, userId))
      .orderBy(vapiCalls.createdAt);

    res.json(calls);
  } catch (error) {
    console.error('Error getting call history:', error);
    res.status(500).json({ error: 'Failed to get call history' });
  }
});

export default router;