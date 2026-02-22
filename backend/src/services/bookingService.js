const bookingRepository = require('../repositories/bookingRepository');
const eventRepository   = require('../repositories/eventRepository');
const prisma            = require('../config/database');  // used for booking.create
const { NotFoundError, InsufficientSeatsError, ForbiddenError } = require('../utils/errors');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOOKING_REF_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_USER_BOOKINGS = 9;

function randomRef() {
  let code = 'EVT-';
  for (let i = 0; i < 6; i++) {
    code += BOOKING_REF_CHARS[Math.floor(Math.random() * BOOKING_REF_CHARS.length)];
  }
  return code;
}

/** Retries until a collision-free booking reference is generated */
async function generateUniqueRef() {
  let ref;
  let attempts = 0;
  do {
    ref = randomRef();
    const existing = await bookingRepository.findByRef(ref);
    if (!existing) return ref;
    attempts++;
  } while (attempts < 10);
  return `EVT-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const bookingService = {
  async getBookings(filters, userId) {
    const page  = Number(filters.page)  || 1;
    const limit = Number(filters.limit) || 10;

    const { bookings, total } = await bookingRepository.findAll({ ...filters, page, limit }, userId);

    return {
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getBookingById(id, userId) {
    const booking = await bookingRepository.findById(id, userId);
    if (!booking) throw new NotFoundError(`Booking with id ${id} not found`);
    return booking;
  },

  async getBookingByRef(ref, userId) {
    const booking = await bookingRepository.findByRef(ref);
    if (!booking) throw new NotFoundError(`Booking with reference "${ref}" not found`);
    if (booking.userId !== userId) throw new ForbiddenError('You do not own this booking');
    return booking;
  },

  async createBooking(data, userId) {
    // FIFO: prune oldest booking if at limit
    const count = await bookingRepository.countUserBookings(userId);
    if (count >= MAX_USER_BOOKINGS) {
      const oldest = await bookingRepository.findOldestUserBooking(userId);
      if (oldest) await bookingRepository.delete(oldest.id);
    }

    // Verify event exists (static or owned by user)
    const event = await eventRepository.findById(data.eventId, userId);
    if (!event) throw new NotFoundError(`Event with id ${data.eventId} not found`);

    // Seat availability check using per-user computed count
    const booked = await bookingRepository.getBookedQuantitiesForEvents(userId, [data.eventId]);
    const personalAvailable = Math.max(0, event.totalSeats - (booked[data.eventId] || 0));
    if (personalAvailable < data.quantity) {
      throw new InsufficientSeatsError(
        `Only ${personalAvailable} seat(s) available, but ${data.quantity} requested`,
      );
    }

    const totalPrice = parseFloat(event.price) * data.quantity;
    const bookingRef = await generateUniqueRef();

    // Create booking — no seat decrement on the event table (computed dynamically per user)
    const booking = await prisma.booking.create({
      data: {
        eventId:       data.eventId,
        userId,
        customerName:  data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        quantity:      data.quantity,
        totalPrice,
        bookingRef,
        status:        'confirmed',
      },
      include: { event: true },
    });

    return booking;
  },

  async cancelBooking(id, userId) {
    const booking = await bookingRepository.findById(id, userId);
    if (!booking) throw new NotFoundError(`Booking with id ${id} not found`);
    if (booking.userId !== userId) throw new ForbiddenError('You do not own this booking');

    // Delete booking — for dynamic events, available seats are computed dynamically
    // so no event update needed; for static events, seats were never modified anyway
    await bookingRepository.delete(id);

    return { bookingRef: booking.bookingRef };
  },
};

module.exports = bookingService;
