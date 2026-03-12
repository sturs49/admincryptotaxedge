// admin_worker_v2.js  — deploy to bitter-mud-8e4a (admin.cryptotaxedge.com)

const SUPABASE_URL_SERVER = 'https://dnhsufwdyhkwrsdtfgyx.supabase.co';

// ── Tier → permission defaults (propagated on every tier change) ─────────────
const TIER_PERMISSIONS = {
  anonymous: { tx_limit: 3,        batch_analyzer: false, api_access: false, export_csv: false },
  free:      { tx_limit: 10,       batch_analyzer: false, api_access: false, export_csv: true  },
  starter:   { tx_limit: 250,      batch_analyzer: true,  api_access: false, export_csv: true  },
  pro:       { tx_limit: 2500,     batch_analyzer: true,  api_access: true,  export_csv: true  },
  cpa:       { tx_limit: 999999,   batch_analyzer: true,  api_access: true,  export_csv: true  },
  admin:     { tx_limit: 999999,   batch_analyzer: true,  api_access: true,  export_csv: true  },
};

// ── Tier display names (internal values stay unchanged) ──────────────────────
const TIER_DISPLAY = { anonymous:'Guest', free:'Free', starter:'Starter', pro:'Pro', cpa:'Firm', admin:'Admin' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

// ── Proxy helpers ──────────────────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

function html(content) {
  return new Response(content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export default {
  async fetch(request, env) {
   try {
    const url = new URL(request.url);
    const srk = env.SERVICE_ROLE_KEY;

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // ── /proxy/list-users ──────────────────────────────────────────────────────
    if (url.pathname === '/proxy/list-users') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const r = await fetch(`${SUPABASE_URL_SERVER}/auth/v1/admin/users?per_page=1000`, {
        headers: { apikey: srk, Authorization: `Bearer ${srk}` }
      });
      const d = await r.json();
      return json(d, r.status);
    }

    // ── /proxy/create-user ────────────────────────────────────────────────────
    if (url.pathname === '/proxy/create-user' && request.method === 'POST') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const body = await request.json();
      // Auto-inject tier permissions on create
      const tier = body.user_metadata?.tier || 'free';
      const perms = TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.free;
      body.user_metadata = { ...body.user_metadata, ...perms };
      const r = await fetch(`${SUPABASE_URL_SERVER}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: srk, Authorization: `Bearer ${srk}` },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      return json(d, r.status);
    }

    // ── /proxy/invite-user ────────────────────────────────────────────────────
    if (url.pathname === '/proxy/invite-user' && request.method === 'POST') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const body = await request.json();
      // Auto-inject tier permissions on invite
      const tier = body.data?.tier || 'free';
      const perms = TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.free;
      body.data = { ...body.data, ...perms };
      const r = await fetch(`${SUPABASE_URL_SERVER}/auth/v1/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: srk, Authorization: `Bearer ${srk}` },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      return json(d, r.status);
    }

    // ── /proxy/update-user/:id ────────────────────────────────────────────────
    // Now propagates full tier permissions whenever tier changes
    if (url.pathname.startsWith('/proxy/update-user/') && request.method === 'POST') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const userId = url.pathname.replace('/proxy/update-user/', '');
      const body = await request.json();
      // If tier is being changed, inject the corresponding permissions
      if (body.user_metadata?.tier) {
        const tier = body.user_metadata.tier;
        const perms = TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.free;
        body.user_metadata = { ...body.user_metadata, ...perms };
      }
      const r = await fetch(`${SUPABASE_URL_SERVER}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', apikey: srk, Authorization: `Bearer ${srk}` },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      // Dual-write: sync tier to profiles table so the app portal sees the change
      if (r.ok && body.user_metadata?.tier) {
        await fetch(`${SUPABASE_URL_SERVER}/rest/v1/profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: srk, Authorization: `Bearer ${srk}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ tier: body.user_metadata.tier })
        }).catch(e => console.warn('profiles sync failed:', e.message));
      }
      return json(d, r.status);
    }

    // ── /proxy/delete-user/:id ────────────────────────────────────────────────
    if (url.pathname.startsWith('/proxy/delete-user/') && request.method === 'DELETE') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const userId = url.pathname.replace('/proxy/delete-user/', '');
      const r = await fetch(`${SUPABASE_URL_SERVER}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { apikey: srk, Authorization: `Bearer ${srk}` }
      });
      return json({ ok: r.ok }, r.status);
    }

    // ── /proxy/feedback — list recent tx_feedback rows ────────────────────────
    if (url.pathname === '/proxy/feedback') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const limit = url.searchParams.get('limit') || '100';
      const r = await fetch(
        `${SUPABASE_URL_SERVER}/rest/v1/tx_feedback?select=*&order=created_at.desc&limit=${limit}`, {
        headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json' }
      });
      const d = await r.json();
      return json(d, r.status);
    }

    // ── /proxy/feedback-summary — aggregated thumbs data ──────────────────────
    if (url.pathname === '/proxy/feedback-summary') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const r = await fetch(
        `${SUPABASE_URL_SERVER}/rest/v1/feedback_summary?select=*`, {
        headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json' }
      });
      const d = await r.json();
      return json(d, r.status);
    }

    // ── /proxy/rules — CRUD for classification_rules ─────────────────────────
    if (url.pathname === '/proxy/rules' && request.method === 'GET') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const r = await fetch(
        `${SUPABASE_URL_SERVER}/rest/v1/classification_rules?select=*&order=created_at.desc`, {
        headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json' }
      });
      const d = await r.json();
      return json(d, r.status);
    }

    if (url.pathname === '/proxy/rules' && request.method === 'POST') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const body = await request.json();
      // Duplicate check: same original_type + corrected_type + protocol
      const dupQuery = `original_type=eq.${encodeURIComponent(body.original_type)}&corrected_type=eq.${encodeURIComponent(body.corrected_type)}&active=eq.true` + (body.protocol ? `&protocol=eq.${encodeURIComponent(body.protocol)}` : '&protocol=is.null');
      const dupCheck = await fetch(
        `${SUPABASE_URL_SERVER}/rest/v1/classification_rules?${dupQuery}&select=id`, {
        headers: { apikey: srk, Authorization: `Bearer ${srk}` }
      });
      const existing = await dupCheck.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return json({ error: 'Duplicate rule already exists: ' + body.original_type + ' -> ' + body.corrected_type + (body.protocol ? ' [' + body.protocol + ']' : '') }, 409);
      }
      const r = await fetch(
        `${SUPABASE_URL_SERVER}/rest/v1/classification_rules`, {
        method: 'POST',
        headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      return json(d, r.status);
    }

    if (url.pathname.startsWith('/proxy/rules/') && request.method === 'DELETE') {
      if (!srk) return json({ error: 'SERVICE_ROLE_KEY not set' }, 500);
      const ruleId = url.pathname.replace('/proxy/rules/', '');
      const r = await fetch(
        `${SUPABASE_URL_SERVER}/rest/v1/classification_rules?id=eq.${ruleId}`, {
        method: 'PATCH',
        headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ active: false })
      });
      return json({ ok: r.ok }, r.status);
    }

    // ── /proxy/analyze-feedback — Claude-powered pattern analysis ───────────
    if (url.pathname === '/proxy/analyze-feedback' && request.method === 'POST') {
      const anthropicKey = env.ANTHROPIC_KEY || env.ANTHROPIC_API_KEY;
      if (!anthropicKey) return json({ error: 'ANTHROPIC_KEY not set' }, 500);
      const body = await request.json();
      const patterns = body.patterns || [];
      if (!patterns.length) return json({ error: 'No patterns to analyze' }, 400);

      const patternLines = patterns.map(p => {
        const reasonings = (p.sampleReasonings || [p.sampleReasoning || '']).filter(Boolean);
        const funcs = (p.sampleFunctions || []).filter(Boolean);
        const events = (p.sampleEvents || []).filter(Boolean);
        const isVotePat = p.votePattern || p.corrected.startsWith('(review needed');
        return (isVotePat
          ? '- Type: "' + p.original + '" — ' + p.corrected + ' (Koinly: ' + (p.koinlyAction || 'unknown') + ', approval: ' + (p.approval || '?') + ')'
          : '- Original: "' + p.original + '" -> Corrected to: "' + p.corrected + '" (' + p.count + 'x)') +
          (p.protocol ? '\n  Protocol: ' + p.protocol : '') +
          '\n  Classification reasoning from our multi-source system:\n' +
          (reasonings.length ? reasonings.map((r, i) => '    ' + (i+1) + '. ' + r).join('\n') : '    (no reasoning captured)') +
          (funcs.length ? '\n  On-chain functions called: ' + funcs.join(', ') : '') +
          (events.length ? '\n  Contract events emitted: ' + events.join(', ') : '');
      }).join('\n\n');
      const prompt = 'You are a crypto tax classification expert and DeFi transaction analyst. Analyze user correction patterns from our multi-source transaction analyzer.\n\n' +
        'Each pattern shows the original classification, the user correction, frequency, PROTOCOL context (the DeFi protocol involved, if known), function calls, and event names from the blockchain.\n\n' +
        '--- US CRYPTO TAX RULES ---\n' +
        'NON-TAXABLE: native staking in/out (no receipt token) = Add to Pool / Remove from Pool; collateral deposit/withdraw (same asset); bridge same owner = Transfer; wrap/unwrap 1:1; borrow/repay principal = Loan tags.\n' +
        'TAXABLE DISPOSAL: crypto-to-crypto swap = Trade; liquid staking (ETH->stETH) = Trade; add/remove LP liquidity = Liquidity In/Out; NFT purchase = Trade.\n' +
        'INCOME: staking rewards = Reward; DeFi lending interest = Lending interest; airdrops = Airdrop; reward claims = Reward.\n\n' +
        '--- COMPOUND TRANSACTIONS ---\n' +
        'Many DeFi transactions do MULTIPLE things in one tx (e.g. stake tokens AND claim rewards, or provide LP AND receive farming rewards).\n' +
        'When you detect a compound tx pattern, set secondaryKoinly to the secondary Koinly action.\n' +
        'Example: user corrects "staketoken" to "stakingrewardclaim" = compound tx with Add to Pool (stake) + Reward (claim). Set corrected_koinly:"Add to Pool", secondaryKoinly:"Reward".\n' +
        'If NOT compound, set secondaryKoinly to null.\n\n' +
        '--- KOINLY TAGS (use exact strings) ---\n' +
        'DEPOSIT: Reward, Airdrop, Other income, Lending interest, Mining, Fork, Salary, Remove from Pool, Transfer\n' +
        'WITHDRAWAL: Add to Pool, Loan repayment, Cost, Gift, Lost, Transfer\n' +
        'LP/TRADE: Trade, Liquidity In, Liquidity Out, Swap (tax-free 1:1 wraps ONLY)\n\n' +
        'IMPORTANT: When a correction is protocol-specific (e.g. "token_mint on Across protocol -> bridge"), include the protocol. If general, set protocol to null.\n\n' +
        'PATTERNS:\n' + patternLines + '\n\n' +
        'For each pattern, evaluate:\n' +
        '1. SOURCE AGREEMENT: Do the blockchain API sources support the user correction?\n' +
        '2. TAX CORRECTNESS: Is the correction IRS-compliant? Apply conservative treatment.\n' +
        '3. COMPOUND DETECTION: Does the on-chain data (events, functions) show multiple actions in one tx?\n' +
        '4. PROTOCOL SPECIFICITY: Protocol-specific or general rule?\n' +
        '5. CONFIDENCE: HIGH=sources+tax align, MEDIUM=tax-correct but mixed sources, LOW=sources disagree or tax-incorrect\n\n' +
        'Respond with ONLY a JSON array:\n' +
        '[{\n' +
        '  "original_type": "the original type",\n' +
        '  "corrected_type": "what it should be",\n' +
        '  "corrected_koinly": "primary Koinly action tag",\n' +
        '  "secondaryKoinly": "secondary Koinly action if compound tx, or null",\n' +
        '  "protocol": "protocol name if protocol-specific, or null",\n' +
        '  "confidence": "high|medium|low",\n' +
        '  "source_agreement": "agree|mixed|disagree",\n' +
        '  "reasoning": "brief explanation citing specific source data, on-chain evidence, and tax basis",\n' +
        '  "matching_hint": "on-chain pattern to match (function names, event types, protocol, etc.)",\n' +
        '  "review_notes": "any caveats, edge cases, or compound tx instructions for Koinly entry"\n' +
        '}]';

      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const d = await r.json();
        if (d.error) return json({ error: 'Claude API error: ' + (d.error?.message || JSON.stringify(d.error)), debug: d }, 500);
        if (!d.content || !d.content[0]) return json({ error: 'No content in Claude response', debug: { type: d.type, stop_reason: d.stop_reason, model: d.model } }, 500);
        let text = d.content[0].text || '[]';
        // Strip markdown code fences if Claude wrapped the response
        text = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        // Extract JSON array from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return json({ error: 'Could not parse Claude response as JSON array', rawText: text.substring(0, 500) }, 500);
        const recommendations = JSON.parse(jsonMatch[0]);
        return json({ recommendations });
      } catch(e) {
        return json({ error: 'Claude analysis failed: ' + e.message }, 500);
      }
    }

    // ── Claude per-TX review endpoint ──────────────────────────────────────────
    if (url.pathname === '/proxy/review-txns' && request.method === 'POST') {
      if (!anthropicKey) return json({ error: 'ANTHROPIC_KEY not configured' }, 500);
      const body = await request.json();
      const txns = (body.txns || []).slice(0, 15);
      if (!txns.length) return json({ error: 'No transactions to review' }, 400);

      const txLines = txns.map((t, i) => {
        const userAction = t.vote === 'down' && t.user_comment
          ? 'User DISAGREES, suggests: ' + t.user_comment
          : t.vote === 'up' ? 'User AGREES with classification' : 'User voted ' + t.vote;
        return (i + 1) + '. TX: ' + (t.tx_hash || '?').slice(0, 12) + '... (' + (t.chain || '?') + ')\n' +
          '   Current classification: ' + (t.tx_type || '?') + '\n' +
          '   Koinly action: ' + (t.koinly_action || '?') + '\n' +
          '   Confidence: ' + (t.confidence || '?') + '%\n' +
          '   Classification reasoning: ' + (t.reasoning || 'none') + '\n' +
          '   Source: ' + (t.source || '?') + '\n' +
          (t.protocol ? '   Protocol: ' + t.protocol + '\n' : '') +
          (t.function_name ? '   Function called: ' + t.function_name + '\n' : '') +
          (t.event_names && t.event_names.length ? '   Events: ' + t.event_names.join(', ') + '\n' : '') +
          '   User feedback: ' + userAction;
      }).join('\n\n');

      const prompt = 'You are an independent crypto tax transaction reviewer. Review each transaction below and give your own verdict.\n\n' +
        '--- US CRYPTO TAX RULES ---\n' +
        'NON-TAXABLE: native staking in/out (no receipt token) = Add to Pool / Remove from Pool; collateral deposit/withdraw; bridge same owner = Transfer; wrap/unwrap 1:1; borrow/repay = Loan tags.\n' +
        'TAXABLE DISPOSAL: crypto-to-crypto swap = Trade; liquid staking (ETH->stETH with receipt token) = Trade (conservative); add/remove LP = Liquidity In/Out; NFT purchase = Trade.\n' +
        'INCOME: staking rewards = Reward; DeFi lending interest = Lending interest; airdrops (received free tokens from protocol) = Airdrop; reward claims = Reward.\n' +
        'TRANSFERS: Exchange withdrawals/deposits = Transfer (non-taxable move between own wallets). Receiving tokens from Coinbase/Binance/Kraken = Transfer, NOT airdrop.\n\n' +
        '--- KOINLY TAGS (use exact strings) ---\n' +
        'DEPOSIT: Reward, Airdrop, Other income, Lending interest, Mining, Fork, Salary, Remove from Pool, Transfer\n' +
        'WITHDRAWAL: Add to Pool, Loan repayment, Cost, Gift, Lost, Transfer\n' +
        'LP/TRADE: Trade, Liquidity In, Liquidity Out, Swap (tax-free 1:1 wraps ONLY)\n\n' +
        'CRITICAL: Exchange withdrawals (from Coinbase, Binance, Kraken, etc.) are TRANSFERS, not airdrops. A transfer of ARB/OP/SOL from an exchange is just a withdrawal.\n\n' +
        'TRANSACTIONS TO REVIEW:\n' + txLines + '\n\n' +
        'For each transaction, provide your independent verdict. Respond with ONLY a JSON array:\n' +
        '[{\n' +
        '  "tx_hash": "first 12 chars of hash",\n' +
        '  "verdict": "agree_classification or agree_user or new_suggestion",\n' +
        '  "corrected_type": "what the type SHOULD be (your verdict)",\n' +
        '  "corrected_koinly": "correct Koinly tag",\n' +
        '  "reasoning": "brief explanation with tax basis",\n' +
        '  "confidence": "high|medium|low",\n' +
        '  "review_notes": "any caveats or edge cases"\n' +
        '}]';

      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const d = await r.json();
        if (d.error) return json({ error: 'Claude API error: ' + (d.error?.message || JSON.stringify(d.error)) }, 500);
        if (!d.content || !d.content[0]) return json({ error: 'No content in Claude response' }, 500);
        let text = d.content[0].text || '[]';
        text = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return json({ error: 'Could not parse Claude response', rawText: text.substring(0, 500) }, 500);
        const verdicts = JSON.parse(jsonMatch[0]);
        return json({ verdicts });
      } catch(e) {
        return json({ error: 'Claude review failed: ' + e.message }, 500);
      }
    }

    // ── Serve dashboard HTML ──────────────────────────────────────────────────
    return html(DASHBOARD_HTML);
   } catch(e) {
    return new Response('Admin worker error: ' + e.message + '\n\nStack: ' + e.stack, {
      status: 500, headers: { 'Content-Type': 'text/plain' }
    });
   }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD HTML — all Supabase calls go through /proxy/* routes
// ─────────────────────────────────────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin · Crypto Tax Edge</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230d1117'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='sans-serif' font-weight='800' font-size='18' fill='%2300d4b8'%3ECT%3C/text%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#0e1340; --bg2:#111847; --bg3:#162055;
    --border:rgba(0,212,184,0.15); --teal:#00c9b1; --blue:#3b82f6;
    --red:#f87171; --yellow:#fbbf24; --green:#4ade80;
    --text:#e2e8f0; --muted:#64748b; --muted2:#1e293b;
    --body:'DM Sans',sans-serif; --sans:'Plus Jakarta Sans',sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:var(--body);font-size:13px;min-height:100vh;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,184,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,184,0.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}

  /* Login */
  #login-screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:100;background:var(--bg)}
  #login-screen::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 50%,rgba(0,212,184,0.06) 0%,transparent 70%)}
  .login-box{position:relative;width:380px;background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:40px;box-shadow:0 32px 80px rgba(0,0,0,0.8);animation:fadeUp 0.4s ease}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  .login-brand{font-family:var(--sans);font-size:20px;font-weight:700;color:#fff;margin-bottom:4px}
  .login-brand span{color:var(--teal)}
  .login-sub{font-size:10px;color:var(--muted);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:28px}
  .login-title{font-family:var(--sans);font-size:15px;font-weight:700;color:var(--muted);margin-bottom:20px}
  .login-field{margin-bottom:14px}
  .login-field label{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px}
  .login-field input{width:100%;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(0,212,184,0.2);border-radius:8px;color:var(--text);font-family:var(--body);font-size:13px;outline:none;transition:border-color 0.2s}
  .login-field input:focus{border-color:var(--teal)}
  .login-btn{width:100%;margin-top:6px;padding:12px;background:var(--teal);border:none;border-radius:8px;color:#0e1340;font-family:var(--sans);font-size:14px;font-weight:700;cursor:pointer;transition:opacity 0.2s}
  .login-btn:hover{opacity:0.9}
  .login-btn:disabled{opacity:0.5;cursor:wait}
  .login-err{color:var(--red);font-size:11px;margin-top:10px;text-align:center;min-height:16px}

  /* Layout */
  #app{display:none;position:relative;z-index:1;min-height:100vh}
  .sidebar{position:fixed;top:0;left:0;bottom:0;width:220px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:50}
  .sidebar-logo{padding:20px 18px 16px;border-bottom:1px solid rgba(255,255,255,0.04)}
  .sidebar-brand{font-family:var(--sans);font-size:13px;font-weight:700;color:#fff}
  .sidebar-brand span{color:var(--teal)}
  .sidebar-role{margin:12px 18px;padding:6px 10px;background:rgba(0,212,184,0.08);border:1px solid rgba(0,212,184,0.2);border-radius:6px;font-size:10px;color:var(--teal);display:flex;align-items:center;gap:6px}
  .sidebar-role::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--teal);box-shadow:0 0 6px var(--teal);flex-shrink:0}
  nav{flex:1;padding:8px 10px;overflow-y:auto}
  .nav-section{font-size:9px;color:var(--muted2);text-transform:uppercase;letter-spacing:0.12em;padding:14px 8px 6px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:7px;cursor:pointer;font-size:12px;color:var(--muted);transition:background 0.15s,color 0.15s;margin-bottom:1px;border:none;background:none;width:100%;text-align:left;font-family:var(--body)}
  .nav-item:hover{background:rgba(255,255,255,0.04);color:var(--text)}
  .nav-item.active{background:rgba(0,212,184,0.1);color:var(--teal);border:1px solid rgba(0,212,184,0.15)}
  .nav-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0}
  .sidebar-footer{padding:14px 18px;border-top:1px solid rgba(255,255,255,0.04);font-size:10px;color:var(--muted2)}

  .main{margin-left:220px;padding:28px 32px;min-height:100vh}
  .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
  .page-title{font-family:var(--sans);font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em}
  .page-title span{color:var(--teal)}
  .topbar-right{display:flex;align-items:center;gap:12px}
  .admin-badge{padding:5px 12px;background:linear-gradient(135deg,rgba(0,212,184,0.15),rgba(59,130,246,0.15));border:1px solid rgba(0,212,184,0.3);border-radius:20px;font-size:11px;color:var(--teal);font-weight:700}

  /* Stat cards */
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
  .stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;transition:border-color 0.2s,transform 0.2s}
  .stat-card:hover{border-color:rgba(0,212,184,0.35);transform:translateY(-2px)}
  .stat-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
  .stat-value{font-family:var(--sans);font-size:28px;font-weight:700;color:#fff;line-height:1;letter-spacing:-0.03em}
  .stat-value.teal{color:var(--teal)} .stat-value.blue{color:var(--blue)} .stat-value.green{color:var(--green)} .stat-value.yellow{color:var(--yellow)}
  .stat-delta{font-size:10px;margin-top:6px;color:var(--muted)}

  /* Panels */
  .panel-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
  .panel{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  .panel.full{grid-column:1 / -1}
  .panel-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.01)}
  .panel-title{font-family:var(--sans);font-size:13px;font-weight:600;color:#fff;letter-spacing:-0.01em}
  .panel-body{padding:18px}

  /* User table */
  .user-table{width:100%;border-collapse:collapse}
  .user-table th{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;padding:8px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.05)}
  .user-table td{padding:10px 12px;font-size:12px;color:var(--text);border-bottom:1px solid rgba(255,255,255,0.03);vertical-align:middle}
  .user-table tr:last-child td{border-bottom:none}
  .user-table tr:hover td{background:rgba(255,255,255,0.02)}
  .tier-badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid}
  .tier-free{color:#64748b;border-color:#334155;background:rgba(100,116,139,0.1)}
  .tier-starter{color:#60a5fa;border-color:rgba(96,165,250,0.3);background:rgba(96,165,250,0.08)}
  .tier-pro{color:#a78bfa;border-color:rgba(167,139,250,0.3);background:rgba(167,139,250,0.08)}
  .tier-cpa{color:var(--teal);border-color:rgba(0,212,184,0.3);background:rgba(0,212,184,0.08)}
  .tier-admin{color:var(--yellow);border-color:rgba(251,191,36,0.3);background:rgba(251,191,36,0.1)}
  .tier-anonymous{color:#475569;border-color:#334155;background:rgba(71,85,105,0.1)}
  .action-btn{padding:4px 10px;border-radius:5px;font-size:10px;cursor:pointer;font-family:var(--body);border:1px solid;transition:opacity 0.15s;background:none}
  .action-btn:hover{opacity:0.7}
  .action-btn:disabled{opacity:0.3;cursor:not-allowed}
  .btn-edit{color:var(--blue);border-color:rgba(59,130,246,0.3)}
  .btn-upgrade{color:var(--teal);border-color:rgba(0,212,184,0.3)}
  .btn-danger{color:var(--red);border-color:rgba(248,113,113,0.3)}

  /* Access rows */
  .access-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
  .access-row:last-child{border-bottom:none}
  .access-label{font-size:12px;color:var(--muted)}
  .access-val{font-size:12px;color:#fff;font-weight:700}
  .access-val.teal{color:var(--teal)} .access-val.green{color:var(--green)}

  /* Feed */
  .feed-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:11px}
  .feed-item:last-child{border-bottom:none}
  .feed-dot{width:7px;height:7px;border-radius:50%;margin-top:3px;flex-shrink:0}
  .feed-text{color:var(--text);line-height:1.4;flex:1}
  .feed-text span{color:var(--teal)}
  .feed-time{color:var(--muted);font-size:10px;white-space:nowrap}

  /* Quick btns */
  .quick-btn{display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;cursor:pointer;font-family:var(--body);font-size:11px;color:var(--text);transition:background 0.15s,border-color 0.15s;width:100%;margin-bottom:8px;text-align:left}
  .quick-btn:hover{background:rgba(0,212,184,0.06);border-color:rgba(0,212,184,0.2);color:var(--teal)}

  /* Toast */
  .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;background:var(--bg3);border:1px solid rgba(0,212,184,0.3);border-radius:8px;color:var(--teal);font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:999;transform:translateY(80px);opacity:0;transition:transform 0.3s ease,opacity 0.3s ease;max-width:320px}
  .toast.show{transform:translateY(0);opacity:1}
  .toast.error{color:var(--red);border-color:rgba(248,113,113,0.3)}

  /* Sections */
  .section{display:none} .section.active{display:block}

  /* Modal */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:none;align-items:center;justify-content:center}
  .modal-overlay.show{display:flex}
  .modal{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:32px;width:420px;animation:fadeUp 0.25s ease}
  .modal h3{font-family:var(--sans);font-size:16px;font-weight:700;color:#fff;margin-bottom:20px}
  .modal-field{margin-bottom:14px}
  .modal-field label{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px}
  .modal-field input,.modal-field select{width:100%;padding:10px 13px;background:rgba(255,255,255,0.04);border:1px solid rgba(0,212,184,0.2);border-radius:7px;color:var(--text);font-family:var(--body);font-size:13px;outline:none;transition:border-color 0.2s}
  .modal-field input:focus,.modal-field select:focus{border-color:var(--teal)}
  .modal-field select option{background:var(--bg3);color:var(--text)}
  .modal-actions{display:flex;gap:10px;margin-top:20px}
  .modal-btn{flex:1;padding:11px;border:none;border-radius:8px;font-family:var(--sans);font-size:13px;font-weight:700;cursor:pointer;transition:opacity 0.2s}
  .modal-btn.primary{background:var(--teal);color:#0e1340}
  .modal-btn.secondary{background:rgba(255,255,255,0.06);color:var(--muted)}
  .modal-btn:hover{opacity:0.85} .modal-btn:disabled{opacity:0.4;cursor:wait}
  .modal-err{color:var(--red);font-size:11px;margin-top:8px;min-height:16px}

  /* Loading */
  .loading-row td{text-align:center;color:var(--muted);padding:24px !important}
  .spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(0,212,184,0.2);border-top-color:var(--teal);border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-right:6px}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* Search */
  .search-bar{padding:8px 13px;background:rgba(255,255,255,0.04);border:1px solid rgba(0,212,184,0.15);border-radius:7px;color:var(--text);font-family:var(--body);font-size:12px;outline:none;transition:border-color 0.2s;width:240px}
  .search-bar:focus{border-color:var(--teal)}

  /* Revenue */
  .rev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}

  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--muted2);border-radius:3px}
  /* Accordion collapse */
  .accordion .accord-body{overflow:hidden;transition:max-height .3s ease,padding .3s ease,opacity .2s ease;max-height:10000px;opacity:1}
  .accordion.closed .accord-body{max-height:0;padding-top:0!important;padding-bottom:0!important;opacity:0}
  .accordion .accord-arrow{transition:transform .2s ease;display:inline-block;font-size:14px;color:var(--muted)}
  .accordion.closed .accord-arrow{transform:rotate(0deg)}
  .accordion:not(.closed) .accord-arrow{transform:rotate(90deg)}
