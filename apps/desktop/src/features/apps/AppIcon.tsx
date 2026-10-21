import { useAppIcon } from "../../services/appIcons";
import { monogramTone } from "./model";

export function AppIcon({
  path,
  name,
  window,
  size,
}: {
  path: string | null;
  name: string;
  window?: number;
  size: number;
}) {
  const icon = useAppIcon(path, window);
  if (icon) {
    return <img className="app-icon" src={icon} alt="" width={size} height={size} draggable={false} />;
  }
  return (
    <span
      className={`app-icon app-monogram tone-${monogramTone(name)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
