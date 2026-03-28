/**
 * 基础模型类
 * 提供模型共用的基础功能
 */

import type { DeepPartial } from "@/types/common.types";

export abstract class BaseModel<T extends Record<string, any>> {
	constructor(protected data: T) {}

	/**
	 * 获取模型数据
	 */
	getData(): T {
		return this.data;
	}

	/**
	 * 转换为JSON
	 */
	toJSON(): T {
		return this.data;
	}

	/**
	 * 克隆模型
	 */
	clone(): this {
		const Constructor = this.constructor as new (data: T) => this;
		return new Constructor(JSON.parse(JSON.stringify(this.data)));
	}

	/**
	 * 更新数据
	 */
	update(updates: DeepPartial<T>): void {
		this.data = { ...this.data, ...updates };
	}

	/**
	 * 检查数据是否相等
	 */
	equals(other: BaseModel<T>): boolean {
		return JSON.stringify(this.data) === JSON.stringify(other.data);
	}

	/**
	 * 转换为字符串
	 */
	toString(): string {
		return JSON.stringify(this.data, null, 2);
	}
}
