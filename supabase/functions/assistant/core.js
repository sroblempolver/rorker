// Generated from web/src/lib/assistant/core.ts by web/preview/build-function.mjs. Do not edit.
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/react/cjs/react.production.js
var require_react_production = __commonJS({
  "node_modules/react/cjs/react.production.js"(exports) {
    "use strict";
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
    var REACT_PORTAL_TYPE = Symbol.for("react.portal");
    var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
    var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
    var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
    var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
    var REACT_CONTEXT_TYPE = Symbol.for("react.context");
    var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
    var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
    var REACT_MEMO_TYPE = Symbol.for("react.memo");
    var REACT_LAZY_TYPE = Symbol.for("react.lazy");
    var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
    function getIteratorFn(maybeIterable) {
      if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    var ReactNoopUpdateQueue = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    };
    var assign = Object.assign;
    var emptyObject = {};
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables."
        );
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    function ComponentDummy() {
    }
    ComponentDummy.prototype = Component.prototype;
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
    pureComponentPrototype.constructor = PureComponent;
    assign(pureComponentPrototype, Component.prototype);
    pureComponentPrototype.isPureReactComponent = true;
    var isArrayImpl = Array.isArray;
    var ReactSharedInternals = { H: null, A: null, T: null, S: null, V: null };
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function ReactElement(type, key, self, source, owner, props) {
      self = props.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== self ? self : null,
        props
      };
    }
    function cloneAndReplaceKey(oldElement, newKey) {
      return ReactElement(
        oldElement.type,
        newKey,
        void 0,
        void 0,
        void 0,
        oldElement.props
      );
    }
    function isValidElement(object) {
      return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    var userProvidedKeyEscapeRegex = /\/+/g;
    function getElementKey(element, index2) {
      return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index2.toString(36);
    }
    function noop$1() {
    }
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch ("string" === typeof thenable.status ? thenable.then(noop$1, noop$1) : (thenable.status = "pending", thenable.then(
            function(fulfilledValue) {
              "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
            },
            function(error) {
              "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
            }
          )), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if ("undefined" === type || "boolean" === type) children = null;
      var invokeCallback = false;
      if (null === children) invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(
                  invokeCallback(children._payload),
                  array,
                  escapedPrefix,
                  nameSoFar,
                  callback
                );
            }
        }
      if (invokeCallback)
        return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c3) {
          return c3;
        })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
          callback,
          escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
            userProvidedKeyEscapeRegex,
            "$&/"
          ) + "/") + invokeCallback
        )), array.push(callback)), 1;
      invokeCallback = 0;
      var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i = 0; i < children.length; i++)
          nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if (i = getIteratorFn(children), "function" === typeof i)
        for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if ("object" === type) {
        if ("function" === typeof children.then)
          return mapIntoArray(
            resolveThenable(children),
            array,
            escapedPrefix,
            nameSoFar,
            callback
          );
        array = String(children);
        throw Error(
          "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
        );
      }
      return invokeCallback;
    }
    function mapChildren(children, func, context) {
      if (null == children) return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    function lazyInitializer(payload) {
      if (-1 === payload._status) {
        var ctor = payload._result;
        ctor = ctor();
        ctor.then(
          function(moduleObject) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 1, payload._result = moduleObject;
          },
          function(error) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 2, payload._result = error;
          }
        );
        -1 === payload._status && (payload._status = 0, payload._result = ctor);
      }
      if (1 === payload._status) return payload._result.default;
      throw payload._result;
    }
    var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    };
    function noop() {
    }
    exports.Children = {
      map: mapChildren,
      forEach: function(children, forEachFunc, forEachContext) {
        mapChildren(
          children,
          function() {
            forEachFunc.apply(this, arguments);
          },
          forEachContext
        );
      },
      count: function(children) {
        var n = 0;
        mapChildren(children, function() {
          n++;
        });
        return n;
      },
      toArray: function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      },
      only: function(children) {
        if (!isValidElement(children))
          throw Error(
            "React.Children.only expected to receive a single React element child."
          );
        return children;
      }
    };
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(size) {
        return ReactSharedInternals.H.useMemoCache(size);
      }
    };
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cloneElement = function(element, config, children) {
      if (null === element || void 0 === element)
        throw Error(
          "The argument must be a React element, but you passed " + element + "."
        );
      var props = assign({}, element.props), key = element.key, owner = void 0;
      if (null != config)
        for (propName in void 0 !== config.ref && (owner = void 0), void 0 !== config.key && (key = "" + config.key), config)
          !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
      var propName = arguments.length - 2;
      if (1 === propName) props.children = children;
      else if (1 < propName) {
        for (var childArray = Array(propName), i = 0; i < propName; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      return ReactElement(element.type, key, void 0, void 0, owner, props);
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      var propName, props = {}, key = null;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (1 === childrenLength) props.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          void 0 === props[propName] && (props[propName] = childrenLength[propName]);
      return ReactElement(type, key, void 0, void 0, null, props);
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(render) {
      return { $$typeof: REACT_FORWARD_REF_TYPE, render };
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      return {
        $$typeof: REACT_LAZY_TYPE,
        _payload: { _status: -1, _result: ctor },
        _init: lazyInitializer
      };
    };
    exports.memo = function(type, compare) {
      return {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: void 0 === compare ? null : compare
      };
    };
    exports.startTransition = function(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
      } catch (error) {
        reportGlobalError(error);
      } finally {
        ReactSharedInternals.T = prevTransition;
      }
    };
    exports.unstable_useCacheRefresh = function() {
      return ReactSharedInternals.H.useCacheRefresh();
    };
    exports.use = function(usable) {
      return ReactSharedInternals.H.use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return ReactSharedInternals.H.useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return ReactSharedInternals.H.useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      return ReactSharedInternals.H.useContext(Context);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(value, initialValue) {
      return ReactSharedInternals.H.useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, createDeps, update) {
      var dispatcher = ReactSharedInternals.H;
      if ("function" === typeof update)
        throw Error(
          "useEffect CRUD overload is not enabled in this build of React."
        );
      return dispatcher.useEffect(create, createDeps);
    };
    exports.useId = function() {
      return ReactSharedInternals.H.useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
      return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
      return ReactSharedInternals.H.useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
      return ReactSharedInternals.H.useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
      return ReactSharedInternals.H.useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return ReactSharedInternals.H.useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return ReactSharedInternals.H.useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return ReactSharedInternals.H.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
      );
    };
    exports.useTransition = function() {
      return ReactSharedInternals.H.useTransition();
    };
    exports.version = "19.1.0";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    "production" !== process.env.NODE_ENV && (function() {
      function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              info[0],
              info[1]
            );
          }
        });
      }
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable)
          return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          callerName,
          publicInstance
        ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
      }
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function ComponentDummy() {
      }
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return (type.displayName || "Context") + ".Provider";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x2) {
              }
          }
        return null;
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x2) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, self, source, owner, props, debugStack, debugTask) {
        self = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== self ? self : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(
          oldElement.type,
          newKey,
          void 0,
          void 0,
          oldElement._owner,
          oldElement.props,
          oldElement._debugStack,
          oldElement._debugTask
        );
        oldElement._store && (newKey._store.validated = oldElement._store.validated);
        return newKey;
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      function getElementKey(element, index2) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index2.toString(36);
      }
      function noop$1() {
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop$1, noop$1) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback) {
          invokeCallback = children;
          callback = callback(invokeCallback);
          var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
          isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c3) {
            return c3;
          })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + childKey
          ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
          return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (i === children.entries && (didWarnAboutMaps || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), didWarnAboutMaps = true), children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ctor = payload._result;
          ctor = ctor();
          ctor.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 1, payload._result = moduleObject;
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 2, payload._result = error;
            }
          );
          -1 === payload._status && (payload._status = 0, payload._result = ctor);
        }
        if (1 === payload._status)
          return ctor = payload._result, void 0 === ctor && console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
            ctor
          ), "default" in ctor || console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
            ctor
          ), ctor.default;
        throw payload._result;
      }
      function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error(
          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
        );
        return dispatcher;
      }
      function noop() {
      }
      function enqueueTask(task) {
        if (null === enqueueTaskImpl)
          try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(
              module,
              "timers"
            ).setImmediate;
          } catch (_err) {
            enqueueTaskImpl = function(callback) {
              false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var channel = new MessageChannel();
              channel.port1.onmessage = callback;
              channel.port2.postMessage(void 0);
            };
          }
        return enqueueTaskImpl(task);
      }
      function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
      }
      function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        );
        actScopeDepth = prevActScopeDepth;
      }
      function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
        var queue = ReactSharedInternals.actQueue;
        if (null !== queue)
          if (0 !== queue.length)
            try {
              flushActQueue(queue);
              enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
              });
              return;
            } catch (error) {
              ReactSharedInternals.thrownErrors.push(error);
            }
          else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
      }
      function flushActQueue(queue) {
        if (!isFlushing) {
          isFlushing = true;
          var i = 0;
          try {
            for (; i < queue.length; i++) {
              var callback = queue[i];
              do {
                ReactSharedInternals.didUsePromise = false;
                var continuation = callback(false);
                if (null !== continuation) {
                  if (ReactSharedInternals.didUsePromise) {
                    queue[i] = callback;
                    queue.splice(0, i);
                    return;
                  }
                  callback = continuation;
                } else break;
              } while (1);
            }
            queue.length = 0;
          } catch (error) {
            queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
          } finally {
            isFlushing = false;
          }
        }
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
      Symbol.for("react.provider");
      var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function(publicInstance) {
          warnNoop(publicInstance, "forceUpdate");
        },
        enqueueReplaceState: function(publicInstance) {
          warnNoop(publicInstance, "replaceState");
        },
        enqueueSetState: function(publicInstance) {
          warnNoop(publicInstance, "setState");
        }
      }, assign = Object.assign, emptyObject = {};
      Object.freeze(emptyObject);
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      var deprecatedAPIs = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      }, fnName;
      for (fnName in deprecatedAPIs)
        deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
      ComponentDummy.prototype = Component.prototype;
      deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
      deprecatedAPIs.constructor = PureComponent;
      assign(deprecatedAPIs, Component.prototype);
      deprecatedAPIs.isPureReactComponent = true;
      var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        V: null,
        actQueue: null,
        isBatchingLegacy: false,
        didScheduleLegacyUpdate: false,
        didUsePromise: false,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      deprecatedAPIs = {
        "react-stack-bottom-frame": function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = deprecatedAPIs["react-stack-bottom-frame"].bind(deprecatedAPIs, UnknownOwner)();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
          return queueMicrotask(callback);
        });
      } : enqueueTask;
      deprecatedAPIs = Object.freeze({
        __proto__: null,
        c: function(size) {
          return resolveDispatcher().useMemoCache(size);
        }
      });
      exports.Children = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = deprecatedAPIs;
      exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
        try {
          var result = callback();
        } catch (error) {
          ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
          var thenable = result;
          queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          });
          return {
            then: function(resolve, reject) {
              didAwaitActCall = true;
              thenable.then(
                function(returnValue) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  if (0 === prevActScopeDepth) {
                    try {
                      flushActQueue(queue), enqueueTask(function() {
                        return recursivelyFlushAsyncActWork(
                          returnValue,
                          resolve,
                          reject
                        );
                      });
                    } catch (error$0) {
                      ReactSharedInternals.thrownErrors.push(error$0);
                    }
                    if (0 < ReactSharedInternals.thrownErrors.length) {
                      var _thrownError = aggregateErrors(
                        ReactSharedInternals.thrownErrors
                      );
                      ReactSharedInternals.thrownErrors.length = 0;
                      reject(_thrownError);
                    }
                  } else resolve(returnValue);
                },
                function(error) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                    ReactSharedInternals.thrownErrors
                  ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                }
              );
            }
          };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
          then: function(resolve, reject) {
            didAwaitActCall = true;
            0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
              return recursivelyFlushAsyncActWork(
                returnValue$jscomp$0,
                resolve,
                reject
              );
            })) : resolve(returnValue$jscomp$0);
          }
        };
      };
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.captureOwnerStack = function() {
        var getCurrentStack = ReactSharedInternals.getCurrentStack;
        return null === getCurrentStack ? null : getCurrentStack();
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
          var JSCompiler_inline_result;
          a: {
            if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
              config,
              "ref"
            ).get) && JSCompiler_inline_result.isReactWarning) {
              JSCompiler_inline_result = false;
              break a;
            }
            JSCompiler_inline_result = void 0 !== config.ref;
          }
          JSCompiler_inline_result && (owner = getOwner());
          hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
          for (propName in config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          JSCompiler_inline_result = Array(propName);
          for (var i = 0; i < propName; i++)
            JSCompiler_inline_result[i] = arguments[i + 2];
          props.children = JSCompiler_inline_result;
        }
        props = ReactElement(
          element.type,
          key,
          void 0,
          void 0,
          owner,
          props,
          element._debugStack,
          element._debugTask
        );
        for (key = 2; key < arguments.length; key++)
          owner = arguments[key], isValidElement(owner) && owner._store && (owner._store.validated = 1);
        return props;
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        for (var i = 2; i < arguments.length; i++) {
          var node = arguments[i];
          isValidElement(node) && node._store && (node._store.validated = 1);
        }
        i = {};
        node = null;
        if (null != config)
          for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), hasValidKey(config) && (checkKeyStringCoercion(config.key), node = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
            childArray[_i] = arguments[_i + 2];
          Object.freeze && Object.freeze(childArray);
          i.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === i[propName] && (i[propName] = childrenLength[propName]);
        node && defineKeyPropWarningGetter(
          i,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return ReactElement(
          type,
          node,
          void 0,
          void 0,
          getOwner(),
          i,
          propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.createRef = function() {
        var refObject = { current: null };
        Object.seal(refObject);
        return refObject;
      };
      exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : "function" !== typeof render ? console.error(
          "forwardRef requires a render function but was given %s.",
          null === render ? "null" : typeof render
        ) : 0 !== render.length && 2 !== render.length && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        );
        null != render && null != render.defaultProps && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
        Object.defineProperty(elementType, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
          }
        });
        return elementType;
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        return {
          $$typeof: REACT_LAZY_TYPE,
          _payload: { _status: -1, _result: ctor },
          _init: lazyInitializer
        };
      };
      exports.memo = function(type, compare) {
        null == type && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          null === type ? "null" : typeof type
        );
        compare = {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
          }
        });
        return compare;
      };
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        ReactSharedInternals.T = currentTransition;
        currentTransition._updatedFibers = /* @__PURE__ */ new Set();
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), ReactSharedInternals.T = prevTransition;
        }
      };
      exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
      };
      exports.use = function(usable) {
        return resolveDispatcher().use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(
          action,
          initialState,
          permalink
        );
      };
      exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        );
        return dispatcher.useContext(Context);
      };
      exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
      };
      exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, createDeps, update) {
        null == create && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        var dispatcher = resolveDispatcher();
        if ("function" === typeof update)
          throw Error(
            "useEffect CRUD overload is not enabled in this build of React."
          );
        return dispatcher.useEffect(create, createDeps);
      };
      exports.useId = function() {
        return resolveDispatcher().useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return resolveDispatcher().useTransition();
      };
      exports.version = "19.1.0";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production();
    } else {
      module.exports = require_react_development();
    }
  }
});

// src/lib/plan/standards.ts
var import_react = __toESM(require_react());
var defs = /* @__PURE__ */ new Map();
var STORE = "rorker.standards";
var overrides = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") ?? {};
  } catch {
    return {};
  }
})();
var listeners = /* @__PURE__ */ new Set();
var version = 0;
var emit = () => {
  version++;
  for (const l of listeners) l();
};
function defineStandards(list) {
  for (const d2 of list) if (!defs.has(d2.key)) defs.set(d2.key, d2);
  emit();
}

// src/lib/plan/rules.ts
var inch = (n) => n * 25.4;
var RULES = {
  /** floor to floor 10' 1", finished floor to ceiling 9' (8' is the other common one), floor framing 8" */
  storey: inch(121),
  ceiling: inch(108),
  slab: inch(8),
  /** 2x6 outside walls with sheathing, siding and drywall about 7"; 2x4 inside walls with drywall 4½" */
  wallExterior: inch(7),
  wallInterior: inch(4.5),
  /** windows: 36" sill and 80" head, lined up with the doors; bathrooms 48" (privacy), kitchens 42" (over the counter) */
  sill: inch(36),
  sillWet: inch(48),
  sillKitchen: inch(42),
  head: inch(80),
  /** doors: interior and entry 6' 8", garage 7', a cased opening 7' */
  doorHead: inch(80),
  garageHead: inch(84),
  openingHead: inch(84),
  /** pitched roofs: main roof 6/12, low roofs over a garage or porch 4/12, eaves 18" out, 8" fascia */
  pitch: 26.6,
  lowPitch: 18.4,
  eave: inch(18),
  fascia: inch(8),
  flatOverhang: inch(6),
  /** the ground floor sits on a foundation 18" above the grade; steps 7½" up and 11" deep */
  plinth: inch(18),
  step: inch(7.5),
  tread: inch(11),
  /** guards on balconies and porches more than 30" up: 36" (IRC) */
  railing: inch(36),
  /** paths and drives: a 4' walk */
  walk: inch(48)
};
defineStandards([
  { key: "house.ceiling", group: "House", label: "Ceiling height", value: RULES.ceiling, unit: "len", help: "Finished floor to ceiling, for each new floor. Change one floor in This floor." },
  { key: "house.storey", group: "House", label: "Floor to floor", value: RULES.storey, unit: "len", help: "Ceiling height plus the floor framing above it." },
  { key: "house.plinth", group: "House", label: "Foundation above the ground", value: RULES.plinth, unit: "len", help: "How far the ground floor sits above the yard: two steps up." },
  { key: "roof.pitch", group: "Roof", label: "Main roof pitch", value: RULES.pitch, unit: "deg", help: "26.6\xB0 is 6 in 12, the usual pitch for a shingled roof." },
  { key: "roof.lowPitch", group: "Roof", label: "Porch and garage roof pitch", value: RULES.lowPitch, unit: "deg", help: "18.4\xB0 is 4 in 12, for the low roofs against the house." },
  { key: "roof.eave", group: "Roof", label: "Eaves overhang", value: RULES.eave, unit: "len", help: "How far a pitched roof sticks out past the walls." },
  { key: "roof.flatOverhang", group: "Roof", label: "Flat roof overhang", value: RULES.flatOverhang, unit: "len" }
]);

