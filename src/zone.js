export function libZone({ fenceTable = new Map(), fenceStack = [] }) {
  const API = {
    zone(task) {
      const count = arguments.length;

      const depth = pushFence(
        Array.isArray(this) ? new FencedRegion(this) : null
      );

      const value = "function" === typeof task ? task() : undefined;

      for (let index = 1; index < count; index += 1) {
        notify.call(this, value, arguments[index]);
      }

      if (countFence() > depth) {
        // exception "handling"
        do {
          popFence();
        } while (countFence() > depth);
      }

      popFence();

      return value;
    },

    getZone(iterable) {
      const options = {
        keys: new Set()
      };
      const list = [options];

      if (iterable && "function" === typeof iterable.forEach) {
        iterable.forEach(options.keys.add, options.keys);
      }

      return function ZONE() {
        return API.zone.apply(
          this && "function" === typeof this.forEach ? [options, this] : list,
          arguments
        );
      };
    }
  };

  Object.assign(API, {
    readData(key) {
      const region = peekFence();
      return region ? region.data.get(key) : undefined;
    },
    writeData(key, update) {
      const index = fenceTable.get(key);

      if (index) {
        switch (update === null ? "" : typeof update) {
          case "function": {
            index.forEach(writeRegionPipe, update);
            break;
          }

          case "object": {
            index.forEach(writeRegionUnboxed, update);
            break;
          }

          default: {
            index.forEach(writeRegionBoxed, API.box(update));
            break;
          }
        }
      }
    }
  });

  function writeRegionPipe(key, region) {
    const update = this;

    region.data.set(key, update(region.data.get(key), key));
  }
  function writeRegionUnboxed(key, region) {
    const update = this;

    region.data.set(key, update);
  }
  function writeRegionBoxed(key, region) {
    const update = this;

    region.data.set(key, API.unpack(update));
  }

  function countFence() {
    return fenceStack.length;
  }
  function pushFence(region) {
    region.keys.forEach(addIndex, region);
    return fenceStack.push(region);
  }
  function popFence() {
    const region = fenceStack.pop();
    region.keys.forEach(dropIndex, region);
    return region;
  }
  function peekFence() {
    return fenceStack.length ? fenceStack[fenceStack.length - 1] : null;
  }

  function addIndex(key) {
    const region = this;
    const index =
      fenceTable.get(key) || fenceTable.set(key, new Map()).get(key);
    index.set(region, key);
  }
  function dropIndex(key) {
    const region = this;
    const index = fenceTable.get(key);
    if (index) {
      index.delete(region);
      if (!index.size) {
        fenceTable.delete(key);
      }
    }
  }

  class FencedRegion {
    constructor(options = []) {
      const count = Array.isArray(options) ? options.length : 0;

      this.keys = new Set();
      this.data = new Map();

      for (let index = 0; index < count; index += 1) {
        const keys = options[index] ? options[index].keys || null : null;

        if (Array.isArray(keys)) {
          keys.forEach(this.keys.add, this.keys);
        } else if (keys instanceof Set) {
          keys.forEach(this.keys.add, this.keys);
        } else if (keys instanceof Map) {
          keys.forEach(includeTruthy, this.keys);
          keys.forEach(excludeFalsey, this.keys);
        }
      }
    }
  }

  function includeTruthy(value, key) {
    if (value) {
      this.add(key);
    }
  }
  function excludeFalsey(value, key) {
    if (!value) {
      this.delete(key);
    }
  }

  Object.assign(API, {
    box(value) {
      return [value];
    },
    unpack(value) {
      const count = arguments.length;
      let result = value;

      if (Array.isArray(value)) {
        result = value.length ? value[0] : undefined;
      }

      for (let index = 1; index < count; index += 1) {
        result = pipeline.call(this, result, arguments[index]);
      }

      return result;
    }
  });

  return Object.assign({}, API);
}

export const { readData, writeData, box, unpack, getZone, zone } = libZone();

export function pipeline(value, handler) {
  const count = Array.isArray(handler) ? handler.length : 0;
  let result = value;

  for (let index = 0; index < count; index += 1) {
    result = pipeline.call(this, result, handler[index]);
  }

  if ("function" === typeof handler) {
    result = handler.call(this, result);
  }

  return result;
}

export function notify(value, handler) {
  const count = Array.isArray(handler) ? handler.length : 0;

  for (let index = 0; index < count; index += 1) {
    notify.call(this, value, handler[index]);
  }

  if ("function" === typeof handler) {
    handler.call(this, value);
  }

  return value;
}