</style>
</head>
<body>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-box">
    <div class="login-brand">Crypto Tax<span>Edge</span></div>
    <div class="login-sub">Admin Console</div>
    <div class="login-title">Sign in to continue</div>
    <div class="login-field">
      <label>Email</label>
      <input type="email" id="login-email" placeholder="admin@example.com" autocomplete="email">
    </div>
    <div class="login-field">
      <label>Password</label>
      <input type="password" id="login-pass" placeholder="••••••••••••">
    </div>
    <button class="login-btn" id="login-btn" onclick="doLogin()">Sign In</button>
    <div class="login-err" id="login-err"></div>
  </div>
</div>

<!-- APP -->
<div id="app">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-brand">Crypto Tax<span>Edge</span></div>
    </div>
    <div class="sidebar-role">ADMIN CONSOLE</div>
    <nav>
      <div class="nav-section">Main</div>
      <button class="nav-item active" onclick="showSection('overview',this)"><span class="nav-icon">◈</span><span>Overview</span></button>
      <button class="nav-item" onclick="showSection('users',this)"><span class="nav-icon">👥</span><span>Users</span></button>
      <button class="nav-item" onclick="showSection('revenue',this)"><span class="nav-icon">💰</span><span>Revenue</span></button>
      <button class="nav-item" onclick="showSection('activity',this)"><span class="nav-icon">⚡</span><span>Activity</span></button>
      <button class="nav-item" onclick="showSection('feedback',this)"><span class="nav-icon">📊</span><span>Feedback</span></button>
      <div class="nav-section">Account</div>
      <button class="nav-item" onclick="showSection('access',this)"><span class="nav-icon">🔑</span><span>My Access</span></button>
      <button class="nav-item" onclick="showSection('settings',this)"><span class="nav-icon">⊞</span><span>Settings</span></button>
    </nav>
    <div class="sidebar-footer">v5.4 · <span id="topbar-time"></span></div>
  </aside>

  <main class="main">
    <div class="topbar">
      <div class="page-title" id="page-title">Dashboard <span>Overview</span></div>
      <div class="topbar-right">
        <span class="admin-badge">⬡ ADMIN</span>
        <span id="admin-email-badge" style="font-size:11px;color:var(--muted)"></span>
        <button onclick="doLogout()" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(248,113,113,0.3);background:none;color:var(--red);font-size:11px;cursor:pointer;font-family:var(--body)">Sign Out</button>
      </div>
    </div>

    <!-- OVERVIEW -->
    <div class="section active" id="section-overview">
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total Users</div>
          <div class="stat-value teal" id="stat-users">—</div>
          <div class="stat-delta" id="stat-users-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Paying Users</div>
          <div class="stat-value blue" id="stat-paying">—</div>
          <div class="stat-delta" id="stat-paying-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Free Users</div>
          <div class="stat-value green" id="stat-free">—</div>
          <div class="stat-delta" id="stat-free-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Est. MRR</div>
          <div class="stat-value yellow" id="stat-mrr">—</div>
          <div class="stat-delta" id="stat-mrr-d">based on tier counts</div>
        </div>
      </div>
      <div class="panel-grid">
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">Plan Distribution</div>
            <button onclick="loadOverview()" style="font-size:10px;padding:3px 9px;border-radius:5px;border:1px solid rgba(0,212,184,0.2);background:none;color:var(--teal);cursor:pointer">↺ Refresh</button>
          </div>
          <div class="panel-body" id="plan-dist" style="display:flex;flex-direction:column;gap:12px">
            <div style="color:var(--muted);font-size:11px">Loading…</div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Recent Signups</div></div>
          <div class="panel-body" id="recent-signups">
            <div style="color:var(--muted);font-size:11px">Loading…</div>
          </div>
        </div>
      </div>

      <!-- ── System Coverage Cards ──────────────────────────────────── -->
      <div class="panel-grid" style="grid-template-columns:1fr 1fr 1fr;margin-top:4px">

        <!-- Supported Chains -->
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">Supported Chains</div>
            <span style="font-size:10px;color:var(--teal);font-weight:600" id="chain-count-badge"></span>
          </div>
          <div class="panel-body" id="chains-card" style="max-height:260px;overflow-y:auto">
            <div style="color:var(--muted);font-size:11px">Loading…</div>
          </div>
        </div>

        <!-- DeFi Protocols -->
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">DeFi Protocol Library</div>
            <span style="font-size:10px;color:var(--teal);font-weight:600" id="proto-count-badge"></span>
          </div>
          <div class="panel-body" id="protocols-card" style="max-height:260px;overflow-y:auto">
            <div style="color:var(--muted);font-size:11px">Loading…</div>
          </div>
        </div>

        <!-- Bridge Contract Registry -->
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">Bridge Contract Registry</div>
            <span style="font-size:10px;color:var(--teal);font-weight:600" id="bridge-count-badge"></span>
          </div>
          <div class="panel-body" id="bridges-card" style="max-height:260px;overflow-y:auto">
            <div style="color:var(--muted);font-size:11px">Loading…</div>
          </div>
        </div>

      </div>

      <!-- ── Data Sources & Config ──────────────────────────────────── -->
      <div class="panel-grid" style="margin-top:4px">

        <!-- Data Sources -->
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">Data Sources</div>
          </div>
          <div class="panel-body" id="sources-card">
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <div><span style="color:#00d4b8;font-weight:600;font-size:12px">Noves</span><span style="font-size:10px;color:var(--muted);margin-left:6px">Translate API</span></div>
                <span style="font-size:10px;color:var(--muted)">EVM + Solana classification · 30+ chains</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <div><span style="color:#6366f1;font-weight:600;font-size:12px">Moralis</span><span style="font-size:10px;color:var(--muted);margin-left:6px">Transaction API v2.2</span></div>
                <span style="font-size:10px;color:var(--muted)">Decoded txns · function labels · event logs</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <div><span style="color:#f59e0b;font-weight:600;font-size:12px">Helius</span><span style="font-size:10px;color:var(--muted);margin-left:6px">Enhanced API</span></div>
                <span style="font-size:10px;color:var(--muted)">Solana-specific · parsed instructions</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <div><span style="color:#a78bfa;font-weight:600;font-size:12px">Claude AI</span><span style="font-size:10px;color:var(--muted);margin-left:6px">Sonnet 4</span></div>
                <span style="font-size:10px;color:var(--muted)">Pre-synthesis + post-review · adjudicates conflicts</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
                <div><span style="color:#38bdf8;font-weight:600;font-size:12px">RPC Probe</span><span style="font-size:10px;color:var(--muted);margin-left:6px">Tenderly + Public</span></div>
                <span style="font-size:10px;color:var(--muted)">18 chains parallel · archival for top 5 · chain detection</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Architecture -->
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">Classification Pipeline</div>
          </div>
          <div class="panel-body">
            <div style="font-size:10px;color:var(--muted);line-height:1.7;font-family:monospace">
              <div style="margin-bottom:8px;color:#fff;font-size:11px;font-weight:600">Transaction Flow:</div>
              <div><span style="color:var(--teal)">1.</span> RPC probe → 18 chains parallel → find chain</div>
              <div><span style="color:var(--teal)">2.</span> Noves (1 req) + Moralis + RPC data in parallel</div>
              <div><span style="color:var(--teal)">3.</span> Bridge contract lookup (20 addresses)</div>
              <div><span style="color:var(--teal)">4.</span> Claude pre-synthesis classification</div>
              <div><span style="color:var(--teal)">5.</span> 3-source synthesis + semantic consensus</div>
              <div><span style="color:var(--teal)">6.</span> KOINLY_MAP enforcement</div>
              <div><span style="color:var(--teal)">7.</span> Claude post-review (Task 2)</div>
              <div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.05);padding-top:8px">
                <div style="color:#fff;font-size:11px;font-weight:600;margin-bottom:4px">Tier Limits:</div>
                <div>Guest: 3/mo · Free: 10/mo · Starter: 250 · Pro: 2,500 · Firm: unlimited</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- USERS -->
    <div class="section" id="section-users">
      <div class="panel full">
        <div class="panel-head">
          <div class="panel-title">All Users <span id="user-count-badge" style="font-size:10px;color:var(--muted);font-weight:400;margin-left:6px"></span></div>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="search-bar" id="user-search" placeholder="Search email or tier…" oninput="filterUsers()">
            <button class="action-btn btn-upgrade" style="padding:7px 14px;font-size:11px" onclick="openAddUserModal()">+ Add User</button>
            <button class="action-btn btn-edit" style="padding:7px 12px;font-size:11px" onclick="loadUsers()">↺</button>
          </div>
        </div>
        <div style="padding:0;overflow-x:auto">
          <table class="user-table">
            <thead>
              <tr><th>Email</th><th>Plan</th><th>TX Limit</th><th>Batch</th><th>Joined</th><th>Last Sign In</th><th>Actions</th></tr>
            </thead>
            <tbody id="user-tbody">
              <tr class="loading-row"><td colspan="7"><span class="spinner"></span>Loading users…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- REVENUE -->
    <div class="section" id="section-revenue">
      <div class="rev-grid">
        <div class="stat-card">
          <div class="stat-label">Est. MRR</div>
          <div class="stat-value teal" id="rev-mrr">—</div>
          <div class="stat-delta">starter×$49 + pro×$99 + cpa×$199</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Est. ARR</div>
          <div class="stat-value blue" id="rev-arr">—</div>
          <div class="stat-delta">MRR × 12</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Paying Users</div>
          <div class="stat-value green" id="rev-paying">—</div>
          <div class="stat-delta" id="rev-paying-d"></div>
        </div>
      </div>
      <div class="panel full">
        <div class="panel-head">
          <div class="panel-title">Revenue by Plan</div>
          <button onclick="loadRevenue()" style="font-size:10px;padding:3px 9px;border-radius:5px;border:1px solid rgba(0,212,184,0.2);background:none;color:var(--teal);cursor:pointer">↺ Refresh</button>
        </div>
        <div class="panel-body" id="rev-breakdown" style="display:flex;flex-direction:column;gap:16px">
          <div style="color:var(--muted);font-size:11px">Loading…</div>
        </div>
      </div>
      <div style="margin-top:14px;padding:14px 18px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:10px;font-size:11px;color:#fbbf24;line-height:1.7">
        ⚠ <strong>Note:</strong> These are estimates based on tier counts in Supabase. For accurate billing data, connect Stripe. Revenue figures assume all paying users are on active monthly plans.
      </div>
    </div>

    <!-- ACTIVITY -->
    <div class="section" id="section-activity">
      <div class="panel full">
        <div class="panel-head">
          <div class="panel-title">Recent Signups &amp; Activity</div>
          <button onclick="loadActivity()" style="font-size:10px;padding:3px 9px;border-radius:5px;border:1px solid rgba(0,212,184,0.2);background:none;color:var(--teal);cursor:pointer">↺ Refresh</button>
        </div>
        <div class="panel-body" id="full-feed">
          <div style="color:var(--muted);font-size:11px;text-align:center;padding:20px"><span class="spinner"></span>Loading…</div>
        </div>
      </div>
    </div>

    <!-- FEEDBACK -->
    <div class="section" id="section-feedback">
      <!-- Stats Row -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total Votes</div>
          <div class="stat-value teal" id="fb-total">—</div>
          <div class="stat-delta" id="fb-total-d">all time</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">👍 Thumbs Up</div>
          <div class="stat-value green" id="fb-up">—</div>
          <div class="stat-delta" id="fb-up-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">👎 Thumbs Down</div>
          <div class="stat-value" style="color:var(--red)" id="fb-down">—</div>
          <div class="stat-delta" id="fb-down-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Approval Rate</div>
          <div class="stat-value green" id="fb-approval">—</div>
          <div class="stat-delta">overall accuracy</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Confidence</div>
          <div class="stat-value teal" id="fb-avg-conf">—</div>
          <div class="stat-delta" id="fb-avg-conf-d">per classification</div>
        </div>
      </div>

      <!-- How It Works — AI Classification Logic -->
      <div class="panel full accordion closed" onclick="this.classList.toggle('closed')">
        <div class="panel-head" style="cursor:pointer;background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(0,212,184,0.05))">
          <div class="panel-title">🧠 How It Works — AI Classification Logic</div>
          <span class="accord-arrow">▸</span>
        </div>
        <div class="accord-body" style="padding:16px 20px;font-size:11px;line-height:1.7;color:var(--muted)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div>
              <div style="color:var(--text);font-weight:700;font-size:12px;margin-bottom:8px">1. Multi-Source Classification</div>
              <p>Each transaction is analyzed by <strong style="color:#60a5fa">three independent sources</strong> in parallel:</p>
              <ul style="padding-left:16px;margin:6px 0">
                <li><span style="color:#4ade80;font-weight:600">Noves</span> — Protocol-aware tx interpreter. Returns type, description, protocol name, sent/received tokens.</li>
                <li><span style="color:#fbbf24;font-weight:600">Moralis / Helius</span> — On-chain data enrichment. Decoded function calls, event logs, address labels. Helius for Solana, Moralis for EVM.</li>
                <li><span style="color:#818cf8;font-weight:600">Claude AI</span> — Adjudicator. Reviews all source data + raw on-chain evidence + US tax rules. Detects compound txns (e.g. stake + claim reward).</li>
              </ul>
              <div style="color:var(--text);font-weight:700;font-size:12px;margin:12px 0 8px">2. Synthesis &amp; Confidence Scoring</div>
              <p>Sources are compared using <strong style="color:var(--teal)">semantic buckets</strong> — e.g. "StakeToken", "Stake", "AddToPool" all map to the same bucket.</p>
              <ul style="padding-left:16px;margin:6px 0">
                <li><strong>All 3 agree:</strong> High confidence (85-95%), green "Resolved" badge</li>
                <li><strong>2 of 3 agree:</strong> Pair average confidence, auto-resolved if combined conf &ge; 130</li>
                <li><strong>Disagreement:</strong> Capped at 62%, yellow "Review" badge, conflict detail shown</li>
              </ul>
            </div>
            <div>
              <div style="color:var(--text);font-weight:700;font-size:12px;margin-bottom:8px">3. Post-Synthesis Enhancements</div>
              <p>After synthesis, several layers refine the result:</p>
              <ul style="padding-left:16px;margin:6px 0">
                <li><strong style="color:#a855f7">Bridge Detection:</strong> 20+ known bridge protocols (Across, Stargate, Wormhole, etc.) — forced non-taxable Transfer.</li>
                <li><strong style="color:#f472b6">Known Airdrops:</strong> Account initialization txns involving known airdrop tokens (PENGU, JTO, ARB, etc.) — reclassified as taxable Airdrop income.</li>
                <li><strong style="color:#fbbf24">Compound Txns:</strong> Transactions that do multiple things (stake + claim reward) show dual Koinly actions.</li>
                <li><strong style="color:#4ade80">Feedback Boost:</strong> If a tx type has 5+ user votes with 80%+ approval, confidence gets +8 pts (max). Low approval (&lt;50%) penalizes by -10.</li>
                <li><strong style="color:#60a5fa">Knowledge Bank Rules:</strong> Admin-approved rules override classification. Protocol-specific rules take priority over general rules.</li>
              </ul>
              <div style="color:var(--text);font-weight:700;font-size:12px;margin:12px 0 8px">4. Feedback Loop</div>
              <p>Users rate results with thumbs up/down. Thumbs-down with a correction creates a <strong style="color:var(--teal)">correction pattern</strong>. Patterns accumulate protocol, function, and event data. Claude analyzes patterns and recommends knowledge bank rules. Approved rules automatically apply to future classifications.</p>
              <div style="margin-top:8px;padding:8px 12px;border-radius:6px;background:rgba(0,212,184,0.06);border:1px solid rgba(0,212,184,0.15)">
                <strong style="color:var(--teal)">The Loop:</strong> User correction → Enriched feedback (protocol + events) → Claude analysis → Admin approves rule → Rule applied to future txns → Better classifications → Fewer corrections needed
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- HERO: Correction Patterns + Claude Analysis -->
      <div class="panel full accordion" style="border:1px solid rgba(0,212,184,0.25);box-shadow:0 0 20px rgba(0,212,184,0.05)">
        <div class="panel-head" style="cursor:pointer;background:linear-gradient(135deg,rgba(0,212,184,0.08),rgba(59,130,246,0.05))" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">📋 Correction Patterns</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button onclick="event.stopPropagation();loadFeedback()" style="font-size:10px;padding:4px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--muted);cursor:pointer">↺ Refresh</button>
            <button id="analyze-btn" onclick="event.stopPropagation();analyzeWithClaude()" style="font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid rgba(0,212,184,0.3);background:rgba(0,212,184,0.1);color:var(--teal);cursor:pointer;font-weight:600;font-family:var(--body)">Analyze with Claude</button>
            <span class="accord-arrow">&#x25B8;</span>
          </div>
        </div>
        <div class="accord-body" style="padding:0">
          <div style="overflow-x:auto">
            <table class="user-table">
              <thead>
                <tr><th>Original Type</th><th>→</th><th>Corrected To</th><th>Protocol</th><th>Count</th><th>Avg Confidence</th><th>Action</th></tr>
              </thead>
              <tbody id="fb-patterns-tbody">
                <tr class="loading-row"><td colspan="6" style="color:var(--muted)">Loading…</td></tr>
              </tbody>
            </table>
          </div>
          <div id="claude-recs-patterns" style="display:none"></div>
        </div>
      </div>

      <!-- Worst Performers + Top Corrections -->
      <div class="panel full accordion" style="margin-top:20px">
        <div class="panel-head" style="cursor:pointer" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">Performance &amp; Corrections</div>
          <span class="accord-arrow">&#x25B8;</span>
        </div>
        <div class="accord-body" style="padding:0">
          <div class="panel-grid">
            <div class="panel" style="border:none;background:none">
              <div class="panel-head"><div class="panel-title" style="font-size:11px">⚠ Worst Performers</div></div>
              <div class="panel-body" id="fb-worst" style="display:flex;flex-direction:column;gap:8px">
                <div style="color:var(--muted);font-size:11px">Loading…</div>
              </div>
              <div id="claude-recs-worst" style="display:none"></div>
            </div>
            <div class="panel" style="border:none;background:none">
              <div class="panel-head"><div class="panel-title" style="font-size:11px">🔄 Top Corrections</div></div>
              <div class="panel-body" id="fb-corrections" style="display:flex;flex-direction:column;gap:8px">
                <div style="color:var(--muted);font-size:11px">Loading…</div>
              </div>
              <div id="claude-recs-corrections" style="display:none"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Rules (Knowledge Bank) -->
      <div class="panel full accordion" style="margin-top:20px">
        <div class="panel-head" style="cursor:pointer" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">📖 Active Rules (Knowledge Bank)</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span id="rules-count" style="font-size:10px;color:var(--muted)"></span>
            <span class="accord-arrow">&#x25B8;</span>
          </div>
        </div>
        <div class="accord-body" style="padding:0">
          <div style="overflow-x:auto">
            <table class="user-table">
              <thead>
                <tr><th>Original</th><th>→</th><th>Corrected</th><th>Protocol</th><th>Koinly Tag</th><th>Votes</th><th>Created</th><th>Action</th></tr>
              </thead>
              <tbody id="rules-tbody">
                <tr class="loading-row"><td colspan="8" style="color:var(--muted)">No rules yet — analyze feedback to generate recommendations.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Claude TX Review -->
      <div class="panel full accordion closed" style="margin-top:20px">
        <div class="panel-head" style="cursor:pointer;background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(0,212,184,0.05))" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">&#x1F9E0; Claude TX Review</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="batch-review-btn" onclick="event.stopPropagation();batchReviewTxns()" style="font-size:10px;padding:4px 12px;border-radius:5px;border:1px solid rgba(168,85,247,0.3);background:rgba(168,85,247,0.08);color:#a855f7;cursor:pointer;font-weight:600">Run Batch Review</button>
            <span id="review-progress" style="font-size:10px;color:var(--muted)"></span>
            <span class="accord-arrow">&#x25B8;</span>
          </div>
        </div>
        <div class="accord-body" style="padding:0">
          <div id="review-verdicts" style="padding:12px 18px">
            <div style="color:var(--muted);font-size:11px">Click "Run Batch Review" to have Claude independently review disputed transactions.</div>
          </div>
        </div>
      </div>

      <!-- Most Active Users -->
      <div class="panel full accordion closed" style="margin-top:20px">
        <div class="panel-head" style="cursor:pointer" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">👥 Most Active Users <span id="active-users-count" style="font-size:10px;color:var(--muted);font-weight:400;margin-left:6px"></span></div>
          <span class="accord-arrow">&#x25B8;</span>
        </div>
        <div class="accord-body" style="padding:0;overflow-x:auto">
          <table class="user-table">
            <thead>
              <tr><th>User</th><th>Tier</th><th>Votes</th><th>👍</th><th>👎</th><th>Alignment</th><th>KB Adds</th></tr>
            </thead>
            <tbody id="active-users-tbody">
              <tr class="loading-row"><td colspan="6" style="color:var(--muted)">No user data yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Accuracy by TX Type -->
      <div class="panel full accordion closed" style="margin-top:20px">
        <div class="panel-head" style="cursor:pointer" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">Accuracy by TX Type</div>
          <span class="accord-arrow">&#x25B8;</span>
        </div>
        <div class="accord-body panel-body" id="fb-by-type" style="flex-direction:column;gap:10px">
          <div style="color:var(--muted);font-size:11px">Loading…</div>
        </div>
      </div>

      <!-- Accuracy by Koinly Action -->
      <div class="panel full accordion closed" style="margin-top:12px">
        <div class="panel-head" style="cursor:pointer" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">Accuracy by Koinly Action</div>
          <span class="accord-arrow">&#x25B8;</span>
        </div>
        <div class="accord-body panel-body" id="fb-by-koinly" style="flex-direction:column;gap:10px">
          <div style="color:var(--muted);font-size:11px">Loading…</div>
        </div>
      </div>

      <!-- Recent Feedback -->
      <div class="panel full accordion closed" style="margin-top:12px">
        <div class="panel-head" style="cursor:pointer" onclick="this.parentElement.classList.toggle('closed')">
          <div class="panel-title">Recent Feedback <span id="fb-count-badge" style="font-size:10px;color:var(--muted);font-weight:400;margin-left:6px"></span></div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="fb-filter" onchange="filterFeedback()" onclick="event.stopPropagation()" style="padding:5px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(0,212,184,0.2);border-radius:6px;color:var(--text);font-family:var(--body);font-size:11px;outline:none">
              <option value="all">All votes</option>
              <option value="up">👍 Up only</option>
              <option value="down">👎 Down only</option>
            </select>
            <span class="accord-arrow">&#x25B8;</span>
          </div>
        </div>
        <div class="accord-body" style="padding:0;overflow-x:auto">
          <table class="user-table">
            <thead>
              <tr><th>Vote</th><th>TX Hash</th><th>Chain</th><th>Type</th><th>Koinly</th><th>Confidence</th><th>Tier</th><th>Time</th><th>Review</th></tr>
            </thead>
            <tbody id="fb-tbody">
              <tr class="loading-row"><td colspan="9"><span class="spinner"></span>Loading feedback…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MY ACCESS -->
    <div class="section" id="section-access">
      <div class="panel-grid">
        <div class="panel">
          <div class="panel-head"><div class="panel-title">My Account</div></div>
          <div class="panel-body">
            <div class="access-row"><span class="access-label">Email</span><span class="access-val teal" id="my-email">—</span></div>
            <div class="access-row"><span class="access-label">Plan</span><span class="access-val"><span class="tier-badge tier-admin">ADMIN</span></span></div>
            <div class="access-row"><span class="access-label">TX Classifications</span><span class="access-val green">Unlimited</span></div>
            <div class="access-row"><span class="access-label">Batch Analyzer</span><span class="access-val green">✓ Enabled</span></div>
            <div class="access-row"><span class="access-label">API Access</span><span class="access-val green">✓ Full</span></div>
            <div class="access-row"><span class="access-label">Billing</span><span class="access-val teal">Complimentary</span></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Quick Actions</div></div>
          <div class="panel-body">
            <button class="quick-btn" onclick="openAddUserModal()">➕ Add / invite user</button>
            <button class="quick-btn" onclick="showSection('users',document.querySelectorAll('.nav-item')[1]);loadUsers()">👥 Manage all users</button>
            <button class="quick-btn" onclick="showSection('revenue',document.querySelectorAll('.nav-item')[2]);loadRevenue()">💰 View revenue</button>
            <button class="quick-btn" onclick="window.open('https://supabase.com/dashboard/project/dnhsufwdyhkwrsdtfgyx/auth/users','_blank')">↗ Open Supabase Auth</button>
            <button class="quick-btn" onclick="window.open('https://cryptotaxedge.com','_blank')">↗ View live site</button>
            <button class="quick-btn" onclick="window.open('https://app.cryptotaxedge.com','_blank')">↗ Open app</button>
          </div>
        </div>
      </div>
    </div>

    <!-- SETTINGS -->
    <div class="section" id="section-settings">
      <div class="panel-grid">
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Supabase Connection</div></div>
          <div class="panel-body">
            <div class="access-row"><span class="access-label">Project ID</span><span class="access-val" style="font-size:11px;font-family:monospace">dnhsufwdyhkwrsdtfgyx</span></div>
            <div class="access-row"><span class="access-label">Proxy Routes</span><span class="access-val green" id="proxy-status">Checking…</span></div>
            <div class="access-row"><span class="access-label">Service Role Key</span><span class="access-val green" id="srk-status">Checking…</span></div>
            <div class="access-row"><span class="access-label">Auth URL</span><span class="access-val teal" style="font-size:10px">supabase.co/auth/v1</span></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Tier Pricing &amp; Permissions</div></div>
          <div class="panel-body">
            <div class="access-row"><span class="access-label">Anonymous</span><span class="access-val" style="font-size:10px">$0 · 3 TX · No batch</span></div>
            <div class="access-row"><span class="access-label">Free</span><span class="access-val" style="font-size:10px">$0 · 10 TX · No batch</span></div>
            <div class="access-row"><span class="access-label">Starter</span><span class="access-val" style="font-size:10px">$49/mo · 250 TX · Batch ✓</span></div>
            <div class="access-row"><span class="access-label">Pro</span><span class="access-val" style="font-size:10px">$99/mo · 2,500 TX · Batch ✓ · API ✓</span></div>
            <div class="access-row"><span class="access-label">CPA Firm</span><span class="access-val" style="font-size:10px">$199/mo · Unlimited · Batch ✓ · API ✓</span></div>
            <div class="access-row"><span class="access-label">Admin</span><span class="access-val teal" style="font-size:10px">Complimentary · Unlimited · Full access</span></div>
          </div>
        </div>
      </div>
    </div>

  </main>
