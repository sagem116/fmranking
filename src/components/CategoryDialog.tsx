import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import type { Category } from "@/lib/db";
import { createCategory, deleteCategory, updateCategory } from "@/lib/db";

const PALETTE = ["#7c5cff", "#00e0c6", "#ff6b9d", "#ffb547", "#5ad8a6", "#5b8ff9", "#f6a3ff"];

export function CategoryDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const addMut = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Nome obrigatório");
      await createCategory(name, newColor, categories.length);
    },
    onSuccess: () => {
      setNewName("");
      refresh();
      toast.success("Categoria criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-w-md border-[color:var(--glass-border)]">
        <DialogHeader>
          <DialogTitle className="neon-text text-2xl">Categorias</DialogTitle>
          <DialogDescription>Crie, renomeie ou elimine categorias.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--glass-border)] p-2">
              <div className="flex gap-1">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateCategory(c.id, { color }).then(refresh)}
                    className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: c.color === color ? "white" : "transparent",
                    }}
                  />
                ))}
              </div>
              <Input
                defaultValue={c.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) updateCategory(c.id, { name: v }).then(refresh);
                }}
                className="h-8 flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => deleteCategory(c.id).then(() => { refresh(); toast.success("Eliminada"); })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border border-dashed border-[color:var(--glass-border)] p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Nova categoria</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: newColor === color ? "white" : "transparent",
                  }}
                />
              ))}
            </div>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" className="h-8 flex-1" />
            <Button size="sm" variant="neon" onClick={() => addMut.mutate()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}