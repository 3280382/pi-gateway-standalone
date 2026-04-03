// ==========================================
// 时空迷宫 - 完整版（含时间倒流系统）
// ==========================================

// -------------------- 工具函数 --------------------
const Utils = {
	checkRectCollision(rect1, rect2) {
		return (
			rect1.x < rect2.x + rect2.width &&
			rect1.x + rect2.width > rect2.x &&
			rect1.y < rect2.y + rect2.height &&
			rect1.y + rect1.height > rect2.y
		);
	},

	checkCircleRectCollision(circle, rect) {
		const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
		const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
		const distanceX = circle.x - closestX;
		const distanceY = circle.y - closestY;
		return (
			distanceX * distanceX + distanceY * distanceY <
			circle.radius * circle.radius
		);
	},

	distance(x1, y1, x2, y2) {
		return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
	},

	deepClone(obj) {
		return JSON.parse(JSON.stringify(obj));
	},
};

// -------------------- 输入处理器 --------------------
class InputHandler {
	constructor() {
		this.keys = {
			w: false,
			a: false,
			s: false,
			d: false,
			ArrowUp: false,
			ArrowLeft: false,
			ArrowDown: false,
			ArrowRight: false,
			" ": false,
			r: false,
		};
		this.setupListeners();
	}

	setupListeners() {
		window.addEventListener("keydown", (e) => {
			if (Object.hasOwn(this.keys, e.key)) {
				this.keys[e.key] = true;
			}
			if (
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
			) {
				e.preventDefault();
			}
		});

		window.addEventListener("keyup", (e) => {
			if (Object.hasOwn(this.keys, e.key)) {
				this.keys[e.key] = false;
			}
		});
	}

	getMovement() {
		let dx = 0,
			dy = 0;
		if (this.keys.w || this.keys.ArrowUp) dy -= 1;
		if (this.keys.s || this.keys.ArrowDown) dy += 1;
		if (this.keys.a || this.keys.ArrowLeft) dx -= 1;
		if (this.keys.d || this.keys.ArrowRight) dx += 1;

		if (dx !== 0 && dy !== 0) {
			const length = Math.sqrt(dx * dx + dy * dy);
			dx /= length;
			dy /= length;
		}
		return { dx, dy };
	}

	isPressed(key) {
		return this.keys[key] || false;
	}
}

// -------------------- 状态记录器 --------------------
class StateRecorder {
	static captureState(player, entities, shadowClones) {
		const playerState = {
			x: player.x,
			y: player.y,
			vx: player.vx,
			vy: player.vy,
			trail: Utils.deepClone(player.trail),
		};

		const entityStates = entities.map((e) => ({
			id: e.id || null,
			type: e.type,
			isActivated: e.isActivated,
			isOpen: e.isOpen,
			targetOpen: e.targetOpen,
			openProgress: e.openProgress,
		}));

		const shadowStates = shadowClones.map((s) => ({
			x: s.x,
			y: s.y,
			currentIndex: s.currentIndex,
			isComplete: s.isComplete,
		}));

		return {
			timestamp: Date.now(),
			player: playerState,
			entities: entityStates,
			shadows: shadowStates,
			frame: 0,
		};
	}

	static applyState(state, player, entities, shadowClones) {
		if (player && state.player) {
			player.x = state.player.x;
			player.y = state.player.y;
			player.vx = state.player.vx;
			player.vy = state.player.vy;
			player.trail = Utils.deepClone(state.player.trail);
		}

		if (entities && state.entities) {
			entities.forEach((entity, index) => {
				const savedState = state.entities.find(
					(s) =>
						(s.id && s.id === entity.id) ||
						(s.type === entity.type && state.entities.indexOf(s) === index),
				);
				if (savedState) {
					if (entity.type === "switch") {
						entity.isActivated = savedState.isActivated;
					}
					if (entity.type === "door") {
						entity.isOpen = savedState.isOpen;
						entity.targetOpen = savedState.targetOpen;
						entity.openProgress = savedState.openProgress;
					}
				}
			});
		}
	}
}

// -------------------- 时间管理器 --------------------
class TimeManager {
	constructor(maxFrames = 600) {
		this.maxFrames = maxFrames;
		this.timeline = [];
		this.currentIndex = -1;
		this.isRewinding = false;
		this.rewindSpeed = 3;
		this.totalRecordedFrames = 0;
	}

