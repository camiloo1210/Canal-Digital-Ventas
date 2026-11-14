import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionNav } from '@/components/section-nav';

const items = [
  { id: 'section-basic', label: 'Basic' },
  { id: 'section-pricing', label: 'Pricing' },
];

describe('SectionNav', (): void => {
  it('renders a labelled landmark with one in-page link per section', (): void => {
    const html = renderToStaticMarkup(<SectionNav label="Form sections" items={items} />);
    expect(html).toContain('<nav');
    expect(html).toContain('aria-label="Form sections"');
    expect(html).toContain('href="#section-basic"');
    expect(html).toContain('href="#section-pricing"');
  });

  it('marks the first section as current until scrolling says otherwise', (): void => {
    const html = renderToStaticMarkup(<SectionNav label="Form sections" items={items} />);
    expect(html.match(/aria-current="location"/g)).toHaveLength(1);
    expect(html.indexOf('aria-current="location"')).toBeLessThan(html.indexOf('Pricing'));
  });

  it('keeps every target at least 44px tall for touch', (): void => {
    expect(renderToStaticMarkup(<SectionNav label="x" items={items} />)).toContain('min-h-11');
  });

  it('renders nothing for fewer than two sections', (): void => {
    expect(renderToStaticMarkup(<SectionNav label="x" items={items.slice(0, 1)} />)).toBe('');
  });
});
