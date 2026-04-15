import { useState, useEffect, useRef, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyAd2kPUWd-cMhs2r4ScEFZDtHuvGQgSZbY";

// ── Palette — modern civic tech ────────────────────────────────────────
const COLORS = {
  bg: "#f1f5f9",
  surface: "#ffffff",
  surfaceHigh: "#f8fafc",
  surfaceMid: "#e8eef6",
  border: "#e2e8f0",
  accent: "#1d4ed8",
  accentLight: "#3b82f6",
  accentGlow: "rgba(29,78,216,0.15)",
  danger: "#dc2626",
  warning: "#d97706",
  success: "#059669",
  text: "#0f172a",
  textMuted: "#64748b",
  textDim: "#475569",
  pin: { high: "#dc2626", medium: "#d97706", low: "#059669" },
};

const LICAB_CENTER = { lat: 15.6394, lng: 120.8064 };
const LICAB_BOUNDS = { minLat: 15.59, maxLat: 15.69, minLng: 120.76, maxLng: 120.85 };

const INFRA_TYPES = ["Road", "Bridge", "Public Building"];
const CHECKLIST = {
  Road: [
    { id: "r1", label: "Large cracks (> 5 cm wide)", weight: 3 },
    { id: "r2", label: "Small cracks (≤ 5 cm wide)", weight: 1 },
    { id: "r3", label: "Potholes present", weight: 2 },
    { id: "r4", label: "Surface completely broken / missing", weight: 4 },
    { id: "r5", label: "Subsidence / road sinking", weight: 3 },
    { id: "r6", label: "Flooding / drainage failure", weight: 2 },
    { id: "r7", label: "Guardrail damaged or missing", weight: 2 },
  ],
  Bridge: [
    { id: "b1", label: "Visible structural cracks on deck", weight: 3 },
    { id: "b2", label: "Corroded / missing rebar exposed", weight: 4 },
    { id: "b3", label: "Bridge railings damaged", weight: 2 },
    { id: "b4", label: "Deck surface deteriorating", weight: 2 },
    { id: "b5", label: "Foundation / abutment damage", weight: 4 },
    { id: "b6", label: "Partial collapse or displacement", weight: 5 },
    { id: "b7", label: "Load-bearing capacity visibly compromised", weight: 4 },
  ],
  "Public Building": [
    { id: "p1", label: "Wall cracks (minor hairline)", weight: 1 },
    { id: "p2", label: "Wall cracks (structural / deep)", weight: 3 },
    { id: "p3", label: "Roof damage / leakage", weight: 3 },
    { id: "p4", label: "Broken windows / doors", weight: 1 },
    { id: "p5", label: "Flooring or stair damage", weight: 2 },
    { id: "p6", label: "Electrical / utility hazard visible", weight: 4 },
    { id: "p7", label: "Partial structural collapse", weight: 5 },
  ],
};

const getSeverity = (score) => {
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
};
const severityColor = (s) =>
  s === "High" ? COLORS.pin.high : s === "Medium" ? COLORS.pin.medium : COLORS.pin.low;
const severityIcon = (s) => (s === "High" ? "🔴" : s === "Medium" ? "🟡" : "🟢");
const typeIcon = (t) => (t === "Road" ? "🛣️" : t === "Bridge" ? "🌉" : "🏛️");

// Mock approved reports — added placeName field
const MOCK_REPORTS = [
  { id: 1, lat: 15.642, lng: 120.81, type: "Road", score: 12, placeName: "Brgy. Cuyapo Road, Licab", desc: "Large potholes and complete surface failure along the main highway.", date: "2025-04-10", photo: null },
  { id: 2, lat: 15.635, lng: 120.798, type: "Bridge", score: 6, placeName: "Barangay Bridge, Licab", desc: "Visible deck cracks and corroding railings on the barangay bridge.", date: "2025-04-08", photo: null },
  { id: 3, lat: 15.642, lng: 120.81, type: "Public Building", score: 2, placeName: "Covered Court, Licab", desc: "Hairline wall cracks in the covered court.", date: "2025-04-07", photo: null },
  { id: 4, lat: 15.628, lng: 120.815, type: "Road", score: 5, placeName: "Public Market Area, Licab", desc: "Multiple potholes and drainage problems near the market area.", date: "2025-04-05", photo: null },
  { id: 5, lat: 15.652, lng: 120.802, type: "Bridge", score: 13, placeName: "North Sitio Bridge, Licab", desc: "Foundation displacement and exposed rebar on bridge near north sitio.", date: "2025-04-03", photo: null },
];

const groupReports = (reports) => {
  const groups = [];
  reports.forEach((r) => {
    const existing = groups.find(
      (g) => Math.abs(g.lat - r.lat) < 0.003 && Math.abs(g.lng - r.lng) < 0.003
    );
    if (existing) {
      existing.reports.push(r);
      if (getSeverity(r.score) === "High") existing.topSeverity = "High";
      else if (getSeverity(r.score) === "Medium" && existing.topSeverity !== "High")
        existing.topSeverity = "Medium";
    } else {
      groups.push({ lat: r.lat, lng: r.lng, topSeverity: getSeverity(r.score), reports: [r] });
    }
  });
  return groups;
};

// Light map styles
const LIGHT_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#f5f7fa" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f7fa" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a8caa" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#3a5f8a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7a9bbf" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d8edda" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5a8a6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dde3ec" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a9aaa" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8eef7" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c8d4e6" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#6a7a9a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#e8eef7" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#8a9aaa" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c8dff5" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5a7a9a" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#c8dff5" }] },
];

