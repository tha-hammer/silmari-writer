'use client';

import { useState } from 'react';

export interface ShortlistCompany {
  companyId: string;
  companyName: string;
  rank: number;
}

export interface ShortlistModuleProps {
  initialItems?: ShortlistCompany[];
  onGenerate?: () => Promise<ShortlistCompany[]>;
  onSave?: (items: ShortlistCompany[]) => Promise<void>;
}

function normalizeRanks(items: ShortlistCompany[]): ShortlistCompany[] {
  return items.map((item, index) => ({ ...item, rank: index + 1 }));
}

export default function ShortlistModule({
  initialItems = [],
  onGenerate = async () => [],
  onSave = async () => {},
}: ShortlistModuleProps) {
  const [items, setItems] = useState<ShortlistCompany[]>(normalizeRanks(initialItems));
  const [manualCompanyName, setManualCompanyName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const generated = await onGenerate();
      setItems(normalizeRanks(generated));
      setStatusMessage('Shortlist generated');
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate shortlist';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMove = (index: number, delta: number) => {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    const cloned = [...items];
    const [item] = cloned.splice(index, 1);
    cloned.splice(targetIndex, 0, item);
    setItems(normalizeRanks(cloned));
  };

  const handleAddManualCompany = () => {
    const trimmedName = manualCompanyName.trim();
    if (!trimmedName) {
      return;
    }

    setItems(current =>
      normalizeRanks([
        ...current,
        {
          companyId: `manual-${crypto.randomUUID()}`,
          companyName: trimmedName,
          rank: current.length + 1,
        },
      ]),
    );

    setManualCompanyName('');
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      await onSave(items);
      setStatusMessage('Shortlist saved');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save shortlist';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-3" data-testid="shortlist-module">
      <h2 className="text-lg font-semibold">Acceleration Shortlist</h2>

      <div className="flex gap-2">
        <button type="button" onClick={handleGenerate} disabled={isLoading}>
          Generate shortlist
        </button>
        <button type="button" onClick={handleSave} disabled={isLoading || items.length === 0}>
          Save shortlist
        </button>
      </div>

      <div className="flex gap-2">
        <label htmlFor="manual-company">Manual company</label>
        <input
          id="manual-company"
          value={manualCompanyName}
          onChange={event => setManualCompanyName(event.target.value)}
        />
        <button type="button" onClick={handleAddManualCompany}>
          Add company
        </button>
      </div>

      <ol>
        {items.map((item, index) => (
          <li key={item.companyId} data-testid={`shortlist-item-${index + 1}`}>
            <span>{item.rank}. {item.companyName}</span>
            <button
              type="button"
              onClick={() => handleMove(index, -1)}
              aria-label={`Move ${item.companyName} up`}
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => handleMove(index, 1)}
              aria-label={`Move ${item.companyName} down`}
            >
              Down
            </button>
          </li>
        ))}
      </ol>

      {statusMessage && <p role="status">{statusMessage}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
