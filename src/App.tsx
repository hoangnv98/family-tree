import { useEffect, useState } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PersonDrawer } from './components/PersonDrawer';
import { ConfirmDialog } from './components/ConfirmDialog';
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

  const openEditor = (id: string) => {
    setSelected(id);
    setEditingId(id);
  };
  const closeEditor = () => {
    setEditingId(null);
    setSelected(null);
  };

  const deleteTarget = pendingDelete ? people.find((p) => p.id === pendingDelete) : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas dark:bg-[#1c1b16]">
      <Canvas onEdit={openEditor} />
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
    </div>
  );
}
