/**
 * Generates a clean, mobile-first white referral email template.
 * Designed for maximum compatibility across all email clients.
 */
export function buildReferralEmailHtml(firstName: string, logoUrl = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png", clientEmail = ""): string {
  const safeName = firstName.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  const safeLogoUrl = logoUrl.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  const referralFormUrl = `https://report.advisorlinkonline.com.au/refer?name=${encodeURIComponent(firstName)}&email=${encodeURIComponent(clientEmail)}`;

  const teal = "#0BB5A0";
  const tealLight = "#e6f9f6";
  const gold = "#D4A017";
  const goldLight = "#fdf6e3";
  const darkText = "#1a1a2e";
  const bodyText = "#444455";
  const mutedText = "#7a7a8e";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .outer { padding: 0 !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .gift-card { padding: 28px 20px !important; }
      .hero-amount { font-size: 72px !important; line-height: 76px !important; }
      .hero-subtitle { font-size: 18px !important; }
      .bonus-card { padding: 24px 20px !important; }
      .bonus-amount { font-size: 48px !important; line-height: 52px !important; }
      .step-cell { padding: 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:#f0f2f5;padding:24px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;background-color:#ffffff;">

  <!-- LOGO -->
  <tr><td style="padding:32px 32px 20px;text-align:center;background-color:#ffffff;">
    <img src="${safeLogoUrl}" alt="Advisor Link Online" width="180" style="display:inline-block;width:180px;max-width:70%;height:auto;border:0;" />
  </td></tr>

  <!-- GIFT CARD HERO -->
  <tr><td class="px" style="padding:0 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:16px;overflow:hidden;">
      <tr><td class="gift-card" style="padding:40px 32px;text-align:center;background-color:${teal};border-radius:16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);">Exclusive Client Reward</p>
        <p class="hero-amount" style="margin:0;font-size:88px;font-weight:bold;color:#ffffff;line-height:92px;letter-spacing:-3px;">$100</p>
        <p class="hero-subtitle" style="margin:4px 0 0;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:2px;">GIFT CARD</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr>
          <td style="background-color:rgba(255,255,255,0.2);border-radius:30px;padding:8px 20px;">
            <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">Just for referring friends &amp; family</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- GREETING -->
  <tr><td class="px" style="padding:0 32px 20px;">
    <p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:${darkText};line-height:26px;">Hi ${safeName},</p>
    <p style="margin:0;font-size:15px;color:${bodyText};line-height:25px;">We wanted to say <strong style="color:${teal};">thank you</strong> for being a valued client — and give you a simple way to be rewarded for helping people you know.</p>
  </td></tr>

  <!-- DIVIDER -->
  <tr><td style="padding:8px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="height:1px;background-color:#e8e8ee;"></td>
    </tr></table>
  </td></tr>

  <!-- HOW IT WORKS -->
  <tr><td class="px" style="padding:20px 32px 12px;text-align:center;">
    <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${mutedText};">How It Works</p>
  </td></tr>

  <!-- STEP 1 -->
  <tr><td class="px" style="padding:0 32px 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:12px;border:1px solid #e8e8ee;background-color:${tealLight};">
      <tr><td class="step-cell" style="padding:22px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="44" style="vertical-align:top;padding-right:16px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:40px;height:40px;border-radius:10px;background-color:${teal};text-align:center;line-height:40px;font-size:18px;font-weight:bold;color:#ffffff;">1</td>
            </tr></table>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:${darkText};">Know 5 people who'd love a free report?</p>
            <p style="margin:0;font-size:14px;color:${bodyText};line-height:22px;">Do you know 5 people that would like a free performance report like you got? Give them a call and ask if they'd like us to send them one. Get 5 and you'll receive a <strong style="color:${teal};">$100 Gift Card</strong>!</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- STEP 2 -->
  <tr><td class="px" style="padding:0 32px 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:12px;border:1px solid #e8e8ee;background-color:${tealLight};">
      <tr><td class="step-cell" style="padding:22px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="44" style="vertical-align:top;padding-right:16px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:40px;height:40px;border-radius:10px;background-color:${teal};text-align:center;line-height:40px;font-size:18px;font-weight:bold;color:#ffffff;">2</td>
            </tr></table>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:${darkText};">Give us permission to mention you</p>
            <p style="margin:0;font-size:14px;color:${bodyText};line-height:22px;">That's literally it — let us say you referred them, and the <strong style="color:${darkText};">$50 is all yours</strong>.</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- BONUS SECTION -->
  <tr><td class="px" style="padding:16px 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:16px;overflow:hidden;">
      <tr><td class="bonus-card" style="padding:32px;text-align:center;background-color:${goldLight};border:2px solid ${gold};border-radius:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;"><tr>
          <td style="background-color:${gold};border-radius:30px;padding:6px 18px;">
            <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">But wait, there's more</p>
          </td>
        </tr></table>

        <p style="margin:0 0 14px;font-size:14px;color:${bodyText};line-height:22px;">If any of your referrals choose to take on board the advice like you have, you receive</p>

        <p class="bonus-amount" style="margin:0;font-size:56px;font-weight:bold;color:${darkText};line-height:60px;letter-spacing:-2px;">$100</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:${gold};letter-spacing:1px;">GIFT CARD</p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px auto;"><tr>
          <td style="width:5px;height:5px;border-radius:50%;background-color:${teal};"></td>
          <td style="width:10px;"></td>
          <td style="width:5px;height:5px;border-radius:50%;background-color:${gold};"></td>
          <td style="width:10px;"></td>
          <td style="width:5px;height:5px;border-radius:50%;background-color:${teal};"></td>
        </tr></table>

        <p style="margin:0;font-size:18px;font-weight:bold;color:${teal};letter-spacing:0;">PER REFERRAL!</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- REFER NOW CTA -->
  <tr><td class="px" style="padding:0 32px 24px;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;border-collapse:separate;">
      <tr>
        <td style="border-radius:14px;background: linear-gradient(135deg, ${teal}, #089e8c);">
          <a href="${referralFormUrl}" style="display:inline-block;padding:18px 48px;color:#ffffff;font-size:20px;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">
            ✨ Refer Now &amp; Earn $50 ✨
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:12px 0 0;font-size:13px;color:${mutedText};">Click above to submit your referrals online</p>
  </td></tr>

  <!-- CONTACT -->
  <tr><td class="px" style="padding:0 32px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e8ee;padding-top:20px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;color:${bodyText};line-height:22px;">We are available <strong style="color:${darkText};">Monday – Friday, 9am – 7pm QLD time</strong>.</p>
        <p style="margin:0 0 16px;font-size:14px;color:${bodyText};line-height:22px;">Please let me know a time that works for you and I'll work something out in between clients.</p>
        <p style="margin:0 0 10px;font-size:14px;color:${mutedText};">Or call me on</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
          <td style="border-radius:10px;background-color:${teal};">
            <a href="tel:0485991688" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">0485 991 688</a>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:#f7f7fa;padding:20px 32px;text-align:center;border-top:1px solid #e8e8ee;">
    <p style="margin:0;font-size:11px;color:${mutedText};line-height:18px;">Advisor Link Online · Helping you get the most from your super</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
