export type ToastType = 'success' | 'error' | 'info'

export function emitToast(message: string, type: ToastType = 'error') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus-toast', { detail: { message, type } }))
  }
}
