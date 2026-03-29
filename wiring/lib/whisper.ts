const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY!;
const TIMEOUT_MS = 10_000;

export async function transcribeWithWhisper(audioUri: string, lang: string = 'en'): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', lang);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Whisper timeout: request took longer than 10s');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper error: ${err}`);
  }

  const data = await response.json();
  return data.text as string;
}