// src/lib/plan/catalog-extra.ts
var b = (x2, y2, z2, w2, d2, h, color) => ({ shape: "box", x: x2, y: y2, z: z2, w: w2, d: d2, h, color });
var c = (x2, y2, z2, w2, d2, h, color) => ({ shape: "cylinder", x: x2, y: y2, z: z2, w: w2, d: d2, h, color });
var s = (x2, y2, z2, w2, d2, h, color) => ({ shape: "sphere", x: x2, y: y2, z: z2, w: w2, d: d2, h, color });
var legs = (w2, d2, h, t, col, inset = 40) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => b(i * (w2 / 2 - inset), 0, j * (d2 / 2 - inset), t, t, h, col));
var WOOD = "#a07850";
var DARK = "#8a6a48";
var WHITE = "#f4efe6";
var STEEL = "#b9bec4";
var BLACK = "#232426";
var INK = "#1b1a17";
var FABRIC = "#6f7486";
var GREY = "#7d8187";
var GREEN = "#3f7a4a";
var RED = "#b8473a";
var COUNTERS = ["base_cabinet", "island", "kitchen_sink", "sideboard", "table", "kitchen_cart"];
var EXTRA = {
  // kitchen
  wall_oven: {
    label: "Wall oven",
    w: 600,
    d: 600,
    h: 2200,
    kg: 110,
    mount: "floor",
    face: "room",
    words: ["double oven", "oven tower"],
    fill: "#d9d2c4",
    parts: [b(0, 0, 0, 600, 600, 2200, "#d9d2c4"), b(0, 900, 302, 540, 4, 560, BLACK), b(0, 1500, 302, 540, 4, 300, BLACK), b(0, 1480, 310, 420, 20, 20, STEEL)]
  },
  wine_cooler: {
    label: "Wine cooler",
    w: 600,
    d: 570,
    h: 870,
    kg: 40,
    mount: "floor",
    face: "room",
    words: ["wine fridge"],
    fill: BLACK,
    parts: [b(0, 0, 0, 600, 570, 870, BLACK), b(0, 60, 287, 520, 4, 760, "#5d7f9e"), ...[200, 360, 520, 680].map((y2) => b(0, y2, 270, 500, 20, 30, "#7a3b2e"))]
  },
  chest_freezer: {
    label: "Chest freezer",
    w: 1100,
    d: 650,
    h: 850,
    kg: 45,
    mount: "floor",
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, 0, 1100, 650, 820, WHITE), b(0, 820, 0, 1110, 660, 40, WHITE), b(0, 760, 330, 300, 20, 30, GREY)]
  },
  blender: {
    label: "Blender",
    w: 180,
    d: 200,
    h: 420,
    kg: 4,
    mount: "surface",
    on: COUNTERS,
    back: true,
    face: "with",
    fill: BLACK,
    parts: [b(0, 0, 0, 180, 200, 150, BLACK), c(0, 150, 0, 140, 140, 240, "#cfe6ee"), c(0, 390, 0, 150, 150, 30, BLACK)]
  },
  stand_mixer: {
    label: "Stand mixer",
    w: 220,
    d: 350,
    h: 360,
    kg: 10,
    mount: "surface",
    on: COUNTERS,
    back: true,
    face: "with",
    fill: RED,
    parts: [b(0, 0, 0, 220, 350, 40, RED), b(0, 40, -120, 100, 100, 240, RED), b(0, 260, 0, 140, 340, 100, RED), c(0, 40, 50, 200, 200, 150, STEEL)]
  },
  air_fryer: {
    label: "Air fryer",
    w: 280,
    d: 340,
    h: 320,
    kg: 5,
    mount: "surface",
    on: COUNTERS,
    back: true,
    face: "with",
    fill: BLACK,
    parts: [b(0, 0, 0, 280, 340, 320, BLACK), b(0, 40, 172, 220, 4, 140, "#3b3c40"), b(0, 100, 180, 60, 30, 30, GREY)]
  },
  trash_can: {
    label: "Trash can",
    w: 350,
    d: 300,
    h: 650,
    kg: 4,
    mount: "floor",
    face: "room",
    words: ["bin", "garbage can", "waste bin"],
    fill: STEEL,
    parts: [b(0, 0, 0, 350, 300, 620, STEEL), b(0, 620, 0, 360, 310, 30, GREY), b(0, 0, 160, 120, 40, 20, BLACK)]
  },
  recycling_bin: {
    label: "Recycling bin",
    w: 400,
    d: 350,
    h: 650,
    kg: 4,
    mount: "floor",
    face: "room",
    fill: "#3a6ea5",
    parts: [b(0, 0, 0, 400, 350, 620, "#3a6ea5"), b(0, 620, 0, 410, 360, 30, "#2c5480")]
  },
  kitchen_cart: {
    label: "Kitchen cart",
    w: 800,
    d: 450,
    h: 900,
    kg: 25,
    mount: "floor",
    face: "room",
    words: ["trolley", "butcher block"],
    fill: WOOD,
    parts: [b(0, 860, 0, 800, 450, 40, WOOD), b(0, 150, 0, 740, 400, 20, WOOD), b(0, 480, 0, 740, 400, 20, WOOD), ...legs(800, 450, 860, 40, STEEL, 25)]
  },
  water_dispenser: {
    label: "Water dispenser",
    w: 320,
    d: 340,
    h: 1300,
    kg: 15,
    mount: "floor",
    face: "room",
    words: ["water cooler"],
    fill: WHITE,
    parts: [b(0, 0, 0, 320, 340, 950, WHITE), c(0, 950, 0, 270, 270, 350, "#8fd3f0"), b(0, 600, 172, 160, 4, 120, GREY)]
  },
  dish_rack: {
    label: "Dish rack",
    w: 450,
    d: 330,
    h: 150,
    kg: 1.5,
    mount: "surface",
    on: COUNTERS,
    face: "with",
    words: ["drying rack for dishes"],
    fill: STEEL,
    parts: [b(0, 0, 0, 450, 330, 20, STEEL), ...[-150, -75, 0, 75, 150].map((x2) => b(x2, 20, 0, 8, 260, 130, STEEL))]
  },
  // bathroom
  bidet: {
    label: "Bidet",
    w: 380,
    d: 560,
    h: 400,
    kg: 25,
    mount: "floor",
    face: "room",
    fill: WHITE,
    parts: [c(0, 0, 40, 380, 520, 400, WHITE), b(0, 320, -230, 120, 60, 80, STEEL)]
  },
  urinal: {
    label: "Urinal",
    w: 360,
    d: 340,
    h: 650,
    kg: 20,
    mount: "wall",
    at: 450,
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, -50, 360, 240, 650, WHITE), c(0, 60, 40, 300, 200, 300, "#e4dfd4")]
  },
  medicine_cabinet: {
    label: "Medicine cabinet",
    w: 600,
    d: 140,
    h: 700,
    kg: 12,
    mount: "wall",
    at: 1200,
    face: "room",
    words: ["mirror cabinet"],
    fill: "#8fd3f0",
    parts: [b(0, 0, 0, 600, 140, 700, WHITE), b(0, 20, 72, 560, 4, 660, "#cfe6ee")]
  },
  towel_bar: {
    label: "Towel bar",
    w: 600,
    d: 80,
    h: 60,
    kg: 1,
    mount: "wall",
    at: 1150,
    face: "room",
    words: ["towel rail", "towel rack"],
    fill: STEEL,
    parts: [c(0, 20, 30, 600, 20, 20, STEEL), b(-280, 0, -20, 20, 60, 60, STEEL), b(280, 0, -20, 20, 60, 60, STEEL), b(0, -300, 20, 400, 20, 320, "#d8c9a8")]
  },
  toilet_roll_holder: {
    label: "Toilet roll holder",
    w: 160,
    d: 110,
    h: 110,
    kg: 0.4,
    mount: "wall",
    at: 650,
    face: "room",
    words: ["toilet paper holder"],
    fill: WHITE,
    parts: [b(0, 40, -45, 160, 20, 30, STEEL), c(0, 0, 10, 120, 110, 110, WHITE)]
  },
  laundry_hamper: {
    label: "Laundry hamper",
    w: 450,
    d: 350,
    h: 650,
    kg: 3,
    mount: "floor",
    face: "room",
    words: ["clothes basket", "laundry basket"],
    fill: "#c9b38c",
    parts: [b(0, 0, 0, 450, 350, 620, "#c9b38c"), b(0, 620, 0, 460, 360, 30, "#b29b72")]
  },
  // bedroom
  bunk_bed: {
    label: "Bunk bed",
    w: 1e3,
    d: 2050,
    h: 1650,
    kg: 85,
    mount: "floor",
    face: "room",
    fill: WOOD,
    parts: [...legs(1e3, 2050, 1650, 70, WOOD, 35), b(0, 200, 0, 980, 2e3, 160, WOOD), b(0, 360, 0, 920, 1950, 180, "#e9e3d6"), b(0, 1050, 0, 980, 2e3, 160, WOOD), b(0, 1210, 0, 920, 1950, 180, "#e9e3d6"), b(0, 1450, -1e3, 980, 30, 150, WOOD), b(460, 300, 600, 40, 40, 1300, WOOD)]
  },
  sofa_bed: { label: "Sofa bed", w: 2e3, d: 950, h: 850, kg: 75, mount: "floor", face: "to", to: ["tv", "coffee_table"], words: ["futon", "daybed"], like: "sofa", fill: FABRIC },
  blanket_chest: {
    label: "Blanket chest",
    w: 1e3,
    d: 450,
    h: 480,
    kg: 25,
    mount: "floor",
    face: "room",
    words: ["chest", "trunk", "toy box", "storage chest"],
    fill: DARK,
    parts: [b(0, 0, 0, 1e3, 450, 440, DARK), b(0, 440, 0, 1010, 460, 40, WOOD), b(0, 300, 227, 120, 10, 40, STEEL)]
  },
  dressing_table: {
    label: "Dressing table",
    w: 1e3,
    d: 450,
    h: 1450,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["vanity table", "makeup table"],
    users: ["bar_stool", "chair"],
    fill: WHITE,
    parts: [b(0, 720, 0, 1e3, 450, 40, WHITE), b(-380, 0, 0, 240, 440, 720, WHITE), b(380, 0, 0, 240, 440, 720, WHITE), b(0, 760, -200, 700, 30, 690, "#cfe6ee")]
  },
  floor_mirror: {
    label: "Floor mirror",
    w: 600,
    d: 300,
    h: 1700,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["full length mirror", "standing mirror"],
    fill: "#8fd3f0",
    parts: [b(0, 0, -100, 600, 40, 1700, DARK), b(0, 30, -78, 540, 4, 1640, "#cfe6ee"), b(0, 0, 50, 40, 250, 40, DARK)]
  },
  clothes_rack: {
    label: "Clothes rack",
    w: 1200,
    d: 450,
    h: 1600,
    kg: 9,
    mount: "floor",
    face: "room",
    words: ["garment rack", "clothes rail"],
    fill: STEEL,
    parts: [b(0, 0, 0, 1200, 450, 30, STEEL), b(-580, 0, 0, 30, 30, 1600, STEEL), b(580, 0, 0, 30, 30, 1600, STEEL), c(0, 1560, 0, 1180, 30, 30, STEEL), ...[-400, -200, 0, 200, 400].map((x2, i) => b(x2, 600, 0, 60, 380, 920, ["#5d7f9e", "#b8473a", "#e9e3d6", "#3f7a4a", "#2b2c30"][i]))]
  },
  bench: {
    label: "Bench",
    w: 1200,
    d: 400,
    h: 450,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["bed bench", "entry bench"],
    fill: WOOD,
    parts: [b(0, 410, 0, 1200, 400, 40, WOOD), ...legs(1200, 400, 410, 50, WOOD, 60)]
  },
  changing_table: {
    label: "Changing table",
    w: 800,
    d: 500,
    h: 950,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["baby changer"],
    fill: WHITE,
    parts: [b(0, 0, 0, 800, 500, 900, WHITE), b(0, 900, -20, 780, 460, 50, "#cfe6ee"), ...[200, 480, 760].map((y2) => b(0, y2 - 180, 252, 740, 4, 2, GREY))]
  },
  // living
  sectional_sofa: {
    label: "Corner sofa",
    w: 2700,
    d: 1700,
    h: 850,
    kg: 110,
    mount: "floor",
    face: "to",
    to: ["tv", "coffee_table", "fireplace"],
    words: ["sectional", "l sofa", "l-shaped sofa"],
    fill: FABRIC,
    parts: [b(0, 0, 400, 2700, 900, 420, FABRIC), b(0, 420, -50, 2700, 220, 430, FABRIC), b(1050, 0, -400, 600, 900, 420, FABRIC), b(1240, 420, -400, 220, 900, 430, FABRIC), b(-1260, 420, 400, 180, 900, 220, FABRIC), b(-50, 420, 470, 2400, 640, 90, "#7d8296")]
  },
  loveseat: { label: "Loveseat", w: 1500, d: 880, h: 850, kg: 40, mount: "floor", face: "to", to: ["tv", "coffee_table", "fireplace"], words: ["2 seat sofa", "two seater"], like: "sofa", fill: FABRIC },
  recliner: {
    label: "Recliner",
    w: 900,
    d: 950,
    h: 1050,
    kg: 45,
    mount: "floor",
    face: "to",
    to: ["tv", "coffee_table", "fireplace"],
    words: ["reclining chair", "lazy boy"],
    fill: "#5a4a40",
    parts: [b(0, 0, 0, 900, 950, 450, "#5a4a40"), b(0, 450, -380, 900, 200, 600, "#5a4a40"), b(-370, 450, 0, 160, 900, 220, "#5a4a40"), b(370, 450, 0, 160, 900, 220, "#5a4a40"), b(0, 450, 80, 580, 700, 90, "#6b594d")]
  },
  ottoman: {
    label: "Ottoman",
    w: 600,
    d: 600,
    h: 420,
    kg: 8,
    mount: "floor",
    face: "any",
    words: ["footstool", "pouf", "pouffe"],
    fill: FABRIC,
    parts: [b(0, 40, 0, 600, 600, 380, FABRIC), ...legs(600, 600, 40, 40, DARK, 40)]
  },
  bean_bag: {
    label: "Bean bag",
    w: 900,
    d: 900,
    h: 700,
    kg: 5,
    mount: "floor",
    face: "any",
    fill: "#b0623a",
    parts: [s(0, 0, 0, 900, 900, 520, "#b0623a"), s(0, 300, -200, 700, 400, 420, "#b0623a")]
  },
  side_table: {
    label: "Side table",
    w: 500,
    d: 500,
    h: 550,
    kg: 6,
    mount: "floor",
    face: "any",
    words: ["end table", "lamp table"],
    fill: WOOD,
    parts: [b(0, 520, 0, 500, 500, 30, WOOD), b(0, 150, 0, 440, 440, 20, WOOD), ...legs(500, 500, 520, 35, WOOD, 30)]
  },
  console_table: {
    label: "Console table",
    w: 1200,
    d: 350,
    h: 780,
    kg: 18,
    mount: "floor",
    face: "room",
    words: ["hall table", "entry table"],
    fill: WOOD,
    parts: [b(0, 740, 0, 1200, 350, 40, WOOD), b(0, 150, 0, 1120, 300, 20, WOOD), ...legs(1200, 350, 740, 40, DARK, 30)]
  },
  floor_speaker: {
    label: "Floor speaker",
    w: 220,
    d: 300,
    h: 1e3,
    kg: 18,
    mount: "floor",
    face: "to",
    to: ["sofa", "armchair"],
    words: ["tower speaker", "speaker"],
    fill: BLACK,
    parts: [b(0, 0, 0, 220, 300, 1e3, BLACK), c(0, 620, 152, 160, 4, 160, "#3b3c40"), c(0, 380, 152, 160, 4, 160, "#3b3c40"), c(0, 850, 152, 60, 4, 60, "#3b3c40")]
  },
  soundbar: {
    label: "Soundbar",
    w: 900,
    d: 100,
    h: 70,
    kg: 3,
    mount: "surface",
    on: ["sideboard", "dresser", "console_table"],
    face: "with",
    fill: BLACK,
    parts: [b(0, 0, 0, 900, 100, 70, BLACK), b(0, 10, 51, 860, 2, 50, "#3b3c40")]
  },
  game_console: {
    label: "Game console",
    w: 300,
    d: 260,
    h: 80,
    kg: 4,
    mount: "surface",
    on: ["sideboard", "dresser", "console_table", "desk"],
    face: "with",
    words: ["playstation", "xbox", "console"],
    fill: WHITE,
    parts: [b(0, 0, 0, 300, 260, 80, WHITE), b(0, 30, 131, 200, 2, 6, "#55b2ff")]
  },
  aquarium: {
    label: "Aquarium",
    w: 1e3,
    d: 400,
    h: 1300,
    kg: 160,
    mount: "floor",
    face: "room",
    words: ["fish tank"],
    fill: "#3a6ea5",
    parts: [b(0, 0, 0, 1e3, 400, 750, BLACK), b(0, 750, 0, 1e3, 400, 500, "#5aa9d6"), b(0, 750, 0, 960, 360, 60, "#c9b38c"), b(-250, 810, 0, 60, 60, 260, GREEN), b(0, 1250, 0, 1010, 410, 50, BLACK)]
  },
  grandfather_clock: {
    label: "Grandfather clock",
    w: 500,
    d: 300,
    h: 2e3,
    kg: 60,
    mount: "floor",
    face: "room",
    words: ["tall clock", "longcase clock"],
    fill: DARK,
    parts: [b(0, 0, 0, 500, 300, 300, DARK), b(0, 300, 0, 400, 260, 1200, DARK), b(0, 1500, 0, 500, 300, 500, DARK), c(0, 1600, 152, 320, 4, 320, WHITE), b(0, 600, 132, 60, 4, 700, "#c9a46a")]
  },
  wall_clock: {
    label: "Wall clock",
    w: 350,
    d: 50,
    h: 350,
    kg: 1.5,
    mount: "wall",
    at: 1800,
    face: "room",
    fill: WHITE,
    parts: [c(0, 0, 0, 350, 50, 350, BLACK), c(0, 15, 6, 320, 40, 320, WHITE)]
  },
  coat_rack: {
    label: "Coat rack",
    w: 450,
    d: 450,
    h: 1800,
    kg: 6,
    mount: "floor",
    face: "any",
    words: ["coat stand", "hat stand"],
    fill: DARK,
    parts: [c(0, 0, 0, 420, 420, 40, DARK), c(0, 40, 0, 40, 40, 1760, DARK), b(0, 1650, 0, 400, 30, 30, DARK), b(0, 1650, 0, 30, 400, 30, DARK), b(-150, 1100, 0, 200, 200, 600, "#5d7f9e")]
  },
  umbrella_stand: {
    label: "Umbrella stand",
    w: 250,
    d: 250,
    h: 550,
    kg: 3,
    mount: "floor",
    face: "any",
    fill: STEEL,
    parts: [c(0, 0, 0, 250, 250, 550, STEEL), b(-40, 450, 0, 30, 30, 350, RED), b(50, 450, 30, 30, 30, 300, BLACK)]
  },
  bar_cart: {
    label: "Bar cart",
    w: 750,
    d: 430,
    h: 850,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["drinks trolley"],
    fill: "#c9a46a",
    parts: [b(0, 830, 0, 750, 430, 20, "#c9a46a"), b(0, 250, 0, 750, 430, 20, "#c9a46a"), ...legs(750, 430, 830, 20, "#c9a46a", 15), c(-200, 850, 0, 80, 80, 280, GREEN), c(-80, 850, 0, 80, 80, 300, "#7a3b2e")]
  },
  room_divider: {
    label: "Room divider",
    w: 1500,
    d: 400,
    h: 1800,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["folding screen", "partition screen"],
    fill: "#d8c9a8",
    parts: [-500, 0, 500].map((x2, i) => b(x2, 0, i === 1 ? 100 : -100, 480, 30, 1800, "#d8c9a8"))
  },
  chaise_longue: {
    label: "Chaise longue",
    w: 700,
    d: 1700,
    h: 850,
    kg: 35,
    mount: "floor",
    face: "room",
    words: ["chaise", "lounger"],
    fill: FABRIC,
    parts: [b(0, 0, 0, 700, 1700, 420, FABRIC), b(0, 420, -700, 700, 300, 430, FABRIC), b(0, 420, 100, 640, 1300, 80, "#7d8296")]
  },
  // dining
  round_dining_table: {
    label: "Round dining table",
    w: 1200,
    d: 1200,
    h: 750,
    kg: 40,
    mount: "floor",
    face: "any",
    words: ["round table"],
    fill: WOOD,
    parts: [c(0, 710, 0, 1200, 1200, 40, WOOD), c(0, 40, 0, 160, 160, 670, WOOD), c(0, 0, 0, 600, 600, 40, WOOD)]
  },
  china_cabinet: {
    label: "China cabinet",
    w: 1e3,
    d: 450,
    h: 1950,
    kg: 85,
    mount: "floor",
    face: "room",
    words: ["display cabinet", "hutch", "vitrine"],
    fill: DARK,
    parts: [b(0, 0, 0, 1e3, 450, 850, DARK), b(0, 850, 40, 1e3, 380, 1100, DARK), b(0, 900, 232, 920, 4, 1e3, "#cfe6ee"), ...[1200, 1550].map((y2) => b(0, y2, 40, 960, 340, 20, WOOD))]
  },
  high_chair: {
    label: "High chair",
    w: 550,
    d: 650,
    h: 1050,
    kg: 8,
    mount: "floor",
    face: "to",
    to: ["dining_table", "table", "round_dining_table"],
    words: ["baby chair"],
    fill: WHITE,
    parts: [b(0, 550, -20, 400, 400, 40, WHITE), b(0, 590, -200, 400, 40, 450, WHITE), b(0, 750, 220, 450, 200, 30, "#cfe6ee"), ...legs(550, 650, 550, 30, WHITE, 20)]
  },
  // office
  standing_desk: {
    label: "Standing desk",
    w: 1400,
    d: 700,
    h: 1100,
    kg: 35,
    mount: "floor",
    face: "room",
    users: ["office_chair", "chair", "bar_stool"],
    words: ["sit stand desk", "adjustable desk"],
    fill: WOOD,
    parts: [b(0, 1070, 0, 1400, 700, 30, WOOD), b(-550, 0, 0, 70, 70, 1070, GREY), b(550, 0, 0, 70, 70, 1070, GREY), b(-550, 0, 0, 70, 650, 40, GREY), b(550, 0, 0, 70, 650, 40, GREY), b(0, 1e3, -200, 1050, 60, 60, GREY)]
  },
  corner_desk: {
    label: "Corner desk",
    w: 1600,
    d: 1400,
    h: 750,
    kg: 45,
    mount: "floor",
    face: "room",
    users: ["office_chair", "chair"],
    words: ["l desk", "l-shaped desk"],
    fill: WOOD,
    parts: [b(0, 720, -400, 1600, 600, 30, WOOD), b(-500, 720, 300, 600, 800, 30, WOOD), b(750, 0, -400, 40, 580, 720, WOOD), b(-500, 0, 680, 580, 40, 720, WOOD), b(-780, 0, -400, 40, 580, 720, WOOD)]
  },
  whiteboard: {
    label: "Whiteboard",
    w: 1200,
    d: 30,
    h: 900,
    kg: 9,
    mount: "wall",
    at: 900,
    face: "room",
    words: ["white board", "dry erase board"],
    fill: WHITE,
    parts: [b(0, 0, 0, 1200, 30, 900, STEEL), b(0, 20, 16, 1160, 2, 860, "#ffffff"), b(0, 0, 40, 1e3, 60, 20, STEEL)]
  },
  pinboard: {
    label: "Pinboard",
    w: 900,
    d: 25,
    h: 600,
    kg: 3,
    mount: "wall",
    at: 1100,
    face: "room",
    words: ["cork board", "notice board", "bulletin board"],
    fill: "#c9a46a",
    parts: [b(0, 0, 0, 900, 25, 600, DARK), b(0, 20, 13, 860, 2, 560, "#c9a46a"), b(-200, 300, 15, 150, 2, 200, WHITE), b(150, 150, 15, 180, 2, 120, "#ffd23f")]
  },
  shredder: {
    label: "Shredder",
    w: 350,
    d: 280,
    h: 600,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["paper shredder"],
    fill: BLACK,
    parts: [b(0, 0, 0, 350, 280, 480, BLACK), b(0, 480, 0, 360, 290, 120, "#3b3c40"), b(0, 590, 0, 260, 20, 10, INK)]
  },
  router: {
    label: "Wi-Fi router",
    w: 250,
    d: 160,
    h: 50,
    kg: 0.6,
    mount: "surface",
    on: ["desk", "sideboard", "console_table", "bookshelf", "table"],
    face: "with",
    words: ["router", "modem", "wifi"],
    fill: BLACK,
    parts: [b(0, 0, 0, 250, 160, 40, BLACK), b(-90, 40, -60, 10, 10, 160, BLACK), b(90, 40, -60, 10, 10, 160, BLACK), b(0, 20, 81, 120, 2, 5, "#34d07a")]
  },
  server_rack: {
    label: "Server rack",
    w: 600,
    d: 1e3,
    h: 2e3,
    kg: 120,
    mount: "floor",
    face: "room",
    words: ["network rack", "server cabinet"],
    fill: BLACK,
    parts: [b(0, 0, 0, 600, 1e3, 2e3, BLACK), ...[300, 500, 700, 900, 1100].map((y2) => b(0, y2, 502, 520, 4, 120, "#3b3c40")), b(-200, 1200, 503, 20, 2, 20, "#34d07a")]
  },
  projector_screen: {
    label: "Projector screen",
    w: 2e3,
    d: 80,
    h: 1300,
    kg: 10,
    mount: "wall",
    at: 900,
    face: "room",
    words: ["pull down screen", "projection screen"],
    fill: WHITE,
    parts: [b(0, 1220, 0, 2100, 80, 80, BLACK), b(0, 0, 0, 2e3, 4, 1220, "#ffffff")]
  },
  projector: {
    label: "Projector",
    w: 330,
    d: 250,
    h: 110,
    kg: 3,
    mount: "ceiling",
    at: 2500,
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, 0, 330, 250, 110, WHITE), c(-80, 25, 126, 70, 4, 70, BLACK), c(0, 110, 0, 40, 40, 250, GREY)]
  },
  safe: {
    label: "Safe",
    w: 450,
    d: 450,
    h: 600,
    kg: 90,
    mount: "floor",
    face: "room",
    words: ["strongbox", "gun safe"],
    fill: GREY,
    parts: [b(0, 0, 0, 450, 450, 600, GREY), b(0, 40, 226, 380, 4, 520, "#6b6e73"), c(80, 300, 230, 80, 10, 80, STEEL)]
  },
  conference_table: {
    label: "Meeting table",
    w: 2400,
    d: 1100,
    h: 750,
    kg: 90,
    mount: "floor",
    face: "any",
    words: ["conference table", "boardroom table"],
    fill: WOOD,
    parts: [b(0, 720, 0, 2400, 1100, 30, WOOD), b(-800, 0, 0, 120, 600, 720, DARK), b(800, 0, 0, 120, 600, 720, DARK)]
  },
  // laundry, utility and services
  utility_sink: {
    label: "Utility sink",
    w: 600,
    d: 550,
    h: 900,
    kg: 20,
    mount: "floor",
    face: "room",
    words: ["laundry sink", "laundry tub", "mop sink"],
    fill: WHITE,
    parts: [b(0, 600, 0, 600, 550, 300, WHITE), b(0, 880, 20, 520, 440, 22, "#d7d2c7"), ...legs(600, 550, 600, 40, STEEL, 30), c(0, 900, -240, 30, 30, 300, STEEL), b(0, 1180, -170, 25, 150, 25, STEEL)]
  },
  ironing_board: {
    label: "Ironing board",
    w: 1300,
    d: 400,
    h: 900,
    kg: 6,
    mount: "floor",
    face: "any",
    fill: "#cfe6ee",
    parts: [b(0, 870, 0, 1300, 380, 30, "#cfe6ee"), b(-300, 0, 0, 30, 300, 870, STEEL), b(300, 0, 0, 30, 300, 870, STEEL), b(500, 900, 0, 220, 110, 120, STEEL)]
  },
  drying_rack: {
    label: "Clothes drying rack",
    w: 1400,
    d: 550,
    h: 1e3,
    kg: 4,
    mount: "floor",
    face: "any",
    words: ["airer", "clothes horse"],
    fill: WHITE,
    parts: [b(0, 0, -260, 1400, 20, 1e3, WHITE), b(0, 0, 260, 1400, 20, 1e3, WHITE), ...[-180, -60, 60, 180].map((z2) => c(0, 950, z2, 1400, 10, 10, WHITE)), b(-300, 600, 0, 300, 400, 340, "#5d7f9e")]
  },
  vacuum_cleaner: {
    label: "Vacuum cleaner",
    w: 300,
    d: 300,
    h: 1150,
    kg: 6,
    mount: "floor",
    face: "room",
    words: ["vacuum", "hoover"],
    fill: "#a77bff",
    parts: [b(0, 0, 60, 300, 120, 60, GREY), b(0, 60, 0, 180, 180, 400, "#a77bff"), c(0, 460, 0, 40, 40, 650, GREY), b(0, 1100, 0, 120, 40, 50, BLACK)]
  },
  furnace: {
    label: "Furnace",
    w: 550,
    d: 750,
    h: 1300,
    kg: 70,
    mount: "floor",
    face: "room",
    words: ["air handler", "hvac unit"],
    fill: GREY,
    parts: [b(0, 0, 0, 550, 750, 1300, GREY), b(0, 100, 377, 500, 4, 500, "#6b6e73"), b(0, 700, 377, 500, 4, 500, "#6b6e73"), b(0, 1300, 0, 400, 400, 200, STEEL)]
  },
  boiler: {
    label: "Wall boiler",
    w: 450,
    d: 350,
    h: 700,
    kg: 35,
    mount: "wall",
    at: 1100,
    face: "room",
    words: ["combi boiler", "tankless water heater"],
    fill: WHITE,
    parts: [b(0, 0, 0, 450, 350, 700, WHITE), b(0, 80, 176, 200, 2, 80, BLACK), ...[-120, -40, 40, 120].map((x2) => c(x2, -150, 0, 22, 22, 150, "#c58b5a"))]
  },
  ac_unit: {
    label: "Wall AC unit",
    w: 900,
    d: 230,
    h: 300,
    kg: 10,
    mount: "wall",
    at: 2050,
    face: "room",
    words: ["air conditioner", "split ac", "mini split", "aircon"],
    fill: WHITE,
    parts: [b(0, 0, 0, 900, 230, 300, WHITE), b(0, 30, 112, 800, 10, 40, "#d7d2c7"), b(330, 230, 116, 40, 2, 10, "#34d07a")]
  },
  ac_condenser: {
    label: "AC condenser",
    w: 850,
    d: 350,
    h: 650,
    kg: 50,
    mount: "floor",
    face: "room",
    words: ["outdoor unit", "heat pump", "condenser unit"],
    fill: WHITE,
    parts: [b(0, 0, 0, 850, 350, 650, "#e6e1d6"), c(-120, 100, 176, 460, 4, 460, GREY), c(-120, 290, 178, 120, 4, 120, BLACK)]
  },
  electrical_panel: {
    label: "Electrical panel",
    w: 400,
    d: 100,
    h: 600,
    kg: 15,
    mount: "wall",
    at: 1300,
    face: "room",
    words: ["breaker box", "fuse box", "consumer unit", "distribution board"],
    fill: GREY,
    parts: [b(0, 0, 0, 400, 100, 600, "#a9adb2"), b(0, 30, 51, 340, 2, 540, "#9a9ea3"), ...[150, 300, 450].map((y2) => b(0, y2, 53, 280, 2, 60, BLACK))]
  },
  dehumidifier: {
    label: "Dehumidifier",
    w: 350,
    d: 250,
    h: 600,
    kg: 12,
    mount: "floor",
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, 0, 350, 250, 600, WHITE), b(0, 380, 126, 280, 2, 160, "#d7d2c7"), b(0, 560, 0, 120, 60, 40, GREY)]
  },
  space_heater: {
    label: "Space heater",
    w: 450,
    d: 200,
    h: 600,
    kg: 6,
    mount: "floor",
    face: "room",
    words: ["heater", "oil heater", "portable heater"],
    fill: WHITE,
    parts: [...[-160, -80, 0, 80, 160].map((x2) => b(x2, 60, 0, 60, 180, 520, WHITE)), b(0, 0, 0, 400, 200, 60, GREY)]
  },
  radiator: {
    label: "Radiator",
    w: 1e3,
    d: 100,
    h: 600,
    kg: 25,
    mount: "wall",
    at: 150,
    face: "room",
    fill: WHITE,
    parts: [...Array.from({ length: 10 }, (_2, i) => b(-450 + i * 100, 0, 0, 60, 100, 600, WHITE)), c(-520, 50, 0, 30, 30, 120, STEEL)]
  },
  water_softener: {
    label: "Water softener",
    w: 300,
    d: 450,
    h: 1050,
    kg: 40,
    mount: "floor",
    face: "room",
    words: ["water filter"],
    fill: "#3a6ea5",
    parts: [b(0, 0, 0, 300, 450, 750, "#e6e1d6"), c(0, 0, -100, 250, 250, 1050, "#3a6ea5"), b(0, 1050, -100, 200, 200, 60, BLACK)]
  },
  // garage and workshop
  workbench: {
    label: "Workbench",
    w: 1800,
    d: 700,
    h: 900,
    kg: 60,
    mount: "floor",
    face: "room",
    words: ["work bench", "tool bench"],
    fill: WOOD,
    parts: [b(0, 850, 0, 1800, 700, 50, WOOD), b(0, 200, 0, 1700, 640, 30, WOOD), ...legs(1800, 700, 850, 80, DARK, 50), b(0, 900, -330, 1800, 20, 900, "#c9a46a"), b(-500, 900, -360, 30, 30, 1700, GREY)]
  },
  tool_chest: {
    label: "Tool chest",
    w: 700,
    d: 460,
    h: 1e3,
    kg: 60,
    mount: "floor",
    face: "room",
    words: ["toolbox", "tool cabinet"],
    fill: RED,
    parts: [b(0, 80, 0, 700, 460, 920, RED), ...[220, 360, 500, 640, 780, 900].map((y2) => b(0, y2, 232, 600, 4, 18, STEEL)), ...[-1, 1].flatMap((i) => [c(i * 280, 0, 180, 70, 70, 80, BLACK), c(i * 280, 0, -180, 70, 70, 80, BLACK)])]
  },
  metal_shelving: {
    label: "Metal shelving",
    w: 1200,
    d: 450,
    h: 1800,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["garage shelving", "storage rack", "shelving unit"],
    fill: GREY,
    parts: [...legs(1200, 450, 1800, 35, GREY, 18), ...[50, 450, 850, 1250, 1650].map((y2) => b(0, y2, 0, 1200, 450, 25, GREY)), b(-300, 475, 0, 400, 350, 300, "#c9a46a"), b(250, 875, 0, 450, 350, 280, "#3a6ea5")]
  },
  bicycle: {
    label: "Bicycle",
    w: 600,
    d: 1750,
    h: 1050,
    kg: 13,
    mount: "floor",
    face: "any",
    words: ["bike"],
    fill: "#3a6ea5",
    parts: [c(0, 0, 550, 40, 660, 660, BLACK), c(0, 0, -550, 40, 660, 660, BLACK), b(0, 330, 0, 40, 1050, 40, "#3a6ea5"), b(0, 330, -280, 40, 40, 520, "#3a6ea5"), b(0, 850, -300, 120, 260, 50, BLACK), b(0, 950, 470, 560, 40, 40, BLACK)]
  },
  motorcycle: {
    label: "Motorcycle",
    w: 800,
    d: 2100,
    h: 1150,
    kg: 190,
    mount: "floor",
    face: "any",
    words: ["motorbike", "scooter"],
    fill: BLACK,
    parts: [c(0, 0, 750, 140, 620, 620, BLACK), c(0, 0, -750, 160, 640, 640, BLACK), b(0, 300, 0, 300, 1100, 380, "#55606b"), b(0, 680, -200, 300, 700, 120, BLACK), b(0, 650, 250, 280, 450, 250, RED), b(0, 1050, 700, 780, 40, 40, STEEL)]
  },
  lawn_mower: {
    label: "Lawn mower",
    w: 550,
    d: 1400,
    h: 1e3,
    kg: 30,
    mount: "floor",
    face: "any",
    words: ["mower"],
    fill: GREEN,
    parts: [b(0, 80, 300, 550, 650, 250, GREEN), ...[-1, 1].flatMap((i) => [c(i * 260, 0, 550, 60, 200, 200, BLACK), c(i * 260, 0, 50, 60, 200, 200, BLACK)]), b(-200, 330, -200, 30, 30, 700, BLACK), b(200, 330, -200, 30, 30, 700, BLACK), b(0, 980, -450, 430, 30, 30, BLACK)]
  },
  ladder: {
    label: "Step ladder",
    w: 500,
    d: 700,
    h: 1800,
    kg: 8,
    mount: "floor",
    face: "any",
    words: ["ladder", "stepladder"],
    fill: STEEL,
    parts: [b(-220, 0, 150, 40, 40, 1800, STEEL), b(220, 0, 150, 40, 40, 1800, STEEL), b(-220, 0, -200, 40, 40, 1750, STEEL), b(220, 0, -200, 40, 40, 1750, STEEL), ...[350, 700, 1050, 1400].map((y2) => b(0, y2, 150 - y2 / 15, 440, 90, 25, GREY))]
  },
  // fitness
  exercise_bike: {
    label: "Exercise bike",
    w: 550,
    d: 1200,
    h: 1300,
    kg: 45,
    mount: "floor",
    face: "room",
    words: ["spin bike", "stationary bike", "peloton"],
    fill: BLACK,
    parts: [b(0, 0, 0, 550, 1200, 60, BLACK), b(0, 60, 350, 60, 60, 1100, BLACK), c(0, 200, 300, 60, 450, 450, GREY), b(0, 60, -300, 60, 60, 850, BLACK), b(0, 900, -300, 200, 280, 60, BLACK), b(0, 1150, 400, 500, 80, 40, BLACK), b(0, 1250, 380, 250, 20, 160, "#3a6ea5")]
  },
  rowing_machine: {
    label: "Rowing machine",
    w: 550,
    d: 2200,
    h: 550,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["rower", "erg"],
    fill: BLACK,
    parts: [b(0, 150, -200, 120, 1800, 60, "#2b2c30"), b(0, 0, -1050, 450, 80, 160, BLACK), c(0, 80, 850, 120, 480, 480, BLACK), b(0, 220, -200, 300, 350, 70, "#3b3c40"), b(0, 160, 450, 400, 200, 50, GREY), b(0, 480, 820, 520, 30, 30, STEEL)]
  },
  weight_bench: {
    label: "Weight bench",
    w: 600,
    d: 1300,
    h: 1400,
    kg: 35,
    mount: "floor",
    face: "room",
    words: ["bench press", "gym bench"],
    fill: BLACK,
    parts: [b(0, 400, 0, 300, 1200, 80, BLACK), b(0, 0, 0, 100, 1200, 60, GREY), b(0, 0, -500, 80, 80, 400, GREY), b(0, 0, 500, 80, 80, 400, GREY), b(-250, 0, -500, 60, 60, 1400, GREY), b(250, 0, -500, 60, 60, 1400, GREY), c(0, 1250, -480, 1500, 30, 30, STEEL)]
  },
  dumbbell_rack: {
    label: "Dumbbell rack",
    w: 1200,
    d: 450,
    h: 800,
    kg: 120,
    mount: "floor",
    face: "room",
    words: ["weights", "dumbbells"],
    fill: BLACK,
    parts: [b(-550, 0, 0, 60, 450, 800, BLACK), b(550, 0, 0, 60, 450, 800, BLACK), b(0, 380, 0, 1100, 300, 30, BLACK), b(0, 700, -60, 1100, 240, 30, BLACK), ...[-400, -150, 100, 350].map((x2) => b(x2, 410, 0, 160, 120, 120, "#3b3c40"))]
  },
  punching_bag: {
    label: "Punching bag",
    w: 400,
    d: 400,
    h: 1200,
    kg: 35,
    mount: "ceiling",
    at: 600,
    face: "any",
    words: ["boxing bag", "heavy bag"],
    fill: RED,
    parts: [c(0, 0, 0, 380, 380, 1100, RED), c(0, 1100, 0, 20, 20, 900, STEEL)]
  },
  yoga_mat: { label: "Yoga mat", w: 610, d: 1830, h: 6, kg: 1.5, mount: "floor", face: "any", words: ["exercise mat", "gym mat"], fill: "#a77bff", parts: [b(0, 0, 0, 610, 1830, 6, "#a77bff")] },
  // outdoor
  patio_table: {
    label: "Patio table",
    w: 1500,
    d: 900,
    h: 740,
    kg: 25,
    mount: "floor",
    face: "any",
    words: ["garden table", "outdoor table"],
    fill: "#8d8a83",
    parts: [b(0, 710, 0, 1500, 900, 30, "#8d8a83"), ...legs(1500, 900, 710, 50, "#55585c", 60)]
  },
  patio_chair: {
    label: "Patio chair",
    w: 580,
    d: 600,
    h: 870,
    kg: 6,
    mount: "floor",
    face: "to",
    to: ["patio_table", "fire_pit", "round_dining_table", "table"],
    words: ["garden chair", "outdoor chair"],
    fill: "#55585c",
    parts: [b(0, 420, 0, 560, 560, 40, "#8d8a83"), b(0, 460, -270, 560, 40, 410, "#8d8a83"), ...legs(580, 600, 420, 35, "#55585c", 25)]
  },
  sun_lounger: {
    label: "Sun lounger",
    w: 700,
    d: 1950,
    h: 800,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["deck chair", "pool lounger"],
    fill: WHITE,
    parts: [b(0, 280, 200, 680, 1400, 60, WHITE), b(0, 300, -750, 680, 60, 520, WHITE), ...legs(700, 1950, 280, 40, "#55585c", 60)]
  },
  bbq_grill: {
    label: "BBQ grill",
    w: 1300,
    d: 600,
    h: 1150,
    kg: 55,
    mount: "floor",
    face: "room",
    words: ["barbecue", "grill", "bbq"],
    fill: BLACK,
    parts: [b(0, 0, 0, 900, 550, 850, BLACK), b(0, 850, 0, 900, 550, 300, "#3b3c40"), b(-560, 850, 0, 220, 500, 30, STEEL), b(560, 850, 0, 220, 500, 30, STEEL), b(0, 1e3, 290, 500, 30, 30, STEEL)]
  },
  outdoor_sofa: { label: "Outdoor sofa", w: 1900, d: 850, h: 750, kg: 40, mount: "floor", face: "to", to: ["patio_table", "fire_pit", "coffee_table"], words: ["patio sofa", "garden sofa"], like: "sofa", fill: "#8d8a83" },
  patio_umbrella: {
    label: "Patio umbrella",
    w: 2700,
    d: 2700,
    h: 2500,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["parasol", "garden umbrella"],
    fill: "#e9e3d6",
    parts: [c(0, 0, 0, 500, 500, 80, "#55585c"), c(0, 80, 0, 40, 40, 2400, WHITE), c(0, 2200, 0, 2700, 2700, 120, "#e9e3d6"), c(0, 2320, 0, 900, 900, 120, "#e9e3d6")]
  },
  hot_tub: {
    label: "Hot tub",
    w: 2100,
    d: 2100,
    h: 900,
    kg: 400,
    mount: "floor",
    face: "any",
    words: ["spa", "jacuzzi"],
    fill: "#5aa9d6",
    parts: [b(0, 0, 0, 2100, 2100, 900, "#6e4f37"), b(0, 860, 0, 1850, 1850, 20, "#5aa9d6")]
  },
  planter: {
    label: "Planter",
    w: 600,
    d: 600,
    h: 900,
    kg: 40,
    mount: "floor",
    face: "any",
    words: ["flower pot", "plant pot", "planter box"],
    fill: GREEN,
    parts: [b(0, 0, 0, 600, 600, 450, "#55585c"), s(0, 380, 0, 560, 560, 520, GREEN)]
  },
  garden_bench: {
    label: "Garden bench",
    w: 1500,
    d: 600,
    h: 850,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["park bench"],
    fill: WOOD,
    parts: [b(0, 420, 50, 1500, 450, 40, WOOD), b(0, 500, -230, 1500, 40, 350, WOOD), b(-700, 0, 0, 60, 600, 650, BLACK), b(700, 0, 0, 60, 600, 650, BLACK)]
  },
  fire_pit: {
    label: "Fire pit",
    w: 900,
    d: 900,
    h: 400,
    kg: 50,
    mount: "floor",
    face: "any",
    words: ["firepit"],
    fill: "#8d8a83",
    parts: [c(0, 0, 0, 900, 900, 380, "#8d8a83"), c(0, 380, 0, 700, 700, 20, INK), s(0, 360, 0, 300, 300, 160, "#ff8a3d")]
  },
  // kids, pets, hobbies
  kids_table: {
    label: "Kids' table",
    w: 800,
    d: 600,
    h: 520,
    kg: 8,
    mount: "floor",
    face: "any",
    words: ["children's table", "play table"],
    fill: "#ffd23f",
    parts: [b(0, 490, 0, 800, 600, 30, WHITE), ...legs(800, 600, 490, 50, "#ffd23f", 40)]
  },
  rocking_chair: {
    label: "Rocking chair",
    w: 650,
    d: 900,
    h: 1050,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["rocker", "nursing chair"],
    fill: WOOD,
    parts: [b(-280, 0, 0, 40, 900, 60, WOOD), b(280, 0, 0, 40, 900, 60, WOOD), b(0, 400, 0, 600, 500, 40, WOOD), b(0, 440, -240, 600, 40, 600, WOOD), ...legs(600, 500, 400, 35, WOOD, 20).map((p2) => ({ ...p2, y: 60, h: 340 }))]
  },
  dog_bed: {
    label: "Dog bed",
    w: 900,
    d: 700,
    h: 250,
    kg: 3,
    mount: "floor",
    face: "any",
    words: ["pet bed", "dog basket"],
    fill: "#7a5a4a",
    parts: [b(0, 0, 0, 900, 700, 120, "#7a5a4a"), b(0, 120, -280, 900, 140, 130, "#7a5a4a"), b(-380, 120, 0, 140, 700, 130, "#7a5a4a"), b(380, 120, 0, 140, 700, 130, "#7a5a4a")]
  },
  cat_tree: {
    label: "Cat tree",
    w: 600,
    d: 500,
    h: 1500,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["cat tower", "scratching post"],
    fill: "#d8c9a8",
    parts: [b(0, 0, 0, 600, 500, 40, "#d8c9a8"), c(-150, 40, 0, 100, 100, 1100, "#c9a46a"), c(150, 40, 0, 100, 100, 700, "#c9a46a"), b(150, 740, 0, 400, 400, 30, "#d8c9a8"), b(-100, 1140, 0, 500, 400, 300, "#d8c9a8")]
  },
  pool_table: {
    label: "Pool table",
    w: 2500,
    d: 1400,
    h: 800,
    kg: 350,
    mount: "floor",
    face: "any",
    words: ["billiard table", "snooker table"],
    fill: GREEN,
    parts: [b(0, 650, 0, 2500, 1400, 150, DARK), b(0, 795, 0, 2300, 1200, 10, GREEN), b(-1e3, 0, -500, 150, 150, 650, DARK), b(1e3, 0, -500, 150, 150, 650, DARK), b(-1e3, 0, 500, 150, 150, 650, DARK), b(1e3, 0, 500, 150, 150, 650, DARK)]
  },
  ping_pong_table: {
    label: "Ping pong table",
    w: 2740,
    d: 1525,
    h: 760,
    kg: 100,
    mount: "floor",
    face: "any",
    words: ["table tennis table"],
    fill: "#3a6ea5",
    parts: [b(0, 730, 0, 2740, 1525, 30, "#3a6ea5"), b(0, 760, 0, 20, 1600, 150, WHITE), ...legs(2740, 1525, 730, 50, GREY, 200)]
  },
  dartboard: {
    label: "Dartboard",
    w: 450,
    d: 40,
    h: 450,
    kg: 5,
    mount: "wall",
    at: 1500,
    face: "room",
    words: ["dart board"],
    fill: INK,
    parts: [c(0, 0, 0, 450, 40, 450, INK), c(0, 30, 6, 340, 30, 340, "#e9e3d6"), c(0, 190, 12, 60, 30, 60, RED)]
  },
  guitar: {
    label: "Guitar on a stand",
    w: 380,
    d: 400,
    h: 1050,
    kg: 4,
    mount: "floor",
    face: "room",
    words: ["guitar", "acoustic guitar"],
    fill: "#c9a46a",
    parts: [b(0, 0, 0, 360, 380, 40, BLACK), c(0, 80, 40, 380, 100, 480, "#c9a46a"), b(0, 560, 40, 60, 40, 480, DARK)]
  },
  drum_kit: {
    label: "Drum kit",
    w: 1600,
    d: 1300,
    h: 1300,
    kg: 45,
    mount: "floor",
    face: "room",
    words: ["drums", "drum set"],
    fill: RED,
    parts: [c(0, 0, 300, 560, 400, 560, RED), c(-450, 0, 0, 400, 400, 450, RED), c(-250, 600, 300, 300, 300, 200, RED), c(250, 600, 300, 300, 300, 200, RED), c(450, 0, -100, 400, 400, 600, RED), c(-650, 1100, 100, 400, 400, 15, "#c9a46a"), c(650, 1200, 100, 450, 450, 15, "#c9a46a"), b(0, 0, -400, 400, 400, 480, BLACK)]
  },
  floor_fan: {
    label: "Floor fan",
    w: 450,
    d: 350,
    h: 1200,
    kg: 5,
    mount: "floor",
    face: "room",
    words: ["fan", "standing fan", "pedestal fan"],
    fill: WHITE,
    parts: [c(0, 0, 0, 400, 350, 40, WHITE), c(0, 40, 0, 40, 40, 800, WHITE), c(0, 820, 0, 450, 140, 450, "#e6e1d6"), c(0, 990, 40, 120, 100, 120, GREY)]
  },
  humidifier: {
    label: "Humidifier",
    w: 250,
    d: 250,
    h: 350,
    kg: 2,
    mount: "floor",
    face: "any",
    words: ["air purifier", "purifier"],
    fill: WHITE,
    parts: [c(0, 0, 0, 250, 250, 320, WHITE), c(0, 320, 0, 120, 120, 30, GREY)]
  }
};

