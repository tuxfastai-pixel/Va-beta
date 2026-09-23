const fixedNow = Number(process.env.DETERMINISTIC_NOW || 1735689600000);
const seedInput = Number(process.env.DETERMINISTIC_SEED || 1337);

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const seededRandom = mulberry32(seedInput);
Math.random = seededRandom;

const OriginalDate = Date;
class DeterministicDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(fixedNow);
    } else {
      super(...args);
    }
  }

  static now() {
    return fixedNow;
  }

  static parse(value) {
    return OriginalDate.parse(value);
  }

  static UTC(...args) {
    return OriginalDate.UTC(...args);
  }
}

globalThis.Date = DeterministicDate;
globalThis.__DETERMINISTIC_RUNTIME__ = {
  fixedNow,
  seed: seedInput,
};
