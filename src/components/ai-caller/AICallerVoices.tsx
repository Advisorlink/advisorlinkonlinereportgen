import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, Volume2, Mic, Loader2 } from "lucide-react";
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
  { id: "sarah", elevenLabsId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", accent: "Australian", gender: "Female", description: "Warm, professional", sampleText: "G'day! I'm Sarah, calling from Advisor Link. How are you going today?" },
  { id: "laura", elevenLabsId: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", accent: "Australian", gender: "Female", description: "Friendly, clear", sampleText: "Hi there, this is Laura from Advisor Link. I hope I'm not catching you at a bad time." },
  { id: "charlie", elevenLabsId: "IKne3meq5aSn9XLyUdCD", name: "Charlie", accent: "Australian", gender: "Male", description: "Confident, natural", sampleText: "G'day mate, Charlie here from Advisor Link. Got a quick moment to chat?" },
  { id: "george", elevenLabsId: "JBFqnCBsd6RMkjVDRZzb", name: "George", accent: "Australian/British", gender: "Male", description: "Authoritative, calm", sampleText: "Good afternoon, this is George from Advisor Link. I'd love to have a quick chat about your superannuation." },
  { id: "callum", elevenLabsId: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", accent: "Australian", gender: "Male", description: "Conversational, relaxed", sampleText: "Hey there, Callum here from Advisor Link. How's your day been so far?" },
  { id: "river", elevenLabsId: "SAz9YHcvj6GT2YYXdXww", name: "River", accent: "Neutral", gender: "Non-binary", description: "Smooth, versatile", sampleText: "Hello, this is River from Advisor Link. I'm reaching out about your financial planning options." },
  { id: "matilda", elevenLabsId: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", accent: "Australian", gender: "Female", description: "Energetic, bright", sampleText: "Hi! Matilda here from Advisor Link. I've got some great news about your super options!" },
  { id: "jessica", elevenLabsId: "cgSgspJ2msm6clMCkdW9", name: "Jessica", accent: "Australian", gender: "Female", description: "Soft, empathetic", sampleText: "Hello, this is Jessica calling from Advisor Link. I just wanted to check in with you about your financial goals." },
  { id: "alice", elevenLabsId: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", accent: "British", gender: "Female", description: "Refined, articulate", sampleText: "Good day, Alice here from Advisor Link. I'd like to discuss some excellent opportunities for your portfolio." },
  { id: "brian", elevenLabsId: "nPczCjzI2devNBz1zQrb", name: "Brian", accent: "American", gender: "Male", description: "Deep, trustworthy", sampleText: "Hi there, Brian calling from Advisor Link. I wanted to talk to you about securing your financial future." },
  { id: "lily", elevenLabsId: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", accent: "British", gender: "Female", description: "Gentle, warm", sampleText: "Hello, this is Lily from Advisor Link. I hope you're having a lovely day. May I have a moment of your time?" },
  { id: "daniel", elevenLabsId: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", accent: "British", gender: "Male", description: "Authoritative, clear", sampleText: "Good day, Daniel here from Advisor Link. I'd like to share some important information about your superannuation." },
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
    window.speechSynthesis.cancel();
    setPlaying(null);
  }

  async function previewVoice(voice: Voice) {
    stopAudio();
    setLoading(voice.id);
    try {
      // Try server-side TTS preview via edge function
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: {
          action: "preview-voice",
          voiceId: voice.elevenLabsId,
          text: voice.sampleText,
        },
      });

      if (!error && data?.audioBase64) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlaying(null); audioRef.current = null; };
        audio.onerror = () => { setPlaying(null); audioRef.current = null; };
        setPlaying(voice.id);
        setLoading(null);
        await audio.play();
        return;
      }

      // Fallback: browser speech synthesis
      const utterance = new SpeechSynthesisUtterance(voice.sampleText);
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
            <strong>Tip:</strong> Click play to hear a preview. The actual call voices use ElevenLabs AI and will sound more natural than the browser preview. Select any voice in the Script editor's Voice dropdown.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
