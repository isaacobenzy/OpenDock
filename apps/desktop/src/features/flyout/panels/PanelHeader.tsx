import type { ReactNode } from "react";
import { Icon, type IconName } from "../../widgets/icons";

export function PanelHeader({
  icon,
  leading,
  title,
  subtitle,
  actions,
}: {
  icon: IconName;
  /** Replaces the icon, e.g. with an app's own icon. */
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="panel-header">
      <span className={`panel-header-icon ${leading ? "is-custom" : ""}`}>
        {leading ?? <Icon name={icon} size={16} />}
      </span>
      <div className="panel-header-text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="panel-header-actions">{actions}</div> : null}
    </header>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  tone,
  disabled,
  size = 16,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: "accent" | "danger";
  disabled?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${tone ? `tone-${tone}` : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