	record(state) {
		if (this.isRewinding) return;

		state.frame = this.totalRecordedFrames++;
		this.timeline.push(state);
		this.currentIndex = this.timeline.length - 1;

		if (this.timeline.length > this.maxFrames) {
			this.timeline.shift();
			this.currentIndex--;
		}
	}

	startRewind() {
		if (this.timeline.length < 2) return false;

		this.isRewinding = true;
		this.rewindStartIndex = this.currentIndex;
		return true;
	}

	stopRewind() {
		if (!this.isRewinding) return null;

		this.isRewinding = false;
		const rewindDepth = this.rewindStartIndex - this.currentIndex;
		const rewindTargetIndex = this.currentIndex;

		this.timeline = this.timeline.slice(0, this.currentIndex + 1);

		return {
			depth: rewindDepth,
			targetIndex: rewindTargetIndex,
			startIndex: this.rewindStartIndex,
		};
	}

	getCurrentState() {
		if (this.currentIndex >= 0 && this.currentIndex < this.timeline.length) {
			return this.timeline[this.currentIndex];
		}
		return null;
	}

	rewindStep() {
		if (!this.isRewinding) return false;

		this.currentIndex -= this.rewindSpeed;

		if (this.currentIndex < 0) {
			this.currentIndex = 0;
			this.isRewinding = false;
			return false;
		}

		return true;
	}

	getRewindableFrames() {
		return this.currentIndex + 1;
	}

	getRewindProgress() {
		if (!this.isRewinding) return 0;
		const total = this.rewindStartIndex;
		const current = this.currentIndex;
		return 1 - current / total;
	}

	reset() {
		this.timeline = [];
		this.currentIndex = -1;
		this.isRewinding = false;
		this.totalRecordedFrames = 0;
	}

	getShadowStates(startIndex, endIndex) {
		return this.timeline.slice(startIndex, endIndex + 1);
	}
}

// -------------------- 粒子系统 --------------------
class ParticleSystem {
	constructor() {
		this.particles = [];
	}

	createRewindParticle(x, y) {
		this.particles.push({
			x: x,
			y: y,
			vx: (Math.random() - 0.5) * 2,
			vy: (Math.random() - 0.5) * 2,
			life: 1.0,
			color: `hsl(${260 + Math.random() * 40}, 100%, 70%)`,
			size: 2 + Math.random() * 3,
		});
	}

	update() {
		this.particles = this.particles.filter((p) => {
			p.x += p.vx;
			p.y += p.vy;
			p.life -= 0.02;
			return p.life > 0;
		});
	}

