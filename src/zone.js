export function libZone({
  fenceTable = new Map(),
  fenceStack = [],
  labelledStacks = new Map()
} = {}) {
  const API = {
    zone(label, task) {
      const count = arguments.length;

      const depth = pushFence(
        Array.isArray(this) ? new FencedRegion(label, this) : null
      );

      const value = "function" === typeof task ? task() : undefined;

      for (let index = 2; index < count; index += 1) {
        pipeline(value, arguments[index]);
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

  function eachPush(value) {
    this.push(value);
  }

  Object.assign(API, {
    copyKeys(label, skip = 0) {
      const stack = labelledStacks.get(label) || [];
      const result = [];

      if (skip < stack.length) {
        stack[stack.length - 1 - skip].keys.forEach(eachPush, result);
      }

      return result;
    },
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
    region.keys.forEach(addKeyIndex, region);
    addLabelIndex(region);
    return fenceStack.push(region);
  }
  function popFence() {
    const region = fenceStack.pop();
    region.keys.forEach(dropKeyIndex, region);
    dropLabelIndex(region);
    return region;
  }
  function peekFence() {
    return fenceStack.length ? fenceStack[fenceStack.length - 1] : null;
  }

  function addKeyIndex(key) {
    const region = this;
    const index =
      fenceTable.get(key) || fenceTable.set(key, new Map()).get(key);
    index.set(region, key);
  }
  function dropKeyIndex(key) {
    const region = this;
    const index = fenceTable.get(key);
    if (index) {
      index.delete(region);
      if (!index.size) {
        fenceTable.delete(key);
      }
    }
  }

  function addLabelIndex(region) {
    const id = region.label;
    const stack = labelledStacks.get(id) || labelledStacks.set(id, []).get(id);
    stack.push(region);
  }
  function dropLabelIndex(region) {
    const id = region.label;
    const stack = labelledStacks.get(id);
    let at = stack.length - 1;

    if (at < 0 || stack[at] !== region) {
      at = stack.indexOf(region);
    }

    if (stack && at > -1) {
      if (at === stack.length - 1) {
        stack.pop();
      } else {
        stack.splice(at, 1);
      }

      if (!stack.length) {
        labelledStacks.delete(id);
      }
    }
  }

  class FencedRegion {
    constructor(label, options = []) {
      const count = Array.isArray(options) ? options.length : 0;

      this.label = label;
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
    unpack(wrapped) {
      const count = arguments.length;
      let result = undefined;
      let value = wrapped;

      if (Array.isArray(wrapped)) {
        value = wrapped.length ? wrapped[0] : undefined;
      }

      result = value;

      for (let index = 1; index < count; index += 1) {
        result = pipeline(value, arguments[index]);
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
