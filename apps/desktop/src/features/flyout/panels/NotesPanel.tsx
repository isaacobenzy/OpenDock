import { useState } from "react";
import { createNote, deleteNote, errorText, pinNote, updateNote, type Note } from "../../../services/ipc";
import { useLive, useNow } from "../../../services/liveContext";
import { formatAgo } from "../../widgets/format";
import { PanelState } from "../../widgets/visuals";
import { IconButton, PanelHeader } from "./PanelHeader";

function NoteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (body: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="note-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(body).catch((err) => setError(errorText(err)));
      }}
    >
      <textarea
        className="text-area"
        aria-label="Note"
        value={body}
        rows={4}
        maxLength={10_000}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="button-row is-end">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button is-primary" disabled={!body.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

function NoteCard({ note, now }: { note: Note; now: number }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="note-card">
        <NoteEditor
          initial={note.body}
          onCancel={() => setEditing(false)}
          onSave={(body) => updateNote(note.id, body).then(() => setEditing(false))}
        />
      </li>
    );
  }
  return (
    <li className={`note-card ${note.pinned ? "is-pinned" : ""}`}>
      <button type="button" className="note-body" onClick={() => setEditing(true)}>
        {note.body}
      </button>
      <div className="note-footer">
        <span className="muted">{formatAgo(note.updatedAt, now)}</span>
        <IconButton
          icon="pin"
          label={note.pinned ? "Unpin" : "Pin"}
          tone={note.pinned ? "accent" : undefined}
          onClick={() => void pinNote(note.id, !note.pinned)}
          size={14}
        />
        <IconButton icon="trash" label="Delete note" onClick={() => void deleteNote(note.id)} size={14} />
      </div>
    </li>
  );
}

export function NotesPanel() {
  const { notes } = useLive();
  const now = useNow(60_000);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PanelHeader
        icon="note"
        title="Notes"
        subtitle="Ctrl+Enter saves"
        actions={<IconButton icon="plus" label="New note" onClick={() => setCreating(true)} />}
      />
      {creating ? (
        <NoteEditor
          initial=""
          onCancel={() => setCreating(false)}
          onSave={(body) => createNote(body).then(() => setCreating(false))}
        />
      ) : null}
      {notes.status === "loading" ? (
        <PanelState kind="loading" title="Loading notes" />
      ) : notes.status === "error" ? (
        <PanelState kind="error" title="Couldn't load notes" detail={notes.error} />
      ) : notes.data.length === 0 && !creating ? (
        <PanelState
          kind="empty"
          title="No notes yet"
          detail="Jot something down. Notes stay on this device."
          action={
            <button type="button" className="button is-primary" onClick={() => setCreating(true)}>
              New note
            </button>
          }
        />
      ) : (
        <ul className="note-list">
          {notes.data.map((note) => (
            <NoteCard key={note.id} note={note} now={now} />
          ))}
        </ul>
      )}
    </>
  );
}
