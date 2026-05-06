import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, Volume2, Mic } from "lucide-react";
import { toast } from "sonner";

interface Voice {
  id: string;
  elevenLabsId: string;
  name: string;
  accent: string;
  gender: string;
  description: string;
  sampleText: string;
}

const VOICES: Voice[] = [
  { id: "sarah", elevenLabsId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", accent: "Australian", gender: "Female", description: "Warm, professional", sampleText: "G'day! I'm Sarah, calling from Advisor Link." },
  { id: "laura", elevenLabsId: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", accent: "Australian", gender: "Female", description: "Friendly, clear", sampleText: "Hi there, this is Laura from Advisor Link." },
  { id: "charlie", elevenLabsId: "IKne3meq5aSn9XLyUdCD", name: "Charlie", accent: "Australian", gender: "Male", description: "Confident, natural", sampleText: "G'day mate, Charlie here from Advisor Link." },
  { id: "george", elevenLabsId: "JBFqnCBsd6RMkjVDRZzb", name: "George", accent: "Australian/British", gender: "Male", description: "Authoritative, calm", sampleText: "Good afternoon, this is George from Advisor Link." },
  { id: "callum", elevenLabsId: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", accent: "Australian", gender: "Male", description: "Conversational, relaxed", sampleText: "Hey, Callum here from Advisor Link." },
  { id: "river", elevenLabsId: "SAz9YHcvj6GT2YYXdXww", name: "River", accent: "Neutral", gender: "Non-binary", description: "Smooth, versatile", sampleText: "Hello, this is River from Advisor Link." },
  { id: "matilda", elevenLabsId: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", accent: "Australian", gender: "Female", description: "Energetic, bright", sampleText: "Hi! Matilda here from Advisor Link." },
  { id: "jessica", elevenLabsId: "cgSgspJ2msm6clMCkdW9", name: "Jessica", accent: "Australian", gender: "Female", description: "Soft, empathetic", sampleText: "Hello, this is Jessica calling from Advisor Link." },
  { id: "alice", elevenLabsId: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", accent: "British", gender: "Female", description: "Refined, articulate", sampleText: "Good day, Alice here from Advisor Link." },
  { id: "brian", elevenLabsId: "nPczCjzI2devNBz1zQrb", name: "Brian", accent: "American", gender: "Male", description: "Deep, trustworthy", sampleText: "Hi there, Brian calling from Advisor Link." },
  { id: "lily", elevenLabsId: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", accent: "British", gender: "Female", description: "Gentle, warm", sampleText: "Hello, this is Lily from Advisor Link." },
  { id: "daniel", elevenLabsId: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", accent: "British", gender: "Male", description: "Authoritative, clear", sampleText: "Good day, Daniel here from Advisor Link." },
];

export function AICallerVoices() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(null);
  }

  async function previewVoice(voice: Voice) {
    stopAudio();
    setLoading(voice.id);
    try {
      // Use ElevenLabs preview URL (public samples)
      const previewUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenLabsId}/stream?optimize_streaming_latency=0`;
      // We can't call ElevenLabs directly from browser without API key,
      // so we use the built-in ElevenLabs voice preview URLs
      const sampleUrl = `https://storage.googleapis.com/eleven-public-prod/premade/voices/${voice.elevenLabsId}/manifest.json`;
      
      // Try fetching the manifest for preview samples
      const res = await fetch(sampleUrl).catch(() => null);
      if (res?.ok) {
        const manifest = await res.json();
        if (manifest?.samples?.[0]?.sample_url) {
          const audio = new Audio(manifest.samples[0].sample_url);
          audioRef.current = audio;
          audio.onended = () => { setPlaying(null); audioRef.current = null; };
          audio.onerror = () => { setPlaying(null); audioRef.current = null; };
          setPlaying(voice.id);
          setLoading(null);
          await audio.play();
          return;
        }
      }

      // Fallback: use ElevenLabs public preview
      const previewAudioUrl = `https://api.elevenlabs.io/v1/voices/${voice.elevenLabsId}`;
      const voiceRes = await fetch(previewAudioUrl);
      if (voiceRes.ok) {
        const voiceData = await voiceRes.json();
        if (voiceData?.preview_url) {
          const audio = new Audio(voiceData.preview_url);
          audioRef.current = audio;
          audio.onended = () => { setPlaying(null); audioRef.current = null; };
          audio.onerror = () => { setPlaying(null); audioRef.current = null; };
          setPlaying(voice.id);
          setLoading(null);
          await audio.play();
          return;
        }
      }

      toast("Preview not available for this voice");
    } catch (e) {
      console.error("Preview error:", e);
    } finally {
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
        {VOICES.map(v => (
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
                    <Volume2 className="w-4 h-4 animate-pulse text-cyan" />
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
            <strong>Tip:</strong> When creating a script, select any of these voices from the Voice dropdown. The voice ID shown on each card matches the selector in the script editor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
