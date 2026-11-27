// ============================================================================
// Nuvori 계정 연동 — Supabase Auth (Google OAuth)
// ----------------------------------------------------------------------------
// - supabase-js(UMD, CDN)가 먼저 로드되어 window.supabase 가 있어야 한다.
// - SUPABASE_PUBLISHABLE_KEY 는 브라우저 공개용 키다 (RLS로 보호). GEMINI_API_KEY 같은
//   비밀 키는 절대 이 파일에 두지 않는다 (루트 CLAUDE.md §4).
// - 가입 시 profiles 행은 DB 트리거(on_auth_user_created → handle_new_user)가 만든다.
// - 인벤토리 데이터는 아직 localStorage 에만 저장된다 (DB 동기화는 별도 작업).
// - UI: 로그인 시트(#auth-gate) + 상단 계정 칩(#auth-slot). 스타일은 web/auth.css.
//   디자인 기준은 Figma "Home JL Edit" 의 `N1 · Setup 1 · Connect` 바텀시트.
// - XSS 규칙: innerHTML 금지, createElement / textContent / replaceChildren 만 사용.
// ============================================================================
(function() {
  "use strict";

  var SUPABASE_URL = "https://vapzxslqrcvuuyfmpljy.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1HDR3gQa4FcdImcyhSnSSg_BTTF-1Vq";

  // "나중에 할게요"를 누른 기록 (UI 표시 여부만 — 인벤토리 상태 계약과 무관한 별도 키)
  var SKIP_KEY = "nuvori_auth_skip_v1";
  var SVG_NS = "http://www.w3.org/2000/svg";

  var listeners = [];
  var currentSession = null;
  var client = null;
  var sessionResolved = false;
  var gate = null;            // { root, sheet, cta, ctaLabel, error }
  var lastFocus = null;

  // ── DOM 헬퍼 ──────────────────────────────────────────────────────────────
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function googleBadge() {
    var badge = el("span", "auth-g-badge");
    badge.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 48 48");
    var paths = [
      ["auth-g-red", "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"],
      ["auth-g-blue", "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"],
      ["auth-g-yellow", "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"],
      ["auth-g-green", "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"]
    ];
    for (var i = 0; i < paths.length; i++) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("class", paths[i][0]);
      p.setAttribute("d", paths[i][1]);
      svg.appendChild(p);
    }
    badge.appendChild(svg);
    return badge;
  }

  // 테마별 마스코트: 다크 = `Mascot`(유리), 라이트 = `Mascot · Set 2`(아이보리)
  function mascot() {
    var pic = el("picture", "auth-mascot");
    var dark = document.createElement("source");
    dark.media = "(prefers-color-scheme: dark)";
    dark.srcset = "assets/nuvori-mascot-dark.png";
    pic.appendChild(dark);
    var img = document.createElement("img");
    img.src = "assets/nuvori-mascot-light.png";
    img.alt = "";
    img.width = 64;
    img.height = 64;
    pic.appendChild(img);
    return pic;
  }

  // ── 사용자 정보 ───────────────────────────────────────────────────────────
  function getDisplayName(user) {
    var meta = (user && user.user_metadata) || {};
    return meta.full_name || meta.name || meta.display_name || (user && user.email) || "내 계정";
  }

  function getAvatarUrl(user) {
    var meta = (user && user.user_metadata) || {};
    var url = meta.avatar_url || meta.picture || "";
    return /^https:\/\//.test(url) ? url : "";
  }

  // ── 저장소 (사파리 개인정보 보호 모드 등에서 실패할 수 있음) ─────────────
  function isSkipped() {
    try { return window.localStorage.getItem(SKIP_KEY) === "1"; } catch (e) { return false; }
  }
  function setSkipped(on) {
    try {
      if (on) window.localStorage.setItem(SKIP_KEY, "1");
      else window.localStorage.removeItem(SKIP_KEY);
    } catch (e) {}
  }

  // ── 토스트 (index.html 의 #toast 재사용) ─────────────────────────────────
  function toast(msg, ms) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    setTimeout(function() { t.style.display = "none"; }, ms || 3000);
  }

  function friendlyError(err) {
    var raw = (err && (err.message || err.error_description)) ? (err.message || err.error_description) : String(err || "");
    if (/provider is not enabled|Unsupported provider/i.test(raw)) {
      return "Google 로그인이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.";
    }
    if (/access_denied|cancel/i.test(raw)) {
      return "로그인을 취소했어요. 원하면 언제든 다시 시작할 수 있어요.";
    }
    if (/network|fetch/i.test(raw)) {
      return "인터넷 연결을 확인하고 다시 시도해 주세요.";
    }
    return "로그인하지 못했어요. 다시 시도해 주세요." + (raw ? " (" + raw + ")" : "");
  }

  function showAuthError(err) {
    if (window.console) console.warn("[NuvoriAuth]", err);
    var msg = friendlyError(err);
    if (gate && !gate.root.hidden) {
      gate.error.textContent = msg;
      gate.error.hidden = false;
      setCtaBusy(false);
    } else {
      toast(msg, 5000);
    }
  }

  // ── 로그인 / 로그아웃 ─────────────────────────────────────────────────────
  function signInWithGoogle() {
    if (!client) return;
    if (gate) gate.error.hidden = true;
    setCtaBusy(true);
    client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    }).then(function(res) {
      if (res && res.error) showAuthError(res.error);
      // 성공하면 Google 로 페이지가 이동하므로 여기서 할 일 없음
    }, showAuthError);
  }

  function signOut() {
    if (!client) return;
    client.auth.signOut().then(function(res) {
      if (res && res.error) showAuthError(res.error);
      else toast("로그아웃했어요.");
    }, showAuthError);
  }

  // ── 로그인 시트 ───────────────────────────────────────────────────────────
  function setCtaBusy(busy) {
    if (!gate) return;
    gate.cta.disabled = !!busy;
    gate.ctaLabel.textContent = busy ? "Google로 이동하는 중…" : "Google로 계속하기";
  }

  function row(title, desc, chip) {
    var li = el("li", "auth-row");
    var text = el("div");
    text.appendChild(el("div", "auth-row-title", title));
    text.appendChild(el("div", "auth-row-desc", desc));
    li.appendChild(text);
    if (chip) li.appendChild(el("span", "auth-chip", chip));
    return li;
  }

  function buildGate() {
    if (gate) return gate;

    var root = el("div", "auth-gate");
    root.id = "auth-gate";
    root.hidden = true;

    var scrim = el("button", "auth-scrim");
    scrim.type = "button";
    scrim.tabIndex = -1;
    scrim.setAttribute("aria-label", "닫기");
    scrim.addEventListener("click", dismissGate);
    root.appendChild(scrim);

    var sheet = el("section", "auth-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "auth-title");
    sheet.tabIndex = -1; // 열릴 때 시트에 포커스 (버튼에 포커스 링이 바로 뜨지 않도록)

    sheet.appendChild(el("div", "auth-grabber"));

    var hero = el("div", "auth-hero");
    hero.appendChild(mascot());
    var heroText = el("div");
    var title = el("h2", "auth-title", "안녕하세요, 누보리예요");
    title.id = "auth-title";
    heroText.appendChild(title);
    heroText.appendChild(el("p", "auth-sub", "Google 계정 하나로 바로 시작해요. 비밀번호는 따로 만들 필요 없어요."));
    hero.appendChild(heroText);
    sheet.appendChild(hero);

    var rows = el("ul", "auth-rows");
    rows.appendChild(row("Google 계정으로 시작", "이름과 프로필 사진만 받아요"));
    rows.appendChild(row("여러 기기에서 이어보기", "폰과 컴퓨터에서 같은 기록을 봐요", "준비 중"));
    sheet.appendChild(rows);

    sheet.appendChild(el("p", "auth-note", "식료품 기록만 다뤄요. 언제든 로그아웃할 수 있어요."));

    var error = el("p", "auth-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    sheet.appendChild(error);

    var cta = el("button", "auth-cta");
    cta.type = "button";
    cta.appendChild(googleBadge());
    var ctaLabel = el("span", null, "Google로 계속하기");
    cta.appendChild(ctaLabel);
    cta.addEventListener("click", signInWithGoogle);
    sheet.appendChild(cta);

    var later = el("button", "auth-ghost", "나중에 할게요");
    later.type = "button";
    later.addEventListener("click", dismissGate);
    sheet.appendChild(later);

    root.appendChild(sheet);
    document.body.appendChild(root);

    root.addEventListener("keydown", function(e) {
      if (e.key === "Escape") { e.preventDefault(); dismissGate(); return; }
      if (e.key === "Tab") trapFocus(e, sheet);
    });
    enableSwipeToClose(sheet);

    gate = { root: root, sheet: sheet, cta: cta, ctaLabel: ctaLabel, error: error };
    return gate;
  }

  function trapFocus(e, container) {
    var f = container.querySelectorAll("button:not([disabled])");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // 아래로 스와이프해서 닫기 (web/CLAUDE.md §2.5)
  function enableSwipeToClose(sheet) {
    var startY = null, dy = 0;
    sheet.addEventListener("touchstart", function(e) {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      dy = 0;
      sheet.classList.add("is-dragging");
    }, { passive: true });
    sheet.addEventListener("touchmove", function(e) {
      if (startY === null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transform = dy ? "translateY(" + dy + "px)" : "";
    }, { passive: true });
    function end() {
      if (startY === null) return;
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";
      if (dy > 90) dismissGate();
      startY = null;
      dy = 0;
    }
    sheet.addEventListener("touchend", end);
    sheet.addEventListener("touchcancel", end);
  }

  function openGate(errorMsg) {
    if (!client) return;
    var g = buildGate();
    setCtaBusy(false);
    g.error.hidden = !errorMsg;
    if (errorMsg) g.error.textContent = errorMsg;
    if (!g.root.hidden) return;
    lastFocus = document.activeElement;
    g.root.hidden = false;
    document.body.classList.add("auth-locked");
    setTimeout(function() { g.sheet.focus({ preventScroll: true }); }, 30);
  }

  function closeGate() {
    if (!gate || gate.root.hidden) return;
    gate.root.hidden = true;
    gate.sheet.style.transform = "";
    document.body.classList.remove("auth-locked");
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus(); } catch (e) {}
    }
    lastFocus = null;
  }

  function dismissGate() {
    setSkipped(true);
    closeGate();
  }

  // ── 상단 계정 칩 ──────────────────────────────────────────────────────────
  function renderAuthSlot() {
    var slot = document.getElementById("auth-slot");
    if (!slot) return;
    slot.replaceChildren();
    if (!client || !sessionResolved) return;

    var user = currentSession && currentSession.user;
    if (!user) {
      var loginBtn = el("button", "auth-nav-login");
      loginBtn.type = "button";
      loginBtn.setAttribute("aria-label", "Google 계정으로 로그인");
      loginBtn.appendChild(googleBadge());
      loginBtn.appendChild(el("span", null, "로그인"));
      loginBtn.addEventListener("click", function() { openGate(); });
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

    var outBtn = el("button", "auth-logout", "로그아웃");
    outBtn.type = "button";
    outBtn.addEventListener("click", signOut);
    wrap.appendChild(outBtn);
    slot.appendChild(wrap);
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

  // ── 세션 ──────────────────────────────────────────────────────────────────
  function setSession(session) {
    var prevId = currentSession && currentSession.user && currentSession.user.id;
    currentSession = session || null;
    var nextId = currentSession && currentSession.user && currentSession.user.id;

    renderAuthSlot();

    if (nextId) {
      setSkipped(false);
      closeGate();
      if (nextId !== prevId) {
        backfillProfileName(currentSession.user);
        if (!prevId && justReturnedFromOAuth) {
          justReturnedFromOAuth = false;
          toast("반가워요, " + getDisplayName(currentSession.user) + "님");
        }
      }
    }

    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](currentSession); } catch (e) {}
    }
  }

  // OAuth 리디렉트로 돌아왔는지 / 오류가 붙어 왔는지 확인하고 URL 을 정리한다
  var justReturnedFromOAuth = false;
  function readOAuthReturn() {
    var params = new URLSearchParams(window.location.search);
    var hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    var err = params.get("error_description") || params.get("error") ||
              hash.get("error_description") || hash.get("error");
    justReturnedFromOAuth = params.has("code") || hash.has("access_token");
    return err ? err.replace(/\+/g, " ") : "";
  }
  function cleanOAuthParams() {
    var url = new URL(window.location.href);
    var keys = ["code", "error", "error_code", "error_description", "state"];
    var changed = false;
    for (var i = 0; i < keys.length; i++) {
      if (url.searchParams.has(keys[i])) { url.searchParams.delete(keys[i]); changed = true; }
    }
    if (/(^|&|#)(access_token|error)=/.test(url.hash)) { url.hash = ""; changed = true; }
    if (changed && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }

  function init() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      // CDN 로드 실패 시 앱은 로그인 없이(localStorage) 그대로 동작
      if (window.console) console.warn("[NuvoriAuth] supabase-js 로드 실패 — 로그인 비활성화");
      return;
    }
    var returnError = readOAuthReturn();

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
    });

    client.auth.onAuthStateChange(function(_event, session) {
      if (!sessionResolved) return; // 첫 판정은 getSession 결과로 한다
      setSession(session);
    });

    // getSession 은 ?code= 교환이 끝난 뒤 resolve 되므로, 그 전에는 시트를 띄우지 않는다 (깜빡임 방지)
    client.auth.getSession().then(function(res) {
      sessionResolved = true;
      var session = res && res.data ? res.data.session : null;
      var error = res && res.error;
      cleanOAuthParams();
      setSession(session);
      if (!session) {
        if (returnError || error) openGate(friendlyError(returnError || error));
        else if (!isSkipped()) openGate();
      }
    }, function(err) {
      sessionResolved = true;
      cleanOAuthParams();
      renderAuthSlot();
      openGate(friendlyError(err));
    });
  }

  window.NuvoriAuth = {
    getSession: function() { return currentSession; },
    getClient: function() { return client; },
    onChange: function(fn) { if (typeof fn === "function") listeners.push(fn); },
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    openLogin: function() { openGate(); }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