</div>

<!-- ADD USER MODAL -->
<div class="modal-overlay" id="user-modal">
  <div class="modal">
    <h3>Add / Invite User</h3>
    <div class="modal-field">
      <label>Email Address</label>
      <input type="email" id="modal-email" placeholder="user@example.com">
    </div>
    <div class="modal-field">
      <label>Plan / Tier</label>
      <select id="modal-tier">
        <option value="free">Free</option>
        <option value="starter">Starter ($49/mo)</option>
        <option value="pro" selected>Pro ($99/mo)</option>
        <option value="cpa">CPA Firm ($199/mo)</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div class="modal-field">
      <label>Temporary Password <span style="color:var(--muted);font-size:9px">(leave blank to send magic link)</span></label>
      <input type="text" id="modal-pass" placeholder="Leave blank to send invite email">
    </div>
    <div class="modal-err" id="modal-err"></div>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" id="modal-submit" onclick="submitAddUser()">Create User</button>
    </div>
  </div>
</div>

<!-- CHANGE TIER MODAL -->
<div class="modal-overlay" id="tier-modal">
  <div class="modal">
    <h3>Change Plan</h3>
    <div style="font-size:12px;color:var(--muted);margin-bottom:16px" id="tier-modal-email"></div>
    <div class="modal-field">
      <label>New Plan / Tier</label>
      <select id="tier-select" onchange="updateTierPreview()">
        <option value="anonymous">Anonymous (Trial)</option>
        <option value="free">Free</option>
        <option value="starter">Starter</option>
        <option value="pro">Pro</option>
        <option value="cpa">CPA Firm</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div id="tier-preview" style="padding:10px 12px;background:rgba(0,212,184,0.05);border:1px solid rgba(0,212,184,0.15);border-radius:8px;margin-bottom:12px;font-size:11px;color:var(--text);line-height:1.8">
    </div>
    <div class="modal-err" id="tier-modal-err"></div>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeTierModal()">Cancel</button>
      <button class="modal-btn primary" id="tier-submit" onclick="submitTierChange()">Save</button>
    </div>
  </div>
