import { useState } from "react";
import {
  addTodo,
  clearDoneTodos,
  deleteTodo,
  errorText,
  renameTodo,
  setTodoDone,
  type Todo,
} from "../../../services/ipc";
import { useLive } from "../../../services/liveContext";
import { Icon } from "../../widgets/icons";
import { PanelState } from "../../widgets/visuals";
import { IconButton, PanelHeader } from "./PanelHeader";

function TodoRow({ todo, onError }: { todo: Todo; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const run = (action: Promise<unknown>) => void action.catch((e) => onError(errorText(e)));

  return (
    <li className={`todo-row ${todo.done ? "is-done" : ""}`}>
      <button
        type="button"
        className="todo-check"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? `Mark ${todo.title} as not done` : `Mark ${todo.title} as done`}
        onClick={() => run(setTodoDone(todo.id, !todo.done))}
      >
        {todo.done ? <Icon name="check" size={14} /> : null}
      </button>
      {editing ? (
        <input
          className="inline-input"
          value={title}
          aria-label="Todo title"
          maxLength={200}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (title.trim() && title !== todo.title) run(renameTodo(todo.id, title));
            else setTitle(todo.title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setTitle(todo.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" className="todo-title" onClick={() => setEditing(true)}>
          {todo.title}
        </button>
      )}
      <IconButton icon="trash" label={`Delete ${todo.title}`} onClick={() => run(deleteTodo(todo.id))} size={14} />
    </li>
  );
}

export function TodosPanel() {
  const { todos } = useLive();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setError(null);
    addTodo(title)
      .then(() => setDraft(""))
      .catch((e) => setError(errorText(e)));
  };

  const list = todos.status === "ready" ? todos.data : [];
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done);

  return (
    <>
      <PanelHeader
        icon="todo"
        title="Todos"
        subtitle={todos.status === "ready" ? `${open.length} open` : undefined}
        actions={
          done.length > 0 ? (
            <button type="button" className="text-button" onClick={() => void clearDoneTodos()}>
              Clear done
            </button>
          ) : undefined
        }
      />
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="text-input"
          placeholder="Add a todo"
          aria-label="New todo"
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="button is-primary" disabled={!draft.trim()}>
          Add
        </button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {todos.status === "loading" ? (
        <PanelState kind="loading" title="Loading todos" />
      ) : todos.status === "error" ? (
        <PanelState kind="error" title="Couldn't load todos" detail={todos.error} />
      ) : list.length === 0 ? (
        <PanelState kind="empty" title="Nothing to do" detail="Todos stay on this device." />
      ) : (
        <ul className="todo-list">
          {[...open, ...done].map((todo) => (
            <TodoRow key={todo.id} todo={todo} onError={setError} />
          ))}
        </ul>
      )}
    </>
  );
}
