/**
 * Generates a designed, mobile-friendly HTML email for the referral gift card campaign.
 * Uses table layouts and inline styles for broad inbox compatibility.
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
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .outer { padding: 0 !important; }
      .px { padding-left: 18px !important; padding-right: 18px !important; }
      .hero { padding-top: 28px !important; padding-bottom: 30px !important; }
      .headline { font-size: 34px !important; line-height: 38px !important; }
      .reward { font-size: 34px !important; line-height: 38px !important; }
      .step-number { width: 40px !important; height: 40px !important; line-height: 40px !important; font-size: 18px !important; }
      .stack { display: block !important; width: 100% !important; padding-right: 0 !important; }
      .stack-text { display: block !important; width: 100% !important; padding-top: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef3f8;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:#eef3f8;padding:28px 12px;border-collapse:collapse;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="max-width:600px;width:100%;border-radius:18px;overflow:hidden;box-shadow:0 12px 42px rgba(21,32,56,0.18);border-collapse:collapse;">

  <!-- HEADER BAR -->
  <tr><td class="px" style="background-color:#152038;padding:26px 32px;text-align:center;">
    <img src="${safeLogoUrl}" alt="Advisor Link Online" width="230" style="display:inline-block;width:230px;max-width:86%;height:auto;border:0;outline:none;text-decoration:none;" />
  </td></tr>

  <!-- HERO BANNER -->
  <tr><td class="px hero" style="background-color:#4269F6;background-image:linear-gradient(135deg,#4269F6 0%,#0CF6DA 100%);padding:38px 32px 40px;text-align:center;">
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#ffffff;opacity:.9;">Exclusive Client Offer</p>
    <h1 class="headline" style="margin:0;font-size:44px;font-weight:900;color:#ffffff;line-height:50px;letter-spacing:0;">Get a <span style="color:#FFE15A;">$50</span><br>Gift Card</h1>
    <p style="margin:14px 0 0;font-size:18px;font-weight:700;color:#152038;line-height:26px;">Just for referring friends &amp; family</p>
  </td></tr>

  <!-- MAIN CONTENT -->
  <tr><td class="px" style="background-color:#ffffff;padding:34px 34px 20px;">
    <p style="margin:0 0 16px;font-size:17px;color:#152038;line-height:28px;">Hi ${safeName},</p>
    <p style="margin:0;font-size:16px;color:#344456;line-height:27px;">We wanted to say <strong>thank you</strong> for being a valued client — and give you a simple way to be rewarded for helping people you know.</p>
  </td></tr>

  <!-- STEP 1 -->
  <tr><td class="px" style="background-color:#ffffff;padding:0 34px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f8ff;border-radius:14px;border-left:5px solid #4269F6;border-collapse:separate;">
      <tr><td style="padding:22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td class="stack" width="52" style="vertical-align:top;padding-right:16px;">
            <div class="step-number" style="width:46px;height:46px;border-radius:50%;background-color:#4269F6;text-align:center;line-height:46px;font-size:21px;font-weight:900;color:#ffffff;">1</div>
          </td>
          <td class="stack-text" style="vertical-align:top;">
            <p style="margin:0 0 7px;font-size:18px;font-weight:800;color:#152038;line-height:24px;">Simply send 7 names &amp; numbers</p>
            <p style="margin:0;font-size:15px;color:#344456;line-height:25px;">Share friends or family who might benefit from a free super review and you will receive a <strong style="color:#4269F6;">$50 Gift Card</strong> to spend.</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- STEP 2 -->
  <tr><td class="px" style="background-color:#ffffff;padding:0 34px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eefdfb;border-radius:14px;border-left:5px solid #0CF6DA;border-collapse:separate;">
      <tr><td style="padding:22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td class="stack" width="52" style="vertical-align:top;padding-right:16px;">
            <div class="step-number" style="width:46px;height:46px;border-radius:50%;background-color:#0bbfad;text-align:center;line-height:46px;font-size:21px;font-weight:900;color:#ffffff;">2</div>
          </td>
          <td class="stack-text" style="vertical-align:top;">
            <p style="margin:0 0 7px;font-size:18px;font-weight:800;color:#152038;line-height:24px;">Let us say you referred them</p>
            <p style="margin:0;font-size:15px;color:#344456;line-height:25px;">You just give us permission to mention your name — that’s it. Once we have the 7 referrals, the <strong style="color:#152038;">$50 is all yours</strong>.</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- BUT WAIT BANNER -->
  <tr><td class="px" style="background-color:#ffffff;padding:0 34px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#152038;border-radius:16px;overflow:hidden;border-collapse:separate;">
      <tr><td style="padding:30px 22px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#0CF6DA;">But wait, there’s more</p>
        <h2 style="margin:0 0 12px;font-size:28px;font-weight:900;color:#ffffff;line-height:34px;letter-spacing:0;">Earn even more rewards</h2>
        <div style="width:62px;height:4px;background-color:#0CF6DA;margin:0 auto 18px;border-radius:2px;"></div>
        <p style="margin:0 0 10px;font-size:16px;color:#f4f8ff;line-height:26px;">If any of your referrals choose to take on board the advice like you have, you receive a</p>
        <p class="reward" style="margin:8px 0;font-size:40px;font-weight:900;color:#FFE15A;line-height:44px;letter-spacing:0;">$100 GIFT CARD</p>
        <p style="margin:0;font-size:18px;font-weight:900;color:#0CF6DA;line-height:24px;">PER REFERRAL</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- CONTACT INFO -->
  <tr><td class="px" style="background-color:#ffffff;padding:0 34px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8edf2;padding-top:24px;">
      <tr><td>
        <p style="margin:0 0 12px;font-size:15px;color:#344456;line-height:25px;">We are available <strong>Monday – Friday, 9am – 7pm QLD time</strong>.</p>
        <p style="margin:0 0 16px;font-size:15px;color:#344456;line-height:25px;">Please let me know a time that works for you and I’ll work something out in between clients.</p>
        <p style="margin:0 0 8px;font-size:15px;color:#344456;">Or call me on</p>
        <a href="tel:0485991688" style="display:inline-block;margin-top:4px;padding:12px 26px;background-color:#4269F6;color:#ffffff;font-size:18px;font-weight:800;text-decoration:none;border-radius:10px;letter-spacing:0;">0485 991 688</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td class="px" style="background-color:#152038;padding:20px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa8b9;line-height:18px;">Advisor Link Online · Helping you get the most from your super</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