	render(ctx) {
		ctx.save();
		this.particles.forEach((p) => {
			ctx.globalAlpha = p.life * 0.6;
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.restore();
	}
}

// -------------------- 影子克隆类 --------------------
class ShadowClone {
	constructor(states, id) {
		this.states = states;
		this.currentIndex = 0;
		this.id = id;
		this.type = "shadow";
		this.radius = 12;
		this.isComplete = false;
		this.active = true;

		const initial = states[0] || {};
		this.x = initial.x || 0;
		this.y = initial.y || 0;

		this.trail = [];
	}

	update(entities) {
		if (this.isComplete || !this.active) return;

		if (this.currentIndex < this.states.length) {
			const state = this.states[this.currentIndex];
			this.x = state.player.x;
			this.y = state.player.y;
			this.currentIndex++;

			this.trail.push({ x: this.x, y: this.y });
			if (this.trail.length > 8) this.trail.shift();

			this.checkSwitchInteractions(entities);
		} else {
			this.isComplete = true;
			setTimeout(() => {
				this.active = false;
			}, 2000);
		}
	}

	checkSwitchInteractions(entities) {
		entities.forEach((entity) => {
			if (entity.type === "switch") {
				const dist = Utils.distance(this.x, this.y, entity.x, entity.y);
				if (dist < this.radius + entity.width / 2) {
					entity.activate();
				}
			}
		});
	}

	render(ctx) {
		if (!this.active) return;

		ctx.save();

		this.trail.forEach((pos, i) => {
			const alpha = (i / this.trail.length) * 0.2;
			ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
			ctx.beginPath();
			ctx.arc(pos.x, pos.y, this.radius * 0.5, 0, Math.PI * 2);
			ctx.fill();
		});

		const progress = this.currentIndex / this.states.length;
		const alpha = this.isComplete ? 0.3 : 0.6;

		ctx.globalAlpha = alpha;
		ctx.shadowBlur = 15;
		ctx.shadowColor = "rgba(168, 85, 247, 0.8)";

		ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
		ctx.beginPath();
		ctx.roundRect(
			this.x - this.radius,
			this.y - this.radius,
			this.radius * 2,
			this.radius * 2,
			6,
		);
		ctx.fill();

		ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
		ctx.beginPath();
		ctx.roundRect(
			this.x - this.radius + 2,
			this.y - this.radius + 2,
			this.radius * 2 - 4,
			this.radius * 2 - 4,
			4,
		);
		ctx.fill();

		ctx.fillStyle = "#fff";
		ctx.font = "10px Arial";
		ctx.textAlign = "center";
		ctx.fillText("影子", this.x, this.y - 20);

		ctx.restore();
	}
}

// -------------------- 实体基类 --------------------
class Entity {
	constructor(x, y, width, height, type) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.type = type;
		this.active = true;
		this.id = null;
	}

	getBounds() {
		return {
			x: this.x - this.width / 2,
			y: this.y - this.height / 2,
			width: this.width,
			height: this.height,
		};
	}

	update() {}
	render(ctx) {}
}

// -------------------- 墙壁类 --------------------
class Wall extends Entity {
	constructor(x, y, width, height) {
		super(x, y, width, height, "wall");
		this.color = "#1e1e2e";
		this.borderColor = "#00d4ff";
	}

	render(ctx) {
		ctx.save();
		ctx.fillStyle = this.color;
		ctx.fillRect(
			this.x - this.width / 2,
			this.y - this.height / 2,
			this.width,
			this.height,
		);
		ctx.strokeStyle = this.borderColor;
		ctx.lineWidth = 2;
		ctx.shadowBlur = 10;
		ctx.shadowColor = this.borderColor;
		ctx.strokeRect(
			this.x - this.width / 2,
			this.y - this.height / 2,
			this.width,
			this.height,
		);
		ctx.fillStyle = "rgba(0, 212, 255, 0.1)";
		ctx.fillRect(
			this.x - this.width / 2 + 4,
			this.y - this.height / 2 + 4,
			this.width - 8,
			this.height - 8,
		);
		ctx.restore();
	}
}

// -------------------- 开关类 --------------------
class Switch extends Entity {
	constructor(x, y, id, targets = []) {
		super(x, y, 32, 32, "switch");
		this.id = id;
		this.targets = targets;
		this.isActivated = false;
		this.activationTime = 0;
	}

	activate() {
		if (!this.isActivated) {
			this.isActivated = true;
			this.activationTime = Date.now();
			return true;
		}
		return false;
	}

	deactivate() {
		this.isActivated = false;
	}

	render(ctx) {
		ctx.save();
		const x = this.x - this.width / 2;
		const y = this.y - this.height / 2;

		ctx.fillStyle = "#2a2a3e";
		ctx.fillRect(x, y, this.width, this.height);

		const glowColor = this.isActivated ? "#22c55e" : "#ef4444";
		ctx.fillStyle = glowColor;
		ctx.shadowBlur = this.isActivated ? 20 : 5;
		ctx.shadowColor = glowColor;

		ctx.beginPath();
		ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#fff";
		ctx.font = "bold 12px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(this.isActivated ? "✓" : "○", this.x, this.y);
		ctx.restore();
	}
}

// -------------------- 门类 --------------------
class Door extends Entity {
	constructor(x, y, width, height, id, initiallyOpen = false) {
		super(x, y, width, height, "door");
		this.id = id;
		this.isOpen = initiallyOpen;
		this.targetOpen = initiallyOpen;
		this.openProgress = initiallyOpen ? 1 : 0;
		this.animationSpeed = 0.1;
	}

	setOpen(open) {
		this.targetOpen = open;
	}

