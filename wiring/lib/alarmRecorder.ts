import { Audio } from 'expo-av';
import { transcribeWithWhisper } from './whisper';
import { similarityScore } from './matcher';

let activeRecording: Audio.Recording | null = null;
let locked = false;

export interface MatchResult {
  transcript: string;
  score: number;
  matched: boolean;
}

export async function startAlarmRecording(): Promise<Audio.Recording | null> {
  if (locked) return null;
  locked = true;
  try {
    if (activeRecording) { try { await activeRecording.stopAndUnloadAsync(); } catch {} activeRecording = null; }
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
    activeRecording = recording;
    return recording;
  } catch { locked = false; return null; }
}

export async function stopAlarmRecording(recording: Audio.Recording, lang: string, phrase: string): Promise<MatchResult | null> {
  locked = false;
  try {
    const st = await recording.getStatusAsync();
    if (!st.durationMillis || st.durationMillis < 1500) {
      try { await recording.stopAndUnloadAsync(); } catch {}
      activeRecording = null;
      return null;
    }
    await recording.stopAndUnloadAsync();
    activeRecording = null;
    const uri = recording.getURI()!;
    const transcript = await transcribeWithWhisper(uri, lang);
    const score = transcript.length >= 2 ? similarityScore(transcript, phrase) : 0;
    return { transcript, score, matched: score >= 0.7 };
  } catch {
    return { transcript: '', score: 0, matched: false };
  }
}

export function unlockRecorder() { locked = false; }
