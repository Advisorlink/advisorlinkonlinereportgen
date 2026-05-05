import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, CheckCircle, AlertCircle, Gift, Phone, Sparkles } from "lucide-react";

interface ReferralEntry {
  name: string;
  phone: string;
  email: string;
}

const emptyEntry = (): ReferralEntry => ({ name: "", phone: "", email: "" });

export default function ReferralForm() {
  const [params] = useSearchParams();
  const clientName = params.get("name") || "";
  const clientEmail = params.get("email") || "";

  const [referrals, setReferrals] = useState<ReferralEntry[]>(
    Array.from({ length: 5 }, emptyEntry)
  );
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateEntry = (i: number, field: keyof ReferralEntry, value: string) => {
    setReferrals((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const filledEntries = referrals.filter(
    (r) => r.name.trim() && r.phone.trim() && r.email.trim()
  );

  const handleSubmit = async () => {
    if (filledEntries.length === 0) {
      toast.error("Please fill in at least one referral");
      return;
    }
    if (!agreed) {
      toast.error("Please agree to the disclaimer before submitting");
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = crypto.randomUUID();

      const { error: subErr } = await supabase
        .from("referral_submissions" as any)
        .insert({
          id: submissionId,
          client_name: clientName,
          client_email: clientEmail,
          referrals: filledEntries,
        } as any);

      if (subErr) throw subErr;

      const leads = filledEntries.map((r) => ({
        submission_id: submissionId,
        referrer_name: clientName,
        referrer_email: clientEmail,
        lead_name: r.name,
        lead_phone: r.phone,
        lead_email: r.email,
      }));

      const { error: leadErr } = await supabase
        .from("referral_leads" as any)
        .insert(leads as any);

      if (leadErr) throw leadErr;

      await supabase.functions.invoke("send-referral-emails", {
        body: { submissionId: submissionId },
      });

      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 sm:p-12 text-center border border-[#e5e9e8]">
          <div className="w-16 h-16 bg-[#0BB5A0]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-[#0BB5A0]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] mb-3">
            Thank You, {clientName}!
          </h1>
          <p className="text-[#5a5a6e] text-base leading-relaxed mb-6">
            Your referrals have been submitted successfully. We'll reach out to
            each of them with an invitation for a free Super Performance Report.
          </p>
          <div className="inline-flex items-center gap-2 bg-[#0BB5A0]/10 text-[#0BB5A0] font-semibold text-lg px-6 py-3 rounded-xl">
            <Gift className="w-5 h-5" />
            Your $100 gift card is on its way!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      {/* Compact Header */}
      <header className="bg-white border-b border-[#e5e9e8]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <img
            src="https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png"
            alt="Advisor Link Online"
            className="h-8 sm:h-9"
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-[#e5e9e8] shadow-sm overflow-hidden mb-6">
          {/* Top banner */}
          <div className="bg-[#0BB5A0] px-5 sm:px-8 py-6 sm:py-8">
            <p className="text-white/80 text-sm font-medium tracking-wide uppercase mb-1">
              Referral Reward Program
            </p>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-snug">
              Hey {clientName || "there"}, want to earn a{" "}
              <span className="text-[#FFD700]">$100 Gift Card</span>?
            </h1>
          </div>

          {/* Steps */}
          <div className="px-5 sm:px-8 py-6 sm:py-8 space-y-4">
            <p className="text-[#3a3a4e] text-sm sm:text-base leading-relaxed">
              Do you know <strong>5 people</strong> that would like a free performance report like you got?
            </p>

            <div className="grid gap-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3 sm:gap-4 bg-[#f4f7f6] rounded-xl p-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0BB5A0]/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-[#0BB5A0]" />
                </div>
                <p className="text-[#3a3a4e] text-sm sm:text-base leading-relaxed pt-1.5 sm:pt-2">
                  <strong>Give them a call or send them a text</strong> — ask if they'd like us to send them a free report!
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 sm:gap-4 bg-[#f4f7f6] rounded-xl p-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0BB5A0]/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#0BB5A0]" />
                </div>
                <p className="text-[#3a3a4e] text-sm sm:text-base leading-relaxed pt-1.5 sm:pt-2">
                  It's <strong>completely free</strong> for them, and you get rewarded for doing the legwork for us 😄
                </p>
              </div>
            </div>

            {/* Reward highlight */}
            <div className="relative bg-gradient-to-br from-[#0BB5A0] to-[#089e8c] rounded-xl p-5 sm:p-6 text-white text-center mt-2">
              <Gift className="w-8 h-8 mx-auto mb-2 opacity-90" />
              <p className="text-base sm:text-lg font-semibold leading-snug">
                Refer <span className="text-[#FFD700] font-bold">5 people</span> and receive a
              </p>
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">
                <span className="text-[#FFD700]">$100</span> Gift Card
              </p>
              <p className="text-white/70 text-xs sm:text-sm mt-2">It's that simple.</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-[#e5e9e8] shadow-sm overflow-hidden">
          <div className="px-5 sm:px-8 py-6 sm:py-8">
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-1">
              Your Referrals
            </h2>
            <p className="text-[#7a7a8e] text-sm mb-6">
              Fill in the details of up to 5 people below.
            </p>

            <div className="space-y-3">
              {referrals.map((entry, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#e5e9e8] hover:border-[#0BB5A0]/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#f8fafb] border-b border-[#e5e9e8] rounded-t-xl">
                    <span className="w-6 h-6 rounded-md bg-[#0BB5A0] text-white text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-[#3a3a4e]">
                      Referral {i + 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 sm:p-4">
                    <Input
                      placeholder="Full Name"
                      value={entry.name}
                      onChange={(e) => updateEntry(i, "name", e.target.value)}
                      className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20 h-10 text-sm"
                    />
                    <Input
                      placeholder="Phone"
                      type="tel"
                      value={entry.phone}
                      onChange={(e) => updateEntry(i, "phone", e.target.value)}
                      className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20 h-10 text-sm"
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={entry.email}
                      onChange={(e) => updateEntry(i, "email", e.target.value)}
                      className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20 h-10 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="mt-6 p-4 bg-[#fffbeb] border border-[#f0e0a0] rounded-xl">
              <div className="flex gap-3">
                <AlertCircle className="w-4 h-4 text-[#b89a30] flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-[#5a5540] leading-relaxed">
                  By submitting, your referrals will receive an email from us letting them know
                  <strong> {clientName || "you"}</strong> referred them, inviting them to receive
                  a free Super Performance Report. Your information is handled per our privacy policy.
                </p>
              </div>
              <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 rounded border-[#c0b870] text-[#0BB5A0] focus:ring-[#0BB5A0]"
                />
                <span className="text-xs sm:text-sm font-medium text-[#3a3a4e]">
                  I agree and give permission to contact my referrals
                </span>
              </label>
            </div>

            {/* Submit */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting || filledEntries.length === 0 || !agreed}
                className="w-full sm:w-auto bg-[#0BB5A0] hover:bg-[#099e8c] text-white px-8 py-5 text-base rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit {filledEntries.length} Referral{filledEntries.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
              <p className="text-xs text-[#9a9aae]">
                {filledEntries.length} of 5 referrals filled
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[#b0b0be] mt-6 mb-4">
          © {new Date().getFullYear()} Advisor Link Online. All rights reserved.
        </p>
      </main>
    </div>
  );
}
