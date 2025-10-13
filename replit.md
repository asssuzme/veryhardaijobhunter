# ai-jobhunter.com

## Overview
ai-jobhunter.com is a web service designed to automate job applications. It scrapes LinkedIn job data, enriches it with contact information, and generates AI-powered emails for application. The platform features Google OAuth authentication, a modern SaaS-inspired UI with glassmorphism effects and dark mode support, and Framer Motion animations. Key capabilities include resume upload (text and PDF), automated resume storage and reuse, and a comprehensive job search form with location autocomplete and predefined job roles. The service aims to provide a seamless and efficient job application experience.

## User Preferences
Preferred communication style: Technical and detailed explanations with specifics.

## Recent Changes

### October 13, 2025 - Professional Resume Formatting System
- **Voice Resume Builder**: Complete AI-powered voice interview system for resume creation
  - 9 structured interview questions covering personal info, experience, education, and skills
  - OpenAI Whisper for accurate audio transcription
  - GPT-4 generates polished, ATS-optimized resumes from interview responses
  - Automatic save to database with immediate availability
- **Professional Resume Viewer**: Beautiful resume display with 3 professional themes
  - **Modern Theme**: Gradient headers, purple/blue colors, card-based design
  - **Classic Theme**: Traditional serif fonts, formal layout, corporate-friendly
  - **Minimal Theme**: Clean lines, white space, modern sans-serif
  - Live theme preview and switching in Settings page
  - Structured resume parsing from plain text to JSON format
  - Proper typography, spacing, and visual hierarchy
- **PDF Generation**: Export resumes as professionally formatted PDFs
  - Uses pdf-lib for high-quality PDF rendering
  - Maintains theme styling in PDF output
  - ATS-optimized formatting for applicant tracking systems
  - One-click download from Settings page
- **Enhanced Settings Page**: Complete redesign with tabbed interface
  - "View Resume" tab: Live preview with theme selector and PDF download
  - "Edit & Upload" tab: Upload new resumes or view plain text
  - Improved UX for resume management
- **API Endpoints**: New backend routes for resume processing
  - `/api/resume/parse`: Convert plain text to structured format
  - `/api/resume/generate-pdf`: Generate PDF from structured data
  - `/api/resume/structured`: Get user's resume as structured JSON
- **Type Definitions**: Comprehensive TypeScript types for structured resumes
  - Personal info, experience, education, skills, projects, certifications
  - Theme configurations and resume layouts

### October 12, 2025 - UI Redesign & Email Quality Improvements
- **Job Card Redesign**: Complete UI overhaul with extreme vertical condensation
  - Reduced card height from ~400px to ~180px (65% reduction)
  - 2-3 job cards now fit in space of 1 card
  - Hidden job descriptions/requirements by default with "View Details" toggle
  - Modern design with icons, improved typography, and bookmark functionality
  - Optimized layout: compact metadata, smaller buttons, reduced padding
- **Email Generation Quality**: Implemented proven cold email templates
  - Integrated Nick Singh's "Hail Mary" and Soham Parekh's patterns
  - Direct, conversational tone (150-200 words max)
  - Opens with "Found your role on LinkedIn" + immediate credentials
  - Specific achievements with metrics from resume
  - Clear CTA: "When would be a good time to connect?"
  - Removed generic phrases and "Dear Hiring Manager"

### October 11, 2025 - Replit Environment Setup & Critical Bug Fixes
- **GitHub Import**: Successfully imported project from GitHub into Replit environment
- **Database Setup**: Provisioned PostgreSQL database and pushed schema using Drizzle
- **Development Server**: Configured workflow to run on port 5000 with proper Replit proxy support
- **Host Configuration**: Verified Vite dev server configured with `host: 0.0.0.0` and `allowedHosts: true` for Replit iframe proxy
- **Deployment Configuration**: Set up autoscale deployment with build command `npm run build` and run command `npm start`
- **API Keys Configured**: All required API keys added (Google OAuth, OpenAI, Apify, Dodo Payments)
- **Critical Bug Fixes**:
  - **Job Card Display**: Fixed missing company logos and job titles - now properly maps all fields from backend
  - **View Job Links**: Fixed broken LinkedIn job links - now correctly opens actual job listings in new tabs
  - **Email Composer Context**: Enhanced AI email generation with specific job context, resume details, and company information
  - **TypeScript Fixes**: Resolved all 54 LSP diagnostics for clean compilation
