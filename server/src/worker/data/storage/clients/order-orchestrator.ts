import { usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CafeOrderSession } from '../../cafe/session/order.js';
import { FakeCafeOrderSession } from '../../cafe/session/fake-order-session.js';
import type { IOrderSession } from '../../cafe/session/order-session.js';
import type { BuyOnDemandClient } from '../../cafe/buy-ondemand/buy-ondemand-client.js';
import { fetchWaitTimeWithCartItems } from '../../cafe/buy-ondemand/wait-time.js';
import { OrderStorageClient, toOrderItems } from './order.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import { LockedExpiringMap } from '../../../../shared/lock/map.js';
import type { ICartItem, IPaymentCardInfo, ISerializedModifier } from '@msdining/common/models/cart';
import { SubmitOrderStage } from '@msdining/common/models/cart';
import type {
	ICafeOrderDTO,
	ICompleteOrderResultDTO,
	IOrderItem,
	IPreparePaymentResult,
} from '@msdining/common/models/order';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import { phone } from 'phone';

const orderLog = getNamespaceLogger('Order');
const isFakeOrdering = process.env.FAKE_ORDERING === 'true';

if (isFakeOrdering) {
	orderLog.info('⚠️  FAKE_ORDERING is enabled — no real charges will be made');
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const PENDING_ORDER_CLEANUP_INTERVAL_MS = SESSION_TTL_MS;

const liveSessions = new LockedExpiringMap<string, IOrderSession>(SESSION_TTL_MS);

setInterval(() => {
	const entries = [...liveSessions.entries()];
	if (entries.length === 0) return;

	orderLog.info(`Refreshing tokens for ${entries.length} live session(s)...`);
	Promise.all(
		entries.map(([pendingOrderId]) =>
			liveSessions.updateWithoutRefresh(pendingOrderId, async (session) => {
				if (!session) return undefined;
				try {
					await session.client.refreshLogin();
				} catch (err) {
					orderLog.error(`Failed to refresh token for session ${pendingOrderId}:`, err);
				}
				return session;
			}),
		),
	).catch(err => orderLog.error('Token refresh sweep failed:', err));
}, TOKEN_REFRESH_INTERVAL_MS);

setInterval(() => {
	const olderThan = new Date(Date.now() - SESSION_TTL_MS);
	usePrismaWrite(prisma => prisma.pendingCafeOrder.deleteMany({
		where: { createdAt: { lt: olderThan } },
	})).catch(err => orderLog.error('Pending order cleanup failed:', err));
}, PENDING_ORDER_CLEANUP_INTERVAL_MS);

const groupModifierChoices = (modifiers: ISerializedModifier[]): Map<string, Set<string>> => {
	const result = new Map<string, Set<string>>();
	for (const modifier of modifiers) {
		result.set(modifier.modifierId, new Set(modifier.choiceIds));
	}
	return result;
};

const toCartItems = (items: IOrderItem[]): ICartItem[] => items.map(item => ({
	itemId:              item.menuItemId,
	quantity:            item.quantity,
	choicesByModifierId: groupModifierChoices(item.modifiers),
	specialInstructions: item.specialInstructions,
}));

const getCafeOrThrow = (cafeId: string) => {
	const cafe = CAFES_BY_ID.get(cafeId);
	if (!cafe) {
		throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cafe ${cafeId} not found`);
	}
	return cafe;
};

const getWaitTimeForSession = async (session: IOrderSession): Promise<IWaitTimeResponse> => {
	if (isFakeOrdering) {
		return { minTime: 5, maxTime: 10 };
	}

	return fetchWaitTimeWithCartItems(
		session.client as BuyOnDemandClient,
		[...session.rawCartItemsForWaitTime],
	);
};

const createPopulatedSession = async (cafeId: string, cartItems: ICartItem[]): Promise<IOrderSession> => {
	const cafe = getCafeOrThrow(cafeId);

	if (isFakeOrdering) {
		const session = new FakeCafeOrderSession(cafe, cartItems);
		await session.populateCart();
		return session;
	}

	const session = await CafeOrderSession.createAsync(cafe, cartItems);
	await session.populateCart();

	if (!session.orderId || !session.orderNumber) {
		throw new Error('Order ID or order number not set after cart population');
	}

	return session;
};

const toCompletionFinancials = (
	session: IOrderSession,
	waitTime: IWaitTimeResponse,
	completedAt: Date,
) => {
	if (!session.orderId || !session.orderNumber) {
		throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Order data not set on session');
	}

	return {
		buyOnDemandOrderId:     session.orderId,
		buyOnDemandOrderNumber: session.orderNumber,
		subtotal:               session.orderTotalWithoutTax,
		tax:                    session.orderTotalTax,
		total:                  session.orderTotalWithTax,
		waitTimeMin:            waitTime.minTime,
		waitTimeMax:            waitTime.maxTime,
		completedAt,
	};
};

const shouldTreatAsPostCloseFailure = (session: IOrderSession) => session.lastCompletedStage === SubmitOrderStage.closeOrder
	|| session.lastCompletedStage === SubmitOrderStage.sendTextReceipt
	|| session.lastCompletedStage === SubmitOrderStage.complete;

export abstract class OrderOrchestrator {
	static async preparePayment(
		userId: string,
		cafeId: string,
		items: IOrderItem[],
		iframeCssUrl: string,
	): Promise<IPreparePaymentResult> {
		const { id: pendingOrderId, isExisting } = await OrderStorageClient.createPendingOrder(
			userId,
			cafeId,
			items,
		);

		// If there's already a live session for this pending order, reuse it
		if (isExisting) {
			const existingSession = await liveSessions.peek(pendingOrderId, session => session);
			if (existingSession) {
				const siteToken = existingSession.cardProcessorToken;
				const iframeUrl = existingSession.getCardProcessorUrl(iframeCssUrl);
				if (siteToken && existingSession.orderId && existingSession.orderNumber) {
					orderLog.info(`Reusing existing session for pending order ${pendingOrderId}`);
					return {
						pendingOrderId,
						siteToken,
						iframeUrl,
						buyOnDemandOrderId:     existingSession.orderId,
						buyOnDemandOrderNumber: existingSession.orderNumber,
						expiresAt:              new Date(Date.now() + SESSION_TTL_MS).toISOString(),
					};
				}
			}
		}

		try {
			const session = await liveSessions.getOrInsert(pendingOrderId, async () => {
				const createdSession = await createPopulatedSession(cafeId, toCartItems(items));
				await createdSession.prepareForIframe(iframeCssUrl);
				return createdSession;
			});

			const siteToken = session.cardProcessorToken;
			const iframeUrl = session.getCardProcessorUrl(iframeCssUrl);
			const buyOnDemandOrderId = session.orderId;
			const buyOnDemandOrderNumber = session.orderNumber;

			if (!buyOnDemandOrderId || !buyOnDemandOrderNumber || !siteToken) {
				throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Order data not set after prepare');
			}

			return {
				pendingOrderId,
				siteToken,
				iframeUrl,
				buyOnDemandOrderId,
				buyOnDemandOrderNumber,
				expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
			};
		} catch (err) {
			if (!isExisting) {
				await OrderStorageClient.deletePendingOrder(pendingOrderId).catch(cleanupErr => {
					orderLog.error(`Failed to delete pending order ${pendingOrderId} after prepare failure:`, cleanupErr);
				});
			}
			throw err;
		}
	}

	static async completeOrder(
		userId: string,
		pendingOrderId: string,
		paymentToken: string,
		cardInfo: IPaymentCardInfo,
		alias: string,
		phoneNumberWithCountryCode: string,
	): Promise<ICompleteOrderResultDTO> {
		const phoneData = phone(phoneNumberWithCountryCode);
		if (!phoneData.isValid) {
			throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Invalid phone number');
		}

		return liveSessions.peek(pendingOrderId, async (session) => {
			if (!session) {
				throw new ServiceError(
					SERVICE_ERROR_CODES.BAD_REQUEST,
					'Session expired. Please prepare payment again.',
				);
			}

			const pendingOrder = await OrderStorageClient.getPendingOrder(pendingOrderId);
			const orderedItems = toOrderItems(pendingOrder.items);

			try {
				const waitTime = await session.completeOrderAfterIframePayment({
					alias,
					phoneData,
					paymentToken,
					cardInfo,
				});
				const completedAt = new Date();
				const financials = toCompletionFinancials(session, waitTime, completedAt);

				await OrderStorageClient.createCompletedOrder(pendingOrderId, userId, financials);
				try {
					await OrderStorageClient.deductFromCart(pendingOrder.userId, orderedItems);
				} catch (err) {
					orderLog.error(`Failed to deduct cart items for pending order ${pendingOrderId}:`, err);
				}

				orderLog.info(`Order completed — orderNumber: ${financials.buyOnDemandOrderNumber}`);
				return {
					buyOnDemandOrderId:     financials.buyOnDemandOrderId,
					buyOnDemandOrderNumber: financials.buyOnDemandOrderNumber,
					waitTimeMin:            financials.waitTimeMin,
					waitTimeMax:            financials.waitTimeMax,
					completedAt:            financials.completedAt.toISOString(),
				};
			} catch (err) {
				if (!shouldTreatAsPostCloseFailure(session)) {
					throw err;
				}

				orderLog.error('Post-close failure (order already placed):', err);
				const waitTime = await getWaitTimeForSession(session).catch(waitErr => {
					orderLog.error(`Failed to fetch fallback wait time for pending order ${pendingOrderId}:`, waitErr);
					return { minTime: 0, maxTime: 0 };
				});
				const completedAt = new Date();
				const financials = toCompletionFinancials(session, waitTime, completedAt);

				await OrderStorageClient.createCompletedOrder(pendingOrderId, userId, financials);
				try {
					await OrderStorageClient.deductFromCart(pendingOrder.userId, orderedItems);
				} catch (deductErr) {
					orderLog.error(`Failed to deduct cart items for pending order ${pendingOrderId}:`, deductErr);
				}

				return {
					buyOnDemandOrderId:     financials.buyOnDemandOrderId,
					buyOnDemandOrderNumber: financials.buyOnDemandOrderNumber,
					waitTimeMin:            financials.waitTimeMin,
					waitTimeMax:            financials.waitTimeMax,
					completedAt:            financials.completedAt.toISOString(),
				};
			}
		});
	}

	static async getCompletedOrdersToday(userId: string): Promise<ICafeOrderDTO[]> {
		return OrderStorageClient.getCompletedOrdersToday(userId);
	}
}
