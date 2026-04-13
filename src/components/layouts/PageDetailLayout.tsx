import React from 'react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isLink?: boolean;
  isActive?: boolean;
}

interface HeadingData {
  title: string;
  id?: string | number;
  count?: string | number;
  countLabel?: string;
}

interface PageDetailLayoutProps {
  breadcrumbs: BreadcrumbItem[];
  heading: HeadingData;
  children: React.ReactNode;
  className?: string;
}

/**
 * Unified page detail layout component
 * Provides consistent structure for Test Case List, Details, and Create pages
 *
 * Structure:
 * 1. Breadcrumbs section
 * 2. Main heading section
 * 3. Body/content section
 */
export function PageDetailLayout({
  breadcrumbs,
  heading,
  children,
  className = '',
}: PageDetailLayoutProps) {
  return (
    <div className={`page-detail-layout ${className}`}>
      {/* Section 1: Breadcrumbs */}
      <nav className="page-detail-layout__breadcrumbs breadcrumbs">
        {breadcrumbs.map((item, idx) => (
          <React.Fragment key={idx}>
            {item.isLink && item.onClick ? (
              <button className="breadcrumbs__link" onClick={item.onClick}>
                {item.label}
              </button>
            ) : (
              <span className={item.isActive ? 'breadcrumbs__current' : 'breadcrumbs__item'}>
                {item.label}
              </span>
            )}
            {idx < breadcrumbs.length - 1 && (
              <span className="breadcrumbs__separator">/</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Section 2: Main Heading */}
      <div className="page-detail-layout__heading-wrapper mb-lg">
        <div className="suite-main-heading">
          <h2 className="text-2xl font-semibold case-detail-pane__title" title={heading.title}>
            {heading.title}
          </h2>
          {heading.id !== undefined && (
            <span className="suite-main-heading__id">
              {heading.countLabel === 'New Test Case' ? 'New Test Case' : `ID: ${heading.id}`}
            </span>
          )}
          {heading.count !== undefined && (
            <span className="suite-main-heading__count">
              {heading.countLabel}: {heading.count}
            </span>
          )}
        </div>
      </div>

      {/* Section 3: Body/Content */}
      <div className="page-detail-layout__body">
        {children}
      </div>
    </div>
  );
}
