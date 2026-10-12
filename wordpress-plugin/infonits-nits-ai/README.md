# NITS AI — WordPress plugin v1.1.0

**NITS** is the Infonits website AI assistant powered by **Anthropic Claude**. It installs directly into WordPress and works without an external database. An optional secure webhook can copy project enquiries to the separate Infonits Agent Leads dashboard (Claude API usage is billed separately by Anthropic).

## What is included

- Six original, lightweight, editable **2D SVG mascot states** (idle, greeting, listening, thinking, success, fallback); animated idle movement and thinking dots using built-in CSS (no Rive runtime, audio or external library required).
- Responsive floating chat widget, accessible labels, keyboard support, reduced-motion mode, English/Tamil/Sinhala response guidance and starter service prompts.
- Claude Messages API chat — user API key stays **server-side**. Select Haiku 4.5, Sonnet 4.6 or Sonnet 5 in settings.
- Answers using editable approved knowledge plus relevant **published WordPress content and Elementor text**. No external crawling, no search index to maintain.
- Project enquiry form: name, email, WhatsApp number, service, optional budget/timeline, description, required consent, optional recent chat excerpt.
- WordPress Leads dashboard: view individual enquiries, update status, delete records, CSV export, email notifications through `wp_mail()`.
- Optional secure server-to-server lead sync to the Infonits Agent Leads dashboard, with a built-in connection test.
- Settings: API key, connection test, assistant name/intro/colour, display mode, model, output limit, notifications, WhatsApp destination, daily call cap, automatic lead retention.
- Shortcode `[nits_ai]` for specific-page deployment.

## Update notes (v1.1.0)

**v1.1.0** adds optional lead forwarding to the Infonits dashboard. Leads are always saved in WordPress first, so a temporary dashboard outage does not make the visitor's submission fail. The webhook URL and shared secret are used only by server-side PHP and are never included in frontend JavaScript. Service, budget, timeline, source page, site URL and the local WordPress lead ID are forwarded as structured metadata.

To connect the dashboard:

1. Configure the dashboard's `SUPABASE_SERVICE_ROLE_KEY`, `INFONITS_AGENT_WEBHOOK_SECRET` and `INFONITS_AGENT_ORGANIZATION_ID` environment variables, then deploy it.
2. In WordPress open **NITS AI → Settings → Infonits dashboard lead sync**.
3. Enter `https://YOUR-DASHBOARD-DOMAIN/api/agent-leads` as the webhook URL.
4. Enter the same value used for `INFONITS_AGENT_WEBHOOK_SECRET`, enable **Send leads to dashboard**, and save.
5. Click **Test dashboard connection**. This intentionally creates one clearly labelled test lead.
6. Submit a real website enquiry and confirm that it appears in both WordPress and the Agent Leads dashboard.

For stronger secret management, define the secret in `wp-config.php` instead of storing it in the WordPress options table:

```php
define( 'NITS_LEAD_WEBHOOK_SECRET', 'YOUR_LONG_RANDOM_SECRET' );
```

The constant takes precedence and the settings screen cannot overwrite it. HTTPS is required for the webhook URL.

## Previous frontend visibility fix (v1.0.1)

**v1.0.1** fixes the floating assistant not appearing even when the Claude API key test succeeds. In v1.0.0 the footer mount node was printed at `wp_footer` priority 35, after WordPress normally outputs footer scripts at priority 20. The old JavaScript ran first, found no `#nits-ai-root` container, and returned without creating the launcher. Now the root prints at priority 5, and JavaScript waits for DOM readiness as a second safeguard. The launcher CSS has more reliable visibility against theme-level styles. The mount is also moved to the document body when needed to avoid Elementor/footer clipping and stacking contexts.

**Upgrade steps:** In WordPress go to Plugins → Add Plugin → Upload Plugin, upload the latest NITS plugin ZIP and confirm **Replace current with uploaded** if WordPress prompts. This is an in-place update; the database-stored API key, settings, and leads remain intact. In NITS AI → Settings, confirm Enable NITS assistant and Floating assistant on the whole website, and click Save. Purge your page cache, WordPress optimization cache and CDN cache (if any). Test in a fresh private window.

If still missing, inspect the homepage source for `id="nits-ai-root"`, `nits-widget.js?ver=1.0.1`, and `nits-widget.css?ver=1.0.1`. If the root or files are absent, check the display setting and whether the theme calls `wp_footer()`. If they exist, check the browser console for JavaScript errors, blocked requests or aggressive delay-JS options. `[nits_ai]` can be used inside an Elementor Shortcode widget on a selected page to debug the appearance, when the plugin is enabled.

## Installation

1. Back up your WordPress site and test on staging first.
2. Go to **WordPress → Plugins → Add New Plugin → Upload Plugin**.
3. Upload `infonits-nits-ai-v1.1.0.zip`, select **Install Now**, then **Activate Plugin**.
4. Open **NITS AI → Settings** (in the WordPress admin sidebar).
5. Paste your **Anthropic Console API key** in the password field, select Claude Haiku 4.5 or Sonnet 5, and **Save NITS settings**.
6. Click **Test Claude connection** to verify your key/model and outbound HTTPS connectivity.
7. Set the notification email and WhatsApp number (country code + digits only, e.g. `94770000000`), edit business knowledge and save.
8. Choose **Floating assistant on the whole website** or **Shortcode only** (`[nits_ai]` on desired pages).
9. Open the website in an incognito window, ask a question, submit a **test enquiry**, and verify **NITS AI → Leads** plus notification email.

