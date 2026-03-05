export interface WalkthroughStep {
  element: string
  intro: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export const writerTourSteps: WalkthroughStep[] = [
  {
    element: '[data-testid="input-mode-url"]',
    intro:
      'Let us help with the job application — enter the URL for the job post here.',
    position: 'bottom',
  },
  {
    element: '[data-testid="input-mode-file_upload"]',
    intro:
      "If the job application has questions, take a screen shot and upload here. We can give you answers that aren't the usual AI slop. You'll stand out from the crowd!",
    position: 'bottom',
  },
  {
    element: '[data-testid="input-mode-default_questions"]',
    intro:
      'Want help for an upcoming interview or just want practice? Use our trained AI job coach. Copy your answers and use them in your applications too!',
    position: 'bottom',
  },
]

export const homeTourSteps: WalkthroughStep[] = [
  {
    element: 'button[aria-label="Record"]',
    intro:
      'Tap record and start talking. We record up to 5 minutes and transcribe for you.',
    position: 'bottom',
  },
  {
    element: 'button[aria-label="Attach files"]',
    intro: 'Attach any file.',
    position: 'top',
  },
  {
    element: 'textarea[aria-label="Message input"]',
    intro:
      'Chat with our Cosmic Agent about your recording, or your uploaded files.',
    position: 'top',
  },
  {
    element: 'button[aria-label="Voice Edit"]',
    intro:
      "Once the Cosmic Agent is done writing, just hit 'Voice Edit' and tell the Agent what you want changed. When you're ready to use what you've written, just hit the 'Copy' button and paste into your app! Use our agent and you'll never post AI slop again.",
    position: 'top',
  },
]
