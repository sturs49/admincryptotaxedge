const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin · Crypto Tax Edge</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<style>
  :root {
    --bg:       #0e1340;
    --bg2:      #111847;
    --bg3:      #162055;
    --border:   rgba(0,212,184,0.15);
    --teal:     #00c9b1;
    --blue:     #3b82f6;
    --red:      #f87171;
    --yellow:   #fbbf24;
    --green:    #4ade80;
    --text:     #e2e8f0;
    --muted:    #64748b;
    --muted2:   #1e293b;
    --body:     'DM Sans', sans-serif;
    --sans:     'Plus Jakarta Sans', sans-serif;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:var(--body); font-size:13px; min-height:100vh; overflow-x:hidden; }
  body::before {
    content:''; position:fixed; inset:0;
    background-image: linear-gradient(rgba(0,212,184,0.03) 1px,transparent 1px), linear-gradient(90deg,rgba(0,212,184,0.03) 1px,transparent 1px);
    background-size:40px 40px; pointer-events:none; z-index:0;
  }

  /* ── Login ── */
  #login-screen { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:100; background:var(--bg); }
  #login-screen::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 60% 50% at 50% 50%,rgba(0,212,184,0.06) 0%,transparent 70%); }
  .login-box { position:relative; width:380px; background:var(--bg2); border:1px solid var(--border); border-radius:16px; padding:40px; box-shadow:0 32px 80px rgba(0,0,0,0.8); animation:fadeUp 0.4s ease; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .login-logo { display:flex; align-items:center; gap:12px; margin-bottom:32px; }
  .login-brand { font-family:var(--sans); font-size:20px; font-weight:700; color:#fff; letter-spacing:-0.02em; }
  .login-brand span { color:var(--teal); }
  .login-sub { font-size:10px; color:var(--muted); letter-spacing:0.15em; text-transform:uppercase; margin-top:2px; }
  .login-title { font-family:var(--sans); font-size:15px; font-weight:700; color:var(--muted); margin-bottom:20px; }
  .login-field { margin-bottom:14px; }
  .login-field label { display:block; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px; }
  .login-field input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.04); border:1px solid rgba(0,212,184,0.2); border-radius:8px; color:var(--text); font-family:var(--body); font-size:13px; outline:none; transition:border-color 0.2s; }
  .login-field input:focus { border-color:var(--teal); }
  .login-btn { width:100%; margin-top:6px; padding:12px; background:var(--teal); border:none; border-radius:8px; color:#0e1340; font-family:var(--sans); font-size:14px; font-weight:700; cursor:pointer; transition:opacity 0.2s,transform 0.1s; }
  .login-btn:hover { opacity:0.9; transform:scale(1.01); }
  .login-btn:disabled { opacity:0.5; cursor:wait; }
  .login-err { color:var(--red); font-size:11px; margin-top:10px; text-align:center; min-height:16px; }

  /* ── Layout ── */
  #app { display:none; position:relative; z-index:1; min-height:100vh; }
  .sidebar { position:fixed; top:0; left:0; bottom:0; width:220px; background:var(--bg2); border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:50; }
  .sidebar-logo { padding:20px 18px 16px; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; align-items:center; gap:10px; }
  .sidebar-brand { font-family:var(--sans); font-size:13px; font-weight:700; color:#fff; line-height:1.2; letter-spacing:-0.01em; }
  .sidebar-brand span { color:var(--teal); }
  .sidebar-role { margin:12px 18px; padding:6px 10px; background:rgba(0,212,184,0.08); border:1px solid rgba(0,212,184,0.2); border-radius:6px; font-size:10px; color:var(--teal); display:flex; align-items:center; gap:6px; }
  .sidebar-role::before { content:''; width:6px; height:6px; border-radius:50%; background:var(--teal); box-shadow:0 0 6px var(--teal); flex-shrink:0; }
  nav { flex:1; padding:8px 10px; overflow-y:auto; }
  .nav-section { font-size:9px; color:var(--muted2); text-transform:uppercase; letter-spacing:0.12em; padding:14px 8px 6px; }
  .nav-item { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:7px; cursor:pointer; font-size:12px; color:var(--muted); transition:background 0.15s,color 0.15s; margin-bottom:1px; border:none; background:none; width:100%; text-align:left; font-family:var(--body); }
  .nav-item:hover { background:rgba(255,255,255,0.04); color:var(--text); }
  .nav-item.active { background:rgba(0,212,184,0.1); color:var(--teal); border:1px solid rgba(0,212,184,0.15); }
  .nav-icon { font-size:14px; width:18px; text-align:center; flex-shrink:0; }
  .sidebar-footer { padding:14px 18px; border-top:1px solid rgba(255,255,255,0.04); font-size:10px; color:var(--muted2); }

  .main { margin-left:220px; padding:28px 32px; min-height:100vh; }
  .topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; }
  .page-title { font-family:var(--sans); font-size:22px; font-weight:700; color:#fff; letter-spacing:-0.02em; }
  .page-title span { color:var(--teal); }
  .topbar-right { display:flex; align-items:center; gap:12px; }
  .admin-badge { padding:5px 12px; background:linear-gradient(135deg,rgba(0,212,184,0.15),rgba(59,130,246,0.15)); border:1px solid rgba(0,212,184,0.3); border-radius:20px; font-size:11px; color:var(--teal); font-weight:700; }

  /* ── Stat cards ── */
  .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:28px; }
  .stat-card { background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:18px 20px; position:relative; overflow:hidden; transition:border-color 0.2s,transform 0.2s; }
  .stat-card:hover { border-color:rgba(0,212,184,0.35); transform:translateY(-2px); }
  .stat-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; }
  .stat-value { font-family:var(--sans); font-size:28px; font-weight:700; color:#fff; line-height:1; letter-spacing:-0.03em; }
  .stat-value.teal { color:var(--teal); }
  .stat-value.blue { color:var(--blue); }
  .stat-value.green { color:var(--green); }
  .stat-value.yellow { color:var(--yellow); }
  .stat-delta { font-size:10px; margin-top:6px; }
  .stat-delta.up { color:var(--green); }

  /* ── Panels ── */
  .panel-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
  .panel { background:var(--bg2); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  .panel.full { grid-column:1 / -1; }
  .panel-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.01); }
  .panel-title { font-family:var(--sans); font-size:13px; font-weight:600; color:#fff; letter-spacing:-0.01em; }
  .panel-body { padding:18px; }

  /* ── User table ── */
  .user-table { width:100%; border-collapse:collapse; }
  .user-table th { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:0.1em; padding:8px 12px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.05); }
  .user-table td { padding:10px 12px; font-size:12px; color:var(--text); border-bottom:1px solid rgba(255,255,255,0.03); vertical-align:middle; }
  .user-table tr:last-child td { border-bottom:none; }
  .user-table tr:hover td { background:rgba(255,255,255,0.02); }
  .tier-badge { display:inline-block; padding:2px 9px; border-radius:20px; font-size:10px; font-weight:700; border:1px solid; }
  .tier-free    { color:#64748b; border-color:#334155; background:rgba(100,116,139,0.1); }
  .tier-starter { color:#60a5fa; border-color:rgba(96,165,250,0.3); background:rgba(96,165,250,0.08); }
  .tier-pro     { color:#a78bfa; border-color:rgba(167,139,250,0.3); background:rgba(167,139,250,0.08); }
  .tier-cpa     { color:var(--teal); border-color:rgba(0,212,184,0.3); background:rgba(0,212,184,0.08); }
  .tier-admin   { color:var(--yellow); border-color:rgba(251,191,36,0.3); background:rgba(251,191,36,0.1); }
  .tier-anonymous { color:#475569; border-color:#334155; background:rgba(71,85,105,0.1); }
  .action-btn { padding:4px 10px; border-radius:5px; font-size:10px; cursor:pointer; font-family:var(--body); border:1px solid; transition:opacity 0.15s; background:none; }
  .action-btn:hover { opacity:0.7; }
  .action-btn:disabled { opacity:0.3; cursor:not-allowed; }
  .btn-upgrade { color:var(--teal); border-color:rgba(0,212,184,0.3); }
  .btn-downgrade { color:var(--yellow); border-color:rgba(251,191,36,0.3); }
  .btn-revoke  { color:var(--red); border-color:rgba(248,113,113,0.3); }
  .btn-edit    { color:var(--blue); border-color:rgba(59,130,246,0.3); }

  /* ── Access rows ── */
  .access-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
  .access-row:last-child { border-bottom:none; }
  .access-label { font-size:12px; color:var(--muted); }
  .access-val { font-size:12px; color:#fff; font-weight:700; }
  .access-val.teal { color:var(--teal); }
  .access-val.green { color:var(--green); }

  /* ── Feed ── */
  .feed-item { display:flex; align-items:flex-start; gap:10px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,0.03); font-size:11px; }
  .feed-item:last-child { border-bottom:none; }
  .feed-dot { width:7px; height:7px; border-radius:50%; margin-top:3px; flex-shrink:0; }
  .feed-text { color:var(--text); line-height:1.4; flex:1; }
  .feed-text span { color:var(--teal); }
  .feed-time { color:var(--muted); font-size:10px; white-space:nowrap; }

  /* ── Key display ── */
  .key-display { display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); border-radius:7px; margin-bottom:10px; }
  .key-val { flex:1; font-size:11px; color:var(--muted); word-break:break-all; }
  .key-copy { padding:4px 10px; border-radius:5px; font-size:10px; cursor:pointer; font-family:var(--body); border:1px solid rgba(0,212,184,0.3); color:var(--teal); background:rgba(0,212,184,0.06); transition:background 0.15s; white-space:nowrap; }
  .key-copy:hover { background:rgba(0,212,184,0.14); }

  /* ── Mini chart ── */
  .mini-chart { display:flex; align-items:flex-end; gap:3px; height:48px; }
  .bar-col { flex:1; border-radius:3px 3px 0 0; min-width:8px; }

  /* ── Quick btns ── */
  .quick-btn { display:flex; align-items:center; gap:8px; padding:10px 14px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; cursor:pointer; font-family:var(--body); font-size:11px; color:var(--text); transition:background 0.15s,border-color 0.15s; width:100%; margin-bottom:8px; text-align:left; }
  .quick-btn:hover { background:rgba(0,212,184,0.06); border-color:rgba(0,212,184,0.2); color:var(--teal); }

  /* ── Toast ── */
  .toast { position:fixed; bottom:24px; right:24px; padding:12px 20px; background:var(--bg3); border:1px solid rgba(0,212,184,0.3); border-radius:8px; color:var(--teal); font-size:12px; box-shadow:0 8px 32px rgba(0,0,0,0.6); z-index:999; transform:translateY(80px); opacity:0; transition:transform 0.3s ease,opacity 0.3s ease; max-width:320px; }
  .toast.show { transform:translateY(0); opacity:1; }
  .toast.error { color:var(--red); border-color:rgba(248,113,113,0.3); }

  /* ── Sections ── */
  .section { display:none; }
  .section.active { display:block; }

  /* ── Modal ── */
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:200; display:none; align-items:center; justify-content:center; }
  .modal-overlay.show { display:flex; }
  .modal { background:var(--bg2); border:1px solid var(--border); border-radius:14px; padding:32px; width:420px; animation:fadeUp 0.25s ease; }
  .modal h3 { font-family:var(--sans); font-size:16px; font-weight:700; color:#fff; margin-bottom:20px; }
  .modal-field { margin-bottom:14px; }
  .modal-field label { display:block; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px; }
  .modal-field input, .modal-field select { width:100%; padding:10px 13px; background:rgba(255,255,255,0.04); border:1px solid rgba(0,212,184,0.2); border-radius:7px; color:var(--text); font-family:var(--body); font-size:13px; outline:none; transition:border-color 0.2s; }
  .modal-field input:focus, .modal-field select:focus { border-color:var(--teal); }
  .modal-field select option { background:var(--bg3); color:var(--text); }
  .modal-actions { display:flex; gap:10px; margin-top:20px; }
  .modal-btn { flex:1; padding:11px; border:none; border-radius:8px; font-family:var(--sans); font-size:13px; font-weight:700; cursor:pointer; transition:opacity 0.2s; }
  .modal-btn.primary { background:var(--teal); color:#0e1340; }
  .modal-btn.secondary { background:rgba(255,255,255,0.06); color:var(--muted); }
  .modal-btn:hover { opacity:0.85; }
  .modal-btn:disabled { opacity:0.4; cursor:wait; }
  .modal-err { color:var(--red); font-size:11px; margin-top:8px; min-height:16px; }

  /* ── Loading state ── */
  .loading-row td { text-align:center; color:var(--muted); padding:24px !important; }
  .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(0,212,184,0.2); border-top-color:var(--teal); border-radius:50%; animation:spin 0.7s linear infinite; vertical-align:middle; margin-right:6px; }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* ── Search bar ── */
  .search-bar { padding:8px 13px; background:rgba(255,255,255,0.04); border:1px solid rgba(0,212,184,0.15); border-radius:7px; color:var(--text); font-family:var(--body); font-size:12px; outline:none; transition:border-color 0.2s; width:240px; }
  .search-bar:focus { border-color:var(--teal); }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--muted2); border-radius:3px; }

  @media (max-width:900px) {
    .stat-grid { grid-template-columns:repeat(2,1fr); }
    .panel-grid { grid-template-columns:1fr; }
    .sidebar { width:60px; }
    .sidebar .nav-item span, .sidebar-role, .sidebar-brand, .sidebar-footer, .nav-section { display:none; }
    .main { margin-left:60px; padding:20px; }
  }
</style>
</head>
<body>

<!-- ── LOGIN ── -->
<div id="login-screen">
  <div class="login-box">
    <div class="login-logo">
      <div>
        <div class="login-brand">Crypto Tax<span>Edge</span></div>
        <div class="login-sub">Admin Console</div>
      </div>
    </div>
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

<!-- ── APP ── -->
<div id="app">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div>
        <div class="sidebar-brand">Crypto Tax<span>Edge</span></div>
      </div>
    </div>
    <div class="sidebar-role">ADMIN CONSOLE</div>
    <nav>
      <div class="nav-section">Main</div>
      <button class="nav-item active" onclick="showSection('overview',this)"><span class="nav-icon">◈</span><span>Overview</span></button>
      <button class="nav-item" onclick="showSection('users',this)"><span class="nav-icon">👥</span><span>Users</span></button>
      <button class="nav-item" onclick="showSection('activity',this)"><span class="nav-icon">⚡</span><span>Activity Log</span></button>
      <div class="nav-section">Account</div>
      <button class="nav-item" onclick="showSection('access',this)"><span class="nav-icon">🔑</span><span>My Access</span></button>
      <button class="nav-item" onclick="showSection('api',this)"><span class="nav-icon">⚙</span><span>API Keys</span></button>
      <div class="nav-section">Tools</div>
      <button class="nav-item" onclick="showSection('batch',this)"><span class="nav-icon">🛠</span><span>Tools & Usage</span></button>
      <button class="nav-item" onclick="showSection('settings',this)"><span class="nav-icon">⊞</span><span>Settings</span></button>
    </nav>
    <div class="sidebar-footer">v5.3 · <span id="topbar-time"></span></div>
  </aside>

  <!-- Main -->
  <main class="main">
    <div class="topbar">
      <div class="page-title" id="page-title">Dashboard <span>Overview</span></div>
      <div class="topbar-right">
        <span class="admin-badge">⬡ ADMIN</span>
        <span id="admin-email-badge" style="font-size:11px;color:var(--muted)"></span>
        <button onclick="doLogout()" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(248,113,113,0.3);background:none;color:var(--red);font-size:11px;cursor:pointer;font-family:var(--body)">Sign Out</button>
      </div>
    </div>

    <!-- ── OVERVIEW ── -->
    <div class="section active" id="section-overview">
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total Users</div>
          <div class="stat-value teal" id="stat-users">—</div>
          <div class="stat-delta up" id="stat-users-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Paying Users</div>
          <div class="stat-value blue" id="stat-paying">—</div>
          <div class="stat-delta up" id="stat-paying-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Free Users</div>
          <div class="stat-value green" id="stat-free">—</div>
          <div class="stat-delta up" id="stat-free-d"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Admin Users</div>
          <div class="stat-value yellow" id="stat-admin">—</div>
          <div class="stat-delta up" id="stat-admin-d"></div>
        </div>
      </div>

      <div class="panel-grid">
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">Plan Distribution</div>
            <button onclick="loadStats()" style="font-size:10px;padding:3px 9px;border-radius:5px;border:1px solid rgba(0,212,184,0.2);background:none;color:var(--teal);cursor:pointer">↺ Refresh</button>
          </div>
          <div class="panel-body" id="plan-dist" style="display:flex;flex-direction:column;gap:12px"></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Recent Signups</div></div>
          <div class="panel-body" id="recent-signups" style="font-size:11px;display:flex;flex-direction:column;gap:8px"></div>
        </div>
      </div>
    </div>

    <!-- ── USERS ── -->
    <div class="section" id="section-users">
      <div class="panel full">
        <div class="panel-head">
          <div class="panel-title">All Users <span id="user-count-badge" style="font-size:10px;color:var(--muted);font-family:var(--body);font-weight:400;margin-left:6px"></span></div>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="search-bar" id="user-search" placeholder="Search email or tier…" oninput="filterUsers()">
            <button class="key-copy" onclick="openAddUserModal()" style="padding:7px 14px;font-size:11px;font-family:var(--sans);font-weight:600">+ Add User</button>
            <button class="key-copy" onclick="loadUsers()" style="padding:7px 12px;font-size:11px">↺</button>
          </div>
        </div>
        <div class="panel-body" style="padding:0;overflow-x:auto">
          <table class="user-table">
            <thead>
              <tr>
                <th>Email</th><th>Plan</th><th>TX Used</th><th>Joined</th><th>Last Sign In</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="user-tbody">
              <tr class="loading-row"><td colspan="6"><span class="spinner"></span>Loading users…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── ACTIVITY ── -->
    <div class="section" id="section-activity">
      <div class="panel full">
        <div class="panel-head">
          <div class="panel-title">Activity Log</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:10px;color:var(--muted)">last 50 auth events</span>
            <button onclick="loadActivity()" style="font-size:10px;padding:3px 9px;border-radius:5px;border:1px solid rgba(0,212,184,0.2);background:none;color:var(--teal);cursor:pointer">↺ Refresh</button>
          </div>
        </div>
        <div class="panel-body" id="full-feed">
          <div style="color:var(--muted);font-size:11px;text-align:center;padding:20px"><span class="spinner"></span>Loading…</div>
        </div>
      </div>
    </div>

    <!-- ── MY ACCESS ── -->
    <div class="section" id="section-access">
      <div class="panel-grid">
        <div class="panel">
          <div class="panel-head"><div class="panel-title">My Account</div></div>
          <div class="panel-body">
            <div class="access-row"><span class="access-label">Email</span><span class="access-val teal" id="my-email">—</span></div>
            <div class="access-row"><span class="access-label">Plan</span><span class="access-val"><span class="tier-badge tier-admin">ADMIN</span></span></div>
            <div class="access-row"><span class="access-label">TX Classifications</span><span class="access-val green">Unlimited</span></div>
            <div class="access-row"><span class="access-label">Claude Model</span><span class="access-val teal">Haiku + Sonnet</span></div>
            <div class="access-row"><span class="access-label">Batch Analyzer</span><span class="access-val green">✓ Enabled</span></div>
            <div class="access-row"><span class="access-label">Export (CSV)</span><span class="access-val green">✓ Unlimited</span></div>
            <div class="access-row"><span class="access-label">API Access</span><span class="access-val green">✓ Full</span></div>
            <div class="access-row"><span class="access-label">Billing</span><span class="access-val teal">Complimentary</span></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Quick Actions</div></div>
          <div class="panel-body">
            <button class="quick-btn" onclick="openAddUserModal()">➕ Add / invite user</button>
            <button class="quick-btn" onclick="grantSelfAdmin()">⭐ Re-grant myself admin</button>
            <button class="quick-btn" onclick="loadUsers();showSection('users',document.querySelector('.nav-item:nth-child(2)'))">👥 Manage all users</button>
            <button class="quick-btn" onclick="toast('Export coming soon')">◈ Export all users CSV</button>
            <button class="quick-btn" onclick="window.open('https://supabase.com/dashboard/project/dnhsufwdyhkwrsdtfgyx/auth/users','_blank')">↗ Open Supabase Auth</button>
            <button class="quick-btn" onclick="window.open('https://cryptotaxedge.com','_blank')">↗ View live site</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── API KEYS ── -->
    <div class="section" id="section-api">
      <div class="panel full">
        <div class="panel-head"><div class="panel-title">API Configuration</div></div>
        <div class="panel-body">
          <div style="margin-bottom:20px">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Anthropic (Claude)</div>
            <div class="key-display">
              <span class="key-val">sk-ant-api03-lthEVb4a••••••••••••••••••UVUpwwAA</span>
              <button class="key-copy" onclick="toast('Rotate key — update in background.js, batch_analyzer_v2.html, popup.js')">⚠ Rotate</button>
            </div>
            <div style="font-size:10px;color:var(--red)">⚠ Key exposed in project notes — rotate immediately</div>
          </div>
          <div style="margin-bottom:20px">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Supabase Anon Key</div>
            <div class="key-display">
              <span class="key-val">sb_publishable_TQztgMqE••••••••joWxqPtG</span>
              <button class="key-copy" onclick="toast('Rotate in Supabase dashboard → Settings → API')">⚠ Rotate</button>
            </div>
            <div style="font-size:10px;color:var(--red)">⚠ Key exposed in project notes — rotate immediately</div>
          </div>
          <div style="margin-bottom:20px">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Noves API</div>
            <div class="key-display">
              <span class="key-val">55V7xeoL3SYHszzj5M</span>
              <button class="key-copy" onclick="copyText('55V7xeoL3SYHszzj5M')">Copy</button>
            </div>
          </div>
          <div style="padding:12px 14px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:8px;font-size:11px;color:#fbbf24;line-height:1.6">
            ⚠ <strong>Security note:</strong> Rotate both exposed keys before any further sharing or CWS submission. Proxy Claude calls through your Cloudflare Worker so the Anthropic key never ships in client code.
          </div>
        </div>
      </div>
    </div>

    <!-- ── TOOLS ── -->
    <div class="section" id="section-batch">

      <!-- Service Role Key input (needed for admin API) -->
      <div id="service-key-banner" style="margin-bottom:18px;padding:14px 18px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);border-radius:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="color:#fbbf24;font-size:13px;flex:1;min-width:200px">⚠ <strong>Service Role Key required</strong> for Create User. Enter once — stored locally only.</span>
        <input id="srk-input" type="password" placeholder="eyJhbGciOiJIUzI1NiIs…" style="flex:2;min-width:220px;padding:7px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;font-family:monospace">
        <button onclick="saveServiceKey()" style="padding:7px 16px;background:var(--teal);color:#0e1340;border:none;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">Save</button>
        <span id="srk-status" style="font-size:11px;color:var(--muted)"></span>
      </div>

      <!-- Extension Usage Stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px">
        <div class="panel" style="padding:16px 20px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Extension Installs</div>
          <div style="font-size:28px;font-weight:700;color:var(--teal)" id="stat-installs">—</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px">active users in Supabase</div>
        </div>
        <div class="panel" style="padding:16px 20px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Total Classifications</div>
          <div style="font-size:28px;font-weight:700;color:var(--blue)" id="stat-total-tx">—</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px">TX classified all-time</div>
        </div>
        <div class="panel" style="padding:16px 20px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Paying Users</div>
          <div style="font-size:28px;font-weight:700;color:var(--yellow)" id="stat-paying">—</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px">starter + pro + cpa</div>
        </div>
        <div class="panel" style="padding:16px 20px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Batch Analyzer</div>
          <div style="font-size:28px;font-weight:700;color:var(--green)" id="stat-batch">Live</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px">open tool below ↓</div>
        </div>
      </div>

      <!-- Tool Cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">🧩 Chrome Extension</div>
            <span style="font-size:10px;color:var(--teal);background:rgba(0,201,177,0.1);padding:3px 8px;border-radius:20px">v5.3</span>
          </div>
          <div class="panel-body" style="font-size:12px;line-height:1.8">
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
              <span style="color:var(--muted)">Classification engine</span><span>Noves + Claude AI</span>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
              <span style="color:var(--muted)">Supported platforms</span><span>Koinly, CoinTracker +10</span>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
              <span style="color:var(--muted)">Auth method</span><span>Email OTP (8-digit)</span>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
              <span style="color:var(--muted)">Free tier limit</span><span>25 TX / month</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--muted)">Blur gate</span><span style="color:var(--teal)">Enabled</span>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div class="panel-title">🔬 Batch Analyzer</div>
            <span style="font-size:10px;color:var(--blue);background:rgba(59,130,246,0.1);padding:3px 8px;border-radius:20px">Admin only</span>
          </div>
          <div class="panel-body" style="font-size:12px;line-height:1.8">
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
              <span style="color:var(--muted)">Input</span><span>Paste TX hashes</span>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
              <span style="color:var(--muted)">Output</span><span>CSV / JSON export</span>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
              <span style="color:var(--muted)">Chains</span><span>ETH, Polygon, Base +</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--muted)">Rate limit</span><span>100 TX / batch</span>
            </div>
          </div>
          <div style="padding:0 16px 16px">
            <button onclick="document.getElementById('batch-embed').style.display='block';this.style.display='none'" style="width:100%;padding:8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:7px;color:var(--blue);font-size:12px;font-weight:600;cursor:pointer">Open Batch Analyzer ↓</button>
          </div>
        </div>
      </div>

      <!-- Batch Analyzer embed (shown on demand, bypasses login) -->
      <div id="batch-embed" style="display:none">
        <div style="border:1px solid var(--border);border-radius:13px;overflow:hidden;background:var(--bg2);height:700px">
          <iframe id="batch-frame" src="batch_analyzer_v2.html#admin-bypass" style="width:100%;height:100%;border:none;display:block" title="Batch Hash Analyzer"></iframe>
        </div>
      </div>
    </div>

    <!-- ── SETTINGS ── -->
    <div class="section" id="section-settings">

      <!-- Deployment: admin.cryptotaxedge.com -->
      <div style="margin-bottom:20px;padding:18px 20px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:12px">
        <div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:12px">🌐 Deploy to admin.cryptotaxedge.com</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.9">
          <strong style="color:var(--text)">Option A — Cloudflare Pages (recommended, free)</strong><br>
          1. Go to <a href="https://dash.cloudflare.com" target="_blank" style="color:var(--teal)">dash.cloudflare.com</a> → <strong>Workers & Pages → Create → Pages → Upload assets</strong><br>
          2. Upload this <code style="background:var(--bg3);padding:1px 5px;border-radius:4px">admin_dashboard_v4.html</code> file (rename to <code style="background:var(--bg3);padding:1px 5px;border-radius:4px">index.html</code> first)<br>
          3. After deploy, go to your Pages project → <strong>Custom domains → Add domain → admin.cryptotaxedge.com</strong><br>
          4. Cloudflare will auto-add the DNS record since you already manage cryptotaxedge.com there.<br><br>
          <strong style="color:var(--text)">Option B — Cloudflare Worker (if you prefer code)</strong><br>
          Add a route <code style="background:var(--bg3);padding:1px 5px;border-radius:4px">admin.cryptotaxedge.com/*</code> in your existing Worker and return this HTML as the response.<br><br>
          <strong style="color:var(--text)">Security tip:</strong> Add a Cloudflare Access rule on <code style="background:var(--bg3);padding:1px 5px;border-radius:4px">admin.cryptotaxedge.com</code> to restrict by email — free for up to 50 users.
        </div>
      </div>

      <div class="panel-grid">
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Extension Settings</div></div>
          <div class="panel-body">
            <div class="access-row"><span class="access-label">Free tier blur gate</span><label><input type="checkbox" checked style="accent-color:var(--teal)"> Enabled</label></div>
            <div class="access-row"><span class="access-label">Flag spam / airdrops</span><label><input type="checkbox" checked style="accent-color:var(--teal)"> Enabled</label></div>
            <div class="access-row"><span class="access-label">Flag DeFi interactions</span><label><input type="checkbox" checked style="accent-color:var(--teal)"> Enabled</label></div>
            <div class="access-row"><span class="access-label">Flag large txs (&gt;$10k)</span><label><input type="checkbox" checked style="accent-color:var(--teal)"> Enabled</label></div>
            <div class="access-row"><span class="access-label">Upgrade CTA URL</span><span class="access-val teal" style="font-size:11px">cryptotaxedge.com</span></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Supabase Connection</div></div>
          <div class="panel-body">
            <div class="access-row"><span class="access-label">Project ID</span><span class="access-val" style="font-size:11px;font-family:monospace">dnhsufwdyhkwrsdtfgyx</span></div>
            <div class="access-row"><span class="access-label">Status</span><span class="access-val green" id="supabase-status">Checking…</span></div>
            <div class="access-row"><span class="access-label">Auth URL</span><span class="access-val teal" style="font-size:10px">supabase.co/auth/v1</span></div>
            <div class="access-row"><span class="access-label">Tier SQL path</span><span class="access-val" style="font-size:10px">auth.users → raw_user_meta_data.tier</span></div>
          </div>
        </div>
      </div>
    </div>

  </main>
</div>

<!-- ── ADD / EDIT USER MODAL ── -->
<div class="modal-overlay" id="user-modal">
  <div class="modal">
    <h3 id="modal-title">Add / Invite User</h3>
    <div class="modal-field">
      <label>Email Address</label>
      <input type="email" id="modal-email" placeholder="user@example.com">
    </div>
    <div class="modal-field">
      <label>Plan / Tier</label>
      <select id="modal-tier">
        <option value="anonymous">Anonymous (Trial)</option>
        <option value="free">Free</option>
        <option value="starter">Starter ($49/mo)</option>
        <option value="pro" selected>Pro ($99/mo)</option>
        <option value="cpa">CPA Firm ($199/mo)</option>
        <option value="admin">Admin (Full Access)</option>
      </select>
    </div>
    <div class="modal-field" id="modal-pass-field">
      <label>Temporary Password <span style="color:var(--muted);font-size:9px">(user can change later)</span></label>
      <input type="text" id="modal-pass" placeholder="Leave blank to send magic link invite">
    </div>
    <div id="modal-srk-field" style="display:none;margin-top:8px;padding:10px 12px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);border-radius:8px">
      <label style="font-size:10px;color:#fbbf24;text-transform:uppercase;letter-spacing:0.08em">⚠ Service Role Key required</label>
      <input type="password" id="modal-srk" placeholder="eyJhbGciOiJIUzI1NiIs… (from Supabase → Settings → API)" style="width:100%;margin-top:6px;padding:7px 10px;background:var(--bg3);border:1px solid rgba(251,191,36,0.3);border-radius:6px;color:var(--text);font-size:11px;font-family:monospace">
      <div style="font-size:10px;color:var(--muted);margin-top:5px">Stored locally in your browser. Never sent to anyone.</div>
    </div>
    <div class="modal-err" id="modal-err"></div>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" id="modal-submit" onclick="submitAddUser()">Create User</button>
    </div>
  </div>
</div>

<!-- ── CHANGE TIER MODAL ── -->
<div class="modal-overlay" id="tier-modal">
  <div class="modal">
    <h3>Change Plan</h3>
    <div style="font-size:12px;color:var(--muted);margin-bottom:16px" id="tier-modal-email"></div>
    <div class="modal-field">
      <label>New Plan / Tier</label>
      <select id="tier-select">
        <option value="anonymous">Anonymous (Trial)</option>
        <option value="free">Free</option>
        <option value="starter">Starter</option>
        <option value="pro">Pro</option>
        <option value="cpa">CPA Firm</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div class="modal-err" id="tier-modal-err"></div>
    <div class="modal-actions">
      <button class="modal-btn secondary" onclick="closeTierModal()">Cancel</button>
      <button class="modal-btn primary" id="tier-submit" onclick="submitTierChange()">Save</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
// ── Supabase init ─────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://dnhsufwdyhkwrsdtfgyx.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_TQztgMqEoUjGQVUqQjPCPA_joWxqPtG';
// Service role key enables admin.createUser / admin.inviteUserByEmail
// Get from: Supabase Dashboard → Settings → API → service_role (secret)
// Service role key — hardcoded for local file use (localStorage blocked on file://)
// Get from: Supabase → Settings → API Keys → Secret keys → Copy
const SERVICE_ROLE_KEY = '{{SERVICE_ROLE_KEY}}';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
// Admin client uses service role key if available
const sbAdmin = SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const ADMIN_EMAIL = 'sturs49@gmail.com';
const ADMIN_PASS  = 'CTE-admin-2026';

// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-err');

  if (email !== ADMIN_EMAIL) {
    err.textContent = 'Access denied — admin only.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  err.textContent = '';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    const tier = data.user?.user_metadata?.tier || 'free';
    if (tier !== 'admin') {
      // Still allow local admin bypass for the known admin email
      if (email !== ADMIN_EMAIL || pass !== ADMIN_PASS) {
        await sb.auth.signOut();
        throw new Error('Not an admin account.');
      }
    }

    showApp(data.user);
  } catch(e) {
    // Fallback: local cred check (in case Supabase auth isn't set up yet)
    if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
      showApp({ email: ADMIN_EMAIL, user_metadata: { tier: 'admin' } });
    } else {
      err.textContent = e.message || 'Invalid credentials.';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  }
}

function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  // Hide service key banner if key already stored
  if (SERVICE_ROLE_KEY) {
    const banner = document.getElementById('service-key-banner');
    if (banner) { banner.style.display = 'none'; }
  }
  const emailStr = user.email || user.email || ADMIN_EMAIL;
  document.getElementById('my-email').textContent = emailStr;
  document.getElementById('admin-email-badge').textContent = emailStr;
  initDashboard();
}

function saveServiceKey() {
  const key = document.getElementById('srk-input').value.trim();
  if (!key) { 
    document.getElementById('srk-status').textContent = 'Paste your service role key first';
    return; 
  }
  localStorage.setItem('cte_service_role_key', key);
  window.sbAdmin = createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
  document.getElementById('srk-status').textContent = '✓ Saved — admin API now active';
  document.getElementById('srk-status').style.color = 'var(--teal)';
  document.getElementById('service-key-banner').style.borderColor = 'rgba(0,201,177,0.3)';
  document.getElementById('service-key-banner').style.background = 'rgba(0,201,177,0.05)';
  // Test it immediately
  window.sbAdmin.auth.admin.listUsers({ perPage: 1 }).then(({error}) => {
    if (error) {
      document.getElementById('srk-status').textContent = '✗ Key rejected: ' + error.message;
      document.getElementById('srk-status').style.color = 'var(--red)';
    } else {
      document.getElementById('srk-status').textContent = '✓ Verified — admin API active';
    }
  });
}

async function loadToolStats() {
  try {
    // Count total users
    const { data: users } = await sb.from('profiles').select('tier, tx_count');
    if (users) {
      document.getElementById('stat-installs').textContent = users.length;
      const paying = users.filter(u => ['starter','pro','cpa'].includes(u.tier)).length;
      document.getElementById('stat-paying').textContent = paying;
      const totalTx = users.reduce((sum, u) => sum + (parseInt(u.tx_count) || 0), 0);
      document.getElementById('stat-total-tx').textContent = totalTx.toLocaleString();
    }
  } catch(e) {
    // profiles table may not exist yet — silently skip
  }
}

async function doLogout() {
  await sb.auth.signOut();
  location.reload();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') doLogin();
});

// ── Navigation ─────────────────────────────────────────────────────────────────
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = { overview:'Dashboard Overview', users:'User Management', activity:'Activity Log', access:'My Access', api:'API Keys', settings:'Settings', batch:'Batch Hash Analyzer' };
  const t = titles[id] || id;
  const parts = t.split(' ');
  const last = parts.pop();
  document.getElementById('page-title').innerHTML = parts.join(' ') + ' <span>' + last + '</span>';

  // Lazy-load sections
  if (id === 'users') loadUsers();
  if (id === 'activity') loadActivity();
  if (id === 'settings') checkSupabaseStatus();
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = (isError ? '✗ ' : '✓ ') + msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function copyText(txt) {
  navigator.clipboard.writeText(txt).then(() => toast('Copied!')).catch(() => toast('Copy failed', true));
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('topbar-time').textContent =
    now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ── Init dashboard ─────────────────────────────────────────────────────────────
function initDashboard() {
  loadToolStats();
  updateClock();
  setInterval(updateClock, 1000);
  loadStats();
}

// ── Load stats from Supabase ──────────────────────────────────────────────────
async function loadStats() {
  try {
    // Fetch all users via admin API (requires service role key for full list)
    // With anon key we can query the profiles table if it exists, otherwise use auth.getUser
    // We'll try to list users - this works if RLS allows or via admin call
    const { data, error } = await sb.auth.admin?.listUsers?.() || { data: null, error: null };

    let users = [];
    if (data?.users) {
      users = data.users;
    } else {
      // Fallback: query a public profiles table if it exists
      const { data: profileData } = await sb.from('profiles').select('*').limit(500);
      users = profileData || [];
    }

    renderStats(users);
  } catch(e) {
    // Stats unavailable without service role key - show placeholder
    document.getElementById('stat-users').textContent = '—';
    document.getElementById('stat-paying').textContent = '—';
    document.getElementById('stat-free').textContent = '—';
    document.getElementById('stat-admin').textContent = '—';
    document.getElementById('stat-users-d').textContent = 'Load users tab to see data';
    document.getElementById('plan-dist').innerHTML = '<div style="color:var(--muted);font-size:11px">Stats require service role key or a public profiles table. See Supabase dashboard for full analytics.</div>';
    document.getElementById('recent-signups').innerHTML = '<div style="color:var(--muted);font-size:11px">Navigate to <strong style="color:var(--teal)">Users</strong> to manage accounts.</div>';
  }
}

function renderStats(users) {
  const getTier = u => u.user_metadata?.tier || u.tier || 'anonymous';
  const paying = users.filter(u => ['starter','pro','cpa'].includes(getTier(u)));
  const free   = users.filter(u => ['free','anonymous'].includes(getTier(u)));
  const admins = users.filter(u => getTier(u) === 'admin');

  document.getElementById('stat-users').textContent  = users.length;
  document.getElementById('stat-paying').textContent = paying.length;
  document.getElementById('stat-free').textContent   = free.length;
  document.getElementById('stat-admin').textContent  = admins.length;
  document.getElementById('stat-users-d').textContent  = 'Total registered';
  document.getElementById('stat-paying-d').textContent = 'Starter + Pro + CPA';
  document.getElementById('stat-free-d').textContent   = 'Free + Anonymous';
  document.getElementById('stat-admin-d').textContent  = 'Admin accounts';

  // Plan distribution
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
    const c = counts[d.key] || 0;
    if (!c) return;
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
  const recent = [...users].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0,6);
  const rs = document.getElementById('recent-signups');
  rs.innerHTML = recent.map(u => {
    const tier = getTier(u);
    const email = u.email || '—';
    const ago = timeAgo(u.created_at);
    return \`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03)">
      <span style="color:var(--teal)">\${email}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="tier-badge tier-\${tier}">\${tier.toUpperCase()}</span>
        <span style="color:var(--muted);font-size:10px">\${ago}</span>
      </div>
    </div>\`;
  }).join('');
}

// ── Load users ────────────────────────────────────────────────────────────────
let allUsers = [];

async function loadUsers() {
  const tbody = document.getElementById('user-tbody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="6"><span class="spinner"></span>Loading from Supabase…</td></tr>';

  try {
    // Try admin API first
    let users = [];
    const adminResult = await sb.auth.admin?.listUsers?.({ perPage: 500 });
    if (adminResult?.data?.users) {
      users = adminResult.data.users;
    } else {
      // Fallback: profiles table
      const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      users = data || [];
    }

    allUsers = users;
    document.getElementById('user-count-badge').textContent = \`(\${users.length})\`;
    renderUsers(users);
  } catch(e) {
    tbody.innerHTML = \`<tr class="loading-row"><td colspan="6" style="color:var(--red)">
      ⚠ Cannot list users with anon key. 
      <a href="https://supabase.com/dashboard/project/dnhsufwdyhkwrsdtfgyx/auth/users" target="_blank" style="color:var(--teal)">Open Supabase Auth →</a>
      <br><small style="color:var(--muted);margin-top:6px;display:block">To enable this panel, either create a public <code>profiles</code> table with RLS or use a service role key.</small>
      <button onclick="loadUsersViaProfiles()" style="margin-top:10px;padding:6px 14px;border-radius:6px;border:1px solid rgba(0,212,184,0.3);background:none;color:var(--teal);cursor:pointer;font-family:var(--body);font-size:11px">Try profiles table</button>
    </td></tr>\`;
  }
}

async function loadUsersViaProfiles() {
  const tbody = document.getElementById('user-tbody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="6"><span class="spinner"></span>Querying profiles…</td></tr>';
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error || !data?.length) {
    tbody.innerHTML = \`<tr class="loading-row"><td colspan="6" style="color:var(--muted)">No profiles table found. <a href="https://supabase.com/dashboard/project/dnhsufwdyhkwrsdtfgyx/auth/users" target="_blank" style="color:var(--teal)">Manage users in Supabase →</a></td></tr>\`;
    return;
  }
  allUsers = data;
  document.getElementById('user-count-badge').textContent = \`(\${data.length})\`;
  renderUsers(data);
}

function renderUsers(list) {
  const tbody = document.getElementById('user-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6" style="color:var(--muted)">No users found.</td></tr>';
    return;
  }
  const getTier = u => u.user_metadata?.tier || u.tier || 'anonymous';
  tbody.innerHTML = list.map(u => {
    const tier   = getTier(u);
    const email  = u.email || '—';
    const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';
    const lastIn = u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : (u.updated_at ? timeAgo(u.updated_at) : '—');
    const tx     = u.tx_count || u.user_metadata?.tx_count || '—';
    const uid    = u.id || '';
    const isAdmin = tier === 'admin';
    return \`<tr>
      <td style="font-family:monospace;font-size:11px">\${email}</td>
      <td><span class="tier-badge tier-\${tier}">\${tier.toUpperCase()}</span></td>
      <td>\${tx}</td>
      <td style="color:var(--muted)">\${joined}</td>
      <td style="color:var(--muted)">\${lastIn}</td>
      <td style="display:flex;gap:5px;flex-wrap:wrap">
        <button class="action-btn btn-edit" onclick="openTierModal('\${uid}','\${email}','\${tier}')">Change Plan</button>
        \${!isAdmin ? \`<button class="action-btn btn-upgrade" onclick="quickSetTier('\${uid}','\${email}','admin')">→ Admin</button>\` : ''}
        \${tier==='anonymous'||tier==='free' ? \`<button class="action-btn btn-upgrade" onclick="quickSetTier('\${uid}','\${email}','pro')">→ Pro</button>\` : ''}
      </td>
    </tr>\`;
  }).join('');
}

function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  const getTier = u => u.user_metadata?.tier || u.tier || 'anonymous';
  renderUsers(allUsers.filter(u => (u.email||'').toLowerCase().includes(q) || getTier(u).includes(q)));
}

// ── Tier management ───────────────────────────────────────────────────────────
let activeTierUserId = null;
let activeTierEmail  = null;

function openTierModal(uid, email, currentTier) {
  activeTierUserId = uid;
  activeTierEmail  = email;
  document.getElementById('tier-modal-email').textContent = email;
  document.getElementById('tier-select').value = currentTier;
  document.getElementById('tier-modal-err').textContent = '';
  document.getElementById('tier-modal').classList.add('show');
}
function closeTierModal() {
  document.getElementById('tier-modal').classList.remove('show');
}

async function submitTierChange() {
  const newTier = document.getElementById('tier-select').value;
  const btn = document.getElementById('tier-submit');
  const errEl = document.getElementById('tier-modal-err');
  btn.disabled = true; btn.textContent = 'Saving…';
  errEl.textContent = '';

  try {
    await setUserTier(activeTierUserId, activeTierEmail, newTier);
    toast(\`\${activeTierEmail} → \${newTier.toUpperCase()}\`);
    closeTierModal();
    await loadUsers();
  } catch(e) {
    errEl.textContent = e.message || 'Failed to update tier.';
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
}

async function setUserTier(uid, email, tier) {
  // Method 1: admin updateUserById (requires service role or admin SDK)
  if (uid) {
    const { error } = await sb.auth.admin?.updateUserById?.(uid, {
      user_metadata: { tier }
    });
    if (!error) return;
  }

  // Method 2: update profiles table
  const { error: profileErr } = await sb.from('profiles')
    .update({ tier })
    .eq('id', uid || '')
    .single();
  if (!profileErr) return;

  // Method 3: update by email in profiles
  const { error: emailErr } = await sb.from('profiles')
    .upsert({ email, tier }, { onConflict: 'email' });
  if (!emailErr) return;

  // All methods failed — open Supabase console
  window.open(
    \`https://supabase.com/dashboard/project/dnhsufwdyhkwrsdtfgyx/auth/users\`,
    '_blank'
  );
  throw new Error(\`Auto-update requires service role key. Opening Supabase Auth — run this SQL:\\n\\nUPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"tier":"\${tier}"}'::jsonb WHERE email = '\${email}';\`);
}

async function quickSetTier(uid, email, tier) {
  try {
    await setUserTier(uid, email, tier);
    toast(\`\${email} → \${tier.toUpperCase()}\`);
    await loadUsers();
  } catch(e) {
    toast(e.message, true);
  }
}

// ── Add user modal ────────────────────────────────────────────────────────────
function openAddUserModal() {
  document.getElementById('modal-email').value = '';
  document.getElementById('modal-pass').value  = '';
  document.getElementById('modal-tier').value  = 'pro';
  document.getElementById('modal-err').textContent = '';
  document.getElementById('modal-title').textContent = 'Add / Invite User';
  document.getElementById('modal-submit').textContent = 'Create User';
  document.getElementById('user-modal').classList.add('show');
}
function closeModal() {
  document.getElementById('user-modal').classList.remove('show');
}

async function submitAddUser() {
  const email = document.getElementById('modal-email').value.trim();
  const tier  = document.getElementById('modal-tier').value;
  const pass  = document.getElementById('modal-pass').value.trim();
  const btn   = document.getElementById('modal-submit');
  const errEl = document.getElementById('modal-err');
  const srkField = document.getElementById('modal-srk-field');
  const srkInput = document.getElementById('modal-srk');

  if (!email) { errEl.textContent = 'Email is required.'; return; }

  // Use hardcoded key, then inline input
  let srk = SERVICE_ROLE_KEY || srkInput?.value.trim() || '';

  if (!srk) {
    srkField.style.display = 'block';
    srkInput.focus();
    errEl.textContent = 'Enter your Supabase service role key above to create users.';
    return;
  }

  // Init admin client
  window.sbAdmin = createClient(SUPABASE_URL, srk, { auth: { autoRefreshToken: false, persistSession: false } });
  if (srkField) srkField.style.display = 'none';

  btn.disabled = true; btn.textContent = 'Creating…';
  errEl.textContent = '';

  try {
    // Use direct REST API with service role key — most reliable, bypasses SDK quirks
    let response, body;

    if (pass) {
      // Create user with password
      response = await fetch(\`\${SUPABASE_URL}/auth/v1/admin/users\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': srk,
          'Authorization': \`Bearer \${srk}\`
        },
        body: JSON.stringify({
          email,
          password: pass,
          user_metadata: { tier },
          email_confirm: true
        })
      });
    } else {
      // Send invite email (OTP)
      response = await fetch(\`\${SUPABASE_URL}/auth/v1/invite\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': srk,
          'Authorization': \`Bearer \${srk}\`
        },
        body: JSON.stringify({
          email,
          data: { tier }
        })
      });
    }

    body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.msg || body.message || body.error_description || \`HTTP \${response.status}\`);
    }

    toast(\`✓ User created: \${email} (\${tier.toUpperCase()})\`);
    closeModal();
    await loadUsers();

  } catch(e) {
    errEl.textContent = e.message || 'Unknown error.';
  } finally {
    btn.disabled = false; btn.textContent = 'Create User';
  }
}

// ── Grant self admin ──────────────────────────────────────────────────────────
async function grantSelfAdmin() {
  const btn = document.querySelector('[onclick="grantSelfAdmin()"]');
  const origText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }

  try {
    // Try 1: updateUser on current session (works if already logged in via Supabase)
    const { data: { user }, error: userErr } = await sb.auth.getUser();

    if (user) {
      const { error: updateErr } = await sb.auth.updateUser({ data: { tier: 'admin' } });
      if (!updateErr) {
        toast('✓ Admin tier set via session!');
        if (btn) { btn.disabled = false; btn.textContent = origText; }
        return;
      }
    }

    // Try 2: Use service role client to update by email (requires service role key)
    const adminCli = window.sbAdmin;
    if (adminCli) {
      // Find user by email then update metadata
      const { data: listData, error: listErr } = await adminCli.auth.admin.listUsers();
      if (!listErr && listData?.users) {
        const target = listData.users.find(u => u.email === ADMIN_EMAIL);
        if (target) {
          const { error: adminUpdateErr } = await adminCli.auth.admin.updateUserById(target.id, {
            user_metadata: { ...target.user_metadata, tier: 'admin' }
          });
          if (!adminUpdateErr) {
            toast('✓ Admin tier set via service role!');
            if (btn) { btn.disabled = false; btn.textContent = origText; }
            return;
          }
        }
      }
    }

    // Try 3: profiles table upsert (if you have a profiles table)
    const { data: { user: u2 } } = await sb.auth.getUser();
    if (u2) {
      const { error: profileErr } = await sb
        .from('profiles')
        .upsert({ id: u2.id, email: ADMIN_EMAIL, tier: 'admin' }, { onConflict: 'id' });
      if (!profileErr) {
        toast('✓ Admin tier set in profiles table!');
        if (btn) { btn.disabled = false; btn.textContent = origText; }
        return;
      }
    }

    // All API paths failed — copy SQL and show inline instructions (no redirect)
    const sql = \`UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"tier":"admin"}'::jsonb WHERE email = '\${ADMIN_EMAIL}';\`;
    navigator.clipboard.writeText(sql).catch(() => {});
    toast('⚠ Paste this SQL in Supabase → SQL Editor (copied)', true);
    // Show inline SQL block instead of redirecting
    const existing = document.getElementById('grant-sql-hint');
    if (!existing) {
      const hint = document.createElement('div');
      hint.id = 'grant-sql-hint';
      hint.style.cssText = 'margin-top:10px;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;font-size:11px;font-family:monospace;color:var(--teal);word-break:break-all;cursor:pointer';
      hint.title = 'Click to copy';
      hint.textContent = sql;
      hint.onclick = () => { navigator.clipboard.writeText(sql); toast('SQL copied!'); };
      btn?.parentNode?.appendChild(hint);
    }

  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

// ── Activity log ──────────────────────────────────────────────────────────────
async function loadActivity() {
  const feed = document.getElementById('full-feed');
  feed.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:20px"><span class="spinner"></span>Loading…</div>';

  try {
    // Try auth audit log
    const { data, error } = await sb.from('auth_audit_log_entries').select('*').order('created_at', { ascending: false }).limit(50);

    if (data?.length) {
      feed.innerHTML = data.map(e => {
        const action = e.payload?.action || e.event_message || 'event';
        const actor  = e.payload?.email || e.actor_email || '—';
        const color  = action.includes('signup') ? '#4ade80' : action.includes('login') ? '#00d4b8' : '#3b82f6';
        return feedItem({ color, text: \`<span>\${actor}</span> — \${action}\`, time: timeAgo(e.created_at) });
      }).join('');
    } else {
      throw new Error('No audit log access');
    }
  } catch {
    // Fallback: show recent users as activity
    if (allUsers.length) {
      const sorted = [...allUsers].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0,20);
      feed.innerHTML = sorted.map(u => {
        const tier = u.user_metadata?.tier || u.tier || 'anonymous';
        return feedItem({ color:'#4ade80', text:\`New signup: <span>\${u.email}</span> (\${tier})\`, time: timeAgo(u.created_at) });
      }).join('');
    } else {
      feed.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:20px">Activity log requires audit log access or load users first.</div>';
    }
  }
}

function feedItem(a) {
  return \`<div class="feed-item"><div class="feed-dot" style="background:\${a.color}"></div><div class="feed-text">\${a.text}</div><div class="feed-time">\${a.time}</div></div>\`;
}

// ── Supabase status ────────────────────────────────────────────────────────────
async function checkSupabaseStatus() {
  const el = document.getElementById('supabase-status');
  try {
    const { error } = await sb.auth.getSession();
    el.textContent = error ? '⚠ ' + error.message : '✓ Connected';
    el.style.color = error ? 'var(--yellow)' : 'var(--green)';
  } catch {
    el.textContent = '✗ Unreachable';
    el.style.color = 'var(--red)';
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}
</script>
</body>
</html>
`;

export default {
  async fetch(request, env) {
    const served = INDEX_HTML.replace(
      "'{{SERVICE_ROLE_KEY}}'",
      `'${env.SERVICE_ROLE_KEY || ''}'`
    );
    return new Response(served, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};
