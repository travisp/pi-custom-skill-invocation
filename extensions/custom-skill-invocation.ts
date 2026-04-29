import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
	DefaultResourceLoader,
	formatSkillsForPrompt,
	getAgentDir,
	SettingsManager,
	type ExtensionAPI,
	type ResourceDiagnostic,
	type Skill,
} from "@mariozechner/pi-coding-agent";

const CONFIG_FILE_NAME = "skill-invocation.json";
const LIST_DISABLED_INVOCATIONS_FLAG = "list-disabled-invocations";

interface SkillInvocationConfig {
	/** Skill names to expose to the model. */
	allow?: string[];
	/** Global config only: extra allow lists that apply under specific directories. */
	directories?: Record<string, string[]>;
}

/**
 * Makes skills manual-only by default while keeping explicitly allowed skills
 * visible to the model in the <available_skills> system prompt block.
 *
 * Config locations:
 * - global:  ~/.pi/agent/extensions/skill-invocation.json
 * - project: <cwd>/.pi/skill-invocation.json, also checked in parent directories
 */
export default function customSkillInvocation(pi: ExtensionAPI) {
	pi.registerFlag(LIST_DISABLED_INVOCATIONS_FLAG, {
		description: "List skills hidden from model invocation by skill-invocation config",
		type: "boolean",
		default: false,
	});

	pi.on("session_start", async (_event, ctx) => {
		if (pi.getFlag(LIST_DISABLED_INVOCATIONS_FLAG) !== true) {
			return undefined;
		}

		await printDisabledInvocations(ctx.cwd);

		if (ctx.hasUI) {
			ctx.shutdown();
		} else {
			process.exitCode = 0;
		}
	});

	pi.on("before_agent_start", async (event) => {
		const skills = event.systemPromptOptions.skills ?? [];
		const currentSkillBlock = formatSkillsForPrompt(skills);
		if (!currentSkillBlock) {
			return undefined;
		}

		const allowedNames = loadAllowedSkillNames(event.systemPromptOptions.cwd);
		const allowedSkills = skills.filter((skill) => allowedNames.has(skill.name));
		const nextSkillBlock = formatSkillsForPrompt(allowedSkills);

		return {
			systemPrompt: event.systemPrompt.replace(currentSkillBlock, nextSkillBlock),
		};
	});
}

async function printDisabledInvocations(cwd: string): Promise<void> {
	const agentDir = getAgentDir();
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager: SettingsManager.create(cwd, agentDir),
	});
	await resourceLoader.reload();

	const { skills, diagnostics } = resourceLoader.getSkills();
	for (const diagnostic of diagnostics) {
		printDiagnostic(diagnostic);
	}

	const allowedNames = loadAllowedSkillNames(cwd);
	const disabledSkills = skills
		.filter((skill) => skill.disableModelInvocation || !allowedNames.has(skill.name))
		.sort((a, b) => a.name.localeCompare(b.name));

	if (disabledSkills.length === 0) {
		console.log("No disabled skill invocations.");
		return;
	}

	console.log(`Disabled skill invocations (${disabledSkills.length}):`);
	for (const skill of disabledSkills) {
		console.log(`- ${skill.name} (${disabledReason(skill, allowedNames)})`);
		console.log(`  ${displayPath(cwd, skill.filePath)}`);
	}
}

function disabledReason(skill: Skill, allowedNames: Set<string>): string {
	if (skill.disableModelInvocation) {
		return "disable-model-invocation frontmatter";
	}
	if (!allowedNames.has(skill.name)) {
		return "not allow-listed";
	}
	return "hidden";
}

function printDiagnostic(diagnostic: ResourceDiagnostic): void {
	const prefix = diagnostic.type === "error" ? "Error" : "Warning";
	const path = diagnostic.path ? ` (${diagnostic.path})` : "";
	console.error(`${prefix}: ${diagnostic.message}${path}`);
}

function displayPath(cwd: string, filePath: string): string {
	const relativePath = relative(cwd, filePath);
	if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
		return filePath;
	}
	return relativePath;
}

function loadAllowedSkillNames(cwd: string): Set<string> {
	const names = new Set<string>();
	const globalConfig = readConfig(globalConfigPath());

	addNames(names, globalConfig.allow);
	addNames(names, directoryAllowList(globalConfig, cwd));

	for (const configPath of projectConfigPaths(cwd)) {
		addNames(names, readConfig(configPath).allow);
	}

	return names;
}

function globalConfigPath(): string {
	return join(getAgentDir(), "extensions", CONFIG_FILE_NAME);
}

function directoryAllowList(config: SkillInvocationConfig, cwd: string): string[] {
	const cwdPath = normalizePath(resolvePath(cwd));
	const names: string[] = [];

	for (const [directory, allow] of Object.entries(config.directories ?? {})) {
		const directoryPath = normalizePath(resolvePath(directory));
		if (cwdPath === directoryPath || cwdPath.startsWith(`${directoryPath}/`)) {
			names.push(...allow);
		}
	}

	return names;
}

function projectConfigPaths(cwd: string): string[] {
	const paths: string[] = [];
	let current = resolvePath(cwd);

	while (true) {
		const configPath = join(current, ".pi", CONFIG_FILE_NAME);
		if (existsSync(configPath)) {
			paths.push(configPath);
		}

		const parent = dirname(current);
		if (parent === current) {
			return paths.reverse();
		}
		current = parent;
	}
}

function readConfig(filePath: string): SkillInvocationConfig {
	if (!existsSync(filePath)) {
		return {};
	}

	try {
		return JSON.parse(readFileSync(filePath, "utf-8")) as SkillInvocationConfig;
	} catch (error) {
		console.error(`Warning: Could not parse ${filePath}: ${error}`);
		return {};
	}
}

function addNames(names: Set<string>, values: unknown): void {
	if (!Array.isArray(values)) {
		return;
	}

	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			names.add(value.trim());
		}
	}
}

function resolvePath(path: string): string {
	if (path === "~") {
		return homedir();
	}
	if (path.startsWith("~/")) {
		return resolve(homedir(), path.slice(2));
	}
	return resolve(path);
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