**Do not send your API key to anyone in chat or paste it into HTML.** API key remains in a non-autoloaded WordPress option (`nits_ai_api_key`), accessible to administrators and server/database operators. For stronger control, define it outside the database in `wp-config.php`:

```php
define( 'NITS_ANTHROPIC_API_KEY', 'YOUR_CLAUDE_API_KEY' );
```

When the constant is defined it takes precedence. The settings UI will not overwrite it. Keep backups of your WordPress database and `wp-config.php` secure.

## Shortcode and placement

- Default: floating assistant appears across the site (except admin pages).
- Alternative: change Placement to **Only where shortcode is used**, then place `[nits_ai]` in an Elementor shortcode widget or WP block.
- The shortcode controls *where* it appears, not its positioning: it still displays as a floating button on that page.
- When shortcode exists on a page in global display mode, it takes precedence to avoid duplicate widgets.

## Knowledge management

The assistant uses the **Approved knowledge / FAQs** textarea in Settings and extracts relevant text from published WordPress pages/posts. For Elementor pages, it can inspect published `_elementor_data` widget text. Dynamic widgets, third-party embedded apps, media-only content and private external data are not included. If a detail is business-critical (prices, contact policy, turnaround, support terms) put an approved factual statement in the settings text. Update knowledge whenever business offerings change.

## Privacy and security notes

- Anonymous conversations are **not saved to your WordPress database**. They are submitted to Anthropic Claude for generating replies. In-browser conversation state lasts until page refresh/close and is not saved in local storage.
- Lead records are saved to the WordPress database **only after required consent**. Previous messages accompany a lead **only if the visitor explicitly selects** the transcript checkbox.
- WordPress privacy exporters/erasers are integrated for email-based personal-data requests. Site admins can view, export, update or delete submitted leads. Retention is configurable (180 days by default) and runs on WordPress WP-Cron, which depends on site traffic unless a system cron is configured.
- Public endpoints have per-IP approximate abuse limits (30 chat requests/hour; 8 lead submissions/hour) and a site-wide daily call cap. These are basic safeguards; add a WAF / Cloudflare or CAPTCHA when operating at scale.
- Responses use `textContent` (not HTML), and public visitor text is escaped / sanitized. The plugin does not expose the Anthropic key in browser scripts.
- In Settings set a real privacy policy link under **WordPress → Settings → Privacy** and disclose usage of Anthropic for AI chats, lead data handling, notification email and retention. Set an appropriate legal basis, retention rules and any international data transfer disclosures under your applicable law.
- This MVP has *not* undergone a production security audit or live hosting compatibility test. Validate email deliverability, caching/minification, REST endpoint restrictions and consent wording on staging before rollout.

## Troubleshooting

| Symptom | Check |
|---|---|
| AI says not connected | Save the key and press **Test Claude connection**; verify model access and Claude billing. |
| 401 / 403 during test | Key may be invalid, inactive, restricted, or not permitted to use the selected model. |
| 429 / daily quota | Claude rate limits, IP abuse limits or your configured daily request cap. |
| Website chat fails | Check browser network response from `/wp-json/nits/v1/chat`; some security plugins/WAFs block REST POST. |
| Leads work but email doesn't | `wp_mail()` depends on host mail transport; set up a trusted SMTP plugin/service. Leads stay saved even if email sending fails. |
| Widget not visible | Check Enabled setting, Placement setting, site frontend cache, CSS/JS optimization and that `wp_footer()` exists in your theme. |
| Elementor answers are incomplete | Add confirmed facts to Approved knowledge/FAQs manually; not every builder widget stores readable text. |

## Routes and storage

- Public: `POST /wp-json/nits/v1/chat` and `POST /wp-json/nits/v1/lead` (HTTPS expected)
- Staff: WordPress Admin `NITS AI → Overview / Leads / Settings`
- Lead table: `{$wpdb->prefix}nits_ai_leads`
- Settings option: `nits_ai_settings`; optional API key option: `nits_ai_api_key`; optional dashboard secret option: `nits_ai_dashboard_secret`
- No external JavaScript dependencies. No WooCommerce or Elementor plugin dependency.

## Uninstalling

Deleting the plugin through WordPress **permanently deletes its saved API key, settings and all lead records**. Deactivating the plugin leaves those records intact. Export your CSV first if you need a permitted backup.

## Scope / limitations

- Claude replies are not token-streamed in v1; animated typing indicator is shown until the PHP server receives the API response.
- Does not send WhatsApp messages automatically. If a number is configured, an explicit *Continue via WhatsApp* link is shown after a successful enquiry.
- No `.riv` asset or Rive editor rig is needed; SVG and CSS provide the included mascot animation. Rive can be added in a future version.
- Does not issue official quotations, create bookings, promise deadlines or modify site content.
- Claude API requests can incur charges. Public chat replies may be inaccurate; the team should review important information.

## Source and compatibility

PHP 7.4+, WordPress 6.0+. Tested with PHP syntax checks and JavaScript syntax checks for this package; **not deployed to the production website** and **no actual Claude API key was tested here**.

© Infonits. Plugin source: GPL-2.0-or-later.
