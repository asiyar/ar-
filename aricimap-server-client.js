/**
 * ARICIMAP sunucu bağlantısı ve açılış ekranı.
 *
 * Ücretsiz barındırma planları uzun süre istek almadığında sunucuyu uyutur.
 * Uyanma 30 saniyeyi bulabilir. Bu dosya, o süre boyunca kullanıcıya ne
 * olduğunu anlatan bir ekran gösterir; aksi halde uygulama bozuk sanılır.
 */
(function () {
  // Native kabukta (APK/IPA) sayfa uygulamanın kendi içinden servis edilir;
  // göreli adres sunucuya değil telefonun içine gider ve hiçbir istek ulaşmaz.
  // Bu yüzden kabuk içindeyken mutlak adres kullanılır.
  const REMOTE_API = "https://ar-3q6i.onrender.com";

  function resolveBase() {
    if (window.ARICIMAP_API_BASE) return String(window.ARICIMAP_API_BASE).replace(/\/+$/, "");
    const loc = window.location;
    const nativeShell =
      loc.protocol === "capacitor:" ||
      loc.protocol === "file:" ||
      // Capacitor Android sayfayı https://localhost (portsuz) üzerinden sunar.
      // Yerel geliştirmede ise port bulunur (localhost:3000 gibi).
      ((loc.hostname === "localhost" || loc.hostname === "127.0.0.1") && !loc.port);
    return nativeShell ? REMOTE_API : "";
  }

  const API_BASE = resolveBase();
  const API = API_BASE + "/api/aricimap";
  const TOKEN_KEY = "aricimap-token";
  const WAKE_TIMEOUT_MS = 90000;
  const RETRY_DELAY_MS = 2500;
  const SLOW_AFTER_MS = 4000;

  let token = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.warn("ARICIMAP jeton okunamadı", error);
  }

  // --- Açılış ekranı ------------------------------------------------------
  const overlay = document.createElement("div");
  overlay.id = "bootOverlay";
  overlay.innerHTML =
    '<div class="boot-card">' +
    '<div class="boot-bee" aria-hidden="true"></div>' +
    '<h1>ARICIMAP</h1>' +
    '<p class="boot-status" id="bootStatus">Sunucuya bağlanılıyor…</p>' +
    '<div class="boot-track"><div class="boot-fill" id="bootFill"></div></div>' +
    '<p class="boot-hint" id="bootHint"></p>' +
    '<button class="boot-retry" id="bootRetry" hidden>Yeniden dene</button>' +
    "</div>";

  const style = document.createElement("style");
  style.textContent =
    "#bootOverlay{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:26px;background:#f7f4eb;font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#2d3a2d}" +
    "#bootOverlay.done{opacity:0;pointer-events:none;transition:opacity .32s ease}" +
    ".boot-card{width:100%;max-width:330px;text-align:center}" +
    ".boot-bee{width:52px;height:52px;margin:0 auto 20px;border:3px solid #d59622;border-radius:20px 20px 26px 26px;transform:rotate(45deg);animation:bootPulse 1.5s ease-in-out infinite}" +
    "@keyframes bootPulse{0%,100%{transform:rotate(45deg) scale(1);opacity:1}50%{transform:rotate(45deg) scale(.88);opacity:.65}}" +
    ".boot-card h1{margin:0 0 6px;font-size:23px;letter-spacing:2px;color:#263f2d}" +
    ".boot-status{margin:0 0 18px;font-size:13px;color:#4a5a4b;min-height:20px}" +
    ".boot-track{height:5px;border-radius:99px;background:#e0e4d9;overflow:hidden}" +
    ".boot-fill{height:100%;width:18%;border-radius:99px;background:#d59622;animation:bootSlide 1.5s ease-in-out infinite}" +
    "@keyframes bootSlide{0%{margin-left:-20%}100%{margin-left:100%}}" +
    ".boot-hint{margin:16px 0 0;font-size:11px;line-height:1.6;color:#728072;min-height:34px}" +
    ".boot-retry{margin-top:14px;padding:10px 18px;border:0;border-radius:9px;background:#263f2d;color:#f2f7ee;font-weight:600;font-size:13px;cursor:pointer}";

  document.head.appendChild(style);
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(overlay));
  if (document.body) document.body.appendChild(overlay);

  const el = (id) => document.getElementById(id);
  const setStatus = (text) => {
    const node = el("bootStatus");
    if (node) node.textContent = text;
  };
  const setHint = (text) => {
    const node = el("bootHint");
    if (node) node.textContent = text;
  };

  function hideOverlay() {
    const node = el("bootOverlay");
    if (!node) return;
    node.classList.add("done");
    setTimeout(() => node.remove(), 350);
  }

  // --- Sunucuyu uyandırma -------------------------------------------------
  async function ping() {
    const response = await fetch(API + "/health", { cache: "no-store" });
    if (!response.ok) throw new Error("health " + response.status);
    return response.json();
  }

  async function wakeServer() {
    const startedAt = Date.now();
    let attempt = 0;
    let announcedSlow = false;

    while (Date.now() - startedAt < WAKE_TIMEOUT_MS) {
      attempt += 1;
      try {
        await ping();
        return true;
      } catch (error) {
        const waited = Date.now() - startedAt;
        if (waited > SLOW_AFTER_MS && !announcedSlow) {
          announcedSlow = true;
          setStatus("Sunucu uyandırılıyor…");
          setHint(
            "Ücretsiz sunucu uzun süre kullanılmadığında uykuya geçer. " +
              "İlk açılış yarım dakikayı bulabilir; uygulama bozuk değil.",
          );
        }
        if (announcedSlow) {
          setStatus("Sunucu uyandırılıyor… (" + Math.round(waited / 1000) + " sn)");
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    return false;
  }

  function showFailure() {
    setStatus("Sunucuya ulaşılamadı");
    setHint("İnternet bağlantını kontrol edip yeniden dene. Sorun sürerse daha sonra tekrar aç.");
    const fill = el("bootFill");
    if (fill) fill.style.animation = "none";
    const retry = el("bootRetry");
    if (retry) {
      retry.hidden = false;
      retry.onclick = () => {
        retry.hidden = true;
        if (fill) fill.style.animation = "";
        setStatus("Sunucuya bağlanılıyor…");
        setHint("");
        start();
      };
    }
  }

  // --- Sunucu istemcisi ---------------------------------------------------
  async function request(method, endpoint, body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-aricimap-token"] = token;
    const response = await fetch(API + endpoint, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      const message = (payload && payload.error) || "İstek başarısız (" + response.status + ")";
      const failure = new Error(message);
      failure.status = response.status;
      failure.payload = payload;
      throw failure;
    }
    return payload;
  }

  function storeToken(value) {
    token = value;
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.warn("ARICIMAP jeton yazılamadı", error);
    }
  }

  const api = {
    get token() {
      return token;
    },
    isOnline: false,
    currentUser: null,
    register: async (name, phone, password) => {
      const data = await request("POST", "/register", { name, phone, password });
      storeToken(data.token);
      api.currentUser = data.user;
      return data.user;
    },
    login: async (phone, password) => {
      const data = await request("POST", "/login", { phone, password });
      storeToken(data.token);
      api.currentUser = data.user;
      return data.user;
    },
    logout: async () => {
      try {
        await request("POST", "/logout");
      } catch (error) {
        console.warn("ARICIMAP çıkış isteği başarısız", error);
      }
      storeToken(null);
      api.currentUser = null;
    },
    me: async () => {
      const data = await request("GET", "/me");
      api.currentUser = data.user;
      return data.user;
    },
    users: () => request("GET", "/users").then((d) => d.users),
    decide: (id, approve, asStaff) =>
      request("POST", "/users/" + encodeURIComponent(id) + "/decide", { approve, asStaff }).then((d) => d.user),
    saveLocation: (payload) => request("PUT", "/location", payload),
    locations: () => request("GET", "/locations").then((d) => d.locations),

    // --- Bildirimler ---
    notifications: () => request("GET", "/notifications"),
    markRead: (ids) => request("POST", "/notifications/read", { ids }),

    // --- İller ve ilçeler ---
    provinces: () => request("GET", "/provinces").then((d) => d.provinces),
    districts: (province) =>
      request("GET", "/districts" + (province ? "?province=" + encodeURIComponent(province) : "")).then(
        (d) => d.districts,
      ),
    syncDistricts: (province) => request("POST", "/districts/sync", { province }),

    // --- Personel yetki başvuruları ---
    applyForStaff: (payload) => request("POST", "/staff-applications", payload).then((d) => d.application),
    applications: (status) =>
      request("GET", "/staff-applications" + (status ? "?status=" + encodeURIComponent(status) : "")).then(
        (d) => d.applications,
      ),
    decideApplication: (id, approve, options = {}) =>
      request("POST", "/staff-applications/" + encodeURIComponent(id) + "/decide", {
        approve,
        ...options,
      }).then((d) => d.application),

    // --- Saha tespiti ---
    fieldwork: (filter) =>
      request("GET", "/fieldwork/locations" + (filter && filter !== "hepsi" ? "?filter=" + filter : "")).then(
        (d) => d.locations,
      ),
    visits: (locationId) =>
      request("GET", "/fieldwork/locations/" + encodeURIComponent(locationId) + "/visits").then((d) => d.visits),
    recordVisit: (locationId, payload) =>
      request("POST", "/fieldwork/locations/" + encodeURIComponent(locationId) + "/visit", payload).then(
        (d) => d.visit,
      ),

    // --- Not defteri ---
    notes: () => request("GET", "/notebook").then((d) => d.notes),
    addNote: (payload) => request("POST", "/notebook", payload).then((d) => d.note),
    updateNote: (id, payload) =>
      request("PATCH", "/notebook/" + encodeURIComponent(id), payload).then((d) => d.note),
    deleteNote: (id) => request("DELETE", "/notebook/" + encodeURIComponent(id)),

    // --- Duyurular ---
    announcements: () => request("GET", "/announcements").then((d) => d.announcements),
    addAnnouncement: (payload) => request("POST", "/announcements", payload).then((d) => d.announcement),
    setAnnouncementActive: (id, active) =>
      request("PATCH", "/announcements/" + encodeURIComponent(id), { active }),
    deleteAnnouncement: (id) => request("DELETE", "/announcements/" + encodeURIComponent(id)),

    // --- Reklam panosu ---
    sponsor: () => request("GET", "/sponsor").then((d) => d.ad),
    sponsorClick: (id) => request("POST", "/sponsor/" + encodeURIComponent(id) + "/click"),
    ads: () => request("GET", "/ads").then((d) => d.ads),
    saveAd: (payload) => request("POST", "/ads", payload).then((d) => d.ad),
    deleteAd: (id) => request("DELETE", "/ads/" + encodeURIComponent(id)),

    // --- Konaklama talepleri ---
    stayRequests: (status) =>
      request("GET", "/stay-requests" + (status ? "?status=" + encodeURIComponent(status) : "")).then(
        (d) => d.requests,
      ),
    createStay: (payload) => request("POST", "/stay-requests", payload).then((d) => d.request),
    decideStay: (id, status, decisionNote) =>
      request("POST", "/stay-requests/" + encodeURIComponent(id) + "/decide", {
        status,
        decisionNote,
      }).then((d) => d.request),
  };

  window.aricimapApi = api;

  async function start() {
    const awake = await wakeServer();
    if (!awake) {
      api.isOnline = false;
      showFailure();
      window.dispatchEvent(new CustomEvent("aricimap:offline"));
      return;
    }

    api.isOnline = true;
    setStatus("Oturum kontrol ediliyor…");
    setHint("");

    if (token) {
      try {
        await api.me();
      } catch (error) {
        // Jeton süresi dolmuş veya sunucu sıfırlanmış olabilir.
        if (error.status === 401) storeToken(null);
        api.currentUser = null;
      }
    }

    hideOverlay();
    window.dispatchEvent(new CustomEvent("aricimap:ready", { detail: { user: api.currentUser } }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
