# AI JobHunter 🎯

A sophisticated AI-powered job hunting platform that automates the entire job application process from LinkedIn job discovery to personalized email outreach.

## 🚀 Overview

AI JobHunter automates job applications through:
- **LinkedIn Job Scraping**: Extracts job postings with advanced filtering
- **Contact Discovery**: Finds hiring manager email addresses via LinkedIn profile scraping  
- **AI Email Generation**: Creates personalized application emails using OpenAI
- **Automated Gmail Sending**: Sends emails with resume attachments automatically
- **Free vs Pro Tiers**: Shows jobs with contact info for free, premium jobs require Pro plan

## ✨ Key Features

### Core Functionality
- 🔍 **Smart Job Scraping**: LinkedIn job search with quality filtering
- 📧 **Contact Extraction**: Finds decision-maker emails from LinkedIn profiles
- 🤖 **AI Email Generation**: Personalized emails using OpenAI GPT-4
- 📎 **Resume Integration**: Automatic resume attachment to all emails
- 🎙️ **Voice Resume Builder**: Create professional resumes through AI-powered voice interview
- 📄 **Professional Resume Viewer**: View resumes in 3 beautiful themes (Modern, Classic, Minimal)
- 🖨️ **PDF Generation**: Export resumes as professionally formatted PDFs
- 🚀 **Complete Automation**: End-to-end job application workflow

### User Experience  
- 🎨 **Modern UI**: Glassmorphism design with dark/light mode
- 📱 **Responsive Design**: Works perfectly on all devices
- 🔐 **Google OAuth**: Secure authentication and Gmail integration
- 📊 **Real-time Progress**: Live updates during job processing
- 📈 **Analytics Dashboard**: Track applications and success metrics
- 🎙️ **Voice Interface**: Speak your resume details instead of typing
- 📋 **Resume Templates**: Choose from multiple professional themes
- 💳 **Pro Plan Subscriptions**: Seamless payment integration with Dodo Payments ($29/month)

### Technical Architecture
- ⚡ **React 18 + TypeScript**: Modern frontend with type safety
- 🌟 **Shadcn/UI + Tailwind**: Beautiful, accessible components
- 🔧 **Node.js + Express**: Robust backend API
- 🗃️ **PostgreSQL + Drizzle**: Type-safe database operations
- 🔄 **TanStack Query**: Efficient state management
- 🎭 **Framer Motion**: Smooth animations and transitions

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript and Vite
- **Shadcn/ui** built on Radix UI primitives
- **Tailwind CSS** with custom glassmorphism effects
- **TanStack Query** for server state management
- **Wouter** for client-side routing
- **React Hook Form + Zod** for form validation
- **Framer Motion** for animations

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **Drizzle ORM** with PostgreSQL
- **Google OAuth 2.0** for authentication
- **Gmail API** for email sending
- **OpenAI API** for email generation
- **Apify** for LinkedIn scraping
- **Dodo Payments** for Pro plan subscriptions

### Infrastructure
- **Neon Database** (serverless PostgreSQL)
- **Replit** hosting and development
- **Environment-based secrets management**

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Required API keys (see Environment Setup)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-jobhunter.git
   cd ai-jobhunter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Fill in your API keys and database URL
   ```

4. **Run database migrations**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🔧 Environment Setup

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Google OAuth (for user authentication and Gmail API)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI (for email generation)
OPENAI_API_KEY=your_openai_api_key

# Apify (for LinkedIn scraping)
APIFY_API_KEY=your_apify_api_key

# Dodo Payments (for Pro plan subscriptions)
DODO_API_KEY=your_dodo_api_key
DODO_WEBHOOK_SECRET=your_dodo_webhook_secret

# PostgreSQL Connection (auto-set by DATABASE_URL)
PGHOST=your_pg_host
PGPORT=5432
PGUSER=your_pg_user  
PGPASSWORD=your_pg_password
PGDATABASE=your_pg_database
```

### API Key Setup Guide

#### 1. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API and Gmail API
4. Create OAuth 2.0 credentials
5. Add your domain to authorized origins
6. Download credentials and set environment variables

#### 2. OpenAI API Key
1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to API Keys section
3. Create new API key
4. Add credits to your account for usage

