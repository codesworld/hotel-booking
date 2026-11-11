// Admin: create rooms, change prices, activate/deactivate. Test ids use the room NUMBER
// (e.g. admin-room-row-401), because that is what an admin types and sees.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/endpoints';
import type { Room, RoomType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, FieldError, Loading, StatusBadge } from '../components/ui';
import { errorField, errorMessage } from '../utils/errors';
import { formatMoney } from '../utils/format';

const EMPTY_FORM = { number: '', type: 'DOUBLE' as RoomType, capacity: '2', pricePerNight: '', isActive: true };

export function AdminRoomsPage() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<{ message: string; field?: string } | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const all: Room[] = [];
      for (let page = 1; ; page++) {
        const result = await api.allRooms(token, page);
        all.push(...result.items);
        if (result.items.length < result.limit) break;
      }
      setRooms(all);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setFormError(null);
    setCreated(null);
    try {
      const room = await api.createRoom(token, {
        number: form.number,
        type: form.type,
        capacity: Number(form.capacity),
        pricePerNight: Number(form.pricePerNight),
        isActive: form.isActive,
      });
      setCreated(room.number);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setFormError({ message: errorMessage(err), field: errorField(err) });
    }
  }

  async function patch(room: Room, body: Partial<Omit<Room, 'id'>>) {
    if (!token) return;
    setRowErrors((e) => ({ ...e, [room.number]: '' }));
    try {
      const updated = await api.patchRoom(token, room.id, body);
      setRooms((list) => list?.map((r) => (r.id === room.id ? updated : r)) ?? null);
      setPrices((p) => ({ ...p, [room.number]: '' }));
    } catch (err) {
      setRowErrors((e) => ({ ...e, [room.number]: errorMessage(err) }));
    }
  }

  const fieldMessage = (field: string) => (formError?.field === field ? formError.message : undefined);

  return (
    <>
      <section className="card" data-testid="admin-rooms-page">
        <h1>Rooms</h1>
        <h2>Add a room</h2>
        {created && <Alert kind="success" testId="admin-room-created">Room {created} created.</Alert>}
        {formError && !formError.field && <Alert kind="error" testId="admin-room-error">{formError.message}</Alert>}
        <form className="admin-form" onSubmit={create} noValidate data-testid="admin-room-form">
          <label>
            Number
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} data-testid="admin-room-number" />
            <FieldError testId="admin-room-error-number" message={fieldMessage('number')} />
          </label>
          <label>
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoomType })} data-testid="admin-room-type">
              <option value="SINGLE">SINGLE</option>
              <option value="DOUBLE">DOUBLE</option>
              <option value="SUITE">SUITE</option>
            </select>
          </label>
          <label>
            Capacity
            <input type="number" min={1} max={6} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} data-testid="admin-room-capacity" />
            <FieldError testId="admin-room-error-capacity" message={fieldMessage('capacity')} />
          </label>
          <label>
            Price per night
            <input type="number" min={0} step="0.01" value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })} data-testid="admin-room-price" />
            <FieldError testId="admin-room-error-pricePerNight" message={fieldMessage('pricePerNight')} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} data-testid="admin-room-active" />
            Active
          </label>
          <button type="submit" data-testid="admin-room-submit">Add room</button>
        </form>
      </section>

      <section className="card">
        <h2>All rooms</h2>
        {loadError && <Alert kind="error" testId="admin-rooms-error">{loadError}</Alert>}
        {!rooms && !loadError && <Loading testId="admin-rooms-loading" />}
        {rooms && (
          <table className="table" data-testid="admin-rooms-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Capacity</th>
                <th className="num">Price / night</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} data-testid={`admin-room-row-${room.number}`} data-room-id={room.id}>
                  <td>{room.number}</td>
                  <td data-testid={`admin-room-type-${room.number}`}>{room.type}</td>
                  <td data-testid={`admin-room-capacity-${room.number}`}>{room.capacity}</td>
                  <td className="num">
                    <span data-testid={`admin-room-price-${room.number}`}>{formatMoney(room.pricePerNight)}</span>
                    <span className="inline-edit">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="new price"
                        value={prices[room.number] ?? ''}
                        onChange={(e) => setPrices({ ...prices, [room.number]: e.target.value })}
                        data-testid={`admin-room-price-input-${room.number}`}
                      />
                      <button
                        className="secondary"
                        disabled={!prices[room.number]}
                        onClick={() => patch(room, { pricePerNight: Number(prices[room.number]) })}
                        data-testid={`admin-room-price-save-${room.number}`}
                      >
                        Save
                      </button>
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={room.isActive ? 'ACTIVE' : 'INACTIVE'} testId={`admin-room-status-${room.number}`} />
                  </td>
                  <td className="actions">
                    <button
                      className={room.isActive ? 'danger' : 'secondary'}
                      onClick={() => patch(room, { isActive: !room.isActive })}
                      data-testid={`admin-room-toggle-${room.number}`}
                    >
                      {room.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    {rowErrors[room.number] && (
                      <p className="field-error" data-testid={`admin-room-row-error-${room.number}`}>{rowErrors[room.number]}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
