import { v as van } from './van-t8DywzvC.js';
import { d as database } from './db-Dnh5_0qJ.js';
import { e as eventBus } from './eventbus-DzIYHcTJ.js';
import './index.esm-BwZC295S.js';
import require$$0$1 from 'util';
import require$$0 from 'async_hooks';

var analytics = {};

var cloudFunctions = {};

var logger$2 = {};

var trace = {};

Object.defineProperty(trace, "__esModule", { value: true });
trace.extractTraceContext = trace.traceContext = void 0;
const async_hooks_1 = require$$0;
trace.traceContext = new async_hooks_1.AsyncLocalStorage();
/**
 * A regex to match the Cloud Trace header.
 *   - ([A-Fa-f0-9]{32}): The trace id, a 32 character hex value. (e.g. 4bf92f3577b34da6a3ce929d0e0e4736)
 *   - ([0-9]+): The parent span id, a 64 bit integer. (e.g. 00f067aa0ba902b7)
 *   - (?:;o=([0-3])): The trace mask, 1-3 denote it should be traced.
 */
const CLOUD_TRACE_REGEX = new RegExp("^(?<traceId>[A-Fa-f0-9]{32})/" + "(?<parentIdInt>[0-9]+)" + "(?:;o=(?<traceMask>[0-3]))?$");
const CLOUD_TRACE_HEADER = "X-Cloud-Trace-Context";
function matchCloudTraceHeader(carrier) {
    let header = carrier === null || carrier === void 0 ? void 0 : carrier[CLOUD_TRACE_HEADER];
    if (!header) {
        // try lowercase header
        header = carrier === null || carrier === void 0 ? void 0 : carrier[CLOUD_TRACE_HEADER.toLowerCase()];
    }
    if (header && typeof header === "string") {
        const matches = CLOUD_TRACE_REGEX.exec(header);
        if (matches && matches.groups) {
            const { traceId, parentIdInt, traceMask } = matches.groups;
            // Convert parentId from unsigned int to hex
            const parentId = parseInt(parentIdInt);
            if (isNaN(parentId)) {
                // Ignore traces with invalid parentIds
                return;
            }
            const sample = !!traceMask && traceMask !== "0";
            return { traceId, parentId: parentId.toString(16), sample, version: "00" };
        }
    }
}
/**
 * A regex to match the traceparent header.
 *   - ^([a-f0-9]{2}): The specification version (e.g. 00)
 *   - ([a-f0-9]{32}): The trace id, a 16-byte array. (e.g. 4bf92f3577b34da6a3ce929d0e0e4736)
 *   - ([a-f0-9]{16}): The parent span id, an 8-byte array. (e.g. 00f067aa0ba902b7)
 *   - ([a-f0-9]{2}: The sampled flag. (e.g. 00)
 */
const TRACEPARENT_REGEX = new RegExp("^(?<version>[a-f0-9]{2})-" +
    "(?<traceId>[a-f0-9]{32})-" +
    "(?<parentId>[a-f0-9]{16})-" +
    "(?<flag>[a-f0-9]{2})$");
const TRACEPARENT_HEADER = "traceparent";
function matchTraceparentHeader(carrier) {
    const header = carrier === null || carrier === void 0 ? void 0 : carrier[TRACEPARENT_HEADER];
    if (header && typeof header === "string") {
        const matches = TRACEPARENT_REGEX.exec(header);
        if (matches && matches.groups) {
            const { version, traceId, parentId, flag } = matches.groups;
            const sample = flag === "01";
            return { traceId, parentId, sample, version };
        }
    }
}
/**
 * Extracts trace context from given carrier object, if any.
 *
 * Supports Cloud Trace and traceparent format.
 *
 * @param carrier
 */
function extractTraceContext(carrier) {
    return matchCloudTraceHeader(carrier) || matchTraceparentHeader(carrier);
}
trace.extractTraceContext = extractTraceContext;

var common = {};

// The MIT License (MIT)
//
// Copyright (c) 2017 Firebase
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
Object.defineProperty(common, "__esModule", { value: true });
common.UNPATCHED_CONSOLE = common.CONSOLE_SEVERITY = void 0;
// Map LogSeverity types to their equivalent `console.*` method.
/** @hidden */
common.CONSOLE_SEVERITY = {
    DEBUG: "debug",
    INFO: "info",
    NOTICE: "info",
    WARNING: "warn",
    ERROR: "error",
    CRITICAL: "error",
    ALERT: "error",
    EMERGENCY: "error",
};
// safely preserve unpatched console.* methods in case of compat require
/** @hidden */
common.UNPATCHED_CONSOLE = {
    debug: console.debug,
    info: console.info,
    log: console.log,
    warn: console.warn,
    error: console.error,
};

// The MIT License (MIT)
//
// Copyright (c) 2017 Firebase
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
Object.defineProperty(logger$2, "__esModule", { value: true });
logger$2.error = logger$2.warn = logger$2.info = logger$2.log = logger$2.debug = logger$2.write = void 0;
const util_1 = require$$0$1;
const trace_1 = trace;
const common_1 = common;
/** @internal */
function removeCircular(obj, refs = []) {
    if (typeof obj !== "object" || !obj) {
        return obj;
    }
    // If the object defines its own toJSON, prefer that.
    if (obj.toJSON) {
        return obj.toJSON();
    }
    if (refs.includes(obj)) {
        return "[Circular]";
    }
    else {
        refs.push(obj);
    }
    let returnObj;
    if (Array.isArray(obj)) {
        returnObj = new Array(obj.length);
    }
    else {
        returnObj = {};
    }
    for (const k in obj) {
        if (refs.includes(obj[k])) {
            returnObj[k] = "[Circular]";
        }
        else {
            returnObj[k] = removeCircular(obj[k], refs);
        }
    }
    refs.pop();
    return returnObj;
}
/**
 * Writes a `LogEntry` to `stdout`/`stderr` (depending on severity).
 * @param entry - The `LogEntry` including severity, message, and any additional structured metadata.
 * @public
 */
function write(entry) {
    const ctx = trace_1.traceContext.getStore();
    if (ctx === null || ctx === void 0 ? void 0 : ctx.traceId) {
        entry["logging.googleapis.com/trace"] = `projects/${process.env.GCLOUD_PROJECT}/traces/${ctx.traceId}`;
    }
    common_1.UNPATCHED_CONSOLE[common_1.CONSOLE_SEVERITY[entry.severity]](JSON.stringify(removeCircular(entry)));
}
logger$2.write = write;
/**
 * Writes a `DEBUG` severity log. If the last argument provided is a plain object,
 * it is added to the `jsonPayload` in the Cloud Logging entry.
 * @param args - Arguments, concatenated into the log message with space separators.
 * @public
 */
function debug(...args) {
    write(entryFromArgs("DEBUG", args));
}
logger$2.debug = debug;
/**
 * Writes an `INFO` severity log. If the last argument provided is a plain object,
 * it is added to the `jsonPayload` in the Cloud Logging entry.
 * @param args - Arguments, concatenated into the log message with space separators.
 * @public
 */
function log(...args) {
    write(entryFromArgs("INFO", args));
}
logger$2.log = log;
/**
 * Writes an `INFO` severity log. If the last argument provided is a plain object,
 * it is added to the `jsonPayload` in the Cloud Logging entry.
 * @param args - Arguments, concatenated into the log message with space separators.
 * @public
 */
function info(...args) {
    write(entryFromArgs("INFO", args));
}
logger$2.info = info;
/**
 * Writes a `WARNING` severity log. If the last argument provided is a plain object,
 * it is added to the `jsonPayload` in the Cloud Logging entry.
 * @param args - Arguments, concatenated into the log message with space separators.
 * @public
 */
function warn(...args) {
    write(entryFromArgs("WARNING", args));
}
logger$2.warn = warn;
/**
 * Writes an `ERROR` severity log. If the last argument provided is a plain object,
 * it is added to the `jsonPayload` in the Cloud Logging entry.
 * @param args - Arguments, concatenated into the log message with space separators.
 * @public
 */