const loadGoogleMaps = (apiKey) => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) { resolve(window.google.maps); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Report Panel
// ════════════════════════════════════════════════════════════════════════════
function ReportPanel({ group, onClose, isMobile }) {
  const sorted = [...group.reports].sort((a, b) => b.score - a.score);
  return (
    <aside style={getPanelWrapStyle(isMobile)}>
      <div style={panelStyles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: severityColor(group.topSeverity), boxShadow: `0 0 8px ${severityColor(group.topSeverity)}88` }} />
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: COLORS.textMuted, textTransform: "uppercase" }}>
            {sorted.length} Report{sorted.length > 1 ? "s" : ""} at Location
          </span>
        </div>
        <button onClick={onClose} style={panelStyles.closeBtn} aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
        {sorted.map((r) => {
          const sev = getSeverity(r.score);
          return (
            <div key={r.id} style={{ ...panelStyles.card, borderLeft: `3px solid ${severityColor(sev)}` }}>
              <div style={panelStyles.cardTop}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15 }}>{typeIcon(r.type)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{r.type}</span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: severityColor(sev) + "18",
                  color: severityColor(sev),
                  border: `1px solid ${severityColor(sev)}44`,
                  letterSpacing: 0.5,
                }}>
                  {severityIcon(sev)} {sev} · {r.score}pts
                </span>
              </div>
              {/* Show place name in report panel */}
              {r.placeName && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <span style={{ fontSize: 11 }}>📍</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent }}>{r.placeName}</span>
                </div>
              )}
              <p style={{ margin: "6px 0 6px", fontSize: 13, color: COLORS.textDim, lineHeight: 1.6 }}>{r.desc}</p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>📅 {r.date}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Submit Form
