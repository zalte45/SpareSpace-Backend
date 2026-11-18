-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'active', 'completed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'successful', 'failed', 'refunded');

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "renterId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "securityDeposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platformFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'confirmed',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_renterId_idx" ON "Booking"("renterId");

-- CreateIndex
CREATE INDEX "Booking_listingId_idx" ON "Booking"("listingId");

-- CreateIndex
CREATE INDEX "Booking_hostId_idx" ON "Booking"("hostId");

-- CreateIndex
CREATE INDEX "Booking_bookingStatus_idx" ON "Booking"("bookingStatus");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_listingId_startDate_endDate_idx" ON "Booking"("listingId", "startDate", "endDate");