</div>

<!-- DELETE CONFIRM MODAL -->
<div class="modal-overlay" id="delete-modal">
  <div class="modal">
    <h3>Delete User</h3>
    <div style="font-size:12px;color:var(--muted);margin-bottom:16px">This will permanently delete the account. This cannot be undone.</div>
    <div style="font-size:13px;color:var(--red);font-weight:700;margin-bottom:16px" id="delete-modal-email"></div>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeDeleteModal()">Cancel</button>
      <button class="modal-btn primary" id="delete-submit" onclick="submitDeleteUser()" style="background:var(--red);color:#fff">Delete Forever</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// ── Config ────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'sturs49@gmail.com';
const SUPABASE_URL = 'https://dnhsufwdyhkwrsdtfgyx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TQztgMqEoUjGQVUqQjPCPA_joWxqPtG';
const TIER_PRICES  = { starter: 49, pro: 99, cpa: 199 };
const TIER_DISPLAY = { anonymous:'Guest', free:'Free', starter:'Starter', pro:'Pro', cpa:'Firm', admin:'Admin' };
const TD = t => TIER_DISPLAY[t] || t;

// Supabase client (anon) — only used for admin's own login session
let sbClient = null;
function getSB() {
  if (!sbClient) {
    // Load Supabase dynamically
    sbClient = window._sb;
  }
  return sbClient;
}

// ── Auth (admin login via Supabase email/pass or local bypass) ────────────────
const SESSION_KEY = 'cte_admin_session';

function storeSession(obj) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(obj));
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-err');

  btn.disabled = true; btn.textContent = 'Signing in…'; err.textContent = '';

  // Quick local bypass for known admin
  if (email === ADMIN_EMAIL && pass === 'CTE-admin-2026') {
    storeSession({ access_token: 'bypass', refresh_token: null, email: ADMIN_EMAIL, expires_at: Date.now() + 86400000 });
    showApp({ email: ADMIN_EMAIL });
    return;
  }

  // Try Supabase auth
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Invalid credentials');
    const tier = data.user?.user_metadata?.tier || 'free';
    if (tier !== 'admin' && email !== ADMIN_EMAIL) throw new Error('Not an admin account.');
    storeSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      email: data.user?.email || email,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000
    });
    showApp(data.user);
  } catch(e) {
    err.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function tryAutoLogin() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    // Bypass session
    if (s.access_token === 'bypass' && s.email === ADMIN_EMAIL) {
      if (Date.now() < s.expires_at) { showApp({ email: ADMIN_EMAIL }); return; }
      localStorage.removeItem(SESSION_KEY); return;
    }
    // Token still valid — validate with Supabase
    if (s.access_token && Date.now() < s.expires_at) {
      const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
        headers: { Authorization: 'Bearer ' + s.access_token, apikey: SUPABASE_KEY }
      });
      if (r.ok) {
        const user = await r.json();
        const tier = user.user_metadata?.tier || 'free';
        if (tier === 'admin' || user.email === ADMIN_EMAIL) { showApp(user); return; }
      }
    }
    // Token expired — try refresh
    if (s.refresh_token) {
      const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (r.ok) {
        const data = await r.json();
        const tier = data.user?.user_metadata?.tier || 'free';
        if (tier === 'admin' || data.user?.email === ADMIN_EMAIL) {
          storeSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            email: data.user?.email || s.email,
            expires_at: Date.now() + (data.expires_in || 3600) * 1000
          });
          showApp(data.user);
          return;
        }
      }
    }
    localStorage.removeItem(SESSION_KEY);
  } catch(e) { localStorage.removeItem(SESSION_KEY); }
}

function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const email = user.email || ADMIN_EMAIL;
  document.getElementById('my-email').textContent = email;
  document.getElementById('admin-email-badge').textContent = email;
  updateClock(); setInterval(updateClock, 1000);
  loadOverview();
}

function doLogout() { localStorage.removeItem(SESSION_KEY); location.reload(); }
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') doLogin();
});
document.addEventListener('DOMContentLoaded', () => tryAutoLogin());

// ── Navigation ────────────────────────────────────────────────────────────────
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = { overview:'Dashboard Overview', users:'User Management', revenue:'Revenue Metrics', activity:'Activity Log', feedback:'User Feedback', access:'My Access', settings:'Settings' };
  const t = titles[id] || id;
  const parts = t.split(' '); const last = parts.pop();
  document.getElementById('page-title').innerHTML = parts.join(' ') + ' <span>' + last + '</span>';
  if (id === 'users')    loadUsers();
  if (id === 'activity') loadActivity();
  if (id === 'revenue')  loadRevenue();
  if (id === 'feedback') loadFeedback();
  if (id === 'settings') checkProxyStatus();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, isErr = false) {
  const el = document.getElementById('toast');
  el.textContent = (isErr ? '✗ ' : '✓ ') + msg;
  el.className = 'toast show' + (isErr ? ' error' : '');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('topbar-time').textContent =
    new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ── Core data fetch (all via proxy) ──────────────────────────────────────────
let allUsers = [];

async function fetchUsers() {
  const r = await fetch('/proxy/list-users');
  if (!r.ok) throw new Error('Proxy error ' + r.status);
  const d = await r.json();
  return d.users || [];
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const users = await fetchUsers();
    allUsers = users;
    renderOverviewStats(users);
    renderCoverageCards();
  } catch(e) {
    document.getElementById('stat-users').textContent = 'ERR';
    document.getElementById('plan-dist').innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  }
}

function getTier(u) { return u.user_metadata?.tier || u.tier || 'anonymous'; }