// ════════════════════════════════════════════════════════════════════════════
function SubmitForm({ pin, onClose, onSubmitted, isMobile }) {
  const [type, setType] = useState("");
  const [checks, setChecks] = useState({});
  const [manualSeverity, setManualSeverity] = useState("");
  const [desc, setDesc] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [respondentName, setRespondentName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);
  const [activePin, setActivePin] = useState(pin);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const fileRef = useRef();

  const reverseGeocode = useCallback(async (lat, lng, onDone) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "LicabInfraWatch/1.0" } }
      );
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const road = a.road || a.pedestrian || a.footway || "";
        const village = a.village || a.suburb || a.neighbourhood || a.hamlet || "";
        const city = a.city || a.town || a.municipality || a.county || "";
        const name = data.name || "";
        if (name && name !== road) setLocationName(name + (village ? `, ${village}` : city ? `, ${city}` : ""));
        else if (road && village) setLocationName(`${road}, ${village}`);
        else if (road && city) setLocationName(`${road}, ${city}`);
        else if (village && city) setLocationName(`${village}, ${city}`);
        else if (city) setLocationName(city);
        else setLocationName(data.display_name?.split(",").slice(0, 3).join(",").trim() || `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
      } else {
        setLocationName(`${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
      }
    } catch {
      setLocationName(`${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
    }
    onDone && onDone();
  }, []);

  useEffect(() => {
    if (!activePin) { setLocationLoading(false); return; }
    reverseGeocode(activePin.lat, activePin.lng, () => setLocationLoading(false));
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    // Show "locating" state but don't update locationName yet
    setLocationLoading(false); // keep existing name visible while searching
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setActivePin({ lat, lng });
        setLocationLoading(true); // now resolving new location name
        reverseGeocode(lat, lng, () => { setLocationLoading(false); setGeoLoading(false); });
      },
      () => {
        setGeoLoading(false);
        setGeoError("Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const items = type ? CHECKLIST[type] : [];
  const score = items.reduce((s, i) => s + (checks[i.id] ? i.weight : 0), 0);
  const severity = type && score > 0 ? getSeverity(score) : null;
  const toggle = (id) => setChecks((p) => ({ ...p, [id]: !p[id] }));

  const handleSubmit = () => {
    if (!type || !desc.trim() || !manualSeverity) return;
    setSubmitted(true);
    setTimeout(() => onSubmitted(), 2200);
  };

  if (submitted) {
    return (
      <aside style={getPanelWrapStyle(isMobile)}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: COLORS.success + "18", border: `2px solid ${COLORS.success}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16 }}>✅</div>
          <h3 style={{ color: COLORS.success, margin: "0 0 10px", fontSize: 18, fontWeight: 800 }}>Report Submitted!</h3>
          <p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
            Your report is pending admin verification. It will appear on the map once approved.
          </p>
        </div>
      </aside>
    );
  }

  const canSubmit = type && desc.trim() && manualSeverity;

  return (
    <aside style={getPanelWrapStyle(isMobile)}>
      <div style={panelStyles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: COLORS.textMuted, textTransform: "uppercase" }}>New Report</span>
        </div>
        <button onClick={onClose} style={panelStyles.closeBtn} aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Location */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Pinned Location</label>
          <div style={{ ...panelStyles.infoBox }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 14, marginTop: 2 }}>📌</span>
              <div style={{ flex: 1 }}>
                {locationLoading ? (
                  <span style={{ color: COLORS.textMuted, fontStyle: "italic", fontSize: 13 }}>Resolving location name…</span>
                ) : locationName ? (
                  <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 13, lineHeight: 1.45, display: "block", marginBottom: 3 }}>{locationName}</span>
                ) : null}
                <div style={{ color: COLORS.textMuted, fontSize: 11 }}>
                  {activePin.lat.toFixed(5)}° N, {activePin.lng.toFixed(5)}° E
                </div>
              </div>
            </div>
            <button
              onClick={handleGetCurrentLocation}
              disabled={geoLoading}
              style={{
                marginTop: 10, padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${COLORS.accentLight}55`,
                background: geoLoading ? COLORS.surfaceMid : COLORS.accent + "10",
                color: geoLoading ? COLORS.textMuted : COLORS.accent,
                fontSize: 12, fontWeight: 700, cursor: geoLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                width: "100%", justifyContent: "center",
              }}
            >
              {geoLoading
                ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Finding your location…</>
                : <><span>🎯</span> Use My Current Location</>
              }
            </button>
            {geoError && <p style={{ margin: "6px 0 0", fontSize: 11, color: COLORS.danger }}>{geoError}</p>}
          </div>
        </div>

        {/* Respondent Name */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>
            Respondent Name
            <span style={{ color: COLORS.textMuted, fontSize: 9, marginLeft: 6, fontWeight: 400 }}>(OPTIONAL)</span>
          </label>
          <input
            type="text"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            placeholder="Enter your full name…"
            style={{ ...panelStyles.input }}
          />
        </div>

        {/* Type */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Infrastructure Type <span style={{ color: COLORS.danger }}>*</span></label>
          <div style={{ display: "flex", gap: 6 }}>
            {INFRA_TYPES.map((t) => (
              <button key={t} onClick={() => { setType(t); setChecks({}); }}
                style={{
                  flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                  cursor: "pointer", letterSpacing: 0.3, transition: "all 0.15s",
                  background: type === t ? COLORS.accent : COLORS.surfaceHigh,
                  border: `1.5px solid ${type === t ? COLORS.accentLight : COLORS.border}`,
                  color: type === t ? "white" : COLORS.textDim,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  boxShadow: type === t ? `0 2px 10px ${COLORS.accentGlow}` : "none",
                }}>
                <span style={{ fontSize: 18 }}>{typeIcon(t)}</span>
                <span>{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Damage Level */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Damage Level <span style={{ color: COLORS.danger }}>*</span></label>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { value: "High", icon: "🔴", color: COLORS.pin.high },
              { value: "Medium", icon: "🟡", color: COLORS.pin.medium },
              { value: "Low", icon: "🟢", color: COLORS.pin.low },
            ].map(({ value, icon, color }) => (
              <button key={value} onClick={() => setManualSeverity(value)}
                style={{
                  flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                  cursor: "pointer", letterSpacing: 0.5, transition: "all 0.15s",
                  background: manualSeverity === value ? color + "18" : COLORS.surfaceHigh,
                  border: `1.5px solid ${manualSeverity === value ? color : COLORS.border}`,
                  color: manualSeverity === value ? color : COLORS.textDim,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  boxShadow: manualSeverity === value ? `0 0 10px ${color}33` : "none",
                }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span>{value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Checklist */}
        {type && (
          <div style={panelStyles.section}>
            <label style={panelStyles.label}>Damage Checklist</label>
            <div style={{ background: COLORS.surfaceHigh, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
              {items.map((item, idx) => (
                <label key={item.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  cursor: "pointer", background: checks[item.id] ? COLORS.accent + "0d" : "transparent",
                  borderBottom: idx < items.length - 1 ? `1px solid ${COLORS.border}` : "none",
                  transition: "background 0.1s",
                }}>
                  <input type="checkbox" checked={!!checks[item.id]} onChange={() => toggle(item.id)}
                    style={{ accentColor: COLORS.accent, width: 15, height: 15, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: checks[item.id] ? COLORS.text : COLORS.textDim, flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, background: COLORS.border, padding: "1px 7px", borderRadius: 10 }}>+{item.weight}</span>
                </label>
              ))}
            </div>
            {score > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, padding: "8px 12px", background: COLORS.surfaceMid, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 12, color: COLORS.textDim }}>Score: <strong style={{ color: COLORS.text }}>{score}</strong></span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: severityColor(severity) + "18", color: severityColor(severity), border: `1px solid ${severityColor(severity)}44` }}>
                  {severityIcon(severity)} {severity} Severity
                </span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Description <span style={{ color: COLORS.danger }}>*</span></label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the damage in detail…"
            style={{ ...panelStyles.input, height: 88, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
        </div>

        {/* Photo */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Photo (optional)</label>
          <div onClick={() => fileRef.current.click()} style={{
            border: `1.5px dashed ${COLORS.border}`, borderRadius: 10, padding: "14px",
            textAlign: "center", cursor: "pointer", background: COLORS.surfaceHigh,
            transition: "border-color 0.15s",
          }}>
            {photoName
              ? <span style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>📷 {photoName}</span>
              : <><div style={{ fontSize: 24, marginBottom: 4 }}>📸</div><span style={{ color: COLORS.textMuted, fontSize: 12 }}>Click to attach a photo</span></>
            }
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => setPhotoName(e.target.files[0]?.name || "")} />
          </div>
        </div>

        <div style={{ padding: isMobile ? "12px 16px 32px" : "12px 16px 20px", flexShrink: 0 }}>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{
              width: "100%", padding: "13px", borderRadius: 11, border: "none",
              background: canSubmit ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentLight})` : COLORS.surfaceMid,
              color: canSubmit ? "white" : COLORS.textMuted,
              fontWeight: 700, fontSize: 14, letterSpacing: 0.5,
              boxShadow: canSubmit ? `0 4px 18px ${COLORS.accentGlow}` : "none",
              transition: "all 0.2s", cursor: canSubmit ? "pointer" : "not-allowed",
            }}>
            {canSubmit ? "🚀 Submit Report" : "Complete all required fields"}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Google Map
