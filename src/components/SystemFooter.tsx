export function SystemFooter() {
  return (
    <footer className="app-footer system-footer" aria-label="PULSE system telemetry and identity">
      <div className="footer-runtime">
        <span>نسخه <b>2026.08</b></span>
        <span>محیط <b>PRODUCTION</b></span>
        <span><i className="telemetry-led" /> متصل</span>
      </div>
      <div className="footer-telemetry">
        <span><i className="telemetry-led" /> وضعیت سیستم</span>
        <span><i className="telemetry-led telemetry-led-cyan" /> هسته هوش مصنوعی <b>ACTIVE</b></span>
        <span><i className="telemetry-led telemetry-led-amber" /> دانش <b>SYNCED</b></span>
      </div>
      <div className="footer-identity"><strong>PULSE</strong><span>تحول دیجیتال</span></div>
    </footer>
  );
}
