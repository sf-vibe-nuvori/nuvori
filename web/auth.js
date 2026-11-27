// ============================================================================
// Nuvori 계정 연동 — Supabase Auth (Google OAuth)
// ----------------------------------------------------------------------------
// - supabase-js(UMD, CDN)가 먼저 로드되어 window.supabase 가 있어야 한다.
// - SUPABASE_PUBLISHABLE_KEY 는 브라우저 공개용 키다 (RLS로 보호). GEMINI_API_KEY 같은
//   비밀 키는 절대 이 파일에 두지 않는다 (루트 CLAUDE.md §4).
// - 가입 시 profiles 행은 DB 트리거(on_auth_user_created → handle_new_user)가 만든다.
// - 인벤토리 데이터는 아직 localStorage 에만 저장된다 (DB 동기화는 별도 작업).
// - XSS 규칙: innerHTML 금지, createElement / textContent / replaceChildren 만 사용.
// ============================================================================
(function() {
  "use strict";

  var SUPABASE_URL = "https://vapzxslqrcvuuyfmpljy.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1HDR3gQa4FcdImcyhSnSSg_BTTF-1Vq";

  var listeners = [];
  var currentSession = null;
  var client = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function getDisplayName(user) {
    var meta = (user && user.user_metadata) || {};
    return meta.full_name || meta.name || meta.display_name || (user && user.email) || "내 계정";
  }

  function getAvatarUrl(user) {
    var meta = (user && user.user_metadata) || {};
    var url = meta.avatar_url || meta.picture || "";
    return /^https:\/\//.test(url) ? url : "";
  }

  function signInWithGoogle() {
    if (!client) return;
    client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    }).then(function(res) {
      if (res && res.error) showAuthError(res.error);
    });
  }

  function signOut() {
    if (!client) return;
    client.auth.signOut().then(function(res) {
      if (res && res.error) showAuthError(res.error);
    });
  }

  function showAuthError(err) {
    var msg = (err && err.message) ? err.message : String(err || "알 수 없는 오류");
    var toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "⚠️ 로그인 오류: " + msg;
      toast.style.display = "block";
      setTimeout(function() { toast.style.display = "none"; }, 5000);
    }
    if (window.console) console.warn("[NuvoriAuth]", err);
  }

  // 트리거가 Google 이름(full_name)을 못 읽어 display_name 이 비어 있으면 본인 행만 채운다.
  // (profiles_update_own 정책 범위 · db/migrations/0002 적용 후에는 불필요)
  function backfillProfileName(user) {
    if (!client || !user) return;
    client.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(function(res) {
      if (res.error || !res.data || res.data.display_name) return;
      var name = getDisplayName(user);
      if (!name || name === user.email) return;
      client.from("profiles").update({ display_name: name }).eq("id", user.id).then(function() {});
    });
  }

  function renderAuthSlot() {
    var slot = document.getElementById("auth-slot");
    if (!slot) return;
    slot.replaceChildren();

    if (!client) return;

    var user = currentSession && currentSession.user;
    if (!user) {
      var loginBtn = el("button", "auth-google-btn");
      loginBtn.type = "button";
      loginBtn.title = "Google 계정으로 로그인";
      loginBtn.appendChild(el("span", "auth-g", "G"));
      loginBtn.appendChild(el("span", "auth-label-long", "Google로 시작하기"));
      loginBtn.appendChild(el("span", "auth-label-short", "로그인"));
      loginBtn.addEventListener("click", signInWithGoogle);
      slot.appendChild(loginBtn);
      return;
    }

    var wrap = el("div", "auth-user");
    var avatarUrl = getAvatarUrl(user);
    if (avatarUrl) {
      var img = document.createElement("img");
      img.className = "auth-avatar";
      img.src = avatarUrl;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      wrap.appendChild(img);
    } else {
      wrap.appendChild(el("span", "auth-avatar auth-avatar-fallback", getDisplayName(user).charAt(0)));
    }
    wrap.appendChild(el("span", "auth-name", getDisplayName(user)));

    var outBtn = el("button", "btn-sm auth-logout", "로그아웃");
    outBtn.type = "button";
    outBtn.addEventListener("click", signOut);
    wrap.appendChild(outBtn);
    slot.appendChild(wrap);
  }

  function setSession(session) {
    var prevId = currentSession && currentSession.user && currentSession.user.id;
    currentSession = session || null;
    var nextId = currentSession && currentSession.user && currentSession.user.id;
    renderAuthSlot();
    if (nextId && nextId !== prevId) backfillProfileName(currentSession.user);
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](currentSession); } catch (e) {}
    }
  }

  function init() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      // CDN 로드 실패 시 앱은 로그인 없이(localStorage) 그대로 동작
      if (window.console) console.warn("[NuvoriAuth] supabase-js 로드 실패 — 로그인 비활성화");
      return;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
    });

    client.auth.getSession().then(function(res) {
      setSession(res && res.data ? res.data.session : null);
    });
    client.auth.onAuthStateChange(function(_event, session) {
      setSession(session);
    });

    renderAuthSlot();
  }

  window.NuvoriAuth = {
    getSession: function() { return currentSession; },
    getClient: function() { return client; },
    onChange: function(fn) { if (typeof fn === "function") listeners.push(fn); },
    signInWithGoogle: signInWithGoogle,
    signOut: signOut
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
