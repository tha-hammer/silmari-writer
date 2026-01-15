# Vercel Deployment Guide

This guide explains how to deploy the Silmari Writer frontend to Vercel.

## Prerequisites

- A Vercel account (https://vercel.com)
- Vercel CLI installed: `npm install -g vercel`
- GitHub repository connected to Vercel (recommended)

## Project Structure

This is a monorepo with the Next.js frontend in the `frontend/` directory:

```
silmari-writer/
├── backend/           # Python backend
├── frontend/          # Next.js frontend app
│   ├── src/
│   ├── package.json
│   └── vercel.json
└── vercel.json        # Root configuration (points to frontend/)
```

## Environment Variables

You'll need to set these environment variables in your Vercel project:

### Required

1. **OPENAI_API_KEY**
   - Your OpenAI API key for chat and transcription
   - Get from: https://platform.openai.com/api-keys

2. **BLOB_READ_WRITE_TOKEN**
   - Vercel Blob storage token for audio transcription
   - Automatically set when you create a Blob store (see setup below)

### Setup Vercel Blob Storage

Audio transcription requires Vercel Blob storage to bypass the 4.5MB serverless function limit:

```bash
# Via Vercel CLI
vercel blob create

# Or via Vercel Dashboard
# 1. Go to your project's Storage tab
# 2. Click "Create Database"
# 3. Select "Blob"
# 4. The BLOB_READ_WRITE_TOKEN will be automatically set
```

## Deployment Methods

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Import Repository**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will auto-detect the configuration

2. **Configure Project**
   - Root Directory: `frontend` (should be auto-detected from vercel.json)
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)

3. **Set Environment Variables**
   - Add `OPENAI_API_KEY` in project settings
   - Create Blob store (sets `BLOB_READ_WRITE_TOKEN` automatically)

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

### Option 2: Deploy via CLI

```bash
# From repository root
cd /path/to/silmari-writer

# Login to Vercel (first time only)
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

The CLI will:
1. Detect the `vercel.json` configuration
2. Use `frontend` as the root directory
3. Run the build process
4. Deploy the application

## Configuration Files

### Root `vercel.json`

Located at the repository root, this tells Vercel where to find the app:

```json
{
  "rootDirectory": "frontend",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

### Frontend `frontend/vercel.json`

Contains app-specific configuration:

```json
{
  "framework": "nextjs",
  "regions": ["sfo1"],
  "functions": {
    "src/app/api/transcribe/route.ts": {
      "maxDuration": 60
    },
    "src/app/api/generate/route.ts": {
      "maxDuration": 60
    }
  }
}
```

## Build Process

The build process runs these steps:

1. **Install dependencies**: `npm install` in `frontend/`
2. **Generate BAML client**: `baml-cli generate --from ./src/baml_src`
3. **Build Next.js**: `next build`

## Troubleshooting

### "No Next.js version detected"

**Problem**: Vercel can't find Next.js in package.json

**Solution**: Ensure the root `vercel.json` has `"rootDirectory": "frontend"` set correctly

### "Cannot find module baml_src"

**Problem**: BAML CLI can't find the BAML source directory

**Solution**: The build script should use `--from ./src/baml_src`:
```json
"build": "baml-cli generate --from ./src/baml_src && next build"
```

### "BLOB_READ_WRITE_TOKEN is not configured"

**Problem**: Missing Vercel Blob storage token

**Solution**: Create a Blob store in your Vercel project:
```bash
vercel blob create
```

### "OPENAI_API_KEY is not configured"

**Problem**: Missing OpenAI API key

**Solution**: Add it to your Vercel project environment variables:
1. Go to Project Settings → Environment Variables
2. Add `OPENAI_API_KEY` with your key
3. Redeploy

### Function Timeout

**Problem**: API routes timing out

**Solution**: The `vercel.json` already configures 60-second timeouts for API routes. If you need longer:
- Pro plan: up to 60 seconds
- Enterprise plan: up to 900 seconds

## Post-Deployment

After successful deployment:

1. **Test the application**
   - Visit your deployment URL
   - Test chat functionality
   - Test audio recording/transcription
   - Test file transcription

2. **Set up custom domain** (optional)
   - Go to Project Settings → Domains
   - Add your custom domain
   - Configure DNS as instructed

3. **Enable analytics** (optional)
   - Vercel Analytics is automatically available
   - View in your project dashboard

## Monitoring

- **Build Logs**: Check deployment logs in Vercel dashboard
- **Runtime Logs**: View function logs in the Functions tab
- **Analytics**: Monitor performance in Analytics tab
- **Blob Storage**: View usage in Storage tab

## Support

- Vercel Documentation: https://vercel.com/docs
- Next.js on Vercel: https://vercel.com/docs/frameworks/nextjs
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob
