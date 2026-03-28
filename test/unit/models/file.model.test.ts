import { describe, expect, it } from "vitest";
import { FileModel } from "../../../src/client/models/file.model";

describe("FileModel", () => {
	describe("构造函数", () => {
		it("应该使用提供的数据创建文件模型", () => {
			const fileItem = {
				name: "test.txt",
				path: "/root/test.txt",
				isDirectory: false,
				size: 1024,
				modified: "2024-01-01T12:00:00Z",
				permissions: "rw-r--r--",
			};

			const file = new FileModel(fileItem);

			expect(file.name).toBe("test.txt");
			expect(file.path).toBe("/root/test.txt");
			expect(file.isDirectory).toBe(false);
			expect(file.size).toBe(1024);
			expect(file.modified).toBe("2024-01-01T12:00:00Z");
			expect(file.permissions).toBe("rw-r--r--");
			expect(file.extension).toBe("txt");
		});

		it("应该自动提取扩展名", () => {
			const txtFile = new FileModel({
				name: "document.txt",
				path: "/doc.txt",
				isDirectory: false,
				size: 0,
				modified: new Date().toISOString(),
			});

			const noExtFile = new FileModel({
				name: "README",
				path: "/README",
				isDirectory: false,
				size: 0,
				modified: new Date().toISOString(),
			});

			const multipleExtFile = new FileModel({
				name: "archive.tar.gz",
				path: "/archive.tar.gz",
				isDirectory: false,
				size: 0,
				modified: new Date().toISOString(),
			});

			const directory = new FileModel({
				name: "folder",
				path: "/folder",
				isDirectory: true,
				size: 0,
				modified: new Date().toISOString(),
			});

			expect(txtFile.extension).toBe("txt");
			expect(noExtFile.extension).toBeUndefined();
			expect(multipleExtFile.extension).toBe("gz");
			expect(directory.extension).toBeUndefined();
		});
	});

	describe("图标获取", () => {
		it("应该为目录返回文件夹图标", () => {
			const directory = new FileModel({
				name: "folder",
				path: "/folder",
				isDirectory: true,
				size: 0,
				modified: new Date().toISOString(),
			});

			expect(directory.getIcon()).toBe("📁");
		});

		it("应该为已知扩展名返回相应图标", () => {
			const testCases = [
				{ ext: "js", expected: "📜" },
				{ ext: "py", expected: "🐍" },
				{ ext: "md", expected: "📝" },
				{ ext: "jpg", expected: "🖼️" },
				{ ext: "zip", expected: "📦" },
			];

			testCases.forEach(({ ext, expected }) => {
				const file = new FileModel({
					name: `test.${ext}`,
					path: `/test.${ext}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.getIcon()).toBe(expected);
			});
		});

		it("应该为未知扩展名返回默认文件图标", () => {
			const file = new FileModel({
				name: "test.unknown",
				path: "/test.unknown",
				isDirectory: false,
				size: 0,
				modified: new Date().toISOString(),
			});

			expect(file.getIcon()).toBe("📄");
		});

		it("应该为无扩展名文件返回默认文件图标", () => {
			const file = new FileModel({
				name: "LICENSE",
				path: "/LICENSE",
				isDirectory: false,
				size: 0,
				modified: new Date().toISOString(),
			});

			expect(file.getIcon()).toBe("📄");
		});
	});

	describe("文件类型检测", () => {
		it("应该返回正确的文件类型", () => {
			const testCases = [
				{ ext: "js", expected: "JavaScript" },
				{ ext: "tsx", expected: "React TypeScript" },
				{ ext: "py", expected: "Python" },
				{ ext: "md", expected: "Markdown" },
				{ ext: "unknown", expected: "file" },
			];

			testCases.forEach(({ ext, expected }) => {
				const file = new FileModel({
					name: `test.${ext}`,
					path: `/test.${ext}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.getType()).toBe(expected);
			});
		});

		it('应该为目录返回"directory"', () => {
			const directory = new FileModel({
				name: "src",
				path: "/src",
				isDirectory: true,
				size: 0,
				modified: new Date().toISOString(),
			});

			expect(directory.getType()).toBe("directory");
		});
	});

	describe("格式化方法", () => {
		it("应该格式化文件大小", () => {
			const testCases = [
				{ size: 0, expected: "0 B" },
				{ size: 500, expected: "500 B" },
				{ size: 1024, expected: "1.0 KB" },
				{ size: 1536, expected: "1.5 KB" },
				{ size: 1048576, expected: "1.0 MB" },
				{ size: 1073741824, expected: "1.0 GB" },
			];

			testCases.forEach(({ size, expected }) => {
				const file = new FileModel({
					name: "test.txt",
					path: "/test.txt",
					isDirectory: false,
					size,
					modified: new Date().toISOString(),
				});

				expect(file.formatSize()).toBe(expected);
			});
		});

		it('应该为目录返回"--"作为大小', () => {
			const directory = new FileModel({
				name: "folder",
				path: "/folder",
				isDirectory: true,
				size: 4096,
				modified: new Date().toISOString(),
			});

			expect(directory.formatSize()).toBe("--");
		});

		it("应该格式化修改时间", () => {
			const now = new Date();
			const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
			const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			const lastYear = new Date(now.getFullYear() - 1, 0, 1);

			const testCases = [
				{ date: now, description: "今天" },
				{ date: yesterday, description: "昨天" },
				{ date: lastWeek, description: "本周内" },
				{ date: lastYear, description: "更早" },
			];

			testCases.forEach(({ date, description }) => {
				const file = new FileModel({
					name: "test.txt",
					path: "/test.txt",
					isDirectory: false,
					size: 0,
					modified: date.toISOString(),
				});

				const formatted = file.formatModified();
				expect(typeof formatted).toBe("string");
				expect(formatted.length).toBeGreaterThan(0);
			});
		});

		it("应该返回完整的修改时间", () => {
			const date = new Date("2024-01-01T12:30:45Z");
			const file = new FileModel({
				name: "test.txt",
				path: "/test.txt",
				isDirectory: false,
				size: 0,
				modified: date.toISOString(),
			});

			const fullDate = file.getFullModified();
			expect(typeof fullDate).toBe("string");
			expect(fullDate).toContain("2024");
		});
	});

	describe("文件属性检测", () => {
		it("应该检测是否可编辑", () => {
			const editableFiles = ["script.js", "style.css", "README.md", "config.yaml"];
			const nonEditableFiles = ["image.jpg", "archive.zip", "binary.exe"];

			editableFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isEditable()).toBe(true);
			});

			nonEditableFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isEditable()).toBe(false);
			});

			// 目录不可编辑
			const directory = new FileModel({
				name: "src",
				path: "/src",
				isDirectory: true,
				size: 0,
				modified: new Date().toISOString(),
			});

			expect(directory.isEditable()).toBe(false);
		});

		it("应该检测是否可执行", () => {
			const executableFiles = ["script.sh", "program.py", "app.js", "binary.exe"];
			const nonExecutableFiles = ["data.json", "image.png", "doc.md"];

			executableFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isExecutable()).toBe(true);
			});

			nonExecutableFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isExecutable()).toBe(false);
			});
		});

		it("应该检测是否是图片文件", () => {
			const imageFiles = ["photo.jpg", "image.png", "graphic.gif", "icon.svg"];
			const nonImageFiles = ["document.txt", "script.js", "data.json"];

			imageFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isImage()).toBe(true);
			});

			nonImageFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isImage()).toBe(false);
			});
		});

		it("应该检测是否是代码文件", () => {
			const codeFiles = ["app.js", "component.tsx", "style.css", "script.py"];
			const nonCodeFiles = ["image.jpg", "document.pdf", "data.csv"];

			codeFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isCodeFile()).toBe(true);
			});

			nonCodeFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isCodeFile()).toBe(false);
			});
		});

		it("应该检测是否是配置文件", () => {
			const configFiles = [".env", "config.json", "settings.yaml", "app.config"];
			const nonConfigFiles = ["script.js", "image.jpg", "README.md"];

			configFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isConfigFile()).toBe(true);
			});

			nonConfigFiles.forEach((filename) => {
				const file = new FileModel({
					name: filename,
					path: `/${filename}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.isConfigFile()).toBe(false);
			});
		});
	});

	describe("路径操作", () => {
		it("应该获取父目录路径", () => {
			const testCases = [
				{ path: "/root/file.txt", expected: "/root" },
				{ path: "/deep/nested/file.js", expected: "/deep/nested" },
				{ path: "/file.txt", expected: "/" },
				{ path: "/", expected: "/" },
			];

			testCases.forEach(({ path, expected }) => {
				const file = new FileModel({
					name: "file.txt",
					path,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.getParentPath()).toBe(expected);
			});
		});

		it("应该获取文件名（不含扩展名）", () => {
			const testCases = [
				{ name: "document.txt", expected: "document" },
				{ name: "archive.tar.gz", expected: "archive.tar" },
				{ name: "README", expected: "README" },
				{ name: ".env", expected: ".env" },
			];

			testCases.forEach(({ name, expected }) => {
				const file = new FileModel({
					name,
					path: `/${name}`,
					isDirectory: false,
					size: 0,
					modified: new Date().toISOString(),
				});

				expect(file.getBaseName()).toBe(expected);
			});
		});
	});

	describe("序列化和克隆", () => {
		it("应该转换为JSON", () => {
			const original = {
				name: "test.json",
				path: "/test.json",
				isDirectory: false,
				size: 2048,
				modified: "2024-01-01T12:00:00Z",
				extension: "json",
				permissions: "rw-r--r--",
			};

			const file = new FileModel(original);
			const json = file.toJSON();

			expect(json).toEqual(original);
		});

		it("应该从JSON创建", () => {
			const json = {
				name: "data.json",
				path: "/data.json",
				isDirectory: false,
				size: 1024,
				modified: "2024-01-01T12:00:00Z",
			};

			const file = FileModel.fromJSON(json);

			expect(file.name).toBe("data.json");
			expect(file.path).toBe("/data.json");
			expect(file.isDirectory).toBe(false);
			expect(file.size).toBe(1024);
			expect(file.modified).toBe("2024-01-01T12:00:00Z");
			expect(file.extension).toBe("json");
		});

		it("应该批量从JSON创建", () => {
			const items = [
				{
					name: "file1.txt",
					path: "/file1.txt",
					isDirectory: false,
					size: 100,
					modified: new Date().toISOString(),
				},
				{
					name: "file2.txt",
					path: "/file2.txt",
					isDirectory: false,
					size: 200,
					modified: new Date().toISOString(),
				},
			];

			const files = FileModel.fromJSONArray(items);

			expect(files).toHaveLength(2);
			expect(files[0]).toBeInstanceOf(FileModel);
			expect(files[0].name).toBe("file1.txt");
			expect(files[1].name).toBe("file2.txt");
		});

		it("应该克隆文件模型", () => {
			const original = new FileModel({
				name: "original.txt",
				path: "/original.txt",
				isDirectory: false,
				size: 1024,
				modified: "2024-01-01T12:00:00Z",
			});

			const clone = original.clone();

			expect(clone.name).toBe("original.txt");
			expect(clone.path).toBe("/original.txt");
			expect(clone).not.toBe(original); // 应该是不同的实例
		});
	});

	describe("更新操作", () => {
		it("应该更新文件信息", () => {
			const file = new FileModel({
				name: "old.txt",
				path: "/old.txt",
				isDirectory: false,
				size: 100,
				modified: "2024-01-01T12:00:00Z",
			});

			file.update({
				name: "new.txt",
				size: 200,
				modified: "2024-01-02T12:00:00Z",
			});

			expect(file.name).toBe("new.txt");
			expect(file.size).toBe(200);
			expect(file.modified).toBe("2024-01-02T12:00:00Z");
			expect(file.extension).toBe("txt"); // 应该自动更新扩展名
		});
	});
});
