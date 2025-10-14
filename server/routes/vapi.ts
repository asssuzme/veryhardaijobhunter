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

// Start a new Vapi interview session
router.post('/api/resume/vapi/start-interview', requireAuth, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const { userName } = req.body;

    // Check if user can use Vapi
    const credits = await checkVapiCredits(userId);
    
    if (credits.requiresPayment) {
      // Create payment session for $2.99
      if (!dodo) {
        return res.status(503).json({ error: 'Payment service not configured. Please contact support.' });
      }
      
      try {
        const payment = await dodo.payment.createPaymentLink({
          name: 'Pro Voice Interview Session',
          description: 'Professional AI-powered resume interview with natural conversation',
          currency: 'USD',
          amount: 2.99,
          quantity: 1,
          redirect_url: `${process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS : 'http://localhost:5000'}/payment-success?type=vapi`,
          metadata: {
            userId,
            type: 'vapi_interview'
          }
        });

        return res.json({
          requiresPayment: true,
          paymentUrl: payment.url,
          message: 'Payment required for Pro Voice Interview'
        });
      } catch (paymentError) {
        console.error('Error creating payment:', paymentError);
        return res.status(500).json({ error: 'Failed to create payment session' });
      }
    }

    // Start Vapi interview
    const result = await startVapiInterview(userId, userName);
    
    res.json(result);
  } catch (error) {
    console.error('Error starting Vapi interview:', error);
    res.status(500).json({ error: 'Failed to start interview' });
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
    const { callId } = req.body;
    const userId = req.session.userId;

    const result = await generateResumeFromTranscript(callId, userId);
    
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