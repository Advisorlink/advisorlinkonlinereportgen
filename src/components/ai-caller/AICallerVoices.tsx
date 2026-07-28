import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  { id: "voice1", elevenLabsId: "DTLT09E2cxHF0DqjKVbc", name: "Adam", accent: "Australian", gender: "Male", description: "Energetic, bright" },
  { id: "voice2", elevenLabsId: "4yye0QE5YPsKbMOCGGlj", name: "Damien", accent: "Australian", gender: "Male", description: "Natural, friendly" },
  { id: "voice3", elevenLabsId: "w9rPM8AIZle60Nbpw7nl", name: "Emily", accent: "Australian", gender: "Female", description: "Conversational, relaxed" },
  { id: "voice4", elevenLabsId: "4uJW3zTppOdNDWtKUtux", name: "Marcus", accent: "Australian", gender: "Male", description: "Warm, professional" },
  { id: "voice5", elevenLabsId: "2nzji8yPQooBwG4eQO4s", name: "Lachlan", accent: "Australian", gender: "Male", description: "Confident, approachable" },
  { id: "voice6", elevenLabsId: "NMbn4FNN0acONjKLsueJ", name: "Declan", accent: "Australian", gender: "Male", description: "Smooth, trustworthy" },
  { id: "voice7", elevenLabsId: "sclx1MZrNqboRcmLWoDb", name: "Ryan", accent: "Australian", gender: "Male", description: "Clear, engaging" },
];

export function AICallerVoices() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>(VOICES);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch preview URLs from edge function (uses ElevenLabs API key for community voices)
  useEffect(() => {
    async function fetchPreviews() {
      try {
        const { data, error } = await supabase.functions.invoke("vapi-manage", {
          body: { action: "voice-previews" },
        });
        if (error || !data?.previews) return;
        const previews = data.previews as Record<string, string>;
        setVoices(prev =>
          prev.map(v => ({
            ...v,
            previewUrl: previews[v.id] || v.previewUrl,
          }))
        );
      } catch {
        // Preview URLs are optional - browser fallback still works
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
      const sampleText = `Hi there, this is ${voice.name} from Settled & Sound. How are you going today?`;
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
