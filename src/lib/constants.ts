export const BRICK_M = 0.0096; // LEGO Group standard brick: 9.6 mm tall excluding studs.
export const TOTAL_YEARS = 4.6e9; // Earth's age 4.54 Gyr (Dalrymple 2001, Geol. Soc. Spec. Pub. 190), rounded to 4.6 Gyr as most children's references state it.
export const RATE0 = 8; // years per second at the first instant of holding
export const RATE_K = 0.25; // rate = RATE0 * e^(RATE_K * heldSeconds); reaches TOTAL at ~75 s
export const ZOOM_TRIGGER = 0.82; // zoom out when the stack passes this fraction of the screen
export const ZOOM_FACTOR = 10; // how much the visible scale grows on each zoom-out step
export const ZOOM_MS = 750; // duration of the zoom tween, in milliseconds
export const SCALE_MIN_M = 0.1; // the smallest scale (screen height, in meters) the camera can show
export const SCALE_MAX_M = 1e8; // the largest scale (screen height, in meters) the camera can show
