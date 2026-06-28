import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  OrganizationType,
  UserRole,
  CalendarPlatform,
  ReservationStatus,
} from '@prisma/client';
import { addDays, startOfDay } from 'date-fns';
import { resolveLocalDateTime } from '../src/lib/datetime';
import { encryptSecret, hashFeedUrl } from '../src/lib/crypto';
import { regeneratePropertyJobs } from '../src/server/sync/job-generator';

const prisma = new PrismaClient();
const TZ = 'America/New_York';
const PASSWORD = 'password123';

async function upsertUser(
  email: string,
  name: string,
  role: UserRole,
  orgName: string,
  orgType: OrganizationType,
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role, passwordHash },
  });
  let membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organization: { type: orgType } },
    include: { organization: true },
  });
  if (!membership) {
    const org = await prisma.organization.create({ data: { name: orgName, type: orgType } });
    membership = await prisma.organizationMember.create({
      data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
      include: { organization: true },
    });
  }
  return { user, org: membership.organization };
}

async function main() {
  console.log('Seeding Ready2Rent demo data…');

  await upsertUser('admin@turnready.app', 'Platform Admin', UserRole.ADMIN, 'Ready2Rent Admin', OrganizationType.ADMIN);
  const { org: ownerOrg } = await upsertUser(
    'owner@turnready.app',
    'Olivia Owner',
    UserRole.OWNER,
    'Coastal Stays',
    OrganizationType.OWNER,
  );
  const { user: cleaner } = await upsertUser(
    'cleaner@turnready.app',
    'Casey Cleaner',
    UserRole.CLEANER,
    'Sparkle Turnovers',
    OrganizationType.CLEANING_COMPANY,
  );

  // Demo property (idempotent by name within the owner org).
  let property = await prisma.property.findFirst({
    where: { ownerOrganizationId: ownerOrg.id, name: 'Sandpiper Cottage' },
  });
  if (!property) {
    property = await prisma.property.create({
      data: {
        ownerOrganizationId: ownerOrg.id,
        name: 'Sandpiper Cottage',
        address: '218 Ocean Blvd',
        city: 'Myrtle Beach',
        state: 'SC',
        zip: '29577',
        bedrooms: 3,
        bathrooms: 2,
        timezone: TZ,
        defaultCheckInTime: '16:00',
        defaultCheckOutTime: '10:00',
        notes: 'Gate code 4417. Cleaning supplies in the hall closet. Beach chairs go back in the garage.',
        assignedCleanerUserId: cleaner.id,
      },
    });
  }

  // A manual calendar feed (placeholder URL — not actually fetched in seed).
  const feedUrl = 'https://example.com/calendar/sandpiper.ics';
  const feed = await prisma.calendarFeed.upsert({
    where: { propertyId_feedUrlHash: { propertyId: property.id, feedUrlHash: hashFeedUrl(feedUrl) } },
    update: {},
    create: {
      propertyId: property.id,
      platform: CalendarPlatform.AIRBNB,
      feedUrlEncrypted: encryptSecret(feedUrl),
      feedUrlHash: hashFeedUrl(feedUrl),
      lastSyncStatus: 'SUCCESS',
      lastSyncedAt: new Date(),
    },
  });

  // Demo reservations: builds a same-day turnover (checkout today, new check-in
  // today), plus a future stay.
  const today = startOfDay(new Date());
  const reservations = [
    // Guest A leaves today
    {
      uid: 'demo-res-A',
      checkIn: resolveLocalDateTime(addDays(today, -3), '16:00', TZ),
      checkOut: resolveLocalDateTime(today, '10:00', TZ),
    },
    // Guest B arrives today (=> same-day turnover with A), leaves in 4 days
    {
      uid: 'demo-res-B',
      checkIn: resolveLocalDateTime(today, '16:00', TZ),
      checkOut: resolveLocalDateTime(addDays(today, 4), '10:00', TZ),
    },
    // Guest C arrives next week
    {
      uid: 'demo-res-C',
      checkIn: resolveLocalDateTime(addDays(today, 8), '16:00', TZ),
      checkOut: resolveLocalDateTime(addDays(today, 12), '10:00', TZ),
    },
  ];

  for (const r of reservations) {
    await prisma.reservation.upsert({
      where: { calendarFeedId_externalUid: { calendarFeedId: feed.id, externalUid: r.uid } },
      update: { checkInDate: r.checkIn, checkOutDate: r.checkOut, status: ReservationStatus.ACTIVE },
      create: {
        propertyId: property.id,
        calendarFeedId: feed.id,
        externalUid: r.uid,
        sourcePlatform: CalendarPlatform.AIRBNB,
        summary: 'Reserved',
        checkInDate: r.checkIn,
        checkOutDate: r.checkOut,
        rawStart: r.checkIn,
        rawEnd: r.checkOut,
        status: ReservationStatus.ACTIVE,
      },
    });
  }

  const summary = await regeneratePropertyJobs(property.id);
  console.log('Jobs generated:', summary);

  console.log('\nDemo accounts (password: %s):', PASSWORD);
  console.log('  Owner   -> owner@turnready.app');
  console.log('  Cleaner -> cleaner@turnready.app');
  console.log('  Admin   -> admin@turnready.app');
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
