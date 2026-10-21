// Loaded as a blocking script in <head> so a saved theme applies before the first paint.
// The CSP only allows same-origin scripts, which is why this is a file and not inline.
(() => {
  const key = "opendock-theme";
  const choices = ["system", "light", "dark"];
  const labels = { system: "System", light: "Light", dark: "Dark" };
  const root = document.documentElement;

  const read = () => {
    try {
      const saved = localStorage.getItem(key);
      return choices.includes(saved) ? saved : "system";
    } catch {
      return "system";
    }
  };

  const save = (choice) => {
    try {
      if (choice === "system") localStorage.removeItem(key);
      else localStorage.setItem(key, choice);
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  };

  const apply = (choice) => {
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
  };

  apply(read());

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;

    const render = (choice) => {
      const next = choices[(choices.indexOf(choice) + 1) % choices.length];
      button.dataset.choice = choice;
      button.setAttribute("aria-label", `Theme: ${labels[choice]}. Switch to ${labels[next]}`);
      button.title = `Theme: ${labels[choice]}`;
    };

    render(read());
    button.hidden = false;
    button.addEventListener("click", () => {
      const current = button.dataset.choice ?? "system";
      const next = choices[(choices.indexOf(current) + 1) % choices.length];
      save(next);
      apply(next);
      render(next);
    });
  });
})();
