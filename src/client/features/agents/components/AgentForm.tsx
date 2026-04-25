/**
 * AgentForm - Create/Edit Agent with independent template overrides
 */
import { useCallback, useEffect, useState } from "react";
import { useAgentStore } from "../stores/agentStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import type { Agent, AgentFormData } from "../types";
import styles from "./Agents.module.css";

const ALL_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"];
const EMPTY: AgentFormData = {
  name: "",
  description: "",
  systemPromptUseDefault: true,
  systemPromptTemplate: "",
  appendPromptUseDefault: true,
  appendPromptTemplate: "",
  contextUseDefault: true,
  contextTemplate: "",
  defaultModel: "",
  defaultProvider: "",
  thinkingLevel: "medium",
  tools: ["read", "bash", "edit", "write"],
  skillNames: [],
  promptTemplateNames: [],
};

interface Props {
  agent?: Agent | null;
  onClose: () => void;
}

export function AgentForm({ agent, onClose }: Props) {
  const { addAgent, editAgent, models, templates, skills, loadAllRefData, error, clearError } =
    useAgentStore();
  const workingDir = useSessionStore((s) => s.workingDir);
  const [form, setForm] = useState<AgentFormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllRefData(workingDir);
  }, [workingDir, loadAllRefData]);
  useEffect(() => {
    if (agent)
      setForm({
        name: agent.name,
        description: agent.description,
        systemPromptUseDefault: agent.systemPromptUseDefault ?? true,
        systemPromptTemplate: agent.systemPromptTemplate || "",
        appendPromptUseDefault: agent.appendPromptUseDefault ?? true,
        appendPromptTemplate: agent.appendPromptTemplate || "",
        contextUseDefault: agent.contextUseDefault ?? true,
        contextTemplate: agent.contextTemplate || "",
        defaultModel: agent.defaultModel,
        defaultProvider: agent.defaultProvider,
        thinkingLevel: agent.thinkingLevel,
        tools: agent.tools || [],
        skillNames: agent.skillNames || [],
        promptTemplateNames: agent.promptTemplateNames || [],
      });
    else setForm(EMPTY);
  }, [agent]);

  const set = <K extends keyof AgentFormData>(k: K, v: AgentFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));
  const toggle = (k: "tools" | "skillNames" | "promptTemplateNames", v: string) => {
    const arr = form[k] as string[];
    set(k as any, arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const handleModelChange = (id: string) => {
    const m = models.find((x) => x.id === id);
    if (m) {
      set("defaultModel", m.id.split("/").slice(1).join("/"));
      set("defaultProvider", m.provider);
    } else {
      set("defaultModel", "");
      set("defaultProvider", "");
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.defaultModel || !form.defaultProvider) return;
    setSaving(true);
    try {
      agent ? await editAgent(agent.id, form) : await addAgent(form);
      onClose();
    } catch {
      /* store sets error */
    } finally {
      setSaving(false);
    }
  };

  const selectedModelId =
    models.find(
      (m) =>
        m.provider === form.defaultProvider &&
        m.id.split("/").slice(1).join("/") === form.defaultModel
    )?.id || "";
  const gModels: Record<string, typeof models> = {};
  models.forEach((m) => {
    (gModels[m.provider] ??= []).push(m);
  });

  const TemplateField = ({
    label,
    useDefault,
    template,
    onToggle,
    onTemplate,
  }: {
    label: string;
    useDefault: boolean;
    template: string;
    onToggle: (v: boolean) => void;
    onTemplate: (v: string) => void;
  }) => (
    <fieldset className={styles.checkboxGroup}>
      <legend className={styles.fieldLabel}>{label}</legend>
      <label className={styles.checkboxLabel}>
        <input type="radio" checked={useDefault} onChange={() => onToggle(true)} /> Use default
      </label>
      <label className={styles.checkboxLabel}>
        <input type="radio" checked={!useDefault} onChange={() => onToggle(false)} /> Use template
      </label>
      {!useDefault && templates.length > 0 && (
        <select
          className={styles.select}
          value={template}
          onChange={(e) => onTemplate(e.target.value)}
          style={{ marginTop: 4 }}
        >
          <option value="">-- Select template --</option>
          {templates.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.source})
            </option>
          ))}
        </select>
      )}
      {!useDefault && templates.length === 0 && (
        <span className={styles.emptyHint} style={{ fontSize: 11, color: "var(--text-muted)" }}>
          No templates available. Create one in Prompts view first.
        </span>
      )}
    </fieldset>
  );

  return (
    <div className={styles.formOverlay} onClick={onClose}>
      <div className={styles.formContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.formHeader}>
          <h2 className={styles.formTitle}>{agent ? "Edit Agent" : "New Agent"}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.formBody}>
          <label className={styles.fieldLabel}>
            Name *
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g., Code Reviewer"
              maxLength={50}
            />
          </label>
          <label className={styles.fieldLabel}>
            Description
            <input
              className={styles.input}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What this agent specializes in"
              maxLength={200}
            />
          </label>

          {/* System Prompt */}
          <TemplateField
            label="System Prompt"
            useDefault={form.systemPromptUseDefault}
            template={form.systemPromptTemplate}
            onToggle={(v) => set("systemPromptUseDefault", v)}
            onTemplate={(v) => set("systemPromptTemplate", v)}
          />

          {/* Append Prompt */}
          <TemplateField
            label="Append Prompt"
            useDefault={form.appendPromptUseDefault}
            template={form.appendPromptTemplate}
            onToggle={(v) => set("appendPromptUseDefault", v)}
            onTemplate={(v) => set("appendPromptTemplate", v)}
          />

          {/* Extra Context (AGENTS.md) */}
          <TemplateField
            label="Extra Context (AGENTS.md)"
            useDefault={form.contextUseDefault}
            template={form.contextTemplate}
            onToggle={(v) => set("contextUseDefault", v)}
            onTemplate={(v) => set("contextTemplate", v)}
          />

          {/* Model */}
          <label className={styles.fieldLabel}>
            Default Model *
            <select
              className={styles.select}
              value={selectedModelId}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              <option value="">-- Select model --</option>
              {Object.entries(gModels).map(([provider, providerModels]) => (
                <optgroup key={provider} label={provider}>
                  {providerModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className={styles.fieldLabel}>
            Thinking Level
            <select
              className={styles.select}
              value={form.thinkingLevel}
              onChange={(e) => set("thinkingLevel", e.target.value as any)}
            >
              {(["off", "minimal", "low", "medium", "high", "xhigh"] as const).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          {/* Tools */}
          <fieldset className={styles.checkboxGroup}>
            <legend className={styles.fieldLabel}>Tools</legend>
            <div className={styles.checkboxGrid}>
              {ALL_TOOLS.map((t) => (
                <label key={t} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.tools.includes(t)}
                    onChange={() => toggle("tools", t)}
                  />{" "}
                  {t}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Skills */}
          {skills.length > 0 && (
            <fieldset className={styles.checkboxGroup}>
              <legend className={styles.fieldLabel}>Skills ({form.skillNames.length})</legend>
              <div className={styles.checkboxGrid}>
                {skills.slice(0, 20).map((s) => (
                  <label key={s.name} className={styles.checkboxLabel} title={s.description}>
                    <input
                      type="checkbox"
                      checked={form.skillNames.includes(s.name)}
                      onChange={() => toggle("skillNames", s.name)}
                    />{" "}
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Slash Commands */}
          {templates.length > 0 && (
            <fieldset className={styles.checkboxGroup}>
              <legend className={styles.fieldLabel}>
                Slash Commands ({form.promptTemplateNames.length})
              </legend>
              <div className={styles.checkboxGrid}>
                {templates.map((t) => (
                  <label key={t.name} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={form.promptTemplateNames.includes(t.name)}
                      onChange={() => toggle("promptTemplateNames", t.name)}
                    />{" "}
                    /{t.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {error && (
            <div className={styles.errorMsg}>
              {error}
              <button type="button" className={styles.errorClose} onClick={clearError}>
                ✕
              </button>
            </div>
          )}
        </div>

        <div className={styles.formFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.defaultModel || !form.defaultProvider}
          >
            {saving ? "Saving..." : agent ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