function error(...args) {
    write(entryFromArgs("ERROR", args));
}
logger$2.error = error;
/** @hidden */
function entryFromArgs(severity, args) {
    let entry = {};
    const lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === "object" && lastArg.constructor === Object) {
        entry = args.pop();
    }
    // mimic `console.*` behavior, see https://nodejs.org/api/console.html#console_console_log_data_args
    let message = (0, util_1.format)(...args);
    if (severity === "ERROR" && !args.find((arg) => arg instanceof Error)) {
        message = new Error(message).stack || message;
    }
    const out = {
        ...entry,
        severity,
    };
    if (message) {
        out.message = message;
    }
    return out;
}

var functionConfiguration = {};

var options = {};

Object.defineProperty(options, "__esModule", { value: true });
options.RESET_VALUE = options.ResetValue = void 0;
// The MIT License (MIT)
//
// Copyright (c) 2022 Firebase
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
/**
 * Special configuration type to reset configuration to platform default.
 *
 * @alpha
 */
class ResetValue {
    toJSON() {
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() { }
    static getInstance() {
        return new ResetValue();
    }
}
options.ResetValue = ResetValue;
/**
 * Special configuration value to reset configuration to platform default.
 */
options.RESET_VALUE = ResetValue.getInstance();

(function (exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MAX_NUMBER_USER_LABELS = exports.DEFAULT_FAILURE_POLICY = exports.INGRESS_SETTINGS_OPTIONS = exports.VPC_EGRESS_SETTINGS_OPTIONS = exports.VALID_MEMORY_OPTIONS = exports.MAX_TIMEOUT_SECONDS = exports.MIN_TIMEOUT_SECONDS = exports.SUPPORTED_REGIONS = exports.RESET_VALUE = void 0;
	var options_1 = options;
	Object.defineProperty(exports, "RESET_VALUE", { enumerable: true, get: function () { return options_1.RESET_VALUE; } });
	/**
	 * List of all regions supported by Cloud Functions.
	 */
	exports.SUPPORTED_REGIONS = [
	    "us-central1",
	    "us-east1",
	    "us-east4",
	    "us-west2",
	    "us-west3",
	    "us-west4",
	    "europe-central2",
	    "europe-west1",
	    "europe-west2",
	    "europe-west3",
	    "europe-west6",
	    "asia-east1",
	    "asia-east2",
	    "asia-northeast1",
	    "asia-northeast2",
	    "asia-northeast3",
	    "asia-south1",
	    "asia-southeast1",
	    "asia-southeast2",
	    "northamerica-northeast1",
	    "southamerica-east1",
	    "australia-southeast1",
	];
	/**
	 * Cloud Functions min timeout value.
	 */
	exports.MIN_TIMEOUT_SECONDS = 0;
	/**
	 * Cloud Functions max timeout value.
	 */
	exports.MAX_TIMEOUT_SECONDS = 540;
	/**
	 * List of available memory options supported by Cloud Functions.
	 */
	exports.VALID_MEMORY_OPTIONS = [
	    "128MB",
	    "256MB",
	    "512MB",
	    "1GB",
	    "2GB",
	    "4GB",
	    "8GB",
	];
	/**
	 * List of available options for VpcConnectorEgressSettings.
	 */
	exports.VPC_EGRESS_SETTINGS_OPTIONS = [
	    "VPC_CONNECTOR_EGRESS_SETTINGS_UNSPECIFIED",
	    "PRIVATE_RANGES_ONLY",
	    "ALL_TRAFFIC",
	];
	/**
	 * List of available options for IngressSettings.
	 */
	exports.INGRESS_SETTINGS_OPTIONS = [
	    "INGRESS_SETTINGS_UNSPECIFIED",
	    "ALLOW_ALL",
	    "ALLOW_INTERNAL_ONLY",
	    "ALLOW_INTERNAL_AND_GCLB",
	];
	exports.DEFAULT_FAILURE_POLICY = {
	    retry: {},
	};
	exports.MAX_NUMBER_USER_LABELS = 58; 
} (functionConfiguration));

var encoding = {};

var params = {};

var types = {};

// The MIT License (MIT)
//
// Copyright (c) 2021 Firebase
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
Object.defineProperty(types, "__esModule", { value: true });
types.ListParam = types.BooleanParam = types.FloatParam = types.IntParam = types.InternalExpression = types.StringParam = types.SecretParam = types.Param = types.BUCKET_PICKER = types.multiSelect = types.select = types.CompareExpression = types.TernaryExpression = types.Expression = void 0;
const logger$1 = logger$2;
/*
 * A CEL expression which can be evaluated during function deployment, and
 * resolved to a value of the generic type parameter: i.e, you can pass
 * an Expression<number> as the value of an option that normally accepts numbers.
 */
class Expression {
    /** Returns the expression's runtime value, based on the CLI's resolution of parameters. */
    value() {
        if (process.env.FUNCTIONS_CONTROL_API === "true") {
            logger$1.warn(`${this.toString()}.value() invoked during function deployment, instead of during runtime.`);
            logger$1.warn(`This is usually a mistake. In configs, use Params directly without calling .value().`);
            logger$1.warn(`example: { memory: memoryParam } not { memory: memoryParam.value() }`);
        }
        return this.runtimeValue();
    }
    /** @internal */
    runtimeValue() {
        throw new Error("Not implemented");
    }
    /** Returns the expression's representation as a braced CEL expression. */
    toCEL() {
        return `{{ ${this.toString()} }}`;
    }
    /** Returns the expression's representation as JSON. */
    toJSON() {
        return this.toString();
    }
}
types.Expression = Expression;
function valueOf(arg) {
    return arg instanceof Expression ? arg.runtimeValue() : arg;
}
/**
 * Returns how an entity (either an `Expression` or a literal value) should be represented in CEL.
 * - Expressions delegate to the `.toString()` method, which is used by the WireManifest
 * - Strings have to be quoted explicitly
 * - Arrays are represented as []-delimited, parsable JSON
 * - Numbers and booleans are not quoted explicitly
 */
function refOf(arg) {
    if (arg instanceof Expression) {
        return arg.toString();
    }
    else if (typeof arg === "string") {
        return `"${arg}"`;
    }
    else if (Array.isArray(arg)) {
        return JSON.stringify(arg);
    }
    else {
        return arg.toString();
    }
}
/**
 * A CEL expression corresponding to a ternary operator, e.g {{ cond ? ifTrue : ifFalse }}
 */
class TernaryExpression extends Expression {
    constructor(test, ifTrue, ifFalse) {
        super();
        this.test = test;
        this.ifTrue = ifTrue;
        this.ifFalse = ifFalse;
        this.ifTrue = ifTrue;
        this.ifFalse = ifFalse;
    }
    /** @internal */
    runtimeValue() {
        return this.test.runtimeValue() ? valueOf(this.ifTrue) : valueOf(this.ifFalse);
    }
    toString() {
        return `${this.test} ? ${refOf(this.ifTrue)} : ${refOf(this.ifFalse)}`;
    }
}
types.TernaryExpression = TernaryExpression;
/**
 * A CEL expression that evaluates to boolean true or false based on a comparison
 * between the value of another expression and a literal of that same type.
 */
class CompareExpression extends Expression {
    constructor(cmp, lhs, rhs) {
        super();
        this.cmp = cmp;
        this.lhs = lhs;
        this.rhs = rhs;
    }
    /** @internal */
    runtimeValue() {
        const left = this.lhs.runtimeValue();
        const right = valueOf(this.rhs);
        switch (this.cmp) {
            case "==":
                return Array.isArray(left) ? this.arrayEquals(left, right) : left === right;
            case "!=":
                return Array.isArray(left) ? !this.arrayEquals(left, right) : left !== right;
            case ">":
                return left > right;
            case ">=":
                return left >= right;
            case "<":
                return left < right;
            case "<=":
                return left <= right;
            default:
                throw new Error(`Unknown comparator ${this.cmp}`);
        }
    }
    /** @internal */
    arrayEquals(a, b) {
        return a.every((item) => b.includes(item)) && b.every((item) => a.includes(item));
    }
    toString() {
        const rhsStr = refOf(this.rhs);
        return `${this.lhs} ${this.cmp} ${rhsStr}`;
    }
    /** Returns a `TernaryExpression` which can resolve to one of two values, based on the resolution of this comparison. */
    thenElse(ifTrue, ifFalse) {
        return new TernaryExpression(this, ifTrue, ifFalse);
    }
}
types.CompareExpression = CompareExpression;
/** Create a select input from a series of values or a map of labels to values */
function select(options) {
    let wireOpts;
    if (Array.isArray(options)) {
        wireOpts = options.map((opt) => ({ value: opt }));
    }
    else {
        wireOpts = Object.entries(options).map(([label, value]) => ({ label, value }));
    }
    return {
        select: {
            options: wireOpts,
        },
    };
}
types.select = select;
/** Create a multi-select input from a series of values or map of labels to values. */
function multiSelect(options) {
    let wireOpts;
    if (Array.isArray(options)) {
        wireOpts = options.map((opt) => ({ value: opt }));
    }
    else {
        wireOpts = Object.entries(options).map(([label, value]) => ({ label, value }));
    }
    return {
        multiSelect: {
            options: wireOpts,
        },
    };
}
types.multiSelect = multiSelect;
/**
 * Autogenerate a list of buckets in a project that a user can select from.
 */
types.BUCKET_PICKER = {
    resource: {
        type: "storage.googleapis.com/Bucket",
    },
};
/**
 * Represents a parametrized value that will be read from .env files if present,
 * or prompted for by the CLI if missing. Instantiate these with the defineX
 * methods exported by the firebase-functions/params namespace.
 */
class Param extends Expression {
    constructor(name, options = {}) {
        super();
        this.name = name;
        this.options = options;
    }
    /** @internal */
    runtimeValue() {
        throw new Error("Not implemented");
    }
    /** Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression. */
    cmp(cmp, rhs) {
        return new CompareExpression(cmp, this, rhs);
    }
    /** Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression. */
    equals(rhs) {
        return this.cmp("==", rhs);
    }
    /** Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression. */
    notEquals(rhs) {
        return this.cmp("!=", rhs);
    }
    /** Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression. */
    greaterThan(rhs) {
        return this.cmp(">", rhs);
    }
    /** Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression. */
    greaterThanOrEqualTo(rhs) {
        return this.cmp(">=", rhs);
    }
    /** Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression. */
    lessThan(rhs) {
        return this.cmp("<", rhs);
    }
    /** Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression. */
    lessThanOrEqualTo(rhs) {
        return this.cmp("<=", rhs);
    }
    /**
     * Returns a parametrized expression of Boolean type, based on comparing the value of this parameter to a literal or a different expression.
     * @deprecated A typo. Use lessThanOrEqualTo instead.
     */
    lessThanorEqualTo(rhs) {
        return this.lessThanOrEqualTo(rhs);
    }
    toString() {
        return `params.${this.name}`;
    }
    /** @internal */
    toSpec() {
        const { default: paramDefault, ...otherOptions } = this.options;
        const out = {
            name: this.name,
            ...otherOptions,
            type: this.constructor.type,
        };
        if (paramDefault instanceof Expression) {
            out.default = paramDefault.toCEL();
        }
        else if (paramDefault !== undefined) {
            out.default = paramDefault;
        }
        if (out.input && "text" in out.input && out.input.text.validationRegex instanceof RegExp) {
            out.input.text.validationRegex = out.input.text.validationRegex.source;
        }
        return out;
    }
}
types.Param = Param;
Param.type = "string";
/**
 * A parametrized string whose value is stored in Cloud Secret Manager
 * instead of the local filesystem. Supply instances of SecretParams to
 * the secrets array while defining a Function to make their values accessible
 * during execution of that Function.
 */
class SecretParam {
    constructor(name) {
        this.name = name;
    }
    /** @internal */
    runtimeValue() {
        const val = process.env[this.name];
        if (val === undefined) {
            logger$1.warn(`No value found for secret parameter "${this.name}". A function can only access a secret if you include the secret in the function's dependency array.`);
        }
        return val || "";
    }
    /** @internal */
    toSpec() {
        return {
            type: "secret",
            name: this.name,
        };
    }
    /** Returns the secret's value at runtime. Throws an error if accessed during deployment. */
    value() {
        if (process.env.FUNCTIONS_CONTROL_API === "true") {
            throw new Error(`Cannot access the value of secret "${this.name}" during function deployment. Secret values are only available at runtime.`);
        }
        return this.runtimeValue();
    }
}
types.SecretParam = SecretParam;
SecretParam.type = "secret";
/**
 *  A parametrized value of String type that will be read from .env files
 *  if present, or prompted for by the CLI if missing.
 */
class StringParam extends Param {
    /** @internal */
    runtimeValue() {
        return process.env[this.name] || "";
    }
}
types.StringParam = StringParam;
/**
 * A CEL expression which represents an internal Firebase variable. This class
 * cannot be instantiated by developers, but we provide several canned instances
 * of it to make available parameters that will never have to be defined at
 * deployment time, and can always be read from process.env.
 * @internal
 */
class InternalExpression extends Param {
    constructor(name, getter) {
        super(name);
        this.getter = getter;
    }
    /** @internal */
    runtimeValue() {
        return this.getter(process.env) || "";
    }
    toSpec() {
        throw new Error("An InternalExpression should never be marshalled for wire transmission.");
    }
}
types.InternalExpression = InternalExpression;
/**
 *  A parametrized value of Integer type that will be read from .env files
 *  if present, or prompted for by the CLI if missing.
 */
class IntParam extends Param {
    /** @internal */
    runtimeValue() {
        return parseInt(process.env[this.name] || "0", 10) || 0;
    }
}
types.IntParam = IntParam;
IntParam.type = "int";
/**
 *  A parametrized value of Float type that will be read from .env files
 *  if present, or prompted for by the CLI if missing.
 */
class FloatParam extends Param {
    /** @internal */
    runtimeValue() {
        return parseFloat(process.env[this.name] || "0") || 0;
    }
}
types.FloatParam = FloatParam;
FloatParam.type = "float";
/**
 *  A parametrized value of Boolean type that will be read from .env files
 *  if present, or prompted for by the CLI if missing.
 */
class BooleanParam extends Param {
    /** @internal */
    runtimeValue() {
        return !!process.env[this.name] && process.env[this.name] === "true";
    }
    /** @deprecated */
    then(ifTrue, ifFalse) {
        return this.thenElse(ifTrue, ifFalse);
    }
    thenElse(ifTrue, ifFalse) {
        return new TernaryExpression(this, ifTrue, ifFalse);
    }
}
types.BooleanParam = BooleanParam;
BooleanParam.type = "boolean";
/**
 *  A parametrized value of String[] type that will be read from .env files
 *  if present, or prompted for by the CLI if missing.
 */
class ListParam extends Param {
    /** @internal */
    runtimeValue() {
        const val = JSON.parse(process.env[this.name]);
        if (!Array.isArray(val) || !val.every((v) => typeof v === "string")) {
            return [];
        }
        return val;
    }
    /** @hidden */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    greaterThan(rhs) {
        throw new Error(">/< comparison operators not supported on params of type List");
    }
    /** @hidden */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    greaterThanOrEqualTo(rhs) {
        throw new Error(">/< comparison operators not supported on params of type List");
    }
    /** @hidden */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    lessThan(rhs) {
        throw new Error(">/< comparison operators not supported on params of type List");
    }
    /** @hidden */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    lessThanorEqualTo(rhs) {
        throw new Error(">/< comparison operators not supported on params of type List");
    }
}
types.ListParam = ListParam;
ListParam.type = "list";

(function (exports) {
	// The MIT License (MIT)
	//
	// Copyright (c) 2021 Firebase
	//
	// Permission is hereby granted, free of charge, to any person obtaining a copy
	// of this software and associated documentation files (the "Software"), to deal
	// in the Software without restriction, including without limitation the rights
	// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	// copies of the Software, and to permit persons to whom the Software is
	// furnished to do so, subject to the following conditions:
	//
	// The above copyright notice and this permission notice shall be included in all
	// copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	// SOFTWARE.
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.defineList = exports.defineFloat = exports.defineInt = exports.defineBoolean = exports.defineString = exports.defineSecret = exports.storageBucket = exports.gcloudProject = exports.projectID = exports.databaseURL = exports.clearParams = exports.declaredParams = exports.Expression = exports.multiSelect = exports.select = exports.BUCKET_PICKER = void 0;
	/**
	 * @hidden
	 * @alpha
	 */
	const types_1 = types;
	Object.defineProperty(exports, "Expression", { enumerable: true, get: function () { return types_1.Expression; } });
	var types_2 = types;
	Object.defineProperty(exports, "BUCKET_PICKER", { enumerable: true, get: function () { return types_2.BUCKET_PICKER; } });
	Object.defineProperty(exports, "select", { enumerable: true, get: function () { return types_2.select; } });
	Object.defineProperty(exports, "multiSelect", { enumerable: true, get: function () { return types_2.multiSelect; } });
	exports.declaredParams = [];
	/**
	 * Use a helper to manage the list such that parameters are uniquely
	 * registered once only but order is preserved.
	 * @internal
	 */
	function registerParam(param) {
	    for (let i = 0; i < exports.declaredParams.length; i++) {
	        if (exports.declaredParams[i].name === param.name) {
	            exports.declaredParams.splice(i, 1);
	        }
	    }
	    exports.declaredParams.push(param);
	}
	/**
	 * For testing.
	 * @internal
	 */
	function clearParams() {
	    exports.declaredParams.splice(0, exports.declaredParams.length);
	}
	exports.clearParams = clearParams;
	/**
	 * A built-in parameter that resolves to the default RTDB database URL associated
	 * with the project, without prompting the deployer. Empty string if none exists.
	 */
	exports.databaseURL = new types_1.InternalExpression("DATABASE_URL", (env) => { var _a; return ((_a = JSON.parse(env.FIREBASE_CONFIG)) === null || _a === void 0 ? void 0 : _a.databaseURL) || ""; });
	/**
	 * A built-in parameter that resolves to the Cloud project ID associated with
	 * the project, without prompting the deployer.
	 */
	exports.projectID = new types_1.InternalExpression("PROJECT_ID", (env) => { var _a; return ((_a = JSON.parse(env.FIREBASE_CONFIG)) === null || _a === void 0 ? void 0 : _a.projectId) || ""; });
	/**
	 * A built-in parameter that resolves to the Cloud project ID, without prompting
	 * the deployer.
	 */
	exports.gcloudProject = new types_1.InternalExpression("GCLOUD_PROJECT", (env) => { var _a; return ((_a = JSON.parse(env.FIREBASE_CONFIG)) === null || _a === void 0 ? void 0 : _a.projectId) || ""; });
	/**
	 * A builtin parameter that resolves to the Cloud storage bucket associated
	 * with the function, without prompting the deployer. Empty string if not
	 * defined.
	 */
	exports.storageBucket = new types_1.InternalExpression("STORAGE_BUCKET", (env) => { var _a; return ((_a = JSON.parse(env.FIREBASE_CONFIG)) === null || _a === void 0 ? void 0 : _a.storageBucket) || ""; });
	/**
	 * Declares a secret param, that will persist values only in Cloud Secret Manager.
	 * Secrets are stored internally as bytestrings. Use `ParamOptions.as` to provide type
	 * hinting during parameter resolution.
	 *
	 * @param name The name of the environment variable to use to load the parameter.
	 * @returns A parameter with a `string` return type for `.value`.
	 */
	function defineSecret(name) {
	    const param = new types_1.SecretParam(name);
	    registerParam(param);
	    return param;
	}
	exports.defineSecret = defineSecret;
	/**
	 * Declare a string parameter.
	 *
	 * @param name The name of the environment variable to use to load the parameter.
	 * @param options Configuration options for the parameter.
	 * @returns A parameter with a `string` return type for `.value`.
	 */
	function defineString(name, options = {}) {
	    const param = new types_1.StringParam(name, options);
	    registerParam(param);
	    return param;
	}
	exports.defineString = defineString;
	/**
	 * Declare a boolean parameter.
	 *
	 * @param name The name of the environment variable to use to load the parameter.
	 * @param options Configuration options for the parameter.
	 * @returns A parameter with a `boolean` return type for `.value`.
	 */
	function defineBoolean(name, options = {}) {
	    const param = new types_1.BooleanParam(name, options);
	    registerParam(param);
	    return param;
	}
	exports.defineBoolean = defineBoolean;
	/**
	 * Declare an integer parameter.
	 *
	 * @param name The name of the environment variable to use to load the parameter.
	 * @param options Configuration options for the parameter.
	 * @returns A parameter with a `number` return type for `.value`.
	 */
	function defineInt(name, options = {}) {
	    const param = new types_1.IntParam(name, options);
	    registerParam(param);
	    return param;
	}
	exports.defineInt = defineInt;
	/**
	 * Declare a float parameter.
	 *
	 * @param name The name of the environment variable to use to load the parameter.
	 * @param options Configuration options for the parameter.
	 * @returns A parameter with a `number` return type for `.value`.
	 *
	 * @internal
	 */
	function defineFloat(name, options = {}) {
	    const param = new types_1.FloatParam(name, options);
	    registerParam(param);
	    return param;
	}
	exports.defineFloat = defineFloat;
	/**
	 * Declare a list parameter.
	 *
	 * @param name The name of the environment variable to use to load the parameter.
	 * @param options Configuration options for the parameter.
	 * @returns A parameter with a `string[]` return type for `.value`.
	 */
	function defineList(name, options = {}) {
	    const param = new types_1.ListParam(name, options);
	    registerParam(param);
	    return param;
	}
	exports.defineList = defineList; 
} (params));

// The MIT License (MIT)
//
// Copyright (c) 2021 Firebase
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
Object.defineProperty(encoding, "__esModule", { value: true });
encoding.convertInvoker = encoding.serviceAccountFromShorthand = encoding.convertIfPresent = encoding.copyIfPresent = encoding.durationFromSeconds = void 0;
const params_1$1 = params;
/** Get a google.protobuf.Duration for a number of seconds. */
function durationFromSeconds(s) {
    return `${s}s`;
}
encoding.durationFromSeconds = durationFromSeconds;
/**
 * Utility function to help copy fields from type A to B.
 * As a safety net, catches typos or fields that aren't named the same
 * in A and B, but cannot verify that both Src and Dest have the same type for the same field.
 */
function copyIfPresent(dest, src, ...fields) {
    if (!src) {
        return;
    }
    for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(src, field)) {
            continue;
        }
        dest[field] = src[field];
    }
}
encoding.copyIfPresent = copyIfPresent;
function convertIfPresent(dest, src, destField, srcField, converter = (from) => {
    return from;
}) {
    if (!src) {
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(src, srcField)) {
        return;
    }
    dest[destField] = converter(src[srcField]);
}
encoding.convertIfPresent = convertIfPresent;
function serviceAccountFromShorthand(serviceAccount) {
    if (serviceAccount === "default") {
        return null;
    }
    else if (serviceAccount instanceof params_1$1.Expression) {
        return serviceAccount;
    }
    else if (serviceAccount.endsWith("@")) {
        if (!process.env.GCLOUD_PROJECT) {
            throw new Error(`Unable to determine email for service account '${serviceAccount}' because process.env.GCLOUD_PROJECT is not set.`);
        }
        return `${serviceAccount}${process.env.GCLOUD_PROJECT}.iam.gserviceaccount.com`;
    }
    else if (serviceAccount.includes("@")) {
        return serviceAccount;
    }
    else {
        throw new Error(`Invalid option for serviceAccount: '${serviceAccount}'. Valid options are 'default', a service account email, or '{serviceAccountName}@'`);
    }
}
encoding.serviceAccountFromShorthand = serviceAccountFromShorthand;
function convertInvoker(invoker) {
    if (typeof invoker === "string") {
        invoker = [invoker];
    }
    if (invoker.length === 0) {
        throw new Error("Invalid option for invoker: Must be a non-empty array.");
    }
    if (invoker.find((inv) => inv.length === 0)) {
        throw new Error("Invalid option for invoker: Must be a non-empty string.");
    }
    if (invoker.length > 1 && invoker.find((inv) => inv === "public" || inv === "private")) {
        throw new Error("Invalid option for invoker: Cannot have 'public' or 'private' in an array of service accounts.");
    }
    return invoker;
}
encoding.convertInvoker = convertInvoker;