- **Application Status**: Fully functional with all core features working correctly

### October 8, 2025 - Repository Cleanup & Gmail Authorization Fix
- **Gmail OAuth Fix**: Resolved database constraint error when Google doesn't return refresh token on re-authorization
- **Smart Token Preservation**: Now preserves existing refresh tokens during OAuth updates instead of requiring new consent
- **Repository Cleanup**: Removed unused files to streamline deployment:
  - Deleted old page files (home-old.tsx, results-old.tsx)
  - Removed unused auth systems (supabaseAuth, replitAuth, simpleGoogleAuth)
  - Removed unused payment integrations (PayPal, Instamojo, Razorpay)
  - Cleaned up temporary documentation and files
- **Deployment Ready**: Updated .env.example with comprehensive variable documentation
- **Codebase Organization**: Streamlined to only include actively used authentication (Google OAuth + Gmail) and payment (Dodo Payments primary, Cashfree backup) systems
- **Zero LSP Errors**: Clean TypeScript compilation with no diagnostics

### October 6, 2025 - Critical Authentication Fix
- **HTTPS Cookie Configuration**: Fixed session cookies for Replit's HTTPS development environment
- **Root Cause**: Replit dev URLs use HTTPS (*.replit.dev) but NODE_ENV=development, causing cookie security mismatch
- **Session Fix**: Detects HTTPS/Replit environment and sets `secure: true` + `sameSite: 'none'` for proper cross-origin cookies
- **Logout Fix**: Updated logout to clear cookies with matching security configuration
- **Browser Compatibility**: Resolves intermittent signin/signup failures across Safari, Chrome, and Comet browsers
- **Production Ready**: Cookie configuration automatically adapts to localhost (insecure) vs Replit/production (secure HTTPS)

### October 2, 2025 - Dodo Payments Integration for Pro Plan
- **Payment Gateway**: Integrated Dodo Payments for Pro plan subscriptions ($29/month)
- **Database Schema**: Added dodoPayments table to track payment transactions, checkout sessions, and subscription status
- **Backend Services**: Created Dodo Payments service layer for checkout session creation and payment verification
- **API Routes**: Implemented `/api/payments/checkout`, `/api/payments/webhook/dodo`, `/api/payments/subscription-status`, and `/api/payments/history`
- **Webhook Security**: Proper webhook signature verification using StandardWebhooks for secure payment processing
- **Frontend UI**: Beautiful Pro plan upgrade page with pricing, features, and seamless Dodo Payments checkout integration
- **Pro Features**: Unlimited job searches, access to all jobs (including those without discoverable emails), priority support, and Pro badge
- **Subscription Management**: 30-day subscription with automatic renewal tracking and expiration handling

### September 28, 2025 - GitHub Preparation & Documentation
- **CRITICAL BUG RESOLVED**: Fixed Free Plan vs Pro Plan display showing "0 unlocked jobs" instead of actual count
- **TypeScript Cleanup**: Reduced errors from 49 to 37 through proper type casting and error handling
- **Comprehensive Documentation**: Created README.md, DEVELOPER_GUIDE.md, and GITHUB_SETUP_GUIDE.md
- **GitHub Ready**: All files organized and ready for GitHub push with proper .gitignore configuration
- **API Response Fixes**: Corrected data structure mismatches between frontend expectations and backend responses
- **Database Field Mapping**: Fixed snake_case vs camelCase field access issues in API responses
- **Code Organization**: Cleaned up duplicate entries and organized project structure for production readiness

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **UI Components**: Shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with custom glassmorphism, gradient designs, and animation utilities.
- **State Management**: TanStack Query (React Query) for server state management.
- **Routing**: Wouter for client-side routing.
- **Forms**: React Hook Form with Zod validation.
- **Design Features**: Modern UI with gradient buttons, glassmorphic cards, animated elements, dark/light mode, and enhanced visual feedback. Color scheme: deep navy blue, marble white, and muted gold accent.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **API Design**: RESTful API supporting async job processing and status polling.
- **Data Validation**: Zod schemas for request validation.
- **Error Handling**: Centralized middleware for structured error responses.

