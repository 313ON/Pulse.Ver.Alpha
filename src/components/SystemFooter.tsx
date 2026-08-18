export function SystemFooter() {
  return (
    <footer className="app-footer system-footer" aria-label="PULSE system telemetry and identity">
      <div className="footer-identity"><strong>PULSE</strong><span>تحول دیجیتال</span></div>
      <div className="footer-telemetry">
        <span><i className="telemetry-led" /> System Operational</span>
        <span><i className="telemetry-led telemetry-led-cyan" /> AI Core Status <b>ACTIVE</b></span>
        <span><i className="telemetry-led telemetry-led-amber" /> Knowledge Status <b>SYNCED</b></span>
      </div>
      <div className="footer-runtime">
        <span>VERSION <b>2026.08</b></span>
        <span>ENV <b>PRODUCTION</b></span>
        <span><i className="telemetry-led" /> CONNECTED</span>
      </div>
    </footer>
  );
}