	update() {
		if (this.targetOpen && this.openProgress < 1) {
			this.openProgress += this.animationSpeed;
			if (this.openProgress > 1) this.openProgress = 1;
		} else if (!this.targetOpen && this.openProgress > 0) {
			this.openProgress -= this.animationSpeed;
			if (this.openProgress < 0) this.openProgress = 0;
		}
	}

	isSolid() {
		return this.openProgress < 0.5;
	}

	render(ctx) {
		ctx.save();
		const alpha = 1 - this.openProgress * 0.8;
		const scale = 1 - this.openProgress * 0.2;

		ctx.globalAlpha = alpha;
		const w = this.width * scale;
		const h = this.height * scale;
		const x = this.x - w / 2;
		const y = this.y - h / 2;

		ctx.fillStyle = this.isOpen ? "#22c55e" : "#a855f7";
		ctx.shadowBlur = 15;
		ctx.shadowColor = this.isOpen ? "#22c55e" : "#a855f7";
		ctx.fillRect(x, y, w, h);

		ctx.fillStyle = "rgba(0,0,0,0.3)";
		ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

		ctx.fillStyle = "#fff";
		ctx.font = "10px Arial";
		ctx.textAlign = "center";
		ctx.fillText(this.isOpen ? "OPEN" : "LOCKED", this.x, this.y);
		ctx.restore();
	}
}

// -------------------- 出口类 --------------------
class Exit extends Entity {
	constructor(x, y) {
		super(x, y, 40, 40, "exit");
		this.pulse = 0;
	}

	update() {
		this.pulse += 0.05;
	}

	render(ctx) {
		ctx.save();
		const glowSize = 15 + Math.sin(this.pulse) * 5;
		ctx.shadowBlur = glowSize;
		ctx.shadowColor = "#eab308";

		ctx.fillStyle = "#eab308";
		ctx.beginPath();
		ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#fff";
		ctx.beginPath();
		ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#eab308";
		ctx.font = "12px Arial";
		ctx.textAlign = "center";
		ctx.fillText("EXIT", this.x, this.y - 25);
		ctx.restore();
	}
}

// -------------------- 玩家类 --------------------
class Player extends Entity {
	constructor(x, y) {
		super(x, y, 24, 24, "player");
		this.radius = 12;
		this.vx = 0;
		this.vy = 0;
		this.maxSpeed = 5;
		this.acceleration = 0.8;
		this.friction = 0.85;
		this.trail = [];
		this.maxTrailLength = 8;
	}

	update(input, entities, canvasWidth, canvasHeight, isRewinding = false) {
		if (isRewinding) return;

		const movement = input.getMovement();
		this.vx += movement.dx * this.acceleration;
		this.vy += movement.dy * this.acceleration;
		this.vx *= this.friction;
		this.vy *= this.friction;

		const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
		if (speed > this.maxSpeed) {
			this.vx = (this.vx / speed) * this.maxSpeed;
			this.vy = (this.vy / speed) * this.maxSpeed;
		}

		if (Math.abs(this.vx) < 0.01) this.vx = 0;
		if (Math.abs(this.vy) < 0.01) this.vy = 0;

		this.tryMove(this.vx, this.vy, entities, canvasWidth, canvasHeight);
		this.updateTrail();
	}

	tryMove(dx, dy, entities, width, height) {
		let newX = this.x + dx;
		newX = Math.max(this.radius, Math.min(width - this.radius, newX));

		if (dx !== 0) {
			const testBounds = {
				x: newX - this.radius,
				y: this.y - this.radius,
				width: this.radius * 2,
				height: this.radius * 2,
			};
			let collisionX = false;

			for (const entity of entities) {
				if (
					entity.type === "wall" ||
					(entity.type === "door" && entity.isSolid())
				) {
					if (Utils.checkRectCollision(testBounds, entity.getBounds())) {
						collisionX = true;
						break;
					}
				}
			}

			if (!collisionX) {
				this.x = newX;
			} else {
				this.vx = 0;
			}
		}

		let newY = this.y + dy;
		newY = Math.max(this.radius, Math.min(height - this.radius, newY));

		if (dy !== 0) {
			const testBounds = {
				x: this.x - this.radius,
				y: newY - this.radius,
				width: this.radius * 2,
				height: this.radius * 2,
			};
			let collisionY = false;

			for (const entity of entities) {
				if (
					entity.type === "wall" ||
					(entity.type === "door" && entity.isSolid())
				) {
					if (Utils.checkRectCollision(testBounds, entity.getBounds())) {
						collisionY = true;
						break;
					}
				}
			}

			if (!collisionY) {
				this.y = newY;
			} else {
				this.vy = 0;
			}
		}
	}

