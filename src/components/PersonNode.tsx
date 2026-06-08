import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User } from 'lucide-react';
import { fullName, lifespan, type Person } from '../types';

export interface PersonNodeData {
  person: Person;
  dimmed: boolean;
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

function PersonNodeComponent({ data, selected }: NodeProps) {
  const { person, dimmed } = data as PersonNodeData;
  const span = lifespan(person);

  return (
    <div
      className={[
        'group relative flex w-[210px] items-center gap-3 rounded-brand border bg-white/90 px-3 py-2.5 shadow-card backdrop-blur transition',
        'dark:bg-surface-500/90 dark:border-white/10',
        selected ? 'border-accent ring-2 ring-accent/40' : 'border-ink/10',
        dimmed ? 'opacity-30' : 'opacity-100',
      ].join(' ')}
    >
      {/* gender accent bar */}
      <span
        className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${genderBar[person.gender]}`}
      />

      {/* avatar */}
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-300 ring-2 ${genderRing[person.gender]} dark:bg-surface-400`}
      >
        {person.photo ? (
          <img src={person.photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-5 w-5 text-ink/40 dark:text-white/40" />
        )}
      </div>

      {/* text */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink dark:text-white">
          {fullName(person)}
        </div>
        {span && (
          <div className="text-xs text-ink/50 dark:text-white/50">{span}</div>
        )}
        {person.occupation && (
          <div className="truncate text-xs text-ink/40 dark:text-white/40">
            {person.occupation}
          </div>
        )}
      </div>

      {/* connection handles — top/bottom = parent↓child, left/right = spouse */}
      <Handle id="top" type="target" position={Position.Top} className="!h-2 !w-2 !bg-accent/70" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-accent/70" />
      <Handle id="left" type="target" position={Position.Left} className="!h-2 !w-2 !bg-female/70" />
      <Handle id="right" type="source" position={Position.Right} className="!h-2 !w-2 !bg-female/70" />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
