/**
 * Application configuration read from environment variables.
 *
 * VITE_APP_MODE    : 'full' | 'segmentation' | 'recalage'
 * VITE_AUTH_DISABLED : 'true' | 'false'
 *
 * In local development (.env) → APP_MODE=full, AUTH_DISABLED=false
 * In CTIAMA Docker builds     → values set via build args
 */

export type AppMode = 'full' | 'segmentation' | 'recalage'

export const APP_MODE: AppMode =
  (import.meta.env.VITE_APP_MODE as AppMode) || 'full'

export const AUTH_DISABLED: boolean =
  import.meta.env.VITE_AUTH_DISABLED === 'true'

// Convenience helpers
export const isFull          = APP_MODE === 'full'
export const isSegMode       = APP_MODE === 'segmentation' || APP_MODE === 'full'
export const isRecalageMode  = APP_MODE === 'recalage'     || APP_MODE === 'full'
