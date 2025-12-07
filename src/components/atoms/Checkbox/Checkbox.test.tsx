/**
 * Tests for Checkbox atom component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
    it('should render unchecked state', () => {
        render(<Checkbox checked={false} onClick={() => { }} />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should render checked state with checkmark', () => {
        render(<Checkbox checked={true} onClick={() => { }} />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should render indeterminate state', () => {
        render(<Checkbox checked={false} indeterminate={true} onClick={() => { }} />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should call onClick when clicked', () => {
        const handleClick = vi.fn();
        render(<Checkbox checked={false} onClick={handleClick} />);

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick on Enter key', () => {
        const handleClick = vi.fn();
        render(<Checkbox checked={false} onClick={handleClick} />);

        const checkbox = screen.getByRole('checkbox');
        fireEvent.keyDown(checkbox, { key: 'Enter' });

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick on Space key', () => {
        const handleClick = vi.fn();
        render(<Checkbox checked={false} onClick={handleClick} />);

        const checkbox = screen.getByRole('checkbox');
        fireEvent.keyDown(checkbox, { key: ' ' });

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should apply small size class when size is sm', () => {
        render(<Checkbox checked={false} onClick={() => { }} size="sm" />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.className).toContain('w-4');
        expect(checkbox.className).toContain('h-4');
    });

    it('should apply medium size class by default', () => {
        render(<Checkbox checked={false} onClick={() => { }} />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.className).toContain('w-5');
        expect(checkbox.className).toContain('h-5');
    });

    it('should apply active styles when checked', () => {
        render(<Checkbox checked={true} onClick={vi.fn()} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.className).toContain('bg-[#79be15]');
    });

    it('should apply inactive styles when unchecked', () => {
        render(<Checkbox checked={false} onClick={vi.fn()} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.className).toContain('bg-white');
        expect(checkbox.className).toContain('border-slate-300');
    });
});