#### 3. Apify API Key  
1. Create account at [Apify](https://apify.com/)
2. Go to Settings → Integrations
3. Generate new API token
4. This is used for LinkedIn job and profile scraping

#### 4. Dodo Payments API Key
1. Sign up at [Dodo Payments](https://dodopayments.com/)
2. Navigate to Developer Settings
3. Create new API key and webhook secret
4. Configure webhook URL: `https://your-domain.com/api/payments/webhook/dodo`
5. This enables Pro plan subscriptions ($29/month)

## 📖 API Documentation

### Job Scraping Endpoints

#### `POST /api/scrape-job`
Start a new job scraping request.

**Request Body:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/jobs/search?keywords=developer&location=bangalore",
  "resumeText": "Optional resume text for personalization"
}
```

**Response:**
```json
{
  "requestId": "uuid-string"
}
```

#### `GET /api/scrape-job/:requestId`
Get the status and results of a scraping request.

**Response:**
```json
{
  "id": "uuid-string",
  "status": "completed",
  "enrichedResults": {
    "jobs": [...],
    "freeJobs": 3,
    "lockedJobs": 97,
    "canApplyCount": 3,
    "fakeTotalJobs": 1315
  },
  "freeJobsShown": 3,
  "proJobsShown": 97,
  "totalJobsFound": 100
}
```

### Authentication Endpoints

#### `GET /api/auth/user`
Get current authenticated user information.

#### `GET /api/auth/google`
Initiate Google OAuth flow.

#### `GET /api/auth/google/callback`
Google OAuth callback endpoint.

### Dashboard Endpoints

#### `GET /api/dashboard/stats`
Get user dashboard statistics including recent searches.

## 🎙️ Voice Resume Builder

The AI-powered voice interview system helps users create professional resumes without typing:

### How It Works
1. **Voice Interview**: Answer 9 structured questions about your background
   - Personal information (name, email, phone, location)
   - Professional summary and career goals
   - Work experience and achievements
   - Education background
   - Skills and competencies

2. **AI Transcription**: Uses OpenAI Whisper for accurate speech-to-text conversion

3. **Resume Generation**: GPT-4 transforms interview responses into a polished, ATS-optimized resume

4. **Automatic Saving**: Resume is immediately saved to your profile and ready to use

### Interview Questions
- What is your full name?
- What is your email address and phone number?
- Where are you located?
- Tell me about your professional background and what you're looking for
- Describe your most recent or significant work experience
- What were your key achievements or responsibilities?
- What is your educational background?
- What are your key skills and areas of expertise?
- Any additional information you'd like to include?

## 📄 Professional Resume System

### Resume Themes

**Modern Theme** (Default)
- Gradient header with purple/blue colors
- Contemporary design with card-like sections
- Perfect for tech and creative roles

**Classic Theme**
- Traditional serif fonts (Times New Roman)
- Formal two-column layout
- Ideal for corporate and traditional industries

**Minimal Theme**
- Clean, simple design with lots of white space
- Modern sans-serif typography
- Great for design and consulting roles

### Resume Features
- **Structured Parsing**: Automatically converts plain text to structured format
- **PDF Export**: Download as professionally formatted PDF in any theme
- **Live Preview**: See changes in real-time before downloading
- **Auto-formatting**: Proper typography, spacing, and visual hierarchy
- **ATS-Optimized**: Formatted for Applicant Tracking Systems

### Resume Storage
- All resumes stored in database with automatic encryption
- Support for multiple formats: .txt, .pdf, .jpg, .png, .webp
- OCR text extraction from image resumes
- Automatic attachment to all job application emails

## 🏗️ Architecture Details

### Database Schema

The application uses PostgreSQL with Drizzle ORM. Key tables:

- **users**: User accounts, profile information, and subscription status
- **job_scraping_requests**: Job search requests and results
- **email_applications**: Sent email tracking
- **gmail_credentials**: OAuth tokens for Gmail API access
- **dodo_payments**: Payment transactions and subscription tracking

### Job Processing Pipeline

1. **URL Validation**: Validates LinkedIn job search URLs
2. **Job Scraping**: Uses Apify to extract job postings
3. **Quality Filtering**: Removes duplicate and low-quality jobs
4. **Profile Enrichment**: Scrapes LinkedIn profiles for contact emails  
5. **Email Generation**: Creates personalized emails using OpenAI
6. **Automated Sending**: Sends emails via Gmail API with resume attachments
7. **Result Processing**: Categorizes jobs into Free vs Pro tiers

### Free vs Pro Plan Logic

- **Free Plan**: Shows jobs where contact emails were successfully found (typically ~3% of results)
- **Pro Plan** ($29/month): Unlocks all jobs including those without contact information
  - Unlimited job searches
  - Access to all job postings
  - Priority support
  - Pro badge throughout the platform
- **Contact Discovery Rate**: Typically finds emails for ~3% of job postings
- **Display Logic**: Jobs with `canApply: true` are shown in Free plan
- **Subscription Management**: 30-day auto-renewal tracked via Dodo Payments webhooks

## 🔄 Development Workflow

### Database Migrations
```bash
# Push schema changes to database
npm run db:push

# Force push if conflicts (data loss warning)
npm run db:push --force
```

### Code Quality
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code  
npm run format
```

### Testing
The application includes comprehensive testing for the job processing pipeline and email generation logic.

## 🚀 Deployment

### Replit Deployment
The application is optimized for Replit deployment with automatic environment setup.

1. Fork/import the repository in Replit
2. Set up environment variables in Replit Secrets
3. Run `npm run db:push` to set up the database
4. The application will automatically deploy

### Production Considerations
- Enable rate limiting for API endpoints
- Set up monitoring and logging
- Configure backup strategies for the database
- Implement proper error tracking (Sentry recommended)

## 📊 Performance & Scaling

### Job Processing Performance
- **Average Processing Time**: 2-4 minutes per 100 jobs
- **Contact Discovery Rate**: ~3% success rate
- **Concurrent Processing**: Supports multiple users simultaneously
- **Rate Limiting**: Built-in protection against API abuse

### Database Optimization
- Indexed job search queries for fast retrieval
- Efficient JSON storage for job data
- Connection pooling for high concurrency

## 🛟 Troubleshooting

### Common Issues

#### Job Scraping Fails
- Check APIFY_API_KEY is valid
- Verify LinkedIn URL format
- Check Apify account credits

#### Email Sending Issues  
- Verify Gmail API is enabled
- Check Google OAuth credentials
- Ensure Gmail scope permissions are granted

#### Database Connection Issues
- Verify DATABASE_URL format
- Check PostgreSQL server status
- Confirm network connectivity

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=true
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use Prettier for code formatting
- Write tests for new features
- Update documentation for API changes

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Apify](https://apify.com/) for LinkedIn scraping capabilities
- [OpenAI](https://openai.com/) for AI email generation
- [Google](https://developers.google.com/gmail) for Gmail API access
- [Neon](https://neon.tech/) for serverless PostgreSQL
- [Shadcn/ui](https://ui.shadcn.com/) for beautiful components

## 📞 Support

For support, email support@ai-jobhunter.com or create an issue in the GitHub repository.

---

Built with ❤️ for job seekers worldwide 🌍