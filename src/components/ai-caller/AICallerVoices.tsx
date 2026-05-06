import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Voice {
  id: string;
  elevenLabsId: string;
  name: string;
  accent: string;
  gender: string;
  description: string;
  previewUrl?: string;
}

const VOICES: Voice[] = [
  { id: "sarah", elevenLabsId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", accent: "Australian", gender: "Female", description: "Warm, professional" },
  { id: "laura", elevenLabsId: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", accent: "Australian", gender: "Female", description: "Friendly, clear" },
  { id: "charlie", elevenLabsId: "IKne3meq5aSn9XLyUdCD", name: "Charlie", accent: "Australian", gender: "Male", description: "Confident, natural" },
  { id: "george", elevenLabsId: "JBFqnCBsd6RMkjVDRZzb", name: "George", accent: "Australian/British", gender: "Male", description: "Authoritative, calm" },
  { id: "callum", elevenLabsId: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", accent: "Australian", gender: "Male", description: "Conversational, relaxed" },
  { id: "river", elevenLabsId: "SAz9YHcvj6GT2YYXdXww", name: "River", accent: "Neutral", gender: "Non-binary", description: "Smooth, versatile" },
  { id: "matilda", elevenLabsId: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", accent: "Australian", gender: "Female", description: "Energetic, bright" },
  { id: "jessica", elevenLabsId: "cgSgspJ2msm6clMCkdW9", name: "Jessica", accent: "Australian", gender: "Female", description: "Soft, empathetic" },
  { id: "alice", elevenLabsId: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", accent: "British", gender: "Female", description: "Refined, articulate" },
  { id: "brian", elevenLabsId: "nPczCjzI2devNBz1zQrb", name: "Brian", accent: "American", gender: "Male", description: "Deep, trustworthy" },
  { id: "lily", elevenLabsId: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", accent: "British", gender: "Female", description: "Gentle, warm" },
  { id: "daniel", elevenLabsId: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", accent: "British", gender: "Male", description: "Authoritative, clear" },
];

export function AICallerVoices() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>(VOICES);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch public preview URLs from ElevenLabs (no API key needed)
  useEffect(() => {
    async function fetchPreviews() {
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/voices");
        if (!res.ok) return;
        const data = await res.json();
        const voiceMap = new Map<string, string>();
        for (const v of data.voices || []) {
          if (v.preview_url) voiceMap.set(v.voice_id, v.preview_url);
        }
        setVoices(prev =>
          prev.map(v => ({
            ...v,
            previewUrl: voiceMap.get(v.elevenLabsId) || v.previewUrl,
          }))
        );
      } catch {
        // Preview URLs are optional — browser fallback still works
      }
    }
    fetchPreviews();
  }, []);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setPlaying(null);
  }

  async function previewVoice(voice: Voice) {
    stopAudio();
    setLoading(voice.id);
    try {
      if (voice.previewUrl) {
        const audio = new Audio(voice.previewUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlaying(null); audioRef.current = null; };
        audio.onerror = () => {
          setPlaying(null);
          audioRef.current = null;
          toast.error("Could not load voice preview");
        };
        setPlaying(voice.id);
        setLoading(null);
        await audio.play();
        return;
      }

      // Fallback: browser speech synthesis
      const sampleText = `Hi there, this is ${voice.name} from Advisor Link. How are you going today?`;
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.lang = "en-AU";
      utterance.rate = 0.95;
      utterance.onend = () => setPlaying(null);
      utterance.onerror = () => setPlaying(null);
      setPlaying(voice.id);
      setLoading(null);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Preview error:", e);
      toast.error("Could not play voice preview");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Voices</h2>
        <p className="text-sm text-muted-foreground">Preview and choose voices for your call scripts</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {voices.map(v => (
          <Card key={v.id} className="bg-card border-border hover:border-cyan/30 transition-colors">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan/20 to-primary/20 flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4 text-cyan" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.accent} · {v.gender}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => playing === v.id ? stopAudio() : previewVoice(v)}
                  disabled={loading === v.id}
                >
                  {loading === v.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan" />
                  ) : playing === v.id ? (
                    <Square className="w-4 h-4 text-cyan" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{v.description}</p>
              <div className="mt-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  ID: {v.id}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30 border-border">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Click play to hear the actual ElevenLabs AI voice. Select any voice ID in the Script editor's Voice dropdown.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