var manifest = {};

// The MIT License (MIT)
//
// Copyright (c) 2021 Firebase
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
Object.defineProperty(manifest, "__esModule", { value: true });
manifest.initV2ScheduleTrigger = manifest.initV1ScheduleTrigger = manifest.initTaskQueueTrigger = manifest.initV2Endpoint = manifest.initV1Endpoint = manifest.stackToWire = void 0;
const options_1 = options;
const params_1 = params;
/**
 * Returns the JSON representation of a ManifestStack, which has CEL
 * expressions in its options as object types, with its expressions
 * transformed into the actual CEL strings.
 *
 * @alpha
 */
function stackToWire(stack) {
    const wireStack = stack;
    const traverse = function traverse(obj) {
        for (const [key, val] of Object.entries(obj)) {
            if (val instanceof params_1.Expression) {
                obj[key] = val.toCEL();
            }
            else if (val instanceof options_1.ResetValue) {
                obj[key] = val.toJSON();
            }
            else if (typeof val === "object" && val !== null) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                traverse(val);
            }
        }
    };
    traverse(wireStack.endpoints);
    return wireStack;
}
manifest.stackToWire = stackToWire;
const RESETTABLE_OPTIONS = {
    availableMemoryMb: null,
    timeoutSeconds: null,
    minInstances: null,
    maxInstances: null,
    ingressSettings: null,
    concurrency: null,
    serviceAccountEmail: null,
    vpc: null,
};
function initEndpoint(resetOptions, ...opts) {
    const endpoint = {};
    if (opts.every((opt) => !(opt === null || opt === void 0 ? void 0 : opt.preserveExternalChanges))) {
        for (const key of Object.keys(resetOptions)) {
            endpoint[key] = options_1.RESET_VALUE;
        }
    }
    return endpoint;
}
/**
 * @internal
 */
