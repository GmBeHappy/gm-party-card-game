'use client'

/**
 * Every sound in the game is synthesised at runtime with the Web Audio API —
 * there are no audio files to ship, license, or wait on. Each entry is a short
 * envelope over one or two oscillators; swapping an entry for a real sample
 * later is a change to this table alone.
 */
export type SoundName =
  | 'card:select'
  | 'card:deselect'
  | 'card:play'
  | 'pass'
  | 'turn'
  | 'tick'
  | 'eightCut'
  | 'revolution'
  | 'deal'
  | 'finish'
  | 'victory'
  | 'join'
  | 'leave'
  | 'error'

interface Tone {
  freq: number
  type: OscillatorType
  duration: number
  gain?: number
  /** Slide to this frequency over the tone's life. */
  slideTo?: number
  /** Delay before this tone starts, in seconds. */
  at?: number
}

const RECIPES: Readonly<Record<SoundName, Tone[]>> = {
  'card:select': [{ freq: 880, type: 'triangle', duration: 0.05, gain: 0.14 }],
  'card:deselect': [{ freq: 620, type: 'triangle', duration: 0.05, gain: 0.1 }],
  'card:play': [
    { freq: 320, type: 'sawtooth', duration: 0.16, slideTo: 720, gain: 0.13 },
    { freq: 900, type: 'sine', duration: 0.12, at: 0.03, gain: 0.08 },
  ],
  pass: [{ freq: 180, type: 'sine', duration: 0.16, slideTo: 120, gain: 0.16 }],
  turn: [
    { freq: 660, type: 'sine', duration: 0.12, gain: 0.16 },
    { freq: 990, type: 'sine', duration: 0.16, at: 0.1, gain: 0.14 },
  ],
  tick: [{ freq: 1400, type: 'square', duration: 0.03, gain: 0.06 }],
  eightCut: [
    { freq: 1800, type: 'sawtooth', duration: 0.12, slideTo: 200, gain: 0.16 },
    { freq: 140, type: 'square', duration: 0.16, at: 0.05, gain: 0.12 },
  ],
  revolution: [
    { freq: 1200, type: 'sawtooth', duration: 0.55, slideTo: 90, gain: 0.2 },
    { freq: 600, type: 'square', duration: 0.5, slideTo: 60, at: 0.05, gain: 0.12 },
  ],
  deal: [
    { freq: 400, type: 'triangle', duration: 0.05, gain: 0.08 },
    { freq: 460, type: 'triangle', duration: 0.05, at: 0.06, gain: 0.08 },
    { freq: 520, type: 'triangle', duration: 0.05, at: 0.12, gain: 0.08 },
    { freq: 580, type: 'triangle', duration: 0.05, at: 0.18, gain: 0.08 },
  ],
  finish: [
    { freq: 523, type: 'sine', duration: 0.12, gain: 0.15 },
    { freq: 659, type: 'sine', duration: 0.12, at: 0.1, gain: 0.15 },
    { freq: 784, type: 'sine', duration: 0.2, at: 0.2, gain: 0.15 },
  ],
  victory: [
    { freq: 523, type: 'triangle', duration: 0.14, gain: 0.18 },
    { freq: 659, type: 'triangle', duration: 0.14, at: 0.12, gain: 0.18 },
    { freq: 784, type: 'triangle', duration: 0.14, at: 0.24, gain: 0.18 },
    { freq: 1047, type: 'triangle', duration: 0.4, at: 0.36, gain: 0.2 },
  ],
  join: [{ freq: 700, type: 'sine', duration: 0.09, slideTo: 1000, gain: 0.12 }],
  leave: [{ freq: 500, type: 'sine', duration: 0.11, slideTo: 300, gain: 0.12 }],
  error: [{ freq: 150, type: 'square', duration: 0.18, gain: 0.14 }],
}

const MUTE_KEY = 'slave:muted'
const VOLUME_KEY = 'slave:volume'

class SoundEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
  private volume = 0.7

  constructor() {
    if (typeof window === 'undefined') return
    try {
      this.muted = window.localStorage.getItem(MUTE_KEY) === '1'
      const stored = window.localStorage.getItem(VOLUME_KEY)
      if (stored !== null) this.volume = Number(stored)
    } catch {
      /* defaults are fine */
    }
  }

  /**
   * Browsers refuse to start audio without a gesture, so the context is
   * created lazily on the first interaction rather than at page load.
   */
  unlock(): void {
    if (typeof window === 'undefined' || this.context !== null) return
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctor === undefined) return
    try {
      this.context = new Ctor()
      this.master = this.context.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume
      this.master.connect(this.context.destination)
    } catch {
      this.context = null
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  getVolume(): number {
    return this.volume
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.apply()
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  setVolume(volume: number): void {
    this.volume = volume
    this.apply()
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume))
    } catch {
      /* ignore */
    }
  }

  play(name: SoundName): void {
    this.unlock()
    const context = this.context
    const master = this.master
    if (context === null || master === null || this.muted) return
    if (context.state === 'suspended') void context.resume()

    const now = context.currentTime
    for (const tone of RECIPES[name]) {
      const start = now + (tone.at ?? 0)
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = tone.type
      oscillator.frequency.setValueAtTime(tone.freq, start)
      if (tone.slideTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, tone.slideTo),
          start + tone.duration,
        )
      }
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.12, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(start)
      oscillator.stop(start + tone.duration + 0.02)
    }
  }

  /** Short haptic buzz on devices that support it, tied to the same toggle. */
  vibrate(pattern: number | number[]): void {
    if (this.muted) return
    try {
      navigator.vibrate?.(pattern)
    } catch {
      /* not supported */
    }
  }

  private apply(): void {
    if (this.master === null) return
    this.master.gain.value = this.muted ? 0 : this.volume
  }
}

export const sound = new SoundEngine()
