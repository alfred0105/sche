/**
 * @fileoverview Unit tests for constants module.
 */
import { describe, it, expect } from 'vitest';
import {
    TRACKER_UNITS, KR_FIXED_HOLIDAYS, DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_INCOME_CATEGORIES, DEFAULT_SCHEDULE_CATEGORIES, DEFAULT_ACCOUNTS,
    DEFAULT_PROFILE, TABS, EMOJI_LIST, GRADIENT_LIST, PIE_COLORS,
} from '../constants';

describe('TRACKER_UNITS', () => {
    it('has correct number of category groups', () => {
        expect(TRACKER_UNITS.length).toBe(5);
    });

    it('each group has a category name and options', () => {
        TRACKER_UNITS.forEach((group) => {
            expect(group.category).toBeDefined();
            expect(Array.isArray(group.options)).toBe(true);
            expect(group.options.length).toBeGreaterThan(0);
        });
    });
});

describe('KR_FIXED_HOLIDAYS', () => {
    it('contains standard Korean holidays', () => {
        expect(KR_FIXED_HOLIDAYS).toContain('01-01');
        expect(KR_FIXED_HOLIDAYS).toContain('03-01');
        expect(KR_FIXED_HOLIDAYS).toContain('12-25');
        expect(KR_FIXED_HOLIDAYS).toContain('10-03');
    });
});

describe('DEFAULT_EXPENSE_CATEGORIES', () => {
    it('has at least 3 categories', () => {
        expect(DEFAULT_EXPENSE_CATEGORIES.length).toBeGreaterThanOrEqual(3);
    });

    it('each category has id, label and icon', () => {
        DEFAULT_EXPENSE_CATEGORIES.forEach((cat) => {
            expect(cat.id).toBeDefined();
            expect(cat.label).toBeDefined();
            expect(cat.icon).toBeDefined();
        });
    });
});

describe('DEFAULT_INCOME_CATEGORIES', () => {
    it('has at least 3 categories', () => {
        expect(DEFAULT_INCOME_CATEGORIES.length).toBeGreaterThanOrEqual(3);
    });
});

describe('DEFAULT_SCHEDULE_CATEGORIES', () => {
    it('has proper structure', () => {
        DEFAULT_SCHEDULE_CATEGORIES.forEach((cat) => {
            expect(cat.id).toBeDefined();
            expect(cat.label).toBeDefined();
            expect(cat.icon).toBeDefined();
        });
    });
});

describe('DEFAULT_ACCOUNTS', () => {
    it('contains a default cash account', () => {
        const cash = DEFAULT_ACCOUNTS.find((a) => a.id === 'cash');
        expect(cash).toBeDefined();
        expect(cash.default).toBe(true);
    });

    it('has various account types', () => {
        const types = DEFAULT_ACCOUNTS.map((a) => a.type);
        expect(types).toContain('cash');
        expect(types).toContain('bank');
        expect(types).toContain('savings');
        expect(types).toContain('investment');
    });
});

describe('DEFAULT_PROFILE', () => {
    it('has name, theme, and accent', () => {
        expect(DEFAULT_PROFILE.name).toBeDefined();
        expect(DEFAULT_PROFILE.theme).toBeDefined();
        expect(DEFAULT_PROFILE.accent).toBeDefined();
    });
});

describe('TABS', () => {
    it('has 5 navigation tabs', () => {
        expect(TABS.length).toBe(5);
    });

    it('has home as first tab', () => {
        expect(TABS[0].id).toBe('home');
    });
});

describe('EMOJI_LIST', () => {
    it('has a reasonable number of emojis', () => {
        expect(EMOJI_LIST.length).toBeGreaterThanOrEqual(10);
    });
});

describe('GRADIENT_LIST', () => {
    it('has gradient definitions with from/to', () => {
        GRADIENT_LIST.forEach((g) => {
            expect(g.from).toMatch(/^from-/);
            expect(g.to).toMatch(/^to-/);
        });
    });
});

describe('PIE_COLORS', () => {
    it('has at least 5 colors', () => {
        expect(PIE_COLORS.length).toBeGreaterThanOrEqual(5);
    });

    it('all colors are hex format', () => {
        PIE_COLORS.forEach((c) => {
            expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });
});
