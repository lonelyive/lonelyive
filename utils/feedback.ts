
export const triggerHaptic = (duration: number = 15) => {
  // Check if browser supports vibration
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      // Vibrate for X ms (default 15ms is a nice "click" feel)
      navigator.vibrate(duration);
    } catch (e) {
      // Ignore errors if vibration is not allowed contextually
    }
  }
};
