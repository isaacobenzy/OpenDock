import { ruleRecipes, type Rule } from "@opendock/config-schema";
import { useCallback, useEffect, useState } from "react";
import {
  deleteRule,
  errorText,
  listRecipes,
  listRules,
  on,
  saveRule,
  setRuleEnabled,
} from "../../../services/ipc";
import { useSettings } from "../../../services/settingsContext";
import { Icon } from "../../widgets/icons";
import { PanelState } from "../../widgets/visuals";
import { PageHeader } from "../PageHeader";
import { RuleEditor } from "./RuleEditor";
import { blankRule, copyRecipe, describeRule } from "./ruleModel";

type Selection = { kind: "existing"; id: string } | { kind: "new"; rule: Rule } | null;

export function StudioPage() {
  const { settings, update } = useSettings();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [recipes, setRecipes] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  const reload = useCallback(() => {
    listRules()
      .then((list) => {
        setRules(list);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    reload();
    listRecipes()
      .then(setRecipes)
      .catch(() => setRecipes(ruleRecipes));
    return on("data:changed", (topic) => topic === "rules" && reload());
  }, [reload]);

  const ids = rules?.map((r) => r.id) ?? [];
  const selected =
    selection?.kind === "existing" ? rules?.find((r) => r.id === selection.id) : selection?.rule;
  const unusedRecipes = recipes.filter((recipe) => !rules?.some((r) => r.name === recipe.name));

  const onSave = async (rule: Rule) => {
    try {
      const saved = await saveRule(rule);
      setSelection({ kind: "existing", id: saved.id });
      reload();
      return null;
    } catch (e) {
      return errorText(e);
    }
  };

  const onDelete = () => {
    if (selection?.kind === "existing") {
      void deleteRule(selection.id)
        .then(reload)
        .catch((e) => setError(errorText(e)));
    }
    setSelection(null);
  };

  return (
    <div className="page studio-page">
      <PageHeader
        title="Automation Studio"
        subtitle="When something happens, do something — unless it's a bad time."
        actions={
          <>
            <label className="switch">
              <input
                type="checkbox"
                role="switch"
                checked={settings.automation.enabled}
                onChange={(e) =>
                  void update((s) => ({ ...s, automation: { ...s.automation, enabled: e.target.checked } }))
                }
              />
              <span className="switch-track" aria-hidden />
              <span>{settings.automation.enabled ? "Automations on" : "Automations paused"}</span>
            </label>
            <button type="button" className="button is-primary" onClick={() => setSelection({ kind: "new", rule: blankRule(ids) })}>
              <Icon name="plus" size={14} /> New rule
            </button>
          </>
        }
      />
      <p className="local-strip">
        <Icon name="lock" size={14} /> Rules run on this device. Nothing is sent anywhere, and every run is logged with
        Undo where possible.
      </p>

      <div className="studio-layout">
        <aside className="rule-column">
          {error ? <PanelState kind="error" title="Couldn't load rules" detail={error} /> : null}
          {rules === null && !error ? <PanelState kind="loading" title="Loading rules" /> : null}
          {rules && rules.length === 0 ? (
            <PanelState kind="empty" title="No rules yet" detail="Start from a recipe below or make your own." />
          ) : null}
          <ul className="rule-list">
            {rules?.map((rule) => (
              <li key={rule.id}>
                <div
                  className={`rule-item ${selection?.kind === "existing" && selection.id === rule.id ? "is-selected" : ""} ${rule.enabled ? "" : "is-off"}`}
                >
                  <button
                    type="button"
                    className="rule-item-main"
                    onClick={() => setSelection({ kind: "existing", id: rule.id })}
                  >
                    <span className="rule-name">{rule.name}</span>
                    <span className="rule-summary">{describeRule(rule)}</span>
                  </button>
                  <label className="switch is-small" title={rule.enabled ? "Turn off" : "Turn on"}>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`${rule.name} enabled`}
                      checked={rule.enabled}
                      onChange={(e) =>
                        void setRuleEnabled(rule.id, e.target.checked)
                          .then(reload)
                          .catch((err) => setError(errorText(err)))
                      }
                    />
                    <span className="switch-track" aria-hidden />
                  </label>
                </div>
              </li>
            ))}
          </ul>

          {unusedRecipes.length > 0 ? (
            <section className="recipe-section">
              <h2>Recipes</h2>
              <ul className="recipe-list">
                {unusedRecipes.map((recipe) => (
                  <li key={recipe.id} className="recipe-card">
                    <div>
                      <p className="rule-name">{recipe.name}</p>
                      <p className="rule-summary">{describeRule(recipe)}</p>
                    </div>
                    <button
                      type="button"
                      className="button is-small"
                      onClick={() => setSelection({ kind: "new", rule: copyRecipe(recipe, ids) })}
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        <section className="editor-column">
          {selected ? (
            <RuleEditor
              key={selection?.kind === "existing" ? selected.id : `new-${selected.id}`}
              rule={selected}
              isNew={selection?.kind === "new"}
              onSave={onSave}
              onDelete={onDelete}
            />
          ) : (
            <PanelState
              kind="empty"
              title="Pick a rule to edit"
              detail="Or make a new one. Each rule has a trigger, one or more actions, and optional exceptions."
            />
          )}
        </section>
      </div>
    </div>
  );
}