function renderOverviewStats(users) {
  const paying = users.filter(u => TIER_PRICES[getTier(u)]);
  const free   = users.filter(u => !TIER_PRICES[getTier(u)] && getTier(u) !== 'admin');
  const mrr    = paying.reduce((s, u) => s + (TIER_PRICES[getTier(u)] || 0), 0);

  document.getElementById('stat-users').textContent   = users.length;
  document.getElementById('stat-paying').textContent  = paying.length;
  document.getElementById('stat-free').textContent    = free.length;
  document.getElementById('stat-mrr').textContent     = '$' + mrr.toLocaleString();
  document.getElementById('stat-users-d').textContent = 'Total registered';
  document.getElementById('stat-paying-d').textContent= 'Starter + Pro + CPA';
  document.getElementById('stat-free-d').textContent  = 'Free + Anonymous';
  document.getElementById('stat-mrr-d').textContent   = 'estimated monthly revenue';

  // Plan distribution bars
  const tierDefs = [
    { key:'anonymous', label:'Anonymous', color:'#475569' },
    { key:'free',      label:'Free',      color:'#64748b' },
    { key:'starter',   label:'Starter',   color:'#60a5fa' },
    { key:'pro',       label:'Pro',       color:'#a78bfa' },
    { key:'cpa',       label:'CPA Firm',  color:'#00d4b8' },
    { key:'admin',     label:'Admin',     color:'#fbbf24' },
  ];
  const counts = {};
  users.forEach(u => { const t = getTier(u); counts[t] = (counts[t]||0)+1; });
  const total = users.length || 1;
  const pd = document.getElementById('plan-dist');
  pd.innerHTML = '';
  tierDefs.forEach(d => {
    const c = counts[d.key] || 0; if (!c) return;
    const pct = Math.round(c / total * 100);
    pd.innerHTML += \`<div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:var(--text)">\${d.label}</span>
        <span style="font-size:11px;color:var(--muted)">\${c} · \${pct}%</span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:\${pct}%;background:\${d.color};border-radius:3px"></div>
      </div>
    </div>\`;
  });

  // Recent signups
  const recent = [...users].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0,8);
  document.getElementById('recent-signups').innerHTML = recent.map(u => {
    const tier = getTier(u);
    return \`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03)">
      <span style="color:var(--teal);font-size:11px;font-family:monospace">\${u.email||'—'}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="tier-badge tier-\${tier}">\${TD(tier)}</span>
        <span style="color:var(--muted);font-size:10px">\${timeAgo(u.created_at)}</span>
      </div>
    </div>\`;
  }).join('');
}

// ── Coverage Cards ────────────────────────────────────────────────────────────
function renderCoverageCards() {
  // ── Supported Chains ──
  const chains = [
    { name:'Ethereum',      color:'#627EEA', rpc:'Moralis + RPC' },
    { name:'Polygon',       color:'#8247E5', rpc:'Moralis + RPC' },
    { name:'Base',          color:'#0052FF', rpc:'Moralis + RPC' },
    { name:'Arbitrum',      color:'#28A0F0', rpc:'Moralis + RPC' },
    { name:'Optimism',      color:'#FF0420', rpc:'Moralis + RPC' },
    { name:'BSC',           color:'#F3BA2F', rpc:'Moralis + RPC' },
    { name:'Solana',        color:'#9945FF', rpc:'Helius' },
    { name:'Avalanche',     color:'#E84142', rpc:'Moralis + RPC' },
    { name:'Fantom',        color:'#1969FF', rpc:'Moralis + RPC' },
    { name:'Gnosis',        color:'#04795B', rpc:'Moralis + RPC' },
    { name:'Celo',          color:'#35D07F', rpc:'Moralis + RPC' },
    { name:'Mantle',        color:'#000',    rpc:'RPC' },
    { name:'Scroll',        color:'#FFEEDA', rpc:'RPC' },
    { name:'zkSync',        color:'#4E529A', rpc:'RPC' },
    { name:'Polygon zkEVM', color:'#7B3FE4', rpc:'RPC' },
    { name:'Linea',         color:'#61DFFF', rpc:'Moralis + RPC' },
    { name:'Blast',         color:'#FCFC03', rpc:'RPC' },
    { name:'Cronos',        color:'#002D74', rpc:'Moralis + RPC' },
  ];
  document.getElementById('chain-count-badge').textContent = chains.length + ' chains';
  document.getElementById('chains-card').innerHTML = chains.map(c => {
    const dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + c.color + ';margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.1)"></span>';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03)">'
      + '<span style="font-size:11px;color:#fff">' + dot + c.name + '</span>'
      + '<span style="font-size:9px;color:var(--muted);font-family:monospace">' + c.rpc + '</span>'
      + '</div>';
  }).join('');

  // ── DeFi Protocol Library ──
  const protocols = {
    'Liquid Staking': ['Lido','Rocket Pool','Frax Ether','Coinbase (cbETH)','Stader','Marinade','Jito','Sanctum','Ankr','Swell','StakeWise'],
    'Restaking': ['EigenLayer','Symbiotic','Karak','Ether.fi','Renzo','Kelp DAO','Puffer Finance'],
    'Lending': ['Aave (V2/V3)','Compound (V2/V3)','Spark','MakerDAO','Morpho','Fluid','Kamino'],
    'DEX': ['Uniswap (V2/V3)','SushiSwap','Curve','Balancer','PancakeSwap','Aerodrome','Velodrome','Camelot','Trader Joe','Orca','Raydium'],
    'DEX Aggregator': ['Jupiter','1inch','ParaSwap','CoW Protocol','Odos','Bebop'],
    'Yield': ['Yearn','Beefy','Convex','Harvest Finance'],
    'Perpetuals': ['dYdX','GMX (V1/V2)','Gains Network','Vertex'],
    'Bridge': ['Stargate','Across','Hop','Wormhole','LayerZero','Axelar','Synapse','Celer','Multichain','Socket','LI.FI','Polygon Bridge','Arbitrum Bridge','Optimism Bridge'],
    'NFT': ['OpenSea','Blur','Magic Eden'],
    'Wrap': ['WETH'],
  };
  const catColors = {
    'Liquid Staking':'#60a5fa','Restaking':'#a78bfa','Lending':'#f59e0b','DEX':'#34d399',
    'DEX Aggregator':'#06b6d4','Yield':'#fb923c','Perpetuals':'#f472b6','Bridge':'#00d4b8',
    'NFT':'#e879f9','Wrap':'#94a3b8'
  };
  let totalProtos = 0;
  let protoHtml = '';
  for (const [cat, names] of Object.entries(protocols)) {
    totalProtos += names.length;
    const color = catColors[cat] || 'var(--muted)';
    protoHtml += '<div style="margin-bottom:10px">'
      + '<div style="font-size:10px;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">' + cat + ' <span style="color:var(--muted);font-weight:400">(' + names.length + ')</span></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:3px">'
      + names.map(n => '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,0.04);color:#ccc;border:1px solid rgba(255,255,255,0.06)">' + n + '</span>').join('')
      + '</div></div>';
  }
  document.getElementById('proto-count-badge').textContent = totalProtos + ' protocols';
  document.getElementById('protocols-card').innerHTML = protoHtml;

  // ── Bridge Contract Registry ──
  const bridges = [
    { proto:'Stargate',         addr:'0x8731d54e...01e98', note:'V1 Router' },
    { proto:'Stargate',         addr:'0x77b20437...57931', note:'V2 StargatePoolNative' },
    { proto:'Stargate',         addr:'0x150f94b4...c2376', note:'Finance Router (ETH)' },
    { proto:'Across',           addr:'0x5c7bcd6e...35c5',  note:'SpokePool (Ethereum)' },
    { proto:'Across',           addr:'0x9295ee1d...7f096', note:'SpokePool (Multi-chain)' },
    { proto:'Hop',              addr:'0xb8901acb...19727f', note:'Bonder' },
    { proto:'Wormhole',         addr:'0x3ee18b22...8fa585', note:'Token Bridge' },
    { proto:'LayerZero',        addr:'0x1a440760...e728c', note:'Endpoint V2' },
    { proto:'LayerZero',        addr:'0x902f0971...089e',  note:'Relayer V2' },
    { proto:'LayerZero',        addr:'0x66a71dce...cd675', note:'Endpoint V1' },
    { proto:'Polygon Bridge',   addr:'0xa0c68c63...c9a8',  note:'RootChainManager' },
    { proto:'Arbitrum Bridge',  addr:'0x72ce9c84...031ef', note:'Gateway Router' },
    { proto:'Arbitrum Bridge',  addr:'0x4dbd4fc5...bab3f', note:'L1 Delayed Inbox' },
    { proto:'Optimism Bridge',  addr:'0x99c9fc46...e884be1', note:'Standard Bridge' },
    { proto:'Optimism Bridge',  addr:'0x3154cf16...f2c35', note:'Base Bridge' },
    { proto:'Synapse',          addr:'0x2796317b...16ceb6', note:'Synapse Bridge' },
    { proto:'Celer',            addr:'0x5427fefa...da1820', note:'cBridge' },
    { proto:'Multichain',       addr:'0xba8da9dc...10705', note:'Router V6' },
    { proto:'Socket',           addr:'0x3a23f943...97a5',  note:'Bungee Gateway' },
    { proto:'LI.FI',            addr:'0x1231deb6...4eae',  note:'Diamond' },
  ];
  document.getElementById('bridge-count-badge').textContent = bridges.length + ' contracts';
  document.getElementById('bridges-card').innerHTML = bridges.map(b => {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03)">'
      + '<div>'
      + '<span style="font-size:11px;color:#00d4b8;font-weight:600">' + b.proto + '</span>'
      + '<span style="font-size:9px;color:var(--muted);margin-left:6px">' + b.note + '</span>'
      + '</div>'
      + '<span style="font-size:9px;color:#8892b0;font-family:monospace">' + b.addr + '</span>'
      + '</div>';
  }).join('');
}

// ── Revenue ───────────────────────────────────────────────────────────────────
async function loadRevenue() {
  try {
    const users = allUsers.length ? allUsers : await fetchUsers();
    if (!allUsers.length) allUsers = users;
    renderRevenue(users);
  } catch(e) {
    document.getElementById('rev-breakdown').innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  }
}

function renderRevenue(users) {
  const tiers = ['starter','pro','cpa'];
  const counts = {};
  tiers.forEach(t => counts[t] = users.filter(u => getTier(u) === t).length);
  const paying = tiers.reduce((s,t) => s + counts[t], 0);
  const mrr    = tiers.reduce((s,t) => s + counts[t] * (TIER_PRICES[t]||0), 0);
  const arr    = mrr * 12;

  document.getElementById('rev-mrr').textContent = '$' + mrr.toLocaleString();
  document.getElementById('rev-arr').textContent = '$' + arr.toLocaleString();
  document.getElementById('rev-paying').textContent = paying;
  document.getElementById('rev-paying-d').textContent = tiers.map(t => counts[t] + ' ' + t).join(' · ');

  const colors = { starter: '#60a5fa', pro: '#a78bfa', cpa: '#00d4b8' };
  const labels = { starter: 'Starter', pro: 'Pro', cpa: 'CPA Firm' };
  const total  = mrr || 1;
  document.getElementById('rev-breakdown').innerHTML = tiers.map(t => {
    const rev  = counts[t] * TIER_PRICES[t];
    const pct  = Math.round(rev / total * 100);
    return \`<div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <div>
          <span style="font-size:13px;font-weight:700;color:#fff">\${labels[t]}</span>
          <span style="font-size:10px;color:var(--muted);margin-left:8px">$\${TIER_PRICES[t]}/mo · \${counts[t]} users</span>
        </div>
        <span style="font-size:15px;font-weight:700;color:\${colors[t]}">$\${rev.toLocaleString()}/mo</span>
      </div>
      <div style="height:7px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:\${pct}%;background:\${colors[t]};border-radius:4px"></div>
      </div>
    </div>\`;
  }).join('');
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('user-tbody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><span class="spinner"></span>Loading from Supabase…</td></tr>';
  try {
    const users = await fetchUsers();
    allUsers = users;
    document.getElementById('user-count-badge').textContent = '(' + users.length + ')';
    renderUsers(users);
  } catch(e) {
    tbody.innerHTML = \`<tr class="loading-row"><td colspan="6" style="color:var(--red)">⚠ \${e.message}</td></tr>\`;
  }
}

function renderUsers(list) {
  const tbody = document.getElementById('user-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="7" style="color:var(--muted)">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => {
    const tier   = getTier(u);
    const email  = u.email || '—';
    const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';
    const lastIn = u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : '—';
    const perms  = TIER_PERMS_CLIENT[tier] || TIER_PERMS_CLIENT.free;
    const txLim  = u.user_metadata?.tx_limit || perms.tx_limit;
    const batch  = u.user_metadata?.batch_analyzer != null ? u.user_metadata.batch_analyzer : perms.batch_analyzer;
    const uid    = u.id || '';
    return \`<tr>
      <td style="font-family:monospace;font-size:11px">\${email}</td>
      <td><span class="tier-badge tier-\${tier}">\${TD(tier)}</span></td>
      <td style="font-size:11px">\${typeof txLim === 'number' && txLim > 99999 ? '∞' : txLim}</td>
      <td style="font-size:11px">\${batch ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--muted)">✗</span>'}</td>
      <td style="color:var(--muted)">\${joined}</td>
      <td style="color:var(--muted)">\${lastIn}</td>
      <td style="display:flex;gap:5px;flex-wrap:wrap">
        <button class="action-btn btn-edit" onclick="openTierModal('\${uid}','\${email}','\${tier}')">Change Plan</button>
        \${tier==='free'||tier==='anonymous' ? \`<button class="action-btn btn-upgrade" onclick="quickSetTier('\${uid}','\${email}','starter')">→ Starter</button>\` : ''}
        \${tier==='free'||tier==='anonymous'||tier==='starter' ? \`<button class="action-btn btn-upgrade" onclick="quickSetTier('\${uid}','\${email}','pro')">→ Pro</button>\` : ''}
        \${tier!=='cpa'&&tier!=='admin' ? \`<button class="action-btn btn-upgrade" onclick="quickSetTier('\${uid}','\${email}','cpa')">→ Firm</button>\` : ''}
        <button class="action-btn btn-danger" onclick="openDeleteModal('\${uid}','\${email}')">Delete</button>
      </td>
    </tr>\`;
  }).join('');
}

function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  renderUsers(allUsers.filter(u => (u.email||'').toLowerCase().includes(q) || getTier(u).includes(q)));
}

// ── Tier management ───────────────────────────────────────────────────────────
let activeTierUserId = null, activeTierEmail = null;

function openTierModal(uid, email, currentTier) {
  activeTierUserId = uid; activeTierEmail = email;
  document.getElementById('tier-modal-email').textContent = email;
  document.getElementById('tier-select').value = currentTier;
  document.getElementById('tier-modal-err').textContent = '';
  updateTierPreview();
  document.getElementById('tier-modal').classList.add('show');
}
function closeTierModal() { document.getElementById('tier-modal').classList.remove('show'); }

function updateTierPreview() {
  const tier = document.getElementById('tier-select').value;
  const p = TIER_PERMS_CLIENT[tier] || TIER_PERMS_CLIENT.free;
  const txLim = typeof p.tx_limit === 'number' && p.tx_limit > 99999 ? 'Unlimited' : p.tx_limit;
  const check = '<span style="color:var(--green)">✓</span>';
  const cross = '<span style="color:var(--muted)">✗</span>';
  document.getElementById('tier-preview').innerHTML =
    '<strong style="color:var(--teal)">Permissions applied:</strong><br>' +
    'TX Limit: <strong>' + txLim + '</strong><br>' +
    'Batch Analyzer: ' + (p.batch_analyzer ? check : cross) + '<br>' +
    'API Access: ' + (p.api_access ? check : cross);
}

async function submitTierChange() {
  const newTier = document.getElementById('tier-select').value;
  const btn = document.getElementById('tier-submit');
  const errEl = document.getElementById('tier-modal-err');
  btn.disabled = true; btn.textContent = 'Saving…'; errEl.textContent = '';
  try {
    await setUserTier(activeTierUserId, activeTierEmail, newTier);
    toast(activeTierEmail + ' → ' + TD(newTier));
    closeTierModal();
    await loadUsers();
  } catch(e) {
    errEl.textContent = e.message || 'Failed.';
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
}

async function setUserTier(uid, email, tier) {
  const r = await fetch('/proxy/update-user/' + uid, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_metadata: { tier } })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || d.msg || 'Update failed: ' + r.status);
}

async function quickSetTier(uid, email, tier) {
  try {
    await setUserTier(uid, email, tier);
    toast(email + ' → ' + TD(tier));
    await loadUsers();
  } catch(e) { toast(e.message, true); }
}

// ── Delete user ───────────────────────────────────────────────────────────────
let activeDeleteId = null, activeDeleteEmail = null;

function openDeleteModal(uid, email) {
  activeDeleteId = uid; activeDeleteEmail = email;
  document.getElementById('delete-modal-email').textContent = email;
  document.getElementById('delete-modal').classList.add('show');
}
function closeDeleteModal() { document.getElementById('delete-modal').classList.remove('show'); }

async function submitDeleteUser() {
  const btn = document.getElementById('delete-submit');
  btn.disabled = true; btn.textContent = 'Deleting…';
  try {
    const r = await fetch('/proxy/delete-user/' + activeDeleteId, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json(); throw new Error(d.message || 'Delete failed'); }
    toast(activeDeleteEmail + ' deleted');
    closeDeleteModal();
    await loadUsers();
  } catch(e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Delete Forever';
  }
}

// ── Add user modal ────────────────────────────────────────────────────────────
function openAddUserModal() {
  document.getElementById('modal-email').value = '';
  document.getElementById('modal-pass').value  = '';
  document.getElementById('modal-tier').value  = 'pro';
  document.getElementById('modal-err').textContent = '';
  document.getElementById('user-modal').classList.add('show');
}
function closeModal() { document.getElementById('user-modal').classList.remove('show'); }

async function submitAddUser() {
  const email = document.getElementById('modal-email').value.trim();
  const tier  = document.getElementById('modal-tier').value;
  const pass  = document.getElementById('modal-pass').value.trim();
  const btn   = document.getElementById('modal-submit');
  const errEl = document.getElementById('modal-err');
  if (!email) { errEl.textContent = 'Email is required.'; return; }
  btn.disabled = true; btn.textContent = 'Creating…'; errEl.textContent = '';
  try {
    let r;
    if (pass) {
      r = await fetch('/proxy/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, user_metadata: { tier }, email_confirm: true })
      });
    } else {
      r = await fetch('/proxy/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, data: { tier } })
      });
    }
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.msg || d.error_description || 'HTTP ' + r.status);
    toast('User created: ' + email + ' (' + TD(tier) + ')');
    closeModal();
    await loadUsers();
  } catch(e) {
    errEl.textContent = e.message || 'Unknown error.';
  } finally {
    btn.disabled = false; btn.textContent = 'Create User';
  }
}

// ── Activity ──────────────────────────────────────────────────────────────────
async function loadActivity() {
  const feed = document.getElementById('full-feed');
  feed.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:20px"><span class="spinner"></span>Loading…</div>';
  try {
    const users = allUsers.length ? allUsers : await fetchUsers();
    if (!allUsers.length) allUsers = users;
    const sorted = [...users].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0,30);
    feed.innerHTML = sorted.map(u => {
      const tier = getTier(u);
      const color = tier === 'admin' ? '#fbbf24' : TIER_PRICES[tier] ? '#a78bfa' : '#4ade80';
      return \`<div class="feed-item">
        <div class="feed-dot" style="background:\${color}"></div>
        <div class="feed-text">New signup: <span>\${u.email||'—'}</span>
          <span class="tier-badge tier-\${tier}" style="margin-left:6px">\${TD(tier)}</span>
        </div>
        <div class="feed-time">\${timeAgo(u.created_at)}</div>
      </div>\`;
    }).join('');
  } catch(e) {
    feed.innerHTML = '<div style="color:var(--red);font-size:11px;text-align:center;padding:20px">' + e.message + '</div>';
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────────
let allFeedback = [];

async function loadFeedback() {
  const tbody = document.getElementById('fb-tbody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><span class="spinner"></span>Loading feedback…</td></tr>';
  try {
    // Fetch recent feedback + summary in parallel
    const [fbRes, sumRes] = await Promise.all([
      fetch('/proxy/feedback?limit=200'),
      fetch('/proxy/feedback-summary')
    ]);
    const feedback = await fbRes.json();
    const summary  = await sumRes.json();

    allFeedback = Array.isArray(feedback) ? feedback : [];
    document.getElementById('fb-count-badge').textContent = '(' + allFeedback.length + ' votes)';

    // Stats
    const ups   = allFeedback.filter(f => f.vote === 'up').length;
    const downs = allFeedback.filter(f => f.vote === 'down').length;
    const total = allFeedback.length;
    const pct   = total > 0 ? Math.round(ups / total * 100) : 0;

    document.getElementById('fb-total').textContent = total;
    document.getElementById('fb-up').textContent    = ups;
    document.getElementById('fb-down').textContent  = downs;
    document.getElementById('fb-total-d').textContent = 'all time';
    document.getElementById('fb-up-d').textContent  = pct + '% approval rate';
    document.getElementById('fb-down-d').textContent = total > 0 ? (100 - pct) + '% of votes' : '';
    document.getElementById('fb-approval').textContent = pct + '%';

    // Average confidence
    const confs = allFeedback.filter(f => f.confidence != null).map(f => f.confidence);
    const avgConf = confs.length > 0 ? Math.round(confs.reduce((s,v) => s+v, 0) / confs.length) : 0;
    document.getElementById('fb-avg-conf').textContent = avgConf + '%';
    document.getElementById('fb-avg-conf-d').textContent = confs.length + ' classified txns';

    // Accuracy by TX Type (from summary view, aggregated across protocols)
    const byType = document.getElementById('fb-by-type');
    if (Array.isArray(summary) && summary.length > 0) {
      var typeAgg = {};
      summary.forEach(function(s) {
        var k = (s.tx_type || 'unknown').toLowerCase();
        if (!typeAgg[k]) typeAgg[k] = { type: s.tx_type || 'unknown', up: 0, down: 0, total: 0 };
        typeAgg[k].up += (s.thumbs_up || 0);
        typeAgg[k].down += (s.thumbs_down || 0);
        typeAgg[k].total += (s.total || 0);
      });
      var typeArr = Object.values(typeAgg).sort(function(a,b) { return b.total - a.total; });
      byType.innerHTML = typeArr.map(function(s) {
        const t = s.total || 1;
        const upPct = Math.round(s.up / t * 100);
        const barColor = upPct >= 80 ? '#4ade80' : upPct >= 60 ? '#fbbf24' : '#f87171';
        return '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
            '<span style="font-size:11px;color:var(--text)">' + s.type + '</span>' +
            '<span style="font-size:10px;color:var(--muted)">' + s.up + '👍 ' + s.down + '👎 · ' + upPct + '%</span>' +
          '</div>' +
          '<div style="height:5px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">' +
            '<div style="height:100%;width:' + upPct + '%;background:' + barColor + ';border-radius:3px"></div>' +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      byType.innerHTML = '<div style="color:var(--muted);font-size:11px">No feedback data yet</div>';
    }

    // Accuracy by Koinly Action (aggregate from raw feedback)
    const koinlyMap = {};
    allFeedback.forEach(f => {
      const k = f.koinly_action || 'unknown';
      if (!koinlyMap[k]) koinlyMap[k] = { up: 0, down: 0 };
      if (f.vote === 'up') koinlyMap[k].up++; else koinlyMap[k].down++;
    });
    const byKoinly = document.getElementById('fb-by-koinly');
    const koinlyEntries = Object.entries(koinlyMap).sort((a,b) => (b[1].up + b[1].down) - (a[1].up + a[1].down));
    if (koinlyEntries.length > 0) {
      byKoinly.innerHTML = koinlyEntries.slice(0, 12).map(([k, v]) => {
        const t = v.up + v.down;
        const upPct = Math.round(v.up / t * 100);
        const barColor = upPct >= 80 ? '#4ade80' : upPct >= 60 ? '#fbbf24' : '#f87171';
        return '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
            '<span style="font-size:11px;color:var(--teal);font-family:monospace">' + k + '</span>' +
            '<span style="font-size:10px;color:var(--muted)">' + v.up + '👍 ' + v.down + '👎 · ' + upPct + '%</span>' +
          '</div>' +
          '<div style="height:5px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">' +
            '<div style="height:100%;width:' + upPct + '%;background:' + barColor + ';border-radius:3px"></div>' +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      byKoinly.innerHTML = '<div style="color:var(--muted);font-size:11px">No feedback data yet</div>';
    }

    // Render table
    renderFeedbackTable(allFeedback);

    // ── Worst performers ──
    renderWorstPerformers(summary);

    // ── Top corrections (quick summary for side panel) ──
    renderTopCorrections(allFeedback);

    // ── Correction patterns ──
    renderCorrectionPatterns(allFeedback);

    // ── Most active users ──
    renderActiveUsers(allFeedback);

    // ── Load active rules ──
    loadRules();

  } catch(e) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8" style="color:var(--red)">⚠ ' + e.message + '</td></tr>';
  }
}

function renderFeedbackTable(list) {
  const tbody = document.getElementById('fb-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="9" style="color:var(--muted)">No feedback yet.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function(f, idx) {
    var fbIdx = allFeedback.indexOf(f);
    if (fbIdx < 0) fbIdx = idx;
    var voteIcon  = f.vote === 'up' ? '👍' : '👎';
    var voteCls   = f.vote === 'up' ? 'color:var(--green)' : 'color:var(--red)';
    var hashShort = f.tx_hash ? (f.tx_hash.slice(0,6) + '...' + f.tx_hash.slice(-4)) : '-';
    var hashLink  = f.tx_hash ? '<a href="' + explorerUrl(f.chain, f.tx_hash) + '" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:none">' + hashShort + '</a>' : '-';
    var chain     = f.chain || '-';
    var txType    = f.tx_type || '-';
    var koinly    = f.koinly_action || '-';
    var conf      = f.confidence != null ? f.confidence + '%' : '-';
    var tier      = f.user_tier || '-';
    var time      = timeAgo(f.created_at);
    return '<tr data-fb-idx="' + fbIdx + '">' +
      '<td style="font-size:16px;text-align:center;' + voteCls + '">' + voteIcon + '</td>' +
      '<td style="font-family:monospace;font-size:10px">' + hashLink + '</td>' +
      '<td>' + chain + '</td>' +
      '<td>' + txType + '</td>' +
      '<td style="font-family:monospace;font-size:10px;color:var(--teal)">' + koinly + '</td>' +
      '<td>' + conf + '</td>' +
      '<td><span class="tier-badge tier-' + tier + '">' + TD(tier) + '</span></td>' +
      '<td style="color:var(--muted)">' + time + '</td>' +
      '<td><button data-review-fb="' + fbIdx + '" onclick="reviewSingleTx(' + fbIdx + ')" style="font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid rgba(168,85,247,0.2);background:rgba(168,85,247,0.06);color:#a855f7;cursor:pointer">Review</button></td>' +
    '</tr>';
  }).join('');
}

function filterFeedback() {
  const filter = document.getElementById('fb-filter').value;
  if (filter === 'all') {
    renderFeedbackTable(allFeedback);
  } else {
    renderFeedbackTable(allFeedback.filter(f => f.vote === filter));
  }
}

// ── Top Corrections (most frequent user corrections) ─────────────────────────
function renderTopCorrections(feedback) {
  const el = document.getElementById('fb-corrections');
  const corrMap = {};
  feedback.forEach(f => {
    if (f.vote !== 'down' || !f.user_comment) return;
    const match = f.user_comment.match(/^Correct category:\s*(.+)$/i);
    if (!match) return;
    const key = (f.tx_type || 'unknown') + ' -> ' + match[1].trim();
    if (!corrMap[key]) corrMap[key] = { count: 0, hashes: [] };
    corrMap[key].count++;
    if (f.tx_hash && corrMap[key].hashes.length < 3) corrMap[key].hashes.push({ hash: f.tx_hash, chain: f.chain || 'unknown' });
  });
  const sorted = Object.entries(corrMap).sort((a,b) => b[1].count - a[1].count).slice(0, 8);
  if (!sorted.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px">No corrections submitted yet</div>';
    return;
  }
  el.innerHTML = sorted.map(function(entry, idx) {
    var label = entry[0], data = entry[1];
    var cId = 'corr-hashes-' + idx;
    var hashLinks = data.hashes.map(function(h) {
      var short = h.hash.slice(0,6) + '...' + h.hash.slice(-4);
      return '<a href="' + explorerUrl(h.chain, h.hash) + '" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:none;font-size:9px;font-family:monospace">' + short + '</a>';
    }).join(', ');
    return '<div style="padding:4px 0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleCorrHash(' + idx + ')">' +
        '<span style="font-size:11px;color:var(--text)">' + label + '</span>' +
        '<span style="font-size:10px;color:var(--teal);font-weight:700">' + data.count + 'x</span>' +
      '</div>' +
      (hashLinks ? '<div id="' + cId + '" style="display:none;margin-top:4px;padding-left:8px">' + hashLinks + '</div>' : '') +
    '</div>';
  }).join('');
}

// ── Worst Performers ─────────────────────────────────────────────────────────
function renderWorstPerformers(summary) {
  const el = document.getElementById('fb-worst');
  if (!Array.isArray(summary) || !summary.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px">No data yet</div>';
    return;
  }
  // Aggregate across protocols (summary is now split by protocol)
  var aggMap = {};
  summary.forEach(function(s) {
    var key = (s.tx_type || 'unknown').toLowerCase();
    if (!aggMap[key]) aggMap[key] = { type: s.tx_type || 'unknown', up: 0, down: 0, total: 0, hashes: [] };
    aggMap[key].up += (s.thumbs_up || 0);
    aggMap[key].down += (s.thumbs_down || 0);
    aggMap[key].total += (s.total || 0);
  });
  // Collect sample hashes from allFeedback
  allFeedback.forEach(function(f) {
    var key = (f.tx_type || 'unknown').toLowerCase();
    if (aggMap[key] && f.tx_hash && aggMap[key].hashes.length < 5) {
      aggMap[key].hashes.push({ hash: f.tx_hash, chain: f.chain || 'unknown' });
    }
  });
  const worst = Object.values(aggMap)
    .filter(s => s.total >= 2)
    .map(s => ({ type: s.type, pct: Math.round(s.up / (s.total || 1) * 100), total: s.total, down: s.down, hashes: s.hashes || [] }))
    .filter(s => s.pct < 75)
    .sort((a,b) => a.pct - b.pct);

  if (!worst.length) {
    el.innerHTML = '<div style="color:#4ade80;font-size:11px">✓ All types above 75% approval</div>';
    return;
  }
  el.innerHTML = worst.slice(0,6).map(function(w, idx) {
    var barColor = w.pct < 40 ? '#f87171' : w.pct < 60 ? '#fbbf24' : '#64748b';
    var wId = 'worst-hashes-' + idx;
    var hashLinks = w.hashes.map(function(h) {
      var short = h.hash.slice(0,6) + '...' + h.hash.slice(-4);
      return '<a href="' + explorerUrl(h.chain, h.hash) + '" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:none;font-size:9px;font-family:monospace">' + short + '</a>';
    }).join(', ');
    return '<div style="padding:4px 0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="togglePatternHash(-' + (idx+1) + ')">' +
        '<span style="font-size:11px;color:var(--text)">' + w.type + '</span>' +
        '<span style="font-size:10px;color:' + barColor + ';font-weight:700">' + w.pct + '% <span style="color:var(--muted);font-weight:400">(' + w.down + ' 👎 / ' + w.total + ')</span></span>' +
      '</div>' +
      (hashLinks ? '<div id="pattern-hashes--' + (idx+1) + '" style="display:none;margin-top:4px;font-size:9px;color:var(--muted);padding-left:8px">' + hashLinks + '</div>' : '') +
    '</div>';
  }).join('');
}

// ── Most Active Users ─────────────────────────────────────────────────────────
async function renderActiveUsers(feedback) {
  const userMap = {};
  feedback.forEach(f => {
    const uid = f.user_id || f.user_tier || 'anonymous';
    if (!userMap[uid]) userMap[uid] = { id: uid, tier: f.user_tier || 'anonymous', up: 0, down: 0, total: 0, corrections: [] };
    userMap[uid].total++;
    if (f.vote === 'up') userMap[uid].up++;
    else {
      userMap[uid].down++;
      if (f.user_comment) {
        const m = f.user_comment.match(/^Correct category:\s*(.+)$/i);
        if (m) userMap[uid].corrections.push((f.tx_type || '?') + ' → ' + m[1].trim());
      }
    }
  });
  const users = Object.values(userMap).sort((a,b) => b.total - a.total).slice(0, 20);
  const tbody = document.getElementById('active-users-tbody');
  const badge = document.getElementById('active-users-count');
  if (!users.length) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="7" style="color:var(--muted)">No user data yet.</td></tr>';
    badge.textContent = '';
    return;
  }
  badge.textContent = '(' + users.length + ' users)';

  // Look up emails from allUsers (already loaded from Supabase Auth)
  const emailMap = {};
  if (typeof allUsers !== 'undefined' && allUsers.length) {
    allUsers.forEach(u => { emailMap[u.id] = u.email || ''; });
  }

  // Count how many of each user's corrections became active rules
  let activeRules = [];
  try {
    const rr = await fetch('/proxy/rules');
    const rd = await rr.json();
    activeRules = Array.isArray(rd) ? rd.filter(r => r.active) : [];
  } catch(e) {}
  const ruleSet = new Set(activeRules.map(r => (r.original_type || '').toLowerCase() + ' → ' + (r.corrected_type || '').toLowerCase()));

  // Alignment: % of votes that match majority direction for that tx_type
  const typeVotes = {};
  feedback.forEach(f => {
    const t = f.tx_type || 'unknown';
    if (!typeVotes[t]) typeVotes[t] = { up: 0, down: 0 };
    if (f.vote === 'up') typeVotes[t].up++; else typeVotes[t].down++;
  });
  users.forEach(u => {
    let aligned = 0;
    feedback.filter(f => (f.user_id || f.user_tier || 'anonymous') === u.id).forEach(f => {
      const t = f.tx_type || 'unknown';
      const majority = (typeVotes[t] || {}).up >= (typeVotes[t] || {}).down ? 'up' : 'down';
      if (f.vote === majority) aligned++;
    });
    u.alignment = u.total > 0 ? Math.round(aligned / u.total * 100) : 0;
    // Count corrections that became rules
    u.kbAdds = u.corrections.filter(c => ruleSet.has(c.toLowerCase())).length;
  });
  tbody.innerHTML = users.map(u => {
    const email = emailMap[u.id] || '';
    const displayName = email ? email.split('@')[0] : (u.id.length > 8 ? u.id.slice(0, 8) + '…' : u.id);
    const tierBadge = '<span class="tier-badge tier-' + u.tier + '">' + (TD ? TD(u.tier) : u.tier) + '</span>';
    const alignColor = u.alignment >= 80 ? '#4ade80' : u.alignment >= 60 ? '#fbbf24' : '#f87171';
    const kbColor = u.kbAdds > 0 ? 'color:var(--teal);font-weight:700' : 'color:var(--muted)';
    return '<tr>' +
      '<td style="font-size:11px" title="' + (email || u.id) + '">' + displayName + '</td>' +
      '<td>' + tierBadge + '</td>' +
      '<td>' + u.total + '</td>' +
      '<td style="color:#4ade80">' + u.up + '</td>' +
      '<td style="color:#f87171">' + u.down + '</td>' +
      '<td><span style="color:' + alignColor + ';font-weight:600">' + u.alignment + '%</span></td>' +
      '<td style="' + kbColor + '">' + u.kbAdds + '</td>' +
    '</tr>';
  }).join('');
}

// ── Correction Patterns ──────────────────────────────────────────────────────
let correctionPatterns = [];

function renderCorrectionPatterns(feedback) {
  const patternMap = {};
  feedback.forEach(f => {
    if (f.vote !== 'down' || !f.user_comment) return;
    const match = f.user_comment.match(/^Correct category:\\s*(.+)$/i);
    if (!match) return;
    const corrected = match[1].trim();
    const original = f.tx_type || 'unknown';
    const proto = f.protocol || '';
    const key = original + '→' + corrected + (proto ? ':' + proto : '');
    if (!patternMap[key]) patternMap[key] = { original, corrected, protocol: proto, count: 0, totalConf: 0, sampleReasonings: [], sampleFunctions: [], sampleEvents: [], hashes: [] };
    patternMap[key].count++;
    if (f.tx_hash && patternMap[key].hashes.length < 20) patternMap[key].hashes.push({ hash: f.tx_hash, chain: f.chain || 'unknown' });
    if (f.confidence) patternMap[key].totalConf += f.confidence;
    if (f.reasoning && patternMap[key].sampleReasonings.length < 3) {
      patternMap[key].sampleReasonings.push((f.source ? '[' + f.source + '] ' : '') + f.reasoning);
    }
    if (f.function_name && patternMap[key].sampleFunctions.indexOf(f.function_name) < 0 && patternMap[key].sampleFunctions.length < 3) {
      patternMap[key].sampleFunctions.push(f.function_name);
    }
    if (f.event_names && Array.isArray(f.event_names)) {
      f.event_names.forEach(e => {
        if (patternMap[key].sampleEvents.indexOf(e) < 0 && patternMap[key].sampleEvents.length < 5) patternMap[key].sampleEvents.push(e);
      });
    }
  });

  correctionPatterns = Object.values(patternMap).sort((a,b) => b.count - a.count);
  const tbody = document.getElementById('fb-patterns-tbody');

  if (!correctionPatterns.length) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="7" style="color:var(--muted)">No correction patterns yet — users haven\\\'t submitted thumbs-down with categories.</td></tr>';
    return;
  }

  const EXPLORERS = { ethereum:'https://etherscan.io/tx/', polygon:'https://polygonscan.com/tx/', arbitrum:'https://arbiscan.io/tx/', optimism:'https://optimistic.etherscan.io/tx/', base:'https://basescan.org/tx/', bsc:'https://bscscan.com/tx/', avalanche:'https://snowtrace.io/tx/', solana:'https://solscan.io/tx/' };
  tbody.innerHTML = correctionPatterns.map((p, i) => {
    const avgConf = p.count > 0 && p.totalConf > 0 ? Math.round(p.totalConf / p.count) + '%' : '—';
    const protoBadge = p.protocol ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,0.12);color:#818cf8">' + p.protocol + '</span>' : '<span style="color:var(--muted);font-size:10px">—</span>';
    const hashId = 'pattern-hashes-' + i;
    const hashLinks = (p.hashes || []).map(h => {
      const explorer = EXPLORERS[(h.chain||'').toLowerCase()] || 'https://etherscan.io/tx/';
      const short = h.hash.length > 14 ? h.hash.slice(0,6) + '…' + h.hash.slice(-4) : h.hash;
      return '<a href="' + explorer + h.hash + '" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:none;font-size:10px;font-family:monospace">' + short + '</a> <span style="font-size:9px;color:var(--muted)">' + (h.chain||'') + '</span>';
    }).join('<br>');
    return '<tr>' +
      '<td style="font-weight:600">' + p.original + '</td>' +
      '<td style="color:var(--muted)">→</td>' +
      '<td style="color:var(--teal);font-weight:600">' + p.corrected + '</td>' +
      '<td>' + protoBadge + '</td>' +
      '<td style="cursor:pointer" onclick="togglePatternHash(' + i + ')">' +
        '<span style="color:#60a5fa;text-decoration:underline">' + p.count + 'x</span>' +
        '<div id="' + hashId + '" style="display:none;margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(255,255,255,0.06);max-height:140px;overflow-y:auto;line-height:1.6">' + (hashLinks || '<span style="color:var(--muted);font-size:10px">No hashes</span>') + '</div>' +
      '</td>' +
      '<td>' + avgConf + '</td>' +
      '<td><button onclick="applyRuleFromPattern(' + i + ')" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(0,212,184,0.2);background:rgba(0,212,184,0.06);color:var(--teal);cursor:pointer">Apply Rule</button></td>' +
    '</tr>';
  }).join('');
}

function togglePatternHash(idx) {
  var el = document.getElementById('pattern-hashes-' + idx);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function toggleCorrHash(idx) {
  var el = document.getElementById('corr-hashes-' + idx);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function applyRuleFromPattern(idx) {
  const p = correctionPatterns[idx];
  if (!p) return;
  if (!confirm('Add rule: "' + p.original + '" → "' + p.corrected + '"?\\nThis will be stored in the knowledge bank for future reference.')) return;
  fetch('/proxy/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      original_type: p.original,
      corrected_type: p.corrected,
      corrected_koinly: p.corrected,
      vote_count: p.count,
      protocol: p.protocol || null
    })
  }).then(r => r.json()).then(d => {
    if (Array.isArray(d) && d.length) { toast('Rule added: ' + p.original + ' → ' + p.corrected); loadRules(); }
    else { toast('Failed to add rule', true); }
  }).catch(e => toast(e.message, true));
}

// ── Claude-Powered Analysis ──────────────────────────────────────────────────
let claudeRecs = [];

function renderRecCard(rec, i) {
  var confColor = rec.confidence === 'high' ? '#4ade80' : rec.confidence === 'medium' ? '#fbbf24' : '#f87171';
  var saColor = rec.source_agreement === 'agree' ? '#4ade80' : rec.source_agreement === 'mixed' ? '#fbbf24' : '#f87171';
  var saLabel = rec.source_agreement === 'agree' ? 'Agree' : rec.source_agreement === 'mixed' ? 'Mixed' : 'Disagree';
  var recProto = rec.protocol ? ' <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,0.12);color:#818cf8">' + rec.protocol + '</span>' : '';
  return '<div class="claude-rec-card" data-rec-idx="' + i + '" style="border:1px solid rgba(0,212,184,0.15);border-radius:8px;overflow:hidden;margin-bottom:6px">' +
    '<div onclick="toggleRecCard(this)" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;background:rgba(0,212,184,0.04)">' +
      '<span style="font-size:11px;color:var(--text)"><span style="color:var(--teal);font-weight:600;margin-right:4px">&#x1F9E0;</span>' + (rec.original_type||'?') + ' -> <span style="color:var(--teal);font-weight:700">' + (rec.corrected_type||'?') + '</span>' + recProto + '</span>' +
      '<div style="display:flex;gap:4px;align-items:center">' +
        '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + saColor + '22;color:' + saColor + ';font-weight:600">' + saLabel + '</span>' +
        '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + confColor + '22;color:' + confColor + ';font-weight:600;text-transform:uppercase">' + (rec.confidence||'?') + '</span>' +
        '<span class="rec-arrow" style="font-size:10px;color:var(--muted);transition:transform .2s">&#x25B8;</span>' +
      '</div>' +
    '</div>' +
    '<div class="rec-detail" style="max-height:0;overflow:hidden;transition:max-height .25s ease,padding .25s ease;padding:0 12px">' +
      '<div style="padding:8px 0">' +
        '<div style="font-size:10px;color:var(--muted);margin-bottom:4px">' + (rec.reasoning||'') + '</div>' +
        (rec.corrected_koinly ? '<div style="font-size:10px;margin-bottom:4px">Koinly: <span style="color:var(--teal);font-weight:600">' + rec.corrected_koinly + '</span>' + (rec.secondaryKoinly ? ' <span style="color:#fbbf24">+ ' + rec.secondaryKoinly + '</span>' : '') + '</div>' : '') +
        (rec.matching_hint ? '<div style="font-size:9px;color:#64748b;font-style:italic;margin-bottom:4px">Pattern: ' + rec.matching_hint + '</div>' : '') +
        (rec.review_notes ? '<div style="font-size:9px;color:#94a3b8;margin-bottom:4px">Note: ' + rec.review_notes + '</div>' : '') +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
          '<button onclick="applyClaudeRec(' + i + ')" style="font-size:10px;padding:3px 10px;border-radius:5px;border:1px solid rgba(0,212,184,0.3);background:rgba(0,212,184,0.08);color:var(--teal);cursor:pointer;font-weight:600">Apply Rule</button>' +
          '<button onclick="dismissRecCard(' + i + ')" style="font-size:10px;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--muted);cursor:pointer">Dismiss</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function toggleRecCard(header) {
  var detail = header.nextElementSibling;
  var arrow = header.querySelector('.rec-arrow');
  if (detail.style.maxHeight === '0px' || detail.style.maxHeight === '0') {
    detail.style.maxHeight = '300px';
    detail.style.padding = '0 12px';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
  } else {
    detail.style.maxHeight = '0';
    detail.style.padding = '0 12px';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

function renderRecSection(containerId, recs) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (!recs.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = '<div style="padding:10px 12px 4px;font-size:10px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:0.5px">Claude Suggestions (' + recs.length + ')</div>' +
    '<div style="padding:4px 12px 10px">' + recs.map(function(r) { return renderRecCard(r.rec, r.idx); }).join('') + '</div>';
}

async function analyzeWithClaude() {
  const btn = document.getElementById('analyze-btn');
  btn.disabled = true; btn.textContent = 'Analyzing...';
  try {
    var patterns = [];
    if (correctionPatterns.length) {
      patterns = correctionPatterns.slice(0, 15).map(p => ({
        original: p.original,
        corrected: p.corrected,
        count: p.count,
        protocol: p.protocol || null,
        sampleReasonings: p.sampleReasonings || [],
        sampleFunctions: p.sampleFunctions || [],
        sampleEvents: p.sampleEvents || []
      }));
    }
    if (allFeedback.length) {
      var voteMap = {};
      allFeedback.forEach(function(f) {
        var key = (f.tx_type || 'unknown') + (f.protocol ? ':' + f.protocol : '');
        if (!voteMap[key]) voteMap[key] = { type: f.tx_type || 'unknown', protocol: f.protocol || null, up: 0, down: 0, total: 0, reasonings: [], koinly: f.koinly_action || '', taxable: f.taxable, functions: [], events: [] };
        voteMap[key].total++;
        if (f.vote === 'up') voteMap[key].up++;
        if (f.vote === 'down') voteMap[key].down++;
        if (f.reasoning && voteMap[key].reasonings.length < 2) voteMap[key].reasonings.push(f.reasoning);
        if (f.function_name && voteMap[key].functions.indexOf(f.function_name) < 0 && voteMap[key].functions.length < 3) voteMap[key].functions.push(f.function_name);
        if (f.event_names && Array.isArray(f.event_names)) f.event_names.forEach(function(e) { if (voteMap[key].events.indexOf(e) < 0 && voteMap[key].events.length < 5) voteMap[key].events.push(e); });
      });
      Object.values(voteMap).filter(function(v) { return v.down > 0 || v.total >= 2; }).sort(function(a,b) { return (a.up/a.total) - (b.up/b.total); }).slice(0, 10).forEach(function(v) {
        if (patterns.some(function(p) { return p.original === v.type; })) return;
        patterns.push({
          original: v.type,
          corrected: '(review needed - ' + v.down + ' thumbs down / ' + v.total + ' total)',
          count: v.total,
          protocol: v.protocol,
          sampleReasonings: v.reasonings,
          sampleFunctions: v.functions,
          sampleEvents: v.events,
          votePattern: true,
          approval: Math.round(v.up / v.total * 100) + '%',
          koinlyAction: v.koinly
        });
      });
    }
    if (!patterns.length) { toast('No feedback data to analyze', true); btn.disabled = false; btn.textContent = 'Analyze with Claude'; return; }
    const r = await fetch('/proxy/analyze-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patterns })
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error + (d.rawText ? ' | Raw: ' + d.rawText.substring(0,100) : ''));
    const recs = d.recommendations || [];
    claudeRecs = recs;
    if (!recs.length) { toast('Claude found no actionable patterns'); btn.disabled = false; btn.textContent = 'Analyze with Claude'; return; }

    // Build sets of known types in each section for matching
    var corrTypes = new Set();
    correctionPatterns.forEach(function(p) { corrTypes.add((p.original || '').toLowerCase()); });
    var worstTypes = new Set();
    document.querySelectorAll('#fb-worst > div').forEach(function(d) {
      var span = d.querySelector('span');
      if (span) worstTypes.add(span.textContent.trim().toLowerCase());
    });

    // Distribute recs to sections
    var patternRecs = [], worstRecs = [], correctionRecs = [];
    recs.forEach(function(rec, i) {
      var origLower = (rec.original_type || '').toLowerCase();
      if (corrTypes.has(origLower)) {
        patternRecs.push({ rec: rec, idx: i });
      } else if (worstTypes.has(origLower)) {
        worstRecs.push({ rec: rec, idx: i });
      } else {
        correctionRecs.push({ rec: rec, idx: i });
      }
    });

    // If no correction patterns matched, put unmatched in patterns section
    if (!patternRecs.length && correctionRecs.length) {
      patternRecs = correctionRecs;
      correctionRecs = [];
    }

    renderRecSection('claude-recs-patterns', patternRecs);
    renderRecSection('claude-recs-worst', worstRecs);
    renderRecSection('claude-recs-corrections', correctionRecs);

    var total = patternRecs.length + worstRecs.length + correctionRecs.length;
    toast(total + ' suggestion' + (total !== 1 ? 's' : '') + ' distributed across sections');
  } catch(e) {
    toast('Claude analysis failed: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Analyze with Claude';
  }
}

async function applyClaudeRec(idx) {
  const rec = claudeRecs[idx];
  if (!rec) return;
  const koinlyLabel = rec.corrected_koinly + (rec.secondaryKoinly ? ' + ' + rec.secondaryKoinly : '');
  const protoLabel = rec.protocol ? ' [' + rec.protocol + ']' : '';
  if (!confirm('Add rule: "' + rec.original_type + '" -> "' + rec.corrected_type + '" (Koinly: ' + koinlyLabel + ')' + protoLabel + '?\\nThis will be stored in the knowledge bank.')) return;
  try {
    const criteria = {};
    if (rec.secondaryKoinly) criteria.secondaryKoinly = rec.secondaryKoinly;
    if (rec.matching_hint) criteria.matching_hint = rec.matching_hint;
    const r = await fetch('/proxy/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_type: rec.original_type,
        corrected_type: rec.corrected_type,
        corrected_koinly: rec.corrected_koinly || rec.corrected_type,
        vote_count: 0,
        created_by: 'claude-analysis',
        protocol: rec.protocol || null,
        matching_criteria: Object.keys(criteria).length ? criteria : null
      })
    });
    const d = await r.json();
    toast('Rule applied: ' + rec.original_type + ' -> ' + rec.corrected_type);
    var card = document.querySelector('.claude-rec-card[data-rec-idx="' + idx + '"]');
    if (card) card.remove();
    loadRules();
  } catch(e) { toast(e.message, true); }
}

function dismissRecCard(idx) {
  var card = document.querySelector('.claude-rec-card[data-rec-idx="' + idx + '"]');
  if (card) card.remove();
}

function dismissRec(btn) {
  var card = btn.closest('.claude-rec-card');
  if (card) card.remove();
}

// ── Claude TX Review ─────────────────────────────────────────────────────────
let reviewVerdicts = [];

async function batchReviewTxns() {
  var btn = document.getElementById('batch-review-btn');
  var prog = document.getElementById('review-progress');
  btn.disabled = true; btn.textContent = 'Reviewing...';
  prog.textContent = '';
  try {
    // Gather disputed txns: thumbs-down, low confidence, or user corrections
    var candidates = allFeedback.filter(function(f) {
      return f.vote === 'down' || (f.confidence != null && f.confidence < 70);
    });
    // Dedup by tx_hash
    var seen = {};
    var deduped = [];
    candidates.forEach(function(f) {
      if (f.tx_hash && !seen[f.tx_hash]) {
        seen[f.tx_hash] = true;
        deduped.push(f);
      }
    });
    // Sort: thumbs-down first, then lowest confidence
    deduped.sort(function(a, b) {
      if (a.vote === 'down' && b.vote !== 'down') return -1;
      if (b.vote === 'down' && a.vote !== 'down') return 1;
      return (a.confidence || 100) - (b.confidence || 100);
    });
    var batch = deduped.slice(0, 15);
    if (!batch.length) { toast('No disputed transactions to review'); btn.disabled = false; btn.textContent = 'Run Batch Review'; return; }
    prog.textContent = 'Reviewing ' + batch.length + ' txns...';

    var r = await fetch('/proxy/review-txns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txns: batch })
    });
    var d = await r.json();
    if (d.error) throw new Error(d.error + (d.rawText ? ' | Raw: ' + d.rawText.substring(0,100) : ''));
    reviewVerdicts = (d.verdicts || []).map(function(v, i) {
      v._feedback = batch[i] || {};
      return v;
    });
    renderReviewVerdicts();
    // Auto-open the accordion
    var panel = document.getElementById('review-verdicts').closest('.accordion');
    if (panel) panel.classList.remove('closed');
    prog.textContent = reviewVerdicts.length + ' verdict' + (reviewVerdicts.length !== 1 ? 's' : '');
  } catch(e) {
    toast('Batch review failed: ' + e.message, true);
    prog.textContent = '';
  } finally {
    btn.disabled = false; btn.textContent = 'Run Batch Review';
  }
}

function renderReviewVerdicts() {
  var el = document.getElementById('review-verdicts');
  if (!reviewVerdicts.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px">No verdicts.</div>';
    return;
  }
  el.innerHTML = reviewVerdicts.map(function(v, i) {
    var fb = v._feedback || {};
    var vColor = v.verdict === 'agree_classification' ? '#4ade80' : v.verdict === 'agree_user' ? '#60a5fa' : '#fbbf24';
    var vLabel = v.verdict === 'agree_classification' ? 'AGREES' : v.verdict === 'agree_user' ? 'AGREES WITH USER' : 'NEW SUGGESTION';
    var confColor = v.confidence === 'high' ? '#4ade80' : v.confidence === 'medium' ? '#fbbf24' : '#f87171';
    var hashShort = (v.tx_hash || fb.tx_hash || '?').slice(0, 6) + '...' + (v.tx_hash || fb.tx_hash || '?').slice(-4);
    var chain = fb.chain || '?';
    var explorerLink = explorerUrl(chain, fb.tx_hash || v.tx_hash || '');
    var userAction = fb.vote === 'down' ? (fb.user_comment || 'Thumbs down') : 'Thumbs up';

    return '<div class="claude-rec-card" data-review-idx="' + i + '" style="border:1px solid rgba(168,85,247,0.15);border-radius:8px;overflow:hidden;margin-bottom:6px">' +
      '<div onclick="toggleRecCard(this)" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;background:rgba(168,85,247,0.04)">' +
        '<span style="font-size:11px;color:var(--text)">' +
          '<a href="' + explorerLink + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#60a5fa;text-decoration:none;font-family:monospace;font-size:10px">' + hashShort + '</a>' +
          ' <span style="font-size:9px;color:var(--muted)">(' + chain + ')</span> ' +
          (fb.tx_type || v.corrected_type || '?') +
        '</span>' +
        '<div style="display:flex;gap:4px;align-items:center">' +
          '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + vColor + '22;color:' + vColor + ';font-weight:700">' + vLabel + '</span>' +
          '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + confColor + '22;color:' + confColor + ';font-weight:600;text-transform:uppercase">' + (v.confidence || '?') + '</span>' +
          '<span class="rec-arrow" style="font-size:10px;color:var(--muted);transition:transform .2s">&#x25B8;</span>' +
        '</div>' +
      '</div>' +
      '<div class="rec-detail" style="max-height:0;overflow:hidden;transition:max-height .25s ease,padding .25s ease;padding:0 12px">' +
        '<div style="padding:8px 0">' +
          '<div style="display:flex;gap:16px;font-size:10px;margin-bottom:6px">' +
            '<div>Current: <span style="font-weight:600">' + (fb.tx_type || '?') + '</span> (' + (fb.confidence || '?') + '%)</div>' +
            '<div>User: <span style="font-weight:600">' + userAction + '</span></div>' +
          '</div>' +
          '<div style="font-size:10px;margin-bottom:4px">Claude verdict: <span style="color:' + vColor + ';font-weight:700">' + (v.corrected_type || '?') + '</span>' +
            ' | Koinly: <span style="color:var(--teal);font-weight:600">' + (v.corrected_koinly || '?') + '</span></div>' +
          '<div style="font-size:10px;color:var(--muted);margin-bottom:4px">' + (v.reasoning || '') + '</div>' +
          (v.review_notes ? '<div style="font-size:9px;color:#94a3b8;margin-bottom:4px">Note: ' + v.review_notes + '</div>' : '') +
          (v.verdict !== 'agree_classification' ? '<div style="display:flex;gap:6px;margin-top:6px">' +
            '<button onclick="applyReviewVerdict(' + i + ')" style="font-size:10px;padding:3px 10px;border-radius:5px;border:1px solid rgba(168,85,247,0.3);background:rgba(168,85,247,0.08);color:#a855f7;cursor:pointer;font-weight:600">Apply Rule</button>' +
            '<button onclick="dismissReviewVerdict(' + i + ')" style="font-size:10px;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--muted);cursor:pointer">Dismiss</button>' +
          '</div>' : '<div style="font-size:10px;color:#4ade80;margin-top:4px">No action needed — classification is correct.</div>') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function applyReviewVerdict(idx) {
  var v = reviewVerdicts[idx];
  if (!v) return;
  var fb = v._feedback || {};
  if (!confirm('Add rule: "' + (fb.tx_type || '?') + '" -> "' + (v.corrected_type || '?') + '" (Koinly: ' + (v.corrected_koinly || '?') + ')?\\nBased on Claude TX Review.')) return;
  try {
    var r = await fetch('/proxy/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_type: fb.tx_type || v.corrected_type,
        corrected_type: v.corrected_type,
        corrected_koinly: v.corrected_koinly || v.corrected_type,
        vote_count: 0,
        created_by: 'claude-tx-review',
        protocol: fb.protocol || null
      })
    });
    var d = await r.json();
    toast('Rule applied: ' + (fb.tx_type || '?') + ' -> ' + v.corrected_type);
    var card = document.querySelector('.claude-rec-card[data-review-idx="' + idx + '"]');
    if (card) card.remove();
    loadRules();
  } catch(e) { toast(e.message, true); }
}

function dismissReviewVerdict(idx) {
  var card = document.querySelector('.claude-rec-card[data-review-idx="' + idx + '"]');
  if (card) card.remove();
}

async function reviewSingleTx(idx) {
  var f = allFeedback[idx];
  if (!f) return;
  var btn = document.querySelector('button[data-review-fb="' + idx + '"]');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    var r = await fetch('/proxy/review-txns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txns: [f] })
    });
    var d = await r.json();
    if (d.error) throw new Error(d.error);
    var v = (d.verdicts || [])[0];
    if (!v) throw new Error('No verdict returned');
    var vColor = v.verdict === 'agree_classification' ? '#4ade80' : v.verdict === 'agree_user' ? '#60a5fa' : '#fbbf24';
    var vLabel = v.verdict === 'agree_classification' ? 'AGREES' : v.verdict === 'agree_user' ? 'AGREES WITH USER' : 'NEW SUGGESTION';
    // Insert verdict row after the feedback row
    var row = document.querySelector('tr[data-fb-idx="' + idx + '"]');
    if (row) {
      var detailRow = document.createElement('tr');
      detailRow.innerHTML = '<td colspan="9" style="padding:8px 16px;background:rgba(168,85,247,0.04);border-top:1px solid rgba(168,85,247,0.1)">' +
        '<div style="font-size:10px"><span style="font-weight:700;color:' + vColor + '">' + vLabel + '</span> ' +
        '— ' + (v.corrected_type || '?') + ' | Koinly: <span style="color:var(--teal)">' + (v.corrected_koinly || '?') + '</span></div>' +
        '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + (v.reasoning || '') + '</div>' +
      '</td>';
      row.parentNode.insertBefore(detailRow, row.nextSibling);
    }
  } catch(e) { toast('Review failed: ' + e.message, true); }
  if (btn) { btn.disabled = false; btn.textContent = 'Review'; }
}

// ── Active Rules (Knowledge Bank) ────────────────────────────────────────────
async function loadRules() {
  const tbody = document.getElementById('rules-tbody');
  try {
    const r = await fetch('/proxy/rules');
    const rules = await r.json();
    const active = Array.isArray(rules) ? rules.filter(r => r.active) : [];
    document.getElementById('rules-count').textContent = active.length ? '(' + active.length + ' active)' : '';

    if (!active.length) {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="8" style="color:var(--muted)">No rules yet — analyze feedback to generate recommendations.</td></tr>';
      return;
    }
    tbody.innerHTML = active.map(rule => {
      const protoBadge = rule.protocol ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,0.12);color:#818cf8">' + rule.protocol + '</span>' : '<span style="color:var(--muted);font-size:10px">all</span>';
      return '<tr>' +
        '<td style="font-weight:600">' + rule.original_type + '</td>' +
        '<td style="color:var(--muted)">→</td>' +
        '<td style="color:var(--teal);font-weight:600">' + rule.corrected_type + '</td>' +
        '<td>' + protoBadge + '</td>' +
        '<td style="font-family:monospace;font-size:10px;color:var(--teal)">' + (rule.corrected_koinly || '—') + '</td>' +
        '<td>' + (rule.vote_count || 0) + '</td>' +
        '<td style="color:var(--muted);font-size:10px">' + timeAgo(rule.created_at) + '</td>' +
        '<td><button data-rule-id="' + rule.id + '" onclick="deleteRule(this.dataset.ruleId)" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid rgba(248,113,113,0.2);background:none;color:var(--red);cursor:pointer">Remove</button></td>' +
      '</tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8" style="color:var(--red)">⚠ ' + e.message + '</td></tr>';
  }
}

async function deleteRule(ruleId) {
  if (!confirm('Remove this rule from the knowledge bank?')) return;
  try {
    await fetch('/proxy/rules/' + ruleId, { method: 'DELETE' });
    toast('Rule removed');
    loadRules();
  } catch(e) { toast(e.message, true); }
}

// ── Permissions display in user table ─────────────────────────────────────────
const TIER_PERMS_CLIENT = {
  anonymous: { tx_limit: 3,        batch_analyzer: false, api_access: false },
  free:      { tx_limit: 10,       batch_analyzer: false, api_access: false },
  starter:   { tx_limit: 250,      batch_analyzer: true,  api_access: false },
  pro:       { tx_limit: 2500,     batch_analyzer: true,  api_access: true  },
  cpa:       { tx_limit: 'Unlimited', batch_analyzer: true, api_access: true },
  admin:     { tx_limit: 'Unlimited', batch_analyzer: true, api_access: true },
};

// ── Settings / proxy status check ─────────────────────────────────────────────
async function checkProxyStatus() {
  const proxyEl = document.getElementById('proxy-status');
  const srkEl   = document.getElementById('srk-status');
  try {
    const r = await fetch('/proxy/list-users');
    const d = await r.json();
    if (r.ok && d.users) {
      proxyEl.textContent = '✓ Working (' + d.users.length + ' users)';
      proxyEl.style.color = 'var(--green)';
      srkEl.textContent = '✓ Configured';
      srkEl.style.color = 'var(--green)';
    } else {
      throw new Error(d.error || 'HTTP ' + r.status);
    }
  } catch(e) {
    proxyEl.textContent = '✗ ' + e.message;
    proxyEl.style.color = 'var(--red)';
    srkEl.textContent = '✗ Check Worker env vars';
    srkEl.style.color = 'var(--red)';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EXPLORERS = { ethereum:'https://etherscan.io/tx/', polygon:'https://polygonscan.com/tx/', arbitrum:'https://arbiscan.io/tx/', optimism:'https://optimistic.etherscan.io/tx/', base:'https://basescan.org/tx/', bsc:'https://bscscan.com/tx/', avalanche:'https://snowtrace.io/tx/', solana:'https://solscan.io/tx/' };
function explorerUrl(chain, hash) { return (EXPLORERS[(chain||'').toLowerCase()] || 'https://etherscan.io/tx/') + hash; }

function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
</script>
</body>
</html>`;
