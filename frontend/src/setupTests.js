import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

/** jsdom — Login.focusSignUpField */
Element.prototype.scrollIntoView = vi.fn()
if (!Element.prototype.animate) {
  Element.prototype.animate = vi.fn(() => ({ finished: Promise.resolve() }))
}
