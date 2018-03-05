import { pipeline, getZone, box, readData, writeData } from "./zone";

const KEYS = {
  READY_AND_WAITING: Symbol("KEY_READY_AND_WAITING")
};

export const KEY_READY_AND_WAITING = KEYS.READY_AND_WAITING;

export function libReady({
  read = readData,
  write = writeData,
  pack = box,
  // deref = unpack,
  // fence = zone,
  design = getZone,
  KEYS: { READY_AND_WAITING = KEYS.READY_AND_WAITING } = {}
}) {
  const API = {
    zoneReady: design({
      keys: Object.keys(KEYS).map(name => KEYS[name])
    })
  };

  function eachPush(value) {
    this.push(value);
  }

  function keepPromise(value) {
    write(READY_AND_WAITING, (datum = new Set()) => {
      datum.add(value);

      return datum;
    });
  }

  Object.assign(API, {
    waiting() {
      const datum = read(READY_AND_WAITING) || null;
      const result = datum ? [] : null;

      if (datum) {
        datum.forEach(eachPush, result);
      }

      return result;
    },

    untilReady(generator) {
      const count = arguments.length;
      const iterator = generator();
      let value = undefined;
      let done = false;

      do {
        ({ done, value } = iterator.next());

        if (value instanceof Promise) {
          keepPromise(value);
          value = undefined;
        } else {
          return value;
        }
      } while (!done);

      for (let index = 1; index < count; index += 1) {
        result = pipeline.call(this, result, arguments[index]);
      }

      return result;
    },

    ready(value) {
      const wrap = "function" === typeof this ? this : null;

      if (value instanceof Promise) {
        keepPromise(value);

        return undefined;
      } else {
        return wrap ? wrap(value) : value;
      }
    },

    getReady(wrap = pack) {
      const refer = "function" === typeof wrap ? wrap : null;

      return function READY() {
        return API.ready.apply(
          "function" === typeof this ? this : refer,
          arguments
        );
      };
    }
  });

  return Object.assign({}, API);
}

export const { untilReady, ready, getReady } = libReady();
