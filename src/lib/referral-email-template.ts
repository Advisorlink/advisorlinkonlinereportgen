/**
 * Generates a premium, mobile-friendly HTML email for the referral gift card campaign.
 * Features 3D-style elements, depth effects, and world-class design.
 */
export function buildReferralEmailHtml(firstName: string, logoUrl = "https://report.advisorlinkonline.com.au/logo-email.png"): string {
  const safeName = firstName.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  const safeLogoUrl = logoUrl.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width: 700px) {
      .container { width: 100% !important; max-width: 100% !important; border-radius: 18px !important; }
      .outer { padding: 10px !important; background-color:#07101f !important; }
      .px { padding-left: 16px !important; padding-right: 16px !important; }
      .hero-section { padding: 14px 16px 30px !important; }
      .gift-shell { width: 100% !important; max-width: 350px !important; padding: 3px 3px 9px !important; border-radius: 22px !important; }
      .gift-card { width: 100% !important; border-radius: 19px !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.16) !important; }
      .gift-card-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-title { font-size: 24px !important; line-height: 30px !important; }
      .hero-amount { font-size: 74px !important; line-height: 78px !important; letter-spacing: -2px !important; text-shadow: 0 3px 0 #06101f, 0 8px 20px rgba(0,0,0,0.45), 0 0 22px rgba(12,246,218,0.55) !important; }
      .reward-amount { font-size: 36px !important; line-height: 40px !important; }
      .card-3d { margin-left: 0 !important; margin-right: 0 !important; box-shadow: 0 7px 0 #07101f, 0 12px 22px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08) !important; }
      .step-row { display: block !important; width: 100% !important; }
      .step-icon-cell { display: block !important; width: 100% !important; text-align: center !important; padding-bottom: 12px !important; padding-right: 0 !important; }
      .step-text-cell { display: block !important; width: 100% !important; text-align: center !important; }
      .bonus-shell { padding: 3px 3px 9px !important; border-radius: 22px !important; background-image: linear-gradient(135deg,#ffd76a 0%,#0CF6DA 44%,#1b2c62 100%) !important; }
      .bonus-inner { padding: 28px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:'Inter',Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:#0a0e1a;padding:24px 12px;border-collapse:collapse;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;border-collapse:collapse;background-color:#0f1628;">

  <!-- LOGO BAR -->
  <tr><td class="px" style="background-color:#0f1628;padding:28px 36px 16px;text-align:center;">
    <img src="${safeLogoUrl}" alt="Advisor Link Online" width="200" style="display:inline-block;width:200px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;" />
  </td></tr>

  <!-- HERO — 3D gift card effect -->
  <tr><td class="px hero-section" style="padding:12px 36px 40px;text-align:center;">
    <!-- 3D Gift Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" class="gift-shell" style="width:92%;max-width:466px;border-collapse:separate;border-radius:24px;background-image:linear-gradient(135deg,#0CF6DA 0%,#00a7ff 36%,#142148 72%,#050914 100%);box-shadow:0 10px 0 #06101f, 0 22px 42px rgba(0,0,0,0.58), 0 0 44px rgba(12,246,218,0.18);padding:4px 4px 12px;">
        <tr><td>
        <table role="presentation" cellpadding="0" cellspacing="0" class="gift-card card-3d" style="width:100%;border-collapse:separate;border-radius:20px;overflow:hidden;background-image:linear-gradient(145deg,#22365f 0%,#0d1a33 48%,#17223c 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -18px 35px rgba(0,0,0,0.24);">
          <tr><td class="gift-card-pad" style="padding:36px 28px 14px;">
            <!-- Decorative line -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="height:3px;background-image:linear-gradient(90deg,#00d4ff,#0CF6DA,#00d4ff);border-radius:2px;"></td>
            </tr></table>
          </td></tr>
          <tr><td class="gift-card-pad" style="padding:8px 28px 4px;text-align:center;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#0CF6DA;">Exclusive Client Reward</p>
          </td></tr>
          <tr><td class="gift-card-pad" style="padding:4px 28px 0;text-align:center;">
            <p class="hero-amount" style="margin:0;font-size:88px;font-weight:900;color:#ffffff;line-height:92px;letter-spacing:-3px;text-shadow:0 4px 20px rgba(0,212,255,0.3), 0 1px 0 rgba(255,255,255,0.1);">$50</p>
          </td></tr>
          <tr><td class="gift-card-pad" style="padding:2px 28px 8px;text-align:center;">
            <p class="hero-title" style="margin:0;font-size:26px;font-weight:800;color:#ffffff;line-height:32px;letter-spacing:0.5px;">GIFT CARD</p>
          </td></tr>
          <tr><td class="gift-card-pad" style="padding:4px 28px 28px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;border-collapse:separate;"><tr>
              <td style="background-color:rgba(12,246,218,0.12);border:1px solid rgba(12,246,218,0.25);border-radius:30px;padding:8px 22px;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#0CF6DA;letter-spacing:0.5px;">Just for referring friends &amp; family</p>
              </td>
            </tr></table>
          </td></tr>
          <!-- Bottom decorative line -->
          <tr><td class="gift-card-pad" style="padding:0 28px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="height:3px;background-image:linear-gradient(90deg,#0CF6DA,#00d4ff,#0CF6DA);border-radius:2px;"></td>
            </tr></table>
          </td></tr>
        </table>
        </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- GREETING -->
  <tr><td class="px" style="padding:0 36px 8px;">
    <p style="margin:0 0 14px;font-size:18px;font-weight:600;color:#ffffff;line-height:28px;">Hi ${safeName},</p>
    <p style="margin:0;font-size:15px;color:#8a99b4;line-height:26px;font-weight:400;">We wanted to say <span style="color:#0CF6DA;font-weight:700;">thank you</span> for being a valued client — and give you a simple way to be rewarded for helping people you know.</p>
  </td></tr>

  <!-- DIVIDER -->
  <tr><td style="padding:24px 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="height:1px;background-color:#1e2a45;"></td>
    </tr></table>
  </td></tr>

  <!-- HOW IT WORKS LABEL -->
  <tr><td class="px" style="padding:0 36px 18px;text-align:center;">
    <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#5a6b8a;">How It Works</p>
  </td></tr>

  <!-- STEP 1 — 3D Card -->
  <tr><td class="px" style="padding:0 36px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card-3d" style="border-collapse:separate;border-radius:16px;background-image:linear-gradient(160deg,#141e36 0%,#111a2e 100%);box-shadow:0 4px 16px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset;border:1px solid rgba(255,255,255,0.05);">
      <tr><td style="padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td class="step-icon-cell step-row" width="56" style="vertical-align:top;padding-right:18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr><td style="width:48px;height:48px;border-radius:14px;background-image:linear-gradient(145deg,#00d4ff,#0CF6DA);text-align:center;line-height:48px;font-size:20px;font-weight:900;color:#0f1628;box-shadow:0 4px 14px rgba(12,246,218,0.3);">1</td></tr></table>
          </td>
          <td class="step-text-cell step-row" style="vertical-align:top;">
            <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#ffffff;line-height:22px;">Send us 7 names &amp; numbers</p>
            <p style="margin:0;font-size:14px;color:#8a99b4;line-height:23px;">Share friends or family who might benefit from a free super review and you'll receive a <strong style="color:#0CF6DA;">$50 Gift Card</strong> to spend however you like.</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- STEP 2 — 3D Card -->
  <tr><td class="px" style="padding:0 36px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card-3d" style="border-collapse:separate;border-radius:16px;background-image:linear-gradient(160deg,#141e36 0%,#111a2e 100%);box-shadow:0 4px 16px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset;border:1px solid rgba(255,255,255,0.05);">
      <tr><td style="padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td class="step-icon-cell step-row" width="56" style="vertical-align:top;padding-right:18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr><td style="width:48px;height:48px;border-radius:14px;background-image:linear-gradient(145deg,#00d4ff,#0CF6DA);text-align:center;line-height:48px;font-size:20px;font-weight:900;color:#0f1628;box-shadow:0 4px 14px rgba(12,246,218,0.3);">2</td></tr></table>
          </td>
          <td class="step-text-cell step-row" style="vertical-align:top;">
            <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#ffffff;line-height:22px;">Give us permission to mention you</p>
            <p style="margin:0;font-size:14px;color:#8a99b4;line-height:23px;">That's literally it — let us say you referred them, and the <strong style="color:#ffffff;">$50 is all yours</strong>.</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- SPACER -->
  <tr><td style="padding:10px 0;"></td></tr>

  <!-- BUT WAIT — Premium 3D Banner -->
  <tr><td class="px" style="padding:0 36px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:20px;overflow:hidden;background-image:linear-gradient(145deg,#0a2e4a 0%,#0d1a33 40%,#1a0a33 100%);box-shadow:0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(12,246,218,0.1), 0 0 80px rgba(12,246,218,0.06) inset;">
      <tr><td class="bonus-inner" style="padding:36px 32px;text-align:center;">
        <!-- Glowing accent -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;border-collapse:separate;"><tr>
          <td style="background-color:rgba(12,246,218,0.1);border:1px solid rgba(12,246,218,0.2);border-radius:30px;padding:6px 18px;">
            <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#0CF6DA;">But wait, there's more</p>
          </td>
        </tr></table>

        <p style="margin:0 0 16px;font-size:15px;color:#8a99b4;line-height:24px;">If any of your referrals choose to take on board the advice like you have, you receive</p>

        <!-- 3D Amount -->
        <p class="reward-amount" style="margin:0;font-size:52px;font-weight:900;color:#ffffff;line-height:56px;letter-spacing:-2px;text-shadow:0 0 30px rgba(255,215,0,0.4), 0 4px 12px rgba(0,0,0,0.5);">$100</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#FFD700;line-height:24px;letter-spacing:1px;">GIFT CARD</p>

        <!-- Divider dot -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto;border-collapse:separate;"><tr>
          <td style="width:6px;height:6px;border-radius:50%;background-color:#0CF6DA;"></td>
          <td style="width:12px;"></td>
          <td style="width:6px;height:6px;border-radius:50%;background-color:rgba(12,246,218,0.5);"></td>
          <td style="width:12px;"></td>
          <td style="width:6px;height:6px;border-radius:50%;background-color:rgba(12,246,218,0.25);"></td>
        </tr></table>

        <p style="margin:0;font-size:20px;font-weight:900;color:#0CF6DA;line-height:26px;letter-spacing:0;">PER REFERRAL!</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- CONTACT SECTION -->
  <tr><td class="px" style="padding:0 36px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1e2a45;padding-top:24px;">
      <tr><td>
        <p style="margin:0 0 10px;font-size:14px;color:#8a99b4;line-height:24px;">We are available <strong style="color:#c8d4e6;">Monday – Friday, 9am – 7pm QLD time</strong>.</p>
        <p style="margin:0 0 18px;font-size:14px;color:#8a99b4;line-height:24px;">Please let me know a time that works for you and I'll work something out in between clients.</p>
        <p style="margin:0 0 10px;font-size:14px;color:#8a99b4;">Or call me on</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
          <td style="border-radius:12px;background-image:linear-gradient(145deg,#00d4ff,#0CF6DA);box-shadow:0 4px 16px rgba(12,246,218,0.3);">
            <a href="tel:0485991688" style="display:inline-block;padding:14px 30px;color:#0f1628;font-size:17px;font-weight:800;text-decoration:none;letter-spacing:0;">0485 991 688</a>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td class="px" style="background-color:#080c18;padding:22px 36px;text-align:center;border-top:1px solid #1a2240;">
    <p style="margin:0;font-size:11px;color:#4a5670;line-height:18px;letter-spacing:0.3px;">Advisor Link Online · Helping you get the most from your super</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