// src/lib/plan/catalog.ts
var WOOD2 = "#a07850";
var DARK2 = "#8a6a48";
var CAB = "#5b5750";
var WHITE2 = "#f4efe6";
var STEEL2 = "#b9bec4";
var BLACK2 = "#232426";
var FABRIC2 = "#6f7486";
var DESKS = ["desk", "table", "dining_table", "sideboard", "dresser", "nightstand"];
var COUNTERS2 = ["base_cabinet", "island", "kitchen_sink", "sideboard", "table"];
var BASE = {
  // kitchen
  base_cabinet: { label: "Base cabinet", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: CAB },
  wall_cabinet: { label: "Wall cabinet", w: 600, d: 350, h: 700, kg: 18, mount: "wall", at: 1450, face: "room", fill: CAB },
  tall_cabinet: { label: "Tall cabinet", w: 600, d: 600, h: 2200, kg: 70, mount: "floor", face: "room", words: ["pantry"], fill: "#d9d2c4" },
  kitchen_sink: { label: "Kitchen sink", w: 800, d: 600, h: 900, kg: 45, mount: "floor", face: "room", fill: CAB },
  dishwasher: { label: "Dishwasher", w: 600, d: 600, h: 850, kg: 45, mount: "floor", face: "room", fill: CAB },
  range: { label: "Range", w: 600, d: 600, h: 900, kg: 60, mount: "floor", face: "room", words: ["stove", "cooker"], fill: BLACK2 },
  cooktop: { label: "Cooktop", w: 600, d: 520, h: 900, kg: 10, mount: "floor", face: "room", words: ["hob"], fill: BLACK2 },
  oven: { label: "Oven", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: BLACK2 },
  range_hood: { label: "Range hood", w: 600, d: 500, h: 600, kg: 12, mount: "wall", at: 1600, face: "room", words: ["extractor", "hood"], fill: STEEL2 },
  fridge: { label: "Fridge", w: 700, d: 700, h: 1850, kg: 80, mount: "floor", face: "room", words: ["refrigerator", "freezer"], fill: STEEL2 },
  island: { label: "Kitchen island", w: 1800, d: 900, h: 900, kg: 150, mount: "floor", face: "any", fill: CAB },
  microwave: { label: "Microwave", w: 500, d: 380, h: 300, kg: 14, mount: "surface", on: COUNTERS2, back: true, face: "with", fill: BLACK2 },
  coffee_machine: { label: "Coffee machine", w: 280, d: 400, h: 380, kg: 9, mount: "surface", on: COUNTERS2, back: true, face: "with", words: ["espresso"], fill: BLACK2 },
  kettle: { label: "Kettle", w: 220, d: 160, h: 250, kg: 1.2, mount: "surface", on: COUNTERS2, back: true, face: "with", fill: STEEL2 },
  toaster: { label: "Toaster", w: 300, d: 180, h: 200, kg: 2, mount: "surface", on: COUNTERS2, back: true, face: "with", fill: STEEL2 },
  bar_stool: { label: "Bar stool", w: 400, d: 400, h: 1e3, kg: 6, mount: "floor", face: "to", to: ["island", "base_cabinet", "kitchen_sink", "bar_counter"], words: ["counter stool", "stool"], fill: WOOD2 },
  // bathroom
  toilet: { label: "Toilet", w: 400, d: 650, h: 800, kg: 30, mount: "floor", face: "room", words: ["wc"], fill: WHITE2 },
  washbasin: { label: "Washbasin", w: 600, d: 450, h: 900, kg: 18, mount: "floor", face: "room", words: ["basin", "sink"], fill: WHITE2 },
  vanity: { label: "Vanity", w: 800, d: 480, h: 900, kg: 45, mount: "floor", face: "room", fill: WOOD2 },
  bathtub: { label: "Bathtub", w: 1700, d: 700, h: 580, kg: 50, mount: "floor", face: "room", words: ["bath", "tub"], fill: WHITE2 },
  shower: { label: "Shower", w: 900, d: 900, h: 2050, kg: 60, mount: "floor", face: "room", fill: "#cfe6ee" },
  mirror: { label: "Mirror", w: 600, d: 30, h: 800, kg: 8, mount: "wall", at: 1100, face: "room", fill: "#8fd3f0" },
  towel_radiator: { label: "Towel radiator", w: 500, d: 100, h: 1200, kg: 12, mount: "wall", at: 300, face: "room", fill: WHITE2 },
  // bedroom
  bed: { label: "Bed", w: 1600, d: 2e3, h: 1050, kg: 70, mount: "floor", face: "room", fill: "#e9e3d6" },
  nightstand: { label: "Nightstand", w: 450, d: 400, h: 550, kg: 12, mount: "floor", face: "room", words: ["bedside table"], fill: DARK2 },
  wardrobe: { label: "Wardrobe", w: 1200, d: 600, h: 2200, kg: 90, mount: "floor", face: "room", words: ["closet", "armoire"], fill: DARK2 },
  dresser: { label: "Dresser", w: 1e3, d: 480, h: 800, kg: 45, mount: "floor", face: "room", words: ["chest of drawers", "drawers"], fill: DARK2 },
  crib: { label: "Crib", w: 700, d: 1300, h: 900, kg: 25, mount: "floor", face: "room", words: ["cot"], fill: WHITE2 },
  // living and dining
  sofa: { label: "Sofa", w: 2100, d: 900, h: 850, kg: 60, mount: "floor", face: "to", to: ["tv", "fireplace", "coffee_table"], words: ["couch"], fill: FABRIC2 },
  armchair: { label: "Armchair", w: 850, d: 850, h: 850, kg: 25, mount: "floor", face: "to", to: ["coffee_table", "tv", "fireplace", "sofa"], fill: FABRIC2 },
  coffee_table: { label: "Coffee table", w: 1100, d: 600, h: 420, kg: 20, mount: "floor", face: "any", fill: WOOD2 },
  table: { label: "Table", w: 1200, d: 800, h: 750, kg: 30, mount: "floor", face: "any", fill: WOOD2 },
  dining_table: { label: "Dining table", w: 1600, d: 900, h: 750, kg: 45, mount: "floor", face: "any", fill: WOOD2 },
  chair: { label: "Chair", w: 450, d: 450, h: 900, kg: 5, mount: "floor", face: "to", to: ["dining_table", "table", "desk"], fill: WOOD2 },
  sideboard: { label: "Sideboard", w: 1600, d: 450, h: 750, kg: 55, mount: "floor", face: "room", words: ["tv unit", "tv stand", "credenza", "buffet"], fill: DARK2 },
  tv: { label: "TV", w: 1230, d: 80, h: 720, kg: 15, mount: "surface", on: ["sideboard", "dresser", "tv_stand"], at: 1100, face: "with", back: true, words: ["television", "screen"], fill: "#151618" },
  bookshelf: { label: "Bookshelf", w: 800, d: 300, h: 2e3, kg: 40, mount: "floor", face: "room", words: ["bookcase", "shelving"], fill: DARK2 },
  wall_shelf: { label: "Wall shelf", w: 800, d: 250, h: 40, kg: 4, mount: "wall", at: 1500, face: "room", words: ["floating shelf"], fill: WOOD2 },
  picture: { label: "Picture", w: 700, d: 30, h: 500, kg: 3, mount: "wall", at: 1350, face: "room", words: ["painting", "art", "frame", "poster"], fill: "#c9a46a" },
  rug: { label: "Rug", w: 2e3, d: 1400, h: 10, kg: 8, mount: "floor", face: "any", words: ["carpet"], fill: "#7a5a4a" },
  fireplace: { label: "Fireplace", w: 1200, d: 400, h: 1150, kg: 200, mount: "floor", face: "room", fill: "#8d8a83" },
  piano: { label: "Upright piano", w: 1500, d: 600, h: 1250, kg: 230, mount: "floor", face: "room", users: ["chair", "bar_stool"], fill: "#151618" },
  lamp: { label: "Floor lamp", w: 400, d: 400, h: 1600, kg: 5, mount: "floor", face: "any", words: ["floor lamp", "standing lamp"], fill: "#f3c56b" },
  table_lamp: { label: "Table lamp", w: 280, d: 280, h: 450, kg: 2, mount: "surface", on: ["nightstand", "desk", "sideboard", "dresser", "table"], face: "any", words: ["desk lamp", "bedside lamp"], fill: "#f3c56b" },
  plant: { label: "Plant", w: 400, d: 400, h: 1200, kg: 10, mount: "floor", face: "any", fill: "#3f7a4a" },
  ceiling_fan: { label: "Ceiling fan", w: 1300, d: 1300, h: 400, kg: 7, mount: "ceiling", at: 2250, face: "any", fill: "#d9d2c4" },
  pendant_light: { label: "Pendant light", w: 400, d: 400, h: 400, kg: 2, mount: "ceiling", at: 1900, face: "any", words: ["chandelier", "ceiling light"], fill: "#f3c56b" },
  // office
  desk: { label: "Desk", w: 1200, d: 600, h: 750, kg: 30, mount: "floor", face: "room", users: ["office_chair", "chair"], fill: WOOD2 },
  office_chair: { label: "Office chair", w: 600, d: 600, h: 1100, kg: 14, mount: "floor", face: "to", to: ["desk", "table"], words: ["desk chair", "swivel chair"], fill: "#2b2c30" },
  computer: { label: "Computer", w: 900, d: 450, h: 460, kg: 12, mount: "surface", on: DESKS, back: true, face: "with", words: ["pc", "desktop", "desktop computer", "workstation", "imac"], fill: BLACK2 },
  monitor: { label: "Monitor", w: 620, d: 200, h: 460, kg: 5, mount: "surface", on: DESKS, back: true, face: "with", words: ["screen", "display"], fill: BLACK2 },
  laptop: { label: "Laptop", w: 340, d: 240, h: 230, kg: 1.6, mount: "surface", on: DESKS, face: "with", words: ["notebook", "macbook"], fill: "#9da3aa" },
  printer: { label: "Printer", w: 450, d: 400, h: 250, kg: 10, mount: "surface", on: ["desk", "sideboard", "filing_cabinet", "table"], face: "with", fill: "#e6e1d6" },
  filing_cabinet: { label: "Filing cabinet", w: 400, d: 600, h: 720, kg: 30, mount: "floor", face: "room", words: ["drawer unit", "pedestal"], fill: "#7d8187" },
  // laundry, services, outside
  washing_machine: { label: "Washing machine", w: 600, d: 600, h: 850, kg: 70, mount: "floor", face: "room", words: ["washer"], fill: WHITE2 },
  dryer: { label: "Dryer", w: 600, d: 600, h: 850, kg: 40, mount: "floor", face: "room", fill: WHITE2 },
  water_heater: { label: "Water heater", w: 560, d: 560, h: 1500, kg: 60, mount: "floor", face: "room", words: ["geyser", "hot water tank"], fill: "#e6e1d6" },
  treadmill: { label: "Treadmill", w: 800, d: 1900, h: 1400, kg: 90, mount: "floor", face: "room", fill: "#2b2c30" },
  car: { label: "Car", w: 1800, d: 4500, h: 1500, kg: 1400, mount: "floor", face: "any", fill: "#55606b" }
};
var CATALOG = { ...BASE, ...EXTRA };
var OBJECT_KINDS = [...Object.keys(CATALOG), "other"];

