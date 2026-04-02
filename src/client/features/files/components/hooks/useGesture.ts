/**
 * useGesture - Advanced gesture detection hook
 * Distinguishes between tap, swipe, long-press, and pinch
 */
import { useCallback, useRef, useState } from "react";

export interface GestureConfig {
	tapThreshold?: number; // Max movement for tap (px)
	longPressDelay?: number; // Delay for long press (ms)
	swipeThreshold?: number; // Min movement for swipe (px)
	swipeVelocity?: number; // Min velocity for swipe (px/ms)
}

export interface GestureState {
	isPressed: boolean;
	isLongPressed: boolean;
	isDragging: boolean;
}

export type GestureType = "tap" | "longpress" | "swipe" | "pinch" | "none";

interface TouchInfo {
	x: number;
	y: number;
	time: number;
}

export function useGesture(config: GestureConfig = {}) {
	const {
		tapThreshold = 10,
		longPressDelay = 500,
		swipeThreshold = 30,
		swipeVelocity = 0.5,
	} = config;

	const [gestureState, setGestureState] = useState<GestureState>({
		isPressed: false,
		isLongPressed: false,
		isDragging: false,
	});

	const gestureType = useRef<GestureType>("none");
	const startInfo = useRef<TouchInfo | null>(null);
	const lastInfo = useRef<TouchInfo | null>(null);
	const longPressTimer = useRef<NodeJS.Timeout | null>(null);
	const touchCount = useRef(0);
	const pinchStartDistance = useRef<number | null>(null);

	const reset = useCallback(() => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
		gestureType.current = "none";
		startInfo.current = null;
		lastInfo.current = null;
		touchCount.current = 0;
		pinchStartDistance.current = null;
		setGestureState({
			isPressed: false,
			isLongPressed: false,
			isDragging: false,
		});
	}, []);

	const getDistance = (t1: TouchInfo, t2: TouchInfo): number => {
		return Math.sqrt(Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2));
	};

	const getVelocity = (start: TouchInfo, end: TouchInfo): number => {
		const distance = getDistance(start, end);
		const time = end.time - start.time;
		return time > 0 ? distance / time : 0;
	};

	const onTouchStart = useCallback(
		(e: React.TouchEvent, handlers?: { onPinchStart?: () => void }) => {
			const touches = e.touches;
			touchCount.current = touches.length;

			// Pinch detection (2 fingers)
			if (touches.length === 2) {
				gestureType.current = "pinch";
				const t1 = touches[0];
				const t2 = touches[1];
				pinchStartDistance.current = Math.sqrt(
					Math.pow(t2.clientX - t1.clientX, 2) +
						Math.pow(t2.clientY - t1.clientY, 2),
				);
				handlers?.onPinchStart?.();
				return;
			}

			// Single touch
			if (touches.length === 1) {
				const touch = touches[0];
				const info: TouchInfo = {
					x: touch.clientX,
					y: touch.clientY,
					time: Date.now(),
				};

				startInfo.current = info;
				lastInfo.current = info;
				gestureType.current = "none";

				setGestureState((prev) => ({ ...prev, isPressed: true }));

				// Start long press timer
				longPressTimer.current = setTimeout(() => {
					if (gestureType.current === "none" && startInfo.current) {
						// Check if moved too much
						const currentInfo = lastInfo.current || startInfo.current;
						const distance = getDistance(startInfo.current, currentInfo);

						if (distance < tapThreshold) {
							gestureType.current = "longpress";
							setGestureState({
								isPressed: true,
								isLongPressed: true,
								isDragging: true,
							});
						}
					}
				}, longPressDelay);
			}
		},
		[longPressDelay, tapThreshold],
	);

	const onTouchMove = useCallback(
		(
			e: React.TouchEvent,
			handlers?: {
				onSwipe?: (direction: "left" | "right" | "up" | "down") => void;
				onPinch?: (scale: number) => void;
			},
		) => {
			const touches = e.touches;

			// Pinch handling
			if (touches.length === 2 && gestureType.current === "pinch") {
				const t1 = touches[0];
				const t2 = touches[1];
				const currentDistance = Math.sqrt(
					Math.pow(t2.clientX - t1.clientX, 2) +
						Math.pow(t2.clientY - t1.clientY, 2),
				);

				if (pinchStartDistance.current) {
					const scale = currentDistance / pinchStartDistance.current;
					handlers?.onPinch?.(scale);
				}
				return;
			}

			// Single touch move
			if (touches.length === 1 && startInfo.current) {
				const touch = touches[0];
				const currentInfo: TouchInfo = {
					x: touch.clientX,
					y: touch.clientY,
					time: Date.now(),
				};
				lastInfo.current = currentInfo;

				const distance = getDistance(startInfo.current, currentInfo);

				// If moved beyond tap threshold, cancel long press
				if (distance > tapThreshold && gestureType.current === "none") {
					if (longPressTimer.current) {
						clearTimeout(longPressTimer.current);
						longPressTimer.current = null;
					}
					gestureType.current = "swipe";
					setGestureState((prev) => ({ ...prev, isDragging: true }));
				}

				// Check for swipe velocity
				const velocity = getVelocity(startInfo.current, currentInfo);
				if (velocity > swipeVelocity && distance > swipeThreshold) {
					const dx = currentInfo.x - startInfo.current.x;
					const dy = currentInfo.y - startInfo.current.y;
					const direction =
						Math.abs(dx) > Math.abs(dy)
							? dx > 0
								? "right"
								: "left"
							: dy > 0
								? "down"
								: "up";
					handlers?.onSwipe?.(direction);
				}
			}
		},
		[tapThreshold, swipeThreshold, swipeVelocity],
	);

	const onTouchEnd = useCallback(
		(
			e: React.TouchEvent,
			handlers?: {
				onTap?: () => void;
				onLongPress?: () => void;
				onSwipeEnd?: (direction: "left" | "right" | "up" | "down") => void;
				preventClick?: boolean;
			},
		): GestureType => {
			const changedTouches = e.changedTouches;
			const currentType = gestureType.current;

			// Clear long press timer
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
				longPressTimer.current = null;
			}

			// Handle pinch end
			if (currentType === "pinch") {
				reset();
				return "pinch";
			}

			// Handle long press
			if (currentType === "longpress") {
				handlers?.onLongPress?.();
				// Don't reset immediately for drag operations
				return "longpress";
			}

			// Handle tap detection
			if (currentType === "none" && startInfo.current) {
				const endInfo: TouchInfo = {
					x: changedTouches[0]?.clientX || startInfo.current.x,
					y: changedTouches[0]?.clientY || startInfo.current.y,
					time: Date.now(),
				};

				const distance = getDistance(startInfo.current, endInfo);
				const duration = endInfo.time - startInfo.current.time;

				// It's a tap if within threshold and short duration
				if (distance < tapThreshold && duration < longPressDelay) {
					gestureType.current = "tap";
					handlers?.onTap?.();
					setGestureState({ isPressed: false, isLongPressed: false, isDragging: false });
					return "tap";
				}
			}

			// Handle swipe end
			if (currentType === "swipe" && startInfo.current && lastInfo.current) {
				const dx = lastInfo.current.x - startInfo.current.x;
				const dy = lastInfo.current.y - startInfo.current.y;
				const direction =
					Math.abs(dx) > Math.abs(dy)
						? dx > 0
							? "right"
							: "left"
						: dy > 0
							? "down"
							: "up";
				handlers?.onSwipeEnd?.(direction);
			}

			reset();
			return currentType;
		},
		[longPressDelay, tapThreshold, reset],
	);

	return {
		gestureState,
		onTouchStart,
		onTouchMove,
		onTouchEnd,
		reset,
		getCurrentType: () => gestureType.current,
	};
}
