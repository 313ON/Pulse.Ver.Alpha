const defaultEvents = [
  "Knowledge synchronized",
  "Workflow analyzed",
  "Activity processed"
];

export function IntelligenceTimeline({ events = defaultEvents }: { events?: string[] }) {
  return (
    <div className="intelligence-timeline">
      <div className="cognition-section-label">RECENT INTELLIGENCE EVENTS</div>
      {events.map((event, index) => (
        <div className="intelligence-event" key={`${event}-${index}`}>
          <i />
          <span>{event}</span>
          <small>{index === 0 ? "NOW" : `${index * 2}M AGO`}</small>
        </div>
      ))}
    </div>
  );
}
