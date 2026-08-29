(() => {
  const panelId = "roleOperationsModal";
  let panelMode = "staff";
  let stayDraft = null;
  let selectingStayLocation = false;
  let stayMarkers = [];

  const $id = id => document.getElementById(id);
  const safe = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);

  function ensureState() {
    state.staffRequests = Array.isArray(state.staffRequests) ? state.staffRequests : [];
    state.staff = Array.isArray(state.staff) ? state.staff : [];
    state.staffAssignments = Array.isArray(state.staffAssignments) ? state.staffAssignments : [];
    state.stayRequests = Array.isArray(state.stayRequests) ? state.stayRequests : [];
  }

  function hasManagerRole() {
    return $("#role")?.value === "ARICIMAP Yöneticisi";
  }

  function selectedStaffId() {
    const stored = state.activeStaffId;
    return state.staff.some(person => person.id === stored) ? stored : state.staff[0]?.id || "";
  }

  function auditAndNotify(title, detail, type = "record") {
    audit(title, detail, type);
    notify(detail);
    persist();
    render();
  }

  function ensureModal() {
    if ($id(panelId)) return $id(panelId);

    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="modal" id="${panelId}">
        <section class="dialog role-operations-dialog">
          <button class="close" type="button" data-role-ops-close>×</button>
          <div class="dialog-symbol">▣</div>
          <div class="overline">SAHA ROLLERİ</div>
          <h2 id="roleOpsTitle">Personel alanı</h2>
          <p id="roleOpsLead"></p>
          <div id="roleOpsContent"></div>
        </section>
      </div>`,
    );

    const modal = $id(panelId);
    modal.querySelector("[data-role-ops-close]").onclick = () => closeModal(panelId);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal(panelId);
    });
    return modal;
  }

  function ensureStayModal() {
    const existing = $id("stayModal");
    if (existing) return existing;

    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="modal" id="stayModal">
        <section class="dialog stay-request-dialog">
          <button class="close" type="button" data-stay-close>×</button>
          <div class="dialog-symbol stay-symbol">⌂</div>
          <div class="overline">GEZGİNCİ ARICI KONAKLAMA</div>
          <h2>Konaklama talebi oluştur</h2>
          <p>Gideceğiniz konumu haritada açıkça seçin. Talep, bu cihazdaki yerel demo kaydına eklenir ve yetkili saha personelinin kararına sunulur.</p>
          <div class="form-grid">
            <label>Ad soyad<input id="stayName" placeholder="Ad soyad" /></label>
            <label>İletişim bilgisi<input id="stayContact" placeholder="Telefon veya e-posta" /></label>
            <label>Planlanan giriş tarihi<input id="stayDate" type="date" /></label>
            <label>Tahmini kovan sayısı<input id="stayHiveCount" type="number" min="1" placeholder="İsteğe bağlı" /></label>
          </div>
          <div class="location-box">
            <i>⌖</i><div><b id="stayCoord">Koordinat seçilmedi</b><small id="stayCoordHelp">Talebin iletileceği konumu haritada seçin.</small></div>
            <button id="stayPickMap" type="button">Haritada seç</button>
          </div>
          <label>Talep notu<textarea id="stayNote" placeholder="Örn. konaklama süresi, araç erişimi veya ihtiyaç notu"></textarea></label>
          <div class="consent-box"><label><input id="stayConsent" type="checkbox" /> Konum bilgisinin yalnızca konaklama talebini değerlendirmek için bu cihazdaki yerel demo kaydına eklenmesini kabul ediyorum.</label></div>
          <div class="form-actions"><button class="secondary" type="button" data-stay-close>Vazgeç</button><button class="primary stay-primary" id="saveStayRequest" type="button">Talebi gönder</button></div>
        </section>
      </div>`,
    );
    const modal = $id("stayModal");
    modal.querySelectorAll("[data-stay-close]").forEach(button => {
      button.onclick = () => closeModal("stayModal");
    });
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal("stayModal");
    });
    return modal;
  }

  function updateStayLocation() {
    const value = $id("stayCoord");
    const help = $id("stayCoordHelp");
    if (!value || !help) return;
    if (!stayDraft) {
      value.textContent = "Koordinat seçilmedi";
      help.textContent = "Talebin iletileceği konumu haritada seçin.";
      return;
    }
    value.textContent = `${stayDraft.lat.toFixed(6)}, ${stayDraft.lng.toFixed(6)}`;
    help.textContent = "Harita seçimi · konum yalnızca bu talep için yerel olarak saklanır.";
  }

  function openStayRequest() {
    ensureState();
    ensureStayModal();
    stayDraft = null;
    ["stayName", "stayContact", "stayDate", "stayHiveCount", "stayNote"].forEach(id => {
      const input = $id(id);
      if (input) input.value = "";
    });
    $id("stayConsent").checked = false;
    updateStayLocation();
    $id("stayPickMap").onclick = startStayMapPick;
    $id("saveStayRequest").onclick = saveStayRequest;
    openModal("stayModal");
  }

  function startStayMapPick() {
    if (!map || typeof map.on !== "function") {
      toast("Harita henüz hazır değil. Lütfen kısa süre sonra yeniden deneyin.");
      return;
    }
    closeModal("stayModal");
    selectingStayLocation = true;
    const instruction = $id("mapInstruction");
    if (instruction) {
      instruction.classList.add("selecting");
      instruction.innerHTML = "<b>Konaklama konumu seçimi açık.</b> Gideceğiniz yeri haritada işaretleyin.";
    }
    map.getContainer?.().scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function saveStayRequest() {
    const name = $id("stayName").value.trim();
    const contact = $id("stayContact").value.trim();
    const date = $id("stayDate").value;
    const note = $id("stayNote").value.trim();
    const hives = $id("stayHiveCount").value;
    if (!name || !contact || !date || !stayDraft || !$id("stayConsent").checked) {
      toast("Ad soyad, iletişim, giriş tarihi, harita konumu ve açık onay zorunludur.");
      return;
    }
    state.stayRequests.unshift({
      id: uid("stay_request"),
      name,
      contact,
      date,
      note,
      hives: hives ? Number(hives) : null,
      lat: stayDraft.lat,
      lng: stayDraft.lng,
      locationSource: "Harita seçimi",
      status: "İnceleme bekliyor",
      at: now(),
    });
    auditAndNotify("Konaklama talebi oluşturuldu", `${name} için konaklama talebi saha personeline iletildi.`);
    closeModal("stayModal");
    renderStayRequests();
    toast("Konaklama talebiniz personele iletildi.");
  }

  function renderStayMarkers() {
    if (!map || !window.L) return;
    stayMarkers.forEach(marker => marker.remove());
    stayMarkers = state.stayRequests.map(request => {
      const icon = L.divIcon({
        className: "stay-map-marker",
        html: "<span>⌂</span>",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([request.lat, request.lng], { icon }).addTo(map);
      marker.bindTooltip(`${safe(request.name)} · ${safe(request.status)}`, { direction: "top", offset: [0, -14] });
      return marker;
    });
  }

  function focusStayRequest(requestId) {
    const request = state.stayRequests.find(item => item.id === requestId);
    if (!request || !map || typeof map.setView !== "function") return;
    map.setView([request.lat, request.lng], 15);
    map.getContainer?.().scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderStayRequests() {
    ensureState();
    let board = $id("stayRequestBoard");
    if (!board) {
      board = document.createElement("section");
      board.id = "stayRequestBoard";
      board.className = "stay-request-board card";
      const roles = $id("rolePanels");
      if (roles) roles.insertAdjacentElement("afterend", board);
      else document.querySelector("main")?.prepend(board);
    }
    const rows = state.stayRequests.length
      ? state.stayRequests
          .map(request => `<div class="stay-request-row">
            <i>⌂</i><div><b>${safe(request.name)} <span class="stay-status">${safe(request.status)}</span></b>
            <small>${safe(request.date)} · ${request.hives ? `${safe(request.hives)} kovan` : "Kovan sayısı belirtilmedi"} · ${request.lat.toFixed(5)}, ${request.lng.toFixed(5)}</small>
            <small>${safe(request.note || "Ek not yok")}</small></div>
            <button class="tiny-btn" type="button" data-stay-focus="${safe(request.id)}">Haritada gör</button>
          </div>`)
          .join("")
      : `<div class="role-ops-empty">Henüz konaklama talebi yok. Gezginci arıcı olarak konumunuzu haritada seçip ilk talebi oluşturabilirsiniz.</div>`;
    board.innerHTML = `<div class="card-head"><div><div class="overline">GEZGİNCİ ARICI KONAKLAMA</div><h2>Konaklama talepleri</h2></div><button class="outline-btn" type="button" id="boardStayRequest">＋ Talep oluştur</button></div><div class="stay-request-list">${rows}</div>`;
    $id("boardStayRequest").onclick = openStayRequest;
    document.querySelectorAll("[data-stay-focus]").forEach(button => {
      button.onclick = () => focusStayRequest(button.dataset.stayFocus);
    });
    renderStayMarkers();
  }

  function renderRequestForm() {
    return `<div class="role-ops-section">
      <div class="overline">PERSONEL ERİŞİM BAŞVURUSU</div>
      <p class="role-ops-copy">Başvuru bu cihazdaki yerel demo kaydına eklenir. Yönetici onayı olmadan personel ataması yapılmaz.</p>
      <label>Ad soyad<input id="staffRequestName" placeholder="Ad soyad" /></label>
      <label>İletişim bilgisi<input id="staffRequestContact" placeholder="Telefon veya e-posta" /></label>
      <div class="form-actions"><button class="primary" id="submitStaffRequest" type="button">Başvuru gönder</button></div>
    </div>`;
  }

  function renderStaffWorkspace() {
    if (!state.staff.length) {
      return `${renderRequestForm()}<div class="role-ops-empty">Henüz yönetici tarafından onaylanmış bir personel yok.</div>`;
    }

    const activeId = selectedStaffId();
    const activeAssignments = state.staffAssignments.filter(item => item.staffId === activeId);
    const activeStaff = state.staff.find(person => person.id === activeId);
    const assignmentRows = activeAssignments.length
      ? activeAssignments
          .map(assignment => {
            const apiary = state.apiaries.find(item => item.id === assignment.apiaryId);
            return `<div class="role-ops-row">
              <div><b>${safe(apiary?.name || "Silinmiş arılık")}</b><small>${safe(apiary?.beekeeper || "Arıcı bilgisi yok")} · ${safe(assignment.note || "Saha görevi")}</small></div>
              <button class="tiny-btn" type="button" data-role-inspect="${safe(assignment.apiaryId)}">Denetim</button>
            </div>`;
          })
          .join("")
      : '<div class="role-ops-empty">Bu personele atanmış arılık yok.</div>';

    const pendingStays = state.stayRequests.filter(item => item.status === "İnceleme bekliyor");
    const stayRows = pendingStays.length
      ? pendingStays
          .map(request => `<div class="role-ops-row">
            <div><b>${safe(request.name)} · konaklama talebi</b><small>${safe(request.date || "Tarih belirtilmedi")} · ${request.lat?.toFixed?.(5) || "Konum yok"}, ${request.lng?.toFixed?.(5) || ""} · ${safe(request.note || "Not yok")}</small></div>
            <div class="admin-actions"><button class="tiny-btn" type="button" data-role-stay-approve="${safe(request.id)}">Yer ayır</button><button class="tiny-btn danger" type="button" data-role-stay-reject="${safe(request.id)}">Uygun değil</button></div>
          </div>`)
          .join("")
      : '<div class="role-ops-empty">İncelenecek konaklama talebi yok.</div>';

    return `<div class="role-ops-section">
      <div class="overline">AKTİF DEMO PERSONELİ</div>
      <label>Personel<select id="activeStaffSelect">${state.staff
        .map(person => `<option value="${safe(person.id)}" ${person.id === activeId ? "selected" : ""}>${safe(person.name)} · ${safe(person.code)}</option>`)
        .join("")}</select></label>
      <p class="role-ops-copy"><b>${safe(activeStaff?.name || "Personel")}</b> yalnız atanmış kayıtlar üzerinden denetim başlatabilir.</p>
      <div class="overline role-ops-heading">ATANAN ARILIKLAR</div>${assignmentRows}
      <div class="overline role-ops-heading">KONAKLAMA TALEPLERİ</div>${stayRows}
    </div>`;
  }

  function renderManagerWorkspace() {
    const requestRows = state.staffRequests.length
      ? state.staffRequests
          .map(request => `<div class="role-ops-row">
            <div><b>${safe(request.name)}</b><small>${safe(request.contact)} · ${request.status === "pending" ? "Onay bekliyor" : request.status === "rejected" ? "Reddedildi" : "Onaylandı"}</small></div>
            ${request.status === "pending" ? `<div class="admin-actions"><button class="tiny-btn" type="button" data-role-request-approve="${safe(request.id)}">Onayla</button><button class="tiny-btn danger" type="button" data-role-request-reject="${safe(request.id)}">Reddet</button></div>` : ""}
          </div>`)
          .join("")
      : '<div class="role-ops-empty">Bekleyen personel başvurusu yok.</div>';

    const staffOptions = state.staff.length
      ? state.staff.map(person => `<option value="${safe(person.id)}">${safe(person.name)} · ${safe(person.code)}</option>`).join("")
      : '<option value="">Önce personel onaylayın</option>';
    const apiaryOptions = state.apiaries.length
      ? state.apiaries.map(apiary => `<option value="${safe(apiary.id)}">${safe(apiary.name)} · ${safe(apiary.beekeeper)}</option>`).join("")
      : '<option value="">Atanacak arılık yok</option>';
    const assignmentRows = state.staffAssignments.length
      ? state.staffAssignments
          .map(assignment => {
            const staff = state.staff.find(person => person.id === assignment.staffId);
            const apiary = state.apiaries.find(item => item.id === assignment.apiaryId);
            return `<div class="role-ops-row"><div><b>${safe(staff?.name || "Silinmiş personel")} → ${safe(apiary?.name || "Silinmiş arılık")}</b><small>${safe(assignment.note || "Saha ataması")}</small></div><button class="tiny-btn danger" type="button" data-role-assignment-remove="${safe(assignment.id)}">Atamayı kaldır</button></div>`;
          })
          .join("")
      : '<div class="role-ops-empty">Henüz personel-arılık ataması yok.</div>';

    return `<div class="role-ops-section">
      <div class="overline">BEKLEYEN PERSONEL BAŞVURULARI</div>${requestRows}
      <div class="overline role-ops-heading">ARILIK ATAMASI</div>
      <label>Personel<select id="assignmentStaff">${staffOptions}</select></label>
      <label>Arılık<select id="assignmentApiary">${apiaryOptions}</select></label>
      <label>Görev notu<input id="assignmentNote" placeholder="Örn. Bahar denetimi" /></label>
      <div class="form-actions"><button class="primary" type="button" id="saveRoleAssignment">Atamayı kaydet</button></div>
      <div class="overline role-ops-heading">AKTİF ATAMALAR</div>${assignmentRows}
      <div class="role-ops-admin-links"><button class="secondary" type="button" id="openAdsFromRole">Reklam yönetimi</button><button class="secondary" type="button" id="openAnnouncementsFromRole">Duyuru yönetimi</button></div>
    </div>`;
  }

  function bindStaffWorkspace() {
    const select = $id("activeStaffSelect");
    if (select) {
      select.onchange = () => {
        state.activeStaffId = select.value;
        persist();
        renderRolePanel();
      };
    }

    document.querySelectorAll("[data-role-inspect]").forEach(button => {
      button.onclick = () => {
        closeModal(panelId);
        openInspection(button.dataset.roleInspect);
      };
    });

    document.querySelectorAll("[data-role-stay-approve]").forEach(button => {
      button.onclick = () => decideStay(button.dataset.roleStayApprove, "Yer ayrıldı");
    });
    document.querySelectorAll("[data-role-stay-reject]").forEach(button => {
      button.onclick = () => decideStay(button.dataset.roleStayReject, "Uygun yer yok");
    });

    const submit = $id("submitStaffRequest");
    if (submit) submit.onclick = submitStaffRequest;
  }

  function bindManagerWorkspace() {
    document.querySelectorAll("[data-role-request-approve]").forEach(button => {
      button.onclick = () => approveRequest(button.dataset.roleRequestApprove);
    });
    document.querySelectorAll("[data-role-request-reject]").forEach(button => {
      button.onclick = () => rejectRequest(button.dataset.roleRequestReject);
    });
    document.querySelectorAll("[data-role-assignment-remove]").forEach(button => {
      button.onclick = () => {
        state.staffAssignments = state.staffAssignments.filter(item => item.id !== button.dataset.roleAssignmentRemove);
        auditAndNotify("Personel ataması kaldırıldı", "Yönetici bir arılık atamasını kaldırdı.");
        renderRolePanel();
      };
    });

    const save = $id("saveRoleAssignment");
    if (save) save.onclick = saveAssignment;
    $id("openAdsFromRole").onclick = () => {
      closeModal(panelId);
      openAdmin("ads");
    };
    $id("openAnnouncementsFromRole").onclick = () => {
      closeModal(panelId);
      openAdmin("announcements");
    };
  }

  function submitStaffRequest() {
    const name = $id("staffRequestName").value.trim();
    const contact = $id("staffRequestContact").value.trim();
    if (!name || !contact) {
      toast("Ad soyad ve iletişim bilgisi zorunludur.");
      return;
    }
    const duplicate = state.staffRequests.some(item => item.contact === contact && item.status === "pending");
    if (duplicate) {
      toast("Bu iletişim bilgisiyle bekleyen bir başvuru zaten var.");
      return;
    }
    state.staffRequests.unshift({ id: uid("staff_request"), name, contact, status: "pending", at: now() });
    auditAndNotify("Personel erişim başvurusu alındı", `${name} için yönetici onayı bekleniyor.`);
    toast("Başvurunuz yönetici onayı için kaydedildi.");
    renderRolePanel();
  }

  function approveRequest(requestId) {
    const request = state.staffRequests.find(item => item.id === requestId);
    if (!request) return;
    request.status = "approved";
    request.decidedAt = now();
    // Kod dizinin uzunluğundan türetiliyordu; iki cihaz aynı anda onay verdiğinde
    // veya kayıtlar sunucudan birleştiğinde aynı kod iki kişiye çıkabiliyordu.
    // Artık mevcut en yüksek koddan devam ediliyor.
    const highest = state.staff.reduce((max, person) => {
      const parsed = Number(String(person.code || "").replace(/\D/g, ""));
      return Number.isFinite(parsed) && parsed > max ? parsed : max;
    }, 0);
    const code = `P-${String(highest + 1).padStart(3, "0")}`;
    const person = { id: uid("staff"), name: request.name, code, contact: request.contact, approvedAt: now() };
    state.staff.push(person);
    state.activeStaffId = person.id;
    auditAndNotify("Personel onaylandı", `${request.name} ${code} koduyla saha personeli olarak onaylandı.`);
    toast("Personel onaylandı ve atamaya hazır.");
    renderRolePanel();
  }

  function rejectRequest(requestId) {
    const request = state.staffRequests.find(item => item.id === requestId);
    if (!request) return;
    request.status = "rejected";
    request.decidedAt = now();
    auditAndNotify("Personel başvurusu reddedildi", `${request.name} için personel başvurusu reddedildi.`);
    renderRolePanel();
  }

  function saveAssignment() {
    const staffId = $id("assignmentStaff").value;
    const apiaryId = $id("assignmentApiary").value;
    const note = $id("assignmentNote").value.trim();
    if (!staffId || !apiaryId) {
      toast("Atanacak personel ve arılık seçilmelidir.");
      return;
    }
    const duplicate = state.staffAssignments.some(item => item.staffId === staffId && item.apiaryId === apiaryId);
    if (duplicate) {
      toast("Bu arılık seçilen personele zaten atanmış.");
      return;
    }
    const staff = state.staff.find(person => person.id === staffId);
    const apiary = state.apiaries.find(item => item.id === apiaryId);
    state.staffAssignments.unshift({ id: uid("assignment"), staffId, apiaryId, note, at: now() });
    auditAndNotify("Arılık personele atandı", `${apiary?.name || "Arılık"}, ${staff?.name || "personel"} için atandı.`);
    toast("Arılık ataması kaydedildi.");
    renderRolePanel();
  }

  function decideStay(requestId, status) {
    const request = state.stayRequests.find(item => item.id === requestId);
    if (!request) return;
    request.status = status;
    request.decidedAt = now();
    auditAndNotify("Konaklama talebi güncellendi", `${request.name} için konaklama talebi: ${status}.`);
    toast(status === "Yer ayrıldı" ? "Konaklama yeri ayrıldı." : "Konaklama talebi uygun bulunmadı.");
    renderRolePanel();
    renderStayRequests();
  }

  function renderRolePanel() {
    ensureState();
    ensureModal();
    const isManager = panelMode === "manager";
    $id("roleOpsTitle").textContent = isManager ? "Yönetici personel yönetimi" : "Personel çalışma alanı";
    $id("roleOpsLead").textContent = isManager
      ? "Başvuruları onaylayın, arılıkları personele atayın ve yerel demo saha sürecini takip edin."
      : "Atanmış arılıklar için denetim başlatın ve bekleyen konaklama taleplerini değerlendirin.";
    $id("roleOpsContent").innerHTML = isManager ? renderManagerWorkspace() : renderStaffWorkspace();
    if (isManager) bindManagerWorkspace();
    else bindStaffWorkspace();
  }

  function openRolePanel(mode) {
    ensureState();
    if (mode === "manager" && !hasManagerRole()) {
      toast("Yönetici paneli için rol seçiciden ARICIMAP Yöneticisi seçilmelidir.");
      return;
    }
    panelMode = mode;
    renderRolePanel();
    openModal(panelId);
  }

  function wireRoleEntryPoints() {
    const navStaff = $id("navStaff");
    if (navStaff) navStaff.onclick = () => openRolePanel(hasManagerRole() ? "manager" : "staff");

    let navStay = $id("navStay");
    if (!navStay && $id("navShare")) {
      navStay = document.createElement("button");
      navStay.id = "navStay";
      navStay.innerHTML = '<span class="nicon">⌂</span><span>Konaklama talepleri</span>';
      $id("navShare").insertAdjacentElement("afterend", navStay);
    }
    if (navStay) navStay.onclick = openStayRequest;

    const stayPanel = $id("stayRequestPanel");
    if (stayPanel) stayPanel.onclick = openStayRequest;

    const staffCard = $id("staffPanel");
    if (staffCard) {
      staffCard.onclick = () => {
        $("#role").value = "Saha Gönüllüsü";
        openRolePanel("staff");
      };
    }

    const adminCard = $id("adminPanel");
    if (adminCard) {
      adminCard.onclick = () => {
        $("#role").value = "ARICIMAP Yöneticisi";
        openRolePanel("manager");
      };
    }
  }

  function addStyles() {
    document.head.insertAdjacentHTML(
      "beforeend",
      `<style>
        .role-operations-dialog{width:min(760px,calc(100% - 28px))}.role-ops-section{display:grid;gap:10px}.role-ops-heading{margin-top:14px}.role-ops-copy{margin:0;color:#687c6b;font-size:11px;line-height:1.5}.role-ops-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #edf0e8}.role-ops-row b{display:block;color:#36553b;font-size:11px}.role-ops-row small{display:block;margin-top:2px;color:#7d8d7e;font-size:10px}.role-ops-empty{padding:12px 0;color:#748476;font-size:11px}.role-ops-admin-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.stay-request-dialog{width:min(620px,calc(100% - 28px))}.stay-symbol{background:#fff0e7;color:#ca613a}.stay-primary{background:#dd693e!important;color:#fff!important}.stay-request-board{margin:0 0 16px;padding:0 17px 14px}.stay-request-board .card-head{padding-left:0;padding-right:0}.stay-request-list{display:grid}.stay-request-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px 0;border-top:1px solid #edf0e8}.stay-request-row>i{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#fff0e7;color:#c85d38;font-style:normal}.stay-request-row b{display:block;color:#435945;font-size:11px}.stay-request-row small{display:block;margin-top:2px;color:#748675;font-size:10px}.stay-status{display:inline-block;margin-left:4px;padding:2px 5px;border-radius:5px;background:#fff0e7;color:#ae502f;font-size:9px}.stay-map-marker{display:grid;place-items:center;width:34px!important;height:34px!important;margin-left:-17px!important;margin-top:-17px!important;border:3px solid #fff;border-radius:50% 50% 50% 10%;background:#dd693e;box-shadow:0 5px 11px rgba(122,62,39,.28);color:#fff;font-size:15px;transform:rotate(-45deg)}.stay-map-marker span{transform:rotate(45deg)}@media(max-width:720px){.role-ops-row,.stay-request-row{grid-template-columns:1fr}.role-ops-row .admin-actions{justify-content:flex-start}.stay-request-board{padding-left:14px;padding-right:14px}}
      </style>`,
    );
  }

  addStyles();
  wireRoleEntryPoints();
  ensureState();
  if (map && typeof map.on === "function") {
    map.on("click", event => {
      if (!selectingStayLocation) return;
      selectingStayLocation = false;
      stayDraft = { lat: event.latlng.lat, lng: event.latlng.lng };
      const instruction = $id("mapInstruction");
      if (instruction) {
        instruction.classList.remove("selecting");
        instruction.innerHTML = "<b>Konaklama konumu seçildi.</b> Talep bilgilerini tamamlayın.";
      }
      ensureStayModal();
      updateStayLocation();
      openModal("stayModal");
    });
  }
  renderStayRequests();
  window.openAricimapRolePanel = openRolePanel;
  window.openAricimapStayRequest = openStayRequest;
})();
