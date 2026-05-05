/**
 * Generates a referral email that matches the referral form page design.
 */
export function buildReferralEmailHtml(firstName: string, logoUrl = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png", clientEmail = ""): string {
  const safeName = firstName.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  const safeLogoUrl = logoUrl.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  const referralFormUrl = `https://report.advisorlinkonline.com.au/refer?name=${encodeURIComponent(firstName)}&email=${encodeURIComponent(clientEmail)}`;

  const teal = "#0BB5A0";
  const gold = "#FFD700";
  const darkText = "#1a1a2e";
  const bodyText = "#3a3a4e";
  const mutedText = "#7a7a8e";
  const bgPage = "#f4f7f6";
  const borderColor = "#e5e9e8";
  const stepBg = "#f4f7f6";

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
      .hero { padding: 28px 20px !important; }
      .hero-title { font-size: 22px !important; line-height: 30px !important; }
      .reward-amount { font-size: 40px !important; line-height: 44px !important; }
      .step-cell { padding: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${bgPage};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:${bgPage};padding:24px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="max-width:600px;width:100%;overflow:hidden;background-color:#ffffff;">

  <!-- HEADER / LOGO -->
  <tr><td style="padding:20px 32px;border-bottom:1px solid ${borderColor};">
    <img src="${safeLogoUrl}" alt="Advisor Link Online" width="160" style="display:inline-block;width:160px;max-width:60%;height:auto;border:0;" />
  </td></tr>

  <!-- TEAL HERO BANNER -->
  <tr><td class="px" style="padding:24px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:16px 16px 0 0;overflow:hidden;">
      <tr><td class="hero" style="padding:32px;background-color:${teal};">
        <p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.8);">Referral Reward Program</p>
        <p class="hero-title" style="margin:0;font-size:26px;font-weight:bold;color:#ffffff;line-height:34px;">Hey ${safeName}, want to earn a <span style="color:${gold};">$100 Gift Card</span>?</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- BODY CONTENT (inside same card) -->
  <tr><td class="px" style="padding:0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};border-bottom:1px solid ${borderColor};border-radius:0 0 16px 16px;overflow:hidden;">

      <!-- Intro text -->
      <tr><td style="padding:24px 24px 16px;">
        <p style="margin:0;font-size:15px;color:${bodyText};line-height:24px;">Do you know <strong>5 people</strong> that would like a free performance report like you got?</p>
      </td></tr>

      <!-- Step 1 -->
      <tr><td style="padding:0 24px 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:12px;background-color:${stepBg};">
          <tr><td class="step-cell" style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="48" style="vertical-align:top;padding-right:14px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:40px;height:40px;border-radius:12px;background-color:rgba(11,181,160,0.1);text-align:center;line-height:40px;font-size:20px;">&#9742;</td>
                </tr></table>
              </td>
              <td style="vertical-align:top;">
                <p style="margin:0;font-size:15px;color:${bodyText};line-height:24px;"><strong style="color:${darkText};">Give them a call or send them a text</strong> — ask if they'd like us to send them a free report!</p>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td></tr>

      <!-- Step 2 -->
      <tr><td style="padding:0 24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:12px;background-color:${stepBg};">
          <tr><td class="step-cell" style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="48" style="vertical-align:top;padding-right:14px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:40px;height:40px;border-radius:12px;background-color:rgba(11,181,160,0.1);text-align:center;line-height:40px;font-size:20px;">&#10024;</td>
                </tr></table>
              </td>
              <td style="vertical-align:top;">
                <p style="margin:0;font-size:15px;color:${bodyText};line-height:24px;">It's <strong style="color:${darkText};">completely free</strong> for them, and you get rewarded for doing the legwork for us 😄</p>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td></tr>

      <!-- Reward Card -->
      <tr><td style="padding:0 24px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 20px;text-align:center;background-color:${teal};border-radius:12px;">
            <p style="margin:0 0 4px;font-size:28px;">&#127873;</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:#ffffff;line-height:24px;">Refer <span style="color:${gold};font-weight:bold;">5 people</span> and receive a</p>
            <p class="reward-amount" style="margin:4px 0 0;font-size:44px;font-weight:800;color:${gold};line-height:48px;letter-spacing:-1px;">$100 <span style="color:#ffffff;">Gift Card</span></p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">It's that simple.</p>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- CTA BUTTON -->
  <tr><td class="px" style="padding:28px 32px;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;border-collapse:separate;width:100%;">
      <tr>
        <td style="border-radius:14px;background-color:${gold};text-align:center;">
          <a href="${referralFormUrl}" style="display:block;padding:20px 32px;color:${darkText};font-size:20px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">
            👉 Click Here To Refer &amp; Earn $100!
          </a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CONTACT -->
  <tr><td class="px" style="padding:0 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${borderColor};padding-top:20px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;color:${bodyText};line-height:22px;">We are available <strong style="color:${darkText};">Monday – Friday, 9am – 7pm QLD time</strong>.</p>
        <p style="margin:0 0 16px;font-size:14px;color:${bodyText};line-height:22px;">Please let me know a time that works for you and I'll work something out in between clients.</p>
        <p style="margin:0 0 10px;font-size:13px;color:${mutedText};">Or call me on</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
          <td style="border-radius:10px;background-color:${teal};">
            <a href="tel:0485991688" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">0485 991 688</a>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:${bgPage};padding:20px 32px;text-align:center;border-top:1px solid ${borderColor};">
    <p style="margin:0;font-size:11px;color:${mutedText};line-height:18px;">&copy; ${new Date().getFullYear()} Advisor Link Online. All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
