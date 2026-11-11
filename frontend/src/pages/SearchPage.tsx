// Room search. The search criteria live in the URL (?checkIn=…&checkOut=…&guests=…&type=…),
// so a search can be bookmarked, shared, or opened directly by a test.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import type { AvailableRoom, RoomType } from '../api/types';
import { Alert, FieldError, Loading } from '../components/ui';
import { errorField, errorMessage } from '../utils/errors';
import { formatMoney, isoDay } from '../utils/format';

const ROOM_TYPES: RoomType[] = ['SINGLE', 'DOUBLE', 'SUITE'];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({
    checkIn: params.get('checkIn') ?? isoDay(7),
    checkOut: params.get('checkOut') ?? isoDay(9),
    guests: params.get('guests') ?? '1',
    type: (params.get('type') ?? '') as RoomType | '',
  });
  const [results, setResults] = useState<AvailableRoom[] | null>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Run the search whenever the URL holds search criteria. Only the latest search may
  // update the page (an older, slower answer must not overwrite a newer one).
  useEffect(() => {
    const checkIn = params.get('checkIn');
    const checkOut = params.get('checkOut');
    if (!checkIn || !checkOut) return;
    let latest = true;
    setLoading(true);
    setError(null);
    api
      .availability({ checkIn, checkOut, guests: Number(params.get('guests') ?? 1), type: (params.get('type') ?? '') as RoomType | '' })
      .then((page) => latest && setResults(page.items))
      .catch((err) => {
        if (!latest) return;
        setResults(null);
        setError({ message: errorMessage(err), field: errorField(err) });
      })
      .finally(() => latest && setLoading(false));
    return () => {
      latest = false;
    };
  }, [params]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = { checkIn: form.checkIn, checkOut: form.checkOut, guests: form.guests };
    if (form.type) next.type = form.type;
    setParams(next);
  }

  const fieldMessage = (field: string) => (error?.field === field ? error.message : undefined);
  const stayQuery = `checkIn=${params.get('checkIn')}&checkOut=${params.get('checkOut')}&guests=${params.get('guests') ?? 1}`;

  return (
    <>
      <section className="card" data-testid="search-page">
        <h1>Find a room</h1>
        <form className="search-form" onSubmit={submit} noValidate>
          <label>
            Check-in
            <input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} data-testid="search-checkin" />
            <FieldError testId="search-error-checkIn" message={fieldMessage('checkIn')} />
          </label>
          <label>
            Check-out
            <input type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} data-testid="search-checkout" />
            <FieldError testId="search-error-checkOut" message={fieldMessage('checkOut')} />
          </label>
          <label>
            Guests
            <select value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} data-testid="search-guests">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Room type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoomType | '' })} data-testid="search-type">
              <option value="">Any</option>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <button type="submit" data-testid="search-submit">Search</button>
        </form>
        {error && !error.field && <Alert kind="error" testId="search-error">{error.message}</Alert>}
      </section>

      {loading && <Loading testId="search-loading" />}

      {results && !loading && (
        <section data-testid="search-results" data-count={results.length}>
          <h2>
            {results.length} room{results.length === 1 ? '' : 's'} available
          </h2>
          {results.length === 0 && (
            <p className="muted" data-testid="search-no-results">No rooms are free for these dates. Try other dates or fewer guests.</p>
          )}
          <div className="room-grid">
            {results.map((room) => (
              <article key={room.id} className="card room-card" data-testid={`room-card-${room.number}`} data-room-id={room.id}>
                <h3 data-testid={`room-card-${room.number}-title`}>Room {room.number}</h3>
                <p className="muted">
                  <span data-testid={`room-card-${room.number}-type`}>{room.type}</span> · up to{' '}
                  <span data-testid={`room-card-${room.number}-capacity`}>{room.capacity}</span> guests
                </p>
                <p>
                  <strong data-testid={`room-card-${room.number}-total`}>{formatMoney(room.totalPrice)}</strong>{' '}
                  <span className="muted">for {room.nights} night{room.nights === 1 ? '' : 's'}</span>
                </p>
                <Link className="button" to={`/rooms/${room.id}?${stayQuery}`} data-testid={`room-card-${room.number}-view`}>
                  View & book
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
