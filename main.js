
function parse (str) {
  try { return JSON.parse(str) }
  catch (e) { throw new Error("JSON parse error on "+str) }
}

module.exports = function (prefix, dump) {
  prefix = prefix || "";
  var handlers = {guard:[], string: Object.create(null)};
  var locks = Object.create(null);
  var cache = Object.create(null);
  (function () {
    var keys = [];
    for (var i=0; i < localStorage.length; i++)
      if (localStorage.key(i).indexOf(prefix) === 0)
        keys.push(localStorage.key(i).slice(prefix.length));
    if (dump) {
      var obj = JSON.parse(dump);
      for (var i=0; i<keys.length; i++)
        localStorage.removeItem(prefix+keys[i]);
      for (var key in obj) {
        try { localStorage.setItem(prefix+key, obj[key]) } catch (e) {}
        cache[key] = obj[key];
      }
    } else {
      for (var i=0; i<keys.length; i++)
        cache[keys[i]] = localStorage.getItem(prefix+keys[i]);
    }
  } ());
  function get (key) { return (key in cache) ? JSON.parse(cache[key]) : undefined }
  function update (key, val) {
    var old = get(key);
    if (old !== val) {
      var str = JSON.stringify(val);
      if (val === undefined) {
        delete cache[key];
        localStorage.removeItem(prefix+key);
      } else {
        cache[key] = str;
        localStorage.setItem(prefix+key, str);
      }
      if (key in handlers.string)
        handlers.string[key].forEach(function (h) { h([key], old, val) });
      handlers.guard.forEach(function (x) {
        var res = x.guard(key);
        if (res)
          x.handler(res, old, val);
      });
    }
  }
  return {
    get: get,
    select: function (rgx, onhit) {
      for (var key in cache) {
        var res = rgx.exec(key)
        if (res)
          onhit(res, JSON.parse(cache[key]));
      }
    },
    lock: function (key) {
      if (locks[key])
        throw new Error(key+" already locked");
      var pass = {
        set: update.bind(null, key),
        unlock: function () {
          if (locks[key] !== pass) 
            throw new Error("wrong pass for "+key);
          delete locks[key];
        }
      }
      return locks[key] = pass;
    },
    set: function (key, val) {
      if (locks[key])
        throw new Error(key+" is locked")
      update(key, val);
    },
    on: function (guard, handler) {
      if (typeof handler !== "function")
        throw new Error("handler should be a function; got "+handler);
      if (typeof guard === "string") {
        if (!(guard in handlers.string))
          handlers.string[guard] = [];
        return handlers.string[guard].push(handler);
      }
      if (guard instanceof RegExp)
        guard = RegExp.prototype.exec.bind(guard);
      if (typeof guard !== "function")
        throw new Error("guard should be either a string, regex or a function; got "+guard);
      handlers.guard.push({guard:guard, handler:handler});
    },
    off: function (handler) {
      for (var key in handlers.string) {
        handlers.string[key] = handlers.string[key].filter(function (h) { return h !== handler });
        if (handlers.string[key].length === 0)
          delete handlers.string[key];
      }
      handlers.guard = handlers.guard.filter(function (x) { return x.handler !== handler });
    },
    dump: function () { return JSON.stringify(cache) }
  }
};