	updateTrail() {
		this.trail.push({ x: this.x, y: this.y });
		if (this.trail.length > this.maxTrailLength) {
			this.trail.shift();
		}
	}

	render(ctx) {
		this.renderTrail(ctx);
		ctx.save();
		ctx.shadowBlur = 20;
		ctx.shadowColor = "#00d4ff";

		ctx.fillStyle = "#00d4ff";
		ctx.beginPath();
		const size = this.radius * 2;
		ctx.roundRect(this.x - this.radius, this.y - this.radius, size, size, 6);
		ctx.fill();

		ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
		ctx.beginPath();
		ctx.roundRect(
			this.x - this.radius + 2,
			this.y - this.radius + 2,
			size - 4,
			size - 4,
			4,
		);
		ctx.fill();

		ctx.restore();
	}

	renderTrail(ctx) {
		if (this.trail.length < 2) return;
		ctx.save();
		for (let i = 0; i < this.trail.length - 1; i++) {
			const alpha = (i / this.trail.length) * 0.3;
			const point = this.trail[i];
			ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
			ctx.beginPath();
			ctx.arc(point.x, point.y, this.radius * 0.6, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	reset(x, y) {
		this.x = x;
		this.y = y;
		this.vx = 0;
		this.vy = 0;
		this.trail = [];
	}
}

// -------------------- 关卡管理器 --------------------
class LevelManager {
	constructor() {
		this.currentLevel = 0;
		this.entities = [];
		this.tileSize = 40;

		this.levels = [
			this.createLevel1(),
			this.createLevel2(),
			this.createLevel3(),
		];
	}

	createLevel1() {
		const mapData = [
			"####################",
			"#P.................#",
			"#..................#",
			"#.....######.......#",
			"#.....#....#.......#",
			"#.....#..S1#.......#",
			"#.....#....#.......#",
			"#.....######.......#",
			"#..................#",
			"#..................#",
			"#.........D1.......#",
			"#.........#........#",
			"#.........#........#",
			"#.........#........#",
			"#.........O........#",
			"####################",
		];

		return this.parseMap(mapData, { switchTargets: { S1: ["D1"] } });
	}

	createLevel2() {
		const mapData = [
			"####################",
			"#P.......#........O#",
			"#........#.........#",
			"#...S1...D1........#",
			"#........#.........#",
			"##########.........#",
			"#..................#",
			"#...S2...D2........#",
			"#........#.........#",
			"##########.........#",
			"#..................#",
			"#.................##",
			"#..................#",
			"#..................#",
			"####################",
		];

		return this.parseMap(mapData, {
			switchTargets: { S1: ["D1"], S2: ["D2"] },
		});
	}

	createLevel3() {
		const mapData = [
			"####################",
			"#P.................#",
			"#...####...####....#",
			"#...#S1#...#..#....#",
			"#...####...#O.#....#",
			"#..........####....#",
			"#...####...........#",
			"#...#..#...####....#",
			"#...#D1#...#S2#....#",
			"#...####...####....#",
			"#..................#",
			"#..................#",
			"#..................#",
			"#..................#",
			"####################",
		];

		return this.parseMap(mapData, {
			switchTargets: { S1: ["D1"], S2: ["D1"] },
		});
	}

	parseMap(mapData, config) {
		const entities = [];
		const rows = mapData.length;
		const cols = mapData[0].length;
		let playerStart = { x: 100, y: 100 };

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const char = mapData[row][col];
				const x = col * this.tileSize + this.tileSize / 2;
				const y = row * this.tileSize + this.tileSize / 2;

				switch (char) {
					case "#":
						entities.push(new Wall(x, y, this.tileSize, this.tileSize));
						break;
					case "P":
						playerStart = { x, y };
						break;
					case "S": {
						const switchId = `S1`;
						entities.push(
							new Switch(x, y, switchId, config.switchTargets[switchId] || []),
						);
						break;
					}
					case "D": {
						const doorId = `D1`;
						entities.push(
							new Door(x, y, this.tileSize, this.tileSize, doorId, false),
						);
						break;
					}
					case "O":
						entities.push(new Exit(x, y));
						break;
				}
			}
		}

		return {
			entities,
			playerStart,
			width: cols * this.tileSize,
			height: rows * this.tileSize,
		};
	}

	loadLevel(levelIndex) {
		this.currentLevel = levelIndex;
		const levelData = this.levels[levelIndex];
		this.entities = [...levelData.entities];
		return levelData;
	}

	getEntities() {
		return this.entities;
	}

	update() {
		this.entities.forEach((e) => e.update());

		const switches = this.entities.filter((e) => e.type === "switch");
		const doors = this.entities.filter((e) => e.type === "door");

		switches.forEach((sw) => {
			const shouldBeOpen = sw.isActivated;
			sw.targets.forEach((targetId) => {
				const door = doors.find((d) => d.id === targetId);
				if (door) door.setOpen(shouldBeOpen);
			});
		});
	}

	checkInteractions(player, shadowClones = []) {
		const playerCircle = { x: player.x, y: player.y, radius: player.radius };
		let reachedExit = false;
		const allActors = [player, ...shadowClones.filter((s) => s.active)];

		allActors.forEach((actor) => {
			this.entities.forEach((entity) => {
				if (entity.type === "switch") {
					const dist = Utils.distance(actor.x, actor.y, entity.x, entity.y);
					if (dist < actor.radius + entity.width / 2) {
						entity.activate();
					}
				}

				if (entity.type === "exit" && actor === player) {
					const dist = Utils.distance(actor.x, actor.y, entity.x, entity.y);
					if (dist < actor.radius + 15) {
						reachedExit = true;
					}
				}
			});
		});

		return { reachedExit };
	}

	render(ctx) {
		this.entities.forEach((e) => e.render(ctx));
	}
}

// -------------------- 游戏引擎 --------------------
class GameEngine {
	constructor() {
		this.canvas = document.getElementById("game-canvas");
		this.ctx = this.canvas.getContext("2d");
		this.input = new InputHandler();
		this.levelManager = new LevelManager();
		this.timeManager = new TimeManager(600);
		this.particleSystem = new ParticleSystem();

		this.player = null;
		this.shadowClones = [];
		this.isRunning = false;
		this.score = 0;
		this.level = 1;
		this.startTime = 0;
		this.elapsedTime = 0;
		this.shadowCounter = 0;

		this.setupCanvas();
		window.addEventListener("resize", () => this.setupCanvas());
		this.bindUIEvents();

		this.gameLoop = this.gameLoop.bind(this);
		requestAnimationFrame(this.gameLoop);
	}

