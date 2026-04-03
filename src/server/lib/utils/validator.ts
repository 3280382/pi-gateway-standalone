/**
 * 数据验证工具
 * 提供通用的数据验证功能
 */

import { type ApiError, ErrorCode } from "../../../shared/types/api.types";

export interface ValidationRule<T = any> {
	field: string;
	validator: (value: T) => boolean | string;
	required?: boolean;
	message?: string;
	transform?: (value: T) => any;
}

export interface ValidationResult {
	valid: boolean;
	errors: ApiError[];
	data: Record<string, any>;
}

export class Validator {
	/**
	 * 验证对象是否符合规则
	 */
	static validate<T extends Record<string, any>>(
		data: T,
		rules: ValidationRule[],
	): ValidationResult {
		const errors: ApiError[] = [];
		const validatedData: Record<string, any> = {};

		for (const rule of rules) {
			const value = data[rule.field];

			// 检查必填字段
			if (
				rule.required &&
				(value === undefined || value === null || value === "")
			) {
				errors.push({
					code: ErrorCode.VALIDATION_ERROR,
					message: rule.message || `字段 ${rule.field} 是必填的`,
					details: { field: rule.field, rule: "required" },
				});
				continue;
			}

			// 如果字段是可选的且为空，跳过验证
			if (
				!rule.required &&
				(value === undefined || value === null || value === "")
			) {
				continue;
			}

			// 执行验证器
			const validatorResult = rule.validator(value);

			if (validatorResult === false) {
				errors.push({
					code: ErrorCode.VALIDATION_ERROR,
					message: rule.message || `字段 ${rule.field} 验证失败`,
					details: { field: rule.field, value },
				});
			} else if (typeof validatorResult === "string") {
				errors.push({
					code: ErrorCode.VALIDATION_ERROR,
					message: validatorResult,
					details: { field: rule.field, value },
				});
			} else {
				// 验证成功，应用转换
				validatedData[rule.field] = rule.transform
					? rule.transform(value)
					: value;
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			data: validatedData,
		};
	}

	/**
	 * 验证字符串
	 */
	static isString(value: any): boolean | string {
		if (typeof value !== "string") {
			return "必须是字符串";
		}
		return true;
	}

	/**
	 * 验证数字
	 */
	static isNumber(value: any): boolean | string {
		if (typeof value !== "number" || Number.isNaN(value)) {
			return "必须是有效数字";
		}
		return true;
	}

	/**
	 * 验证整数
	 */
	static isInteger(value: any): boolean | string {
		if (!Number.isInteger(value)) {
			return "必须是整数";
		}
		return true;
	}

	/**
	 * 验证布尔值
	 */
	static isBoolean(value: any): boolean | string {
		if (typeof value !== "boolean") {
			return "必须是布尔值";
		}
		return true;
	}

	/**
	 * 验证数组
	 */
	static isArray(value: any): boolean | string {
		if (!Array.isArray(value)) {
			return "必须是数组";
		}
		return true;
	}

	/**
	 * 验证对象
	 */
	static isObject(value: any): boolean | string {
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return "必须是对象";
		}
		return true;
	}

	/**
	 * 验证非空
	 */
	static notEmpty(value: any): boolean | string {
		if (value === undefined || value === null || value === "") {
			return "不能为空";
		}
		return true;
	}

	/**
	 * 验证最小长度
	 */
	static minLength(min: number): (value: string) => boolean | string {
		return (value: string) => {
			if (value.length < min) {
				return `长度不能少于 ${min} 个字符`;
			}
			return true;
		};
	}

	/**
	 * 验证最大长度
	 */
	static maxLength(max: number): (value: string) => boolean | string {
		return (value: string) => {
			if (value.length > max) {
				return `长度不能超过 ${max} 个字符`;
			}
			return true;
		};
	}

	/**
	 * 验证最小值
	 */
	static min(min: number): (value: number) => boolean | string {
		return (value: number) => {
			if (value < min) {
				return `不能小于 ${min}`;
			}
			return true;
		};
	}

	/**
	 * 验证最大值
	 */
	static max(max: number): (value: number) => boolean | string {
		return (value: number) => {
			if (value > max) {
				return `不能大于 ${max}`;
			}
			return true;
		};
	}

	/**
	 * 验证正则表达式
	 */
	static matches(
		regex: RegExp,
		message?: string,
	): (value: string) => boolean | string {
		return (value: string) => {
			if (!regex.test(value)) {
				return message || `格式不正确`;
			}
			return true;
		};
	}

	/**
	 * 验证邮箱
	 */
	static isEmail(value: string): boolean | string {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(value)) {
			return "邮箱格式不正确";
		}
		return true;
	}

	/**
	 * 验证URL
	 */
	static isUrl(value: string): boolean | string {
		try {
			new URL(value);
			return true;
		} catch {
			return "URL格式不正确";
		}
	}

	/**
	 * 验证日期字符串
	 */
	static isDateString(value: string): boolean | string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return "日期格式不正确";
		}
		return true;
	}

	/**
	 * 验证枚举值
	 */
	static isEnum(enumValues: any[]): (value: any) => boolean | string {
		return (value: any) => {
			if (!enumValues.includes(value)) {
				return `必须是以下值之一: ${enumValues.join(", ")}`;
			}
			return true;
		};
	}

	/**
	 * 验证嵌套对象
	 */
	static nested(rules: ValidationRule[]): (value: any) => boolean | string {
		return (value: any) => {
			const result = Validator.validate(value, rules);
			if (!result.valid) {
				return result.errors.map((e) => e.message).join(", ");
			}
			return true;
		};
	}

	/**
	 * 验证数组中的每个元素
	 */
	static arrayItems(
		rules: ValidationRule[],
	): (value: any[]) => boolean | string {
		return (value: any[]) => {
			if (!Array.isArray(value)) {
				return "必须是数组";
			}

			for (let i = 0; i < value.length; i++) {
				const item = value[i];
				const result = Validator.validate(item, rules);
				if (!result.valid) {
					return `元素 ${i}: ${result.errors.map((e) => e.message).join(", ")}`;
				}
			}

			return true;
		};
	}
}

// 常用验证规则
export const commonRules = {
	string: (
		field: string,
		required = true,
		options?: { min?: number; max?: number },
	) => {
		const rules: ValidationRule[] = [
			{
				field,
				required,
				validator: Validator.isString,
			},
		];

		if (options?.min !== undefined) {
			rules.push({
				field,
				required: false,
				validator: Validator.minLength(options.min),
			});
		}

		if (options?.max !== undefined) {
			rules.push({
				field,
				required: false,
				validator: Validator.maxLength(options.max),
			});
		}

		return rules;
	},

	number: (
		field: string,
		required = true,
		options?: { min?: number; max?: number },
	) => {
		const rules: ValidationRule[] = [
			{
				field,
				required,
				validator: Validator.isNumber,
			},
		];

		if (options?.min !== undefined) {
			rules.push({
				field,
				required: false,
				validator: Validator.min(options.min),
			});
		}

		if (options?.max !== undefined) {
			rules.push({
				field,
				required: false,
				validator: Validator.max(options.max),
			});
		}

		return rules;
	},

	boolean: (field: string, required = true) => [
		{
			field,
			required,
			validator: Validator.isBoolean,
		},
	],

	email: (field: string, required = true) => [
		{
			field,
			required,
			validator: Validator.isEmail,
		},
	],

	url: (field: string, required = true) => [
		{
			field,
			required,
			validator: Validator.isUrl,
		},
	],
};
