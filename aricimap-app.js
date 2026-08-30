/**
 * ARICIMAP uygulama katmanı.
 *
 * Görünürlük ve yetki kuralları sunucuda uygulanır; buradaki rol ayrımı
 * yalnızca arayüzü biçimlendirir. İstemci bir güvenlik sınırı değildir:
 * personel olmayan biri bu dosyayı değiştirse bile sunucu ona başkasının
 * konumunu döndürmez.
 */
(function () {
  "use strict";

  var api = window.aricimapApi;
  // Uygulama Türkiye geneline açıktır; harita ülke görünümüyle başlar ve
  // kullanıcının kendi kayıtları geldiğinde onlara yakınlaşır.
  var TURKIYE_MERKEZ = [39.0, 35.2];
  var TURKIYE_ZOOM = 6;
  var TR_ILLER = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Şanlıurfa','Siirt','Sinop','Sivas','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'];

  var state = {
    user: null,
    page: "harita",
    map: null,
    markers: [],
    notifications: [],
    unread: 0,
    fieldwork: [],
    fieldFilter: "hepsi",
    notes: [],
    applications: [],
    districts: [],
    myLocation: null,
    picking: false,
    picked: null,
  };

  // --- Yardımcılar ---------------------------------------------------------

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var toastTimer = null;
  function toast(message) {
    var el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 3200);
  }

  function tarih(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function rolAdi(user) {
    if (!user) return "";
    if (user.role === "yonetici") return "Yönetici";
    if (user.role === "personel") return "Personel" + (user.staffCode ? " · " + user.staffCode : "") +
      (user.district ? " · " + user.district : " · bölge atanmadı");
    return "Arıcı";
  }

  function yetkili() {
    return state.user && (state.user.role === "personel" || state.user.role === "yonetici");
  }

  function openSheet(html) {
    $("sheetContent").innerHTML = html;
    $("sheet").classList.add("open");
  }

  function closeSheet() {
    $("sheet").classList.remove("open");
    $("sheetContent").innerHTML = "";
  }

  function hata(container, message) {
    container.innerHTML = '<div class="error">' + esc(message) + "</div>";
  }

  /** Sunucu hatasını kullanıcıya anlaşılır biçimde gösterir. */
  function bildirHata(error) {
    toast(error && error.message ? error.message : "İşlem tamamlanamadı.");
  }

  // --- Giriş / kayıt -------------------------------------------------------

  function showAuth() {
    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
  }

  function showApp() {
    $("authView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("userName").textContent = state.user.name;
    $("userRole").textContent = rolAdi(state.user);
    buildNav();
    goto(state.page);
    refreshNotifications();
  }

  function wireAuth() {
    $("tabLogin").onclick = function () {
      $("tabLogin").classList.add("on");
      $("tabRegister").classList.remove("on");
      $("loginForm").classList.remove("hidden");
      $("registerForm").classList.add("hidden");
      $("authMsg").innerHTML = "";
    };
    $("tabRegister").onclick = function () {
      $("tabRegister").classList.add("on");
      $("tabLogin").classList.remove("on");
      $("registerForm").classList.remove("hidden");
      $("loginForm").classList.add("hidden");
      $("authMsg").innerHTML = "";
    };

    $("loginForm").onsubmit = function (event) {
      event.preventDefault();
      var phone = $("loginPhone").value.trim();
      var password = $("loginPassword").value;
      if (!phone || !password) {
        hata($("authMsg"), "Telefon ve parola gerekli.");
        return;
      }
      api
        .login(phone, password)
        .then(function (user) {
          state.user = user;
          showApp();
        })
        .catch(function (error) {
          hata($("authMsg"), error.message);
        });
    };

    $("registerForm").onsubmit = function (event) {
      event.preventDefault();
      var name = $("regName").value.trim();
      var phone = $("regPhone").value.trim();
      var password = $("regPassword").value;
      if (name.length < 3) return hata($("authMsg"), "Ad soyad en az 3 karakter olmalı.");
      if (phone.replace(/\D/g, "").length < 10) return hata($("authMsg"), "Geçerli bir telefon girin.");
      if (password.length < 6) return hata($("authMsg"), "Parola en az 6 karakter olmalı.");
      api
        .register(name, phone, password)
        .then(function (user) {
          state.user = user;
          showApp();
          toast("Hoş geldin " + user.name);
        })
        .catch(function (error) {
          hata($("authMsg"), error.message);
        });
    };

    $("logoutBtn").onclick = function () {
      api.logout().then(function () {
        state.user = null;
        state.page = "harita";
        showAuth();
      });
    };

    $("bellBtn").onclick = function () {
      goto("kutu");
    };

    $("sheet").onclick = function (event) {
      if (event.target === $("sheet")) closeSheet();
    };
  }

  // --- Gezinme -------------------------------------------------------------

  function sayfalar() {
    var list = [{ id: "harita", ic: "🗺", ad: "Harita" }, { id: "kutu", ic: "✉", ad: "Kutu" }];
    if (yetkili()) {
      list.push({ id: "saha", ic: "✓", ad: "Saha" });
      list.push({ id: "defter", ic: "▤", ad: "Defter" });
    }
    if (state.user && state.user.role === "yonetici") {
      list.push({ id: "yonetim", ic: "⚙", ad: "Yönetim" });
    }
    list.push({ id: "hesap", ic: "◍", ad: "Hesap" });
    return list;
  }

  function buildNav() {
    var nav = $("bottomNav");
    nav.innerHTML = sayfalar()
      .map(function (p) {
        return (
          '<button data-page="' + p.id + '"><span class="ic">' + p.ic + "</span>" + esc(p.ad) + "</button>"
        );
      })
      .join("");
    Array.prototype.forEach.call(nav.querySelectorAll("[data-page]"), function (b) {
      b.onclick = function () {
        goto(b.dataset.page);
      };
    });
  }

  function goto(page) {
    var known = sayfalar().map(function (p) {
      return p.id;
    });
    if (known.indexOf(page) === -1) page = "harita";
    state.page = page;

    ["harita", "kutu", "saha", "defter", "yonetim", "hesap"].forEach(function (id) {
      var el = $("page" + id.charAt(0).toUpperCase() + id.slice(1));
      if (el) el.classList.toggle("hidden", id !== page);
    });
    Array.prototype.forEach.call($("bottomNav").querySelectorAll("[data-page]"), function (b) {
      b.classList.toggle("on", b.dataset.page === page);
    });

    if (page === "harita") renderHarita();
    if (page === "kutu") renderKutu();
    if (page === "saha") renderSaha();
    if (page === "defter") renderDefter();
    if (page === "yonetim") renderYonetim();
    if (page === "hesap") renderHesap();
  }

  // --- Harita --------------------------------------------------------------

  function ensureMap() {
    if (state.map || !window.L) return state.map;
    state.map = L.map("map", { zoomControl: true }).setView(TURKIYE_MERKEZ, TURKIYE_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap katkıda bulunanları",
    }).addTo(state.map);

    state.map.on("click", function (event) {
      if (!state.picking) return;
      state.picked = { lat: event.latlng.lat, lng: event.latlng.lng };
      state.picking = false;
      renderHarita();
      toast("Konum seçildi. Kaydetmeyi unutma.");
    });
    return state.map;
  }

  function isaret(color) {
    return L.divIcon({
      className: "",
      html:
        '<div style="width:16px;height:16px;border-radius:50%;background:' +
        color +
        ';border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  function drawMarkers(rows) {
    var map = ensureMap();
    if (!map) return;
    state.markers.forEach(function (m) {
      map.removeLayer(m);
    });
    state.markers = [];
    rows.forEach(function (row) {
      // Kırmızı: henüz tespit edilmemiş. Yeşil: gidildi işaretlenmiş.
      var color = row.inspected ? "#31794d" : "#b95748";
      var marker = L.marker([row.lat, row.lng], { icon: isaret(color) }).addTo(map);
      marker.bindPopup(
        "<b>" +
          esc(row.ownerName || "Konumum") +
          "</b><br>" +
          (row.hives ? esc(row.hives) + " kovan<br>" : "") +
          (row.place ? esc(row.place) + "<br>" : "") +
          '<span style="color:#728072;font-size:11px">' +
          tarih(row.updatedAt) +
          "</span>",
      );
      state.markers.push(marker);
    });
    if (rows.length) {
      var bounds = L.latLngBounds(
        rows.map(function (r) {
          return [r.lat, r.lng];
        }),
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }

  function renderHarita() {
    var page = $("pageHarita");
    if (!page.dataset.built) {
      page.innerHTML =
        '<div class="card"><div id="map"></div>' +
        '<div class="legend"><span><i style="background:#b95748"></i>Tespit edilmedi</span>' +
        '<span><i style="background:#31794d"></i>Tespit edildi</span></div></div>' +
        '<div id="duyuruBox"></div>' +
        '<div id="haritaPanel"></div>' +
        '<div id="konaklamaBox"></div>' +
        '<div id="sponsorBox"></div>';
      page.dataset.built = "1";
    }
    ensureMap();
    // Kap boyutu geç oturabiliyor (iframe, ekran dönmesi, klavye açılması).
    [60, 300, 900].forEach(function (gecikme) {
      setTimeout(function () {
        if (state.map) state.map.invalidateSize();
      }, gecikme);
    });

    if (yetkili()) renderSahaHarita();
    else renderAriciHarita();
    renderDuyurular();
    renderKonaklama();
    renderSponsor();
  }

  // --- Duyurular -----------------------------------------------------------

  function renderDuyurular() {
    var box = $("duyuruBox");
    if (!box) return;
    api
      .announcements()
      .then(function (list) {
        var yayinda = list.filter(function (a) {
          return a.active;
        });
        if (!yayinda.length) {
          box.innerHTML = "";
          return;
        }
        box.innerHTML =
          '<div class="card"><div class="overline">Duyurular</div>' +
          yayinda
            .slice(0, 5)
            .map(function (a) {
              var renk = a.level === "acil" ? "red" : a.level === "uyari" ? "honey" : "grey";
              return (
                '<div class="list-item"><div class="row"><div class="grow">' +
                "<h4>" + esc(a.title) + "</h4>" +
                (a.body ? '<div class="muted" style="white-space:pre-wrap">' + esc(a.body) + "</div>" : "") +
                '<div class="muted" style="margin-top:3px">' + tarih(a.createdAt) + "</div>" +
                '</div><span class="pill ' + renk + '">' + esc(a.level) + "</span></div></div>"
              );
            })
            .join("") +
          "</div>";
      })
      .catch(function () {
        box.innerHTML = "";
      });
  }

  // --- Sponsor panosu ------------------------------------------------------

  function renderSponsor() {
    var box = $("sponsorBox");
    if (!box) return;
    api
      .sponsor()
      .then(function (ad) {
        if (!ad) {
          box.innerHTML = "";
          return;
        }
        var link = ad.whatsapp
          ? "https://wa.me/" + ad.whatsapp
          : ad.phone
            ? "tel:" + ad.phone
            : ad.website || "";
        box.innerHTML =
          '<div class="card" style="border-color:#e8d9ae;background:#fffdf5">' +
          '<div class="overline" style="color:#a07a17">Sponsor</div>' +
          '<h4 style="margin:6px 0 3px;font-size:14px">' + esc(ad.company) + "</h4>" +
          (ad.title ? '<div style="font-size:13px">' + esc(ad.title) + "</div>" : "") +
          (ad.description ? '<div class="muted" style="margin-top:4px">' + esc(ad.description) + "</div>" : "") +
          (link
            ? '<button class="btn honey small" id="sponsorBtn" style="margin-top:10px">' +
              esc(ad.cta || "İletişime geç") + "</button>"
            : "") +
          "</div>";
        if ($("sponsorBtn")) {
          $("sponsorBtn").onclick = function () {
            api.sponsorClick(ad.id).catch(function () {});
            window.open(link, "_blank", "noopener");
          };
        }
      })
      .catch(function () {
        box.innerHTML = "";
      });
  }

  // --- Konaklama talepleri -------------------------------------------------

  function stayEtiket(status) {
    if (status === "yer_ayrildi") return '<span class="pill green">yer ayrıldı</span>';
    if (status === "yer_yok") return '<span class="pill red">yer yok</span>';
    return '<span class="pill honey">bekliyor</span>';
  }

  function renderKonaklama() {
    var box = $("konaklamaBox");
    if (!box) return;
    var yetki = yetkili();
    box.innerHTML =
      '<div class="card"><div class="row" style="margin-bottom:8px">' +
      '<div class="grow"><div class="overline">Konaklama talepleri</div></div>' +
      (yetki ? "" : '<button class="btn honey small" id="stayNew">Talep oluştur</button>') +
      "</div><div id=\"stayList\"><div class=\"empty\">Yükleniyor…</div></div></div>";

    if ($("stayNew")) $("stayNew").onclick = openStaySheet;
    loadStay();
  }

  function loadStay() {
    api
      .stayRequests()
      .then(function (list) {
        var box = $("stayList");
        if (!box) return;
        if (!list.length) {
          box.innerHTML = '<div class="empty">Kayıtlı talep yok.</div>';
          return;
        }
        var yetki = yetkili();
        box.innerHTML = list
          .map(function (r) {
            return (
              '<div class="list-item"><div class="row"><div class="grow">' +
              "<h4>" + esc(r.ownerName) + "</h4>" +
              '<div class="muted">' +
              (r.district ? esc(r.district) : "bölge yok") +
              (r.hives ? " · " + esc(r.hives) + " kovan" : "") +
              (r.fromDate ? " · " + esc(r.fromDate) : "") +
              (r.toDate ? " → " + esc(r.toDate) : "") +
              "</div>" +
              (r.ownerPhone ? '<div class="muted">☎ ' + esc(r.ownerPhone) + "</div>" : "") +
              (r.note ? '<div class="muted">' + esc(r.note) + "</div>" : "") +
              (r.decisionNote ? '<div class="muted">Karar: ' + esc(r.decisionNote) + "</div>" : "") +
              "</div>" + stayEtiket(r.status) + "</div>" +
              (yetki && r.status === "beklemede"
                ? '<div class="row" style="margin-top:9px">' +
                  '<button class="btn small grow" data-stay-ok="' + esc(r.id) + '">Yer ayır</button>' +
                  '<button class="btn danger small" data-stay-no="' + esc(r.id) + '">Yer yok</button></div>'
                : "") +
              "</div>"
            );
          })
          .join("");

        Array.prototype.forEach.call(box.querySelectorAll("[data-stay-ok]"), function (b) {
          b.onclick = function () {
            karar(b.dataset.stayOk, "yer_ayrildi");
          };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-stay-no]"), function (b) {
          b.onclick = function () {
            karar(b.dataset.stayNo, "yer_yok");
          };
        });
      })
      .catch(function (error) {
        var box = $("stayList");
        if (box) box.innerHTML = '<div class="error">' + esc(error.message) + "</div>";
      });
  }

  function karar(id, status) {
    api
      .decideStay(id, status, "")
      .then(function () {
        toast(status === "yer_ayrildi" ? "Yer ayrıldı, arıcıya bildirildi." : "Arıcıya bildirildi.");
        loadStay();
      })
      .catch(bildirHata);
  }

  function openStaySheet() {
    var secili = state.picked || (state.myLocation ? { lat: state.myLocation.lat, lng: state.myLocation.lng } : null);
    openSheet(
      "<h3>Konaklama talebi</h3>" +
      '<p class="muted" style="margin:0 0 14px">Gitmek istediğin bölgeyi bildir. Talep, o ilçenin sorumlusuna iletilir.</p>' +
      '<div class="card">' +
      '<div class="muted" style="margin-bottom:10px">' +
      (secili ? "Konum: " + secili.lat.toFixed(5) + ", " + secili.lng.toFixed(5)
              : "Önce haritadan veya GPS ile bir konum seç.") +
      "</div>" +
      '<label>Kovan sayısı<input id="stayHives" type="number" inputmode="numeric" min="0" /></label>' +
      '<label>Başlangıç<input id="stayFrom" type="date" /></label>' +
      '<label>Bitiş<input id="stayTo" type="date" /></label>' +
      '<label>Not<textarea id="stayNote" placeholder="Örn: 120 kovanla iki hafta kalmak istiyorum."></textarea></label>' +
      '<div class="row"><button class="btn grow" id="staySave">Gönder</button>' +
      '<button class="btn ghost" id="stayClose">Kapat</button></div></div>',
    );
    $("stayClose").onclick = closeSheet;
    $("staySave").onclick = function () {
      if (!secili) return toast("Önce haritadan veya GPS ile konum seç.");
      var raw = $("stayHives").value.trim();
      var hives = raw === "" ? null : Number(raw);
      if (hives !== null && (!Number.isInteger(hives) || hives < 0)) {
        return toast("Kovan sayısı 0 veya daha büyük tam sayı olmalı.");
      }
      api
        .createStay({
          lat: secili.lat,
          lng: secili.lng,
          hives: hives,
          fromDate: $("stayFrom").value || null,
          toDate: $("stayTo").value || null,
          note: $("stayNote").value.trim(),
        })
        .then(function (request) {
          closeSheet();
          toast(request.district ? request.district + " sorumlusuna iletildi." : "Talep oluşturuldu.");
          loadStay();
        })
        .catch(bildirHata);
    };
  }

  function renderAriciHarita() {
    var panel = $("haritaPanel");
    var loc = state.myLocation;
    var secili = state.picked || (loc ? { lat: loc.lat, lng: loc.lng } : null);

    panel.innerHTML =
      '<div class="card">' +
      '<div class="overline">Arılık konumum</div>' +
      '<p class="muted" style="margin:6px 0 12px">Konumun yalnızca bölgenden sorumlu personele ve yöneticiye görünür. Diğer arıcılar göremez.</p>' +
      '<div class="row wrap" style="margin-bottom:12px">' +
      '<button class="btn honey small" id="gpsBtn">⌖ GPS konumum</button>' +
      '<button class="btn ghost small" id="pickBtn">' +
      (state.picking ? "Haritaya dokun…" : "Haritada seç") +
      "</button></div>" +
      '<div class="muted" style="margin-bottom:12px">' +
      (secili
        ? "Seçili: " + secili.lat.toFixed(5) + ", " + secili.lng.toFixed(5)
        : "Henüz konum seçilmedi.") +
      "</div>" +
      '<label>Kovan sayısı<input id="hiveInput" type="number" inputmode="numeric" min="0" value="' +
      (loc && loc.hives !== null && loc.hives !== undefined ? esc(loc.hives) : "") +
      '" /></label>' +
      '<label>Yer tarifi<input id="placeInput" value="' + esc(loc ? loc.place : "") + '" /></label>' +
      '<label>Not<textarea id="noteInput">' + esc(loc ? loc.note : "") + "</textarea></label>" +
      '<button class="btn full" id="saveLocBtn">Konumu kaydet</button>' +
      (loc
        ? '<p class="muted" style="margin:10px 0 0">Son güncelleme: ' + tarih(loc.updatedAt) + "</p>"
        : "") +
      "</div>";

    $("gpsBtn").onclick = function () {
      if (!navigator.geolocation) return toast("Cihaz konum servisini desteklemiyor.");
      toast("Konum alınıyor…");
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          state.picked = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (state.map) state.map.setView([state.picked.lat, state.picked.lng], 15);
          renderAriciHarita();
          toast("GPS konumu alındı.");
        },
        function () {
          toast("Konum alınamadı. İzin verildiğinden emin ol.");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    };

    $("pickBtn").onclick = function () {
      state.picking = !state.picking;
      renderAriciHarita();
      if (state.picking) toast("Haritada arılığının yerine dokun.");
    };

    $("saveLocBtn").onclick = function () {
      var target = state.picked || (loc ? { lat: loc.lat, lng: loc.lng } : null);
      if (!target) return toast("Önce GPS ile veya haritadan konum seç.");
      var raw = $("hiveInput").value.trim();
      var hives = raw === "" ? null : Number(raw);
      if (hives !== null && (!Number.isInteger(hives) || hives < 0)) {
        return toast("Kovan sayısı 0 veya daha büyük tam sayı olmalı.");
      }
      api
        .saveLocation({
          lat: target.lat,
          lng: target.lng,
          hives: hives,
          place: $("placeInput").value.trim(),
          note: $("noteInput").value.trim(),
          source: "GPS",
        })
        .then(function (result) {
          state.picked = null;
          toast(
            result.district
              ? result.district + " sorumlusuna bildirildi."
              : "Konum kaydedildi.",
          );
          return loadMyLocation();
        })
        .catch(bildirHata);
    };

    var cizilecek = [];
    if (loc) {
      cizilecek.push({
        lat: loc.lat, lng: loc.lng, hives: loc.hives, place: loc.place,
        updatedAt: loc.updatedAt, inspected: true, ownerName: "Kayıtlı konumum",
      });
    }
    // Henüz kaydedilmemiş seçim de haritada görünmeli; yoksa kullanıcı nereye
    // dokunduğunu göremiyor.
    if (state.picked) {
      cizilecek.push({
        lat: state.picked.lat, lng: state.picked.lng,
        inspected: false, ownerName: "Yeni seçim (kaydedilmedi)",
      });
    }
    drawMarkers(cizilecek);
  }

  function renderSahaHarita() {
    var panel = $("haritaPanel");
    panel.innerHTML =
      '<div class="card"><div class="overline">Bölgemdeki arılıklar</div>' +
      '<p class="muted" style="margin:6px 0 0" id="haritaOzet">Yükleniyor…</p></div>';
    api
      .fieldwork("hepsi")
      .then(function (rows) {
        state.fieldwork = rows;
        drawMarkers(rows);
        var edilen = rows.filter(function (r) {
          return r.inspected;
        }).length;
        $("haritaOzet").innerHTML =
          rows.length === 0
            ? "Sorumlu olduğun bölgede henüz konum paylaşımı yok."
            : "<b>" + rows.length + "</b> arılık · <b>" + edilen + "</b> tespit edildi · <b>" +
              (rows.length - edilen) + "</b> bekliyor";
      })
      .catch(function (error) {
        $("haritaOzet").textContent = error.message;
      });
  }

  function loadMyLocation() {
    return api
      .locations()
      .then(function (rows) {
        state.myLocation = rows.length ? rows[0] : null;
        if (state.page === "harita" && !yetkili()) renderAriciHarita();
      })
      .catch(function () {
        state.myLocation = null;
      });
  }

  // --- Mesaj kutusu --------------------------------------------------------

  function refreshNotifications() {
    return api
      .notifications()
      .then(function (data) {
        state.notifications = data.notifications;
        state.unread = data.unread;
        var badge = $("bellCount");
        badge.textContent = data.unread;
        badge.classList.toggle("hidden", !data.unread);
        if (state.page === "kutu") renderKutu(true);
      })
      .catch(function () {});
  }

  function renderKutu(skipRefresh) {
    // Kutu açılırken sunucudan tazelenir; yoksa kullanıcı eski listeyi görür
    // ve yeni bildirimi kaçırdığını sanır.
    if (!skipRefresh) {
      api
        .notifications()
        .then(function (data) {
          state.notifications = data.notifications;
          state.unread = data.unread;
          var badge = $("bellCount");
          badge.textContent = data.unread;
          badge.classList.toggle("hidden", !data.unread);
          if (state.page === "kutu") renderKutu(true);
        })
        .catch(function () {});
    }
    var page = $("pageKutu");
    var list = state.notifications;
    page.innerHTML =
      '<div class="card"><div class="row" style="margin-bottom:8px">' +
      '<div class="grow"><div class="overline">Mesaj kutusu</div></div>' +
      (state.unread ? '<button class="btn ghost small" id="readAllBtn">Tümünü okundu say</button>' : "") +
      "</div>" +
      (list.length
        ? list
            .map(function (n) {
              return (
                '<div class="list-item">' +
                '<div class="row"><div class="grow"><h4>' +
                esc(n.title) +
                "</h4>" +
                (n.body ? '<div class="muted">' + esc(n.body) + "</div>" : "") +
                '<div class="muted" style="margin-top:3px">' +
                (n.district ? esc(n.district) + " · " : "") +
                tarih(n.createdAt) +
                "</div></div>" +
                (n.readAt ? "" : '<span class="pill honey">yeni</span>') +
                "</div></div>"
              );
            })
            .join("")
        : '<div class="empty">Henüz bildirim yok.</div>') +
      "</div>";

    if ($("readAllBtn")) {
      $("readAllBtn").onclick = function () {
        var ids = state.notifications
          .filter(function (n) {
            return !n.readAt;
          })
          .map(function (n) {
            return n.id;
          });
        api.markRead(ids).then(refreshNotifications).catch(bildirHata);
      };
    }
  }

  // --- Saha tespiti --------------------------------------------------------

  function renderSaha() {
    var page = $("pageSaha");
    var filtreler = [
      { id: "hepsi", ad: "Hepsi" },
      { id: "tespit_edilmeyen", ad: "Bekleyen" },
      { id: "tespit_edilen", ad: "Tespit edilen" },
    ];
    page.innerHTML =
      '<div class="card"><div class="overline">Saha tespiti</div>' +
      '<div class="tabs" style="margin:10px 0 4px">' +
      filtreler
        .map(function (f) {
          return (
            '<button data-filter="' + f.id + '"' +
            (state.fieldFilter === f.id ? ' class="on"' : "") +
            ">" + esc(f.ad) + "</button>"
          );
        })
        .join("") +
      '</div><div id="sahaList"><div class="empty">Yükleniyor…</div></div></div>';

    Array.prototype.forEach.call(page.querySelectorAll("[data-filter]"), function (b) {
      b.onclick = function () {
        state.fieldFilter = b.dataset.filter;
        renderSaha();
      };
    });
    loadSaha();
  }

  function loadSaha() {
    api
      .fieldwork(state.fieldFilter)
      .then(function (rows) {
        var box = $("sahaList");
        if (!box) return;
        if (!rows.length) {
          box.innerHTML =
            '<div class="empty">' +
            (state.user.role === "personel" && !state.user.district
              ? "Henüz bir bölgeye atanmadın. Yönetici bölge atadığında burası dolacak."
              : "Bu listede kayıt yok.") +
            "</div>";
          return;
        }
        box.innerHTML = rows
          .map(function (r) {
            return (
              '<div class="list-item"><div class="row">' +
              '<div class="grow"><h4>' + esc(r.ownerName) + "</h4>" +
              '<div class="muted">' +
              (r.hives ? esc(r.hives) + " kovan · " : "") +
              (r.district ? esc(r.district) : "bölge yok") +
              (r.place ? " · " + esc(r.place) : "") +
              "</div>" +
              (r.ownerPhone ? '<div class="muted">☎ ' + esc(r.ownerPhone) + "</div>" : "") +
              (r.lastVisit
                ? '<div class="muted" style="margin-top:3px">Son: ' +
                  tarih(r.lastVisit.at) +
                  (r.lastVisit.hiveCount !== null ? " · " + esc(r.lastVisit.hiveCount) + " kovan" : "") +
                  (r.lastVisit.note ? " · " + esc(r.lastVisit.note) : "") +
                  "</div>"
                : "") +
              "</div>" +
              '<span class="pill ' + (r.inspected ? "green" : "red") + '">' +
              (r.inspected ? "gidildi" : "bekliyor") + "</span>" +
              "</div>" +
              '<div class="row" style="margin-top:9px">' +
              '<button class="btn small" data-visit="' + esc(r.id) + '">Tespit gir</button>' +
              '<button class="btn ghost small" data-tel="' + esc(r.ownerPhone || "") + '">Ara</button>' +
              '<button class="btn ghost small" data-focus="' + esc(r.id) + '">Haritada</button>' +
              "</div></div>"
            );
          })
          .join("");

        Array.prototype.forEach.call(box.querySelectorAll("[data-visit]"), function (b) {
          b.onclick = function () {
            openVisitSheet(rows.find(function (r) { return r.id === b.dataset.visit; }));
          };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-tel]"), function (b) {
          b.onclick = function () {
            if (!b.dataset.tel) return toast("Telefon bilgisi yok.");
            window.location.href = "tel:" + b.dataset.tel.replace(/[^\d+]/g, "");
          };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-focus]"), function (b) {
          b.onclick = function () {
            var row = rows.find(function (r) { return r.id === b.dataset.focus; });
            if (!row) return;
            goto("harita");
            setTimeout(function () {
              if (state.map) state.map.setView([row.lat, row.lng], 15);
            }, 120);
          };
        });
      })
      .catch(function (error) {
        var box = $("sahaList");
        if (box) box.innerHTML = '<div class="error">' + esc(error.message) + "</div>";
      });
  }

  function openVisitSheet(row) {
    if (!row) return;
    openSheet(
      "<h3>" + esc(row.ownerName) + "</h3>" +
      '<p class="muted" style="margin:0 0 14px">' +
      (row.district ? esc(row.district) + " · " : "") +
      (row.ownerPhone ? esc(row.ownerPhone) : "") + "</p>" +
      '<div class="card">' +
      '<label>Durum<select id="visitStatus">' +
      '<option value="gidildi">Gidildi — tespit yapıldı</option>' +
      '<option value="gidilmedi">Gidilmedi / bulunamadı</option>' +
      "</select></label>" +
      '<label>Sayılan kovan<input id="visitHives" type="number" inputmode="numeric" min="0" value="' +
      (row.lastVisit && row.lastVisit.hiveCount !== null ? esc(row.lastVisit.hiveCount) : "") +
      '" /></label>' +
      '<label>Not<textarea id="visitNote" placeholder="Örn: 520 kovan, 12.08.2026 tarihinde saydım"></textarea></label>' +
      '<div class="row"><button class="btn grow" id="visitSave">Kaydet</button>' +
      '<button class="btn ghost" id="visitClose">Kapat</button></div>' +
      "</div>" +
      '<div class="card"><div class="overline">Geçmiş kayıtlar</div><div id="visitHistory"><div class="empty">Yükleniyor…</div></div></div>',
    );

    $("visitClose").onclick = closeSheet;
    $("visitSave").onclick = function () {
      var raw = $("visitHives").value.trim();
      var hives = raw === "" ? null : Number(raw);
      if (hives !== null && (!Number.isInteger(hives) || hives < 0)) {
        return toast("Kovan sayısı 0 veya daha büyük tam sayı olmalı.");
      }
      api
        .recordVisit(row.id, {
          status: $("visitStatus").value,
          hiveCount: hives,
          note: $("visitNote").value.trim(),
        })
        .then(function () {
          closeSheet();
          toast("Tespit kaydedildi.");
          loadSaha();
        })
        .catch(bildirHata);
    };

    api
      .visits(row.id)
      .then(function (list) {
        var box = $("visitHistory");
        if (!box) return;
        box.innerHTML = list.length
          ? list
              .map(function (v) {
                return (
                  '<div class="list-item"><div class="row"><div class="grow">' +
                  "<b>" + esc(v.staffName) + "</b>" +
                  '<div class="muted">' + tarih(v.createdAt) +
                  (v.hiveCount !== null ? " · " + esc(v.hiveCount) + " kovan" : "") + "</div>" +
                  (v.note ? '<div class="muted">' + esc(v.note) + "</div>" : "") +
                  '</div><span class="pill ' + (v.status === "gidildi" ? "green" : "grey") + '">' +
                  esc(v.status) + "</span></div></div>"
                );
              })
              .join("")
          : '<div class="empty">Henüz kayıt yok.</div>';
      })
      .catch(function () {});
  }

  // --- Not defteri ---------------------------------------------------------

  function renderDefter() {
    var page = $("pageDefter");
    page.innerHTML =
      '<div class="card"><div class="overline">Not defteri</div>' +
      '<p class="muted" style="margin:6px 0 12px">Bu notlar yalnızca sana görünür. Başka personel ve yönetici göremez.</p>' +
      '<label>Başlık<input id="noteTitle" placeholder="Örn: haftalık saha turu" /></label>' +
      '<label>İçerik<textarea id="noteBody" placeholder="Tespit sırasında aklında kalanları buraya yaz."></textarea></label>' +
      '<button class="btn full" id="noteAdd">Not ekle</button></div>' +
      '<div class="card"><div class="overline">Kayıtlı notlar</div>' +
      '<div id="noteList"><div class="empty">Yükleniyor…</div></div></div>';

    $("noteAdd").onclick = function () {
      var title = $("noteTitle").value.trim();
      var body = $("noteBody").value.trim();
      if (!title && !body) return toast("Başlık veya içerik yaz.");
      api
        .addNote({ title: title, body: body, district: state.user.district || null })
        .then(function () {
          $("noteTitle").value = "";
          $("noteBody").value = "";
          toast("Not kaydedildi.");
          loadNotes();
        })
        .catch(bildirHata);
    };
    loadNotes();
  }

  function loadNotes() {
    api
      .notes()
      .then(function (list) {
        state.notes = list;
        var box = $("noteList");
        if (!box) return;
        box.innerHTML = list.length
          ? list
              .map(function (n) {
                return (
                  '<div class="list-item"><div class="row"><div class="grow">' +
                  "<h4>" + esc(n.title || "(başlıksız)") + "</h4>" +
                  (n.body ? '<div class="muted" style="white-space:pre-wrap">' + esc(n.body) + "</div>" : "") +
                  '<div class="muted" style="margin-top:3px">' + tarih(n.updatedAt) +
                  (n.district ? " · " + esc(n.district) : "") + "</div></div>" +
                  '<button class="btn ghost small" data-del="' + esc(n.id) + '">Sil</button>' +
                  "</div></div>"
                );
              })
              .join("")
          : '<div class="empty">Henüz not yok.</div>';

        Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function (b) {
          b.onclick = function () {
            api
              .deleteNote(b.dataset.del)
              .then(function () {
                toast("Not silindi.");
                loadNotes();
              })
              .catch(bildirHata);
          };
        });
      })
      .catch(function (error) {
        var box = $("noteList");
        if (box) box.innerHTML = '<div class="error">' + esc(error.message) + "</div>";
      });
  }

  // --- Yönetim -------------------------------------------------------------

  function renderYonetim() {
    var page = $("pageYonetim");
    page.innerHTML =
      '<div class="card"><div class="overline">Personel yetki başvuruları</div>' +
      '<div id="appList"><div class="empty">Yükleniyor…</div></div></div>' +
      '<div class="card"><div class="overline">İlçe sınırları</div>' +
      '<p class="muted" style="margin:6px 0 10px">Bildirimlerin doğru personele gitmesi için ilçe sınırlarının bir kez yüklenmesi gerekir.</p>' +
      '<div class="row"><select id="syncProvince" class="grow"><option value="">İl seç…</option>' +
      TR_ILLER.map(function (il) {
        return '<option value="' + esc(il) + '">' + esc(il) + "</option>";
      }).join("") +
      '</select><button class="btn" id="syncBtn">Yükle</button></div>' +
      '<div id="yukluIller" class="muted" style="margin-top:8px"></div>' +
      '<p class="muted" style="margin:9px 0 0" id="syncInfo"></p></div>' +
      '<div class="card"><div class="overline">Duyuru yayınla</div>' +
      '<label>Başlık<input id="duyuruTitle" /></label>' +
      '<label>İçerik<textarea id="duyuruBody"></textarea></label>' +
      '<label>Önem<select id="duyuruLevel"><option value="bilgi">Bilgi</option>' +
      '<option value="uyari">Uyarı</option><option value="acil">Acil</option></select></label>' +
      '<label>Kapsam<select id="duyuruIl"><option value="">Türkiye geneli</option>' +
      TR_ILLER.map(function (il) { return '<option value="' + esc(il) + '">' + esc(il) + "</option>"; }).join("") +
      "</select></label>" +
      '<label>İlçe (boş bırakılırsa il geneli)<select id="duyuruIlce"><option value="">İl geneli</option></select></label>' +
      '<button class="btn full" id="duyuruAdd">Yayınla</button>' +
      '<div id="duyuruYonetim" style="margin-top:12px"></div></div>' +
      '<div class="card"><div class="overline">Reklam panosu</div>' +
      '<label>Firma<input id="adCompany" /></label>' +
      '<label>Başlık<input id="adTitle" /></label>' +
      '<label>Açıklama<textarea id="adDescription"></textarea></label>' +
      '<label>Düğme metni<input id="adCta" placeholder="Teklif al" /></label>' +
      '<label>Web sitesi<input id="adWebsite" placeholder="https://" /></label>' +
      '<label>WhatsApp<input id="adWhatsapp" inputmode="numeric" placeholder="905XXXXXXXXX" /></label>' +
      '<div class="row"><label class="grow">Başlangıç<input id="adStart" type="date" /></label>' +
      '<label class="grow">Bitiş<input id="adEnd" type="date" /></label></div>' +
      '<button class="btn full" id="adSave">Reklamı kaydet</button>' +
      '<div id="adList" style="margin-top:12px"></div></div>';

    $("syncBtn").onclick = function () {
      var il = $("syncProvince").value;
      if (!il) return toast("Önce bir il seç.");
      $("syncInfo").textContent = "OpenStreetMap'ten alınıyor, bu biraz sürebilir…";
      api
        .syncDistricts(il)
        .then(function (result) {
          $("syncInfo").textContent =
            il + ": " + result.saved + " ilçe kaydedildi" +
            (result.skipped ? ", " + result.skipped + " atlandı" : "") + ".";
          loadProvinces();
          return loadDistricts();
        })
        .catch(function (error) {
          $("syncInfo").textContent = error.message;
        });
    };

    $("duyuruAdd").onclick = function () {
      var title = $("duyuruTitle").value.trim();
      if (title.length < 3) return toast("Duyuru başlığı en az 3 karakter olmalı.");
      api
        .addAnnouncement({
          title: title,
          body: $("duyuruBody").value.trim(),
          level: $("duyuruLevel").value,
          province: $("duyuruIl").value || null,
          district: $("duyuruIlce").value || null,
        })
        .then(function () {
          $("duyuruTitle").value = "";
          $("duyuruBody").value = "";
          toast("Duyuru yayınlandı.");
          loadDuyuruYonetim();
        })
        .catch(bildirHata);
    };

    $("adSave").onclick = function () {
      var company = $("adCompany").value.trim();
      if (company.length < 2) return toast("Firma adı zorunludur.");
      api
        .saveAd({
          company: company,
          title: $("adTitle").value.trim(),
          description: $("adDescription").value.trim(),
          cta: $("adCta").value.trim(),
          website: $("adWebsite").value.trim(),
          whatsapp: $("adWhatsapp").value.trim(),
          startsOn: $("adStart").value || null,
          endsOn: $("adEnd").value || null,
        })
        .then(function () {
          ["adCompany", "adTitle", "adDescription", "adCta", "adWebsite", "adWhatsapp"].forEach(
            function (id) {
              $(id).value = "";
            },
          );
          toast("Reklam kaydedildi.");
          loadAdYonetim();
        })
        .catch(bildirHata);
    };

    // Duyuru kapsamı seçilen ile göre ilçe listesini doldurur.
    $("duyuruIl").onchange = function () {
      var il = $("duyuruIl").value;
      var sel = $("duyuruIlce");
      sel.innerHTML = '<option value="">İl geneli</option>';
      if (!il) return;
      api
        .districts(il)
        .then(function (list) {
          sel.innerHTML =
            '<option value="">İl geneli</option>' +
            list.map(function (d) { return '<option value="' + esc(d.name) + '">' + esc(d.name) + "</option>"; }).join("");
          if (!list.length) sel.innerHTML = '<option value="">İl geneli (ilçe sınırları yüklenmemiş)</option>';
        })
        .catch(function () {});
    };

    loadDistricts();
    loadProvinces();
    loadApplications();
    loadDuyuruYonetim();
    loadAdYonetim();
  }

  function loadProvinces() {
    api
      .provinces()
      .then(function (list) {
        var box = $("yukluIller");
        if (!box) return;
        box.textContent = list.length
          ? "Sınırları yüklü iller: " + list.map(function (p) { return p.province + " (" + p.count + ")"; }).join(", ")
          : "Henüz hiçbir ilin sınırları yüklenmedi. Bildirimlerin ilçeye atanabilmesi için en az bir il yükleyin.";
      })
      .catch(function () {});
  }

  function loadDuyuruYonetim() {
    api
      .announcements()
      .then(function (list) {
        var box = $("duyuruYonetim");
        if (!box) return;
        box.innerHTML = list.length
          ? list
              .map(function (a) {
                return (
                  '<div class="list-item"><div class="row"><div class="grow">' +
                  "<h4>" + esc(a.title) + "</h4>" +
                  '<div class="muted">' + tarih(a.createdAt) + "</div></div>" +
                  '<span class="pill ' + (a.active ? "green" : "grey") + '">' +
                  (a.active ? "yayında" : "pasif") + "</span></div>" +
                  '<div class="row" style="margin-top:8px">' +
                  '<button class="btn ghost small grow" data-duyuru-tog="' + esc(a.id) + '">' +
                  (a.active ? "Yayından kaldır" : "Yayına al") + "</button>" +
                  '<button class="btn danger small" data-duyuru-sil="' + esc(a.id) + '">Sil</button>' +
                  "</div></div>"
                );
              })
              .join("")
          : '<div class="empty">Duyuru yok.</div>';

        Array.prototype.forEach.call(box.querySelectorAll("[data-duyuru-tog]"), function (b) {
          b.onclick = function () {
            var current = list.find(function (x) { return x.id === b.dataset.duyuruTog; });
            api
              .setAnnouncementActive(b.dataset.duyuruTog, !(current && current.active))
              .then(loadDuyuruYonetim)
              .catch(bildirHata);
          };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-duyuru-sil]"), function (b) {
          b.onclick = function () {
            api.deleteAnnouncement(b.dataset.duyuruSil).then(loadDuyuruYonetim).catch(bildirHata);
          };
        });
      })
      .catch(function () {});
  }

  function loadAdYonetim() {
    api
      .ads()
      .then(function (list) {
        var box = $("adList");
        if (!box) return;
        box.innerHTML = list.length
          ? list
              .map(function (a) {
                return (
                  '<div class="list-item"><div class="row"><div class="grow">' +
                  "<h4>" + esc(a.company) + "</h4>" +
                  '<div class="muted">' + esc(a.title || "") + "</div>" +
                  '<div class="muted">' + a.impressions + " gösterim · " + a.clicks + " tıklama</div>" +
                  "</div>" +
                  '<span class="pill ' + (a.status === "active" ? "green" : "grey") + '">' +
                  esc(a.status === "active" ? "aktif" : "duraklatıldı") + "</span></div>" +
                  '<div class="row" style="margin-top:8px">' +
                  '<button class="btn ghost small grow" data-ad-tog="' + esc(a.id) + '">' +
                  (a.status === "active" ? "Duraklat" : "Yayına al") + "</button>" +
                  '<button class="btn danger small" data-ad-sil="' + esc(a.id) + '">Sil</button>' +
                  "</div></div>"
                );
              })
              .join("")
          : '<div class="empty">Reklam yok.</div>';

        Array.prototype.forEach.call(box.querySelectorAll("[data-ad-tog]"), function (b) {
          b.onclick = function () {
            var current = list.find(function (x) { return x.id === b.dataset.adTog; });
            if (!current) return;
            api
              .saveAd({
                id: current.id,
                company: current.company,
                title: current.title,
                description: current.description,
                cta: current.cta,
                website: current.website,
                phone: current.phone,
                whatsapp: current.whatsapp,
                startsOn: current.startsOn,
                endsOn: current.endsOn,
                status: current.status === "active" ? "paused" : "active",
              })
              .then(loadAdYonetim)
              .catch(bildirHata);
          };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-ad-sil]"), function (b) {
          b.onclick = function () {
            api.deleteAd(b.dataset.adSil).then(loadAdYonetim).catch(bildirHata);
          };
        });
      })
      .catch(function () {});
  }

  function loadDistricts() {
    return api
      .districts()
      .then(function (list) {
        state.districts = list;
      })
      .catch(function () {
        state.districts = [];
      });
  }

  function loadApplications() {
    api
      .applications("beklemede")
      .then(function (list) {
        state.applications = list;
        var box = $("appList");
        if (!box) return;
        if (!list.length) {
          box.innerHTML = '<div class="empty">Bekleyen başvuru yok.</div>';
          return;
        }
        box.innerHTML = list
          .map(function (a) {
            return (
              '<div class="list-item">' +
              "<h4>" + esc(a.applicantName) + "</h4>" +
              '<div class="muted">' + esc(a.institution) + " · " + esc(a.title) + "</div>" +
              '<div class="muted">' + esc(a.institutionEmail) + "</div>" +
              '<div class="muted" style="margin-top:2px">' + tarih(a.createdAt) + "</div>" +
              '<div class="row" style="margin-top:9px">' +
              '<select data-area="' + esc(a.id) + '" class="grow"><option value="">Bölge seç…</option>' +
              state.districts
                .map(function (d) {
                  // Değerde il de taşınır; aksi hâlde aynı adlı ilçeler karışır
                  // ve onayda yanlış il yazılır.
                  var deger = d.province + "|" + d.name;
                  return (
                    '<option value="' + esc(deger) + '"' +
                    (a.district === d.name && a.province === d.province ? " selected" : "") +
                    ">" + esc(d.name) + " (" + esc(d.province) + ")</option>"
                  );
                })
                .join("") +
              "</select></div>" +
              '<div class="row" style="margin-top:8px">' +
              '<button class="btn small grow" data-ok="' + esc(a.id) + '">Onayla</button>' +
              '<button class="btn danger small" data-no="' + esc(a.id) + '">Reddet</button>' +
              "</div></div>"
            );
          })
          .join("");

        Array.prototype.forEach.call(box.querySelectorAll("[data-ok]"), function (b) {
          b.onclick = function () {
            var sel = box.querySelector('[data-area="' + b.dataset.ok + '"]');
            var deger = sel ? sel.value : "";
            if (!deger) return toast("Önce sorumlu olacağı bölgeyi seç.");
            var parca = deger.split("|");
            api
              .decideApplication(b.dataset.ok, true, { province: parca[0], district: parca[1] })
              .then(function () {
                toast("Yetki tanımlandı.");
                loadApplications();
              })
              .catch(bildirHata);
          };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-no]"), function (b) {
          b.onclick = function () {
            api
              .decideApplication(b.dataset.no, false, {})
              .then(function () {
                toast("Başvuru reddedildi.");
                loadApplications();
              })
              .catch(bildirHata);
          };
        });
      })
      .catch(function (error) {
        var box = $("appList");
        if (box) box.innerHTML = '<div class="error">' + esc(error.message) + "</div>";
      });
  }

  // --- Hesap ---------------------------------------------------------------

  function renderHesap() {
    var page = $("pageHesap");
    var u = state.user;
    var basvurabilir = u.role === "arici";

    page.innerHTML =
      '<div class="card"><div class="overline">Hesabım</div>' +
      '<p style="margin:8px 0 2px"><b>' + esc(u.name) + "</b></p>" +
      '<p class="muted" style="margin:0">' + esc(u.phone) + "</p>" +
      '<p class="muted" style="margin:6px 0 0">' + esc(rolAdi(u)) + "</p></div>" +
      (basvurabilir
        ? '<div class="card"><div class="overline">Personel yetki başvurusu</div>' +
          '<p class="muted" style="margin:6px 0 12px">Kurum personeliysen bilgilerini gönder. Yönetici doğruladıktan sonra bölgendeki arıcıların konum ve iletişim bilgilerine erişebilirsin.</p>' +
          '<div id="applyMsg"></div>' +
          '<label>Kurum adı<input id="apInstitution" placeholder="Örn: İl Tarım ve Orman Müdürlüğü" /></label>' +
          '<label>Unvan<input id="apTitle" placeholder="Örn: Veteriner Hekim" /></label>' +
          '<label>Ad soyad<input id="apName" value="' + esc(u.name) + '" /></label>' +
          '<label>Kurum e-postası<input id="apEmail" type="email" placeholder="ad.soyad@kurum.gov.tr" /></label>' +
          '<label>Sorumlu olmak istediğin il<select id="apProvince"><option value="">İl seç…</option>' +
          TR_ILLER.map(function (il) { return '<option value="' + esc(il) + '">' + esc(il) + "</option>"; }).join("") +
          "</select></label>" +
          '<label>İlçe<select id="apDistrict"><option value="">Önce il seç</option></select></label>' +
          '<button class="btn full" id="applyBtn">Başvuruyu gönder</button></div>'
        : "") +
      '<div class="card"><button class="btn ghost full" id="hesapCikis">Çıkış yap</button></div>';

    $("hesapCikis").onclick = function () {
      $("logoutBtn").click();
    };

    if (basvurabilir) {
      // İlçe listesi yalnızca sınırları yüklenmiş iller için doludur.
      $("apProvince").onchange = function () {
        var il = $("apProvince").value;
        var sel = $("apDistrict");
        sel.innerHTML = '<option value="">Yükleniyor…</option>';
        if (!il) {
          sel.innerHTML = '<option value="">Önce il seç</option>';
          return;
        }
        api
          .districts(il)
          .then(function (list) {
            sel.innerHTML = list.length
              ? '<option value="">İlçe seç…</option>' +
                list.map(function (d) {
                  return '<option value="' + esc(d.name) + '">' + esc(d.name) + "</option>";
                }).join("")
              : '<option value="">Bu ilin ilçeleri henüz yüklenmemiş</option>';
          })
          .catch(function () {
            sel.innerHTML = '<option value="">İlçeler alınamadı</option>';
          });
      };

      $("applyBtn").onclick = function () {
        api
          .applyForStaff({
            applicantName: $("apName").value.trim(),
            institution: $("apInstitution").value.trim(),
            title: $("apTitle").value.trim(),
            institutionEmail: $("apEmail").value.trim(),
            province: $("apProvince").value,
            district: $("apDistrict").value,
          })
          .then(function () {
            $("applyMsg").innerHTML =
              '<div class="ok">Başvurun yöneticiye iletildi. Sonucu mesaj kutunda göreceksin.</div>';
            toast("Başvuru gönderildi.");
          })
          .catch(function (error) {
            hata($("applyMsg"), error.message);
          });
      };
    }
  }

  // --- Açılış --------------------------------------------------------------

  function start() {
    wireAuth();
    if (api.currentUser) {
      state.user = api.currentUser;
      showApp();
      loadMyLocation();
    } else {
      showAuth();
    }
    // Mesaj kutusu arka planda tazelenir; anlık bildirim (push) için ayrıca
    // Firebase/APNs kurulumu gerekir, bu sürümde yok.
    setInterval(function () {
      if (state.user) refreshNotifications();
    }, 60000);
  }

  // Sunucu istemcisi hazır olduğunda "aricimap:ready" olayını yayar. Bu dosya
  // ondan sonra yüklenirse olay kaçmış olabilir; o yüzden iki yol da tutulur.
  var started = false;
  function startOnce() {
    if (started) return;
    started = true;
    start();
  }
  window.addEventListener("aricimap:ready", startOnce);
  if (api && api.isOnline) startOnce();
  window.addEventListener("aricimap:offline", function () {
    showAuth();
  });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (state.map && state.page === "harita") state.map.invalidateSize();
    }, 180);
  });

  window.__aricimapApp = { state: state, goto: goto };
})();
