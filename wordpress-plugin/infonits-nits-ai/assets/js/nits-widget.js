/* NITS AI front-end. No API keys or secrets are ever included in this file. */
(function () {
  'use strict';
  // Execute after the document is parsed, regardless of where WordPress or an
  // optimization plugin moves the frontend script relative to the footer mount.
  function mountNits() {
  const cfg = window.NITS_CONFIG;
  const root = document.getElementById('nits-ai-root');
  if (!cfg || !root || root.dataset.nitsReady) return;
  // Escape Elementor/footer stacking contexts that can clip fixed overlays.
  // The shortcode still controls on which pages NITS exists.
  if (document.body && root.parentElement !== document.body) {
    document.body.appendChild(root);
  }
  root.dataset.nitsReady = 'true';
  root.className = 'nits-shell';
  root.style.setProperty('--nits-primary', cfg.color || '#1266F1');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const img = state => cfg.assets + 'nits-' + state + '.svg';
  const privacy = cfg.privacyUrl ? `<a href="${esc(cfg.privacyUrl)}" target="_blank" rel="noopener noreferrer">Privacy policy</a>` : 'Privacy policy';
  root.innerHTML = `
    <button type="button" class="nits-launch" aria-label="Open NITS AI assistant" aria-expanded="false" aria-controls="nits-panel">
      <span class="nits-launch-face"><img src="${esc(img('idle'))}" alt="" /></span><span class="nits-launch-status"></span>
      <span class="nits-launch-bubble">Ask NITS <span aria-hidden="true">✦</span></span>
    </button>
    <section class="nits-panel" id="nits-panel" role="dialog" aria-modal="false" aria-label="Chat with ${esc(cfg.name)}" hidden>
      <header class="nits-head">
        <div class="nits-head-avatar"><img class="nits-head-image" src="${esc(img('idle'))}" alt="" /></div>
        <div class="nits-head-title"><strong>${esc(cfg.name)} <span class="nits-ai-tag">AI</span></strong><small><span class="nits-online"></span>${esc(cfg.subtitle)}</small></div>
        <button type="button" class="nits-head-min" aria-label="Minimize assistant" title="Minimize">&minus;</button>
        <button type="button" class="nits-head-close" aria-label="Close assistant" title="Close">&times;</button>
      </header>
      <div class="nits-chat-screen">
        <div class="nits-conversation" role="log" aria-live="polite" aria-relevant="additions text">
          <div class="nits-date-label">Your digital project assistant</div>
          <div class="nits-line nits-line-bot"><div class="nits-small-avatar"><img src="${esc(img('idle'))}" alt="" /></div><div class="nits-msg">${esc(cfg.welcome)}</div></div>
          <div class="nits-topics" aria-label="Suggested topics">
            <span>HOW CAN I HELP?</span>
            <div class="nits-topic-grid">
              <button type="button" data-prompt="I want to build a professional website. Can you guide me?">🌐 Build a website</button>
              <button type="button" data-prompt="I want a custom software or SaaS application. What can Infonits do?">🚀 Custom software</button>
              <button type="button" data-prompt="I need branding and graphic design services. Tell me about the process.">🎨 Branding & design</button>
              <button type="button" data-prompt="I want to build a mobile app. Can you guide me?">📱 Mobile application</button>
            </div>
          </div>
        </div>
        <div class="nits-composer-bar">
          <div class="nits-actions"><button type="button" class="nits-quote-open">✦ Get a project quote</button><span>AI responses may contain mistakes</span></div>
          <form class="nits-composer"><label class="nits-sr" for="nits-msg-input">Your message</label><textarea id="nits-msg-input" rows="1" maxlength="1200" placeholder="Ask me anything..." aria-label="Your message"></textarea><button type="submit" aria-label="Send message" class="nits-send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 14-7-4 14-3-6-7-1Zm7 1 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button></form>
          <div class="nits-foot">Made with <span>♥</span> by <strong>infonits</strong></div>
        </div>
      </div>
      <div class="nits-lead-screen" hidden>
        <div class="nits-lead-intro"><button type="button" class="nits-back" aria-label="Back to chat">← Back to chat</button><div class="nits-lead-icon">✦</div><h3>Let's build something great.</h3><p>Tell us about your idea. Your details will be shared with the Infonits team.</p></div>
        <form class="nits-lead-form">
          <div class="nits-form-row"><label>Full name <em>*</em><input name="name" type="text" maxlength="190" autocomplete="name" required placeholder="Your name" /></label><label>Email <em>*</em><input name="email" type="email" maxlength="190" autocomplete="email" required placeholder="you@example.com" /></label></div>
          <div class="nits-form-row"><label>WhatsApp / phone<input name="phone" type="tel" maxlength="80" autocomplete="tel" placeholder="+94..." /></label><label>Project type<select name="service"><option>Website development</option><option>Custom software / SaaS</option><option>Mobile application</option><option>Branding & design</option><option>UI/UX design</option><option>Other</option></select></label></div>
          <div class="nits-form-row"><label>Budget range<select name="budget"><option value="">Not decided yet</option><option>Under $500</option><option>$500 – $2,000</option><option>$2,000 – $5,000</option><option>$5,000 – $10,000</option><option>Above $10,000</option></select></label><label>Preferred timeline<select name="timeline"><option value="">Flexible</option><option>ASAP</option><option>Within 1 month</option><option>1–3 months</option><option>3+ months</option></select></label></div>
          <label>Tell us about your project <em>*</em><textarea name="details" rows="3" minlength="10" maxlength="3000" required placeholder="What would you like to create?"></textarea></label>
          <div class="nits-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
          <label class="nits-check"><input name="include_chat" type="checkbox" /><span>Include my recent chat messages with this enquiry</span></label>
          <label class="nits-check"><input name="consent" type="checkbox" required /><span>I consent to Infonits using these details to respond to my project enquiry. ${privacy}. <em>*</em></span></label>
          <p class="nits-form-notice" role="status" aria-live="polite"></p>
          <button class="nits-submit" type="submit">Send project enquiry <span>↗</span></button>
          <div class="nits-lead-bottom">Your information goes directly to Infonits.</div>
        </form>
        <div class="nits-lead-success" hidden><div class="nits-success-icon">✓</div><h3>Enquiry received!</h3><p class="nits-success-text">Thank you! Your enquiry has been saved. Our team can follow up using your details.</p><a class="nits-whatsapp" hidden target="_blank" rel="noopener noreferrer">Continue via WhatsApp ↗</a><button type="button" class="nits-return-chat">Return to chat</button></div>
      </div>
    </section>`;

  const $ = sel => root.querySelector(sel);
  const launch = $('.nits-launch'), panel = $('.nits-panel'), conversation = $('.nits-conversation');
  const chatScreen = $('.nits-chat-screen'), leadScreen = $('.nits-lead-screen');
  const composer = $('.nits-composer'), msgBox = $('#nits-msg-input'), sendBtn = $('.nits-send');
  let open = false, busy = false, leadBusy = false;
  const history = [];

  function mascot(state) {
    const name = ['idle', 'greeting', 'thinking', 'listening', 'success', 'fallback'].includes(state) ? state : 'idle';
    $('.nits-head-image').src = img(name);
    $('.nits-launch-face img').src = img(name);
    root.dataset.mood = name;
  }
  function openPanel() {
    if (open) return;
    open = true;
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    root.classList.add('nits-open');
    mascot('greeting');
    window.setTimeout(() => { if (!busy) mascot('idle'); }, 1400);
    window.setTimeout(() => msgBox.focus({ preventScroll: true }), 70);
  }
  function closePanel() {
    if (!open) return;
    open = false;
    panel.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    root.classList.remove('nits-open');
    mascot('idle');
    launch.focus({ preventScroll: true });
  }
  launch.addEventListener('click', () => open ? closePanel() : openPanel());
  $('.nits-head-min').addEventListener('click', closePanel);
  $('.nits-head-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && open) closePanel(); });

  function appendMessage(role, text, kind) {
    const line = document.createElement('div');
    line.className = 'nits-line ' + (role === 'user' ? 'nits-line-user' : 'nits-line-bot');
    if (role === 'assistant') {
      const avatar = document.createElement('div'); avatar.className = 'nits-small-avatar';
      const face = document.createElement('img'); face.alt = ''; face.src = img(kind === 'error' ? 'fallback' : 'idle');
      avatar.appendChild(face); line.appendChild(avatar);
    }
    const bubble = document.createElement('div'); bubble.className = 'nits-msg' + (kind === 'error' ? ' nits-msg-error' : '');
    bubble.textContent = text; line.appendChild(bubble);
    conversation.appendChild(line);
    conversation.scrollTop = conversation.scrollHeight;
    return line;
  }
  function setBusy(flag) {
    busy = flag; msgBox.disabled = flag; sendBtn.disabled = flag;
    $('.nits-quote-open').disabled = flag;
    if (!flag) { const typing = $('.nits-typing-line'); if (typing) typing.remove(); }
  }
  function typingIndicator() {
    const line = document.createElement('div'); line.className = 'nits-line nits-line-bot nits-typing-line';
    line.innerHTML = `<div class="nits-small-avatar"><img src="${esc(img('thinking'))}" alt="" /></div><div class="nits-msg nits-typing"><i></i><i></i><i></i></div>`;
    conversation.appendChild(line); conversation.scrollTop = conversation.scrollHeight;
  }
  async function sendMessage(text) {
    text = String(text || '').trim();
    if (!text || busy || text.length > 1200) return;
    const topics = $('.nits-topics'); if (topics) topics.remove();
    const prev = history.slice(-10).map(x => ({ role: x.role, content: x.content }));
    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    msgBox.value = '';
    msgBox.style.height = '';
    setBusy(true); mascot('thinking'); typingIndicator();
    try {
      if (!cfg.hasKey) throw new Error('AI chat is not connected yet. You can still use “Get a project quote” to contact our team.');
      const res = await fetch(cfg.rest + 'chat', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: prev, website: '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'NITS is temporarily unavailable. Please use the enquiry form.');
      const reply = String(data.reply || '');
      if (!reply) throw new Error('No response received. Please try again.');
      setBusy(false); appendMessage('assistant', reply); history.push({ role: 'assistant', content: reply });
      if (history.length > 24) history.splice(0, history.length - 24);
      mascot('success');
      window.setTimeout(() => mascot('idle'), 1000);
    } catch (e) {
      setBusy(false); mascot('fallback');
      appendMessage('assistant', (e && e.message) || 'Unable to connect. Please send an enquiry instead.', 'error');
    } finally {
      setBusy(false); msgBox.focus({ preventScroll: true });
    }
  }
  composer.addEventListener('submit', e => { e.preventDefault(); sendMessage(msgBox.value); });
  msgBox.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) composer.requestSubmit(); } });
  msgBox.addEventListener('input', () => { msgBox.style.height = 'auto'; msgBox.style.height = Math.min(msgBox.scrollHeight, 102) + 'px'; });
  root.querySelectorAll('[data-prompt]').forEach(b => b.addEventListener('click', () => sendMessage(b.dataset.prompt)));

  function showLead() {
    if (busy) return;
    chatScreen.hidden = true; leadScreen.hidden = false;
    $('.nits-lead-form').hidden = false; $('.nits-lead-success').hidden = true;
    $('.nits-lead-form [name="name"]').focus({ preventScroll: true });
    mascot('listening');
    // Pre-fill project summary with visitor's own messages, never AI-generated claims.
    const messages = history.filter(x => x.role === 'user').slice(-4).map(x => x.content);
    const details = $('.nits-lead-form [name="details"]');
    if (!details.value && messages.length) details.value = messages.join('\n').slice(0, 3000);
    const context = messages.join(' ').toLowerCase();
    const sel = $('.nits-lead-form [name="service"]');
    if (/mobile|android|ios|app\b/.test(context)) sel.value = 'Mobile application';
    else if (/brand|logo|design|identity/.test(context)) sel.value = 'Branding & design';
    else if (/software|saas|system|platform|dashboard/.test(context)) sel.value = 'Custom software / SaaS';
    else if (/website|wordpress|web\b/.test(context)) sel.value = 'Website development';
  }
  function showChat() {
    leadScreen.hidden = true; chatScreen.hidden = false;
    msgBox.focus({ preventScroll: true }); mascot('idle');
  }
  $('.nits-quote-open').addEventListener('click', showLead);
  $('.nits-back').addEventListener('click', showChat);
  $('.nits-return-chat').addEventListener('click', showChat);
  $('.nits-lead-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (leadBusy) return;
    const form = ev.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form), notice = $('.nits-form-notice');
    const data = {
      name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'),
      service: fd.get('service'), budget: fd.get('budget'), timeline: fd.get('timeline'),
      details: fd.get('details'), consent: !!fd.get('consent'),
      website: fd.get('website'), page_url: location.href,
      conversation: fd.get('include_chat') ? history.slice(-12) : []
    };
    notice.textContent = ''; leadBusy = true;
    const submit = $('.nits-submit'); submit.disabled = true; submit.textContent = 'Sending enquiry…';
    try {
      const res = await fetch(cfg.rest + 'lead', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.success) throw new Error(out.message || 'Could not submit enquiry. Please try again.');
      form.reset(); form.hidden = true;
      $('.nits-lead-success').hidden = false;
      $('.nits-success-text').textContent = out.message;
      if (cfg.whatsapp && /^[0-9]{7,16}$/.test(cfg.whatsapp)) {
        const wa = $('.nits-whatsapp');
        wa.href = 'https://wa.me/' + cfg.whatsapp + '?text=' + encodeURIComponent('Hi Infonits, I submitted a NITS project enquiry (#' + out.id + '). I would like to discuss it.');
        wa.hidden = false;
      }
      mascot('success');
    } catch (err) {
      notice.textContent = (err && err.message) || 'We could not save your enquiry. Please try again.';
    } finally {
      leadBusy = false; submit.disabled = false; submit.innerHTML = 'Send project enquiry <span>↗</span>';
    }
  });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNits, { once: true });
  } else {
    mountNits();
  }
})();
