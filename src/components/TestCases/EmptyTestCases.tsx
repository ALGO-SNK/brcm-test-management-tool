interface EmptyTestCasesProps {
  suiteName: string;
  onAddTestCase?: () => void;
}

export function EmptyTestCases({ suiteName, onAddTestCase }: EmptyTestCasesProps) {
  return (
    <div className="empty-cases">
      <div className="empty-cases__illustration">
        <svg viewBox="0 0 240 180" fill="none" className="empty-cases__svg">
          {/* Canvas / easel */}
          <rect x="70" y="30" width="110" height="85" rx="4" fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1.5" />
          <line x1="125" y1="115" x2="105" y2="170" stroke="var(--color-border)" strokeWidth="2" />
          <line x1="125" y1="115" x2="145" y2="170" stroke="var(--color-border)" strokeWidth="2" />
          <line x1="110" y1="145" x2="140" y2="145" stroke="var(--color-border)" strokeWidth="1.5" />

          {/* Clipboard icon on canvas */}
          <rect x="105" y="50" width="40" height="50" rx="3" fill="var(--color-bg-elevated)" stroke="var(--color-primary)" strokeWidth="1.2" opacity="0.6" />
          <rect x="115" y="45" width="20" height="8" rx="2" fill="var(--color-primary-bg)" stroke="var(--color-primary)" strokeWidth="1" opacity="0.6" />
          <line x1="113" y1="65" x2="137" y2="65" stroke="var(--color-border)" strokeWidth="1.2" opacity="0.5" />
          <line x1="113" y1="73" x2="133" y2="73" stroke="var(--color-border)" strokeWidth="1.2" opacity="0.5" />
          <line x1="113" y1="81" x2="130" y2="81" stroke="var(--color-border)" strokeWidth="1.2" opacity="0.5" />
          <line x1="113" y1="89" x2="127" y2="89" stroke="var(--color-border)" strokeWidth="1.2" opacity="0.4" />

          {/* Decorative dots */}
          <circle cx="55" cy="55" r="3" fill="var(--color-primary)" opacity="0.15" />
          <circle cx="195" cy="45" r="2.5" fill="var(--color-primary)" opacity="0.12" />
          <circle cx="48" cy="90" r="2" fill="var(--color-primary)" opacity="0.1" />
          <circle cx="200" cy="80" r="3.5" fill="var(--color-primary)" opacity="0.08" />

          {/* Small cloud shapes */}
          <ellipse cx="60" cy="30" rx="12" ry="6" fill="var(--color-border)" opacity="0.25" />
          <ellipse cx="190" cy="25" rx="10" ry="5" fill="var(--color-border)" opacity="0.2" />
        </svg>
      </div>

      <div className="empty-cases__content">
        <h3 className="empty-cases__title">No test cases in this suite</h3>
        <p className="empty-cases__desc">
          <strong>{suiteName}</strong> is ready, but there are no test cases yet.
          Test cases will appear here once they are created or synced.
        </p>
        {onAddTestCase && (
          <button
            type="button"
            className="btn btn--primary mt-md"
            onClick={onAddTestCase}
          >
            + Create First Test Case
          </button>
        )}
      </div>
    </div>
  );
}