function initV1Endpoint(...opts) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { concurrency, ...resetOpts } = RESETTABLE_OPTIONS;
    return initEndpoint({ ...resetOpts }, ...opts);
}
manifest.initV1Endpoint = initV1Endpoint;
/**
 * @internal
 */
function initV2Endpoint(...opts) {
    return initEndpoint(RESETTABLE_OPTIONS, ...opts);
}
manifest.initV2Endpoint = initV2Endpoint;
const RESETTABLE_RETRY_CONFIG_OPTIONS = {
    maxAttempts: null,
    maxDoublings: null,
    maxBackoffSeconds: null,
    maxRetrySeconds: null,
    minBackoffSeconds: null,
};
const RESETTABLE_RATE_LIMITS_OPTIONS = {
    maxConcurrentDispatches: null,
    maxDispatchesPerSecond: null,
};
/**
 * @internal
 */
function initTaskQueueTrigger(...opts) {
    const taskQueueTrigger = {
        retryConfig: {},
        rateLimits: {},
    };
    if (opts.every((opt) => !(opt === null || opt === void 0 ? void 0 : opt.preserveExternalChanges))) {
        for (const key of Object.keys(RESETTABLE_RETRY_CONFIG_OPTIONS)) {
            taskQueueTrigger.retryConfig[key] = options_1.RESET_VALUE;
        }
        for (const key of Object.keys(RESETTABLE_RATE_LIMITS_OPTIONS)) {
            taskQueueTrigger.rateLimits[key] = options_1.RESET_VALUE;
        }
    }
    return taskQueueTrigger;
}
manifest.initTaskQueueTrigger = initTaskQueueTrigger;
const RESETTABLE_V1_SCHEDULE_OPTIONS = {
    retryCount: null,
    maxDoublings: null,
    maxRetryDuration: null,
    maxBackoffDuration: null,
    minBackoffDuration: null,
};
const RESETTABLE_V2_SCHEDULE_OPTIONS = {
    retryCount: null,
    maxDoublings: null,
    maxRetrySeconds: null,
    minBackoffSeconds: null,
    maxBackoffSeconds: null,
};
function initScheduleTrigger(resetOptions, schedule, ...opts) {
    let scheduleTrigger = {
        schedule,
        retryConfig: {},
    };
    if (opts.every((opt) => !(opt === null || opt === void 0 ? void 0 : opt.preserveExternalChanges))) {
        for (const key of Object.keys(resetOptions)) {
            scheduleTrigger.retryConfig[key] = options_1.RESET_VALUE;
        }
        scheduleTrigger = { ...scheduleTrigger, timeZone: options_1.RESET_VALUE };
    }
    return scheduleTrigger;
}
/**
 * @internal
 */
