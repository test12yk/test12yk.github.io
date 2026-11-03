// 이야기 읽어 주기 (브라우저 내장 음성, 한국어)
let koVoice = null;

function loadVoice() {
  const voices = speechSynthesis.getVoices();
  koVoice = voices.find(v => v.lang === 'ko-KR' && /Yuna|Google|Siri/i.test(v.name))
    || voices.find(v => v.lang?.startsWith('ko')) || null;
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

if (ttsSupported()) {
  loadVoice();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoice);
}

export function speakAll(paragraphs, onEnd) {
  if (!ttsSupported()) return;
  speechSynthesis.cancel();
  paragraphs.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    if (koVoice) u.voice = koVoice;
    u.rate = 0.95;
    if (i === paragraphs.length - 1) u.onend = () => onEnd?.();
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}

export const isSpeaking = () => ttsSupported() && speechSynthesis.speaking;
