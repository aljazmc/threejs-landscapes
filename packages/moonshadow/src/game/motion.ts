import * as THREE from "three";

/**
 * How the creatures move: smooth curves for their gait and their blows,
 * the same for every kind, which the creature applies to the joints of its
 * model. Angles are radians. A hip, shoulder or arm hangs down, so turning
 * it negatively around X swings it forward; the body and the head stand up,
 * so turning them positively leans them forward. A bend adds to the natural
 * bend of a knee or an elbow (see bendAxis).
 */

/** The quick blow and the heavy one: seconds, and when (a share) it lands. */
export const LIGHT = { time: 0.7, strikeAt: 0.4 };
export const HEAVY = { time: 1.3, strikeAt: 0.55 };
/** The heavy blow: seconds until the next, at least and at most. */
export const HEAVY_COOLDOWN = { min: 4, max: 5 };
/** How quickly the gait follows the pace (1/s): steps start and stop softly. */
const GAIT_EASE = 6;

function clamp01(u: number): number {
    return Math.min(Math.max(u, 0), 1);
}

/** From 0 to 1, easing in and out. */
export function smooth(u: number): number {
    const t = clamp01(u);
    return t * t * (3 - 2 * t);
}

/** From 0 to 1, fast at first, then settling. */
function easeOut(u: number): number {
    const t = 1 - clamp01(u);
    return 1 - t * t;
}

/** The gait (0: standing, 1: full pace) eased towards the pace for dt seconds. */
export function easeGait(gait: number, pace: number, dt: number): number {
    return gait + (Math.min(pace, 1) - gait) * (1 - Math.exp(-GAIT_EASE * dt));
}

/** Seconds until the next heavy blow. */
export function heavyCooldown(): number {
    return (
        HEAVY_COOLDOWN.min +
        Math.random() * (HEAVY_COOLDOWN.max - HEAVY_COOLDOWN.min)
    );
}

export interface Limb {
    /** The shoulder (or hip) turn. */
    swing: number;
    /** The elbow (or knee) bend. */
    bend: number;
}

export interface Motion {
    /** LegA hips swing by this, LegB the opposite way. */
    hips: number;
    /** The knees of LegA and of LegB bend by these, lifting each foot as it swings forward. */
    kneeA: number;
    kneeB: number;
    /** Each arm, the right one first. */
    arms: Limb[];
    /** The body leaning forward, rolling to the side and rising (m). */
    lean: number;
    roll: number;
    rise: number;
    /** The head nodding forward and looking to the side. */
    nod: number;
    look: number;
    /** The sway of tail segment k. */
    tail: (k: number) => number;
    /** The beat of the wings. */
    wing: number;
}

export interface MotionState {
    /** Its own clock (s). */
    time: number;
    /** The phase of its stride. */
    walk: number;
    gait: number;
    /** Seconds into its blow, or -1. */
    attackTime: number;
    heavy: boolean;
    arms: number;
    hover: boolean;
}

/** The three parts of a blow: winding up, the strike and the way back. */
function phases(u: number, heavy: boolean) {
    const blow = heavy ? HEAVY : LIGHT;
    const fast = heavy ? 0.12 : 0.2;
    // the downswing is under way when the blow lands
    const wound = blow.strikeAt - 0.6 * fast;
    return {
        windUp: smooth(u / wound),
        strike: easeOut((u - wound) / fast),
        back: smooth((u - wound - fast) / (1 - wound - fast)),
        stage: u < wound ? 0 : u < wound + fast ? 1 : 2,
    };
}

/** From a to b and on to c through the phases, then back to rest. */
function through(p: ReturnType<typeof phases>, a: number, b: number): number {
    if (p.stage === 0) return a * p.windUp;
    if (p.stage === 1) return a + (b - a) * p.strike;
    return b * (1 - p.back);
}

