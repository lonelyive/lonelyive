
// Cleanup helper to remove HTML tags and extra symbols before playback
export const cleanText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags like <b>...</b>
    .replace(/&nbsp;/g, ' ')
    .replace(/\r?\n|\r/g, ' ') // Remove newlines
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/^["']|["']$/g, '') // Remove start/end quotes
    .trim();
};

export const getAudioUrl = (text: string): string => {
  const safeText = cleanText(text);
  if (!safeText) return '';
  // Use Youdao Dictionary Voice API
  // type=2 specifies US English
  // audio arg must be encoded
  // le=en ensures English engine is used
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(safeText)}&type=2&le=en`;
};

// Singleton Audio Manager to prevent garbage collection issues
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;

  play(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const safeText = cleanText(text);
      if (!safeText) {
        resolve();
        return;
      }

      // Stop previous audio if playing
      this.stop();

      const url = getAudioUrl(safeText);
      const audio = new Audio(url);
      this.currentAudio = audio;

      // 1. Try Network Audio (Real Human Voice)
      audio.onended = () => {
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = () => {
        // 2. Fallback to Browser TTS (Guarantee playback)
        console.warn("Network audio failed, switching to fallback TTS");
        this.playFallback(safeText).then(resolve).catch(reject);
      };

      audio.play().catch(e => {
        console.warn("Audio play error:", e);
        // If play() fails (e.g. interaction policy), try fallback
        this.playFallback(safeText).then(resolve).catch(reject);
      });
    });
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private playFallback(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US'; // Default to US English
      utterance.rate = 0.9; // Slightly slower for clarity

      utterance.onend = () => {
        resolve();
      };
      
      utterance.onerror = () => {
        resolve(); // Resolve anyway to unblock UI
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}

const audioManager = new AudioManager();

export const playAudio = (text: string): Promise<void> => {
  return audioManager.play(text);
};

export const stopAudio = (): void => {
  audioManager.stop();
};
