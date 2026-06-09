import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User, Plus, Heart } from 'lucide-react';
import { fullName, lifespan, type Person } from '../types';

export interface PersonNodeData {
  person: Person;
  dimmed: boolean;
  readOnly?: boolean;
  /** "Dâu" / "Rể" tag for married-in spouses; null when not shown. */
  inLawRole?: 'Dâu' | 'Rể' | null;
  /** Quick-add actions shown on hover (omitted in read-only view). */
  addChild?: (id: string) => void;
  addSpouse?: (id: string) => void;
  [key: string]: unknown;
}

const genderRing: Record<Person['gender'], string> = {
  male: 'ring-male/60',
  female: 'ring-female/60',
  other: 'ring-ink/20 dark:ring-white/20',
};

const genderBar: Record<Person['gender'], string> = {
  male: 'bg-male',
  female: 'bg-female',
  other: 'bg-ink/40 dark:bg-white/40',
};

// Handles stay invisible until the card is hovered (or being connected to).
const handleCls = (color: string) =>
  `!h-2 !w-2 ${color} !opacity-0 transition-opacity group-hover:!opacity-100`;

function PersonNodeComponent({ data, selected }: NodeProps) {
  const { person, dimmed, readOnly, inLawRole, addChild, addSpouse } = data as PersonNodeData;
  const span = lifespan(person);

  return (
    <div
      className={[
        'group relative flex w-[260px] items-center gap-3 rounded-brand border bg-white/90 px-3 py-2.5 shadow-card backdrop-blur transition',
        // dark: a solid warm-grey card that clearly lifts off the near-black canvas
        'dark:bg-[#2b2a23] dark:shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
        selected
          ? 'border-accent ring-2 ring-accent/40'
          : 'border-ink/10 dark:border-white/15',
        dimmed ? 'opacity-30' : 'opacity-100',
      ].join(' ')}
    >
      {/* gender accent bar */}
      <span
        className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${genderBar[person.gender]}`}
      />

      {/* avatar */}
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-300 ring-2 ${genderRing[person.gender]} dark:bg-[#3a3930]`}
      >
        {person.photo ? (
          <img src={person.photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-5 w-5 text-ink/40 dark:text-white/40" />
        )}
      </div>

      {/* text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <div className="flex-1 break-words text-sm font-semibold text-ink dark:text-white">
            {fullName(person)}
          </div>
          {inLawRole && (
            <span
              className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                inLawRole === 'Dâu'
                  ? 'bg-female/15 text-female'
                  : 'bg-male/15 text-male'
              }`}
            >
              {inLawRole}
            </span>
          )}
        </div>
        {span && (
          <div className="text-xs text-ink/50 dark:text-white/50">{span}</div>
        )}
        {person.occupation && (
          <div className="break-words text-xs text-ink/40 dark:text-white/40">
            {person.occupation}
          </div>
        )}
      </div>

      {/* connection handles — top/bottom = parent↓child, left/right = spouse.
          Hidden until the card is hovered so deleted links don't leave stray
          dots that look like leftover connections. Omitted entirely in the
          locked (read-only) view since no links can be made. */}
      {!readOnly && (
        <>
          <Handle id="top" type="target" position={Position.Top} className={handleCls('!bg-accent/70')} />
          <Handle id="bottom" type="source" position={Position.Bottom} className={handleCls('!bg-accent/70')} />
          <Handle id="left" type="target" position={Position.Left} className={handleCls('!bg-female/70')} />
          <Handle id="right" type="source" position={Position.Right} className={handleCls('!bg-female/70')} />

          {/* quick-add: appears on hover, below the card. green + = thêm con,
              pink ♥ = thêm vợ/chồng. nodrag/stopPropagation so it doesn't drag
              or open the editor for this card. */}
          <div className="nodrag absolute -bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              title="Thêm con"
              onClick={(e) => {
                e.stopPropagation();
                addChild?.(person.id);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-float ring-2 ring-white transition hover:bg-emerald-600 dark:ring-[#2b2a23]"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              title="Thêm vợ / chồng"
              onClick={(e) => {
                e.stopPropagation();
                addSpouse?.(person.id);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-female text-white shadow-float ring-2 ring-white transition hover:brightness-95 dark:ring-[#2b2a23]"
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
