import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceLevels } from './parse.js';
import { ICafeMenuItemPriceLevelData } from '../../../shared/models/buyondemand/responses.js';

const level = (name: string, amount: string): ICafeMenuItemPriceLevelData => ({
    priceLevelId: name,
    name,
    price:        { currencyUnit: 'USD', amount },
});

describe('parsePriceLevels', () => {
    it('keeps only MS_<year> levels, keyed by year', () => {
        const result = parsePriceLevels({
            priceLevels: {
                '1':   level('Base Price', '0.00'),
                '96':  level('MS_2025', '2.79'),
                '104': level('MS_2026', '2.89'),
                '80':  level('MS_ATL_2023', '0.00'),
            },
        });

        assert.equal(result.size, 2);
        assert.equal(result.get(2025), 2.79);
        assert.equal(result.get(2026), 2.89);
    });

    it('skips zero, negative and non-finite amounts', () => {
        const result = parsePriceLevels({
            priceLevels: {
                '96':  level('MS_2025', '0.00'),
                '104': level('MS_2026', 'not-a-number'),
                '70':  level('MS_2019', '1.05'),
            },
        });

        assert.equal(result.size, 1);
        assert.equal(result.get(2019), 1.05);
    });

    it('tolerates missing or empty priceLevels', () => {
        assert.equal(parsePriceLevels({ priceLevels: undefined }).size, 0);
        assert.equal(parsePriceLevels({ priceLevels: null }).size, 0);
        assert.equal(parsePriceLevels({ priceLevels: {} }).size, 0);
    });
});
