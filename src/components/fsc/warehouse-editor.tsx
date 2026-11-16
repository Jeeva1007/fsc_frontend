import { MapPin, MessageCircle, Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MAX_WAREHOUSES,
  newWarehouse,
  typedWhatsapp,
  whatsappForInput,
  type Warehouse,
} from "@/lib/warehouse";
import type { FieldErrors } from "@/lib/login-schema";
import { TextField } from "./fields";

// Warehouse cards for a Receiver: each card has name, location/description and WhatsApp number.
export function WarehouseEditor({
  value,
  onChange,
  errors = [],
}: {
  value: Warehouse[];
  onChange: (next: Warehouse[]) => void;
  errors?: FieldErrors[];
}) {
  const update = (id: string, patch: Partial<Warehouse>) =>
    onChange(value.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const atLimit = value.length >= MAX_WAREHOUSES;
  return (
    <section className="wh-section" aria-label="Warehouses">
      <header className="wh-head">
        <span className="wh-title">
          <WarehouseIcon size={18} />
          Warehouses
          <em>{value.length}</em>
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={atLimit}
          onClick={() => onChange([...value, newWarehouse()])}
        >
          <Plus />
          Add warehouse
        </Button>
      </header>
      {value.length === 0 ? (
        <p className="wh-empty">
          No warehouses yet. A receiver can have more than one — use “Add warehouse”.
        </p>
      ) : (
        <div className="wh-list">
          {value.map((w, i) => {
            const e = errors[i] ?? {};
            return (
              <div className="wh-card" key={w.id}>
                <div className="wh-card-head">
                  <span>Warehouse {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove warehouse ${i + 1}`}
                    onClick={() => onChange(value.filter((x) => x.id !== w.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="form-grid two-col">
                  <TextField
                    label="Warehouse name"
                    required
                    value={w.name}
                    onChange={(v) => update(w.id, { name: v })}
                    error={e["name"] || undefined}
                    startAdornment={<WarehouseIcon size={16} />}
                    inputProps={{ autoComplete: "off" }}
                  />
                  <TextField
                    label="WhatsApp number"
                    required={Boolean(w.name.trim())}
                    type="tel"
                    value={whatsappForInput(w.whatsapp)}
                    onChange={(v) => update(w.id, { whatsapp: typedWhatsapp(v) })}
                    error={e["whatsapp"] || undefined}
                    placeholder="9876543210"
                    startAdornment={<MessageCircle size={16} />}
                    inputProps={{
                      inputMode: "numeric",
                      autoComplete: "off",
                    }}
                  />
                  <TextField
                    label="Location / description"
                    required={Boolean(w.name.trim())}
                    wide
                    value={w.location}
                    onChange={(v) => update(w.id, { location: v })}
                    error={e["location"] || undefined}
                    startAdornment={<MapPin size={16} />}
                    inputProps={{ autoComplete: "off" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
