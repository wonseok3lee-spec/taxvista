# WIRING — Claude Code Master Reference

## 🧠 Product Philosophy
Wiring is NOT an alarm app. It is a **behavioral identity rewiring system**.
- Users must SPEAK their pre-recorded goal phrase to dismiss the alarm
- Their own voice must MATCH the stored recording (via Whisper STT + text similarity)
- No snooze. No escape. Speak your identity or the alarm keeps going.

---

## 🏗️ Tech Stack (MVP)

| Layer | Tech | Notes |
|---|---|---|
| Framework | React Native (Expo) | Use `expo` managed workflow |
| Language | TypeScript | Strict mode on |
| Navigation | Expo Router | File-based routing |
| Audio recording | `expo-av` | Record + playback |
| Alarm scheduling | `expo-notifications` | Local push notifications |
| STT (speech-to-text) | OpenAI Whisper API | `whisper-1` model |
| Text matching | Levenshtein / cosine similarity | JS util, no backend needed for MVP |
| Storage | `expo-secure-store` + AsyncStorage | Phrases + streak data |
| State | Zustand | Lightweight, no boilerplate |
| Styling | NativeWind (Tailwind for RN) | Utility-first |
| Backend (future) | Supabase | Auth + sync later |

---

## 📁 Project Structure

```
wiring/
├── app/                        # Expo Router pages
│   ├── (tabs)/
│   │   ├── index.tsx           # Home (set alarm)
│   │   ├── record.tsx          # Record goal phrase
│   │   └── streak.tsx          # Streak / identity tracker
│   ├── alarm.tsx               # Full-screen alarm screen (modal)
│   └── _layout.tsx
├── components/
│   ├── AlarmCard.tsx
│   ├── PhraseRecorder.tsx      # Mic UI + recording logic
│   ├── VoiceMatcher.tsx        # Whisper call + match logic
│   ├── StreakDisplay.tsx
│   └── WaveformVisualizer.tsx  # Optional: animated mic waveform
├── lib/
│   ├── whisper.ts              # OpenAI Whisper API wrapper
│   ├── matcher.ts              # Text similarity scoring
│   ├── alarmScheduler.ts       # expo-notifications logic
│   └── storage.ts              # AsyncStorage helpers
├── store/
│   └── useWiringStore.ts       # Zustand: phrases, alarms, streaks
├── constants/
│   └── theme.ts                # Colors, fonts, spacing
├── assets/
└── CLAUDE.md                   # This file
```

---

## ⚙️ Core Logic — Voice Matching (MVP)

```typescript
// lib/matcher.ts
// MVP approach: record → Whisper STT → compare text (NOT audio waveform)

export async function matchVoice(
  recordedAudioUri: string,
  targetPhrase: string
): Promise<{ matched: boolean; score: number; transcript: string }> {
  // 1. Send audio to Whisper
  const transcript = await transcribeWithWhisper(recordedAudioUri);
  
  // 2. Normalize both strings
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9가-힣\s]/g, '');
  
  // 3. Calculate similarity score (0-1)
  const score = similarityScore(normalize(transcript), normalize(targetPhrase));
  
  // 4. Threshold: 0.75 = matched (adjustable)
  return { matched: score >= 0.75, score, transcript };
}
```

**Why text-based (not audio waveform)?**
- Audio waveform matching requires heavy ML models — overkill for MVP
- Whisper STT is fast, cheap ($0.006/min), and handles accents well
- "I am a billionaire" spoken groggily at 6am still matches "i am a billionaire" at 0.9+ score

---

## 🔔 Alarm Flow

```
User sets alarm
       ↓
expo-notifications fires at alarm time
       ↓
alarm.tsx opens (full-screen, no dismiss button)
       ↓
User presses mic button → records voice
       ↓
Audio → Whisper API → transcript
       ↓
transcript vs stored phrase → similarity score
       ↓
score ≥ 0.75?
  YES → alarm dismissed + streak +1
  NO  → volume up + "Try again" + loop
```

---

## 📱 Screen Specs

### 1. Home Screen (`app/(tabs)/index.tsx`)
- Show next alarm time
- Quick "Set Alarm" button
- Today's phrase preview
- Streak counter

