# Phase 1: Project Setup & Infrastructure

**Phase**: 1 of 8
**Estimated Effort**: 1-2 hours
**Dependencies**: None (first phase)
**Blocks**: All subsequent phases

## Overview

Initialize Next.js 14 project with TypeScript, Tailwind CSS, Vitest testing framework, and environment variable configuration. This phase establishes the foundation for all subsequent development.

## Behaviors

### Behavior 1.1: Next.js Project Initializes Successfully

**Testable Function**: Project builds and tests run successfully

**Test Coverage**:
- ✅ package.json has required dependencies
- ✅ TypeScript configuration exists
- ✅ Tailwind configuration exists
- ✅ Vitest configured with React support

### Behavior 1.2: Environment Variables Load Correctly

**Testable Function**: `validateEnv()` - validates environment variables are properly configured

**Test Coverage**:
- ✅ OPENAI_API_KEY is accessible
- ✅ Missing required vars trigger error
- ✅ Environment validation uses Zod schema

## Dependencies

### Requires
- None (first phase)

### Blocks
- Phase 2 (needs project structure)
- Phase 3 (needs testing framework)
- Phase 4 (needs environment variables)
- All subsequent phases

## Changes Required

### New Files Created

#### `/package.json`
- Lines 122-129: Dependencies (next, react, tailwindcss, vitest)
- Lines 200-211: Test scripts

#### `/vitest.config.ts`
- Lines 171-189: Vitest configuration with React plugin
- JSdom environment for React component testing
- Path aliases for `@/*` imports

#### `/test/setup.ts`
- Line 193: Testing library setup
- Import jest-dom matchers

#### `/.env.local`
- Line 281: OpenAI API key configuration
- Template for environment variables

#### `/.env.example`
- Lines 290-298: Documented environment variable template

#### `/lib/env.ts`
- Lines 301-307: Basic env getter with validation
- Lines 318-337: Zod schema validation (refactored)
- Exported `env` object with validated values

### Modified Files
None (all new files)

## Success Criteria

### Automated Tests
- [ ] Test fails without setup (Red): `npm test`
- [ ] Test passes after setup (Green): `npm test`
- [ ] Project builds: `npm run build`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Linting passes: `npm run lint`

### Manual Verification

**Human-Testable Function**: `validateEnv()`

1. **Setup**: Copy `.env.example` to `.env.local`
2. **Test Missing Key**:
   ```bash
   # Remove OPENAI_API_KEY from .env.local
   npm run dev
   # Expected: Error "Missing required environment variable: OPENAI_API_KEY"
   ```
3. **Test Valid Key**:
   ```bash
   # Add OPENAI_API_KEY=sk-test123 to .env.local
   npm run dev
   # Expected: Server starts successfully at localhost:3000
   ```
4. **Verify in Browser**:
   - Navigate to http://localhost:3000
   - Page loads without errors
   - No console errors

### Files to Verify
- [ ] `package.json` exists with all dependencies
- [ ] `vitest.config.ts` configured correctly
- [ ] `.env.example` documents all required variables
- [ ] `lib/env.ts` exports validated `env` object
- [ ] Test files in `__tests__/` directory

## Implementation Commands

```bash
# Create Next.js project
npx create-next-app@latest writing-agent-ui \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd writing-agent-ui

# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react

# Install UI dependencies
npx shadcn-ui@latest init

# Install core dependencies
npm install openai zustand zod

# Create test setup
mkdir -p test __tests__

# Run tests
npm test

# Start dev server
npm run dev
```

## Next Phase

Once `validateEnv()` works correctly and all tests pass:
→ [Phase 2: Basic UI Layout & Navigation](./2026-01-09-tdd-writing-agent-ui-02-phase-2.md)