	setupCanvas() {
		const dpr = window.devicePixelRatio || 1;
		this.canvas.width = 800 * dpr;
		this.canvas.height = 600 * dpr;
		this.ctx.scale(dpr, dpr);
		this.logicalWidth = 800;
		this.logicalHeight = 600;
	}

	bindUIEvents() {
		document
			.getElementById("start-btn")
			.addEventListener("click", () => this.startGame());
		document
			.getElementById("next-level-btn")
			.addEventListener("click", () => this.nextLevel());
		document
			.getElementById("restart-btn")
			.addEventListener("click", () => this.restartGame());

		window.addEventListener("keydown", (e) => {
			if (e.key === "r" || e.key === "R") this.resetLevel();
			if (e.key === " " && this.isRunning && !this.timeManager.isRewinding) {
				this.startRewind();
			}
		});

		window.addEventListener("keyup", (e) => {
			if (e.key === " " && this.timeManager.isRewinding) {
				this.stopRewind();
			}
		});
	}

	startGame() {
		document.getElementById("start-overlay").classList.add("hidden");
		this.isRunning = true;
		this.score = 0;
		this.level = 1;
		this.startTime = Date.now();
		this.shadowClones = [];
		this.timeManager.reset();
		this.loadLevel(0);
	}

	loadLevel(levelIndex) {
		const levelData = this.levelManager.loadLevel(levelIndex);
		this.player = new Player(levelData.playerStart.x, levelData.playerStart.y);
		this.updateUI();
	}

