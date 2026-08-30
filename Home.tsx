/**
 * ARICIMAP reference application entry.
 * The user-provided source HTML is rendered directly so visual hierarchy and interaction flow remain unchanged.
 */
export default function Home() {
  return (
    <main className="reference-app-root" aria-label="ARICIMAP arıcı saha ve arılık konum sistemi">
      <iframe
        className="reference-app-frame"
        src="/aricimap-app.html"
        allow="geolocation"
        title="ARICIMAP"
      />
    </main>
  );
}