function initV1ScheduleTrigger(schedule, ...opts) {
    return initScheduleTrigger(RESETTABLE_V1_SCHEDULE_OPTIONS, schedule, ...opts);
}
manifest.initV1ScheduleTrigger = initV1ScheduleTrigger;
/**
 * @internal
 */
function initV2ScheduleTrigger(schedule, ...opts) {
    return initScheduleTrigger(RESETTABLE_V2_SCHEDULE_OPTIONS, schedule, ...opts);
}
manifest.initV2ScheduleTrigger = initV2ScheduleTrigger;

var onInit$1 = {};

Object.defineProperty(onInit$1, "__esModule", { value: true });
onInit$1.withInit = onInit$1.onInit = void 0;
const logger = logger$2;
let initCallback = null;
let didInit = false;
/**
 * Registers a callback that should be run when in a production environment
 * before executing any functions code.
 * Calling this function more than once leads to undefined behavior.
 * @param callback initialization callback to be run before any function executes.
 */
function onInit(callback) {
    if (initCallback) {
        logger.warn("Setting onInit callback more than once. Only the most recent callback will be called");
    }
    initCallback = callback;
    didInit = false;
}
onInit$1.onInit = onInit;
/** @internal */
function withInit(func) {
    return async (...args) => {
        if (!didInit) {
            if (initCallback) {
                await initCallback();
            }
            didInit = true;
        }
        // Note: This cast is actually inaccurate because it may be a promise, but
        // it doesn't actually matter because the async function will promisify
        // non-promises and forward promises.
        return func(...args);
    };
}
onInit$1.withInit = withInit;

var change = {};

// The MIT License (MIT)
//
// Copyright (c) 2022 Firebase
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
Object.defineProperty(change, "__esModule", { value: true });
change.Change = change.applyFieldMask = void 0;
/** @internal */
function applyFieldMask(sparseBefore, after, fieldMask) {
    const before = { ...after };
    const masks = fieldMask.split(",");
    for (const mask of masks) {
        const parts = mask.split(".");
        const head = parts[0];
        const tail = parts.slice(1).join(".");
        if (parts.length > 1) {
            before[head] = applyFieldMask(sparseBefore === null || sparseBefore === void 0 ? void 0 : sparseBefore[head], after[head], tail);
            continue;
        }
        const val = sparseBefore === null || sparseBefore === void 0 ? void 0 : sparseBefore[head];
        if (typeof val === "undefined") {
            delete before[mask];
        }
        else {
            before[mask] = val;
        }
    }
    return before;
}
change.applyFieldMask = applyFieldMask;
/**
 * The Cloud Functions interface for events that change state, such as
 * Realtime Database or Cloud Firestore `onWrite` and `onUpdate` events.
 *
 * For more information about the format used to construct `Change` objects, see
 * {@link ChangeJson} below.
 *
 */