// src/lib/plan/units.ts
var INCH = 25.4;

// src/lib/plan/cabinets.ts
var inch2 = (n) => Math.round(n * INCH * 10) / 10;
var step = (a2, b2, by = 3) => Array.from({ length: Math.floor((b2 - a2) / by) + 1 }, (_2, i) => a2 + i * by);
defineStandards([
  { key: "cab.base.height", group: "Kitchen cabinets", label: "Base cabinet height", value: inch2(34.5), unit: "len", help: 'The box without the countertop. With a 1\xBD" top the counter is at 36".' },
  { key: "cab.base.depth", group: "Kitchen cabinets", label: "Base cabinet depth", value: inch2(24), unit: "len" },
  { key: "cab.toekick", group: "Kitchen cabinets", label: "Toe kick height", value: inch2(4.5), unit: "len" },
  { key: "cab.toekick.depth", group: "Kitchen cabinets", label: "Toe kick depth", value: inch2(3), unit: "len" },
  { key: "cab.wall.height", group: "Kitchen cabinets", label: "Wall cabinet height", value: inch2(30), unit: "len", help: `30" under an 8' ceiling with a soffit or crown; 36" or 42" to go higher.` },
  { key: "cab.wall.depth", group: "Kitchen cabinets", label: "Wall cabinet depth", value: inch2(12), unit: "len" },
  { key: "cab.wall.bottom", group: "Kitchen cabinets", label: "Wall cabinets, bottom above the floor", value: inch2(54), unit: "len", help: '36" counter plus an 18" backsplash.' },
  { key: "cab.tall.height", group: "Kitchen cabinets", label: "Tall cabinet height", value: inch2(84), unit: "len", help: 'Lines up with the top of 30" wall cabinets. 90" and 96" are also stock.' },
  { key: "cab.tall.depth", group: "Kitchen cabinets", label: "Tall cabinet depth", value: inch2(24), unit: "len" },
  { key: "cab.fridgewall.height", group: "Kitchen cabinets", label: "Cabinet over the fridge, height", value: inch2(15), unit: "len" },
  { key: "cab.fridgewall.depth", group: "Kitchen cabinets", label: "Cabinet over the fridge, depth", value: inch2(24), unit: "len", help: '24" deep so it lines up with the fridge front.' },
  { key: "cab.fill.max", group: "Kitchen cabinets", label: "Widest cabinet when filling a wall", value: inch2(36), unit: "len" },
  { key: "cab.width.step", group: "Kitchen cabinets", label: "Stock widths go up by", value: inch2(3), unit: "len" },
  { key: "cab.snap", group: "Kitchen cabinets", label: "A typed width this close to a stock width snaps to it", value: inch2(0.5), unit: "len" },
  { key: "cab.sink.width", group: "Kitchen cabinets", label: "Sink base width", value: inch2(36), unit: "len" },
  { key: "cab.filler.width", group: "Countertops and trim", label: "Filler width", value: inch2(3), unit: "len", help: 'Stock fillers are 3" and 6", cut to fit.' },
  { key: "cab.filler.end", group: "Countertops and trim", label: "Filler at a wall, at least", value: inch2(1.5), unit: "len", help: "So doors and drawers open past the wall and its trim." },
  { key: "cab.panel.thick", group: "Countertops and trim", label: "End panel thickness", value: inch2(0.75), unit: "len" },
  { key: "cab.counter.thick", group: "Countertops and trim", label: "Countertop thickness", value: inch2(1.25), unit: "len", help: '3 cm stone is about 1\xBC"; laminate with a built-up edge 1\xBD".' },
  { key: "cab.counter.overhang", group: "Countertops and trim", label: "Countertop overhang at the front", value: inch2(1.5), unit: "len", help: 'A 24" base with 1\xBD" overhang is a 25\xBD" deep top.' },
  { key: "cab.crown", group: "Countertops and trim", label: "Crown molding height", value: inch2(3), unit: "len" },
  { key: "cab.lightrail", group: "Countertops and trim", label: "Light rail height", value: inch2(1.5), unit: "len" },
  { key: "cab.range.width", group: "Appliance spaces", label: "Range opening", value: inch2(30), unit: "len" },
  { key: "cab.dw.width", group: "Appliance spaces", label: "Dishwasher opening", value: inch2(24), unit: "len" },
  { key: "cab.fridge.width", group: "Appliance spaces", label: "Fridge opening, width", value: inch2(36), unit: "len" },
  { key: "cab.fridge.depth", group: "Appliance spaces", label: "Fridge depth", value: inch2(30), unit: "len" },
  { key: "cab.fridge.height", group: "Appliance spaces", label: "Fridge opening, height", value: inch2(70), unit: "len", help: "Clear height under the cabinet over the fridge." },
  { key: "cab.hood.bottom", group: "Appliance spaces", label: "Range hood, bottom above the floor", value: inch2(66), unit: "len", help: 'About 30" over the cooking surface.' },
  { key: "cab.vanity.height", group: "Bath", label: "Vanity height", value: inch2(34.5), unit: "len", help: `Comfort height. Older and kids' vanities are 30\xBD".` },
  { key: "cab.vanity.depth", group: "Bath", label: "Vanity depth", value: inch2(21), unit: "len" },
  { key: "cab.linen.height", group: "Bath", label: "Linen cabinet height", value: inch2(84), unit: "len" },
  { key: "cab.linen.depth", group: "Bath", label: "Linen cabinet depth", value: inch2(21), unit: "len" },
  { key: "cab.medicine.height", group: "Bath", label: "Medicine cabinet height", value: inch2(30), unit: "len" },
  { key: "cab.medicine.depth", group: "Bath", label: "Medicine cabinet depth", value: inch2(5), unit: "len" },
  { key: "cab.medicine.bottom", group: "Bath", label: "Medicine cabinet, bottom above the floor", value: inch2(46), unit: "len" },
  { key: "bath.toilet.width", group: "Bath", label: "Toilet width", value: inch2(20), unit: "len" },
  { key: "bath.toilet.depth", group: "Bath", label: "Toilet depth", value: inch2(28), unit: "len" },
  { key: "bath.tub.length", group: "Bath", label: "Bathtub length", value: inch2(60), unit: "len" },
  { key: "bath.tub.width", group: "Bath", label: "Bathtub width", value: inch2(30), unit: "len" },
  { key: "bath.tub.height", group: "Bath", label: "Bathtub height", value: inch2(20), unit: "len" },
  { key: "bath.shower.width", group: "Bath", label: "Shower width", value: inch2(36), unit: "len" },
  { key: "bath.shower.depth", group: "Bath", label: "Shower depth", value: inch2(36), unit: "len" }
]);
var WALL_H = [12, 15, 18, 24, 30, 36, 42];
var FAMILIES = [
  { id: "base", label: "Base", zone: "base", group: "Base", prefix: "B", widths: step(9, 48), configs: ["1d1dr", "2d1dr", "2d2dr", "1d", "2d"], kind: "base_cabinet", code: "w" },
  { id: "drawer", label: "Drawer base", zone: "base", group: "Base", prefix: "DB", widths: step(12, 36), configs: ["3dr", "4dr", "2dr"], kind: "base_cabinet", code: "w" },
  { id: "sink", label: "Sink base", zone: "base", group: "Base", prefix: "SB", widths: step(24, 42), configs: ["sink2", "sink1"], kind: "kitchen_sink", code: "w" },
  { id: "blind", label: "Blind corner base", zone: "base", group: "Corners", prefix: "BBC", widths: step(36, 48), configs: ["blind"], kind: "base_cabinet", code: "w", blind: 24 },
  { id: "susan", label: "Lazy susan", zone: "base", group: "Corners", prefix: "LS", widths: [33, 36], configs: ["susan"], kind: "base_cabinet", code: "w" },
  { id: "wall", label: "Wall", zone: "wall", group: "Wall", prefix: "W", widths: step(9, 48), heights: WALL_H, configs: ["1d", "2d", "glass1", "glass2", "open"], kind: "wall_cabinet", code: "wh" },
  { id: "fridge_wall", label: "Over the fridge", zone: "wall", group: "Wall", prefix: "W", widths: [30, 33, 36], heights: [12, 15, 18, 24], configs: ["2d", "1d"], kind: "wall_cabinet", code: "whd" },
  { id: "wall_end", label: "Open end shelf", zone: "wall", group: "Wall", prefix: "WES", widths: [9, 12], heights: [30, 36, 42], configs: ["open"], kind: "wall_cabinet", code: "wh" },
  { id: "wall_corner", label: "Wall diagonal corner", zone: "wall", group: "Corners", prefix: "WDC", widths: [24, 27], heights: [30, 36, 42], configs: ["1d", "glass1"], kind: "wall_cabinet", code: "wh" },
  { id: "wall_blind", label: "Wall blind corner", zone: "wall", group: "Corners", prefix: "WBC", widths: step(24, 36), heights: [30, 36, 42], configs: ["blind"], kind: "wall_cabinet", code: "wh", blind: 12 },
  { id: "tall", label: "Pantry", zone: "tall", group: "Tall", prefix: "U", widths: [18, 24, 30, 36], heights: [84, 90, 96], configs: ["pantry2", "pantry1"], kind: "tall_cabinet", code: "whd" },
  { id: "oven", label: "Oven cabinet", zone: "tall", group: "Tall", prefix: "OC", widths: [27, 30, 33], heights: [84, 90, 96], configs: ["oven", "oven2"], kind: "tall_cabinet", code: "wh" },
  { id: "filler_base", label: "Base filler", zone: "base", group: "Fillers and panels", prefix: "BF", widths: [3, 6], configs: ["plain"], kind: "filler", code: "w" },
  { id: "filler_wall", label: "Wall filler", zone: "wall", group: "Fillers and panels", prefix: "WF", widths: [3, 6], heights: WALL_H, configs: ["plain"], kind: "filler", code: "wh" },
  { id: "filler_tall", label: "Tall filler", zone: "tall", group: "Fillers and panels", prefix: "TF", widths: [3, 6], heights: [84, 90, 96], configs: ["plain"], kind: "filler", code: "wh" },
  { id: "panel_base", label: "Dishwasher / end panel", zone: "base", group: "Fillers and panels", prefix: "DWP", widths: [0.75], configs: ["plain"], kind: "filler", code: "w" },
  { id: "panel_tall", label: "Fridge end panel", zone: "tall", group: "Fillers and panels", prefix: "REP", widths: [0.75], heights: [84, 90, 96], configs: ["plain"], kind: "filler", code: "wh" },
  { id: "valance", label: "Valance (over a window)", zone: "wall", group: "Fillers and panels", prefix: "VAL", widths: [30, 36, 48, 60], configs: ["plain"], kind: "filler", code: "w" },
  { id: "vanity", label: "Vanity", zone: "base", group: "Bath", prefix: "V", widths: [18, 24, 30, 36, 42, 48, 60, 72], configs: ["vsink2", "vsink1", "vsides", "1d1dr"], kind: "vanity", code: "w" },
  { id: "vanity_drawer", label: "Vanity drawers", zone: "base", group: "Bath", prefix: "VDB", widths: [12, 15, 18, 21, 24], configs: ["3dr", "4dr"], kind: "vanity", code: "w" },
  { id: "linen", label: "Linen cabinet", zone: "tall", group: "Bath", prefix: "LC", widths: [18, 24], heights: [84, 90, 96], configs: ["linen_dr", "linen_d"], kind: "tall_cabinet", code: "wh" },
  { id: "medicine", label: "Medicine cabinet", zone: "wall", group: "Bath", prefix: "MC", widths: [16, 20, 24, 30, 36], heights: [26, 30], configs: ["mirror"], kind: "medicine_cabinet", code: "wh" }
];