export function motion(s: MotionState): Motion {
    const g = s.gait;
    const phi = s.walk;
    const still = 1 - g;
    // the hips swing; a foot lifts while its leg swings forward
    const hips = 0.5 * Math.sin(phi) * g;
    const lift = (c: number) => 0.7 * g * Math.max(0, c) ** 2;
    const m: Motion = {
        hips,
        kneeA: lift(-Math.cos(phi)),
        kneeB: lift(Math.cos(phi)),
        arms: [],
        // leaning into the walk and swaying over the foot on the ground,
        // highest when the legs pass each other; breathing when still
        lean: 0.08 * g + 0.02 * Math.sin(s.time * 1.9) * still,
        roll: 0.06 * Math.sin(phi) * g,
        rise: s.hover
            ? 0.12 * Math.sin(s.time * 2.2)
            : 0.04 * g * (1 + Math.cos(2 * phi)) * 0.5 +
              0.012 * Math.sin(s.time * 1.9) * still,
        // the head keeps steady against the bob and looks about when still
        nod: -0.03 * g * Math.cos(2 * phi),
        look: Math.sin(s.time * 0.8) * 0.25 * (1 - 0.6 * g),
        tail: (k) =>
            Math.sin(s.time * 3 + k * 0.7) * 0.18 * still +
            Math.sin(phi + k * 0.8) * 0.3 * g,
        wing: Math.sin(s.time * 9) * 0.5,
    };
    for (let i = 0; i < s.arms; i++)
        m.arms.push({
            // the arms swing against the legs: the right one with LegA
            swing:
                hips * 0.6 * (i === 0 ? 1 : -1) +
                Math.sin(s.time * 1.7 + i) * 0.06 * still,
            bend: 0.15 * g + 0.05 * Math.sin(s.time * 1.7 + i + 1),
        });

    if (s.attackTime >= 0) {
        const blow = s.heavy ? HEAVY : LIGHT;
        const u = s.attackTime / blow.time;
        // the quick blow: the arms one after the other; the heavy one: both
        // raised high overhead, held trembling, and slammed down together
        for (let i = 0; i < s.arms; i++) {
            const p = phases(s.heavy ? u : u - i * 0.12, s.heavy);
            const raised = s.heavy ? -2.7 : -2.0;
            const tremble =
                s.heavy && p.stage === 0
                    ? 0.05 * Math.sin(s.time * 40) * p.windUp ** 4
                    : 0;
            // on top of the arm's sway, so the blow starts and ends in it
            const arm = m.arms[i]!;
            arm.swing += through(p, raised + tremble, s.heavy ? 1.0 : 0.6);
            arm.bend += through(p, s.heavy ? 0.8 : 0.5, -0.4);
        }
        // the body draws back and throws itself into the blow; without
        // arms it bites, lunging further
        const p = phases(u, s.heavy);
        const bite = s.arms === 0 ? 2.2 : 1;
        const lean = through(p, s.heavy ? -0.35 : -0.08, s.heavy ? 0.5 : 0.3);
        m.lean += lean * bite;
        m.rise += through(p, s.heavy ? 0.06 : 0, s.heavy ? -0.08 : -0.02);
        m.nod += lean * 0.8;
    }
    return m;
}

/**
 * The axis of a joint's natural bend, its turn at rest, pointing so that
 * turning around it bends the joint further; null for a straight joint.
 */
export function bendAxis(rest: THREE.Quaternion): THREE.Vector3 | null {
    const w = THREE.MathUtils.clamp(rest.w, -1, 1);
    const s = Math.sqrt(1 - w * w);
    if (s < 0.02) return null;
    // beyond half a turn, the same turn goes the other way round
    const axis = new THREE.Vector3(rest.x / s, rest.y / s, rest.z / s);
    return w < 0 ? axis.negate() : axis;
}

/**
 * How much of a bend a joint takes, by its name: a knee or an elbow bends
 * further; an insect's leg, hanging out from its knee, bends below it (its
 * Down joint) and lifts its foot by straightening there instead, much more
 * for the same angle.
 */
export function bendScale(name: string): number {
    return / Down$/.test(name) ? -0.35 : 1;
}

const bendTurn = new THREE.Quaternion();

/** Poses a joint bent by angle beyond its rest along its natural bend. */
export function bendJoint(
    joint: THREE.Object3D,
    rest: THREE.Quaternion,
    axis: THREE.Vector3,
    angle: number,
): void {
    joint.quaternion
        .copy(rest)
        .multiply(bendTurn.setFromAxisAngle(axis, angle));
}
