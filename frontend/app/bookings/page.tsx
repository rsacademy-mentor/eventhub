'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import BookingCard, { BookingCardSkeleton } from '@/components/bookings/BookingCard';
import EmptyState  from '@/components/ui/EmptyState';
import Pagination  from '@/components/ui/Pagination';
import Spinner     from '@/components/ui/Spinner';
import Button      from '@/components/ui/Button';
import { useBookings } from '@/lib/hooks/useBookings';


function BookingsContent() {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') || 1);

  const { data, isLoading, isError, refetch } = useBookings({
    page,
    limit: 10,
  });

  const bookings   = data?.data       ?? [];
  const pagination = data?.pagination;

  const changePage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <BookingCardSkeleton key={i} />)}
        </div>
      )}

      {isError && (
        <EmptyState
          title="Couldn't load bookings"
          description="Failed to connect to the server. Please try again."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      )}

      {!isLoading && !isError && bookings.length === 0 && (
        <EmptyState
          title="No bookings yet"
          description="You haven't booked any events yet. Browse upcoming events and grab your tickets!"
          icon={
            <svg className="w-16 h-16 mx-auto text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          }
          action={<Link href="/events"><Button>Browse Events</Button></Link>}
        />
      )}

      {!isLoading && !isError && bookings.length > 0 && (
        <>
          <div className="space-y-4 mb-8">
            {bookings.map((b: any) => <BookingCard key={b.id} booking={b} />)}
          </div>
          {pagination && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onChange={changePage}
            />
          )}
        </>
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
        <p className="text-gray-500 mt-1">View and manage all your ticket bookings</p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-12"><Spinner size="lg" /></div>}>
        <BookingsContent />
      </Suspense>
    </div>
  );
}
