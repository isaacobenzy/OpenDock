import type { DockStyle } from "@opendock/config-schema";
import { DOCK_STYLES } from "./styles";
import "./style-picker.css";

export function StylePicker({
  value,
  onChange,
  compact = false,
}: {
  value: DockStyle;
  onChange: (style: DockStyle) => void;
  compact?: boolean;
}) {
  return (
    <div className={`style-swatches ${compact ? "is-compact" : ""}`} role="radiogroup" aria-label="Style">
      {DOCK_STYLES.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.description}
          className={`style-swatch style-${option.value} ${value === option.value ? "is-active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          <span className="style-swatch-art" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
