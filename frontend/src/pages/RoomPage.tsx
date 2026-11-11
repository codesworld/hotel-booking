// Room details: price breakdown (from GET /rooms/{id}/quote) and the booking form.
// Date and guest errors come from the API and are shown next to the field they belong to.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import type { Quote, Room } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, FieldError, Loading } from '../components/ui';
import { errorCode, errorField, errorMessage } from '../utils/errors';
import { formatDate, formatMoney, isoDay } from '../utils/format';

/** Test card tokens understood by the simulated payment-service. No real cards, ever. */
const CARD_TOKENS = [
  { value: 'tok_success', label: 'Test card: payment succeeds (tok_success)' },
  { value: 'tok_decline', label: 'Test card: payment declined (tok_decline)' },
  { value: 'tok_slow', label: 'Test card: provider times out (tok_slow)' },
  { value: 'tok_error', label: 'Test card: provider error (tok_error)' },
  { value: 'tok_unknown', label: 'Invalid token (tok_unknown)' },
];

const PAYMENT_FAILURES = ['PAYMENT_DECLINED', 'PAYMENT_TIMEOUT', 'PAYMENT_SERVICE_ERROR'];

type FieldErrors = Record<string, string>;

export function RoomPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [form, setForm] = useState({
    checkIn: params.get('checkIn') ?? isoDay(7),
    checkOut: params.get('checkOut') ?? isoDay(9),
    guests: params.get('guests') ?? '1',
    cardToken: 'tok_success',
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErrors, setQuoteErrors] = useState<FieldErrors>({});
  const [submitErrors, setSubmitErrors] = useState<FieldErrors>({});
  const [bookingError, setBookingError] = useState<{ message: string; code?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.room(id).then(setRoom).catch((err) => setRoomError(errorMessage(err)));
  }, [id]);

  // Re-price whenever the dates change. Only the LATEST request may update the page:
  // when dates change quickly, an older (slower) answer must not overwrite a newer one.
  useEffect(() => {
    if (!room?.isActive) return;
    let latest = true;
    api
      .quote(id, form.checkIn, form.checkOut)
      .then((result) => {
        if (!latest) return;
        setQuote(result);
        setQuoteErrors({});
      })
      .catch((err) => {
        if (!latest) return;
        setQuote(null);
        setQuoteErrors({ [errorField(err) ?? '_']: errorMessage(err) });
      });
    return () => {
      latest = false;
    };
  }, [id, room, form.checkIn, form.checkOut]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitErrors({});
    setBookingError(null);
    setSubmitting(true);
    try {
      const booking = await api.createBooking(token, {
        roomId: id,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: Number(form.guests),
        cardToken: form.cardToken,
      });
      navigate(`/bookings?created=${booking.id}`);
    } catch (err) {
      const field = errorField(err);
      if (field) setSubmitErrors({ [field]: errorMessage(err) });
      else setBookingError({ message: errorMessage(err), code: errorCode(err) });
    } finally {
      setSubmitting(false);
    }
  }

  if (roomError) return <Alert kind="error" testId="room-error">{roomError}</Alert>;
  if (!room) return <Loading testId="room-loading" />;

  const errors = { ...quoteErrors, ...submitErrors };
  // Editing the form clears errors from the last submit (they described the old values).
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [key]: e.target.value });
    setSubmitErrors({});
  };

  return (
    <div className="room-layout" data-testid="room-page" data-room-id={room.id}>
      <section className="card">
        <h1 data-testid="room-title">Room {room.number}</h1>
        <dl className="facts">
          <dt>Type</dt>
          <dd data-testid="room-type">{room.type}</dd>
          <dt>Capacity</dt>
          <dd data-testid="room-capacity">{room.capacity} guests</dd>
          <dt>Price per night</dt>
          <dd data-testid="room-price-per-night">{formatMoney(room.pricePerNight)}</dd>
        </dl>
        <p className="muted">Friday and Saturday nights cost 20% more.</p>
        {!room.isActive && (
          <Alert kind="info" testId="room-inactive">This room is currently not available for booking.</Alert>
        )}

        {quote && (
          <table className="breakdown" data-testid="price-breakdown">
            <thead>
              <tr>
                <th>Night</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {quote.nights.map((night) => (
                <tr key={night.date} data-testid={`price-night-${night.date}`} data-weekend={night.isWeekend}>
                  <td>
                    {formatDate(night.date)} {night.isWeekend && <span className="tag">weekend +20%</span>}
                  </td>
                  <td className="num">{formatMoney(night.price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total ({quote.nights.length} night{quote.nights.length === 1 ? '' : 's'})</th>
                <th className="num" data-testid="price-total">{formatMoney(quote.totalPrice)}</th>
              </tr>
            </tfoot>
          </table>
        )}
        {errors._ && <Alert kind="error" testId="price-error">{errors._}</Alert>}
      </section>

      {room.isActive && (
        <section className="card">
          <h2>Book this room</h2>
          {bookingError && (
            <Alert kind="error" testId="booking-error">
              <span data-testid="booking-error-message">{bookingError.message}</span>
              {bookingError.code && PAYMENT_FAILURES.includes(bookingError.code) && (
                <>
                  {' '}
                  <Link to="/bookings" data-testid="booking-error-bookings-link">See my bookings</Link>
                </>
              )}
            </Alert>
          )}

          <form onSubmit={submit} noValidate data-testid="booking-form">
            <label>
              Check-in
              <input type="date" value={form.checkIn} onChange={set('checkIn')} data-testid="booking-checkin" />
            </label>
            <FieldError testId="booking-error-checkIn" message={errors.checkIn} />
            <label>
              Check-out
              <input type="date" value={form.checkOut} onChange={set('checkOut')} data-testid="booking-checkout" />
            </label>
            <FieldError testId="booking-error-checkOut" message={errors.checkOut} />
            <label>
              Guests
              <input type="number" min={1} value={form.guests} onChange={set('guests')} data-testid="booking-guests" />
            </label>
            <FieldError testId="booking-error-guests" message={errors.guests} />
            <label>
              Payment
              <select value={form.cardToken} onChange={set('cardToken')} data-testid="booking-card-token">
                {CARD_TOKENS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <FieldError testId="booking-error-cardToken" message={errors.cardToken} />

            {user ? (
              <button type="submit" disabled={submitting} data-testid="booking-submit">
                {submitting ? 'Processing payment…' : quote ? `Book and pay ${formatMoney(quote.totalPrice)}` : 'Book and pay'}
              </button>
            ) : (
              <Alert kind="info" testId="booking-login-required">
                Please <Link to={`/login?next=${encodeURIComponent(`/rooms/${id}?${params}`)}`} data-testid="booking-login-link">log in</Link> to book this room.
              </Alert>
            )}
            {submitting && <p className="muted" data-testid="booking-submitting">Contacting the payment provider…</p>}
          </form>
        </section>
      )}
    </div>
  );
}
