import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityBadge } from '../SecurityBadge';

describe('SecurityBadge', () => {
  it('renders secret classification', () => {
    render(<SecurityBadge classification="secret" readonly />);
    expect(screen.getByText('机密')).not.toBeNull();
  });

  it('renders cautious classification', () => {
    render(<SecurityBadge classification="cautious" readonly />);
    expect(screen.getByText('审慎')).not.toBeNull();
  });

  it('renders public classification', () => {
    render(<SecurityBadge classification="public" readonly />);
    expect(screen.getByText('公开')).not.toBeNull();
  });
});
