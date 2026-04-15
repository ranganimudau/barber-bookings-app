/**
 * PayFast requires https return/cancel URLs. Opens the installed app via deep link.
 *
 * Android: Chrome blocks many automatic custom-scheme navigations. We use an Intent URL
 * (see https://developer.chrome.com/docs/android/intents) + a plain scheme link as fallback.
 *
 * GET ?next=success | cancel
 */
const ANDROID_PACKAGE = "com.rangani.barberapp";

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const next = (url.searchParams.get("next") || "success").toLowerCase();

  const host = next === "cancel" ? "subscription-cancelled" : "subscription-success";
  const deepLink = `barberapp://${host}`;
  // Intent host must match barberapp://HOST — browser resolves intent://HOST#Intent;scheme=barberapp;...
  // Omit S.browser_fallback_url — it must be https; without it the page stays open with manual buttons.
  const intentUrl = `intent://${host}#Intent;scheme=barberapp;package=${ANDROID_PACKAGE};end`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>Return to app</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 28px 18px; text-align: center;
           background: #0a0a0a; color: #f5f5f0; line-height: 1.45; }
    h1 { font-size: 1.15rem; margin: 0 0 10px; }
    p { color: #a8a29e; font-size: 0.9rem; margin: 10px 0; }
    .btn { display: inline-block; margin: 10px 6px; padding: 14px 18px; border-radius: 12px; font-weight: 800;
           text-decoration: none; min-width: 200px; box-sizing: border-box; }
    .btn-primary { background: #c5a070; color: #0a0a0a; }
    .btn-secondary { border: 1px solid rgba(197,160,112,.55); color: #c5a070; background: transparent; }
    .note { font-size: 0.78rem; color: #78716c; margin-top: 22px; }
    code { font-size: 0.75rem; color: #d6d3d1; }
  </style>
</head>
<body>
  <h1>Payment finished</h1>
  <p>Return to the Barber App to continue. If nothing opens automatically, tap a button below.</p>
  <p>
    <a class="btn btn-primary" href="${intentUrl}" id="androidBtn">Open app (Android)</a>
  </p>
  <p>
    <a class="btn btn-secondary" href="${deepLink}">Open app (direct link)</a>
  </p>
  <p class="note">
    If payment went through, you can close this tab and in the app tap <strong>I have completed payment</strong>.
  </p>
  <p class="note"><code>${deepLink}</code></p>
  <script>
    (function () {
      var ua = navigator.userAgent || "";
      var isAndroid = /Android/i.test(ua);
      if (isAndroid) {
        setTimeout(function () {
          window.location.href = ${JSON.stringify(intentUrl)};
        }, 200);
      } else {
        setTimeout(function () {
          window.location.href = ${JSON.stringify(deepLink)};
        }, 200);
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
