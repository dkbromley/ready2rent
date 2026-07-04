import { ImageResponse } from 'next/og';

/**
 * Social share card, rendered at request time — the dark-ocean hero condensed
 * to 1200×630 so links dropped in host Facebook groups and texts look like a
 * product, not a bare URL. Kept dependency-free (inline SVG mark, default
 * font) so it runs anywhere.
 */

export const alt = 'Ready2Rent — vacation rental turnovers, finally in sync';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND_300 = '#5eead4';
const SKY_300 = '#7dd3fc';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          color: '#fff',
          backgroundImage:
            'radial-gradient(760px 420px at 82% -10%, rgba(45,212,191,0.35), transparent 60%), radial-gradient(620px 420px at 6% 108%, rgba(56,189,248,0.28), transparent 60%), linear-gradient(170deg, #06302f 0%, #072c3f 55%, #05202e 100%)',
        }}
      >
        {/* logo lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg viewBox="0 0 32 32" width="56" height="56">
            <rect width="32" height="32" rx="9" fill="#14b8a6" />
            <path
              d="M9 15 L16 8.5 L23 15"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 20.5c2.3-2.7 4.9-2.7 7.2 0s4.9 2.7 7.2 0"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>
            <span>Ready</span>
            <span style={{ color: '#14b8a6' }}>2</span>
            <span>Rent</span>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>From checkout to clean —</span>
            <span style={{ color: BRAND_300 }}>and everything in between.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 32, color: 'rgba(255,255,255,0.72)' }}>
            Airbnb &amp; Vrbo calendars in, turnover jobs out — automatically.
          </div>
        </div>

        {/* footer strip: the three hero reassurances */}
        <div style={{ display: 'flex', gap: 40, fontSize: 26, color: SKY_300 }}>
          {['No passwords needed', 'Any iCal link', 'Same-day alerts'].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg viewBox="0 0 24 24" width="26" height="26">
                <circle cx="12" cy="12" r="11" fill="rgba(45,212,191,0.18)" />
                <path
                  d="M7 12.5l3.2 3.2L17 9"
                  fill="none"
                  stroke={BRAND_300}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
