export const WALKTHROUGH_PREFIX = 'walkthrough_'

export function isTourCompleted(tourKey: string): boolean {
  try {
    return localStorage.getItem(`${WALKTHROUGH_PREFIX}${tourKey}`) === 'true'
  } catch {
    return false
  }
}

export function setTourCompleted(tourKey: string): void {
  try {
    localStorage.setItem(`${WALKTHROUGH_PREFIX}${tourKey}`, 'true')
  } catch {
    // Ignore storage errors (SSR, private browsing, etc.)
  }
}

export function resetTourCompleted(tourKey: string): void {
  try {
    localStorage.removeItem(`${WALKTHROUGH_PREFIX}${tourKey}`)
  } catch {
    // Ignore storage errors
  }
}
