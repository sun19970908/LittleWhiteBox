import { amountAtBps, assertPositiveBankAmount, BANK_BASIS_POINTS } from './money.js';
import { drawBankInclusiveInteger } from './random.js';
import {
    throwBankError,
    type BankDepositFrozenContract,
    type BankDepositProduct,
    type BankFundFrozenContract,
    type BankFundProduct,
    type BankRandomSource,
} from './types.js';

function freezeDepositProduct(product: BankDepositProduct): Readonly<BankDepositProduct> {
    return Object.freeze({ ...product });
}

function freezeFundProduct(product: BankFundProduct): Readonly<BankFundProduct> {
    return Object.freeze({
        ...product,
        returnRangeBps: Object.freeze({ ...product.returnRangeBps }),
    });
}

/** Published contracts remain here after retirement so persisted positions stay interpretable. */
export const BANK_DEPOSIT_CONTRACTS: readonly Readonly<BankDepositProduct>[] = Object.freeze([
    freezeDepositProduct({
        id: 'short-term',
        name: '短期存单',
        lockRounds: 10,
        interestBps: 600,
        earlyPenaltyBps: 300,
        minAmount: 100,
        maxAmount: 2_000,
    }),
    freezeDepositProduct({
        id: 'mid-term',
        name: '中期存单',
        lockRounds: 25,
        interestBps: 1_800,
        earlyPenaltyBps: 500,
        minAmount: 200,
        maxAmount: 5_000,
    }),
    freezeDepositProduct({
        id: 'long-term',
        name: '长期存单',
        lockRounds: 50,
        interestBps: 4_500,
        earlyPenaltyBps: 1_000,
        minAmount: 500,
        maxAmount: 10_000,
    }),
]);

/** See BANK_DEPOSIT_CONTRACTS. */
export const BANK_FUND_CONTRACTS: readonly Readonly<BankFundProduct>[] = Object.freeze([
    freezeFundProduct({
        id: 'steady-fund',
        name: '稳健基金',
        description: '小幅波动，稳步前行。',
        lockRounds: 20,
        returnRangeBps: { min: -500, max: 2_000 },
        riskLevel: 'low',
        minAmount: 200,
        maxAmount: 3_000,
    }),
    freezeFundProduct({
        id: 'growth-fund',
        name: '成长基金',
        description: '回报与波动都更明显。',
        lockRounds: 30,
        returnRangeBps: { min: -2_000, max: 5_000 },
        riskLevel: 'medium',
        minAmount: 500,
        maxAmount: 5_000,
    }),
    freezeFundProduct({
        id: 'venture-fund',
        name: '风险基金',
        description: '高波动，收益在到期前不揭晓。',
        lockRounds: 40,
        returnRangeBps: { min: -5_000, max: 15_000 },
        riskLevel: 'high',
        minAmount: 1_000,
        maxAmount: 10_000,
    }),
]);

function assertCatalogRange(minAmount: unknown, maxAmount: unknown, detail: string): void {
    const min = assertPositiveBankAmount(minAmount, `${detail}:min`);
    const max = assertPositiveBankAmount(maxAmount, `${detail}:max`);
    if (min > max) {throwBankError('bank_product_invalid', `${detail}:range`);}
}

export function validateBankProductCatalog(input: {
    deposits: readonly BankDepositProduct[];
    funds: readonly BankFundProduct[];
}): void {
    const ids = new Set<string>();
    for (const product of input.deposits) {
        const id = typeof product?.id === 'string' ? product.id.trim() : '';
        if (!id || ids.has(id)) {throwBankError('bank_product_invalid', `deposit:${id || 'id'}`);}
        ids.add(id);
        if (!product.name.trim() || !Number.isSafeInteger(product.lockRounds) || product.lockRounds <= 0) {
            throwBankError('bank_product_invalid', `deposit:${id}:metadata`);
        }
        if (!Number.isSafeInteger(product.interestBps) || product.interestBps < 0
            || !Number.isSafeInteger(product.earlyPenaltyBps) || product.earlyPenaltyBps < 0
            || product.earlyPenaltyBps >= BANK_BASIS_POINTS) {
            throwBankError('bank_product_invalid', `deposit:${id}:bps`);
        }
        assertCatalogRange(product.minAmount, product.maxAmount, `deposit:${id}`);
        try {
            amountAtBps(product.maxAmount, product.interestBps);
            amountAtBps(product.maxAmount, -product.earlyPenaltyBps);
        } catch {
            throwBankError('bank_product_invalid', `deposit:${id}:amount`);
        }
    }
    for (const product of input.funds) {
        const id = typeof product?.id === 'string' ? product.id.trim() : '';
        if (!id || ids.has(id)) {throwBankError('bank_product_invalid', `fund:${id || 'id'}`);}
        ids.add(id);
        if (!product.name.trim() || !product.description.trim()
            || !Number.isSafeInteger(product.lockRounds) || product.lockRounds <= 0
            || !['low', 'medium', 'high'].includes(product.riskLevel)) {
            throwBankError('bank_product_invalid', `fund:${id}:metadata`);
        }
        if (!Number.isSafeInteger(product.returnRangeBps?.min)
            || !Number.isSafeInteger(product.returnRangeBps?.max)
            || product.returnRangeBps.min > product.returnRangeBps.max
            || product.returnRangeBps.min <= -BANK_BASIS_POINTS) {
            throwBankError('bank_product_invalid', `fund:${id}:bps`);
        }
        assertCatalogRange(product.minAmount, product.maxAmount, `fund:${id}`);
        try {
            amountAtBps(product.maxAmount, product.returnRangeBps.min);
            amountAtBps(product.maxAmount, product.returnRangeBps.max);
        } catch {
            throwBankError('bank_product_invalid', `fund:${id}:amount`);
        }
    }
}

