import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronUp, ChevronDown, RotateCcw, MoveRight } from "lucide-react";
import {
  type SidebarPrefs,
  DEFAULT_PREFS,
  reorder,
  DEBUG_GROUP,
} from "@/lib/sidebar-prefs";
import { cn } from "@/lib/utils";

export interface NavItemDef {
  to: string;
  label: string;
}
export interface NavGroupDef {
  title: string;
  items: NavItemDef[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: NavGroupDef[];
  debugItems: NavItemDef[];
  prefs: SidebarPrefs;
  onChange: (p: SidebarPrefs) => void;
}

export function SidebarCustomizeDialog({
  open,
  onOpenChange,
  groups,
  debugItems,
  prefs,
  onChange,
}: Props) {
  const [draft, setDraft] = useState<SidebarPrefs>(prefs);

  // Reset draft when opening
  const handleOpen = (v: boolean) => {
    if (v) setDraft(prefs);
    onOpenChange(v);
  };

  const groupOrder =
    draft.groupOrder && draft.groupOrder.length
      ? [
          ...draft.groupOrder.filter((t) => groups.some((g) => g.title === t)),
          ...groups.map((g) => g.title).filter((t) => !draft.groupOrder!.includes(t)),
        ]
      : groups.map((g) => g.title);

  const moveGroup = (idx: number, dir: -1 | 1) => {
    const next = reorder(groupOrder, idx, idx + dir);
    setDraft({ ...draft, groupOrder: next });
  };

  const toggleGroupHidden = (title: string) => {
    const g = draft.groups[title] || {};
    setDraft({
      ...draft,
      groups: { ...draft.groups, [title]: { ...g, hidden: !g.hidden } },
    });
  };

  const setGroup = (title: string, patch: Partial<SidebarPrefs["groups"][string]>) => {
    const g = draft.groups[title] || {};
    setDraft({
      ...draft,
      groups: { ...draft.groups, [title]: { ...g, ...patch } },
    });
  };

  const itemOrderFor = (group: NavGroupDef): NavItemDef[] => {
    const gPrefs = draft.groups[group.title];
    const ord = gPrefs?.order ?? [];
    const byTo = new Map(group.items.map((i) => [i.to, i]));
    const ordered: NavItemDef[] = [];
    for (const to of ord) {
      const it = byTo.get(to);
      if (it) ordered.push(it);
    }
    for (const it of group.items) {
      if (!ord.includes(it.to)) ordered.push(it);
    }
    return ordered;
  };

  const moveItem = (group: NavGroupDef, idx: number, dir: -1 | 1) => {
    const items = itemOrderFor(group);
    const next = reorder(items, idx, idx + dir).map((i) => i.to);
    setGroup(group.title, { order: next });
  };

  const toggleItemHidden = (group: NavGroupDef, to: string) => {
    const g = draft.groups[group.title] || {};
    const hidden = new Set(g.hiddenItems ?? []);
    if (hidden.has(to)) hidden.delete(to);
    else hidden.add(to);
    setGroup(group.title, { hiddenItems: Array.from(hidden) });
  };

  const handleSave = () => {
    onChange(draft);
    onOpenChange(false);
  };

  const handleReset = () => setDraft(DEFAULT_PREFS);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Personalizar Sidebar</DialogTitle>
          <DialogDescription>
            Mostre/oculte, reordene grupos e itens. As escolhas são guardadas no navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {groupOrder.map((title, gIdx) => {
            const group = groups.find((g) => g.title === title);
            if (!group) return null;
            const gPrefs = draft.groups[title] || {};
            const items = itemOrderFor(group);
            return (
              <div key={title} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    checked={!gPrefs.hidden}
                    onCheckedChange={() => toggleGroupHidden(title)}
                  />
                  <span className={cn("text-sm font-semibold flex-1", gPrefs.hidden && "opacity-50 line-through")}>
                    {title}
                  </span>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => moveGroup(gIdx, -1)} disabled={gIdx === 0}>
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => moveGroup(gIdx, 1)} disabled={gIdx === groupOrder.length - 1}>
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
                <div className="pl-6 space-y-1">
                  {items.map((it, iIdx) => {
                    const hidden = (gPrefs.hiddenItems ?? []).includes(it.to);
                    return (
                      <div key={it.to} className="flex items-center gap-2">
                        <Checkbox
                          checked={!hidden}
                          onCheckedChange={() => toggleItemHidden(group, it.to)}
                        />
                        <span className={cn("text-sm flex-1", hidden && "opacity-50 line-through")}>{it.label}</span>
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => moveItem(group, iIdx, -1)} disabled={iIdx === 0}>
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => moveItem(group, iIdx, 1)} disabled={iIdx === items.length - 1}>
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Debug */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={!draft.debugHidden}
                onCheckedChange={() => setDraft({ ...draft, debugHidden: !draft.debugHidden })}
              />
              <span className={cn("text-sm font-semibold flex-1", draft.debugHidden && "opacity-50 line-through")}>Debug</span>
            </div>
            <div className="pl-6 space-y-1">
              {(() => {
                const ord = draft.debugItemsOrder ?? [];
                const byTo = new Map(debugItems.map((i) => [i.to, i]));
                const ordered: NavItemDef[] = [];
                for (const to of ord) {
                  const it = byTo.get(to);
                  if (it) ordered.push(it);
                }
                for (const it of debugItems) if (!ord.includes(it.to)) ordered.push(it);
                return ordered.map((it, iIdx) => {
                  const hidden = (draft.debugItemsHidden ?? []).includes(it.to);
                  return (
                    <div key={it.to} className="flex items-center gap-2">
                      <Checkbox
                        checked={!hidden}
                        onCheckedChange={() => {
                          const set = new Set(draft.debugItemsHidden ?? []);
                          if (set.has(it.to)) set.delete(it.to);
                          else set.add(it.to);
                          setDraft({ ...draft, debugItemsHidden: Array.from(set) });
                        }}
                      />
                      <span className={cn("text-sm flex-1", hidden && "opacity-50 line-through")}>{it.label}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        disabled={iIdx === 0}
                        onClick={() => {
                          const next = reorder(ordered, iIdx, iIdx - 1).map((i) => i.to);
                          setDraft({ ...draft, debugItemsOrder: next });
                        }}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        disabled={iIdx === ordered.length - 1}
                        onClick={() => {
                          const next = reorder(ordered, iIdx, iIdx + 1).map((i) => i.to);
                          setDraft({ ...draft, debugItemsOrder: next });
                        }}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="ghost" onClick={handleReset} className="gap-2">
            <RotateCcw className="size-4" /> Repor
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