### Data Storage Solutions
- **Database**: PostgreSQL with Neon Database serverless PostgreSQL.
- **ORM**: Drizzle ORM with TypeScript-first schema definitions and Drizzle Kit for migrations.
- **Schema Design**: Tables for job scraping requests (metadata, status, results JSON), user data (including resume storage), and subscription/payment information.

### API Architecture
- **Request Flow**: Asynchronous job processing, returning tracking IDs for polling.
- **Status Polling**: Clients poll GET endpoints for real-time status updates.
- **Data Validation**: LinkedIn URL validation, AI-powered location normalization to LinkedIn geoIds, and work type mapping.
- **Gmail Integration**: Automatic token refresh for Gmail API to send emails on behalf of users with automatic resume attachment.
- **Authentication**: Two-step OAuth flow allowing separate authentication for basic login and Gmail authorization.
- **Resume Attachment**: Every email sent via Gmail API automatically includes the user's uploaded resume as an attachment.

## External Dependencies

- **Database**: Neon Database (serverless PostgreSQL).
- **UI Framework**: Radix UI.
- **Build Tools**: ESBuild (server bundling), Vite (client-side development).
- **Validation**: Zod.
- **Styling**: Tailwind CSS.
- **Authentication**: Google OAuth 2.0 (for user authentication and Gmail API access).
- **APIs**: Apify (for LinkedIn job scraping and email verification), OpenAI (for personalized email generation), Dodo Payments (primary payment gateway for Pro plan subscriptions).

## Required Environment Variables

The following environment variables must be configured in Replit Secrets for the application to function properly:

### Critical (Required for Application to Start)
- **SESSION_SECRET**: Secure random string for session encryption. Generate using: `openssl rand -base64 32`
- **DATABASE_URL**: PostgreSQL connection string (auto-configured by Replit Database)

### Google OAuth & Gmail Integration (Required for Authentication)
- **GOOGLE_CLIENT_ID**: OAuth 2.0 client ID from Google Cloud Console
- **GOOGLE_CLIENT_SECRET**: OAuth 2.0 client secret from Google Cloud Console
- Setup Guide: https://console.cloud.google.com/ → APIs & Services → Credentials
- Required APIs: Google+ API, Gmail API
- Callback URL: `https://your-repl-url.replit.dev/api/auth/google/callback`

### AI & Job Scraping (Required for Core Features)
- **OPENAI_API_KEY**: OpenAI API key for email generation (from https://platform.openai.com/)
- **APIFY_API_KEY**: Apify API token for LinkedIn scraping (from https://apify.com/)

### Payment Processing (Optional - Pro Plan Features)
- **DODO_API_KEY**: Dodo Payments API key for subscription management
- **DODO_WEBHOOK_SECRET**: Dodo Payments webhook secret for payment verification
- Setup Guide: https://dodopayments.com/ → Developer Settings
- Webhook URL: `https://your-repl-url.replit.dev/api/payments/webhook/dodo`

### Database Configuration (Auto-configured by Replit)
These are automatically set when you provision a PostgreSQL database in Replit:
- **PGHOST**: PostgreSQL host
- **PGPORT**: PostgreSQL port (default: 5432)
- **PGUSER**: PostgreSQL username
- **PGPASSWORD**: PostgreSQL password
- **PGDATABASE**: PostgreSQL database name

## Setup Instructions for New Deployments

1. **Provision Database**: Create a PostgreSQL database in Replit
2. **Add Required Secrets**: Configure SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, APIFY_API_KEY
3. **Initialize Database**: Run `npm run db:push` to create tables
4. **Start Development**: The workflow will automatically start on port 5000
5. **Configure OAuth**: Add your Replit URL to Google OAuth authorized redirect URIs
6. **Test Authentication**: Visit your app and try signing in with Google

Note: Payment features (Dodo Payments) are optional and can be configured later. The app will run without them, with payment features disabled.