/**
 * Gesture Utilities - Gesture detection utility functions
 * Pure functions, easy to test and reuse
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

// Default configuration constants
export const GESTURE_CONFIG = {
  TAP_THRESHOLD: 10, // Tap max move distance (px)
  LONG_PRESS_DELAY: 500, // Long press delay (ms)
  DOUBLE_TAP_DELAY: 300, // Double tap interval (ms)
  SWIPE_THRESHOLD: 30, // Swipe min distance (px)
  SWIPE_VELOCITY: 0.5, // Swipe min velocity (px/ms)
  PINCH_THRESHOLD: 0.7, // Pinch threshold (scale)
} as const;

/**
 * Calculate distance between two points
 */
export function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Calculate velocity between two points
 */
export function getVelocity(start: TouchInfo, end: TouchInfo): number {
  const distance = getDistance(start, end);
  const duration = end.time - start.time;
  return duration > 0 ? distance / duration : 0;
}

/**
 * Get touch point info
 */
export function getTouchInfo(touch: Touch | React.Touch): TouchInfo {
  return {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now(),
  };
}

/**
 * Get two-finger distance
 */
export function getPinchDistance(touches: TouchList | React.TouchList): number {
  if (touches.length < 2) return 0;
  const t1 = touches[0];
  const t2 = touches[1];
  return Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2);
}

/**
 * Calculate scale ratio
 */
export function getPinchScale(startDistance: number, currentDistance: number): number {
  return startDistance > 0 ? currentDistance / startDistance : 1;
}

/**
 * Determine if tap
 */
export function isTap(metrics: GestureMetrics, threshold = GESTURE_CONFIG.TAP_THRESHOLD): boolean {
  return metrics.distance < threshold;
}

/**
 * Determine if swipe
 */
export function isSwipe(
  metrics: GestureMetrics,
  thresholds = {
    distance: GESTURE_CONFIG.SWIPE_THRESHOLD,
    velocity: GESTURE_CONFIG.SWIPE_VELOCITY,
  }
): boolean {
  return metrics.distance >= thresholds.distance || metrics.velocity >= thresholds.velocity;
}

/**
 * Get swipe direction
 */
export function getSwipeDirection(start: Point, end: Point): "left" | "right" | "up" | "down" {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

/**
 * Determine if double tap
 */
export function isDoubleTap(lastTapTime: number, delay = GESTURE_CONFIG.DOUBLE_TAP_DELAY): boolean {
  return Date.now() - lastTapTime < delay;
}

/**
 * Determine if long press
 */
export function isLongPress(
  duration: number,
  threshold = GESTURE_CONFIG.LONG_PRESS_DELAY
): boolean {
  return duration >= threshold;
}

/**
 * Complete gesture analysis
 */
export function analyzeGesture(
  start: TouchInfo,
  end: TouchInfo
): GestureMetrics & { type: "tap" | "swipe" | "longpress" | "unknown" } {
  const distance = getDistance(start, end);
  const duration = end.time - start.time;
  const velocity = duration > 0 ? distance / duration : 0;

  let type: "tap" | "swipe" | "longpress" | "unknown" = "unknown";

  if (distance < GESTURE_CONFIG.TAP_THRESHOLD && duration < GESTURE_CONFIG.LONG_PRESS_DELAY) {
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
