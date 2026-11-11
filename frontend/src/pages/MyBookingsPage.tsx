// The logged-in user's bookings, with cancellation (two-step: Cancel → Yes, cancel).
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import type { Booking, Page } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Loading, StatusBadge } from '../components/ui';
import { errorMessage } from '../utils/errors';
import { formatDate, formatMoney } from '../utils/format';

const CANCELLABLE = ['CONFIRMED', 'PENDING_PAYMENT'];

export function MyBookingsPage() {
  const { token } = useAuth();
  const [params] = useSearchParams();
  const createdId = params.get('created');

  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<Page<Booking> | null>(null);
  const [roomNumbers, setRoomNumbers] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.myBookings(token, pageNumber);
      setPage(result);
      // Bookings only carry roomId; look up the room numbers to display.
      const ids = [...new Set(result.items.map((b) => b.roomId))];
      const rooms = await Promise.all(ids.map((id) => api.room(id).catch(() => null)));
      setRoomNumbers(Object.fromEntries(rooms.filter(Boolean).map((r) => [r!.id, r!.number])));
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [token, pageNumber]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: string) {
    if (!token) return;
    setBusyId(id);
    setRowErrors((e) => ({ ...e, [id]: '' }));
    try {
      const updated = await api.cancelBooking(token, id);
      setPage((p) => p && { ...p, items: p.items.map((b) => (b.id === id ? updated : b)) });
    } catch (err) {
      setRowErrors((e) => ({ ...e, [id]: errorMessage(err) }));
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  }

  if (loadError) return <Alert kind="error" testId="bookings-error">{loadError}</Alert>;
  if (!page) return <Loading testId="bookings-loading" />;

  const lastPage = Math.max(1, Math.ceil(page.total / page.limit));

  return (
    <section className="card" data-testid="my-bookings-page">
      <h1>My bookings</h1>
      {createdId && (
        <Alert kind="success" testId="booking-created">
          Booking confirmed. Have a nice stay!
        </Alert>
      )}

      {page.items.length === 0 ? (
        <p className="muted" data-testid="bookings-empty">You have no bookings yet.</p>
      ) : (
        <table className="table" data-testid="bookings-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Dates</th>
              <th>Guests</th>
              <th className="num">Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {page.items.map((b) => (
              <tr
                key={b.id}
                className={b.id === createdId ? 'highlight' : undefined}
                data-testid={`booking-row-${b.id}`}
                data-booking-id={b.id}
                data-status={b.status}
              >
                <td data-testid={`booking-room-${b.id}`}>{roomNumbers[b.roomId] ?? '…'}</td>
                <td data-testid={`booking-dates-${b.id}`}>
                  {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                </td>
                <td data-testid={`booking-guests-${b.id}`}>{b.guests}</td>
                <td className="num" data-testid={`booking-total-${b.id}`}>{formatMoney(b.totalPrice)}</td>
                <td>
                  <StatusBadge status={b.status} testId={`booking-status-${b.id}`} />
                </td>
                <td className="actions">
                  {CANCELLABLE.includes(b.status) && confirming !== b.id && (
                    <button className="secondary" onClick={() => setConfirming(b.id)} data-testid={`booking-cancel-${b.id}`}>
                      Cancel
                    </button>
                  )}
                  {confirming === b.id && (
                    <span className="confirm">
                      Cancel this booking?{' '}
                      <button className="danger" disabled={busyId === b.id} onClick={() => cancel(b.id)} data-testid={`booking-cancel-confirm-${b.id}`}>
                        Yes, cancel
                      </button>{' '}
                      <button className="secondary" onClick={() => setConfirming(null)} data-testid={`booking-cancel-abort-${b.id}`}>
                        Keep it
                      </button>
                    </span>
                  )}
                  {rowErrors[b.id] && (
                    <p className="field-error" data-testid={`booking-error-${b.id}`}>{rowErrors[b.id]}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {lastPage > 1 && (
        <div className="pager" data-testid="bookings-pager">
          <button className="secondary" disabled={pageNumber <= 1} onClick={() => setPageNumber(pageNumber - 1)} data-testid="bookings-prev">
            Previous
          </button>
          <span data-testid="bookings-page">Page {pageNumber} of {lastPage}</span>
          <button className="secondary" disabled={pageNumber >= lastPage} onClick={() => setPageNumber(pageNumber + 1)} data-testid="bookings-next">
            Next
          </button>
        </div>
      )}
    </section>
  );
}