### 2. Record Screen (`app/(tabs)/record.tsx`)
- Text input for goal phrase
- Big mic button (press & hold to record)
- Playback to confirm
- Save button → stores to AsyncStorage

### 3. Alarm Screen (`app/alarm.tsx`)
- **Full-screen modal** — triggered by notification
- NO close button, NO snooze
- Shows the goal phrase text
- Pulsing mic button
- Visual feedback: waveform while recording
- Success state: green flash + dismiss
- Fail state: red shake + volume++ + retry

### 4. Streak Screen (`app/(tabs)/streak.tsx`)
- Calendar heatmap (days succeeded)
- Current streak number
- Best streak
- "Identity Score" (fun metric)

---

## 🎨 Design System

```typescript
// constants/theme.ts
export const theme = {
  colors: {
    background: '#0A0A0A',      // Near black
    surface: '#141414',
    primary: '#6C63FF',         // Purple (identity/brain)
    success: '#22C55E',
    danger: '#EF4444',
    text: '#FFFFFF',
    textMuted: '#888888',
  },
  fonts: {
    heading: 'Inter-Bold',
    body: 'Inter-Regular',
  },
  spacing: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48
  }
}
```

**Visual Direction:** Dark, minimal, premium. Think Calm app meets Notion. No bright colors except on success/fail states. The alarm screen should feel slightly intense — intentional friction.

---

## 🔑 Environment Variables

```bash
# .env (never commit)
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

---

## 💰 Freemium Logic

```typescript
// FREE tier
const FREE_LIMITS = {
  maxPhrases: 1,
  whisperCallsPerDay: 1,
  streakHistory: 7,  // days
}

// PAID tier ($3-5/month via RevenueCat)
const PAID_LIMITS = {
  maxPhrases: Infinity,
  whisperCallsPerDay: Infinity,
  streakHistory: Infinity,
  advancedAnalytics: true,
}
```

---

## ⚠️ Known Constraints & Gotchas

| Issue | Solution |
|---|---|
| iOS background alarm | Use `expo-notifications` + `expo-task-manager` for background tasks |
| Audio permissions | Request `RECORD_AUDIO` on first launch with clear explanation |
| Whisper latency (~1-2s) | Show spinner + waveform animation to mask wait time |
| No internet → Whisper fails | Fallback: local keyword matching (check if any word of phrase present) |
| User cheats (mumbles) | Threshold 0.75 catches this; add "speak clearly" UX hint on fail |
| App killed during alarm | Re-schedule notification on `AppState` change |

---

## 🚀 MVP Build Order

```
Phase 1 — Core Loop (Week 1-2)
  [ ] Expo project setup + TypeScript + NativeWind
  [ ] AsyncStorage: save/load phrase
  [ ] expo-av: record audio
  [ ] Whisper API integration
  [ ] Text similarity matcher
  [ ] Alarm screen UI (full-screen, no escape)

Phase 2 — Alarm Scheduling (Week 2-3)
  [ ] expo-notifications: set local alarm
  [ ] Background wake + open alarm.tsx
  [ ] Fail loop: volume escalation
  [ ] Success: dismiss + streak increment

Phase 3 — Polish (Week 3-4)
  [ ] Streak screen + calendar
  [ ] Onboarding (record first phrase)
  [ ] Dark mode UI polish
  [ ] TestFlight / internal beta

Phase 4 — Monetization
  [ ] RevenueCat integration
  [ ] Free/paid gating
  [ ] App Store submission
```

---

## 🧪 Testing Phrases (use these for dev)

```
"I am disciplined and I show up every day"
"나는 꾸준한 사람이다"
"I am building something that matters"
"Every morning I choose who I become"
```

---

## 📌 Claude Code Instructions

When I say "build X", follow this order:
1. Create the file/component
2. Wire it into the relevant screen
3. Add TypeScript types
4. Add basic error handling
5. Do NOT add features not listed here unless asked

Keep components small (<150 lines). Extract logic to `lib/`. 
Always use the Zustand store for shared state. Never use useState for global data.
