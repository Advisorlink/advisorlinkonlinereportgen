import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Send, CheckCircle, AlertCircle } from "lucide-react";

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
      // Generate ID client-side so we don't need select-after-insert
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

      // Create individual leads
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

      // Trigger emails to each referral
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
      <div className="min-h-screen bg-gradient-to-br from-[#f0f9f7] to-[#e8f4f8] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-10 text-center">
          <div className="w-20 h-20 bg-[#0BB5A0]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[#0BB5A0]" />
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a2e] mb-4 font-heading">
            Thank You, {clientName}!
          </h1>
          <p className="text-[#444455] text-lg leading-relaxed mb-6">
            Your referrals have been submitted successfully. We'll reach out to
            each of them with an invitation for a free Super Performance Report.
          </p>
          <p className="text-[#0BB5A0] font-semibold text-lg">
            Your $100 gift card is on its way! 🎉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9f7] to-[#e8f4f8]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e8ee]">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
          <img
            src="https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png"
            alt="Advisor Link Online"
            className="h-10"
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="rounded-2xl mb-8 overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-[#0BB5A0] to-[#089e8c] p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <span className="text-3xl">🎉</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 font-heading">
              Hey {clientName || "there"}!
            </h1>
            <p className="text-white/90 text-xl leading-relaxed">
              Do you know 5 people that would like a free performance report like you got!!!? 
            </p>
          </div>
          
          <div className="bg-white p-6 space-y-4">
            <div className="flex items-start gap-4 p-4 bg-[#f0f9f7] rounded-xl border-l-4 border-[#0BB5A0]">
              <span className="text-2xl flex-shrink-0">📞</span>
              <p className="text-[#1a1a2e] text-base leading-relaxed">
                Well I'll tell you what.. <strong>Give them a call, send them a text</strong> and ask if they'd like us to send them one!!
              </p>
            </div>
            
            <div className="flex items-start gap-4 p-4 bg-[#f0f9f7] rounded-xl border-l-4 border-[#0BB5A0]">
              <span className="text-2xl flex-shrink-0">🆓</span>
              <p className="text-[#1a1a2e] text-base leading-relaxed">
                It's <strong>free for them</strong> as you know, and you get rewarded for doing the work for us 😄
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-3 p-5 bg-gradient-to-r from-[#0BB5A0]/10 to-[#089e8c]/10 rounded-xl border-2 border-dashed border-[#0BB5A0]">
              <span className="text-3xl">🎁</span>
              <p className="text-[#1a1a2e] text-lg font-semibold text-center">
                Yup, that's right — give us <strong>5 people</strong> that want a free report and you'll receive a <span className="text-[#0BB5A0] text-xl font-bold">$100 Gift Card!</span>
              </p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#e8e8ee] overflow-hidden">
          <div className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-1 font-heading">
              Your Referrals
            </h2>
            <p className="text-[#7a7a8e] text-sm mb-6">
              Add up to 5 people who might benefit from a free super performance review.
            </p>

            <div className="space-y-4">
              {referrals.map((entry, i) => (
                <div
                  key={i}
                  className="group rounded-xl border border-[#e8e8ee] hover:border-[#0BB5A0]/40 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#f8fafb] rounded-t-xl border-b border-[#e8e8ee]">
                    <span className="w-7 h-7 rounded-lg bg-[#0BB5A0] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-[#1a1a2e]">
                      Referral {i + 1}
                      {i === 0 && <span className="text-[#0BB5A0] ml-1">*</span>}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
                    <Input
                      placeholder="Full Name"
                      value={entry.name}
                      onChange={(e) => updateEntry(i, "name", e.target.value)}
                      className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                    />
                    <Input
                      placeholder="Phone Number"
                      type="tel"
                      value={entry.phone}
                      onChange={(e) => updateEntry(i, "phone", e.target.value)}
                      className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                    />
                    <Input
                      placeholder="Email Address"
                      type="email"
                      value={entry.email}
                      onChange={(e) => updateEntry(i, "email", e.target.value)}
                      className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="mt-8 p-5 bg-[#fff8e6] border border-[#D4A017]/30 rounded-xl">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-[#D4A017] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#444455] leading-relaxed">
                    By submitting this form, you understand that your referrals will receive
                    an email letting them know that <strong>{clientName || "you"}</strong> has
                    referred them, and inviting them to receive a free Super Performance Report.
                    They will be asked to fill out a short form if they would like to take
                    advantage of this offer. Your information will be handled in accordance
                    with our privacy policy.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-3 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-5 h-5 rounded border-[#D4A017] text-[#0BB5A0] focus:ring-[#0BB5A0]"
                />
                <span className="text-sm font-medium text-[#1a1a2e]">
                  I agree and give permission to contact my referrals
                </span>
              </label>
            </div>

            {/* Submit */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting || filledEntries.length === 0 || !agreed}
                className="bg-[#0BB5A0] hover:bg-[#099e8c] text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-[#0BB5A0]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#0BB5A0]/30 disabled:opacity-50"
              >
                {submitting ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Submit {filledEntries.length} Referral{filledEntries.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
              <p className="text-xs text-[#7a7a8e]">
                {filledEntries.length} of 5 referrals filled in
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
