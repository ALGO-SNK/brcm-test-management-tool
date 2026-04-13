export function NoSuiteSelected() {
  return (
    <div className="empty-cases">
      <div className="empty-cases__illustration">
        <svg viewBox="0 0 240 180" fill="none" className="empty-cases__svg">
          {/* Folder stack */}
          <rect x="65" y="65" width="110" height="75" rx="6" fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1.5" />
          <path d="M65 71 C65 67.7 67.7 65 71 65 L100 65 L108 55 L165 55 C168.3 55 171 57.7 171 61 L171 65 L65 65 Z" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="1.5" />

          {/* Folder tab accent */}
          <rect x="75" y="58" width="28" height="4" rx="2" fill="var(--color-primary)" opacity="0.3" />

          {/* Arrow pointing left toward sidebar */}
          <path d="M50 100 L30 100" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          <path d="M36 94 L28 100 L36 106" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />

          {/* Lines inside folder */}
          <line x1="85" y1="85" x2="155" y2="85" stroke="var(--color-border)" strokeWidth="1.2" opacity="0.4" />
          <line x1="85" y1="95" x2="145" y2="95" stroke="var(--color-border)" strokeWidth="1.2" opacity="0.3" />
          <line x1="85" y1="105" x2="135" y2="105" stroke="var(--color-border)" strokeWidth="1.2" opacity="0.25" />

          {/* Decorative dots */}
          <circle cx="195" cy="50" r="3" fill="var(--color-primary)" opacity="0.12" />
          <circle cx="205" cy="90" r="2" fill="var(--color-primary)" opacity="0.1" />
          <circle cx="50" cy="55" r="2.5" fill="var(--color-primary)" opacity="0.1" />
        </svg>
      </div>

      <h3 className="empty-cases__title">Select a suite</h3>
      <p className="empty-cases__desc">
        Choose a test suite from the tree on the left to view its test cases.
      </p>
    </div>
  );
}