// src/lib/plan/stairs.ts
var IN = 25.4;
defineStandards([
  { key: "stair.width", group: "Stairs", label: "Width of new stairs", value: 36 * IN, unit: "len", help: "Clear width between the walls or guards." },
  { key: "stair.riser", group: "Stairs", label: "Step height new stairs aim for", value: 7.25 * IN, unit: "len", help: "The number of steps is the floor-to-floor height divided by this, rounded up." },
  { key: "stair.tread", group: "Stairs", label: "Tread depth of new stairs", value: 11 * IN, unit: "len", help: "Front to back of each step, not counting the nosing." },
  { key: "stair.floorDepth", group: "Stairs", label: "Floor thickness above the stairs", value: 12 * IN, unit: "len", help: "Joists, subfloor and ceiling. Used for the headroom and the hole in the floor above." },
  { key: "stair.headroom", group: "Stairs", label: "Headroom over stairs", value: 80 * IN, unit: "len", help: `IRC R311.7.2: 6' 8" minimum, measured straight up from the line of the step noses.` },
  { key: "stair.riserMax", group: "Stairs", label: "Tallest step", value: 7.75 * IN, unit: "len", help: 'IRC R311.7.5.1: 7\xBE" maximum riser height.' },
  { key: "stair.treadMin", group: "Stairs", label: "Shallowest tread", value: 10 * IN, unit: "len", help: 'IRC R311.7.5.2: 10" minimum tread depth.' },
  { key: "stair.widthMin", group: "Stairs", label: "Narrowest stairs", value: 36 * IN, unit: "len", help: 'IRC R311.7.1: 36" minimum clear width.' },
  { key: "stair.landing", group: "Stairs", label: "Landing depth, as a share of the stair width", value: 100, unit: "pct", help: "IRC R311.7.6: a landing at least as deep as the stairs are wide." },
  { key: "stair.guardDrop", group: "Stairs", label: "Drop that needs a guard", value: 30 * IN, unit: "len", help: 'IRC R312.1.1: a guard on any open side more than 30" above the floor below.' }
]);

// src/lib/plan/walls.ts
defineStandards([
  { key: "wall.interior", group: "Walls", label: "Inside wall thickness", value: 4.5 * 25.4, unit: "len", help: '2x4 studs (3\xBD") with \xBD" drywall both sides: 4\xBD" finished.' },
  { key: "wall.exterior", group: "Walls", label: "Outside wall thickness", value: 6.5 * 25.4, unit: "len", help: '2x6 studs (5\xBD") with sheathing outside and drywall inside: about 6\xBD" before siding.' },
  { key: "wall.halfHeight", group: "Walls", label: "Half wall height", value: 42 * 25.4, unit: "len", help: `A pony wall or kitchen knee wall: 3' 6" is usual (counter height plus a cap).` }
]);

// src/lib/plan/standard.ts
var IN2 = 25.4;
var inch3 = (n) => Math.round(n * IN2);
var WIN = { width: inch3(36), height: inch3(48), sill: inch3(36) };
var DOOR_W = { door: inch3(32), double_door: inch3(60), sliding_door: inch3(72), opening: inch3(48), garage_door: inch3(192) };
var ENTRY_DOOR_W = inch3(36);
var DOOR_H = { opening: inch3(84), garage_door: inch3(84) };
var BALCONY_DEPTH = inch3(72);
var WIDTHS = {
  door: [inch3(30), inch3(32), inch3(36)],
  double_door: [inch3(48), inch3(60), inch3(72)],
  sliding_door: [inch3(60), inch3(72), inch3(96)],
  opening: [inch3(36), inch3(48), inch3(72)],
  garage_door: [inch3(96), inch3(108), inch3(192)],
  window: [inch3(24), inch3(36), inch3(48), inch3(72)]
};

// node_modules/splaytree/dist/splaytree.js
var f = class {
  constructor(t, e) {
    this.next = null, this.key = t, this.data = e, this.left = null, this.right = null;
  }
};
function d(n, t) {
  return n > t ? 1 : n < t ? -1 : 0;
}
function u(n, t, e) {
  const r = new f(null, null);
  let l = r, i = r;
  for (; ; ) {
    const o = e(n, t.key);
    if (o < 0) {
      if (t.left === null) break;
      if (e(n, t.left.key) < 0) {
        const s2 = t.left;
        if (t.left = s2.right, s2.right = t, t = s2, t.left === null) break;
      }
      i.left = t, i = t, t = t.left;
    } else if (o > 0) {
      if (t.right === null) break;
      if (e(n, t.right.key) > 0) {
        const s2 = t.right;
        if (t.right = s2.left, s2.left = t, t = s2, t.right === null) break;
      }
      l.right = t, l = t, t = t.right;
    } else break;
  }
  return l.right = t.left, i.left = t.right, t.left = r.right, t.right = r.left, t;
}
function c2(n, t, e, r) {
  const l = new f(n, t);
  if (e === null)
    return l.left = l.right = null, l;
  e = u(n, e, r);
  const i = r(n, e.key);
  return i < 0 ? (l.left = e.left, l.right = e, e.left = null) : i >= 0 && (l.right = e.right, l.left = e, e.right = null), l;
}
function m(n, t, e) {
  let r = null, l = null;
  if (t) {
    t = u(n, t, e);
    const i = e(t.key, n);
    i === 0 ? (r = t.left, l = t.right) : i < 0 ? (l = t.right, t.right = null, r = t) : (r = t.left, t.left = null, l = t);
  }
  return { left: r, right: l };
}
function w(n, t, e) {
  return t === null ? n : (n === null || (t = u(n.key, t, e), t.left = n), t);
}
function _(n, t, e, r, l) {
  if (n) {
    r(`${t}${e ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 "}${l(n)}
`);
    const i = t + (e ? "    " : "\u2502   ");
    n.left && _(n.left, i, false, r, l), n.right && _(n.right, i, true, r, l);
  }
}
var z = class {
  constructor(t = d) {
    this._root = null, this._size = 0, this._comparator = t;
  }
  /**
   * Inserts a key, allows duplicates
   */
  insert(t, e) {
    return this._size++, this._root = c2(t, e, this._root, this._comparator);
  }
  /**
   * Adds a key, if it is not present in the tree
   */
  add(t, e) {
    const r = new f(t, e);
    this._root === null && (r.left = r.right = null, this._size++, this._root = r);
    const l = this._comparator, i = u(t, this._root, l), o = l(t, i.key);
    return o === 0 ? this._root = i : (o < 0 ? (r.left = i.left, r.right = i, i.left = null) : o > 0 && (r.right = i.right, r.left = i, i.right = null), this._size++, this._root = r), this._root;
  }
  /**
   * @param  {Key} key
   * @return {Node|null}
   */
  remove(t) {
    this._root = this._remove(t, this._root, this._comparator);
  }
  /**
   * Deletes i from the tree if it's there
   */
  _remove(t, e, r) {
    let l;
    return e === null ? null : (e = u(t, e, r), r(t, e.key) === 0 ? (e.left === null ? l = e.right : (l = u(t, e.left, r), l.right = e.right), this._size--, l) : e);
  }
  /**
   * Removes and returns the node with smallest key
   */
  pop() {
    let t = this._root;
    if (t) {
      for (; t.left; ) t = t.left;
      return this._root = u(t.key, this._root, this._comparator), this._root = this._remove(t.key, this._root, this._comparator), { key: t.key, data: t.data };
    }
    return null;
  }
  /**
   * Find without splaying
   */
  findStatic(t) {
    let e = this._root;
    const r = this._comparator;
    for (; e; ) {
      const l = r(t, e.key);
      if (l === 0) return e;
      l < 0 ? e = e.left : e = e.right;
    }
    return null;
  }
  find(t) {
    return this._root && (this._root = u(t, this._root, this._comparator), this._comparator(t, this._root.key) !== 0) ? null : this._root;
  }
  contains(t) {
    let e = this._root;
    const r = this._comparator;
    for (; e; ) {
      const l = r(t, e.key);
      if (l === 0) return true;
      l < 0 ? e = e.left : e = e.right;
    }
    return false;
  }
  forEach(t, e) {
    let r = this._root;
    const l = [];
    let i = false;
    for (; !i; )
      r !== null ? (l.push(r), r = r.left) : l.length !== 0 ? (r = l.pop(), t.call(e, r), r = r.right) : i = true;
    return this;
  }
  /**
   * Walk key range from `low` to `high`. Stops if `fn` returns a value.
   */
  range(t, e, r, l) {
    const i = [], o = this._comparator;
    let s2 = this._root, h;
    for (; i.length !== 0 || s2; )
      if (s2)
        i.push(s2), s2 = s2.left;
      else {
        if (s2 = i.pop(), h = o(s2.key, e), h > 0)
          break;
        if (o(s2.key, t) >= 0 && r.call(l, s2))
          return this;
        s2 = s2.right;
      }
    return this;
  }
  /**
   * Returns array of keys
   */
  keys() {
    const t = [];
    return this.forEach(({ key: e }) => {
      t.push(e);
    }), t;
  }
  /**
   * Returns array of all the data in the nodes
   */
  values() {
    const t = [];
    return this.forEach(({ data: e }) => {
      t.push(e);
    }), t;
  }
  min() {
    return this._root ? this.minNode(this._root).key : null;
  }
  max() {
    return this._root ? this.maxNode(this._root).key : null;
  }
  minNode(t = this._root) {
    if (t) for (; t.left; ) t = t.left;
    return t;
  }
  maxNode(t = this._root) {
    if (t) for (; t.right; ) t = t.right;
    return t;
  }
  /**
   * Returns node at given index
   */
  at(t) {
    let e = this._root, r = false, l = 0;
    const i = [];
    for (; !r; )
      if (e)
        i.push(e), e = e.left;
      else if (i.length > 0) {
        if (e = i.pop(), l === t) return e;
        l++, e = e.right;
      } else r = true;
    return null;
  }
  next(t) {
    let e = this._root, r = null;
    if (t.right) {
      for (r = t.right; r.left; ) r = r.left;
      return r;
    }
    const l = this._comparator;
    for (; e; ) {
      const i = l(t.key, e.key);
      if (i === 0) break;
      i < 0 ? (r = e, e = e.left) : e = e.right;
    }
    return r;
  }
  prev(t) {
    let e = this._root, r = null;
    if (t.left !== null) {
      for (r = t.left; r.right; ) r = r.right;
      return r;
    }
    const l = this._comparator;
    for (; e; ) {
      const i = l(t.key, e.key);
      if (i === 0) break;
      i < 0 ? e = e.left : (r = e, e = e.right);
    }
    return r;
  }
  clear() {
    return this._root = null, this._size = 0, this;
  }
  toList() {
    return k(this._root);
  }
  /**
   * Bulk-load items. Both array have to be same size
   */
  load(t, e = [], r = false) {
    let l = t.length;
    const i = this._comparator;
    if (r && g(t, e, 0, l - 1, i), this._root === null)
      this._root = a(t, e, 0, l), this._size = l;
    else {
      const o = y(
        this.toList(),
        x(t, e),
        i
      );
      l = this._size + l, this._root = p({ head: o }, 0, l);
    }
    return this;
  }
  isEmpty() {
    return this._root === null;
  }
  get size() {
    return this._size;
  }
  get root() {
    return this._root;
  }
  toString(t = (e) => String(e.key)) {
    const e = [];
    return _(this._root, "", true, (r) => e.push(r), t), e.join("");
  }
  update(t, e, r) {
    const l = this._comparator;
    let { left: i, right: o } = m(t, this._root, l);
    l(t, e) < 0 ? o = c2(e, r, o, l) : i = c2(e, r, i, l), this._root = w(i, o, l);
  }
  split(t) {
    return m(t, this._root, this._comparator);
  }
  *[Symbol.iterator]() {
    let t = this._root;
    const e = [];
    let r = false;
    for (; !r; )
      t !== null ? (e.push(t), t = t.left) : e.length !== 0 ? (t = e.pop(), yield t, t = t.right) : r = true;
  }
};
function a(n, t, e, r) {
  const l = r - e;
  if (l > 0) {
    const i = e + Math.floor(l / 2), o = n[i], s2 = t[i], h = new f(o, s2);
    return h.left = a(n, t, e, i), h.right = a(n, t, i + 1, r), h;
  }
  return null;
}
function x(n, t) {
  const e = new f(null, null);
  let r = e;
  for (let l = 0; l < n.length; l++)
    r = r.next = new f(n[l], t[l]);
  return r.next = null, e.next;
}
function k(n) {
  let t = n;
  const e = [];
  let r = false;
  const l = new f(null, null);
  let i = l;
  for (; !r; )
    t ? (e.push(t), t = t.left) : e.length > 0 ? (t = i = i.next = e.pop(), t = t.right) : r = true;
  return i.next = null, l.next;
}
function p(n, t, e) {
  const r = e - t;
  if (r > 0) {
    const l = t + Math.floor(r / 2), i = p(n, t, l), o = n.head;
    return o.left = i, n.head = n.head.next, o.right = p(n, l + 1, e), o;
  }
  return null;
}
function y(n, t, e) {
  const r = new f(null, null);
  let l = r, i = n, o = t;
  for (; i !== null && o !== null; )
    e(i.key, o.key) < 0 ? (l.next = i, i = i.next) : (l.next = o, o = o.next), l = l.next;
  return i !== null ? l.next = i : o !== null && (l.next = o), r.next;
}
function g(n, t, e, r, l) {
  if (e >= r) return;
  const i = n[e + r >> 1];
  let o = e - 1, s2 = r + 1;
  for (; ; ) {
    do
      o++;
    while (l(n[o], i) < 0);
    do
      s2--;
    while (l(n[s2], i) > 0);
    if (o >= s2) break;
    let h = n[o];
    n[o] = n[s2], n[s2] = h, h = t[o], t[o] = t[s2], t[s2] = h;
  }
  g(n, t, e, s2, l), g(n, t, s2 + 1, r, l);
}