	startRewind() {
		if (this.timeManager.timeline.length < 10) return;

		const started = this.timeManager.startRewind();
		if (started) {
			document.getElementById("rewind-indicator").classList.add("active");
			document.getElementById("game-container").classList.add("rewinding");
			document.getElementById("game-canvas").classList.add("rewinding");
			console.log("⏪ 时间倒流开始");
		}
	}

	stopRewind() {
		const rewindInfo = this.timeManager.stopRewind();
		if (rewindInfo && rewindInfo.depth > 10) {
			this.createShadow(rewindInfo);
		}

		document.getElementById("rewind-indicator").classList.remove("active");
		document.getElementById("game-container").classList.remove("rewinding");
		document.getElementById("game-canvas").classList.remove("rewinding");

		if (rewindInfo) {
			console.log(`⏩ 时间倒流结束，倒退了 ${rewindInfo.depth} 帧`);
		}
	}

	createShadow(rewindInfo) {
		const shadowStates = this.timeManager.getShadowStates(
			rewindInfo.targetIndex,
			rewindInfo.startIndex,
		);

		if (shadowStates.length > 5) {
			const shadow = new ShadowClone(
				shadowStates,
				`shadow_${this.shadowCounter++}`,
			);
			this.shadowClones.push(shadow);
			this.score += 50;

			document.getElementById("shadow-count").textContent =
				this.shadowClones.filter((s) => s.active).length;

			console.log(`👤 创建了一个时间影子（${shadowStates.length}帧）`);
		}
	}

	nextLevel() {
		if (this.level < 3) {
			this.level++;
			document.getElementById("level-complete-overlay").classList.add("hidden");
			this.shadowClones = [];
			this.timeManager.reset();
			document.getElementById("shadow-count").textContent = "0";
			this.loadLevel(this.level - 1);
		} else {
			this.showGameComplete();
		}
	}

	restartGame() {
		this.level = 1;
		this.score = 0;
		this.shadowClones = [];
		this.timeManager.reset();
		document.getElementById("shadow-count").textContent = "0";
		document.getElementById("game-complete-overlay").classList.add("hidden");
		this.startGame();
	}

	resetLevel() {
		if (this.player && this.levelManager) {
			const levelData = this.levelManager.levels[this.level - 1];
			this.player.reset(levelData.playerStart.x, levelData.playerStart.y);
			this.shadowClones = [];
			this.timeManager.reset();
			document.getElementById("shadow-count").textContent = "0";
			this.levelManager.entities.forEach((e) => {
				if (e.type === "switch") e.deactivate();
				if (e.type === "door") {
					e.isOpen = false;
					e.targetOpen = false;
					e.openProgress = 0;
				}
			});
		}
	}

	showLevelComplete() {
		this.isRunning = false;
		document.getElementById("level-time").textContent =
			document.getElementById("time-display").textContent;
		document.getElementById("level-score").textContent = this.score;
		document
			.getElementById("level-complete-overlay")
			.classList.remove("hidden");
	}

	showGameComplete() {
		this.isRunning = false;
		document.getElementById("final-score").textContent = this.score;
		document.getElementById("final-time").textContent =
			document.getElementById("time-display").textContent;
		document.getElementById("game-complete-overlay").classList.remove("hidden");
	}

	gameLoop() {
		const currentTime = Date.now();

		if (this.isRunning) {
			this.elapsedTime = currentTime - this.startTime;
			this.update();
		}

		this.render();

		if (this.isRunning) {
			this.updateUI();
		}

		requestAnimationFrame(this.gameLoop);
	}

	update() {
		if (!this.player) return;

		if (this.timeManager.isRewinding) {
			const canContinue = this.timeManager.rewindStep();
			const state = this.timeManager.getCurrentState();

			if (state) {
				StateRecorder.applyState(
					state,
					this.player,
					this.levelManager.entities,
					this.shadowClones,
				);

				if (Math.random() > 0.5) {
					this.particleSystem.createRewindParticle(
						this.player.x + (Math.random() - 0.5) * 20,
						this.player.y + (Math.random() - 0.5) * 20,
					);
				}
			}
		} else {
			this.levelManager.update();

			this.shadowClones.forEach((shadow) =>
				shadow.update(this.levelManager.entities),
			);
			this.shadowClones = this.shadowClones.filter((s) => s.active);

			const entities = this.levelManager.getEntities();
			this.player.update(
				this.input,
				entities,
				this.logicalWidth,
				this.logicalHeight,
				false,
			);

			const state = StateRecorder.captureState(
				this.player,
				this.levelManager.entities,
				this.shadowClones,
			);
			this.timeManager.record(state);

			const { reachedExit } = this.levelManager.checkInteractions(
				this.player,
				this.shadowClones,
			);
			if (reachedExit) {
				this.score += 1000;
				this.showLevelComplete();
			}
		}

		this.particleSystem.update();
	}

