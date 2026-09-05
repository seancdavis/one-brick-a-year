export const BRICK_M = 0.0096; // LEGO Group standard brick: 9.6 mm tall excluding studs.
export const TOTAL_YEARS = 4.6e9; // Earth's age 4.54 Gyr (Dalrymple 2001, Geol. Soc. Spec. Pub. 190), rounded to 4.6 Gyr as most children's references state it.
export const SMOOTH_S = 0.06; // time constant (seconds) years takes to approach targetYears — a wheel notch reads as motion, not a jump
export const SMOOTH_SNAP_YEARS = 0.01; // once years is this close to targetYears, snap instead of asymptotically crawling forever