// ════════════════════════════════════════════════════════════════════════════
function GoogleMap({ reports, pinMode, onMapClick, onPinClick, newPin, selectedGroup }) {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const newPinMarkerRef = useRef(null);
  const onMapClickRef = useRef(onMapClick);
  const pinModeRef = useRef(pinMode);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { pinModeRef.current = pinMode; }, [pinMode]);
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);

  useEffect(() => {
    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then(() => setMapsLoaded(true))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!mapsLoaded || googleMapRef.current || !mapRef.current) return;
    const { maps } = window.google;
    const map = new maps.Map(mapRef.current, {
      center: LICAB_CENTER,
      zoom: 14,
      styles: LIGHT_MAP_STYLES,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy",
      zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
      fullscreenControlOptions: { position: maps.ControlPosition.RIGHT_TOP },
    });

    map.addListener("click", (e) => {
      if (!pinModeRef.current) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      if (lat < LICAB_BOUNDS.minLat || lat > LICAB_BOUNDS.maxLat ||
        lng < LICAB_BOUNDS.minLng || lng > LICAB_BOUNDS.maxLng) {
        onMapClickRef.current({ outOfBounds: true });
        return;
      }
      onMapClickRef.current({ lat, lng });
    });

    googleMapRef.current = map;
  }, [mapsLoaded]);

  useEffect(() => {
    if (!googleMapRef.current) return;
    googleMapRef.current.setOptions({ draggableCursor: pinMode ? "crosshair" : "" });
  }, [pinMode]);

  useEffect(() => {
    if (!mapsLoaded || !googleMapRef.current) return;
    const { maps } = window.google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const groups = groupReports(reports);
    groups.forEach((group) => {
      const sev = group.topSeverity;
      const color = severityColor(sev);
      const isSelected = selectedGroup &&
        Math.abs(selectedGroup.lat - group.lat) < 0.001 &&
        Math.abs(selectedGroup.lng - group.lng) < 0.001;
      const count = group.reports.length;

      const markerSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="-14 -18 28 36">
          <circle r="14" fill="${color}" opacity="0.15"/>
          <path d="M0,-18 C8,-18 14,-12 14,-5 C14,5 0,18 0,18 C0,18 -14,5 -14,-5 C-14,-12 -8,-18 0,-18 Z"
                fill="${color}" stroke="white" stroke-width="1.5"/>
          <circle cx="0" cy="-5" r="5" fill="white" opacity="0.95"/>
          ${isSelected ? `<circle cx="0" cy="-5" r="7" fill="none" stroke="white" stroke-width="1" opacity="0.5"/>` : ""}
        </svg>`;

      const marker = new maps.Marker({
        position: { lat: group.lat, lng: group.lng },
        map: googleMapRef.current,
        icon: {
          url: `data:image/svg+xml,${encodeURIComponent(markerSvg)}`,
          scaledSize: new maps.Size(28, 36),
          anchor: new maps.Point(14, 36),
        },
        zIndex: isSelected ? 1000 : 1,
        title: `${group.topSeverity} severity - ${count} report${count > 1 ? "s" : ""}`,
      });

      marker.addListener("click", () => {
        if (pinModeRef.current) return;
        onPinClickRef.current(group);
      });
      markersRef.current.push(marker);
    });

    if (!document.getElementById("gmaps-pulse-style")) {
      const s = document.createElement("style");
      s.id = "gmaps-pulse-style";
      s.textContent = `@keyframes gmaps-pulse { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.5);opacity:0} }`;
      document.head.appendChild(s);
    }
  }, [reports, selectedGroup, mapsLoaded]);

  useEffect(() => {
    if (!mapsLoaded || !googleMapRef.current) return;
    const { maps } = window.google;
    if (newPinMarkerRef.current) { newPinMarkerRef.current.setMap(null); newPinMarkerRef.current = null; }
    if (!newPin) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="-14 -18 28 36">
      <path d="M0,-18 C8,-18 14,-12 14,-5 C14,5 0,18 0,18 C0,18 -14,5 -14,-5 C-14,-12 -8,-18 0,-18 Z"
            fill="#2563eb" stroke="white" stroke-width="1.5" opacity="0.9"/>
      <circle cx="0" cy="-5" r="5" fill="white" opacity="0.95"/>
    </svg>`;
    newPinMarkerRef.current = new maps.Marker({
      position: { lat: newPin.lat, lng: newPin.lng },
      map: googleMapRef.current,
      icon: {
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        scaledSize: new maps.Size(28, 36),
        anchor: new maps.Point(14, 36),
      },
    });
  }, [newPin, mapsLoaded]);

  if (loadError) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: COLORS.bg, gap: 12 }}>
        <span style={{ fontSize: 40 }}>🗺️</span>
        <p style={{ color: COLORS.textMuted, fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          Google Maps could not be loaded.<br />Please check your API key or network connection.
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 400 }} />
      {!mapsLoaded && (
        <div style={{ position: "absolute", inset: 0, background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 10 }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Loading Google Maps…</span>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Stats Bar
// ════════════════════════════════════════════════════════════════════════════
function StatsBar({ reports }) {
  const high = reports.filter(r => getSeverity(r.score) === "High").length;
  const med = reports.filter(r => getSeverity(r.score) === "Medium").length;
  const low = reports.filter(r => getSeverity(r.score) === "Low").length;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[
        { label: "High", count: high, color: COLORS.pin.high },
        { label: "Med", count: med, color: COLORS.pin.medium },
        { label: "Low", count: low, color: COLORS.pin.low },
      ].map(({ label, count, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: color + "18", border: `1px solid ${color}33` }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
          <span style={{ fontSize: 11, color, fontWeight: 600 }}>{count} {label}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [reports] = useState(MOCK_REPORTS);
  const [pinMode, setPinMode] = useState(false);
  const [newPin, setNewPin] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showPanel, setShowPanel] = useState(true);
  const [pinGeoLoading, setPinGeoLoading] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast("⚠️ Geolocation is not supported by your browser.");
      return;
    }
    setPinGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (lat < LICAB_BOUNDS.minLat || lat > LICAB_BOUNDS.maxLat ||
          lng < LICAB_BOUNDS.minLng || lng > LICAB_BOUNDS.maxLng) {
          setPinGeoLoading(false);
          showToast("⚠️ Your location is outside the Licab municipality area.");
          return;
        }
        setNewPin({ lat, lng });
        setSelectedGroup(null);
        setShowForm(true);
        setPinMode(false);
        setShowPanel(true);
        setPinGeoLoading(false);
      },
      () => {
        setPinGeoLoading(false);
        showToast("⚠️ Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [showToast]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredReports = filter === "All" ? reports : reports.filter((r) => r.type === filter);

  const handleMapClick = useCallback(({ lat, lng, outOfBounds }) => {
    if (!pinMode) return;
    if (outOfBounds) { showToast("⚠️ Please pin within the Licab municipality area."); return; }
    setNewPin({ lat, lng });
    setSelectedGroup(null);
    setShowForm(true);
    setPinMode(false);
    setShowPanel(true);
  }, [pinMode, showToast]);

  const handlePinClick = useCallback((group) => {
    if (pinMode) return;
    setSelectedGroup(group);
    setShowForm(false);
    setShowPanel(true);
  }, [pinMode]);

  const closePanel = () => { setSelectedGroup(null); setShowForm(false); setNewPin(null); setShowPanel(false); };

  const sideOpen = showPanel && (selectedGroup || showForm);

  return (
    <div style={{
      minHeight: "100vh", height: "100vh", width: "100vw",
      background: COLORS.bg,
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
      color: COLORS.text, overflow: "hidden",
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    }}>
      {/* Global CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: ${COLORS.bg} !important; }
        body { overflow: hidden !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 10px; }
        button:focus-visible { outline: 2px solid ${COLORS.accentLight}; outline-offset: 2px; }
        input, textarea { box-sizing: border-box; font-family: inherit; }
        button { font-family: inherit; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 16px" : "0 24px",
        height: isMobile ? "auto" : "60px",
        minHeight: isMobile ? 56 : 60,
        background: "#0f172a",
        gap: 10, flexWrap: isMobile ? "wrap" : "nowrap",
        zIndex: 1000, flexShrink: 0,
        paddingTop: isMobile ? 10 : 0,
        paddingBottom: isMobile ? 10 : 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            color: "white", fontWeight: 800, fontSize: 10, padding: "6px 10px",
            borderRadius: 8, letterSpacing: 1.8,
            border: "1px solid rgba(255,255,255,0.15)",
          }}>LGU</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15, color: "white", lineHeight: 1.2, letterSpacing: -0.3 }}>Licab InfraWatch</div>
            {!isMobile && <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1.4, textTransform: "uppercase", marginTop: 2 }}>Nueva Ecija · Damage Reporting</div>}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexWrap: "wrap", flex: isMobile ? "1 1 100%" : "0 0 auto", justifyContent: isMobile ? "space-between" : "flex-end" }}>
          {/* Stats */}
          {!isMobile && <StatsBar reports={filteredReports} />}

          {/* Filters */}
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            {["All", ...INFRA_TYPES].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: isMobile ? "5px 10px" : "5px 13px",
                borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
                letterSpacing: 0.2, transition: "all 0.15s", border: "none",
                background: filter === f ? "#3b82f6" : "transparent",
                color: filter === f ? "white" : "#94a3b8",
                boxShadow: filter === f ? "0 1px 6px rgba(59,130,246,0.4)" : "none",
              }}>{f}</button>
            ))}
          </div>

          {/* Report button */}
          <button
            onClick={() => { setPinMode(p => !p); setSelectedGroup(null); setShowForm(false); }}
            style={{
              padding: isMobile ? "8px 14px" : "8px 18px",
              borderRadius: 9, border: "none", color: "white",
              fontWeight: 600, fontSize: isMobile ? 12 : 13, cursor: "pointer",
              letterSpacing: 0.3, transition: "all 0.2s", whiteSpace: "nowrap",
              background: pinMode ? "#dc2626" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              boxShadow: pinMode ? "0 4px 14px rgba(220,38,38,0.4)" : "0 4px 14px rgba(29,78,216,0.35)",
            }}>
            {pinMode ? "✕ Cancel" : (isMobile ? "+ Report" : "+ Report Damage")}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <GoogleMap
            reports={filteredReports}
            pinMode={pinMode}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            newPin={newPin}
            selectedGroup={selectedGroup}
          />

          {/* Pin mode banner */}
          {pinMode && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              background: "#0f172a", color: "white", padding: "10px 16px 10px 20px",
              borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 900,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)", whiteSpace: "nowrap",
              animation: "fadeUp 0.3s ease",
              display: "flex", alignItems: "center", gap: 10,
              border: "1px solid rgba(59,130,246,0.4)",
            }}>
              <span style={{ animation: "spin 2s linear infinite", display: "inline-block", fontSize: 16, pointerEvents: "none" }}>📍</span>
              <span style={{ pointerEvents: "none" }}>Click the map to pin the damage location</span>
              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
              <button
                onClick={handleUseCurrentLocation}
                disabled={pinGeoLoading}
                style={{
                  background: pinGeoLoading ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.85)",
                  color: "white", border: "none", borderRadius: 14,
                  padding: "5px 12px", fontSize: 11, fontWeight: 700,
                  cursor: pinGeoLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                  letterSpacing: 0.3, whiteSpace: "nowrap",
                  transition: "background 0.15s",
                  flexShrink: 0,
                }}>
                {pinGeoLoading
                  ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Locating…</>
                  : <><span>📡</span> Use Current Location</>
                }
              </button>
            </div>
          )}

          {/* Mobile: Show panel toggle */}
          {isMobile && sideOpen && (
            <button onClick={() => setShowPanel(p => !p)} style={{
              position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
              background: COLORS.accent, color: "white", border: "none",
              padding: "8px 22px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              cursor: "pointer", zIndex: 900, boxShadow: `0 4px 16px ${COLORS.accentGlow}`,
            }}>
              {showPanel ? "⬇ Hide Details" : "⬆ Show Details"}
            </button>
          )}

          {/* Map badge */}
          <div style={{
            position: "absolute", bottom: 6, left: 8,
            background: "rgba(255,255,255,0.85)", color: COLORS.textMuted,
            fontSize: 10, padding: "3px 8px", borderRadius: 6,
            pointerEvents: "none", zIndex: 900, border: `1px solid ${COLORS.border}`,
            backdropFilter: "blur(4px)",
          }}>
            🗺️ Google Maps
          </div>
        </div>

        {/* Side Panel */}
        {sideOpen && (
          <div style={isMobile ? {
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 950,
            maxHeight: showPanel ? "72vh" : 0,
            overflow: "hidden",
            transition: "max-height 0.3s ease",
          } : {
            animation: "slideRight 0.22s ease",
            height: "100%",
          }}>
            {selectedGroup && !showForm && (
              <ReportPanel group={selectedGroup} onClose={closePanel} isMobile={isMobile} />
            )}
            {showForm && newPin && (
              <SubmitForm pin={newPin} onClose={closePanel} isMobile={isMobile}
                onSubmitted={() => { closePanel(); showToast("✅ Report submitted for admin review!"); }} />
            )}
          </div>
        )}
      </div>

      {/* ── Legend (desktop bottom bar) ── */}
      {!isMobile && (
        <div style={{
          display: "flex", alignItems: "center", gap: 18,
          padding: "8px 24px", background: "#0f172a",
          flexWrap: "wrap", flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" }}>Legend</span>
          {["High", "Medium", "Low"].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: severityColor(s), boxShadow: `0 0 6px ${severityColor(s)}88` }} />
              <span style={{ fontSize: 11, color: "#64748b" }}>{s} Severity</span>
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: "#1e293b" }} />
          {INFRA_TYPES.map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 12 }}>{typeIcon(t)}</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{t}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#475569" }}>
            <span style={{ color: "#3b82f6", fontWeight: 700 }}>{reports.length}</span> approved reports · Licab, Nueva Ecija
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 70, left: "50%", transform: "translateX(-50%)",
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          color: COLORS.text, padding: "10px 24px", borderRadius: 24,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          zIndex: 9999, animation: "fadeUp 0.2s ease", whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Panel Styles ─────────────────────────────────────────────────────────────
const getPanelWrapStyle = (isMobile) => ({
  position: isMobile ? "fixed" : "absolute",
  bottom: isMobile ? 0 : "auto",
  right: isMobile ? 0 : 0,
  top: isMobile ? "auto" : 0,
  left: isMobile ? 0 : "auto",
  width: isMobile ? "100%" : 380,
  minWidth: isMobile ? "100%" : 340,
  maxHeight: isMobile ? "88vh" : "100%",
  background: COLORS.surface,
  borderLeft: isMobile ? "none" : `1px solid ${COLORS.border}`,
  borderTop: isMobile ? `1px solid ${COLORS.border}` : "none",
  borderRadius: isMobile ? "24px 24px 0 0" : "0",
  display: "flex",
  flexDirection: "column",
  boxShadow: isMobile ? "0 -4px 24px rgba(0,0,0,0.1)" : "-4px 0 24px rgba(0,0,0,0.06)",
  zIndex: 500,
  animation: isMobile ? "slideUp 0.25s ease-out" : "slideRight 0.25s ease-out",
});

const panelStyles = {
  wrap: {
    width: 380,
    minWidth: 340,
    background: COLORS.surface,
    borderLeft: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.06)",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
    background: COLORS.surface,
  },
  closeBtn: {
    background: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`,
    color: COLORS.textMuted, cursor: "pointer", padding: "7px", borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  },
  card: {
    padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`,
    transition: "background 0.15s",
  },
  cardTop: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
  },
  section: { padding: "14px 20px 0" },
  label: {
    display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
    color: COLORS.textMuted, marginBottom: 8, textTransform: "uppercase",
  },
  input: {
    width: "100%", background: COLORS.surfaceHigh, border: `1.5px solid ${COLORS.border}`,
    borderRadius: 10, color: COLORS.text, padding: "10px 14px",
    fontSize: 13, outline: "none", transition: "border-color 0.15s",
  },
  infoBox: {
    background: COLORS.surfaceHigh, border: `1.5px solid ${COLORS.border}`,
    borderRadius: 12, padding: "14px 16px",
  },
};