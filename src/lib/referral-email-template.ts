/**
 * Generates a beautifully designed HTML email for the referral gift card campaign.
 * Uses Advisor Link Online brand colors: navy (#152038), cyan gradient (#0CF6DA → #4269F6).
 */
export function buildReferralEmailHtml(firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(21,32,56,0.15);">

  <!-- HEADER BAR -->
  <tr><td style="background:linear-gradient(135deg,#152038 0%,#1a2d4d 100%);padding:28px 32px;text-align:center;">
    <img src="https://report.advisorlinkonline.com.au/src/assets/logo.svg" alt="Advisor Link Online" width="200" style="display:inline-block;max-width:200px;height:auto;" />
  </td></tr>

  <!-- HERO BANNER -->
  <tr><td style="background:linear-gradient(135deg,#4269F6 0%,#0CF6DA 100%);padding:40px 32px;text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);">EXCLUSIVE OFFER</p>
    <h1 style="margin:0 0 12px;font-size:42px;font-weight:800;color:#ffffff;line-height:1.1;">GET A <span style="color:#FFD700;">$50</span></h1>
    <h1 style="margin:0 0 16px;font-size:42px;font-weight:800;color:#ffffff;line-height:1.1;">GIFT CARD</h1>
    <p style="margin:0;font-size:18px;font-weight:500;color:rgba(255,255,255,0.9);">Just for referring your friends &amp; family!</p>
  </td></tr>

  <!-- MAIN CONTENT -->
  <tr><td style="background-color:#ffffff;padding:36px 32px 24px;">
    <p style="margin:0 0 20px;font-size:17px;color:#152038;line-height:1.6;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:16px;color:#3a4a5c;line-height:1.7;">We wanted to say <strong>thank you</strong> for being a valued client — and we have an exciting offer just for you!</p>
  </td></tr>

  <!-- STEP 1 -->
  <tr><td style="background-color:#ffffff;padding:0 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f8faff 0%,#eef6ff 100%);border-radius:12px;border-left:4px solid #4269F6;">
      <tr><td style="padding:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;padding-right:16px;">
            <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#4269F6,#0CF6DA);text-align:center;line-height:48px;font-size:22px;font-weight:800;color:#fff;">1</div>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#152038;">It's Simple!</p>
            <p style="margin:0;font-size:15px;color:#3a4a5c;line-height:1.6;">Give us <strong>7 Names &amp; Numbers</strong> of friends or family who might benefit from a free super review.</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- STEP 2 -->
  <tr><td style="background-color:#ffffff;padding:0 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f8faff 0%,#eef6ff 100%);border-radius:12px;border-left:4px solid #0CF6DA;">
      <tr><td style="padding:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;padding-right:16px;">
            <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#0CF6DA,#4269F6);text-align:center;line-height:48px;font-size:22px;font-weight:800;color:#fff;">2</div>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#152038;">Give Us Permission</p>
            <p style="margin:0;font-size:15px;color:#3a4a5c;line-height:1.6;">Just let us mention that <strong>you referred them</strong> — that's it! The <span style="color:#4269F6;font-weight:700;">$50 Gift Card</span> is all yours! 🎉</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- BUT WAIT BANNER -->
  <tr><td style="background-color:#ffffff;padding:0 32px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#152038 0%,#1a2d4d 100%);border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#0CF6DA;">But wait...</p>
        <h2 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">THERE'S MORE! 😄</h2>
        <div style="width:60px;height:3px;background:linear-gradient(90deg,#4269F6,#0CF6DA);margin:0 auto 16px;border-radius:2px;"></div>
        <p style="margin:0 0 8px;font-size:16px;color:rgba(255,255,255,0.9);line-height:1.6;">If any of your referrals choose to take on board the advice like you have...</p>
        <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.7);">You receive a</p>
        <p style="margin:8px 0;font-size:38px;font-weight:800;color:#FFD700;line-height:1.1;">$100 GIFT CARD</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#0CF6DA;">PER REFERRAL!! 🎁</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- CONTACT INFO -->
  <tr><td style="background-color:#ffffff;padding:0 32px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8edf2;padding-top:24px;">
      <tr><td>
        <p style="margin:0 0 12px;font-size:15px;color:#3a4a5c;line-height:1.7;">We are available <strong>Monday – Friday, 9am – 7pm QLD time</strong>.</p>
        <p style="margin:0 0 16px;font-size:15px;color:#3a4a5c;line-height:1.7;">Please let me know a time that works for you and I'll work something out in between clients.</p>
        <p style="margin:0 0 4px;font-size:15px;color:#3a4a5c;">Or call me on</p>
        <a href="tel:0485991688" style="display:inline-block;margin-top:8px;padding:10px 28px;background:linear-gradient(135deg,#4269F6 0%,#0CF6DA 100%);color:#ffffff;font-size:18px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:1px;">📞 0485 991 688</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:#152038;padding:20px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);">Advisor Link Online · Helping you get the most from your super</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
