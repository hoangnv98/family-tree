import { useRef, useState } from 'react';
import {
  UserPlus,
  Download,
  ImageDown,
  Upload,
  LayoutGrid,
  Search,
  Moon,
  Sun,
  Trees,
  MoreHorizontal,
  RotateCcw,
  Eraser,
  X,
  Lock,
  Tags,
  Share2,
  Cloud,
  CloudOff,
  Check,
  Loader2,
} from 'lucide-react';
import { useTreeStore } from '../store/treeStore';
import { buildFile, downloadJson, readFile } from '../lib/io';
import { getSharedTreeName } from '../lib/shareLink';
import { newTreeId, saveCloudTree, loadCloudTree, slugifyTreeId } from '../lib/cloud';

function IconButton({
  onClick,
  title,
  children,
  active,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-ink/70 transition hover:bg-surface-300 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white ${
        active ? 'bg-surface-300 text-ink dark:bg-white/10 dark:text-white' : ''
      }`}
    >
      {children}
    </button>
  );
}

export function Toolbar({ onEdit }: { onEdit: (id: string) => void }) {
  const people = useTreeStore((s) => s.people);
  const relationships = useTreeStore((s) => s.relationships);
  const search = useTreeStore((s) => s.search);
  const dark = useTreeStore((s) => s.dark);
  const setSearch = useTreeStore((s) => s.setSearch);
  const toggleDark = useTreeStore((s) => s.toggleDark);
  const showInLaw = useTreeStore((s) => s.showInLaw);
  const toggleInLaw = useTreeStore((s) => s.toggleInLaw);
  const cloudSave = useTreeStore((s) => s.cloudSave);
  const positions = useTreeStore((s) => s.positions);

  const isShared = getSharedTreeName() !== null;
  const requestLayout = useTreeStore((s) => s.requestLayout);
  const requestPng = useTreeStore((s) => s.requestPng);
  const addPerson = useTreeStore((s) => s.addPerson);
  const loadFile = useTreeStore((s) => s.loadFile);
  const resetToSample = useTreeStore((s) => s.resetToSample);
  const clearAll = useTreeStore((s) => s.clearAll);
  const readOnly = useTreeStore((s) => s.readOnly);

  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const flash = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3500);
  };

  const onExport = () => {
    downloadJson(buildFile(people, relationships, 'Cây gia phả', positions));
    flash('ok', 'Đã xuất file JSON.');
  };

  // Publish the current draft as a shared cloud tree, then open its link.
  const onShareToCloud = async () => {
    flash('ok', 'Đang tạo cây chia sẻ…');
    const id = newTreeId();
    const res = await saveCloudTree(
      id,
      buildFile(people, relationships, 'Cây gia phả', positions),
    );
    if (res.ok) {
      window.location.search = `?tree=${id}`; // reload into cloud-edit mode
    } else if (res.disabled) {
      flash('err', 'Chưa bật lưu trữ đám mây trên Vercel. Xem hướng dẫn để bật.');
    } else {
      flash('err', res.error);
    }
  };

  const cloudPill = {
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'Đang lưu…' },
    saved: { icon: <Check className="h-3.5 w-3.5" />, text: 'Đã lưu' },
    idle: { icon: <Cloud className="h-3.5 w-3.5" />, text: 'Đồng bộ' },
    error: { icon: <CloudOff className="h-3.5 w-3.5" />, text: 'Lỗi lưu' },
    off: null,
  }[cloudSave];

  const onImportPick = async (file?: File) => {
    if (!file) return;
    const reset = () => {
      if (fileRef.current) fileRef.current.value = '';
    };
    const result = await readFile(file);
    if (!result.ok) {
      flash('err', result.error);
      reset();
      return;
    }

    // Import becomes a shared cloud tree at id = slug(filename), then redirects
    // to its link. Falls back to a plain local import when the cloud is off.
    const id = slugifyTreeId(file.name) || newTreeId();
    const existing = await loadCloudTree(id);

    if (existing.status === 'disabled' || existing.status === 'error') {
      loadFile(result.file);
      requestLayout();
      flash('ok', `Đã nhập ${result.file.people.length} thành viên (cloud chưa bật — chỉ ở máy này).`);
      reset();
      return;
    }
    if (
      existing.status === 'ok' &&
      !window.confirm(`Cây "${id}" đã có trên cloud. Ghi đè bằng file vừa chọn?`)
    ) {
      reset();
      return;
    }

    flash('ok', 'Đang tải lên cloud…');
    const save = await saveCloudTree(id, result.file);
    if (save.ok) {
      window.location.search = `?tree=${id}`; // reload into the shared tree
    } else {
      flash('err', save.error);
      reset();
    }
  };

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-4">
        <div className="pointer-events-auto flex w-full max-w-4xl items-center gap-2 rounded-brand border border-ink/10 bg-canvas/80 px-3 py-2 shadow-float backdrop-blur-md dark:border-white/10 dark:bg-[#1b1a14]/85">
          {/* brand */}
          <div className="flex items-center gap-2 pl-1 pr-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
              <Trees className="h-5 w-5" />
            </span>
            <span className="hidden text-sm font-semibold text-ink dark:text-white sm:block">
              Cây Gia Phả
            </span>
          </div>

          {cloudPill && (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                cloudSave === 'error'
                  ? 'bg-crimson/10 text-crimson'
                  : 'bg-surface-200 text-ink/60 dark:bg-[#2b2a23] dark:text-white/60'
              }`}
              title="Tự lưu lên cloud — ai có link cũng sửa được"
            >
              {cloudPill.icon}
              <span className="hidden sm:block">{cloudPill.text}</span>
            </span>
          )}

          <div className="mx-1 h-6 w-px bg-ink/10 dark:bg-white/10" />

          {/* primary add — a "view-only" badge when locked (cloud store is off) */}
          {readOnly ? (
            <span
              className="flex items-center gap-1.5 rounded-lg bg-surface-200 px-3 py-2 text-sm font-medium text-ink/60 dark:bg-[#2b2a23] dark:text-white/60"
              title="Cây chia sẻ ở chế độ chỉ xem (chưa bật lưu trữ đám mây)"
            >
              <Lock className="h-4 w-4" />
              <span className="hidden sm:block">Chỉ xem</span>
            </span>
          ) : (
            <button
              onClick={() => onEdit(addPerson({ firstName: 'Thành viên mới' }))}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:block">Thêm</span>
            </button>
          )}

          {/* search */}
          <div className="relative ml-1 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40 dark:text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, nghề, nơi sinh…"
              className="w-full rounded-lg border border-ink/10 bg-surface-100 py-2 pl-8 pr-7 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-[#2b2a23] dark:text-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink dark:text-white/40"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mx-1 h-6 w-px bg-ink/10 dark:bg-white/10" />

          <IconButton onClick={requestLayout} title="Sắp xếp tự động">
            <LayoutGrid className="h-5 w-5" />
          </IconButton>
          {!readOnly && (
            <IconButton
              onClick={() => fileRef.current?.click()}
              title="Nhập JSON (tạo cây chia sẻ theo tên file)"
            >
              <Upload className="h-5 w-5" />
            </IconButton>
          )}
          <IconButton onClick={onExport} title="Xuất JSON">
            <Download className="h-5 w-5" />
          </IconButton>
          {!isShared && !readOnly && (
            <IconButton onClick={onShareToCloud} title="Chia sẻ lên cloud (ai có link cũng sửa)">
              <Share2 className="h-5 w-5" />
            </IconButton>
          )}
          <IconButton
            onClick={() => {
              requestPng();
              flash('ok', 'Đang tạo ảnh PNG…');
            }}
            title="Xuất ảnh PNG"
          >
            <ImageDown className="h-5 w-5" />
          </IconButton>
          <IconButton
            onClick={toggleInLaw}
            active={showInLaw}
            title={showInLaw ? 'Ẩn nhãn Dâu / Rể' : 'Hiện nhãn Dâu / Rể'}
          >
            <Tags className="h-5 w-5" />
          </IconButton>
          <IconButton onClick={toggleDark} title={dark ? 'Chế độ sáng' : 'Chế độ tối'}>
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </IconButton>

          {/* overflow menu — destructive actions, hidden in locked view */}
          {!readOnly && (
          <div className="relative">
            <IconButton onClick={() => setMenu((v) => !v)} title="Thêm" active={menu}>
              <MoreHorizontal className="h-5 w-5" />
            </IconButton>
            {menu && (
              <>
                <div className="fixed inset-0 z-0" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-11 z-10 w-60 overflow-hidden rounded-brand border border-ink/10 bg-canvas py-1 shadow-float dark:border-white/10 dark:bg-[#1b1a14]">
                  <button
                    onClick={() => {
                      requestLayout();
                      setMenu(false);
                      flash('ok', 'Đã căn lại sơ đồ về hàng ngay ngắn.');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink/80 hover:bg-surface-300 dark:text-white/80 dark:hover:bg-white/10"
                  >
                    <LayoutGrid className="h-4 w-4" /> Căn lại sơ đồ (hàng đẹp)
                  </button>
                  <div className="my-1 h-px bg-ink/10 dark:bg-white/10" />
                  <button
                    onClick={() => {
                      resetToSample();
                      requestLayout();
                      setMenu(false);
                      flash('ok', 'Đã nạp lại dữ liệu mẫu.');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink/80 hover:bg-surface-300 dark:text-white/80 dark:hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4" /> Nạp lại dữ liệu mẫu
                  </button>
                  <button
                    onClick={() => {
                      clearAll();
                      setMenu(false);
                      flash('ok', 'Đã xoá toàn bộ. Bắt đầu cây mới.');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-crimson hover:bg-crimson/10"
                  >
                    <Eraser className="h-4 w-4" /> Xoá hết, làm cây mới
                  </button>
                </div>
              </>
            )}
          </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onImportPick(e.target.files?.[0])}
          />
        </div>
      </header>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-40 flex justify-center px-4">
          <div
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-float ${
              toast.kind === 'ok' ? 'bg-ink' : 'bg-crimson'
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </>
  );
}
