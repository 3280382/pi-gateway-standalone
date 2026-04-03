/**
 * useGesture - 通用手势检测 Hook
 * 基于 gesture.ts 工具函数，提供声明式手势检测
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
	GESTURE_CONFIG,
	GestureMetrics,
	getDistance,
	getPinchDistance,
	getPinchScale,
	getSwipeDirection,
	getTouchInfo,
	isDoubleTap,
	isLongPress,
	isTap,
	Point,
	type TouchInfo,
} from "@/lib/gestures";

export interface UseGestureOptions {
	onTap?: (e?: React.MouseEvent | React.TouchEvent) => void;
	onDoubleTap?: () => void;
	onLongPress?: () => void;
	onSwipe?: (direction: "left" | "right" | "up" | "down") => void;
	onPinchStart?: () => void;
	onPinch?: (scale: number) => void;
	onPinchEnd?: () => void;
	onPressStart?: () => void;
	onPressEnd?: () => void;
	// 自定义阈值
	tapThreshold?: number;
	longPressDelay?: number;
	doubleTapDelay?: number;
	swipeThreshold?: number;
	pinchThreshold?: number;
	// 禁用某些手势
	disabled?: boolean;
}

export interface GestureState {
	isPressed: boolean;
	isLongPressed: boolean;
	isPinching: boolean;
	lastTapTime: number;
}

export function useGesture(options: UseGestureOptions = {}) {
	const {
		onTap,
		onDoubleTap,
		onLongPress,
		onSwipe,
		onPinchStart,
		onPinch,
		onPinchEnd,
		onPressStart,
		onPressEnd,
		tapThreshold = GESTURE_CONFIG.TAP_THRESHOLD,
		longPressDelay = GESTURE_CONFIG.LONG_PRESS_DELAY,
		doubleTapDelay = GESTURE_CONFIG.DOUBLE_TAP_DELAY,
		swipeThreshold = GESTURE_CONFIG.SWIPE_THRESHOLD,
		pinchThreshold = GESTURE_CONFIG.PINCH_THRESHOLD,
		disabled = false,
	} = options;

	const [state, setState] = useState<GestureState>({
		isPressed: false,
		isLongPressed: false,
		isPinching: false,
		lastTapTime: 0,
	});

	const startInfoRef = useRef<TouchInfo | null>(null);
	const lastTapTimeRef = useRef<number>(0);
	const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
	const pinchStartDistanceRef = useRef<number>(0);
	const isScrollingRef = useRef(false);

	// 清理定时器
	useEffect(() => {
		return () => {
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
			}
		};
	}, []);

	const reset = useCallback(() => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
		startInfoRef.current = null;
		isScrollingRef.current = false;
		setState((prev) => ({
			...prev,
			isPressed: false,
			isLongPressed: false,
			isPinching: false,
		}));
	}, []);

	const onTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (disabled) return;

			const touches = e.touches;

			// 双指缩放检测
			if (touches.length === 2) {
				pinchStartDistanceRef.current = getPinchDistance(touches);
				setState((prev) => ({ ...prev, isPinching: true }));
				onPinchStart?.();
				return;
			}

			// 单指触摸
			if (touches.length === 1) {
				const touch = getTouchInfo(touches[0]);
				startInfoRef.current = touch;
				isScrollingRef.current = false;
				setState((prev) => ({ ...prev, isPressed: true }));
				onPressStart?.();

				// 启动长按定时器
				longPressTimerRef.current = setTimeout(() => {
					if (startInfoRef.current && !isScrollingRef.current) {
						setState((prev) => ({ ...prev, isLongPressed: true }));
						onLongPress?.();
					}
				}, longPressDelay);
			}
		},
		[disabled, longPressDelay, onLongPress, onPinchStart, onPressStart],
	);

	const onTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (disabled || !startInfoRef.current) return;

			const touches = e.touches;

			// 处理双指缩放
			if (state.isPinching && touches.length === 2) {
				const currentDistance = getPinchDistance(touches);
				const scale = getPinchScale(
					pinchStartDistanceRef.current,
					currentDistance,
				);
				onPinch?.(scale);
				return;
			}

			// 单指移动检测滑动
			if (touches.length === 1) {
				const current = getTouchInfo(touches[0]);
				const distance = getDistance(startInfoRef.current, current);

				// 超出单击阈值，标记为滚动/滑动
				if (distance > tapThreshold) {
					isScrollingRef.current = true;
					if (longPressTimerRef.current) {
						clearTimeout(longPressTimerRef.current);
						longPressTimerRef.current = null;
					}
				}
			}
		},
		[disabled, state.isPinching, tapThreshold, onPinch],
	);

	const onTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			if (disabled) return;

			// 清理长按定时器
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}

			// 处理缩放结束
			if (state.isPinching) {
				setState((prev) => ({ ...prev, isPinching: false }));
				onPinchEnd?.();
				return;
			}

			setState((prev) => ({ ...prev, isPressed: false, isLongPressed: false }));
			onPressEnd?.();

			// 如果正在滚动，不处理为点击
			if (isScrollingRef.current || !startInfoRef.current) {
				startInfoRef.current = null;
				return;
			}

			const endTouch = e.changedTouches[0];
			if (!endTouch) return;

			const endInfo = getTouchInfo(endTouch);
			const startInfo = startInfoRef.current;

			const distance = getDistance(startInfo, endInfo);
			const duration = endInfo.time - startInfo.time;

			// 检测为单击
			if (isTap({ distance, duration, velocity: 0 }, tapThreshold)) {
				// 检测双击
				if (isDoubleTap(lastTapTimeRef.current, doubleTapDelay)) {
					onDoubleTap?.();
					lastTapTimeRef.current = 0;
				} else {
					// 单击
					lastTapTimeRef.current = Date.now();
					onTap?.(e);
				}
			}
			// 检测为滑动
			else if (distance >= swipeThreshold) {
				const direction = getSwipeDirection(startInfo, endInfo);
				onSwipe?.(direction);
			}

			startInfoRef.current = null;
		},
		[
			disabled,
			state.isPinching,
			tapThreshold,
			doubleTapDelay,
			swipeThreshold,
			onTap,
			onDoubleTap,
			onSwipe,
			onPinchEnd,
			onPressEnd,
		],
	);

	const onMouseDown = useCallback(() => {
		if (disabled) return;
		setState((prev) => ({ ...prev, isPressed: true }));
		onPressStart?.();
	}, [disabled, onPressStart]);

	const onMouseUp = useCallback(() => {
		if (disabled) return;
		setState((prev) => ({ ...prev, isPressed: false }));
		onPressEnd?.();
	}, [disabled, onPressEnd]);

	const onMouseLeave = useCallback(() => {
		if (disabled) return;
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
		setState((prev) => ({ ...prev, isPressed: false }));
		onPressEnd?.();
	}, [disabled, onPressEnd]);

	const onClick = useCallback(
		(e: React.MouseEvent) => {
			if (disabled) return;

			// 鼠标点击作为触摸的备选
			if (!("ontouchstart" in window)) {
				const now = Date.now();
				if (isDoubleTap(lastTapTimeRef.current, doubleTapDelay)) {
					onDoubleTap?.();
					lastTapTimeRef.current = 0;
				} else {
					lastTapTimeRef.current = now;
					onTap?.(e);
				}
			}
		},
		[disabled, doubleTapDelay, onTap, onDoubleTap],
	);

	return {
		state,
		handlers: {
			onTouchStart,
			onTouchMove,
			onTouchEnd,
			onMouseDown,
			onMouseUp,
			onMouseLeave,
			onClick,
		},
		reset,
	};
}
