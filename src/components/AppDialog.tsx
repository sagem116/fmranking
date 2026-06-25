import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload } from "lucide-react";
import type { App, Category } from "@/lib/db";
import { upsertApp } from "@/lib/db";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  app: App | null;
  categories: Category[];
};

const empty = {
  name: "",
  description: "",
  url: "",
  username: "",
  password: "",
  icon_url: "",
  category_id: "",
  is_favorite: false,
};

export function AppDialog({ open, onOpenChange, app, categories }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (app) {
      setForm({
        name: app.name,
        description: app.description ?? "",
        url: app.url,
        username: app.username ?? "",
        password: app.password ?? "",
        icon_url: app.icon_url ?? "",
        category_id: app.category_id ?? "",
        is_favorite: app.is_favorite,
      });
    } else {
      setForm(empty);
    }
  }, [app, open]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.url.trim()) {
        throw new Error("Nome e URL são obrigatórios");
      }
      let url = form.url.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      await upsertApp({
        id: app?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        url,
        username: form.username.trim() || null,
        password: form.password || null,
        icon_url: form.icon_url || null,
        category_id: form.category_id || null,
        is_favorite: form.is_favorite,
      } as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apps"] });
      toast.success(app ? "Aplicação atualizada" : "Aplicação adicionada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onIconUpload = (file: File) => {
    if (file.size > 500_000) {
      toast.error("Ícone demasiado grande (máx 500KB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, icon_url: reader.result as string }));
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-w-lg border-[color:var(--glass-border)]">
        <DialogHeader>
          <DialogTitle className="neon-text text-2xl">
            {app ? "Editar aplicação" : "Nova aplicação"}
          </DialogTitle>
          <DialogDescription>Guarde acesso rápido às suas apps preferidas.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            {form.icon_url ? (
              <img src={form.icon_url} alt="" className="h-14 w-14 rounded-xl border border-[color:var(--glass-border)] object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[image:var(--gradient-neon)] text-xl font-bold text-primary-foreground">
                {form.name.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onIconUpload(e.target.files[0])}
              />
              <span className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" /> Carregar ícone
              </span>
            </label>
            {form.icon_url && (
              <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, icon_url: "" }))}>
                Remover
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Notion" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={form.category_id || "__none"}
                onValueChange={(v) => setForm({ ...form, category_id: v === "__none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>URL *</Label>
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://app.notion.so" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Notas e documentação pessoal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Login / Utilizador</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[color:var(--glass-border)] p-3">
            <div>
              <p className="text-sm font-medium">Favorito</p>
              <p className="text-xs text-muted-foreground">Aparece no topo do dashboard</p>
            </div>
            <Switch
              checked={form.is_favorite}
              onCheckedChange={(v) => setForm({ ...form, is_favorite: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="neon" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}