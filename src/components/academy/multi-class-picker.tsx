import { useMemo, useState } from "react";

type ClassOption = {
  id: string;
  name: string;
  level?: string | null;
  reference?: string | null;
};

type Props = {
  classes: ClassOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function MultiClassPicker({ classes, selectedIds, onChange, disabled }: Props) {
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => {
      const hay = `${c.reference ?? ""} ${c.name} ${c.level ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [classes, filter]);

  const preview = classes.filter((c) => selected.has(c.id));

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <input
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        placeholder="Filtrer les groupes…"
        value={filter}
        disabled={disabled}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">Aucun groupe trouvé.</p>
        ) : (
          filtered.map((c) => {
            const checked = selected.has(c.id);
            const label = `${c.reference || c.name}${c.level ? ` · ${c.level}` : ""}`;
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  className="size-4"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = new Set(selected);
                    if (checked) next.delete(c.id);
                    else next.add(c.id);
                    onChange([...next]);
                  }}
                />
                <span className="truncate">{label}</span>
              </label>
            );
          })
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {preview.length === 0
          ? "Aucun destinataire sélectionné."
          : `Aperçu (${preview.length}) : ${preview
              .map((c) => c.reference || c.name)
              .slice(0, 6)
              .join(", ")}${preview.length > 6 ? "…" : ""}`}
      </p>
    </div>
  );
}
