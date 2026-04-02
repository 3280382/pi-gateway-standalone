/**
 * Gesture Utilities - 手势检测工具函数库
 * 纯函数，便于测试和复用
 */

export interface Point {
	x: number;
	y: number;
}

export interface TouchInfo extends Point {
	time: number;
}

export interface GestureMetrics {
	distance: number;
	duration: number;
	velocity: number;
}

// 默认配置常量
export const GESTURE_CONFIG = {
	TAP_THRESHOLD: 10, // 单击最大移动距离 (px)
	LONG_PRESS_DELAY: 500, // 长按延迟 (ms)
	DOUBLE_TAP_DELAY: 300, // 双击间隔 (ms)
	SWIPE_THRESHOLD: 30, // 滑动最小距离 (px)
	SWIPE_VELOCITY: 0.5, // 滑动最小速度 (px/ms)
	PINCH_THRESHOLD: 0.7, // 缩放阈值 (scale)
} as const;

/**
 * 计算两点间距离
 */
export function getDistance(p1: Point, p2: Point): number {
	return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * 计算两点间速度
 */
export function getVelocity(start: TouchInfo, end: TouchInfo): number {
	const distance = getDistance(start, end);
	const duration = end.time - start.time;
	return duration > 0 ? distance / duration : 0;
}

/**
 * 获取触摸点信息
 */
export function getTouchInfo(touch: Touch | React.Touch): TouchInfo {
	return {
		x: touch.clientX,
		y: touch.clientY,
		time: Date.now(),
	};
}

/**
 * 获取双指间距离
 */
export function getPinchDistance(touches: TouchList | React.TouchList): number {
	if (touches.length < 2) return 0;
	const t1 = touches[0];
	const t2 = touches[1];
	return Math.sqrt(
		(t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2,
	);
}

/**
 * 计算缩放比例
 */
export function getPinchScale(
	startDistance: number,
	currentDistance: number,
): number {
	return startDistance > 0 ? currentDistance / startDistance : 1;
}

/**
 * 判断是否为单击
 */
export function isTap(
	metrics: GestureMetrics,
	threshold = GESTURE_CONFIG.TAP_THRESHOLD,
): boolean {
	return metrics.distance < threshold;
}

/**
 * 判断是否为滑动
 */
export function isSwipe(
	metrics: GestureMetrics,
	thresholds = {
		distance: GESTURE_CONFIG.SWIPE_THRESHOLD,
		velocity: GESTURE_CONFIG.SWIPE_VELOCITY,
	},
): boolean {
	return (
		metrics.distance >= thresholds.distance ||
		metrics.velocity >= thresholds.velocity
	);
}

/**
 * 获取滑动方向
 */
export function getSwipeDirection(
	start: Point,
	end: Point,
): "left" | "right" | "up" | "down" {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	return Math.abs(dx) > Math.abs(dy)
		? dx > 0
			? "right"
			: "left"
		: dy > 0
			? "down"
			: "up";
}

/**
 * 判断是否为双击
 */
export function isDoubleTap(
	lastTapTime: number,
	delay = GESTURE_CONFIG.DOUBLE_TAP_DELAY,
): boolean {
	return Date.now() - lastTapTime < delay;
}

/**
 * 判断是否为长按
 */
export function isLongPress(
	duration: number,
	threshold = GESTURE_CONFIG.LONG_PRESS_DELAY,
): boolean {
	return duration >= threshold;
}

/**
 * 完整手势分析
 */
export function analyzeGesture(
	start: TouchInfo,
	end: TouchInfo,
): GestureMetrics & { type: "tap" | "swipe" | "longpress" | "unknown" } {
	const distance = getDistance(start, end);
	const duration = end.time - start.time;
	const velocity = duration > 0 ? distance / duration : 0;

	let type: "tap" | "swipe" | "longpress" | "unknown" = "unknown";

	if (
		distance < GESTURE_CONFIG.TAP_THRESHOLD &&
		duration < GESTURE_CONFIG.LONG_PRESS_DELAY
	) {
		type = "tap";
	} else if (
		duration >= GESTURE_CONFIG.LONG_PRESS_DELAY &&
		distance < GESTURE_CONFIG.TAP_THRESHOLD
	) {
		type = "longpress";
	} else if (
		distance >= GESTURE_CONFIG.SWIPE_THRESHOLD ||
		velocity >= GESTURE_CONFIG.SWIPE_VELOCITY
	) {
		type = "swipe";
	}

	return { distance, duration, velocity, type };
}
