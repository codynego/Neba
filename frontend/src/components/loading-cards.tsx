export function LoadingCards({ people = false }: { people?: boolean }) {
  return <div className={people ? "offer-grid" : "task-grid"} role="status" aria-label={people ? "Finding people" : "Finding tasks"}>{[0, 1, 2].map((item) => <div className="skeleton-card" key={item} aria-hidden="true"><div className="skeleton square" /><div className="skeleton line long" /><div className="skeleton line" /><div className="skeleton line short" /></div>)}</div>;
}
