// I'm not using ts-check here because the types are incomplete

const { Comparator, Range, cmp } = require('semver');

/**
 * @param {Comparator} a
 * @param {Comparator} b
 * @returns {Range | null}
 */
const getComparatorIntersection = (a, b) => {
    // Special cases:
    // Either input is "any"
    if (a.value === '') return new Range(b);
    if (b.value === '') return new Range(a);
    // Either input is "exact match"
    if (a.operator === '') return b.test(a.semver) ? new Range(a) : null;
    if (b.operator === '') return a.test(b.semver) ? new Range(b) : null;

    // If they both go the same direction, pick the more restrictive one
    if (
        (a.operator[0] === '>' && b.operator[0] === '>') ||
        (a.operator[0] === '<' && b.operator[0] === '<')
    ) {
        if (b.operator[1] === '=')
            return new Range(a.test(b.semver) ? b : a);
        return new Range(b.test(a.semver) ? a : b);
    }

    // If they go opposite directions but have the same bound, e.g. "<= 1.0" and ">= 1.0", return just that bound.
    if (
        a.operator[1] === '=' &&
        b.operator[1] === '=' &&
        a.semver.version === b.semver.version
    ) return new Range(a.semver.version);

    // They go different directions so they may define a range, e.g. "> 1.0" and "< 2.0".
    if (cmp(a.semver, '<', b.semver) && a.operator[0] === '>' && b.operator[0] === '<') return new Range(`${a} ${b}`);
    if (cmp(a.semver, '>', b.semver) && a.operator[0] === '<' && b.operator[0] === '>') return new Range(`${b} ${a}`);

    // They don't intersect
    return null;
};

/**
 * If either parameter is null, returns the other. Never returns null for nonnull inputs.
 * @param {Comparator | Range | null} a
 * @param {Comparator | Range | null} b
 * @returns {Range | null}
 */
const getUnion = (a, b) => {
    if (!a) return b instanceof Comparator ? new Range(b) : b;
    if (!b) return a instanceof Comparator ? new Range(a) : a;
    return new Range(`${a} || ${b}`);
};

const any = new Comparator('>=0.0.0');

/**
 * @param {Range} a
 * @param {Range} b
 * @returns {Range | null}
 */
const getRangeIntersection = (a, b) => {
    const fourWayIntersect = ([w, x], [y, z]) => {
        const [aMin, aMax] = w.operator[0] === '<' ? [w, x || any] : [x || any, w];
        const [bMin, bMax] = y.operator[0] === '<' ? [y, z || any] : [z || any, y];

        try {
            const lower = getComparatorIntersection(aMin, bMin).toString();
            const upper = getComparatorIntersection(aMax, bMax).toString();
            return getComparatorIntersection(new Comparator(lower), new Comparator(upper));
        } catch {
            return null;
        }
    };

    return a.set.map(aRange =>
        b.set.map(bRange =>
            fourWayIntersect(aRange, bRange)
        ).reduce(getUnion, null)
    ).reduce(getUnion, null);
};

/**
 * Returns the intersection of the given versions, or 'null' if there's no overlap.
 * @param {Range | Comparator | string} a
 * @param {Range | Comparator | string} b
 * @returns {Range | null}
 */
module.exports = function getIntersection(a, b) {
    if (a instanceof Comparator && b instanceof Comparator)
        return getComparatorIntersection(a, b);
    return getRangeIntersection(new Range(a), new Range(b));
};
