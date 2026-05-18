/**
 * Generates a beautifully designed HTML email for sending the
 * Super Performance Report. Matches the Advisor Link Online brand.
 */
export function buildReportEmailHtml(
  clientFullName: string,
  logoUrl = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png",
): string {
  const escape = (s: string) =>
    s.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  const firstName = (clientFullName ?? "").trim().split(/\s+/)[0] || "there";
  const safeName = escape(firstName);
  const safeLogoUrl = escape(logoUrl);

  // Brand palette (matches the report + referral email)
  const brandBlue = "#29B6F6";
  const brandBlueDark = "#1E88E5";
  const navy = "#0c1f33";
  const gold = "#FFD700";
  const darkText = "#1a1a2e";
  const bodyText = "#3a3a4e";
  const mutedText = "#7a7a8e";
  const bgPage = "#f4f7f6";
  const borderColor = "#e5e9e8";
  const softBg = "#f4f7f6";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .outer { padding: 0 !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .hero { padding: 30px 22px !important; }
      .hero-title { font-size: 24px !important; line-height: 32px !important; }
      .cta-text { font-size: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${bgPage};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:${bgPage};padding:24px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px -4px rgba(12,31,51,0.12);">

  <!-- HEADER / LOGO -->
  <tr><td style="padding:22px 32px;border-bottom:1px solid ${borderColor};">
    <img src="${safeLogoUrl}" alt="Advisor Link Online" width="170" style="display:inline-block;width:170px;max-width:60%;height:auto;border:0;" />
  </td></tr>

  <!-- HERO BANNER -->
  <tr><td class="hero" style="padding:40px 32px;background:linear-gradient(135deg, ${navy} 0%, ${brandBlueDark} 60%, ${brandBlue} 100%);">
    <p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.75);">Your Free Super Performance Report</p>
    <p class="hero-title" style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:36px;letter-spacing:-0.5px;">Hi ${safeName}, your report is ready 🎉</p>
    <p style="margin:14px 0 0;font-size:15px;color:rgba(255,255,255,0.85);line-height:23px;">A simple look at what an extra 2.5% on your current return could mean for you by retirement.</p>
  </td></tr>

  <!-- BODY INTRO -->
  <tr><td class="px" style="padding:32px 32px 8px;">
    <p style="margin:0 0 16px;font-size:16px;color:${bodyText};line-height:26px;">
      Thanks for taking the time to request your free performance report. We've put it together personally for you and it's <strong style="color:${darkText};">attached to this email</strong> as a PDF.
    </p>
  </td></tr>

  <!-- ATTACHMENT CALL-OUT (mimics a button so it's the visual focal point) -->
  <tr><td class="px" style="padding:24px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:16px;background:linear-gradient(135deg, ${brandBlueDark}, ${brandBlue});">
      <tr><td style="padding:26px 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:30px;line-height:30px;">📎</p>
        <p class="cta-text" style="margin:0;font-size:18px;font-weight:800;color:#ffffff;line-height:26px;letter-spacing:0.2px;">Your Free Report is Attached</p>
        <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);line-height:20px;">Open the PDF below to view your full report.</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- HERE TO HELP CARD -->
  <tr><td class="px" style="padding:24px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:14px;background-color:${softBg};border:1px solid ${borderColor};">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${brandBlueDark};">We're here to help</p>
        <p style="margin:0 0 12px;font-size:15px;color:${bodyText};line-height:24px;">
          Once you've had a read, if there's <strong style="color:${darkText};">anything that concerns you</strong> or you'd just like a bit more information, please feel free to reach out. We're more than happy to walk you through it.
        </p>
        <p style="margin:0;font-size:15px;color:${bodyText};line-height:24px;">
          We'll also <strong style="color:${darkText};">check in with you in a couple of days</strong> to see if you had any questions and to let you know about a <strong style="color:${darkText};">free review</strong> with a fully licensed financial advisor at no extra cost. Completely optional, only if you'd like it.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- CONTACT STRIP -->
  <tr><td class="px" style="padding:24px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:14px 18px;border-radius:12px;background-color:#ffffff;border:1px solid ${borderColor};font-size:14px;color:${bodyText};line-height:22px;">
          <strong style="color:${darkText};">Prefer a quick chat?</strong><br>
          Call us on <a href="tel:0485991688" style="color:${brandBlueDark};text-decoration:none;font-weight:700;">0485 991 688</a> · Mon–Fri 9am–7pm QLD time
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- SIGN OFF -->
  <tr><td class="px" style="padding:24px 32px 8px;">
    <p style="margin:0 0 4px;font-size:15px;color:${bodyText};line-height:24px;">Kind regards,</p>
    <p style="margin:0;font-size:15px;color:${darkText};font-weight:700;line-height:24px;">The Advisor Link Online Team</p>
  </td></tr>

  <!-- DISCLAIMER -->
  <tr><td class="px" style="padding:20px 32px 28px;">
    <p style="margin:0;font-size:11px;color:${mutedText};line-height:18px;font-style:italic;">
      This report is provided for general informational purposes only and is not financial advice. It compares publicly available information about your current super fund with alternatives to highlight potential improvements. For advice tailored to your personal circumstances, please speak with a licensed financial advisor.
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:${bgPage};padding:18px 32px;text-align:center;border-top:1px solid ${borderColor};">
    <p style="margin:0;font-size:11px;color:${mutedText};line-height:18px;">&copy; ${new Date().getFullYear()} Advisor Link Online. All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