// node_modules/robust-predicates/esm/util.js
var epsilon = 11102230246251565e-32;
var splitter = 134217729;
var resulterrbound = (3 + 8 * epsilon) * epsilon;
function sum(elen, e, flen, f2, h) {
  let Q, Qnew, hh, bvirt;
  let enow = e[0];
  let fnow = f2[0];
  let eindex = 0;
  let findex = 0;
  if (fnow > enow === fnow > -enow) {
    Q = enow;
    enow = e[++eindex];
  } else {
    Q = fnow;
    fnow = f2[++findex];
  }
  let hindex = 0;
  if (eindex < elen && findex < flen) {
    if (fnow > enow === fnow > -enow) {
      Qnew = enow + Q;
      hh = Q - (Qnew - enow);
      enow = e[++eindex];
    } else {
      Qnew = fnow + Q;
      hh = Q - (Qnew - fnow);
      fnow = f2[++findex];
    }
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
    while (eindex < elen && findex < flen) {
      if (fnow > enow === fnow > -enow) {
        Qnew = Q + enow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (enow - bvirt);
        enow = e[++eindex];
      } else {
        Qnew = Q + fnow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
        fnow = f2[++findex];
      }
      Q = Qnew;
      if (hh !== 0) {
        h[hindex++] = hh;
      }
    }
  }
  while (eindex < elen) {
    Qnew = Q + enow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (enow - bvirt);
    enow = e[++eindex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  while (findex < flen) {
    Qnew = Q + fnow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (fnow - bvirt);
    fnow = f2[++findex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  if (Q !== 0 || hindex === 0) {
    h[hindex++] = Q;
  }
  return hindex;
}
function estimate(elen, e) {
  let Q = e[0];
  for (let i = 1; i < elen; i++) Q += e[i];
  return Q;
}
function vec(n) {
  return new Float64Array(n);
}

// node_modules/robust-predicates/esm/orient2d.js
var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
var B = vec(4);
var C1 = vec(8);
var C2 = vec(12);
var D = vec(16);
var u2 = vec(4);
function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
  let acxtail, acytail, bcxtail, bcytail;
  let bvirt, c3, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u32;
  const acx = ax - cx;
  const bcx = bx - cx;
  const acy = ay - cy;
  const bcy = by - cy;
  s1 = acx * bcy;
  c3 = splitter * acx;
  ahi = c3 - (c3 - acx);
  alo = acx - ahi;
  c3 = splitter * bcy;
  bhi = c3 - (c3 - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcx;
  c3 = splitter * acy;
  ahi = c3 - (c3 - acy);
  alo = acy - ahi;
  c3 = splitter * bcx;
  bhi = c3 - (c3 - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  B[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  B[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  B[2] = _j - (u32 - bvirt) + (_i - bvirt);
  B[3] = u32;
  let det = estimate(4, B);
  let errbound = ccwerrboundB * detsum;
  if (det >= errbound || -det >= errbound) {
    return det;
  }
  bvirt = ax - acx;
  acxtail = ax - (acx + bvirt) + (bvirt - cx);
  bvirt = bx - bcx;
  bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
  bvirt = ay - acy;
  acytail = ay - (acy + bvirt) + (bvirt - cy);
  bvirt = by - bcy;
  bcytail = by - (bcy + bvirt) + (bvirt - cy);
  if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
    return det;
  }
  errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
  det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
  if (det >= errbound || -det >= errbound) return det;
  s1 = acxtail * bcy;
  c3 = splitter * acxtail;
  ahi = c3 - (c3 - acxtail);
  alo = acxtail - ahi;
  c3 = splitter * bcy;
  bhi = c3 - (c3 - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcx;
  c3 = splitter * acytail;
  ahi = c3 - (c3 - acytail);
  alo = acytail - ahi;
  c3 = splitter * bcx;
  bhi = c3 - (c3 - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u2[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u2[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u2[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u2[3] = u32;
  const C1len = sum(4, B, 4, u2, C1);
  s1 = acx * bcytail;
  c3 = splitter * acx;
  ahi = c3 - (c3 - acx);
  alo = acx - ahi;
  c3 = splitter * bcytail;
  bhi = c3 - (c3 - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcxtail;
  c3 = splitter * acy;
  ahi = c3 - (c3 - acy);
  alo = acy - ahi;
  c3 = splitter * bcxtail;
  bhi = c3 - (c3 - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u2[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u2[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u2[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u2[3] = u32;
  const C2len = sum(C1len, C1, 4, u2, C2);
  s1 = acxtail * bcytail;
  c3 = splitter * acxtail;
  ahi = c3 - (c3 - acxtail);
  alo = acxtail - ahi;
  c3 = splitter * bcytail;
  bhi = c3 - (c3 - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcxtail;
  c3 = splitter * acytail;
  ahi = c3 - (c3 - acytail);
  alo = acytail - ahi;
  c3 = splitter * bcxtail;
  bhi = c3 - (c3 - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u2[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u2[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u2[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u2[3] = u32;
  const Dlen = sum(C2len, C2, 4, u2, D);
  return D[Dlen - 1];
}
function orient2d(ax, ay, bx, by, cx, cy) {
  const detleft = (ay - cy) * (bx - cx);
  const detright = (ax - cx) * (by - cy);
  const det = detleft - detright;
  const detsum = Math.abs(detleft + detright);
  if (Math.abs(det) >= ccwerrboundA * detsum) return det;
  return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}

// node_modules/robust-predicates/esm/orient3d.js
var o3derrboundA = (7 + 56 * epsilon) * epsilon;
var o3derrboundB = (3 + 28 * epsilon) * epsilon;
var o3derrboundC = (26 + 288 * epsilon) * epsilon * epsilon;
var bc = vec(4);
var ca = vec(4);
var ab = vec(4);
var at_b = vec(4);
var at_c = vec(4);
var bt_c = vec(4);
var bt_a = vec(4);
var ct_a = vec(4);
var ct_b = vec(4);
var bct = vec(8);
var cat = vec(8);
var abt = vec(8);
var u3 = vec(4);
var _8 = vec(8);
var _8b = vec(8);
var _16 = vec(16);
var _12 = vec(12);
var fin = vec(192);
var fin2 = vec(192);

// node_modules/robust-predicates/esm/incircle.js
var iccerrboundA = (10 + 96 * epsilon) * epsilon;
var iccerrboundB = (4 + 48 * epsilon) * epsilon;
var iccerrboundC = (44 + 576 * epsilon) * epsilon * epsilon;
var bc2 = vec(4);
var ca2 = vec(4);
var ab2 = vec(4);
var aa = vec(4);
var bb = vec(4);
var cc = vec(4);
var u4 = vec(4);
var v = vec(4);
var axtbc = vec(8);
var aytbc = vec(8);
var bxtca = vec(8);
var bytca = vec(8);
var cxtab = vec(8);
var cytab = vec(8);
var abt2 = vec(8);
var bct2 = vec(8);
var cat2 = vec(8);
var abtt = vec(4);
var bctt = vec(4);
var catt = vec(4);
var _82 = vec(8);
var _162 = vec(16);
var _16b = vec(16);
var _16c = vec(16);
var _32 = vec(32);
var _32b = vec(32);
var _48 = vec(48);
var _64 = vec(64);
var fin3 = vec(1152);
var fin22 = vec(1152);

// node_modules/robust-predicates/esm/insphere.js
var isperrboundA = (16 + 224 * epsilon) * epsilon;
var isperrboundB = (5 + 72 * epsilon) * epsilon;
var isperrboundC = (71 + 1408 * epsilon) * epsilon * epsilon;
var ab3 = vec(4);
var bc3 = vec(4);
var cd = vec(4);
var de = vec(4);
var ea = vec(4);
var ac = vec(4);
var bd = vec(4);
var ce = vec(4);
var da = vec(4);
var eb = vec(4);
var abc = vec(24);
var bcd = vec(24);
var cde = vec(24);
var dea = vec(24);
var eab = vec(24);
var abd = vec(24);
var bce = vec(24);
var cda = vec(24);
var deb = vec(24);
var eac = vec(24);
var adet = vec(1152);
var bdet = vec(1152);
var cdet = vec(1152);
var ddet = vec(1152);
var edet = vec(1152);
var abdet = vec(2304);
var cddet = vec(2304);
var cdedet = vec(3456);
var deter = vec(5760);
var _83 = vec(8);
var _8b2 = vec(8);
var _8c = vec(8);
var _163 = vec(16);
var _24 = vec(24);
var _482 = vec(48);
var _48b = vec(48);
var _96 = vec(96);
var _192 = vec(192);
var _384x = vec(384);
var _384y = vec(384);
var _384z = vec(384);
var _768 = vec(768);
var xdet = vec(96);
var ydet = vec(96);
var zdet = vec(96);
var fin4 = vec(1152);

// node_modules/polygon-clipping/dist/polygon-clipping.esm.js
var isInBbox = (bbox, point) => {
  return bbox.ll.x <= point.x && point.x <= bbox.ur.x && bbox.ll.y <= point.y && point.y <= bbox.ur.y;
};
var getBboxOverlap = (b1, b2) => {
  if (b2.ur.x < b1.ll.x || b1.ur.x < b2.ll.x || b2.ur.y < b1.ll.y || b1.ur.y < b2.ll.y) return null;
  const lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
  const upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x;
  const lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
  const upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y;
  return {
    ll: {
      x: lowerX,
      y: lowerY
    },
    ur: {
      x: upperX,
      y: upperY
    }
  };
};
var epsilon2 = Number.EPSILON;
if (epsilon2 === void 0) epsilon2 = Math.pow(2, -52);
var EPSILON_SQ = epsilon2 * epsilon2;
var cmp = (a2, b2) => {
  if (-epsilon2 < a2 && a2 < epsilon2) {
    if (-epsilon2 < b2 && b2 < epsilon2) {
      return 0;
    }
  }
  const ab4 = a2 - b2;
  if (ab4 * ab4 < EPSILON_SQ * a2 * b2) {
    return 0;
  }
  return a2 < b2 ? -1 : 1;
};
var PtRounder = class {
  constructor() {
    this.reset();
  }
  reset() {
    this.xRounder = new CoordRounder();
    this.yRounder = new CoordRounder();
  }
  round(x2, y2) {
    return {
      x: this.xRounder.round(x2),
      y: this.yRounder.round(y2)
    };
  }
};
var CoordRounder = class {
  constructor() {
    this.tree = new z();
    this.round(0);
  }
  // Note: this can rounds input values backwards or forwards.
  //       You might ask, why not restrict this to just rounding
  //       forwards? Wouldn't that allow left endpoints to always
  //       remain left endpoints during splitting (never change to
  //       right). No - it wouldn't, because we snap intersections
  //       to endpoints (to establish independence from the segment
  //       angle for t-intersections).
  round(coord) {
    const node = this.tree.add(coord);
    const prevNode = this.tree.prev(node);
    if (prevNode !== null && cmp(node.key, prevNode.key) === 0) {
      this.tree.remove(coord);
      return prevNode.key;
    }
    const nextNode = this.tree.next(node);
    if (nextNode !== null && cmp(node.key, nextNode.key) === 0) {
      this.tree.remove(coord);
      return nextNode.key;
    }
    return coord;
  }
};
var rounder = new PtRounder();
var crossProduct = (a2, b2) => a2.x * b2.y - a2.y * b2.x;
var dotProduct = (a2, b2) => a2.x * b2.x + a2.y * b2.y;
var compareVectorAngles = (basePt, endPt1, endPt2) => {
  const res = orient2d(basePt.x, basePt.y, endPt1.x, endPt1.y, endPt2.x, endPt2.y);
  if (res > 0) return -1;
  if (res < 0) return 1;
  return 0;
};
var length = (v2) => Math.sqrt(dotProduct(v2, v2));
var sineOfAngle = (pShared, pBase, pAngle) => {
  const vBase = {
    x: pBase.x - pShared.x,
    y: pBase.y - pShared.y
  };
  const vAngle = {
    x: pAngle.x - pShared.x,
    y: pAngle.y - pShared.y
  };
  return crossProduct(vAngle, vBase) / length(vAngle) / length(vBase);
};
var cosineOfAngle = (pShared, pBase, pAngle) => {
  const vBase = {
    x: pBase.x - pShared.x,
    y: pBase.y - pShared.y
  };
  const vAngle = {
    x: pAngle.x - pShared.x,
    y: pAngle.y - pShared.y
  };
  return dotProduct(vAngle, vBase) / length(vAngle) / length(vBase);
};
var horizontalIntersection = (pt, v2, y2) => {
  if (v2.y === 0) return null;
  return {
    x: pt.x + v2.x / v2.y * (y2 - pt.y),
    y: y2
  };
};
var verticalIntersection = (pt, v2, x2) => {
  if (v2.x === 0) return null;
  return {
    x: x2,
    y: pt.y + v2.y / v2.x * (x2 - pt.x)
  };
};
var intersection$1 = (pt1, v1, pt2, v2) => {
  if (v1.x === 0) return verticalIntersection(pt2, v2, pt1.x);
  if (v2.x === 0) return verticalIntersection(pt1, v1, pt2.x);
  if (v1.y === 0) return horizontalIntersection(pt2, v2, pt1.y);
  if (v2.y === 0) return horizontalIntersection(pt1, v1, pt2.y);
  const kross = crossProduct(v1, v2);
  if (kross == 0) return null;
  const ve = {
    x: pt2.x - pt1.x,
    y: pt2.y - pt1.y
  };
  const d1 = crossProduct(ve, v1) / kross;
  const d2 = crossProduct(ve, v2) / kross;
  const x1 = pt1.x + d2 * v1.x, x2 = pt2.x + d1 * v2.x;
  const y1 = pt1.y + d2 * v1.y, y2 = pt2.y + d1 * v2.y;
  const x3 = (x1 + x2) / 2;
  const y3 = (y1 + y2) / 2;
  return {
    x: x3,
    y: y3
  };
};
var SweepEvent = class _SweepEvent {
  // for ordering sweep events in the sweep event queue
  static compare(a2, b2) {
    const ptCmp = _SweepEvent.comparePoints(a2.point, b2.point);
    if (ptCmp !== 0) return ptCmp;
    if (a2.point !== b2.point) a2.link(b2);
    if (a2.isLeft !== b2.isLeft) return a2.isLeft ? 1 : -1;
    return Segment.compare(a2.segment, b2.segment);
  }
  // for ordering points in sweep line order
  static comparePoints(aPt, bPt) {
    if (aPt.x < bPt.x) return -1;
    if (aPt.x > bPt.x) return 1;
    if (aPt.y < bPt.y) return -1;
    if (aPt.y > bPt.y) return 1;
    return 0;
  }
  // Warning: 'point' input will be modified and re-used (for performance)
  constructor(point, isLeft) {
    if (point.events === void 0) point.events = [this];
    else point.events.push(this);
    this.point = point;
    this.isLeft = isLeft;
  }
  link(other) {
    if (other.point === this.point) {
      throw new Error("Tried to link already linked events");
    }
    const otherEvents = other.point.events;
    for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
      const evt = otherEvents[i];
      this.point.events.push(evt);
      evt.point = this.point;
    }
    this.checkForConsuming();
  }
  /* Do a pass over our linked events and check to see if any pair
   * of segments match, and should be consumed. */
  checkForConsuming() {
    const numEvents = this.point.events.length;
    for (let i = 0; i < numEvents; i++) {
      const evt1 = this.point.events[i];
      if (evt1.segment.consumedBy !== void 0) continue;
      for (let j = i + 1; j < numEvents; j++) {
        const evt2 = this.point.events[j];
        if (evt2.consumedBy !== void 0) continue;
        if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
        evt1.segment.consume(evt2.segment);
      }
    }
  }
  getAvailableLinkedEvents() {
    const events = [];
    for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
      const evt = this.point.events[i];
      if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
        events.push(evt);
      }
    }
    return events;
  }
  /**
   * Returns a comparator function for sorting linked events that will
   * favor the event that will give us the smallest left-side angle.
   * All ring construction starts as low as possible heading to the right,
   * so by always turning left as sharp as possible we'll get polygons
   * without uncessary loops & holes.
   *
   * The comparator function has a compute cache such that it avoids
   * re-computing already-computed values.
   */
  getLeftmostComparator(baseEvent) {
    const cache = /* @__PURE__ */ new Map();
    const fillCache = (linkedEvent) => {
      const nextEvent = linkedEvent.otherSE;
      cache.set(linkedEvent, {
        sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
        cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
      });
    };
    return (a2, b2) => {
      if (!cache.has(a2)) fillCache(a2);
      if (!cache.has(b2)) fillCache(b2);
      const {
        sine: asine,
        cosine: acosine
      } = cache.get(a2);
      const {
        sine: bsine,
        cosine: bcosine
      } = cache.get(b2);
      if (asine >= 0 && bsine >= 0) {
        if (acosine < bcosine) return 1;
        if (acosine > bcosine) return -1;
        return 0;
      }
      if (asine < 0 && bsine < 0) {
        if (acosine < bcosine) return -1;
        if (acosine > bcosine) return 1;
        return 0;
      }
      if (bsine < asine) return -1;
      if (bsine > asine) return 1;
      return 0;
    };
  }
};
var segmentId = 0;
var Segment = class _Segment {
  /* This compare() function is for ordering segments in the sweep
   * line tree, and does so according to the following criteria:
   *
   * Consider the vertical line that lies an infinestimal step to the
   * right of the right-more of the two left endpoints of the input
   * segments. Imagine slowly moving a point up from negative infinity
   * in the increasing y direction. Which of the two segments will that
   * point intersect first? That segment comes 'before' the other one.
   *
   * If neither segment would be intersected by such a line, (if one
   * or more of the segments are vertical) then the line to be considered
   * is directly on the right-more of the two left inputs.
   */
  static compare(a2, b2) {
    const alx = a2.leftSE.point.x;
    const blx = b2.leftSE.point.x;
    const arx = a2.rightSE.point.x;
    const brx = b2.rightSE.point.x;
    if (brx < alx) return 1;
    if (arx < blx) return -1;
    const aly = a2.leftSE.point.y;
    const bly = b2.leftSE.point.y;
    const ary = a2.rightSE.point.y;
    const bry = b2.rightSE.point.y;
    if (alx < blx) {
      if (bly < aly && bly < ary) return 1;
      if (bly > aly && bly > ary) return -1;
      const aCmpBLeft = a2.comparePoint(b2.leftSE.point);
      if (aCmpBLeft < 0) return 1;
      if (aCmpBLeft > 0) return -1;
      const bCmpARight = b2.comparePoint(a2.rightSE.point);
      if (bCmpARight !== 0) return bCmpARight;
      return -1;
    }
    if (alx > blx) {
      if (aly < bly && aly < bry) return -1;
      if (aly > bly && aly > bry) return 1;
      const bCmpALeft = b2.comparePoint(a2.leftSE.point);
      if (bCmpALeft !== 0) return bCmpALeft;
      const aCmpBRight = a2.comparePoint(b2.rightSE.point);
      if (aCmpBRight < 0) return 1;
      if (aCmpBRight > 0) return -1;
      return 1;
    }
    if (aly < bly) return -1;
    if (aly > bly) return 1;
    if (arx < brx) {
      const bCmpARight = b2.comparePoint(a2.rightSE.point);
      if (bCmpARight !== 0) return bCmpARight;
    }
    if (arx > brx) {
      const aCmpBRight = a2.comparePoint(b2.rightSE.point);
      if (aCmpBRight < 0) return 1;
      if (aCmpBRight > 0) return -1;
    }
    if (arx !== brx) {
      const ay = ary - aly;
      const ax = arx - alx;
      const by = bry - bly;
      const bx = brx - blx;
      if (ay > ax && by < bx) return 1;
      if (ay < ax && by > bx) return -1;
    }
    if (arx > brx) return 1;
    if (arx < brx) return -1;
    if (ary < bry) return -1;
    if (ary > bry) return 1;
    if (a2.id < b2.id) return -1;
    if (a2.id > b2.id) return 1;
    return 0;
  }
  /* Warning: a reference to ringWindings input will be stored,
   *  and possibly will be later modified */
  constructor(leftSE, rightSE, rings, windings) {
    this.id = ++segmentId;
    this.leftSE = leftSE;
    leftSE.segment = this;
    leftSE.otherSE = rightSE;
    this.rightSE = rightSE;
    rightSE.segment = this;
    rightSE.otherSE = leftSE;
    this.rings = rings;
    this.windings = windings;
  }
  static fromRing(pt1, pt2, ring) {
    let leftPt, rightPt, winding;
    const cmpPts = SweepEvent.comparePoints(pt1, pt2);
    if (cmpPts < 0) {
      leftPt = pt1;
      rightPt = pt2;
      winding = 1;
    } else if (cmpPts > 0) {
      leftPt = pt2;
      rightPt = pt1;
      winding = -1;
    } else throw new Error(`Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`);
    const leftSE = new SweepEvent(leftPt, true);
    const rightSE = new SweepEvent(rightPt, false);
    return new _Segment(leftSE, rightSE, [ring], [winding]);
  }
  /* When a segment is split, the rightSE is replaced with a new sweep event */
  replaceRightSE(newRightSE) {
    this.rightSE = newRightSE;
    this.rightSE.segment = this;
    this.rightSE.otherSE = this.leftSE;
    this.leftSE.otherSE = this.rightSE;
  }
  bbox() {
    const y1 = this.leftSE.point.y;
    const y2 = this.rightSE.point.y;
    return {
      ll: {
        x: this.leftSE.point.x,
        y: y1 < y2 ? y1 : y2
      },
      ur: {
        x: this.rightSE.point.x,
        y: y1 > y2 ? y1 : y2
      }
    };
  }
  /* A vector from the left point to the right */
  vector() {
    return {
      x: this.rightSE.point.x - this.leftSE.point.x,
      y: this.rightSE.point.y - this.leftSE.point.y
    };
  }
  isAnEndpoint(pt) {
    return pt.x === this.leftSE.point.x && pt.y === this.leftSE.point.y || pt.x === this.rightSE.point.x && pt.y === this.rightSE.point.y;
  }
  /* Compare this segment with a point.
   *
   * A point P is considered to be colinear to a segment if there
   * exists a distance D such that if we travel along the segment
   * from one * endpoint towards the other a distance D, we find
   * ourselves at point P.
   *
   * Return value indicates:
   *
   *   1: point lies above the segment (to the left of vertical)
   *   0: point is colinear to segment
   *  -1: point lies below the segment (to the right of vertical)
   */
  comparePoint(point) {
    if (this.isAnEndpoint(point)) return 0;
    const lPt = this.leftSE.point;
    const rPt = this.rightSE.point;
    const v2 = this.vector();
    if (lPt.x === rPt.x) {
      if (point.x === lPt.x) return 0;
      return point.x < lPt.x ? 1 : -1;
    }
    const yDist = (point.y - lPt.y) / v2.y;
    const xFromYDist = lPt.x + yDist * v2.x;
    if (point.x === xFromYDist) return 0;
    const xDist = (point.x - lPt.x) / v2.x;
    const yFromXDist = lPt.y + xDist * v2.y;
    if (point.y === yFromXDist) return 0;
    return point.y < yFromXDist ? -1 : 1;
  }
  /**
   * Given another segment, returns the first non-trivial intersection
   * between the two segments (in terms of sweep line ordering), if it exists.
   *
   * A 'non-trivial' intersection is one that will cause one or both of the
   * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
   *
   *   * endpoint of segA with endpoint of segB --> trivial
   *   * endpoint of segA with point along segB --> non-trivial
   *   * endpoint of segB with point along segA --> non-trivial
   *   * point along segA with point along segB --> non-trivial
   *
   * If no non-trivial intersection exists, return null
   * Else, return null.
   */
  getIntersection(other) {
    const tBbox = this.bbox();
    const oBbox = other.bbox();
    const bboxOverlap = getBboxOverlap(tBbox, oBbox);
    if (bboxOverlap === null) return null;
    const tlp = this.leftSE.point;
    const trp = this.rightSE.point;
    const olp = other.leftSE.point;
    const orp = other.rightSE.point;
    const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
    const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
    const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
    const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;
    if (touchesThisLSE && touchesOtherLSE) {
      if (touchesThisRSE && !touchesOtherRSE) return trp;
      if (!touchesThisRSE && touchesOtherRSE) return orp;
      return null;
    }
    if (touchesThisLSE) {
      if (touchesOtherRSE) {
        if (tlp.x === orp.x && tlp.y === orp.y) return null;
      }
      return tlp;
    }
    if (touchesOtherLSE) {
      if (touchesThisRSE) {
        if (trp.x === olp.x && trp.y === olp.y) return null;
      }
      return olp;
    }
    if (touchesThisRSE && touchesOtherRSE) return null;
    if (touchesThisRSE) return trp;
    if (touchesOtherRSE) return orp;
    const pt = intersection$1(tlp, this.vector(), olp, other.vector());
    if (pt === null) return null;
    if (!isInBbox(bboxOverlap, pt)) return null;
    return rounder.round(pt.x, pt.y);
  }
  /**
   * Split the given segment into multiple segments on the given points.
   *  * Each existing segment will retain its leftSE and a new rightSE will be
   *    generated for it.
   *  * A new segment will be generated which will adopt the original segment's
   *    rightSE, and a new leftSE will be generated for it.
   *  * If there are more than two points given to split on, new segments
   *    in the middle will be generated with new leftSE and rightSE's.
   *  * An array of the newly generated SweepEvents will be returned.
   *
   * Warning: input array of points is modified
   */
  split(point) {
    const newEvents = [];
    const alreadyLinked = point.events !== void 0;
    const newLeftSE = new SweepEvent(point, true);
    const newRightSE = new SweepEvent(point, false);
    const oldRightSE = this.rightSE;
    this.replaceRightSE(newRightSE);
    newEvents.push(newRightSE);
    newEvents.push(newLeftSE);
    const newSeg = new _Segment(newLeftSE, oldRightSE, this.rings.slice(), this.windings.slice());
    if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
      newSeg.swapEvents();
    }
    if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
      this.swapEvents();
    }
    if (alreadyLinked) {
      newLeftSE.checkForConsuming();
      newRightSE.checkForConsuming();
    }
    return newEvents;
  }
  /* Swap which event is left and right */
  swapEvents() {
    const tmpEvt = this.rightSE;
    this.rightSE = this.leftSE;
    this.leftSE = tmpEvt;
    this.leftSE.isLeft = true;
    this.rightSE.isLeft = false;
    for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
      this.windings[i] *= -1;
    }
  }
  /* Consume another segment. We take their rings under our wing
   * and mark them as consumed. Use for perfectly overlapping segments */
  consume(other) {
    let consumer = this;
    let consumee = other;
    while (consumer.consumedBy) consumer = consumer.consumedBy;
    while (consumee.consumedBy) consumee = consumee.consumedBy;
    const cmp2 = _Segment.compare(consumer, consumee);
    if (cmp2 === 0) return;
    if (cmp2 > 0) {
      const tmp = consumer;
      consumer = consumee;
      consumee = tmp;
    }
    if (consumer.prev === consumee) {
      const tmp = consumer;
      consumer = consumee;
      consumee = tmp;
    }
    for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
      const ring = consumee.rings[i];
      const winding = consumee.windings[i];
      const index2 = consumer.rings.indexOf(ring);
      if (index2 === -1) {
        consumer.rings.push(ring);
        consumer.windings.push(winding);
      } else consumer.windings[index2] += winding;
    }
    consumee.rings = null;
    consumee.windings = null;
    consumee.consumedBy = consumer;
    consumee.leftSE.consumedBy = consumer.leftSE;
    consumee.rightSE.consumedBy = consumer.rightSE;
  }
  /* The first segment previous segment chain that is in the result */
  prevInResult() {
    if (this._prevInResult !== void 0) return this._prevInResult;
    if (!this.prev) this._prevInResult = null;
    else if (this.prev.isInResult()) this._prevInResult = this.prev;
    else this._prevInResult = this.prev.prevInResult();
    return this._prevInResult;
  }
  beforeState() {
    if (this._beforeState !== void 0) return this._beforeState;
    if (!this.prev) this._beforeState = {
      rings: [],
      windings: [],
      multiPolys: []
    };
    else {
      const seg = this.prev.consumedBy || this.prev;
      this._beforeState = seg.afterState();
    }
    return this._beforeState;
  }
  afterState() {
    if (this._afterState !== void 0) return this._afterState;
    const beforeState = this.beforeState();
    this._afterState = {
      rings: beforeState.rings.slice(0),
      windings: beforeState.windings.slice(0),
      multiPolys: []
    };
    const ringsAfter = this._afterState.rings;
    const windingsAfter = this._afterState.windings;
    const mpsAfter = this._afterState.multiPolys;
    for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
      const ring = this.rings[i];
      const winding = this.windings[i];
      const index2 = ringsAfter.indexOf(ring);
      if (index2 === -1) {
        ringsAfter.push(ring);
        windingsAfter.push(winding);
      } else windingsAfter[index2] += winding;
    }
    const polysAfter = [];
    const polysExclude = [];
    for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
      if (windingsAfter[i] === 0) continue;
      const ring = ringsAfter[i];
      const poly = ring.poly;
      if (polysExclude.indexOf(poly) !== -1) continue;
      if (ring.isExterior) polysAfter.push(poly);
      else {
        if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
        const index2 = polysAfter.indexOf(ring.poly);
        if (index2 !== -1) polysAfter.splice(index2, 1);
      }
    }
    for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
      const mp = polysAfter[i].multiPoly;
      if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
    }
    return this._afterState;
  }
  /* Is this segment part of the final result? */
  isInResult() {
    if (this.consumedBy) return false;
    if (this._isInResult !== void 0) return this._isInResult;
    const mpsBefore = this.beforeState().multiPolys;
    const mpsAfter = this.afterState().multiPolys;
    switch (operation.type) {
      case "union": {
        const noBefores = mpsBefore.length === 0;
        const noAfters = mpsAfter.length === 0;
        this._isInResult = noBefores !== noAfters;
        break;
      }
      case "intersection": {
        let least;
        let most;
        if (mpsBefore.length < mpsAfter.length) {
          least = mpsBefore.length;
          most = mpsAfter.length;
        } else {
          least = mpsAfter.length;
          most = mpsBefore.length;
        }
        this._isInResult = most === operation.numMultiPolys && least < most;
        break;
      }
      case "xor": {
        const diff = Math.abs(mpsBefore.length - mpsAfter.length);
        this._isInResult = diff % 2 === 1;
        break;
      }
      case "difference": {
        const isJustSubject = (mps) => mps.length === 1 && mps[0].isSubject;
        this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
        break;
      }
      default:
        throw new Error(`Unrecognized operation type found ${operation.type}`);
    }
    return this._isInResult;
  }
};
var RingIn = class {
  constructor(geomRing, poly, isExterior) {
    if (!Array.isArray(geomRing) || geomRing.length === 0) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    this.poly = poly;
    this.isExterior = isExterior;
    this.segments = [];
    if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    const firstPoint = rounder.round(geomRing[0][0], geomRing[0][1]);
    this.bbox = {
      ll: {
        x: firstPoint.x,
        y: firstPoint.y
      },
      ur: {
        x: firstPoint.x,
        y: firstPoint.y
      }
    };
    let prevPoint = firstPoint;
    for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
      if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
      }
      let point = rounder.round(geomRing[i][0], geomRing[i][1]);
      if (point.x === prevPoint.x && point.y === prevPoint.y) continue;
      this.segments.push(Segment.fromRing(prevPoint, point, this));
      if (point.x < this.bbox.ll.x) this.bbox.ll.x = point.x;
      if (point.y < this.bbox.ll.y) this.bbox.ll.y = point.y;
      if (point.x > this.bbox.ur.x) this.bbox.ur.x = point.x;
      if (point.y > this.bbox.ur.y) this.bbox.ur.y = point.y;
      prevPoint = point;
    }
    if (firstPoint.x !== prevPoint.x || firstPoint.y !== prevPoint.y) {
      this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
    }
  }
  getSweepEvents() {
    const sweepEvents = [];
    for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
      const segment = this.segments[i];
      sweepEvents.push(segment.leftSE);
      sweepEvents.push(segment.rightSE);
    }
    return sweepEvents;
  }
};
var PolyIn = class {
  constructor(geomPoly, multiPoly) {
    if (!Array.isArray(geomPoly)) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    this.exteriorRing = new RingIn(geomPoly[0], this, true);
    this.bbox = {
      ll: {
        x: this.exteriorRing.bbox.ll.x,
        y: this.exteriorRing.bbox.ll.y
      },
      ur: {
        x: this.exteriorRing.bbox.ur.x,
        y: this.exteriorRing.bbox.ur.y
      }
    };
    this.interiorRings = [];
    for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
      const ring = new RingIn(geomPoly[i], this, false);
      if (ring.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = ring.bbox.ll.x;
      if (ring.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = ring.bbox.ll.y;
      if (ring.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = ring.bbox.ur.x;
      if (ring.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = ring.bbox.ur.y;
      this.interiorRings.push(ring);
    }
    this.multiPoly = multiPoly;
  }
  getSweepEvents() {
    const sweepEvents = this.exteriorRing.getSweepEvents();
    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
      const ringSweepEvents = this.interiorRings[i].getSweepEvents();
      for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
        sweepEvents.push(ringSweepEvents[j]);
      }
    }
    return sweepEvents;
  }
};
var MultiPolyIn = class {
  constructor(geom, isSubject) {
    if (!Array.isArray(geom)) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    try {
      if (typeof geom[0][0][0] === "number") geom = [geom];
    } catch (ex) {
    }
    this.polys = [];
    this.bbox = {
      ll: {
        x: Number.POSITIVE_INFINITY,
        y: Number.POSITIVE_INFINITY
      },
      ur: {
        x: Number.NEGATIVE_INFINITY,
        y: Number.NEGATIVE_INFINITY
      }
    };
    for (let i = 0, iMax = geom.length; i < iMax; i++) {
      const poly = new PolyIn(geom[i], this);
      if (poly.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = poly.bbox.ll.x;
      if (poly.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = poly.bbox.ll.y;
      if (poly.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = poly.bbox.ur.x;
      if (poly.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = poly.bbox.ur.y;
      this.polys.push(poly);
    }
    this.isSubject = isSubject;
  }
  getSweepEvents() {
    const sweepEvents = [];
    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
      const polySweepEvents = this.polys[i].getSweepEvents();
      for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
        sweepEvents.push(polySweepEvents[j]);
      }
    }
    return sweepEvents;
  }
};
var RingOut = class _RingOut {
  /* Given the segments from the sweep line pass, compute & return a series
   * of closed rings from all the segments marked to be part of the result */
  static factory(allSegments) {
    const ringsOut = [];
    for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
      const segment = allSegments[i];
      if (!segment.isInResult() || segment.ringOut) continue;
      let prevEvent = null;
      let event = segment.leftSE;
      let nextEvent = segment.rightSE;
      const events = [event];
      const startingPoint = event.point;
      const intersectionLEs = [];
      while (true) {
        prevEvent = event;
        event = nextEvent;
        events.push(event);
        if (event.point === startingPoint) break;
        while (true) {
          const availableLEs = event.getAvailableLinkedEvents();
          if (availableLEs.length === 0) {
            const firstPt = events[0].point;
            const lastPt = events[events.length - 1].point;
            throw new Error(`Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`);
          }
          if (availableLEs.length === 1) {
            nextEvent = availableLEs[0].otherSE;
            break;
          }
          let indexLE = null;
          for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
            if (intersectionLEs[j].point === event.point) {
              indexLE = j;
              break;
            }
          }
          if (indexLE !== null) {
            const intersectionLE = intersectionLEs.splice(indexLE)[0];
            const ringEvents = events.splice(intersectionLE.index);
            ringEvents.unshift(ringEvents[0].otherSE);
            ringsOut.push(new _RingOut(ringEvents.reverse()));
            continue;
          }
          intersectionLEs.push({
            index: events.length,
            point: event.point
          });
          const comparator = event.getLeftmostComparator(prevEvent);
          nextEvent = availableLEs.sort(comparator)[0].otherSE;
          break;
        }
      }
      ringsOut.push(new _RingOut(events));
    }
    return ringsOut;
  }
  constructor(events) {
    this.events = events;
    for (let i = 0, iMax = events.length; i < iMax; i++) {
      events[i].segment.ringOut = this;
    }
    this.poly = null;
  }
  getGeom() {
    let prevPt = this.events[0].point;
    const points = [prevPt];
    for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
      const pt2 = this.events[i].point;
      const nextPt2 = this.events[i + 1].point;
      if (compareVectorAngles(pt2, prevPt, nextPt2) === 0) continue;
      points.push(pt2);
      prevPt = pt2;
    }
    if (points.length === 1) return null;
    const pt = points[0];
    const nextPt = points[1];
    if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
    points.push(points[0]);
    const step2 = this.isExteriorRing() ? 1 : -1;
    const iStart = this.isExteriorRing() ? 0 : points.length - 1;
    const iEnd = this.isExteriorRing() ? points.length : -1;
    const orderedPoints = [];
    for (let i = iStart; i != iEnd; i += step2) orderedPoints.push([points[i].x, points[i].y]);
    return orderedPoints;
  }
  isExteriorRing() {
    if (this._isExteriorRing === void 0) {
      const enclosing = this.enclosingRing();
      this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
    }
    return this._isExteriorRing;
  }
  enclosingRing() {
    if (this._enclosingRing === void 0) {
      this._enclosingRing = this._calcEnclosingRing();
    }
    return this._enclosingRing;
  }
  /* Returns the ring that encloses this one, if any */
  _calcEnclosingRing() {
    let leftMostEvt = this.events[0];
    for (let i = 1, iMax = this.events.length; i < iMax; i++) {
      const evt = this.events[i];
      if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
    }
    let prevSeg = leftMostEvt.segment.prevInResult();
    let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
    while (true) {
      if (!prevSeg) return null;
      if (!prevPrevSeg) return prevSeg.ringOut;
      if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
        if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
          return prevSeg.ringOut;
        } else return prevSeg.ringOut.enclosingRing();
      }
      prevSeg = prevPrevSeg.prevInResult();
      prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
    }
  }
};
var PolyOut = class {
  constructor(exteriorRing) {
    this.exteriorRing = exteriorRing;
    exteriorRing.poly = this;
    this.interiorRings = [];
  }
  addInterior(ring) {
    this.interiorRings.push(ring);
    ring.poly = this;
  }
  getGeom() {
    const geom = [this.exteriorRing.getGeom()];
    if (geom[0] === null) return null;
    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
      const ringGeom = this.interiorRings[i].getGeom();
      if (ringGeom === null) continue;
      geom.push(ringGeom);
    }
    return geom;
  }
};
var MultiPolyOut = class {
  constructor(rings) {
    this.rings = rings;
    this.polys = this._composePolys(rings);
  }
  getGeom() {
    const geom = [];
    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
      const polyGeom = this.polys[i].getGeom();
      if (polyGeom === null) continue;
      geom.push(polyGeom);
    }
    return geom;
  }
  _composePolys(rings) {
    const polys = [];
    for (let i = 0, iMax = rings.length; i < iMax; i++) {
      const ring = rings[i];
      if (ring.poly) continue;
      if (ring.isExteriorRing()) polys.push(new PolyOut(ring));
      else {
        const enclosingRing = ring.enclosingRing();
        if (!enclosingRing.poly) polys.push(new PolyOut(enclosingRing));
        enclosingRing.poly.addInterior(ring);
      }
    }
    return polys;
  }
};
var SweepLine = class {
  constructor(queue) {
    let comparator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Segment.compare;
    this.queue = queue;
    this.tree = new z(comparator);
    this.segments = [];
  }
  process(event) {
    const segment = event.segment;
    const newEvents = [];
    if (event.consumedBy) {
      if (event.isLeft) this.queue.remove(event.otherSE);
      else this.tree.remove(segment);
      return newEvents;
    }
    const node = event.isLeft ? this.tree.add(segment) : this.tree.find(segment);
    if (!node) throw new Error(`Unable to find segment #${segment.id} [${segment.leftSE.point.x}, ${segment.leftSE.point.y}] -> [${segment.rightSE.point.x}, ${segment.rightSE.point.y}] in SweepLine tree.`);
    let prevNode = node;
    let nextNode = node;
    let prevSeg = void 0;
    let nextSeg = void 0;
    while (prevSeg === void 0) {
      prevNode = this.tree.prev(prevNode);
      if (prevNode === null) prevSeg = null;
      else if (prevNode.key.consumedBy === void 0) prevSeg = prevNode.key;
    }
    while (nextSeg === void 0) {
      nextNode = this.tree.next(nextNode);
      if (nextNode === null) nextSeg = null;
      else if (nextNode.key.consumedBy === void 0) nextSeg = nextNode.key;
    }
    if (event.isLeft) {
      let prevMySplitter = null;
      if (prevSeg) {
        const prevInter = prevSeg.getIntersection(segment);
        if (prevInter !== null) {
          if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
          if (!prevSeg.isAnEndpoint(prevInter)) {
            const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      let nextMySplitter = null;
      if (nextSeg) {
        const nextInter = nextSeg.getIntersection(segment);
        if (nextInter !== null) {
          if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
          if (!nextSeg.isAnEndpoint(nextInter)) {
            const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      if (prevMySplitter !== null || nextMySplitter !== null) {
        let mySplitter = null;
        if (prevMySplitter === null) mySplitter = nextMySplitter;
        else if (nextMySplitter === null) mySplitter = prevMySplitter;
        else {
          const cmpSplitters = SweepEvent.comparePoints(prevMySplitter, nextMySplitter);
          mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
        }
        this.queue.remove(segment.rightSE);
        newEvents.push(segment.rightSE);
        const newEventsFromSplit = segment.split(mySplitter);
        for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
          newEvents.push(newEventsFromSplit[i]);
        }
      }
      if (newEvents.length > 0) {
        this.tree.remove(segment);
        newEvents.push(event);
      } else {
        this.segments.push(segment);
        segment.prev = prevSeg;
      }
    } else {
      if (prevSeg && nextSeg) {
        const inter = prevSeg.getIntersection(nextSeg);
        if (inter !== null) {
          if (!prevSeg.isAnEndpoint(inter)) {
            const newEventsFromSplit = this._splitSafely(prevSeg, inter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
          if (!nextSeg.isAnEndpoint(inter)) {
            const newEventsFromSplit = this._splitSafely(nextSeg, inter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      this.tree.remove(segment);
    }
    return newEvents;
  }
  /* Safely split a segment that is currently in the datastructures
   * IE - a segment other than the one that is currently being processed. */
  _splitSafely(seg, pt) {
    this.tree.remove(seg);
    const rightSE = seg.rightSE;
    this.queue.remove(rightSE);
    const newEvents = seg.split(pt);
    newEvents.push(rightSE);
    if (seg.consumedBy === void 0) this.tree.add(seg);
    return newEvents;
  }
};
var POLYGON_CLIPPING_MAX_QUEUE_SIZE = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_QUEUE_SIZE || 1e6;
var POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS || 1e6;
var Operation = class {
  run(type, geom, moreGeoms) {
    operation.type = type;
    rounder.reset();
    const multipolys = [new MultiPolyIn(geom, true)];
    for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
      multipolys.push(new MultiPolyIn(moreGeoms[i], false));
    }
    operation.numMultiPolys = multipolys.length;
    if (operation.type === "difference") {
      const subject = multipolys[0];
      let i = 1;
      while (i < multipolys.length) {
        if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;
        else multipolys.splice(i, 1);
      }
    }
    if (operation.type === "intersection") {
      for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
        const mpA = multipolys[i];
        for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
          if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
        }
      }
    }
    const queue = new z(SweepEvent.compare);
    for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
      const sweepEvents = multipolys[i].getSweepEvents();
      for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
        queue.insert(sweepEvents[j]);
        if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
          throw new Error("Infinite loop when putting segment endpoints in a priority queue (queue size too big).");
        }
      }
    }
    const sweepLine = new SweepLine(queue);
    let prevQueueSize = queue.size;
    let node = queue.pop();
    while (node) {
      const evt = node.key;
      if (queue.size === prevQueueSize) {
        const seg = evt.segment;
        throw new Error(`Unable to pop() ${evt.isLeft ? "left" : "right"} SweepEvent [${evt.point.x}, ${evt.point.y}] from segment #${seg.id} [${seg.leftSE.point.x}, ${seg.leftSE.point.y}] -> [${seg.rightSE.point.x}, ${seg.rightSE.point.y}] from queue.`);
      }
      if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
        throw new Error("Infinite loop when passing sweep line over endpoints (queue size too big).");
      }
      if (sweepLine.segments.length > POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS) {
        throw new Error("Infinite loop when passing sweep line over endpoints (too many sweep line segments).");
      }
      const newEvents = sweepLine.process(evt);
      for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
        const evt2 = newEvents[i];
        if (evt2.consumedBy === void 0) queue.insert(evt2);
      }
      prevQueueSize = queue.size;
      node = queue.pop();
    }
    rounder.reset();
    const ringsOut = RingOut.factory(sweepLine.segments);
    const result = new MultiPolyOut(ringsOut);
    return result.getGeom();
  }
};
var operation = new Operation();

// src/lib/dates.ts
function today(d2 = /* @__PURE__ */ new Date()) {
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d2.getFullYear()}-${p2(d2.getMonth() + 1)}-${p2(d2.getDate())}`;
}

// src/lib/assistant/core.ts
var JOB = { type: "string", description: `The job: its id, or its name as the person says it ("Hadley Road"). Leave out for the job they're looking at.` };
var PIN_KINDS = ["task", "issue", "note", "material"];
var ITEM_KINDS = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];
var SIDE = { type: "string", enum: ["north", "south", "east", "west"] };
var PART = { type: "object", properties: {
  shape: { type: "string", enum: ["box", "cylinder", "sphere"] },
  x: { type: "number", description: "Centre, mm right of the object's middle as seen from its front" },
  z: { type: "number", description: "Centre, mm toward its front from its middle" },
  y: { type: "number", description: "Bottom of this part, mm above the object's bottom" },
  w: { type: "number", description: "Width, mm (left to right)" },
  d: { type: "number", description: "Depth, mm (front to back)" },
  h: { type: "number", description: "Height, mm" },
  color: { type: "string", description: "#rrggbb, its real colour" }
}, required: ["shape", "x", "y", "z", "w", "d", "h"] };
var TOOLS = [
  { name: "list_jobs", description: "List the jobs this person can see: id, name, address, status, open pins and current stage.", input_schema: { type: "object", properties: {} } },
  { name: "job_overview", description: "One job at a glance: stages, floors and rooms (with ids), open pins (number, kind, title, status, due date, who is tagged, where).", input_schema: { type: "object", properties: { job: JOB } } },
  { name: "find_in_plan", description: `Find rooms, walls, doors, windows and objects in a job's plan by name, kind, room or id ("kitchen sink", "master bedroom", "G-F46"). Returns ids to use with other tools.`, input_schema: { type: "object", properties: { job: JOB, query: { type: "string" } }, required: ["query"] } },
  {
    name: "add_pin",
    description: "Add a pin (task, issue, note or material) to a job, on a room or object when given its id. Due date defaults to today. Tag people by name.",
    input_schema: { type: "object", properties: {
      job: JOB,
      kind: { type: "string", enum: PIN_KINDS },
      title: { type: "string" },
      details: { type: "string" },
      element_id: { type: "string", description: "Room, wall, door, window or object id from find_in_plan or job_overview" },
      due_date: { type: "string", description: "YYYY-MM-DD" },
      tag: { type: "array", items: { type: "string" }, description: "Team members' names" },
      high_priority: { type: "boolean" },
      photo_request: { type: "boolean", description: 'Asking the tagged person for a photo of this spot ("get Marco to send a photo of the sink"): a task they close with a photo, sent from their link' }
    }, required: ["kind", "title"] }
  },
  {
    name: "update_pin",
    description: "Change a pin by its number: status (open, in_progress, done), title, details, due date, or who is tagged.",
    input_schema: { type: "object", properties: {
      job: JOB,
      pin_number: { type: "integer" },
      status: { type: "string", enum: ["open", "in_progress", "done"] },
      title: { type: "string" },
      details: { type: "string" },
      due_date: { type: "string", description: "YYYY-MM-DD" },
      tag: { type: "array", items: { type: "string" }, description: "Replaces who is tagged" }
    }, required: ["pin_number"] }
  },
  { name: "set_stage", description: "Set a job stage's status by its name: not_started, active or done.", input_schema: { type: "object", properties: { job: JOB, stage: { type: "string" }, status: { type: "string", enum: ["not_started", "active", "done"] } }, required: ["stage", "status"] } },
  { name: "set_build_status", description: "Mark a room, wall, door, window or object's build status: not_built, in_progress, done, existing or demolish (or clear).", input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string" }, status: { type: "string", enum: ["not_built", "in_progress", "done", "existing", "demolish", "clear"] } }, required: ["element_id", "status"] } },
  {
    name: "add_wall_item",
    description: "Put an outlet, switch, light, plumbing point or other wall item on a wall of a room, at a height in mm (typical heights used when left out).",
    input_schema: { type: "object", properties: {
      job: JOB,
      room: { type: "string", description: "Room id or name" },
      wall: { type: "string", description: 'Which wall, e.g. "north wall" or "east wall B"' },
      kind: { type: "string", enum: ITEM_KINDS },
      height_mm: { type: "number" },
      from_left_mm: { type: "number", description: "From the wall's left end seen from inside the room; middle when left out" },
      label: { type: "string" }
    }, required: ["room", "wall", "kind"] }
  },
  {
    name: "whats_around",
    description: 'What is next to an object or door/window: the things on its left and right (as seen standing in front of it, facing it, the way someone uses it), in front of it and behind it, with distances. Use it for "the cabinet right of the stove" or "the outlet left of the sink". Returns ids.',
    input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string", description: "The reference object's id, from find_in_plan" } }, required: ["element_id"] }
  },
  { name: "room_layout", description: "A room's layout for changing what's in it: its inside edges (x grows east, y grows south, in mm), its walls with the doors and windows on them, and every object in it with id, centre, size and the way it faces. Call it before adding or moving things.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id or name" } }, required: ["room"] } },
  {
    name: "add_objects",
    description: 'Add furniture, appliances, electronics or fixtures to a room. Each goes in at its real size, height and weight (the catalogue\'s usual values unless you give them), at the right height: things that sit on something (a computer, monitor, microwave, table lamp, TV) go on top of it, on the desk or counter you name with `on` or the nearest suitable one in the room; wall things (mirror, picture, wall cabinet, shelf) hang at their usual height against the nearest wall. When you leave out `facing` it faces the natural way: chairs to their desk or table, stools to the counter, sofas to the TV, beds, cabinets and desks with their backs to the wall. Pieces are kept inside the room. Something not in the kind list: kind "other", its real name, and `parts`.',
    input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id (best) or name" }, objects: { type: "array", maxItems: 30, items: { type: "object", properties: {
      kind: { type: "string", enum: OBJECT_KINDS },
      name: { type: "string", description: 'What it is, e.g. "Queen bed", "Desktop computer", "Espresso machine"' },
      x: { type: "number", description: "Centre, plan mm. Can be left out for things put on something or next to their partner (a chair at its desk)" },
      y: { type: "number" },
      width_mm: { type: "number", description: "Across its front; leave out for the usual size" },
      depth_mm: { type: "number", description: "Front to back" },
      height_mm: { type: "number" },
      weight_kg: { type: "number" },
      facing: { ...SIDE, description: "The way its front faces (the foot of a bed, the seat of a chair, a screen's face). Leave out for the natural way." },
      face_toward: { type: "string", description: "Id of something it should face (a chair facing desk G-F41)" },
      on: { type: "string", description: 'Id of what it sits on (the desk, counter or sideboard), from room_layout or earlier in this call ("new:0" is the first object of this call)' },
      height_above_floor_mm: { type: "number", description: "Its bottom above the floor, for something hung at an unusual height" },
      parts: { type: "array", maxItems: 40, items: PART, description: "For kind other: the object built from simple shapes at real sizes, as it really looks (a rowing machine: rail, seat, flywheel, footrests). Its overall width, depth and height must contain the parts." }
    }, required: ["kind"] } } }, required: ["room", "objects"] }
  },
  {
    name: "change_object",
    description: "Move, turn, resize, rename or re-seat one object. Move by mm east/south (negative for west/north), or to a new centre; turn it to face a side or another object; put it on something (`on`), or set its height above the floor.",
    input_schema: { type: "object", properties: {
      job: JOB,
      element_id: { type: "string" },
      move_east_mm: { type: "number" },
      move_south_mm: { type: "number" },
      to_x: { type: "number" },
      to_y: { type: "number" },
      facing: SIDE,
      face_toward: { type: "string", description: "Id of what it should face" },
      on: { type: "string", description: "Id of what it should sit on" },
      height_above_floor_mm: { type: "number" },
      width_mm: { type: "number" },
      depth_mm: { type: "number" },
      height_mm: { type: "number" },
      weight_kg: { type: "number" },
      name: { type: "string" }
    }, required: ["element_id"] }
  },
  {
    name: "point_at",
    description: `Put a blinking coloured dot on the plan (2D and 3D) on each place you're talking about, so the person sees which is which. Use it whenever you name places they must tell apart or find: before asking "the bedroom with the blue dot or the green one?", and to show where something is. With one place it also opens that room or object in the side panel. Returns each place's dot colour; say the colours in your reply.`,
    input_schema: { type: "object", properties: { job: JOB, places: { type: "array", minItems: 1, maxItems: 6, items: { type: "object", properties: {
      id: { type: "string", description: "Room, object, door, window or wall id" },
      label: { type: "string", description: 'What you call it, e.g. "south bedroom"' }
    }, required: ["id"] } }, open: { type: "string", description: "Id to open in the side panel (defaults to the place when there is just one)" } }, required: ["places"] }
  },
  { name: "remove_objects", description: "Take objects out of the plan by id (furniture, appliances, fixtures). Ones from the drawing can be brought back with Reset.", input_schema: { type: "object", properties: { job: JOB, element_ids: { type: "array", items: { type: "string" } } }, required: ["element_ids"] } },
  { name: "rename_room", description: "Rename a room or change its type.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"] } }, required: ["room"] } },
  { name: "team", description: "The team: names, titles and roles (and contact details for admins).", input_schema: { type: "object", properties: {} } }
];
function instructions(me, ctx) {
  return [
    `You are the Rorker assistant inside Rorker, a job app for contractors, working for ${me.name ?? "the signed-in person"} at ${me.company} (role: ${me.role === "admin" ? "owner/admin" : "employee"}).`,
    "You act as them: you can look up their jobs and make changes with the tools, on their permissions. Do what they ask without asking for confirmation, unless the request is unclear; then ask one short question.",
    'Look things up with the tools rather than guessing. Use ids you got from a tool. When you change something, say in one short sentence what you did ("Added task #7 on the kitchen sink, due today, tagged Marco.").',
    "Keep replies short and plain: they are often read aloud to someone on a job site. No tables, no headings, no long lists; at most a few short sentences.",
    "Never give out information beyond what the tools return for this person. Don't reveal anything about other companies, and don't repeat personal contact details unless this person is an admin and asked for them.",
    "Never say which AI model or company powers you; you are the Rorker assistant.",
    `Where things are: left and right of an object always mean as seen standing in front of it, facing it (the way you'd use a stove, a sink or a cabinet), not as seen on the plan. "The cabinet right of the stove" is the one at your right hand when you face the stove. Use whats_around to find it. Above and below mean height on the wall. North, south, east and west follow the plan (north is up). If two things still fit, ask one short question naming them by where they are.`,
    "Changing the plan: you can add, move, turn, resize and remove furniture, appliances and fixtures, and rename rooms (room_layout first, then add_objects, change_object, remove_objects, rename_room). Walls, rooms' shapes, doors and windows can't be changed here yet: say so in one sentence and offer to add a task pin for it.",
    "Real things, real sizes: every object has a real width, depth, height, weight and mounting height, and drawings never show furniture heights, so add_objects fills in the usual ones for each kind. Pick the kind that is the actual thing (a computer is kind computer, never a box or other). A computer, monitor, laptop, printer, table lamp, microwave, coffee machine or TV sits on a desk, counter or sideboard, never on the floor: put it `on` that piece (add the desk first if the room has none, or ask). Chairs go at their desk or table facing it, bar stools at the counter or island facing it, sofas and armchairs face the TV, fireplace or coffee table, beds, cabinets, wardrobes and desks stand with their backs to a wall facing into the room, wall cabinets, mirrors, pictures and shelves hang on a wall at their usual height. Leave facing out and it is worked out that way; give it only when the person asks for something else.",
    "Something not in the kind list (a rowing machine, a pool table, a kayak rack): don't settle for a box. Work out from what you know (or look it up with web search when you can) what it really looks like, its real size and weight, then add it as kind other with its name and parts: simple boxes, cylinders and spheres at real sizes and colours that together look like the real thing. Only when you truly can't tell what it is, ask what it looks like.",
    `Sizes: always talk in feet and inches (13' 6", a 36" door) and square feet, never metres or millimetres. The tools work in millimetres: 1 inch is 25.4 mm and 1 foot is 304.8 mm, so turn what they say into mm for the tools and turn what the tools return into feet and inches (round to the nearest half inch) when you answer.`,
    "Placing: the usual US layouts (width x depth): twin bed 38x75 in (965x1905 mm), full 54x75 in (1372x1905), queen 60x80 in (1524x2032), king 76x80 in (1930x2032), with a nightstand each side of a full or bigger; dining table 72x36 in (1830x915) for 6 or 48x30 in (1220x760) for 4 with a chair at each place; desk 48x24 in (1220x610) with an office chair; sofa facing the TV on a sideboard. Place things the way a designer would: keep about 36 in (915 mm) of walking space and never block a door or doorway. Only add what fits; leave other things as they are unless asked.",
    `Showing places: whenever you mention a room or spot the person has to pick between or find ("which bedroom?"), call point_at first so a coloured dot blinks on each one, then name them by where they are and by colour ("the bedroom on the south side, blue dot, or the east one, green dot?"). Rooms often share a name, so tell them apart by their side of the floor (find_in_plan says where each one is). After adding or moving something it is pointed at for you. Dots blink for 10 seconds and then go, so every time you refer to a place again (later in the chat too), call point_at again so it blinks again. Dots show in 2D and 3D on any floor, but the map doesn't move to them: when they're on a floor or view the person isn't looking at, the app adds a line saying where and a button to go there, so don't say you took them there.`,
    // keep these two last: they change per request, and everything above them is cached
    `Today is ${today()}.`,
    ctx.jobId ? `They are looking at the job "${ctx.jobName ?? ctx.jobId}" (id ${ctx.jobId})${ctx.where ? `, at ${ctx.where}` : ""}${ctx.selected ? `, with ${ctx.selected} selected` : ""}. "This job", "here" and "this" refer to that.` : "They are on the jobs list."
  ].join("\n");
}
export {
  TOOLS,
  instructions
};
/*! Bundled license information:

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
