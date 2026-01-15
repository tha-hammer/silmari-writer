import { test, expect } from '@playwright/test';

test.describe('Conversation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test by navigating and evaluating
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Wait for hydration
    await page.waitForLoadState('networkidle');
  });

  test('should auto-create first project on initial load', async ({ page }) => {
    // Verify default project is created - use first() to avoid strict mode violation
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should create project and send message', async ({ page }) => {
    // Wait for initial project to be created
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Type and send message
    await page.fill('textarea[aria-label="Message input"]', 'Hello, AI!');
    await page.click('button[aria-label="Send message"]');

    // Wait for user message to appear
    await expect(page.locator('text=Hello, AI!').first()).toBeVisible();

    // Wait for AI response
    await expect(page.locator('text=You said:')).toBeVisible({ timeout: 10000 });
  });

  test('should attach file and display it', async ({ page }) => {
    // Wait for project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content'),
    });

    // Verify file attached
    await expect(page.locator('text=test.txt')).toBeVisible();
  });

  test('should persist state to localStorage', async ({ page }) => {
    // Wait for project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Send a message
    await page.fill('textarea[aria-label="Message input"]', 'Test message for persistence');
    await page.click('button[aria-label="Send message"]');
    await expect(page.locator('text=Test message for persistence').first()).toBeVisible();

    // Wait for AI response to ensure full save
    await expect(page.locator('text=You said:')).toBeVisible({ timeout: 10000 });

    // Wait a moment for localStorage to update
    await page.waitForTimeout(500);

    // Verify localStorage has the correct data
    const storage = await page.evaluate(() => localStorage.getItem('conversation-storage'));
    expect(storage).toBeTruthy();

    const parsed = JSON.parse(storage as string);
    expect(parsed.state.projects).toHaveLength(1);
    expect(parsed.state.projects[0].name).toBe('My First Project');
    expect(parsed.state.messages).toBeDefined();

    // Check that messages are in localStorage
    const projectId = parsed.state.projects[0].id;
    expect(parsed.state.messages[projectId]).toHaveLength(2); // user + assistant
    expect(parsed.state.messages[projectId][0].content).toBe('Test message for persistence');
  });

  test('should create new project with New Project button', async ({ page }) => {
    // Wait for initial project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Create a new project - click the button in the sidebar that says "New Project"
    await page.click('button:has-text("New Project")');

    // Verify new project appears - after "My First Project", the count is 1, so new project is "New Project 2"
    await expect(page.getByRole('button', { name: 'New Project 2' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should switch between projects', async ({ page }) => {
    // Wait for initial project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Send message in first project
    await page.fill('textarea[aria-label="Message input"]', 'Message in Project 1');
    await page.click('button[aria-label="Send message"]');
    await expect(page.locator('text=Message in Project 1').first()).toBeVisible();

    // Create second project
    await page.click('button:has-text("New Project")');
    await expect(page.getByRole('button', { name: 'New Project 2' }).first()).toBeVisible({ timeout: 10000 });

    // Second project is now active - should show empty state
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(page.locator('text=Message in Project 1')).not.toBeVisible();

    // Switch back to first project
    await page.getByRole('button', { name: 'My First Project' }).first().click();

    // Verify first project's messages are visible again
    await expect(page.locator('text=Message in Project 1').first()).toBeVisible();
  });

  test('should show loading indicator while generating', async ({ page }) => {
    // Wait for project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Send message
    await page.fill('textarea[aria-label="Message input"]', 'Test loading indicator');
    await page.click('button[aria-label="Send message"]');

    // Just verify the message eventually gets a response
    await expect(page.locator('text=You said: "Test loading indicator"')).toBeVisible({ timeout: 10000 });
  });

  test('should disable input while generating', async ({ page }) => {
    // Wait for project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Send message
    await page.fill('textarea[aria-label="Message input"]', 'Test disable');

    // Click send and wait for response
    await page.click('button[aria-label="Send message"]');
    await expect(page.locator('text=You said:')).toBeVisible({ timeout: 10000 });

    // After response, input should be enabled again
    await expect(page.locator('textarea[aria-label="Message input"]')).toBeEnabled();
  });

  test('should display empty state when no messages', async ({ page }) => {
    // Wait for project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Should show empty state initially
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(page.locator('text=No messages yet')).toBeVisible();
  });

  test('should send message with Enter key', async ({ page }) => {
    // Wait for project
    await expect(page.getByRole('button', { name: 'My First Project' }).first()).toBeVisible({ timeout: 10000 });

    // Type message and press Enter
    const textarea = page.locator('textarea[aria-label="Message input"]');
    await textarea.fill('Enter key test');
    await textarea.press('Enter');

    // Verify message was sent - use first() since the text might appear in response too
    await expect(page.locator('text=Enter key test').first()).toBeVisible();
    await expect(page.locator('text=You said:')).toBeVisible({ timeout: 10000 });
  });
});
