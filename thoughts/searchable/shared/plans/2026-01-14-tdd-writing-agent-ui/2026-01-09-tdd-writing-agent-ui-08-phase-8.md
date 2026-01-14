# Phase 8: Deployment to Vercel

**Phase**: 8 of 8 (Final)
**Estimated Effort**: 2-3 hours
**Dependencies**: Phase 7 (complete application)
**Blocks**: None (final phase)

## Overview

Configure production build optimizations, set up Vercel deployment with environment variables, and verify all features work in production. This phase completes the project by making the application publicly accessible.

## Behaviors

### Behavior 8.1: Application Deploys to Vercel

**Testable Function**: Deployment configuration validation - production build succeeds and application accessible via URL

**Test Coverage**:
- ✅ Local production build succeeds: `npm run build`
- ✅ No TypeScript errors in production
- ✅ No linting errors
- ✅ All environment variables configured in Vercel
- ✅ Deployment completes successfully
- ✅ Application accessible at Vercel URL
- ✅ All features work in production (E2E tests against prod)
- ✅ Lighthouse score > 80

## Dependencies

### Requires
- ✅ Phase 7: Complete integrated application
- ✅ Vercel account (free tier sufficient)
- ✅ GitHub repository with code
- ✅ OpenAI API key for production

### Blocks
- None (final phase)

## Changes Required

### New Files Created

#### `/vercel.json`
- Lines 3243-3252: Vercel configuration
  ```json
  {
    "buildCommand": "npm run build",
    "devCommand": "npm run dev",
    "installCommand": "npm install",
    "framework": "nextjs",
    "regions": ["sfo1"],
    "env": {
      "OPENAI_API_KEY": "@openai-api-key"
    }
  }
  ```

#### `/.env.production`
- Lines 3256-3262: Production environment template
  ```bash
  # Production Environment Variables
  # These should be set in Vercel dashboard, not committed to git

  OPENAI_API_KEY=
  NODE_ENV=production
  NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
  ```

#### `/next.config.ts`
- Lines 3265-3311: Production optimizations
  ```typescript
  import type { NextConfig } from 'next';

  const nextConfig: NextConfig = {
    // Production optimizations
    reactStrictMode: true,
    swcMinify: true,

    // Performance
    compiler: {
      removeConsole: process.env.NODE_ENV === 'production',
    },

    // Image optimization
    images: {
      formats: ['image/avif', 'image/webp'],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    },

    // Headers for security
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'X-DNS-Prefetch-Control',
              value: 'on',
            },
            {
              key: 'X-Frame-Options',
              value: 'SAMEORIGIN',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
          ],
        },
      ];
    },
  };

  export default nextConfig;
  ```

#### `/.github/workflows/ci.yml` (Optional)
- GitHub Actions for automated testing before deploy
  ```yaml
  name: CI

  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]

  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
          with:
            node-version: '20'
        - run: npm ci
        - run: npm run lint
        - run: npm run build
        - run: npm test
        - run: npx playwright install
        - run: npm run test:e2e
          env:
            OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ```

### Modified Files

#### `/.gitignore`
- Add production artifacts
  ```
  # Production
  .vercel
  .env.production.local
  out/
  build/
  ```

#### `/package.json`
- Add deployment scripts
  ```json
  {
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint",
      "test": "vitest",
      "test:e2e": "playwright test",
      "type-check": "tsc --noEmit",
      "preview": "next build && next start",
      "deploy": "vercel --prod"
    }
  }
  ```

## Success Criteria

### Automated Tests (Pre-Deployment)
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npm run lint`
- [ ] All unit tests pass: `npm test`
- [ ] All E2E tests pass: `npm run test:e2e`

### Deployment Steps
1. **Prepare Repository**:
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

2. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

3. **Login to Vercel**:
   ```bash
   vercel login
   ```

4. **Deploy to Preview**:
   ```bash
   vercel
   # Follow prompts:
   # - Set up and deploy? Yes
   # - Which scope? (select your account)
   # - Link to existing project? No
   # - Project name? writing-agent-ui
   # - Directory? ./
   # - Override settings? No
   ```

5. **Set Environment Variables** (in Vercel Dashboard):
   - Navigate to: Project → Settings → Environment Variables
   - Add: `OPENAI_API_KEY` = `sk-...` (your API key)
   - Environment: Production, Preview, Development (select all)
   - Save

6. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

7. **Verify Deployment**:
   - Open provided URL: `https://writing-agent-ui-xyz.vercel.app`
   - Test all features (see manual verification below)

### Manual Verification (Production)

**Human-Testable Function**: Complete application deployed and accessible

1. **Access Testing**:
   - Open Vercel deployment URL in browser
   - Verify page loads (no 404 or 500 errors)
   - Check console: no JavaScript errors
   - Verify favicon and metadata correct

2. **Feature Testing** (All Phase 7 flows):
   - **Project Creation**: Click "New Project" → Project created
   - **Send Message**: Type "Hello" → Send → Receive AI response
   - **File Upload**: Attach file → Send → Works without errors
   - **Audio Recording**: Record → Transcribe → Send → Works
     - ⚠️ May require HTTPS for microphone access
   - **State Persistence**: Send messages → Reload → Messages persist
   - **Multi-Project**: Create 3 projects → Switch → Correct messages

3. **Performance Testing**:
   - Run Lighthouse audit (Chrome DevTools):
     - Performance: > 80
     - Accessibility: > 90
     - Best Practices: > 90
     - SEO: > 90
   - Test on slow 3G network → Should still load in < 10s
   - Test on mobile device → Responsive layout works

