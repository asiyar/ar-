(function () {
  const options = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0,
    enableLocationFallback: true,
  };

  function nativePlugin() {
    const capacitor = window.Capacitor;
    const plugin = capacitor?.Plugins?.Geolocation;
    return capacitor?.isNativePlatform?.() && plugin ? plugin : null;
  }

  function browserPosition() {
    if (!navigator.geolocation) return Promise.reject({ code: "unsupported" });
    if (!window.isSecureContext) return Promise.reject({ code: "insecure" });

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  async function currentPositionAfterUserAction() {
    const plugin = nativePlugin();
    if (!plugin) return browserPosition();

    const permission = await plugin.requestPermissions({ permissions: ["location"] });
    if (permission.location !== "granted") throw { code: "permission" };
    return plugin.getCurrentPosition(options);
  }

  function errorMessage(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    if (code === "permission" || code === "1" || message.includes("OS-PLUG-GLOC-0003")) {
      return "Konum izni verilmedi. Cihaz ayarlarından konum erişimini izinli yapın veya “Haritada seç”i kullanın.";
    }
    if (code === "unsupported" || code === "insecure") {
      return "GPS erişimi bu ortamda açık değil. “Haritada seç” seçeneğini kullanın.";
    }
    if (code === "3" || message.includes("OS-PLUG-GLOC-0010")) {
      return "Konum alma zaman aşımına uğradı. Tekrar deneyin veya “Haritada seç”i kullanın.";
    }
    if (message.includes("OS-PLUG-GLOC-0007") || message.includes("OS-PLUG-GLOC-0017")) {
      return "Cihaz konum servisleri kapalı. Konumu açın veya “Haritada seç”i kullanın.";
    }
    return "GPS konumu alınamadı. “Haritada seç” ile gerçek noktayı işaretleyin.";
  }

  function confirmLocationUse() {
    return window.confirm(
      "ARICIMAP cihaz konumunuzu yalnızca bu isteğiniz için arılık noktasını haritada göstermek veya gönüllü konum paylaşımını hazırlamak amacıyla kullanır. Konum arka planda izlenmez ve reklam hedeflemesi için kullanılmaz. Devam etmek için Tamam’ı seçin.",
    );
  }

  function requestApiaryGps() {
    if (!confirmLocationUse()) return;
    currentPositionAfterUserAction()
      .then((position) => {
        pendingLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: "Cihaz GPS",
          accuracy: position.coords.accuracy,
        };
        updateLocationText();
        if (map) map.setView([pendingLocation.lat, pendingLocation.lng], 16);
        toast("GPS konumu alındı. Kaydetmeden önce bilgileri kontrol edin.");
      })
      .catch((error) => {
        const message = errorMessage(error);
        document.querySelector("#locationHelp").textContent = message;
        toast(message);
      });
  }

  function requestShareGps() {
    if (!confirmLocationUse()) return;
    currentPositionAfterUserAction()
      .then((position) => {
        shareLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: "Cihaz GPS",
          accuracy: position.coords.accuracy,
        };
        updateShareLocation();
        if (map) map.setView([shareLocation.lat, shareLocation.lng], 16);
      })
      .catch((error) => {
        document.querySelector("#shareLocationHelp").textContent = errorMessage(error);
      });
  }

  document.querySelector("#useGps").onclick = requestApiaryGps;
  document.querySelector("#locateMe").onclick = requestApiaryGps;
  document.querySelector("#shareGps").onclick = requestShareGps;
})();
