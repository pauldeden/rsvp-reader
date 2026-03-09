// ===== RSVP Reader Engine =====

export class Reader {
  constructor({ onWord, onProgress, onEnd, onStateChange }) {
    this.onWord = onWord;
    this.onProgress = onProgress;
    this.onEnd = onEnd;
    this.onStateChange = onStateChange;

    this.words = [];
    this.index = 0;
    this.wpm = 300;
    this.playing = false;
    this.timer = null;
    this.expectedTime = 0;
  }

  load(text, startIndex = 0) {
    // Split on whitespace, preserving paragraph breaks as markers
    this.words = [];
    const paragraphs = text.split(/\n\s*\n/);
    for (let p = 0; p < paragraphs.length; p++) {
      const tokens = paragraphs[p].trim().split(/\s+/).filter(w => w.length > 0);
      for (let i = 0; i < tokens.length; i++) {
        const isLastInParagraph = (i === tokens.length - 1) && (p < paragraphs.length - 1);
        this.words.push({ text: tokens[i], paragraphEnd: isLastInParagraph });
      }
    }
    this.index = Math.min(startIndex, this.words.length - 1);
    if (this.words.length > 0) {
      this._emitWord();
    }
  }

  get totalWords() {
    return this.words.length;
  }

  get currentIndex() {
    return this.index;
  }

  setWPM(wpm) {
    this.wpm = Math.max(100, Math.min(1200, wpm));
  }

  get interval() {
    return 60000 / this.wpm;
  }

  get finished() {
    return this.words.length > 0 && this.index >= this.words.length;
  }

  play() {
    if (this.playing || this.words.length === 0 || this.finished) return;
    this.playing = true;
    this.expectedTime = performance.now() + this._wordDelay(this.index);
    this.onStateChange?.(true);
    this._scheduleNext();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.timer);
    this.timer = null;
    this.onStateChange?.(false);
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  _scheduleNext() {
    if (!this.playing) return;
    const delay = this._wordDelay(this.index);
    const now = performance.now();
    const drift = now - this.expectedTime;
    this.expectedTime += delay;
    const next = Math.max(0, delay - drift);

    this.timer = setTimeout(() => {
      this.index++;
      if (this.index >= this.words.length) {
        this.playing = false;
        this.onStateChange?.(false);
        this.onEnd?.();
        return;
      }
      this._emitWord();
      this._scheduleNext();
    }, next);
  }

  _wordDelay(idx) {
    const base = this.interval;
    if (idx >= this.words.length) return base;

    const word = this.words[idx];
    const t = word.text;
    let multiplier = 1;

    // Smart pausing: long words
    if (t.length > 8) multiplier += 0.2;

    // Punctuation at end
    const lastChar = t[t.length - 1];
    if (',;:'.includes(lastChar)) {
      multiplier += 0.3;
    } else if ('.!?'.includes(lastChar) || t.endsWith('...') || t.endsWith('\u2026')) {
      multiplier += 0.5;
    }

    // Paragraph break
    if (word.paragraphEnd) multiplier += 0.8;

    return base * multiplier;
  }

  _emitWord() {
    const word = this.words[this.index];
    const orp = getORPIndex(word.text);
    this.onWord?.({
      pre: word.text.substring(0, orp),
      orp: word.text[orp] || '',
      post: word.text.substring(orp + 1),
      index: this.index,
      total: this.words.length,
    });
    this.onProgress?.(this.index / Math.max(1, this.words.length - 1));
  }
}

export function getORPIndex(word) {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 3) return 1;
  return Math.floor(len * 0.3);
}
