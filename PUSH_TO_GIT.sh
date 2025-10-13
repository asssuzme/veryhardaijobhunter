#!/bin/bash

# AI JobHunter - Push to Git Repository Script
# This script will stage, commit, and push all code changes to your repository

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        AI JobHunter - Push to Git Repository              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Error: This directory is not a git repository"
    echo "   Please run: git init"
    exit 1
fi

# Display current git status
echo "📊 Current Git Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git status --short
echo ""

# Display remote repository
echo "🔗 Remote Repository:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git remote -v
echo ""

# Check for .env file and warn if it's not in .gitignore
if [ -f ".env" ]; then
    if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
        echo "⚠️  WARNING: .env file exists but may not be in .gitignore"
        echo "   This could expose your API keys!"
        echo ""
        read -p "   Do you want to add .env to .gitignore? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ".env" >> .gitignore
            echo "✅ Added .env to .gitignore"
        fi
        echo ""
    fi
fi

# Ask for confirmation
echo "📦 Files to be committed:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "New Features:"
echo "  ✅ Voice Resume Builder (AI-powered interview system)"
echo "  ✅ Professional Resume Viewer (3 beautiful themes)"
echo "  ✅ PDF Generation (download formatted resumes)"
echo "  ✅ Resume Parser (text to structured format)"
echo "  ✅ Enhanced Settings Page (tabbed interface)"
echo "  ✅ Updated Documentation (README, SETUP, replit.md)"
echo ""
echo "New Files:"
echo "  • shared/types/resume.ts"
echo "  • server/utils/resume-parser.ts"
echo "  • server/utils/resume-pdf-generator.ts"
echo "  • client/src/components/resume-viewer.tsx"
echo ""
echo "Modified Files:"
echo "  • server/simple-routes.ts (new API endpoints)"
echo "  • client/src/pages/settings.tsx (resume viewer integration)"
echo "  • README.md (updated features)"
echo "  • SETUP.md (voice builder & PDF docs)"
echo "  • replit.md (latest changes)"
echo ""
read -p "🤔 Do you want to proceed with pushing? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Push cancelled"
    exit 1
fi

echo ""
echo "📝 Staging all changes..."
git add .

# Create detailed commit message
COMMIT_MESSAGE="Add professional resume formatting system

Major Features:
- Voice Resume Builder: AI-powered interview system with OpenAI Whisper transcription
- Professional Resume Viewer: 3 themes (Modern, Classic, Minimal) with live preview
- PDF Generation: Export resumes as professionally formatted PDFs using pdf-lib
- Resume Parser: Convert plain text resumes to structured JSON format
- Enhanced Settings Page: Tabbed interface for viewing and editing resumes

Technical Changes:
- New TypeScript types for structured resumes (shared/types/resume.ts)
- Resume parsing utility for text-to-JSON conversion
- PDF generation utility with theme support
- New API endpoints: /api/resume/parse, /api/resume/generate-pdf, /api/resume/structured
- Updated voice interview to generate better-formatted resumes

Documentation:
- Updated README.md with voice builder and PDF features
- Enhanced SETUP.md with feature overviews
- Updated replit.md with October 13, 2025 changes

UI/UX:
- Settings page now has View Resume and Edit & Upload tabs
- Live theme switcher for resume preview
- One-click PDF download button
- Improved resume management interface

All features tested and working correctly ✅"

echo "✅ Files staged"
echo ""
echo "💬 Commit Message:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$COMMIT_MESSAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Commit changes
echo "📦 Creating commit..."
git commit -m "$COMMIT_MESSAGE"

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to create commit"
    exit 1
fi

echo "✅ Commit created successfully"
echo ""

# Push to repository
echo "🚀 Pushing to remote repository..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git push origin main

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Error: Failed to push to main branch"
    echo ""
    echo "💡 Trying alternative branch names..."
    
    # Try master branch
    git push origin master
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Error: Failed to push to master branch either"
        echo ""
        echo "📋 Manual push instructions:"
        echo "   1. Check your default branch name: git branch"
        echo "   2. Push to that branch: git push origin <branch-name>"
        echo "   3. Or set upstream: git push -u origin main"
        exit 1
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  ✅ SUCCESS!                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 All code has been pushed to your repository!"
echo ""
echo "📊 Summary:"
echo "  • Repository: https://github.com/asssuzme/sac-clone-clone.git"
echo "  • Branch: main"
echo "  • New Features: Voice Resume Builder, Professional Viewer, PDF Export"
echo "  • Files Changed: ~10 files modified/created"
echo ""
echo "🔍 Next Steps:"
echo "  1. Visit your GitHub repository to verify the push"
echo "  2. Check the commit history for the detailed changelog"
echo "  3. Update your production deployment if needed"
echo "  4. Share the repository with your team!"
echo ""
echo "📚 Documentation:"
echo "  • README.md - Feature overview and quick start"
echo "  • SETUP.md - Complete setup instructions"
echo "  • replit.md - Technical architecture and changelog"
echo ""
echo "Happy coding! 🚀"
echo ""
