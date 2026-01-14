# Phase 2: Basic UI Layout & Navigation

**Phase**: 2 of 8
**Estimated Effort**: 3-4 hours
**Dependencies**: Phase 1 (project setup)
**Blocks**: Phase 3, 5, 7 (UI integration)

## Overview

Build responsive three-column layout with projects sidebar, main conversation area, and navigation. Implement project list component with CRUD operations and active state management.

## Behaviors

### Behavior 2.1: Three-Column Layout Renders

**Testable Function**: `AppLayout` component with responsive sidebar toggle

**Test Coverage**:
- ✅ Sidebar renders with "Projects" header
- ✅ Main content area renders children
- ✅ Proper ARIA labels for accessibility
- ✅ Mobile viewport: sidebar hidden, toggle button shown
- ✅ Desktop viewport: sidebar visible

### Behavior 2.2: Project Sidebar Lists Projects

**Testable Function**: `ProjectSidebar` component with `onSelectProject()` and `onNewProject()` handlers

**Test Coverage**:
- ✅ Empty state shows "No projects" message
- ✅ Projects render with names
- ✅ Active project highlighted
- ✅ Click project triggers `onSelectProject`
- ✅ New project button triggers `onNewProject`

## Dependencies

### Requires
- ✅ Phase 1: Project setup, TypeScript, Tailwind, testing framework

### Blocks
- Phase 3: Message input (needs layout structure)
- Phase 5: Conversation view (needs main content area)
- Phase 7: Integration (needs complete layout)

## Changes Required

### New Files Created

#### `/components/layout/AppLayout.tsx`
- Lines 417-445: Basic layout structure (Green)
- Lines 450-510: Responsive sidebar with toggle (Refactor)
- Three-column layout: sidebar | main | (future: attachments panel)
- Mobile menu button with `Menu` icon from lucide-react
- Overlay for mobile sidebar

#### `/components/layout/ProjectSidebar.tsx`
- Lines 628-675: Basic project list (Green)
- Lines 680-737: Enhanced with empty state and active highlighting (Refactor)
- Props: `projects`, `activeProjectId`, `onSelectProject`, `onNewProject`
- Empty state when no projects
- "New Project" button
- Active project visual indicator

#### `/lib/types.ts`
- Lines 619-624: Project interface
  ```typescript
  interface Project {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }
  ```

### Test Files Created

#### `/__tests__/components/AppLayout.test.tsx`
- Lines 378-411: Layout rendering tests
- Sidebar presence check
- Main content area check
- ARIA labels verification

#### `/__tests__/components/ProjectSidebar.test.tsx`
- Lines 619-675: Project list tests
- Empty state test
- Project rendering test
- Click handler tests
- Active state highlighting test

### Dependencies to Install
```bash
npm install lucide-react  # Icon library
```

## Success Criteria

### Automated Tests
- [ ] Tests fail without components (Red): `npm test -- AppLayout.test`
- [ ] Tests pass with components (Green): `npm test -- AppLayout.test`
- [ ] Tests fail for ProjectSidebar (Red): `npm test -- ProjectSidebar.test`
- [ ] Tests pass (Green): `npm test -- ProjectSidebar.test`
- [ ] Component renders without errors
- [ ] Accessibility checks pass (aria-labels present)

### Manual Verification

**Human-Testable Function**: `ProjectSidebar` with project selection

1. **Create Demo Page**:
   ```typescript
   // app/page.tsx
   import AppLayout from '@/components/layout/AppLayout';
   import ProjectSidebar from '@/components/layout/ProjectSidebar';

   const demoProjects = [
     { id: '1', name: 'Project A', createdAt: new Date(), updatedAt: new Date() },
     { id: '2', name: 'Project B', createdAt: new Date(), updatedAt: new Date() },
   ];

   export default function Home() {
     const [active, setActive] = useState('1');

     return (
       <AppLayout>
         <ProjectSidebar
           projects={demoProjects}
           activeProjectId={active}
           onSelectProject={setActive}
           onNewProject={() => console.log('New project')}
         />
       </AppLayout>
     );
   }
   ```

2. **Desktop Testing** (viewport > 1024px):
   - Sidebar visible on load
   - Projects list shows "Project A" and "Project B"
   - Click "Project A" → background highlights
   - Click "Project B" → highlight moves
   - "New Project" button visible

3. **Mobile Testing** (viewport < 768px):
   - Sidebar hidden on load
   - Menu button (hamburger icon) visible in top-left
   - Click menu button → sidebar slides in
   - Dark overlay appears behind sidebar
   - Click overlay → sidebar closes

4. **Empty State Testing**:
   - Pass empty array `projects={[]}`
   - Verify "No projects yet" message shows
   - "New Project" button still visible

### Files to Verify
- [ ] `components/layout/AppLayout.tsx` exists and exports default
- [ ] `components/layout/ProjectSidebar.tsx` exists and exports default
- [ ] `lib/types.ts` defines Project interface
- [ ] Test files in `__tests__/components/`
- [ ] No TypeScript errors
- [ ] No accessibility violations (aria-labels present)

## Implementation Notes

### Tailwind Classes Used
- Layout: `flex`, `h-screen`, `flex-1`, `flex-col`
- Spacing: `p-4`, `space-y-2`, `gap-2`
- Borders: `border-r`, `border-border`
- Responsive: `lg:hidden`, `lg:static`, `md:w-64`
- Transitions: `transform`, `transition-transform`, `duration-200`

### shadcn/ui Components Used
- `Button` (for menu toggle and new project)
- Standard design tokens (border-border, bg-card, etc.)

## Next Phase

Once `ProjectSidebar` correctly handles project selection and all tests pass:
→ [Phase 3: Message Input & File Attachments](./2026-01-09-tdd-writing-agent-ui-03-phase-3.md)
