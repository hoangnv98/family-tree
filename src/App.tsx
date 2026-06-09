import { useEffect, useState } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PersonDrawer } from './components/PersonDrawer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useTreeStore } from './store/treeStore';
import { fetchSharedTree, getSharedTreeName } from './lib/shareLink';
import { fullName } from './types';

export default function App() {
  const dark = useTreeStore((s) => s.dark);
  const people = useTreeStore((s) => s.people);
  const removePerson = useTreeStore((s) => s.removePerson);
  const setSelected = useTreeStore((s) => s.setSelected);
  const loadFile = useTreeStore((s) => s.loadFile);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // `?tree=<name>` deep-link: 'loading' until the shared file resolves.
  const [shareState, setShareState] = useState<'idle' | 'loading' | string>(
    getSharedTreeName() ? 'loading' : 'idle',
  );

  // Toggle the `dark` class on <html> so Tailwind dark: variants + scrollbars apply.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // When opened with `?tree=<name>`, replace the draft with that shared tree.
  useEffect(() => {
    const name = getSharedTreeName();
    if (!name) return;
    let cancelled = false;
    fetchSharedTree(name).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        loadFile(result.file);
        setShareState('idle');
      } else {
        setShareState(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadFile]);

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

      {shareState !== 'idle' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-canvas/90 dark:bg-[#1c1b16]/90">
          <div className="rounded-lg bg-white px-6 py-4 text-center text-sm shadow-lg dark:bg-[#2a2920] dark:text-gray-100">
            {shareState === 'loading'
              ? 'Đang tải cây gia phả…'
              : shareState}
          </div>
        </div>
      )}
    </div>
  );
}