	render() {
		const ctx = this.ctx;
		const w = this.logicalWidth;
		const h = this.logicalHeight;

		if (this.timeManager.isRewinding) {
			ctx.fillStyle = "rgba(20, 10, 30, 0.2)";
		} else {
			ctx.fillStyle = "#0a0a0f";
		}
		ctx.fillRect(0, 0, w, h);

		this.drawGrid(ctx, w, h);

		if (this.levelManager) {
			this.levelManager.render(ctx);
		}

		this.shadowClones.forEach((shadow) => shadow.render(ctx));

		if (this.player) {
			this.player.render(ctx);
		}

		this.particleSystem.render(ctx);

		if (this.timeManager.isRewinding) {
			this.renderRewindEffect(ctx, w, h);
		}

		if (this.isRunning && this.level === 1 && !this.timeManager.isRewinding) {
			this.drawTutorialHints(ctx);
		}
	}

	drawGrid(ctx, w, h) {
		ctx.save();
		const gridColor = this.timeManager.isRewinding
			? "rgba(168, 85, 247, 0.1)"
			: "rgba(0, 212, 255, 0.03)";
		ctx.strokeStyle = gridColor;
		ctx.lineWidth = 1;
		const gridSize = 40;

		for (let x = 0; x <= w; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}
		for (let y = 0; y <= h; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
			ctx.stroke();
		}
		ctx.restore();
	}

	renderRewindEffect(ctx, w, h) {
		const progress = this.timeManager.getRewindProgress();
		const scanY = h * (1 - progress);

		ctx.save();
		ctx.strokeStyle = "rgba(168, 85, 247, 0.8)";
		ctx.lineWidth = 2;
		ctx.shadowBlur = 20;
		ctx.shadowColor = "rgba(168, 85, 247, 1)";

		ctx.beginPath();
		ctx.moveTo(0, scanY);
		ctx.lineTo(w, scanY);
		ctx.stroke();

		ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
		ctx.font = "bold 20px Arial";
		ctx.textAlign = "center";
		ctx.fillText("◀ REWINDING TIME ◀", w / 2, scanY - 10);

		ctx.restore();

		const rewindBar = document.getElementById("rewind-bar");
		if (rewindBar) {
			rewindBar.style.width = `${(1 - progress) * 100}%`;
		}
	}

	drawTutorialHints(ctx) {
		ctx.save();
		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.font = "14px Arial";
		ctx.textAlign = "center";

		ctx.fillText("移动到开关上激活它", 280, 280);
		ctx.fillText("按住空格键可以倒转时间！", 400, 100);
		ctx.fillText("倒转时间后会创造影子帮你协作", 400, 120);
		ctx.fillText("到达黄色出口完成关卡", 400, 520);

		ctx.restore();
	}

	updateUI() {
		document.getElementById("score-display").textContent = this.score;
		document.getElementById("level-display").textContent = this.level;

		const minutes = Math.floor(this.elapsedTime / 60000);
		const seconds = Math.floor((this.elapsedTime % 60000) / 1000);
		const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
		document.getElementById("time-display").textContent = timeStr;

		const timelineCurrent = document.getElementById("timeline-current");
		if (timelineCurrent && this.timeManager.timeline.length > 0) {
			const progress =
				(this.timeManager.currentIndex / this.timeManager.maxFrames) * 100;
			timelineCurrent.style.width = `${Math.min(progress, 100)}%`;
		}
	}
}

// -------------------- 初始化 --------------------
document.addEventListener("DOMContentLoaded", () => {
	window.game = new GameEngine();
	console.log("🚀 时空迷宫已加载！按空格键体验时间倒流！");
});
