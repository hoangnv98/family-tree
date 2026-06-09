import { useCallback, useEffect, useState } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PersonDrawer } from './components/PersonDrawer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CloudSync } from './components/CloudSync';
import { useTreeStore } from './store/treeStore';
import { fullName } from './types';

export default function App() {
  const dark = useTreeStore((s) => s.dark);
  const people = useTreeStore((s) => s.people);
  const removePerson = useTreeStore((s) => s.removePerson);
  const setSelected = useTreeStore((s) => s.setSelected);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Toggle the `dark` class on <html> so Tailwind dark: variants + scrollbars apply.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Ctrl/Cmd+Z → undo the last edit. Skip when typing in a field so the browser
  // can do its own text undo there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      e.preventDefault();
      useTreeStore.getState().undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openEditor = useCallback(
    (id: string) => {
      setSelected(id);
      setEditingId(id);
    },
    [setSelected],
  );
  const closeEditor = () => {
    setEditingId(null);
    setSelected(null);
  };

  const deleteTarget = pendingDelete ? people.find((p) => p.id === pendingDelete) : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas dark:bg-[#14130d]">
      <Canvas onEdit={openEditor} onRequestDelete={setPendingDelete} />
      <Toolbar onEdit={openEditor} />

      <PersonDrawer
        personId={editingId}
        onClose={closeEditor}
        onRequestDelete={(id) => setPendingDelete(id)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xoá thành viên?"
        message={
          deleteTarget
            ? `Xoá "${fullName(deleteTarget)}" và mọi quan hệ liên quan. Không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xoá"
        onConfirm={() => {
          if (pendingDelete) {
            removePerson(pendingDelete);
            if (editingId === pendingDelete) closeEditor();
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <CloudSync />
    </div>
  );
}