4. **API Integration Testing**:
   - Send message → Verify OpenAI API called successfully
   - Check Vercel Logs (Dashboard → Project → Logs):
     - No 500 errors
     - API requests succeed
     - No environment variable errors

5. **Error Handling Testing**:
   - Remove OPENAI_API_KEY from Vercel dashboard
   - Redeploy: `vercel --prod`
   - Try to transcribe audio → Should show clear error message
   - Re-add API key, redeploy → Should work again

6. **Security Testing**:
   - Verify headers present (DevTools → Network → Headers):
     - `X-Frame-Options: SAMEORIGIN`
     - `X-Content-Type-Options: nosniff`
   - Verify API key not exposed in client-side code (view source)
   - Test CSP (Content Security Policy) if configured

7. **Cross-Browser Testing**:
   - Chrome/Edge: All features work
   - Firefox: All features work
   - Safari: All features work (especially audio recording)
   - Mobile Safari: Touch interactions work

8. **Load Testing** (Optional):
   - Send 50 messages rapidly → No crashes
   - Create 20 projects → No performance degradation
   - Large file upload (9MB) → Handles gracefully

### Files to Verify
- [ ] `vercel.json` exists and configured
- [ ] `next.config.ts` has production optimizations
- [ ] `.env.production` documented (not committed)
- [ ] `.gitignore` includes `.vercel/` and `.env.production.local`
- [ ] GitHub repository up-to-date
- [ ] Vercel dashboard shows successful deployment
- [ ] Environment variables set in Vercel

## Implementation Notes

### Vercel Environment Variables
Set in dashboard (not in code):
1. Navigate to: https://vercel.com/dashboard
2. Select project: `writing-agent-ui`
3. Settings → Environment Variables
4. Add each variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-...` (your key)
   - **Environments**: Production ✓, Preview ✓, Development ✓

**IMPORTANT**: Never commit API keys to git!

### Production Build Optimization
```typescript
// next.config.ts
export default {
  reactStrictMode: true,        // Catch React issues
  swcMinify: true,               // Faster minification
  compiler: {
    removeConsole: true,         // Remove console.logs in production
  },
  images: {
    formats: ['image/avif', 'image/webp'],  // Modern formats
  },
};
```

### Lighthouse Score Targets
- **Performance**: > 80 (mobile), > 90 (desktop)
- **Accessibility**: > 90 (WCAG AA compliance)
- **Best Practices**: > 90
- **SEO**: > 90

Improve scores:
- Optimize images (use Next.js `<Image>`)
- Minimize JavaScript bundles
- Add `loading="lazy"` to images
- Use semantic HTML
- Add `alt` text to images

### Vercel Regions
- Default: `sfo1` (San Francisco)
- Other options: `iad1` (DC), `fra1` (Frankfurt), `syd1` (Sydney)
- Choose closest to your users

### Custom Domain (Optional)
1. Buy domain (e.g., Namecheap, Google Domains)
2. Vercel Dashboard → Project → Settings → Domains
3. Add domain: `writing-agent.com`
4. Update DNS records as instructed
5. Wait for DNS propagation (up to 48 hours)
6. Enable HTTPS (automatic with Vercel)

### Monitoring (Optional)
- **Vercel Analytics**: Enable in dashboard (free)
- **Vercel Speed Insights**: Track Core Web Vitals
- **Sentry**: Error tracking (`npm install @sentry/nextjs`)
- **LogRocket**: Session replay for debugging

## Rollback Plan

If deployment fails:
1. Check Vercel build logs for errors
2. Fix errors locally: `npm run build`
3. Commit fix: `git commit -am "Fix build error"`
4. Redeploy: `vercel --prod`

If production has issues:
1. Vercel Dashboard → Deployments → Previous deployment
2. Click "..." → Promote to Production
3. Fix issue locally, redeploy when ready

## Post-Deployment Checklist

- [ ] Application accessible at Vercel URL
- [ ] All environment variables configured
- [ ] All features tested in production
- [ ] Lighthouse score > 80
- [ ] No console errors
- [ ] No API errors in Vercel logs
- [ ] State persists across reloads
- [ ] Mobile responsive
- [ ] Cross-browser compatible
- [ ] Custom domain configured (optional)
- [ ] Analytics enabled (optional)

## Next Steps (Future Enhancements)

After successful deployment, consider:

1. **Authentication**: Add user login (NextAuth.js, Clerk)
2. **Database**: Replace localStorage with PostgreSQL (Vercel Postgres, Supabase)
3. **Real-time Sync**: WebSockets for multi-device sync
4. **BAML Integration**: Connect to `planning_pipeline/claude_runner.py` for advanced AI
5. **Theme Extraction**: Implement theme identification from conversations
6. **Export**: Download conversations as PDF/Markdown
7. **Sharing**: Share conversations via unique URLs
8. **Voice Output**: Text-to-speech for AI responses
9. **Analytics**: Track usage patterns, popular features
10. **API**: Expose public API for third-party integrations

## Completion

🎉 **Congratulations!** You've successfully built and deployed a writing agent web application with TDD practices.

### Final Verification
Run this command to verify everything:
```bash
npm run lint && npm run type-check && npm run build && npm test && npm run test:e2e
```

If all pass:
```
✅ All phases complete
✅ Application deployed to production
✅ All tests passing
✅ Ready for users!
```

### Project URLs
- **Production**: https://writing-agent-ui-xyz.vercel.app
- **GitHub**: https://github.com/your-username/writing-agent-ui
- **Vercel Dashboard**: https://vercel.com/dashboard/writing-agent-ui

---

**End of Phase 8 - Project Complete**
