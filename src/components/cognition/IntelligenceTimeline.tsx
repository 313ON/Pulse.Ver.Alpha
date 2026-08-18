const defaultEvents = [
  "دانش همگام‌سازی شد",
  "گردش‌کار تحلیل شد",
  "فعالیت پردازش شد"
];

export function IntelligenceTimeline({ events = defaultEvents }: { events?: string[] }) {
  return (
    <div className="intelligence-timeline">
      <div className="cognition-section-label">رویدادهای اخیر هوشمندی</div>
      {events.map((event, index) => (
        <div className="intelligence-event" key={`${event}-${index}`}>
          <i />
          <span>{event}</span>
          <small>{index === 0 ? "اکنون" : `${index * 2} دقیقه قبل`}</small>
        </div>
      ))}
    </div>
  );
}
