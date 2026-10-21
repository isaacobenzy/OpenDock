type Props = {
  onClick: () => void;
};

export function AddWidgetButton({ onClick }: Props) {
  return (
    <button
      type="button"
      className="dock-item add-widget-button"
      onClick={onClick}
      aria-label="Add widget (coming soon)"
      title="Widget gallery arrives in Milestone 3"
    >
      +
    </button>
  );
}