class Change {
    /**
     * Factory method for creating a `Change` from a `before` object and an `after`
     * object.
     */
    static fromObjects(before, after) {
        return new Change(before, after);
    }
    /**
     * Factory method for creating a `Change` from JSON and an optional customizer
     * function to be applied to both the `before` and the `after` fields.
     */
    static fromJSON(json, customizer = (x) => x) {
        let before = { ...json.before };
        if (json.fieldMask) {
            before = applyFieldMask(before, json.after, json.fieldMask);
        }
        return Change.fromObjects(customizer(before || {}), customizer(json.after || {}));
    }
    constructor(before, after) {
        this.before = before;
        this.after = after;
    }
}
change.Change = Change;

(function (exports) {
	// The MIT License (MIT)
	//
	// Copyright (c) 2017 Firebase
	//
	// Permission is hereby granted, free of charge, to any person obtaining a copy
	// of this software and associated documentation files (the "Software"), to deal
	// in the Software without restriction, including without limitation the rights
	// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	// copies of the Software, and to permit persons to whom the Software is
	// furnished to do so, subject to the following conditions:
	//
	// The above copyright notice and this permission notice shall be included in all
	// copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	// SOFTWARE.
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.optionsToEndpoint = exports.optionsToTrigger = exports.makeCloudFunction = exports.Change = void 0;
	const logger_1 = logger$2;
	const function_configuration_1 = functionConfiguration;
	const encoding_1 = encoding;
	const manifest_1 = manifest;
	const options_1 = options;
	const types_1 = types;
	const onInit_1 = onInit$1;
	var change_1 = change;
	Object.defineProperty(exports, "Change", { enumerable: true, get: function () { return change_1.Change; } });
	/** @internal */
	const WILDCARD_REGEX = new RegExp("{[^/{}]*}", "g");
	/** @internal */
	function makeCloudFunction({ contextOnlyHandler, dataConstructor = (raw) => raw.data, eventType, handler, labels = {}, legacyEventType, options = {}, provider, service, triggerResource, }) {
	    handler = (0, onInit_1.withInit)(handler !== null && handler !== void 0 ? handler : contextOnlyHandler);
	    const cloudFunction = (data, context) => {
	        if (legacyEventType && context.eventType === legacyEventType) {
	            /*
	             * v1beta1 event flow has different format for context, transform them to
	             * new format.
	             */
	            context.eventType = provider + "." + eventType;
	            context.resource = {
	                service,
	                name: context.resource,
	            };
	        }
	        const event = {
	            data,
	            context,
	        };
	        if (provider === "google.firebase.database") {
	            context.authType = _detectAuthType(event);
	            if (context.authType !== "ADMIN") {
	                context.auth = _makeAuth(event, context.authType);
	            }
	            else {
	                delete context.auth;
	            }
	        }
	        if (triggerResource() == null) {
	            Object.defineProperty(context, "params", {
	                get: () => {
	                    throw new Error("context.params is not available when using the handler namespace.");
	                },
	            });
	        }
	        else {
	            context.params = context.params || _makeParams(context, triggerResource);
	        }
	        let promise;
	        if (labels && labels["deployment-scheduled"]) {
	            // Scheduled function do not have meaningful data, so exclude it
	            promise = contextOnlyHandler(context);
	        }
	        else {
	            const dataOrChange = dataConstructor(event);
	            promise = handler(dataOrChange, context);
	        }
	        if (typeof promise === "undefined") {
	            (0, logger_1.warn)("Function returned undefined, expected Promise or value");
	        }
	        return Promise.resolve(promise);
	    };
	    Object.defineProperty(cloudFunction, "__trigger", {
	        get: () => {
	            if (triggerResource() == null) {
	                return {};
	            }
	            const trigger = {
	                ...optionsToTrigger(options),
	                eventTrigger: {
	                    resource: triggerResource(),
	                    eventType: legacyEventType || provider + "." + eventType,
	                    service,
	                },
	            };
	            if (!!labels && Object.keys(labels).length) {
	                trigger.labels = { ...trigger.labels, ...labels };
	            }
	            return trigger;
	        },
	    });
	    Object.defineProperty(cloudFunction, "__endpoint", {
	        get: () => {
	            if (triggerResource() == null) {
	                return undefined;
	            }
	            const endpoint = {
	                platform: "gcfv1",
	                ...(0, manifest_1.initV1Endpoint)(options),
	                ...optionsToEndpoint(options),
	            };
	            if (options.schedule) {
	                endpoint.scheduleTrigger = (0, manifest_1.initV1ScheduleTrigger)(options.schedule.schedule, options);
	                (0, encoding_1.copyIfPresent)(endpoint.scheduleTrigger, options.schedule, "timeZone");
	                (0, encoding_1.copyIfPresent)(endpoint.scheduleTrigger.retryConfig, options.schedule.retryConfig, "retryCount", "maxDoublings", "maxBackoffDuration", "maxRetryDuration", "minBackoffDuration");
	            }
	            else {
	                endpoint.eventTrigger = {
	                    eventType: legacyEventType || provider + "." + eventType,
	                    eventFilters: {
	                        resource: triggerResource(),
	                    },
	                    retry: !!options.failurePolicy,
	                };
	            }
	            // Note: We intentionally don't make use of labels args here.
	            // labels is used to pass SDK-defined labels to the trigger, which isn't
	            // something we will do in the container contract world.
	            endpoint.labels = { ...endpoint.labels };
	            return endpoint;
	        },
	    });
	    if (options.schedule) {
	        cloudFunction.__requiredAPIs = [
	            {
	                api: "cloudscheduler.googleapis.com",
	                reason: "Needed for scheduled functions.",
	            },
	        ];
	    }
	    cloudFunction.run = handler || contextOnlyHandler;
	    return cloudFunction;
	}
	exports.makeCloudFunction = makeCloudFunction;
	function _makeParams(context, triggerResourceGetter) {
	    var _a, _b, _c;
	    if (context.params) {
	        // In unit testing, user may directly provide `context.params`.
	        return context.params;
	    }
	    if (!context.resource) {
	        // In unit testing, `resource` may be unpopulated for a test event.
	        return {};
	    }
	    const triggerResource = triggerResourceGetter();
	    const wildcards = triggerResource.match(WILDCARD_REGEX);
	    const params = {};
	    // Note: some tests don't set context.resource.name
	    const eventResourceParts = (_c = (_b = (_a = context === null || context === void 0 ? void 0 : context.resource) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.split) === null || _c === void 0 ? void 0 : _c.call(_b, "/");
	    if (wildcards && eventResourceParts) {
	        const triggerResourceParts = triggerResource.split("/");
	        for (const wildcard of wildcards) {
	            const wildcardNoBraces = wildcard.slice(1, -1);
	            const position = triggerResourceParts.indexOf(wildcard);
	            params[wildcardNoBraces] = eventResourceParts[position];
	        }
	    }
	    return params;
	}
	function _makeAuth(event, authType) {
	    var _a, _b, _c, _d, _e, _f;
	    if (authType === "UNAUTHENTICATED") {
	        return null;
	    }
	    return {
	        uid: (_c = (_b = (_a = event.context) === null || _a === void 0 ? void 0 : _a.auth) === null || _b === void 0 ? void 0 : _b.variable) === null || _c === void 0 ? void 0 : _c.uid,
	        token: (_f = (_e = (_d = event.context) === null || _d === void 0 ? void 0 : _d.auth) === null || _e === void 0 ? void 0 : _e.variable) === null || _f === void 0 ? void 0 : _f.token,
	    };
	}
	function _detectAuthType(event) {
	    var _a, _b, _c, _d;
	    if ((_b = (_a = event.context) === null || _a === void 0 ? void 0 : _a.auth) === null || _b === void 0 ? void 0 : _b.admin) {
	        return "ADMIN";
	    }
	    if ((_d = (_c = event.context) === null || _c === void 0 ? void 0 : _c.auth) === null || _d === void 0 ? void 0 : _d.variable) {
	        return "USER";
	    }
	    return "UNAUTHENTICATED";
	}
	/** @hidden */
	function optionsToTrigger(options) {
	    const trigger = {};
	    (0, encoding_1.copyIfPresent)(trigger, options, "regions", "schedule", "minInstances", "maxInstances", "ingressSettings", "vpcConnectorEgressSettings", "vpcConnector", "labels", "secrets");
	    (0, encoding_1.convertIfPresent)(trigger, options, "failurePolicy", "failurePolicy", (policy) => {
	        if (policy === false) {
	            return undefined;
	        }
	        else if (policy === true) {
	            return function_configuration_1.DEFAULT_FAILURE_POLICY;
	        }
	        else {
	            return policy;
	        }
	    });
	    (0, encoding_1.convertIfPresent)(trigger, options, "timeout", "timeoutSeconds", encoding_1.durationFromSeconds);
	    (0, encoding_1.convertIfPresent)(trigger, options, "availableMemoryMb", "memory", (mem) => {
	        const memoryLookup = {
	            "128MB": 128,
	            "256MB": 256,
	            "512MB": 512,
	            "1GB": 1024,
	            "2GB": 2048,
	            "4GB": 4096,
	            "8GB": 8192,
	        };
	        return memoryLookup[mem];
	    });
	    (0, encoding_1.convertIfPresent)(trigger, options, "serviceAccountEmail", "serviceAccount", encoding_1.serviceAccountFromShorthand);
	    return trigger;
	}
	exports.optionsToTrigger = optionsToTrigger;
	function optionsToEndpoint(options) {
	    const endpoint = {};
	    (0, encoding_1.copyIfPresent)(endpoint, options, "omit", "minInstances", "maxInstances", "ingressSettings", "labels", "timeoutSeconds");
	    (0, encoding_1.convertIfPresent)(endpoint, options, "region", "regions");
	    (0, encoding_1.convertIfPresent)(endpoint, options, "serviceAccountEmail", "serviceAccount", (sa) => sa);
	    (0, encoding_1.convertIfPresent)(endpoint, options, "secretEnvironmentVariables", "secrets", (secrets) => secrets.map((secret) => ({ key: secret instanceof types_1.SecretParam ? secret.name : secret })));
	    if ((options === null || options === void 0 ? void 0 : options.vpcConnector) !== undefined) {
	        if (options.vpcConnector === null || options.vpcConnector instanceof options_1.ResetValue) {
	            endpoint.vpc = function_configuration_1.RESET_VALUE;
	        }
	        else {
	            const vpc = { connector: options.vpcConnector };
	            (0, encoding_1.convertIfPresent)(vpc, options, "egressSettings", "vpcConnectorEgressSettings");
	            endpoint.vpc = vpc;
	        }
	    }
	    (0, encoding_1.convertIfPresent)(endpoint, options, "availableMemoryMb", "memory", (mem) => {
	        const memoryLookup = {
	            "128MB": 128,
	            "256MB": 256,
	            "512MB": 512,
	            "1GB": 1024,
	            "2GB": 2048,
	            "4GB": 4096,
	            "8GB": 8192,
	        };
	        return typeof mem === "object" ? mem : memoryLookup[mem];
	    });
	    return endpoint;
	}
	exports.optionsToEndpoint = optionsToEndpoint; 
} (cloudFunctions));

(function (exports) {
	// The MIT License (MIT)
	//
	// Copyright (c) 2017 Firebase
	//
	// Permission is hereby granted, free of charge, to any person obtaining a copy
	// of this software and associated documentation files (the 'Software'), to deal
	// in the Software without restriction, including without limitation the rights
	// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	// copies of the Software, and to permit persons to whom the Software is
	// furnished to do so, subject to the following conditions:
	//
	// The above copyright notice and this permission notice shall be included in all
	// copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	// SOFTWARE.
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ExportBundleInfo = exports.UserPropertyValue = exports.UserDimensions = exports.AnalyticsEvent = exports.AnalyticsEventBuilder = exports._eventWithOptions = exports.event = exports.service = exports.provider = void 0;
	const cloud_functions_1 = cloudFunctions;
	/** @internal */
	exports.provider = "google.analytics";
	/** @internal */
	exports.service = "app-measurement.com";
	/**
	 * Registers a function to handle analytics events.
	 *
	 * @param analyticsEventType Name of the analytics event type to which
	 *   this Cloud Function is scoped.
	 *
	 * @returns Analytics event builder interface.
	 */
	function event(analyticsEventType) {
	    return _eventWithOptions(analyticsEventType, {});
	}
	exports.event = event;
	/** @internal */
	function _eventWithOptions(analyticsEventType, options) {
	    return new AnalyticsEventBuilder(() => {
	        if (!process.env.GCLOUD_PROJECT) {
	            throw new Error("process.env.GCLOUD_PROJECT is not set.");
	        }
	        return "projects/" + process.env.GCLOUD_PROJECT + "/events/" + analyticsEventType;
	    }, options);
	}
	exports._eventWithOptions = _eventWithOptions;
	/**
	 * The Firebase Analytics event builder interface.
	 *
	 * Access via `functions.analytics.event()`.
	 */
	class AnalyticsEventBuilder {
	    /** @hidden */
	    constructor(triggerResource, options) {
	        this.triggerResource = triggerResource;
	        this.options = options;
	    }
	    /**
	     * Event handler that fires every time a Firebase Analytics event occurs.
	     *
	     * @param handler Event handler that fires every time a Firebase Analytics event
	     *   occurs.
	     *
	     * @returns A function that you can export and deploy.
	     */
	    onLog(handler) {
	        const dataConstructor = (raw) => {
	            return new AnalyticsEvent(raw.data);
	        };
	        return (0, cloud_functions_1.makeCloudFunction)({
	            handler,
	            provider: exports.provider,
	            eventType: "event.log",
	            service: exports.service,
	            legacyEventType: `providers/google.firebase.analytics/eventTypes/event.log`,
	            triggerResource: this.triggerResource,
	            dataConstructor,
	            options: this.options,
	        });
	    }
	}
	exports.AnalyticsEventBuilder = AnalyticsEventBuilder;
	/** Interface representing a Firebase Analytics event that was logged for a specific user. */
	class AnalyticsEvent {
	    /** @hidden */
	    constructor(wireFormat) {
	        this.params = {}; // In case of absent field, show empty (not absent) map.
	        if (wireFormat.eventDim && wireFormat.eventDim.length > 0) {
	            // If there's an eventDim, there'll always be exactly one.
	            const eventDim = wireFormat.eventDim[0];
	            copyField(eventDim, this, "name");
	            copyField(eventDim, this, "params", (p) => mapKeys(p, unwrapValue));
	            copyFieldTo(eventDim, this, "valueInUsd", "valueInUSD");
	            copyFieldTo(eventDim, this, "date", "reportingDate");
	            copyTimestampToString(eventDim, this, "timestampMicros", "logTime");
	            copyTimestampToString(eventDim, this, "previousTimestampMicros", "previousLogTime");
	        }
	        copyFieldTo(wireFormat, this, "userDim", "user", (dim) => new UserDimensions(dim));
	    }
	}
	exports.AnalyticsEvent = AnalyticsEvent;
	/**
	 * Interface representing the user who triggered the events.
	 */
	class UserDimensions {
	    /** @hidden */
	    constructor(wireFormat) {
	        // These are interfaces or primitives, no transformation needed.
	        copyFields(wireFormat, this, ["userId", "deviceInfo", "geoInfo", "appInfo"]);
	        // The following fields do need transformations of some sort.
	        copyTimestampToString(wireFormat, this, "firstOpenTimestampMicros", "firstOpenTime");
	        this.userProperties = {}; // With no entries in the wire format, present an empty (as opposed to absent) map.
	        copyField(wireFormat, this, "userProperties", (r) => {
	            const entries = Object.entries(r).map(([k, v]) => [k, new UserPropertyValue(v)]);
	            return Object.fromEntries(entries);
	        });
	        copyField(wireFormat, this, "bundleInfo", (r) => new ExportBundleInfo(r));
	        // BUG(36000368) Remove when no longer necessary
	        /* tslint:disable:no-string-literal */
	        if (!this.userId && this.userProperties["user_id"]) {
	            this.userId = this.userProperties["user_id"].value;
	        }
	        /* tslint:enable:no-string-literal */
	    }
	}
	exports.UserDimensions = UserDimensions;
	/** Predefined or custom properties stored on the client side. */
	class UserPropertyValue {
	    /** @hidden */
	    constructor(wireFormat) {
	        copyField(wireFormat, this, "value", unwrapValueAsString);
	        copyTimestampToString(wireFormat, this, "setTimestampUsec", "setTime");
	    }
	}
	exports.UserPropertyValue = UserPropertyValue;
	/** Interface representing the bundle these events were uploaded to. */
	class ExportBundleInfo {
	    /** @hidden */
	    constructor(wireFormat) {
	        copyField(wireFormat, this, "bundleSequenceId");
	        copyTimestampToMillis(wireFormat, this, "serverTimestampOffsetMicros", "serverTimestampOffset");
	    }
	}
	exports.ExportBundleInfo = ExportBundleInfo;
	/** @hidden */
	function copyFieldTo(from, to, fromField, toField, transform) {
	    if (typeof from[fromField] === "undefined") {
	        return;
	    }
	    if (transform) {
	        to[toField] = transform(from[fromField]);
	        return;
	    }
	    to[toField] = from[fromField];
	}
	/** @hidden */
	function copyField(from, to, field, transform = (from) => from) {
	    copyFieldTo(from, to, field, field, transform);
	}
	/** @hidden */
	function copyFields(from, to, fields) {
	    for (const field of fields) {
	        copyField(from, to, field);
	    }
	}
	function mapKeys(obj, transform) {
	    const entries = Object.entries(obj).map(([k, v]) => [k, transform(v)]);
	    return Object.fromEntries(entries);
	}
	// The incoming payload will have fields like:
	// {
	//   'myInt': {
	//     'intValue': '123'
	//   },
	//   'myDouble': {
	//     'doubleValue': 1.0
	//   },
	//   'myFloat': {
	//     'floatValue': 1.1
	//   },
	//   'myString': {
	//     'stringValue': 'hi!'
	//   }
	// }
	//
	// The following method will remove these four types of 'xValue' fields, flattening them
	// to just their values, as a string:
	// {
	//   'myInt': '123',
	//   'myDouble': '1.0',
	//   'myFloat': '1.1',
	//   'myString': 'hi!'
	// }
	//
	// Note that while 'intValue' will have a quoted payload, 'doubleValue' and 'floatValue' will not. This
	// is due to the encoding library, which renders int64 values as strings to avoid loss of precision. This
	// method always returns a string, similarly to avoid loss of precision, unlike the less-conservative
	// 'unwrapValue' method just below.
	/** @hidden */
	function unwrapValueAsString(wrapped) {
	    const key = Object.keys(wrapped)[0];
	    return wrapped[key].toString();
	}
	// Ditto as the method above, but returning the values in the idiomatic JavaScript type (string for strings,
	// number for numbers):
	// {
	//   'myInt': 123,
	//   'myDouble': 1.0,
	//   'myFloat': 1.1,
	//   'myString': 'hi!'
	// }
	//
	// The field names in the incoming xValue fields identify the type a value has, which for JavaScript's
	// purposes can be divided into 'number' versus 'string'. This method will render all the numbers as
	// JavaScript's 'number' type, since we prefer using idiomatic types. Note that this may lead to loss
	// in precision for int64 fields, so use with care.
	/** @hidden */
	const xValueNumberFields = ["intValue", "floatValue", "doubleValue"];
	/** @hidden */
	function unwrapValue(wrapped) {
	    const key = Object.keys(wrapped)[0];
	    const value = unwrapValueAsString(wrapped);
	    return xValueNumberFields.includes(key) ? Number(value) : value;
	}
	// The JSON payload delivers timestamp fields as strings of timestamps denoted in microseconds.
	// The JavaScript convention is to use numbers denoted in milliseconds. This method
	// makes it easy to convert a field of one type into the other.
	/** @hidden */
	function copyTimestampToMillis(from, to, fromName, toName) {
	    if (from[fromName] !== undefined) {
	        to[toName] = Math.round(from[fromName] / 1000);
	    }
	}
	// The JSON payload delivers timestamp fields as strings of timestamps denoted in microseconds.
	// In our SDK, we'd like to present timestamp as ISO-format strings. This method makes it easy
	// to convert a field of one type into the other.
	/** @hidden */
	function copyTimestampToString(from, to, fromName, toName) {
	    if (from[fromName] !== undefined) {
	        to[toName] = new Date(from[fromName] / 1000).toISOString();
	    }
	} 
} (analytics));

class Events {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    async getByHierarchy(hierarchy) {
        const events = await database.query("events", { hierarchy: hierarchy });

        if (events && events.length > 0) {
            this.current = events[0];
            return this.current;
        }

        this.current = null;
        return null;
    }

    async getAvailable() {
        const events = await database.query(
            "events",
            { status: "available" },
            "begin"
        );
        return events;
    }

    setStateToAvailable(state) {
        this.getAvailable().then((events) => {
            state.val = events;
        });
    }

    createOptionElement(eventData, selected) {
        const { option } = van.tags;

        const displayDate = eventData.begin.toDate().toLocaleDateString();
        const displayDescription = eventData.description.replace(
            /\(Baseball\) /,
            ""
        );
        const displayText = `${displayDate} - ${displayDescription}`;
        return option(
            {
                value: eventData.hierarchy,
                selected: eventData.hierarchy == selected,
            },
            displayText
        );
    }

    createSelectorElement(selected) {
        const { div, select } = van.tags;
        const eventListState = van.state([]);
        this.setStateToAvailable(eventListState);

        const container = div({ class: "vyevents-selector" }, () => {
            const sel = select({
                id: "report-event-select",
                class: "w-full text-black p-1",
            });

            eventListState.val.forEach((eventData) =>
                van.add(sel, this.createOptionElement(eventData, selected))
            );

            sel.addEventListener("change", (e) => {
                eventBus.dispatchEvent(
                    new CustomEvent("ui.requestEvent", {
                        detail: e.target.value,
                    })
                );
            });

            return sel;
        });

        return container;
    }

    async updateEventSummary(hierarchy, summary, cameras) {
        let event =
            this.current.hierarchy == hierarchy
                ? this.current
                : await this.getByHierarchy(hierarchy);

        if (!event) {
            console.warn(`Event not found: ${hierarchy}`);
            return;
        }

        event.cameras = cameras;
        event.seconds = summary.seconds || 0;
        event.totalScore = summary.totalScore || 0;
        event.averageScore = summary.averageScore || 0;
        event.maxScore = summary.maxScore || 0;
        event.minScore = summary.minScore || 0;
        event.totalPeople = summary.totalPeople || 0;
        event.averagePeople = summary.averagePeople || 0;
        event.maxPeople = summary.maxPeople || 0;
        event.minPeople = summary.minPeople || 0;

        await database.update("events", event.id, event);
    }
}

const events = new Events();

export { events as e };
//# sourceMappingURL=events-Cecs3qzv.js.map
