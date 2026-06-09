import { useEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/treeStore';
import { buildFile } from '../lib/io';
import { getSharedTreeName, fetchSharedTree } from '../lib/shareLink';
import { loadCloudTree, saveCloudTree } from '../lib/cloud';

/**
 * Drives a shared (`?tree=<id>`) editing session:
 *  - loads the tree from the cloud (falling back to the bundled static file),
 *  - unlocks editing when the cloud store is on so anyone with the link can edit,
 *  - autosaves changes back to the cloud (debounced, last-write-wins).
 * Renders only a loading / error overlay; otherwise headless. In local mode
 * (no `?tree=`) it does nothing.
 */

const SAVE_DEBOUNCE = 1000;

export function CloudSync() {
  const people = useTreeStore((s) => s.people);
  const relationships = useTreeStore((s) => s.relationships);
  const loadFile = useTreeStore((s) => s.loadFile);
  const clearAll = useTreeStore((s) => s.clearAll);
  const setReadOnly = useTreeStore((s) => s.setReadOnly);
  const setCloudSave = useTreeStore((s) => s.setCloudSave);

  const id = getSharedTreeName();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    id ? 'loading' : 'idle',
  );
  const [errorMsg, setErrorMsg] = useState('');

  // editable cloud session: gates autosave. lastSaved avoids re-saving on load.
  const liveRef = useRef(false);
  const nameRef = useRef('Cây gia phả');
  const lastSavedRef = useRef('');
  const timerRef = useRef<number | undefined>(undefined);

  // Initial load.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const cloud = await loadCloudTree(id);
      if (cancelled) return;

      if (cloud.status === 'ok') {
        nameRef.current = cloud.file.meta.name;
        loadFile(cloud.file);
        lastSavedRef.current = serialize(cloud.file.people, cloud.file.relationships);
        liveRef.current = true;
        setReadOnly(false);
        setCloudSave('idle');
        setPhase('ready');
        return;
      }

      if (cloud.status === 'empty') {
        // Cloud is on but this tree doesn't exist yet → seed from the static
        // file if one is bundled, else start blank. First edit creates it.
        const seed = await fetchSharedTree(id);
        if (cancelled) return;
        if (seed.ok) {
          nameRef.current = seed.file.meta.name;
          loadFile(seed.file);
          lastSavedRef.current = serialize(seed.file.people, seed.file.relationships);
        } else {
          clearAll();
          lastSavedRef.current = serialize([], []);
        }
        liveRef.current = true;
        setReadOnly(false);
        setCloudSave('idle');
        setPhase('ready');
        return;
      }

      // Cloud off (not provisioned) → read-only static fallback.
      if (cloud.status === 'disabled') {
        const seed = await fetchSharedTree(id);
        if (cancelled) return;
        if (seed.ok) {
          loadFile(seed.file);
          setCloudSave('off'); // stays read-only
          setPhase('ready');
        } else {
          setErrorMsg(
            'Cây chia sẻ chưa được bật lưu trữ đám mây, và không có bản tĩnh đi kèm.',
          );
          setPhase('error');
        }
        return;
      }

      setErrorMsg(cloud.error);
      setPhase('error');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Debounced autosave (only in a live cloud session).
  useEffect(() => {
    if (!id || !liveRef.current) return;
    const snapshot = serialize(people, relationships);
    if (snapshot === lastSavedRef.current) return;

    window.clearTimeout(timerRef.current);
    setCloudSave('saving');
    timerRef.current = window.setTimeout(async () => {
      const res = await saveCloudTree(id, buildFile(people, relationships, nameRef.current));
      if (res.ok) {
        lastSavedRef.current = snapshot;
        setCloudSave('saved');
        window.setTimeout(() => setCloudSave('idle'), 1500);
      } else {
        setCloudSave('error');
      }
    }, SAVE_DEBOUNCE);

    return () => window.clearTimeout(timerRef.current);
  }, [people, relationships, id, setCloudSave]);

  if (phase === 'idle' || phase === 'ready') return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-canvas/90 dark:bg-[#1c1b16]/90">
      <div className="max-w-sm rounded-lg bg-white px-6 py-4 text-center text-sm shadow-lg dark:bg-[#2a2920] dark:text-gray-100">
        {phase === 'loading' ? 'Đang tải cây gia phả…' : errorMsg}
      </div>
    </div>
  );
}

function serialize(people: unknown, relationships: unknown): string {
  return JSON.stringify({ people, relationships });
}
