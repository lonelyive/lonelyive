// Cleanup helper to remove HTML tags and extra symbols before playback
export const cleanText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') 
    .replace(/&nbsp;/g, ' ')
    .replace(/\r?\n|\r/g, ' ') 
    .replace(/\s+/g, ' ') 
    .replace(/^["']|["']$/g, '') 
    .trim();
};

export const getAudioUrl = (text: string): string => {
  const safeText = cleanText(text);
  if (!safeText) return '';
  // Use HTTPS to prevent Mixed Content errors on Android
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(safeText)}&type=2&le=en`;
};

// Singleton Audio Manager
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;

  play(text: string, forceTTS: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      const safeText = cleanText(text);
      if (!safeText) {
        resolve();
        return;
      }

      this.stop();

      // Mobile Optimization:
      // Long sentences (likely example sentences) are better handled by TTS 
      // because network audio might timeout or not exist for custom sentences.
      if (forceTTS || safeText.length > 50) {
          this.playTTS(safeText).then(resolve).catch(resolve); // Resolve even on error to not block UI
          return;
      }

      const url = getAudioUrl(safeText);
      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onended = () => {
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = () => {
        console.warn("Network audio failed, switching to fallback TTS");
        this.playTTS(safeText).then(resolve).catch(resolve);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn("Audio play blocked or failed:", e);
            // Fallback to TTS if network audio is blocked (common in mobile browsers without user interaction)
            this.playTTS(safeText).then(resolve).catch(resolve);
          });
      }
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

  private playTTS(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn("TTS not supported on this device");
        resolve();
        return;
      }
      
      // Android WebView quirk: sometimes cancel() needs a tick to process
      window.speechSynthesis.cancel();

      setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Robust Voice Selection
          const voices = window.speechSynthesis.getVoices();
          const enVoice = voices.find(v => v.lang === 'en-US') || 
                          voices.find(v => v.lang.startsWith('en')) ||
                          null; // Fallback to default if no English voice found
          
          if (enVoice) {
              utterance.voice = enVoice;
          }
          
          // Ensure lang is set even if voice obj is null
          utterance.lang = 'en-US'; 
          utterance.rate = 0.9; // Slightly slower for better clarity on mobile

          utterance.onend = () => resolve();
          utterance.onerror = (e) => {
              console.error("TTS Error:", e);
              resolve();
          };

          window.speechSynthesis.speak(utterance);
      }, 10);
    });
  }
}

const audioManager = new AudioManager();

export const playAudio = (text: string, forceTTS: boolean = false): Promise<void> => {
  return audioManager.play(text, forceTTS);
};

export const stopAudio = (): void => {
  audioManager.stop();
};