import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle,
  ChevronDown,
  Sparkles,
  Shield,
  TrendingUp,
  User,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Calendar,
  MapPin,
  ClipboardCheck,
} from "lucide-react";

const STATES = [
  "QLD",
  "NSW",
  "VIC",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
];

const BALANCE_RANGES = [
  "Under $50,000",
  "$50,000 - $100,000",
  "$100,000 - $250,000",
  "$250,000 - $500,000",
  "$500,000 - $1,000,000",
  "Over $1,000,000",
];

export default function ReferralLanding() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [superFundName, setSuperFundName] = useState("");
  const [superBalance, setSuperBalance] = useState("");
  const [age, setAge] = useState("");
  const [state, setState] = useState("");
  const [hadReview, setHadReview] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    supabase
      .from("referral_leads")
      .select("*")
      .eq("token", token)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setLead(data);
          setName(data.lead_name || "");
          setPhone(data.lead_phone || "");
          setEmail(data.lead_email || "");
        }
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      toast.error("Please fill in your name, phone, and email");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("referral_responses").insert({
        lead_id: lead?.id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        super_fund_name: superFundName || null,
        super_balance: superBalance || null,
        age: age || null,
        state: state || null,
        had_review_before: hadReview,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0f9f7] to-[#e8f4f8] flex items-center justify-center">
        <div className="animate-pulse text-[#0BB5A0] text-lg">Loading...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0f9f7] to-[#e8f4f8] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-10 text-center">
          <div className="w-20 h-20 bg-[#0BB5A0]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[#0BB5A0]" />
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a2e] mb-4 font-heading">
            Thank You!
          </h1>
          <p className="text-[#444455] text-lg leading-relaxed mb-3">
            Someone from the team will reach out within the next{" "}
            <strong className="text-[#0BB5A0]">24–48 hours</strong> to get
            your free report generated and confirm your details.
          </p>
          <p className="text-[#7a7a8e] text-sm">
            We look forward to helping you get the most from your super!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9f7] to-[#e8f4f8]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e8ee]">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-4">
          <img
            src="https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png"
            alt="Advisor Link Online"
            className="h-10"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="bg-gradient-to-r from-[#0BB5A0] to-[#089e8c] rounded-2xl p-8 mb-8 text-white text-center shadow-lg">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-90" />
          <h1 className="text-3xl font-bold mb-2 font-heading">
            Your Free Super Performance Report
          </h1>
          {lead?.referrer_name && (
            <p className="text-white/90 text-lg">
              <strong>{lead.referrer_name}</strong> thought you'd benefit from this!
            </p>
          )}
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Shield, title: "100% Free", desc: "No cost, no obligation" },
            { icon: TrendingUp, title: "Expert Analysis", desc: "Professional super review" },
            { icon: CheckCircle, title: "Quick & Easy", desc: "Takes just 2 minutes" },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-xl p-5 text-center border border-[#e8e8ee] shadow-sm"
            >
              <div className="w-10 h-10 bg-[#0BB5A0]/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-[#0BB5A0]" />
              </div>
              <h3 className="font-bold text-[#1a1a2e] text-sm">{title}</h3>
              <p className="text-[#7a7a8e] text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#e8e8ee] overflow-hidden">
          <div className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-6 font-heading">
              Tell Us About Yourself
            </h2>

            <div className="space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldGroup icon={User} label="Full Name">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                  />
                </FieldGroup>
                <FieldGroup icon={Phone} label="Phone Number">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0400 000 000"
                    type="tel"
                    className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                  />
                </FieldGroup>
              </div>

              <FieldGroup icon={Mail} label="Email Address">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  type="email"
                  className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                />
              </FieldGroup>

              {/* Divider */}
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-[#e8e8ee]" />
                <span className="text-xs font-semibold text-[#7a7a8e] uppercase tracking-wider">
                  Super Details
                </span>
                <div className="flex-1 h-px bg-[#e8e8ee]" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldGroup icon={Building2} label="Super Fund Name">
                  <Input
                    value={superFundName}
                    onChange={(e) => setSuperFundName(e.target.value)}
                    placeholder="e.g. Australian Super"
                    className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                  />
                </FieldGroup>
                <FieldGroup icon={DollarSign} label="Approximate Super Balance">
                  <div className="relative">
                    <select
                      value={superBalance}
                      onChange={(e) => setSuperBalance(e.target.value)}
                      className="w-full h-10 rounded-md border border-[#e0e0e8] bg-white px-3 py-2 text-sm focus:border-[#0BB5A0] focus:ring-2 focus:ring-[#0BB5A0]/20 focus:outline-none appearance-none pr-10"
                    >
                      <option value="">Select range</option>
                      {BALANCE_RANGES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a8e] pointer-events-none" />
                  </div>
                </FieldGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldGroup icon={Calendar} label="Your Age">
                  <Input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 35"
                    type="number"
                    min="18"
                    max="100"
                    className="border-[#e0e0e8] focus:border-[#0BB5A0] focus:ring-[#0BB5A0]/20"
                  />
                </FieldGroup>
                <FieldGroup icon={MapPin} label="State">
                  <div className="relative">
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full h-10 rounded-md border border-[#e0e0e8] bg-white px-3 py-2 text-sm focus:border-[#0BB5A0] focus:ring-2 focus:ring-[#0BB5A0]/20 focus:outline-none appearance-none pr-10"
                    >
                      <option value="">Select state</option>
                      {STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a7a8e] pointer-events-none" />
                  </div>
                </FieldGroup>
              </div>

              <FieldGroup icon={ClipboardCheck} label="Have you had a super review before?">
                <div className="flex gap-3">
                  {[
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setHadReview(opt.value)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                        hadReview === opt.value
                          ? "border-[#0BB5A0] bg-[#0BB5A0]/5 text-[#0BB5A0]"
                          : "border-[#e0e0e8] text-[#7a7a8e] hover:border-[#0BB5A0]/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FieldGroup>
            </div>

            {/* Submit */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-[#0BB5A0] hover:bg-[#099e8c] text-white px-12 py-6 text-lg rounded-xl shadow-lg shadow-[#0BB5A0]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#0BB5A0]/30 w-full md:w-auto"
              >
                {submitting ? "Submitting..." : "Get My Free Report"}
              </Button>
              <p className="text-xs text-[#7a7a8e] text-center">
                No cost · No obligation · 100% confidential
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold text-[#1a1a2e] mb-2">
        <Icon className="w-4 h-4 text-[#0BB5A0]" />
        {label}
      </label>
      {children}
    </div>
  );
}