validateBankProductCatalog({
    deposits: BANK_DEPOSIT_CONTRACTS,
    funds: BANK_FUND_CONTRACTS,
});

const depositContractsById = new Map(BANK_DEPOSIT_CONTRACTS.map((product) => [product.id, product]));
const fundContractsById = new Map(BANK_FUND_CONTRACTS.map((product) => [product.id, product]));

export const BANK_DEPOSIT_SHELF_IDS = Object.freeze(['short-term', 'mid-term', 'long-term'] as const);
export const BANK_FUND_SHELF_IDS = Object.freeze(['steady-fund', 'growth-fund', 'venture-fund'] as const);

export const BANK_DEPOSIT_PRODUCTS: readonly Readonly<BankDepositProduct>[] = Object.freeze(
    BANK_DEPOSIT_SHELF_IDS.map((id) => getBankDepositContract(id)),
);
export const BANK_FUND_PRODUCTS: readonly Readonly<BankFundProduct>[] = Object.freeze(
    BANK_FUND_SHELF_IDS.map((id) => getBankFundContract(id)),
);

const depositProductsById = new Map(BANK_DEPOSIT_PRODUCTS.map((product) => [product.id, product]));
const fundProductsById = new Map(BANK_FUND_PRODUCTS.map((product) => [product.id, product]));

export function listBankDepositProducts(): readonly Readonly<BankDepositProduct>[] {
    return BANK_DEPOSIT_PRODUCTS;
}

export function listBankFundProducts(): readonly Readonly<BankFundProduct>[] {
    return BANK_FUND_PRODUCTS;
}

export function findBankDepositContract(productId: string): Readonly<BankDepositProduct> | null {
    return depositContractsById.get(productId.trim() as BankDepositProduct['id']) ?? null;
}

export function findBankFundContract(productId: string): Readonly<BankFundProduct> | null {
    return fundContractsById.get(productId.trim() as BankFundProduct['id']) ?? null;
}

export function findBankDepositProduct(productId: string): Readonly<BankDepositProduct> | null {
    return depositProductsById.get(productId.trim() as BankDepositProduct['id']) ?? null;
}

export function findBankFundProduct(productId: string): Readonly<BankFundProduct> | null {
    return fundProductsById.get(productId.trim() as BankFundProduct['id']) ?? null;
}

function requireProductId(productId: unknown): string {
    if (typeof productId !== 'string' || !productId.trim()) {
        throwBankError('bank_product_id_required');
    }
    return productId.trim();
}

export function getBankDepositContract(productId: string): Readonly<BankDepositProduct> {
    const id = requireProductId(productId);
    return findBankDepositContract(id) ?? throwBankError('bank_product_missing', id);
}

export function getBankFundContract(productId: string): Readonly<BankFundProduct> {
    const id = requireProductId(productId);
    return findBankFundContract(id) ?? throwBankError('bank_product_missing', id);
}

export function getBankDepositProduct(productId: string): Readonly<BankDepositProduct> {
    const id = requireProductId(productId);
    return findBankDepositProduct(id) ?? throwBankError('bank_product_missing', id);
}

export function getBankFundProduct(productId: string): Readonly<BankFundProduct> {
    const id = requireProductId(productId);
    return findBankFundProduct(id) ?? throwBankError('bank_product_missing', id);
}

export function assertBankProductAmount(
    product: Pick<BankDepositProduct, 'minAmount' | 'maxAmount'>,
    amount: unknown,
): number {
    const normalized = assertPositiveBankAmount(amount, 'principal');
    if (normalized < product.minAmount || normalized > product.maxAmount) {
        throwBankError('bank_amount_out_of_range', String(normalized));
    }
    return normalized;
}

export function createBankDepositFrozenContract(
    product: BankDepositProduct,
    principal: unknown,
): BankDepositFrozenContract {
    const amount = assertBankProductAmount(product, principal);
    return Object.freeze({
        maturityAmount: amountAtBps(amount, product.interestBps),
        earlyWithdrawalAmount: amountAtBps(amount, -product.earlyPenaltyBps),
    });
}

export const createBankDepositContract = createBankDepositFrozenContract;

export function createBankFundFrozenContract(
    product: BankFundProduct,
    principal: unknown,
    resolvedReturnBps: unknown,
): BankFundFrozenContract {
    const amount = assertBankProductAmount(product, principal);
    if (typeof resolvedReturnBps !== 'number' || !Number.isSafeInteger(resolvedReturnBps)) {
        throwBankError('bank_amount_invalid', 'fund-return-bps');
    }
    if (resolvedReturnBps < product.returnRangeBps.min || resolvedReturnBps > product.returnRangeBps.max) {
        throwBankError('bank_amount_out_of_range', 'fund-return-bps');
    }
    return Object.freeze({
        resolvedReturnBps,
        settlementAmount: amountAtBps(amount, resolvedReturnBps),
    });
}

export const createBankFundContract = createBankFundFrozenContract;

export function drawBankFundFrozenContract(
    product: BankFundProduct,
    principal: unknown,
    random: BankRandomSource,
): BankFundFrozenContract {
    const amount = assertBankProductAmount(product, principal);
    const resolvedReturnBps = drawBankInclusiveInteger(
        product.returnRangeBps.min,
        product.returnRangeBps.max,
        random,
    );
    return createBankFundFrozenContract(product, amount, resolvedReturnBps);
}
