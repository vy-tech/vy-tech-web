import { H as HttpRequest, f as fromUtf8$3, b as buildQueryString, t as toHex, p as parseUrl, S as SignatureV4, i as isArrayBuffer, a as toUint8Array, n as normalizeProvider$1, c as S3_EXPRESS_AUTH_SCHEME, d as S3_EXPRESS_BACKEND, e as S3_EXPRESS_BUCKET_TYPE, g as SESSION_TOKEN_HEADER, h as getEndpointFromInstructions, j as toEndpointV1$1, k as getEndpointFromConfig, l as SignatureV4MultiRegion, r as resolveParams, m as fromHex } from './SignatureV4MultiRegion-DiJigTAW.js';
import { _ as __awaiter, d as __generator, e as __values } from './orgContext-Dajhuuvi.js';

const getHttpHandlerExtensionConfiguration = (runtimeConfig) => {
    return {
        setHttpHandler(handler) {
            runtimeConfig.httpHandler = handler;
        },
        httpHandler() {
            return runtimeConfig.httpHandler;
        },
        updateHttpClientConfig(key, value) {
            runtimeConfig.httpHandler?.updateHttpClientConfig(key, value);
        },
        httpHandlerConfigs() {
            return runtimeConfig.httpHandler.httpHandlerConfigs();
        },
    };
};
const resolveHttpHandlerRuntimeConfig = (httpHandlerExtensionConfiguration) => {
    return {
        httpHandler: httpHandlerExtensionConfiguration.httpHandler(),
    };
};

var EndpointURLScheme;
(function (EndpointURLScheme) {
    EndpointURLScheme["HTTP"] = "http";
    EndpointURLScheme["HTTPS"] = "https";
})(EndpointURLScheme || (EndpointURLScheme = {}));

var AlgorithmId;
(function (AlgorithmId) {
    AlgorithmId["MD5"] = "md5";
    AlgorithmId["CRC32"] = "crc32";
    AlgorithmId["CRC32C"] = "crc32c";
    AlgorithmId["SHA1"] = "sha1";
    AlgorithmId["SHA256"] = "sha256";
})(AlgorithmId || (AlgorithmId = {}));

const SMITHY_CONTEXT_KEY = "__smithy_context";

class HttpResponse {
    statusCode;
    reason;
    headers;
    body;
    constructor(options) {
        this.statusCode = options.statusCode;
        this.reason = options.reason;
        this.headers = options.headers || {};
        this.body = options.body;
    }
    static isInstance(response) {
        if (!response)
            return false;
        const resp = response;
        return typeof resp.statusCode === "number" && typeof resp.headers === "object";
    }
}

function addExpectContinueMiddleware(options) {
    return (next) => async (args) => {
        const { request } = args;
        if (options.expectContinueHeader !== false &&
            HttpRequest.isInstance(request) &&
            request.body &&
            options.runtime === "node" &&
            options.requestHandler?.constructor?.name !== "FetchHttpHandler") {
            let sendHeader = true;
            if (typeof options.expectContinueHeader === "number") {
                try {
                    const bodyLength = Number(request.headers?.["content-length"]) ?? options.bodyLengthChecker?.(request.body) ?? Infinity;
                    sendHeader = bodyLength >= options.expectContinueHeader;
                }
                catch (e) { }
            }
            else {
                sendHeader = !!options.expectContinueHeader;
            }
            if (sendHeader) {
                request.headers.Expect = "100-continue";
            }
        }
        return next({
            ...args,
            request,
        });
    };
}
const addExpectContinueMiddlewareOptions = {
    step: "build",
    tags: ["SET_EXPECT_HEADER", "EXPECT_HEADER"],
    name: "addExpectContinueMiddleware",
    override: true,
};
const getAddExpectContinuePlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(addExpectContinueMiddleware(options), addExpectContinueMiddlewareOptions);
    },
});

const RequestChecksumCalculation = {
    WHEN_SUPPORTED: "WHEN_SUPPORTED",
    WHEN_REQUIRED: "WHEN_REQUIRED",
};
const DEFAULT_REQUEST_CHECKSUM_CALCULATION = RequestChecksumCalculation.WHEN_SUPPORTED;
const ResponseChecksumValidation = {
    WHEN_SUPPORTED: "WHEN_SUPPORTED",
    WHEN_REQUIRED: "WHEN_REQUIRED",
};
const DEFAULT_RESPONSE_CHECKSUM_VALIDATION = RequestChecksumCalculation.WHEN_SUPPORTED;
var ChecksumAlgorithm$1;
(function (ChecksumAlgorithm) {
    ChecksumAlgorithm["MD5"] = "MD5";
    ChecksumAlgorithm["CRC32"] = "CRC32";
    ChecksumAlgorithm["CRC32C"] = "CRC32C";
    ChecksumAlgorithm["CRC64NVME"] = "CRC64NVME";
    ChecksumAlgorithm["SHA1"] = "SHA1";
    ChecksumAlgorithm["SHA256"] = "SHA256";
})(ChecksumAlgorithm$1 || (ChecksumAlgorithm$1 = {}));
var ChecksumLocation;
(function (ChecksumLocation) {
    ChecksumLocation["HEADER"] = "header";
    ChecksumLocation["TRAILER"] = "trailer";
})(ChecksumLocation || (ChecksumLocation = {}));
const DEFAULT_CHECKSUM_ALGORITHM = ChecksumAlgorithm$1.CRC32;

function setCredentialFeature(credentials, feature, value) {
    if (!credentials.$source) {
        credentials.$source = {};
    }
    credentials.$source[feature] = value;
    return credentials;
}

function setFeature$1(context, feature, value) {
    if (!context.__aws_sdk_context) {
        context.__aws_sdk_context = {
            features: {},
        };
    }
    else if (!context.__aws_sdk_context.features) {
        context.__aws_sdk_context.features = {};
    }
    context.__aws_sdk_context.features[feature] = value;
}

const getDateHeader = (response) => HttpResponse.isInstance(response) ? response.headers?.date ?? response.headers?.Date : undefined;

const getSkewCorrectedDate = (systemClockOffset) => new Date(Date.now() + systemClockOffset);

const isClockSkewed = (clockTime, systemClockOffset) => Math.abs(getSkewCorrectedDate(systemClockOffset).getTime() - clockTime) >= 300000;

const getUpdatedSystemClockOffset = (clockTime, currentSystemClockOffset) => {
    const clockTimeInMs = Date.parse(clockTime);
    if (isClockSkewed(clockTimeInMs, currentSystemClockOffset)) {
        return clockTimeInMs - Date.now();
    }
    return currentSystemClockOffset;
};

const throwSigningPropertyError = (name, property) => {
    if (!property) {
        throw new Error(`Property \`${name}\` is not resolved for AWS SDK SigV4Auth`);
    }
    return property;
};
const validateSigningProperties = async (signingProperties) => {
    const context = throwSigningPropertyError("context", signingProperties.context);
    const config = throwSigningPropertyError("config", signingProperties.config);
    const authScheme = context.endpointV2?.properties?.authSchemes?.[0];
    const signerFunction = throwSigningPropertyError("signer", config.signer);
    const signer = await signerFunction(authScheme);
    const signingRegion = signingProperties?.signingRegion;
    const signingRegionSet = signingProperties?.signingRegionSet;
    const signingName = signingProperties?.signingName;
    return {
        config,
        signer,
        signingRegion,
        signingRegionSet,
        signingName,
    };
};
class AwsSdkSigV4Signer {
    async sign(httpRequest, identity, signingProperties) {
        if (!HttpRequest.isInstance(httpRequest)) {
            throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
        }
        const validatedProps = await validateSigningProperties(signingProperties);
        const { config, signer } = validatedProps;
        let { signingRegion, signingName } = validatedProps;
        const handlerExecutionContext = signingProperties.context;
        if (handlerExecutionContext?.authSchemes?.length ?? 0 > 1) {
            const [first, second] = handlerExecutionContext.authSchemes;
            if (first?.name === "sigv4a" && second?.name === "sigv4") {
                signingRegion = second?.signingRegion ?? signingRegion;
                signingName = second?.signingName ?? signingName;
            }
        }
        const signedRequest = await signer.sign(httpRequest, {
            signingDate: getSkewCorrectedDate(config.systemClockOffset),
            signingRegion: signingRegion,
            signingService: signingName,
        });
        return signedRequest;
    }
    errorHandler(signingProperties) {
        return (error) => {
            const serverTime = error.ServerTime ?? getDateHeader(error.$response);
            if (serverTime) {
                const config = throwSigningPropertyError("config", signingProperties.config);
                const initialSystemClockOffset = config.systemClockOffset;
                config.systemClockOffset = getUpdatedSystemClockOffset(serverTime, config.systemClockOffset);
                const clockSkewCorrected = config.systemClockOffset !== initialSystemClockOffset;
                if (clockSkewCorrected && error.$metadata) {
                    error.$metadata.clockSkewCorrected = true;
                }
            }
            throw error;
        };
    }
    successHandler(httpResponse, signingProperties) {
        const dateHeader = getDateHeader(httpResponse);
        if (dateHeader) {
            const config = throwSigningPropertyError("config", signingProperties.config);
            config.systemClockOffset = getUpdatedSystemClockOffset(dateHeader, config.systemClockOffset);
        }
    }
}

class AwsSdkSigV4ASigner extends AwsSdkSigV4Signer {
    async sign(httpRequest, identity, signingProperties) {
        if (!HttpRequest.isInstance(httpRequest)) {
            throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
        }
        const { config, signer, signingRegion, signingRegionSet, signingName } = await validateSigningProperties(signingProperties);
        const configResolvedSigningRegionSet = await config.sigv4aSigningRegionSet?.();
        const multiRegionOverride = (configResolvedSigningRegionSet ??
            signingRegionSet ?? [signingRegion]).join(",");
        const signedRequest = await signer.sign(httpRequest, {
            signingDate: getSkewCorrectedDate(config.systemClockOffset),
            signingRegion: multiRegionOverride,
            signingService: signingName,
        });
        return signedRequest;
    }
}

const getSmithyContext = (context) => context[SMITHY_CONTEXT_KEY] || (context[SMITHY_CONTEXT_KEY] = {});

const resolveAuthOptions = (candidateAuthOptions, authSchemePreference) => {
    if (!authSchemePreference || authSchemePreference.length === 0) {
        return candidateAuthOptions;
    }
    const preferredAuthOptions = [];
    for (const preferredSchemeName of authSchemePreference) {
        for (const candidateAuthOption of candidateAuthOptions) {
            const candidateAuthSchemeName = candidateAuthOption.schemeId.split("#")[1];
            if (candidateAuthSchemeName === preferredSchemeName) {
                preferredAuthOptions.push(candidateAuthOption);
            }
        }
    }
    for (const candidateAuthOption of candidateAuthOptions) {
        if (!preferredAuthOptions.find(({ schemeId }) => schemeId === candidateAuthOption.schemeId)) {
            preferredAuthOptions.push(candidateAuthOption);
        }
    }
    return preferredAuthOptions;
};

function convertHttpAuthSchemesToMap(httpAuthSchemes) {
    const map = new Map();
    for (const scheme of httpAuthSchemes) {
        map.set(scheme.schemeId, scheme);
    }
    return map;
}
const httpAuthSchemeMiddleware = (config, mwOptions) => (next, context) => async (args) => {
    const options = config.httpAuthSchemeProvider(await mwOptions.httpAuthSchemeParametersProvider(config, context, args.input));
    const authSchemePreference = config.authSchemePreference ? await config.authSchemePreference() : [];
    const resolvedOptions = resolveAuthOptions(options, authSchemePreference);
    const authSchemes = convertHttpAuthSchemesToMap(config.httpAuthSchemes);
    const smithyContext = getSmithyContext(context);
    const failureReasons = [];
    for (const option of resolvedOptions) {
        const scheme = authSchemes.get(option.schemeId);
        if (!scheme) {
            failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` was not enabled for this service.`);
            continue;
        }
        const identityProvider = scheme.identityProvider(await mwOptions.identityProviderConfigProvider(config));
        if (!identityProvider) {
            failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` did not have an IdentityProvider configured.`);
            continue;
        }
        const { identityProperties = {}, signingProperties = {} } = option.propertiesExtractor?.(config, context) || {};
        option.identityProperties = Object.assign(option.identityProperties || {}, identityProperties);
        option.signingProperties = Object.assign(option.signingProperties || {}, signingProperties);
        smithyContext.selectedHttpAuthScheme = {
            httpAuthOption: option,
            identity: await identityProvider(option.identityProperties),
            signer: scheme.signer,
        };
        break;
    }
    if (!smithyContext.selectedHttpAuthScheme) {
        throw new Error(failureReasons.join("\n"));
    }
    return next(args);
};

const httpAuthSchemeEndpointRuleSetMiddlewareOptions = {
    step: "serialize",
    tags: ["HTTP_AUTH_SCHEME"],
    name: "httpAuthSchemeMiddleware",
    override: true,
    relation: "before",
    toMiddleware: "endpointV2Middleware",
};
const getHttpAuthSchemeEndpointRuleSetPlugin = (config, { httpAuthSchemeParametersProvider, identityProviderConfigProvider, }) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(httpAuthSchemeMiddleware(config, {
            httpAuthSchemeParametersProvider,
            identityProviderConfigProvider,
        }), httpAuthSchemeEndpointRuleSetMiddlewareOptions);
    },
});

const defaultErrorHandler$1 = (signingProperties) => (error) => {
    throw error;
};
const defaultSuccessHandler$1 = (httpResponse, signingProperties) => { };
const httpSigningMiddleware = (config) => (next, context) => async (args) => {
    if (!HttpRequest.isInstance(args.request)) {
        return next(args);
    }
    const smithyContext = getSmithyContext(context);
    const scheme = smithyContext.selectedHttpAuthScheme;
    if (!scheme) {
        throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
    }
    const { httpAuthOption: { signingProperties = {} }, identity, signer, } = scheme;
    const output = await next({
        ...args,
        request: await signer.sign(args.request, identity, signingProperties),
    }).catch((signer.errorHandler || defaultErrorHandler$1)(signingProperties));
    (signer.successHandler || defaultSuccessHandler$1)(output.response, signingProperties);
    return output;
};

const httpSigningMiddlewareOptions = {
    step: "finalizeRequest",
    tags: ["HTTP_SIGNING"],
    name: "httpSigningMiddleware",
    aliases: ["apiKeyMiddleware", "tokenMiddleware", "awsAuthMiddleware"],
    override: true,
    relation: "after",
    toMiddleware: "retryMiddleware",
};
const getHttpSigningPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(httpSigningMiddleware(), httpSigningMiddlewareOptions);
    },
});

const normalizeProvider = (input) => {
    if (typeof input === "function")
        return input;
    const promisified = Promise.resolve(input);
    return () => promisified;
};

const makePagedClientRequest = async (CommandCtor, client, input, withCommand = (_) => _, ...args) => {
    let command = new CommandCtor(input);
    command = withCommand(command) ?? command;
    return await client.send(command, ...args);
};
function createPaginator(ClientCtor, CommandCtor, inputTokenName, outputTokenName, pageSizeTokenName) {
    return async function* paginateOperation(config, input, ...additionalArguments) {
        const _input = input;
        let token = config.startingToken ?? _input[inputTokenName];
        let hasNext = true;
        let page;
        while (hasNext) {
            _input[inputTokenName] = token;
            if (pageSizeTokenName) {
                _input[pageSizeTokenName] = _input[pageSizeTokenName] ?? config.pageSize;
            }
            if (config.client instanceof ClientCtor) {
                page = await makePagedClientRequest(CommandCtor, config.client, input, config.withCommand, ...additionalArguments);
            }
            else {
                throw new Error(`Invalid client, expected instance of ${ClientCtor.name}`);
            }
            yield page;
            const prevToken = token;
            token = get(page, outputTokenName);
            hasNext = !!(token && (!config.stopOnSameToken || token !== prevToken));
        }
        return undefined;
    };
}
const get = (fromObject, path) => {
    let cursor = fromObject;
    const pathComponents = path.split(".");
    for (const step of pathComponents) {
        if (!cursor || typeof cursor !== "object") {
            return undefined;
        }
        cursor = cursor[step];
    }
    return cursor;
};

const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`;
const alphabetByEncoding = Object.entries(chars).reduce((acc, [i, c]) => {
    acc[c] = Number(i);
    return acc;
}, {});
const alphabetByValue = chars.split("");
const bitsPerLetter = 6;
const bitsPerByte = 8;
const maxLetterValue = 0b111111;

const fromBase64 = (input) => {
    let totalByteLength = (input.length / 4) * 3;
    if (input.slice(-2) === "==") {
        totalByteLength -= 2;
    }
    else if (input.slice(-1) === "=") {
        totalByteLength--;
    }
    const out = new ArrayBuffer(totalByteLength);
    const dataView = new DataView(out);
    for (let i = 0; i < input.length; i += 4) {
        let bits = 0;
        let bitLength = 0;
        for (let j = i, limit = i + 3; j <= limit; j++) {
            if (input[j] !== "=") {
                if (!(input[j] in alphabetByEncoding)) {
                    throw new TypeError(`Invalid character ${input[j]} in base64 string.`);
                }
                bits |= alphabetByEncoding[input[j]] << ((limit - j) * bitsPerLetter);
                bitLength += bitsPerLetter;
            }
            else {
                bits >>= bitsPerLetter;
            }
        }
        const chunkOffset = (i / 4) * 3;
        bits >>= bitLength % bitsPerByte;
        const byteLength = Math.floor(bitLength / bitsPerByte);
        for (let k = 0; k < byteLength; k++) {
            const offset = (byteLength - k - 1) * bitsPerByte;
            dataView.setUint8(chunkOffset + k, (bits & (255 << offset)) >> offset);
        }
    }
    return new Uint8Array(out);
};

const toUtf8 = (input) => {
    if (typeof input === "string") {
        return input;
    }
    if (typeof input !== "object" || typeof input.byteOffset !== "number" || typeof input.byteLength !== "number") {
        throw new Error("@smithy/util-utf8: toUtf8 encoder function only accepts string | Uint8Array.");
    }
    return new TextDecoder("utf-8").decode(input);
};

function toBase64(_input) {
    let input;
    if (typeof _input === "string") {
        input = fromUtf8$3(_input);
    }
    else {
        input = _input;
    }
    const isArrayLike = typeof input === "object" && typeof input.length === "number";
    const isUint8Array = typeof input === "object" &&
        typeof input.byteOffset === "number" &&
        typeof input.byteLength === "number";
    if (!isArrayLike && !isUint8Array) {
        throw new Error("@smithy/util-base64: toBase64 encoder function only accepts string | Uint8Array.");
    }
    let str = "";
    for (let i = 0; i < input.length; i += 3) {
        let bits = 0;
        let bitLength = 0;
        for (let j = i, limit = Math.min(i + 3, input.length); j < limit; j++) {
            bits |= input[j] << ((limit - j - 1) * bitsPerByte);
            bitLength += bitsPerByte;
        }
        const bitClusterCount = Math.ceil(bitLength / bitsPerLetter);
        bits <<= bitClusterCount * bitsPerLetter - bitLength;
        for (let k = 1; k <= bitClusterCount; k++) {
            const offset = (bitClusterCount - k) * bitsPerLetter;
            str += alphabetByValue[(bits & (maxLetterValue << offset)) >> offset];
        }
        str += "==".slice(0, 4 - bitClusterCount);
    }
    return str;
}

class Uint8ArrayBlobAdapter extends Uint8Array {
    static fromString(source, encoding = "utf-8") {
        if (typeof source === "string") {
            if (encoding === "base64") {
                return Uint8ArrayBlobAdapter.mutate(fromBase64(source));
            }
            return Uint8ArrayBlobAdapter.mutate(fromUtf8$3(source));
        }
        throw new Error(`Unsupported conversion from ${typeof source} to Uint8ArrayBlobAdapter.`);
    }
    static mutate(source) {
        Object.setPrototypeOf(source, Uint8ArrayBlobAdapter.prototype);
        return source;
    }
    transformToString(encoding = "utf-8") {
        if (encoding === "base64") {
            return toBase64(this);
        }
        return toUtf8(this);
    }
}

const ReadableStreamRef = typeof ReadableStream === "function" ? ReadableStream : function () { };
class ChecksumStream extends ReadableStreamRef {
}

const isReadableStream$1 = (stream) => typeof ReadableStream === "function" &&
    (stream?.constructor?.name === ReadableStream.name || stream instanceof ReadableStream);

const createChecksumStream = ({ expectedChecksum, checksum, source, checksumSourceLocation, base64Encoder, }) => {
    if (!isReadableStream$1(source)) {
        throw new Error(`@smithy/util-stream: unsupported source type ${source?.constructor?.name ?? source} in ChecksumStream.`);
    }
    const encoder = base64Encoder ?? toBase64;
    if (typeof TransformStream !== "function") {
        throw new Error("@smithy/util-stream: unable to instantiate ChecksumStream because API unavailable: ReadableStream/TransformStream.");
    }
    const transform = new TransformStream({
        start() { },
        async transform(chunk, controller) {
            checksum.update(chunk);
            controller.enqueue(chunk);
        },
        async flush(controller) {
            const digest = await checksum.digest();
            const received = encoder(digest);
            if (expectedChecksum !== received) {
                const error = new Error(`Checksum mismatch: expected "${expectedChecksum}" but received "${received}"` +
                    ` in response header "${checksumSourceLocation}".`);
                controller.error(error);
            }
            else {
                controller.terminate();
            }
        },
    });
    source.pipeThrough(transform);
    const readable = transform.readable;
    Object.setPrototypeOf(readable, ChecksumStream.prototype);
    return readable;
};

class ByteArrayCollector {
    allocByteArray;
    byteLength = 0;
    byteArrays = [];
    constructor(allocByteArray) {
        this.allocByteArray = allocByteArray;
    }
    push(byteArray) {
        this.byteArrays.push(byteArray);
        this.byteLength += byteArray.byteLength;
    }
    flush() {
        if (this.byteArrays.length === 1) {
            const bytes = this.byteArrays[0];
            this.reset();
            return bytes;
        }
        const aggregation = this.allocByteArray(this.byteLength);
        let cursor = 0;
        for (let i = 0; i < this.byteArrays.length; ++i) {
            const bytes = this.byteArrays[i];
            aggregation.set(bytes, cursor);
            cursor += bytes.byteLength;
        }
        this.reset();
        return aggregation;
    }
    reset() {
        this.byteArrays = [];
        this.byteLength = 0;
    }
}

function createBufferedReadableStream(upstream, size, logger) {
    const reader = upstream.getReader();
    let streamBufferingLoggedWarning = false;
    let bytesSeen = 0;
    const buffers = ["", new ByteArrayCollector((size) => new Uint8Array(size))];
    let mode = -1;
    const pull = async (controller) => {
        const { value, done } = await reader.read();
        const chunk = value;
        if (done) {
            if (mode !== -1) {
                const remainder = flush(buffers, mode);
                if (sizeOf(remainder) > 0) {
                    controller.enqueue(remainder);
                }
            }
            controller.close();
        }
        else {
            const chunkMode = modeOf(chunk, false);
            if (mode !== chunkMode) {
                if (mode >= 0) {
                    controller.enqueue(flush(buffers, mode));
                }
                mode = chunkMode;
            }
            if (mode === -1) {
                controller.enqueue(chunk);
                return;
            }
            const chunkSize = sizeOf(chunk);
            bytesSeen += chunkSize;
            const bufferSize = sizeOf(buffers[mode]);
            if (chunkSize >= size && bufferSize === 0) {
                controller.enqueue(chunk);
            }
            else {
                const newSize = merge(buffers, mode, chunk);
                if (!streamBufferingLoggedWarning && bytesSeen > size * 2) {
                    streamBufferingLoggedWarning = true;
                    logger?.warn(`@smithy/util-stream - stream chunk size ${chunkSize} is below threshold of ${size}, automatically buffering.`);
                }
                if (newSize >= size) {
                    controller.enqueue(flush(buffers, mode));
                }
                else {
                    await pull(controller);
                }
            }
        }
    };
    return new ReadableStream({
        pull,
    });
}
const createBufferedReadable = createBufferedReadableStream;
function merge(buffers, mode, chunk) {
    switch (mode) {
        case 0:
            buffers[0] += chunk;
            return sizeOf(buffers[0]);
        case 1:
        case 2:
            buffers[mode].push(chunk);
            return sizeOf(buffers[mode]);
    }
}
function flush(buffers, mode) {
    switch (mode) {
        case 0:
            const s = buffers[0];
            buffers[0] = "";
            return s;
        case 1:
        case 2:
            return buffers[mode].flush();
    }
    throw new Error(`@smithy/util-stream - invalid index ${mode} given to flush()`);
}
function sizeOf(chunk) {
    return chunk?.byteLength ?? chunk?.length ?? 0;
}
function modeOf(chunk, allowBuffer = true) {
    if (allowBuffer && typeof Buffer !== "undefined" && chunk instanceof Buffer) {
        return 2;
    }
    if (chunk instanceof Uint8Array) {
        return 1;
    }
    if (typeof chunk === "string") {
        return 0;
    }
    return -1;
}

const getAwsChunkedEncodingStream = (readableStream, options) => {
    const { base64Encoder, bodyLengthChecker, checksumAlgorithmFn, checksumLocationName, streamHasher } = options;
    const checksumRequired = base64Encoder !== undefined &&
        bodyLengthChecker !== undefined &&
        checksumAlgorithmFn !== undefined &&
        checksumLocationName !== undefined &&
        streamHasher !== undefined;
    const digest = checksumRequired ? streamHasher(checksumAlgorithmFn, readableStream) : undefined;
    const reader = readableStream.getReader();
    return new ReadableStream({
        async pull(controller) {
            const { value, done } = await reader.read();
            if (done) {
                controller.enqueue(`0\r\n`);
                if (checksumRequired) {
                    const checksum = base64Encoder(await digest);
                    controller.enqueue(`${checksumLocationName}:${checksum}\r\n`);
                    controller.enqueue(`\r\n`);
                }
                controller.close();
            }
            else {
                controller.enqueue(`${(bodyLengthChecker(value) || 0).toString(16)}\r\n${value}\r\n`);
            }
        },
    });
};

async function headStream(stream, bytes) {
    let byteLengthCounter = 0;
    const chunks = [];
    const reader = stream.getReader();
    let isDone = false;
    while (!isDone) {
        const { done, value } = await reader.read();
        if (value) {
            chunks.push(value);
            byteLengthCounter += value?.byteLength ?? 0;
        }
        if (byteLengthCounter >= bytes) {
            break;
        }
        isDone = done;
    }
    reader.releaseLock();
    const collected = new Uint8Array(Math.min(bytes, byteLengthCounter));
    let offset = 0;
    for (const chunk of chunks) {
        if (chunk.byteLength > collected.byteLength - offset) {
            collected.set(chunk.subarray(0, collected.byteLength - offset), offset);
            break;
        }
        else {
            collected.set(chunk, offset);
        }
        offset += chunk.length;
    }
    return collected;
}

function createRequest(url, requestOptions) {
    return new Request(url, requestOptions);
}

function requestTimeout(timeoutInMs = 0) {
    return new Promise((resolve, reject) => {
        if (timeoutInMs) {
            setTimeout(() => {
                const timeoutError = new Error(`Request did not complete within ${timeoutInMs} ms`);
                timeoutError.name = "TimeoutError";
                reject(timeoutError);
            }, timeoutInMs);
        }
    });
}

const keepAliveSupport = {
    supported: undefined,
};
class FetchHttpHandler {
    config;
    configProvider;
    static create(instanceOrOptions) {
        if (typeof instanceOrOptions?.handle === "function") {
            return instanceOrOptions;
        }
        return new FetchHttpHandler(instanceOrOptions);
    }
    constructor(options) {
        if (typeof options === "function") {
            this.configProvider = options().then((opts) => opts || {});
        }
        else {
            this.config = options ?? {};
            this.configProvider = Promise.resolve(this.config);
        }
        if (keepAliveSupport.supported === undefined) {
            keepAliveSupport.supported = Boolean(typeof Request !== "undefined" && "keepalive" in createRequest("https://[::1]"));
        }
    }
    destroy() {
    }
    async handle(request, { abortSignal, requestTimeout: requestTimeout$1 } = {}) {
        if (!this.config) {
            this.config = await this.configProvider;
        }
        const requestTimeoutInMs = requestTimeout$1 ?? this.config.requestTimeout;
        const keepAlive = this.config.keepAlive === true;
        const credentials = this.config.credentials;
        if (abortSignal?.aborted) {
            const abortError = buildAbortError(abortSignal);
            return Promise.reject(abortError);
        }
        let path = request.path;
        const queryString = buildQueryString(request.query || {});
        if (queryString) {
            path += `?${queryString}`;
        }
        if (request.fragment) {
            path += `#${request.fragment}`;
        }
        let auth = "";
        if (request.username != null || request.password != null) {
            const username = request.username ?? "";
            const password = request.password ?? "";
            auth = `${username}:${password}@`;
        }
        const { port, method } = request;
        const url = `${request.protocol}//${auth}${request.hostname}${port ? `:${port}` : ""}${path}`;
        const body = method === "GET" || method === "HEAD" ? undefined : request.body;
        const requestOptions = {
            body,
            headers: new Headers(request.headers),
            method: method,
            credentials,
        };
        if (this.config?.cache) {
            requestOptions.cache = this.config.cache;
        }
        if (body) {
            requestOptions.duplex = "half";
        }
        if (typeof AbortController !== "undefined") {
            requestOptions.signal = abortSignal;
        }
        if (keepAliveSupport.supported) {
            requestOptions.keepalive = keepAlive;
        }
        if (typeof this.config.requestInit === "function") {
            Object.assign(requestOptions, this.config.requestInit(request));
        }
        let removeSignalEventListener = () => { };
        const fetchRequest = createRequest(url, requestOptions);
        const raceOfPromises = [
            fetch(fetchRequest).then((response) => {
                const fetchHeaders = response.headers;
                const transformedHeaders = {};
                for (const pair of fetchHeaders.entries()) {
                    transformedHeaders[pair[0]] = pair[1];
                }
                const hasReadableStream = response.body != undefined;
                if (!hasReadableStream) {
                    return response.blob().then((body) => ({
                        response: new HttpResponse({
                            headers: transformedHeaders,
                            reason: response.statusText,
                            statusCode: response.status,
                            body,
                        }),
                    }));
                }
                return {
                    response: new HttpResponse({
                        headers: transformedHeaders,
                        reason: response.statusText,
                        statusCode: response.status,
                        body: response.body,
                    }),
                };
            }),
            requestTimeout(requestTimeoutInMs),
        ];
        if (abortSignal) {
            raceOfPromises.push(new Promise((resolve, reject) => {
                const onAbort = () => {
                    const abortError = buildAbortError(abortSignal);
                    reject(abortError);
                };
                if (typeof abortSignal.addEventListener === "function") {
                    const signal = abortSignal;
                    signal.addEventListener("abort", onAbort, { once: true });
                    removeSignalEventListener = () => signal.removeEventListener("abort", onAbort);
                }
                else {
                    abortSignal.onabort = onAbort;
                }
            }));
        }
        return Promise.race(raceOfPromises).finally(removeSignalEventListener);
    }
    updateHttpClientConfig(key, value) {
        this.config = undefined;
        this.configProvider = this.configProvider.then((config) => {
            config[key] = value;
            return config;
        });
    }
    httpHandlerConfigs() {
        return this.config ?? {};
    }
}
function buildAbortError(abortSignal) {
    const reason = abortSignal && typeof abortSignal === "object" && "reason" in abortSignal
        ? abortSignal.reason
        : undefined;
    if (reason) {
        if (reason instanceof Error) {
            const abortError = new Error("Request aborted");
            abortError.name = "AbortError";
            abortError.cause = reason;
            return abortError;
        }
        const abortError = new Error(String(reason));
        abortError.name = "AbortError";
        return abortError;
    }
    const abortError = new Error("Request aborted");
    abortError.name = "AbortError";
    return abortError;
}

const streamCollector = async (stream) => {
    if ((typeof Blob === "function" && stream instanceof Blob) || stream.constructor?.name === "Blob") {
        if (Blob.prototype.arrayBuffer !== undefined) {
            return new Uint8Array(await stream.arrayBuffer());
        }
        return collectBlob(stream);
    }
    return collectStream(stream);
};
async function collectBlob(blob) {
    const base64 = await readToBase64(blob);
    const arrayBuffer = fromBase64(base64);
    return new Uint8Array(arrayBuffer);
}
async function collectStream(stream) {
    const chunks = [];
    const reader = stream.getReader();
    let isDone = false;
    let length = 0;
    while (!isDone) {
        const { done, value } = await reader.read();
        if (value) {
            chunks.push(value);
            length += value.length;
        }
        isDone = done;
    }
    const collected = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        collected.set(chunk, offset);
        offset += chunk.length;
    }
    return collected;
}
function readToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.readyState !== 2) {
                return reject(new Error("Reader aborted too early"));
            }
            const result = (reader.result ?? "");
            const commaIndex = result.indexOf(",");
            const dataOffset = commaIndex > -1 ? commaIndex + 1 : result.length;
            resolve(result.substring(dataOffset));
        };
        reader.onabort = () => reject(new Error("Read aborted"));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

const ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED = "The stream has already been transformed.";
const sdkStreamMixin = (stream) => {
    if (!isBlobInstance(stream) && !isReadableStream$1(stream)) {
        const name = stream?.__proto__?.constructor?.name || stream;
        throw new Error(`Unexpected stream implementation, expect Blob or ReadableStream, got ${name}`);
    }
    let transformed = false;
    const transformToByteArray = async () => {
        if (transformed) {
            throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
        }
        transformed = true;
        return await streamCollector(stream);
    };
    const blobToWebStream = (blob) => {
        if (typeof blob.stream !== "function") {
            throw new Error("Cannot transform payload Blob to web stream. Please make sure the Blob.stream() is polyfilled.\n" +
                "If you are using React Native, this API is not yet supported, see: https://react-native.canny.io/feature-requests/p/fetch-streaming-body");
        }
        return blob.stream();
    };
    return Object.assign(stream, {
        transformToByteArray: transformToByteArray,
        transformToString: async (encoding) => {
            const buf = await transformToByteArray();
            if (encoding === "base64") {
                return toBase64(buf);
            }
            else if (encoding === "hex") {
                return toHex(buf);
            }
            else if (encoding === undefined || encoding === "utf8" || encoding === "utf-8") {
                return toUtf8(buf);
            }
            else if (typeof TextDecoder === "function") {
                return new TextDecoder(encoding).decode(buf);
            }
            else {
                throw new Error("TextDecoder is not available, please make sure polyfill is provided.");
            }
        },
        transformToWebStream: () => {
            if (transformed) {
                throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
            }
            transformed = true;
            if (isBlobInstance(stream)) {
                return blobToWebStream(stream);
            }
            else if (isReadableStream$1(stream)) {
                return stream;
            }
            else {
                throw new Error(`Cannot transform payload to web stream, got ${stream}`);
            }
        },
    });
};
const isBlobInstance = (stream) => typeof Blob === "function" && stream instanceof Blob;

async function splitStream(stream) {
    if (typeof stream.stream === "function") {
        stream = stream.stream();
    }
    const readableStream = stream;
    return readableStream.tee();
}

const collectBody$1 = async (streamBody = new Uint8Array(), context) => {
    if (streamBody instanceof Uint8Array) {
        return Uint8ArrayBlobAdapter.mutate(streamBody);
    }
    if (!streamBody) {
        return Uint8ArrayBlobAdapter.mutate(new Uint8Array());
    }
    const fromContext = context.streamCollector(streamBody);
    return Uint8ArrayBlobAdapter.mutate(await fromContext);
};

function extendedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
        return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

const deref = (schemaRef) => {
    if (typeof schemaRef === "function") {
        return schemaRef();
    }
    return schemaRef;
};

const operation = (namespace, name, traits, input, output) => ({
    name,
    namespace,
    traits,
    input,
    output,
});

const schemaDeserializationMiddleware = (config) => (next, context) => async (args) => {
    const { response } = await next(args);
    const { operationSchema } = getSmithyContext(context);
    const [, ns, n, t, i, o] = operationSchema ?? [];
    try {
        const parsed = await config.protocol.deserializeResponse(operation(ns, n, t, i, o), {
            ...config,
            ...context,
        }, response);
        return {
            response,
            output: parsed,
        };
    }
    catch (error) {
        Object.defineProperty(error, "$response", {
            value: response,
            enumerable: false,
            writable: false,
            configurable: false,
        });
        if (!("$metadata" in error)) {
            const hint = `Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.`;
            try {
                error.message += "\n  " + hint;
            }
            catch (e) {
                if (!context.logger || context.logger?.constructor?.name === "NoOpLogger") {
                    console.warn(hint);
                }
                else {
                    context.logger?.warn?.(hint);
                }
            }
            if (typeof error.$responseBodyText !== "undefined") {
                if (error.$response) {
                    error.$response.body = error.$responseBodyText;
                }
            }
            try {
                if (HttpResponse.isInstance(response)) {
                    const { headers = {} } = response;
                    const headerEntries = Object.entries(headers);
                    error.$metadata = {
                        httpStatusCode: response.statusCode,
                        requestId: findHeader(/^x-[\w-]+-request-?id$/, headerEntries),
                        extendedRequestId: findHeader(/^x-[\w-]+-id-2$/, headerEntries),
                        cfId: findHeader(/^x-[\w-]+-cf-id$/, headerEntries),
                    };
                }
            }
            catch (e) {
            }
        }
        throw error;
    }
};
const findHeader = (pattern, headers) => {
    return (headers.find(([k]) => {
        return k.match(pattern);
    }) || [void 0, void 0])[1];
};

const toEndpointV1 = (endpoint) => {
    if (typeof endpoint === "object") {
        if ("url" in endpoint) {
            const v1Endpoint = parseUrl(endpoint.url);
            if (endpoint.headers) {
                v1Endpoint.headers = {};
                for (const [name, values] of Object.entries(endpoint.headers)) {
                    v1Endpoint.headers[name.toLowerCase()] = values.join(", ");
                }
            }
            return v1Endpoint;
        }
        return endpoint;
    }
    return parseUrl(endpoint);
};

const schemaSerializationMiddleware = (config) => (next, context) => async (args) => {
    const { operationSchema } = getSmithyContext(context);
    const [, ns, n, t, i, o] = operationSchema ?? [];
    const endpoint = context.endpointV2
        ? async () => toEndpointV1(context.endpointV2)
        : config.endpoint;
    const request = await config.protocol.serializeRequest(operation(ns, n, t, i, o), args.input, {
        ...config,
        ...context,
        endpoint,
    });
    return next({
        ...args,
        request,
    });
};

const deserializerMiddlewareOption = {
    name: "deserializerMiddleware",
    step: "deserialize",
    tags: ["DESERIALIZER"],
    override: true,
};
const serializerMiddlewareOption$1 = {
    name: "serializerMiddleware",
    step: "serialize",
    tags: ["SERIALIZER"],
    override: true,
};
function getSchemaSerdePlugin(config) {
    return {
        applyToStack: (commandStack) => {
            commandStack.add(schemaSerializationMiddleware(config), serializerMiddlewareOption$1);
            commandStack.add(schemaDeserializationMiddleware(config), deserializerMiddlewareOption);
            config.protocol.setSerdeContext(config);
        },
    };
}

const traitsCache = [];
function translateTraits(indicator) {
    if (typeof indicator === "object") {
        return indicator;
    }
    indicator = indicator | 0;
    if (traitsCache[indicator]) {
        return traitsCache[indicator];
    }
    const traits = {};
    let i = 0;
    for (const trait of [
        "httpLabel",
        "idempotent",
        "idempotencyToken",
        "sensitive",
        "httpPayload",
        "httpResponseCode",
        "httpQueryParams",
    ]) {
        if (((indicator >> i++) & 1) === 1) {
            traits[trait] = 1;
        }
    }
    return (traitsCache[indicator] = traits);
}

const anno = {
    it: Symbol.for("@smithy/nor-struct-it"),
    ns: Symbol.for("@smithy/ns"),
};
const simpleSchemaCacheN = [];
const simpleSchemaCacheS = {};
class NormalizedSchema {
    ref;
    memberName;
    static symbol = Symbol.for("@smithy/nor");
    symbol = NormalizedSchema.symbol;
    name;
    schema;
    _isMemberSchema;
    traits;
    memberTraits;
    normalizedTraits;
    constructor(ref, memberName) {
        this.ref = ref;
        this.memberName = memberName;
        const traitStack = [];
        let _ref = ref;
        let schema = ref;
        this._isMemberSchema = false;
        while (isMemberSchema(_ref)) {
            traitStack.push(_ref[1]);
            _ref = _ref[0];
            schema = deref(_ref);
            this._isMemberSchema = true;
        }
        if (traitStack.length > 0) {
            this.memberTraits = {};
            for (let i = traitStack.length - 1; i >= 0; --i) {
                const traitSet = traitStack[i];
                Object.assign(this.memberTraits, translateTraits(traitSet));
            }
        }
        else {
            this.memberTraits = 0;
        }
        if (schema instanceof NormalizedSchema) {
            const computedMemberTraits = this.memberTraits;
            Object.assign(this, schema);
            this.memberTraits = Object.assign({}, computedMemberTraits, schema.getMemberTraits(), this.getMemberTraits());
            this.normalizedTraits = void 0;
            this.memberName = memberName ?? schema.memberName;
            return;
        }
        this.schema = deref(schema);
        if (isStaticSchema(this.schema)) {
            this.name = `${this.schema[1]}#${this.schema[2]}`;
            this.traits = this.schema[3];
        }
        else {
            this.name = this.memberName ?? String(schema);
            this.traits = 0;
        }
        if (this._isMemberSchema && !memberName) {
            throw new Error(`@smithy/core/schema - NormalizedSchema member init ${this.getName(true)} missing member name.`);
        }
    }
    static [Symbol.hasInstance](lhs) {
        const isPrototype = this.prototype.isPrototypeOf(lhs);
        if (!isPrototype && typeof lhs === "object" && lhs !== null) {
            const ns = lhs;
            return ns.symbol === this.symbol;
        }
        return isPrototype;
    }
    static of(ref) {
        const keyAble = typeof ref === "function" || (typeof ref === "object" && ref !== null);
        if (typeof ref === "number") {
            if (simpleSchemaCacheN[ref]) {
                return simpleSchemaCacheN[ref];
            }
        }
        else if (typeof ref === "string") {
            if (simpleSchemaCacheS[ref]) {
                return simpleSchemaCacheS[ref];
            }
        }
        else if (keyAble) {
            if (ref[anno.ns]) {
                return ref[anno.ns];
            }
        }
        const sc = deref(ref);
        if (sc instanceof NormalizedSchema) {
            return sc;
        }
        if (isMemberSchema(sc)) {
            const [ns, traits] = sc;
            if (ns instanceof NormalizedSchema) {
                Object.assign(ns.getMergedTraits(), translateTraits(traits));
                return ns;
            }
            throw new Error(`@smithy/core/schema - may not init unwrapped member schema=${JSON.stringify(ref, null, 2)}.`);
        }
        const ns = new NormalizedSchema(sc);
        if (keyAble) {
            return (ref[anno.ns] = ns);
        }
        if (typeof sc === "string") {
            return (simpleSchemaCacheS[sc] = ns);
        }
        if (typeof sc === "number") {
            return (simpleSchemaCacheN[sc] = ns);
        }
        return ns;
    }
    getSchema() {
        const sc = this.schema;
        if (Array.isArray(sc) && sc[0] === 0) {
            return sc[4];
        }
        return sc;
    }
    getName(withNamespace = false) {
        const { name } = this;
        const short = !withNamespace && name && name.includes("#");
        return short ? name.split("#")[1] : name || undefined;
    }
    getMemberName() {
        return this.memberName;
    }
    isMemberSchema() {
        return this._isMemberSchema;
    }
    isListSchema() {
        const sc = this.getSchema();
        return typeof sc === "number"
            ? sc >= 64 && sc < 128
            : sc[0] === 1;
    }
    isMapSchema() {
        const sc = this.getSchema();
        return typeof sc === "number"
            ? sc >= 128 && sc <= 0b1111_1111
            : sc[0] === 2;
    }
    isStructSchema() {
        const sc = this.getSchema();
        if (typeof sc !== "object") {
            return false;
        }
        const id = sc[0];
        return (id === 3 ||
            id === -3 ||
            id === 4);
    }
    isUnionSchema() {
        const sc = this.getSchema();
        if (typeof sc !== "object") {
            return false;
        }
        return sc[0] === 4;
    }
    isBlobSchema() {
        const sc = this.getSchema();
        return sc === 21 || sc === 42;
    }
    isTimestampSchema() {
        const sc = this.getSchema();
        return (typeof sc === "number" &&
            sc >= 4 &&
            sc <= 7);
    }
    isUnitSchema() {
        return this.getSchema() === "unit";
    }
    isDocumentSchema() {
        return this.getSchema() === 15;
    }
    isStringSchema() {
        return this.getSchema() === 0;
    }
    isBooleanSchema() {
        return this.getSchema() === 2;
    }
    isNumericSchema() {
        return this.getSchema() === 1;
    }
    isBigIntegerSchema() {
        return this.getSchema() === 17;
    }
    isBigDecimalSchema() {
        return this.getSchema() === 19;
    }
    isStreaming() {
        const { streaming } = this.getMergedTraits();
        return !!streaming || this.getSchema() === 42;
    }
    isIdempotencyToken() {
        return !!this.getMergedTraits().idempotencyToken;
    }
    getMergedTraits() {
        return (this.normalizedTraits ??
            (this.normalizedTraits = {
                ...this.getOwnTraits(),
                ...this.getMemberTraits(),
            }));
    }
    getMemberTraits() {
        return translateTraits(this.memberTraits);
    }
    getOwnTraits() {
        return translateTraits(this.traits);
    }
    getKeySchema() {
        const [isDoc, isMap] = [this.isDocumentSchema(), this.isMapSchema()];
        if (!isDoc && !isMap) {
            throw new Error(`@smithy/core/schema - cannot get key for non-map: ${this.getName(true)}`);
        }
        const schema = this.getSchema();
        const memberSchema = isDoc
            ? 15
            : schema[4] ?? 0;
        return member([memberSchema, 0], "key");
    }
    getValueSchema() {
        const sc = this.getSchema();
        const [isDoc, isMap, isList] = [this.isDocumentSchema(), this.isMapSchema(), this.isListSchema()];
        const memberSchema = typeof sc === "number"
            ? 0b0011_1111 & sc
            : sc && typeof sc === "object" && (isMap || isList)
                ? sc[3 + sc[0]]
                : isDoc
                    ? 15
                    : void 0;
        if (memberSchema != null) {
            return member([memberSchema, 0], isMap ? "value" : "member");
        }
        throw new Error(`@smithy/core/schema - ${this.getName(true)} has no value member.`);
    }
    getMemberSchema(memberName) {
        const struct = this.getSchema();
        if (this.isStructSchema() && struct[4].includes(memberName)) {
            const i = struct[4].indexOf(memberName);
            const memberSchema = struct[5][i];
            return member(isMemberSchema(memberSchema) ? memberSchema : [memberSchema, 0], memberName);
        }
        if (this.isDocumentSchema()) {
            return member([15, 0], memberName);
        }
        throw new Error(`@smithy/core/schema - ${this.getName(true)} has no member=${memberName}.`);
    }
    getMemberSchemas() {
        const buffer = {};
        try {
            for (const [k, v] of this.structIterator()) {
                buffer[k] = v;
            }
        }
        catch (ignored) { }
        return buffer;
    }
    getEventStreamMember() {
        if (this.isStructSchema()) {
            for (const [memberName, memberSchema] of this.structIterator()) {
                if (memberSchema.isStreaming() && memberSchema.isStructSchema()) {
                    return memberName;
                }
            }
        }
        return "";
    }
    *structIterator() {
        if (this.isUnitSchema()) {
            return;
        }
        if (!this.isStructSchema()) {
            throw new Error("@smithy/core/schema - cannot iterate non-struct schema.");
        }
        const struct = this.getSchema();
        const z = struct[4].length;
        let it = struct[anno.it];
        if (it && z === it.length) {
            yield* it;
            return;
        }
        it = Array(z);
        for (let i = 0; i < z; ++i) {
            const k = struct[4][i];
            const v = member([struct[5][i], 0], k);
            yield (it[i] = [k, v]);
        }
        struct[anno.it] = it;
    }
}
function member(memberSchema, memberName) {
    if (memberSchema instanceof NormalizedSchema) {
        return Object.assign(memberSchema, {
            memberName,
            _isMemberSchema: true,
        });
    }
    const internalCtorAccess = NormalizedSchema;
    return new internalCtorAccess(memberSchema, memberName);
}
const isMemberSchema = (sc) => Array.isArray(sc) && sc.length === 2;
const isStaticSchema = (sc) => Array.isArray(sc) && sc.length >= 5;

class TypeRegistry {
    namespace;
    schemas;
    exceptions;
    static registries = new Map();
    constructor(namespace, schemas = new Map(), exceptions = new Map()) {
        this.namespace = namespace;
        this.schemas = schemas;
        this.exceptions = exceptions;
    }
    static for(namespace) {
        if (!TypeRegistry.registries.has(namespace)) {
            TypeRegistry.registries.set(namespace, new TypeRegistry(namespace));
        }
        return TypeRegistry.registries.get(namespace);
    }
    copyFrom(other) {
        const { schemas, exceptions } = this;
        for (const [k, v] of other.schemas) {
            if (!schemas.has(k)) {
                schemas.set(k, v);
            }
        }
        for (const [k, v] of other.exceptions) {
            if (!exceptions.has(k)) {
                exceptions.set(k, v);
            }
        }
    }
    register(shapeId, schema) {
        const qualifiedName = this.normalizeShapeId(shapeId);
        for (const r of [this, TypeRegistry.for(qualifiedName.split("#")[0])]) {
            r.schemas.set(qualifiedName, schema);
        }
    }
    getSchema(shapeId) {
        const id = this.normalizeShapeId(shapeId);
        if (!this.schemas.has(id)) {
            throw new Error(`@smithy/core/schema - schema not found for ${id}`);
        }
        return this.schemas.get(id);
    }
    registerError(es, ctor) {
        const $error = es;
        const ns = $error[1];
        for (const r of [this, TypeRegistry.for(ns)]) {
            r.schemas.set(ns + "#" + $error[2], $error);
            r.exceptions.set($error, ctor);
        }
    }
    getErrorCtor(es) {
        const $error = es;
        if (this.exceptions.has($error)) {
            return this.exceptions.get($error);
        }
        const registry = TypeRegistry.for($error[1]);
        return registry.exceptions.get($error);
    }
    getBaseException() {
        for (const exceptionKey of this.exceptions.keys()) {
            if (Array.isArray(exceptionKey)) {
                const [, ns, name] = exceptionKey;
                const id = ns + "#" + name;
                if (id.startsWith("smithy.ts.sdk.synthetic.") && id.endsWith("ServiceException")) {
                    return exceptionKey;
                }
            }
        }
        return undefined;
    }
    find(predicate) {
        return [...this.schemas.values()].find(predicate);
    }
    clear() {
        this.schemas.clear();
        this.exceptions.clear();
    }
    normalizeShapeId(shapeId) {
        if (shapeId.includes("#")) {
            return shapeId;
        }
        return this.namespace + "#" + shapeId;
    }
}

const expectNumber = (value) => {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (!Number.isNaN(parsed)) {
            if (String(parsed) !== String(value)) {
                logger.warn(stackTraceWarning(`Expected number but observed string: ${value}`));
            }
            return parsed;
        }
    }
    if (typeof value === "number") {
        return value;
    }
    throw new TypeError(`Expected number, got ${typeof value}: ${value}`);
};
const MAX_FLOAT = Math.ceil(2 ** 127 * (2 - 2 ** -23));
const expectFloat32 = (value) => {
    const expected = expectNumber(value);
    if (expected !== undefined && !Number.isNaN(expected) && expected !== Infinity && expected !== -Infinity) {
        if (Math.abs(expected) > MAX_FLOAT) {
            throw new TypeError(`Expected 32-bit float, got ${value}`);
        }
    }
    return expected;
};
const expectLong = (value) => {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (Number.isInteger(value) && !Number.isNaN(value)) {
        return value;
    }
    throw new TypeError(`Expected integer, got ${typeof value}: ${value}`);
};
const expectShort = (value) => expectSizedInt(value, 16);
const expectByte = (value) => expectSizedInt(value, 8);
const expectSizedInt = (value, size) => {
    const expected = expectLong(value);
    if (expected !== undefined && castInt(expected, size) !== expected) {
        throw new TypeError(`Expected ${size}-bit integer, got ${value}`);
    }
    return expected;
};
const castInt = (value, size) => {
    switch (size) {
        case 32:
            return Int32Array.of(value)[0];
        case 16:
            return Int16Array.of(value)[0];
        case 8:
            return Int8Array.of(value)[0];
    }
};
const strictParseFloat32 = (value) => {
    if (typeof value == "string") {
        return expectFloat32(parseNumber(value));
    }
    return expectFloat32(value);
};
const NUMBER_REGEX = /(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|(-?Infinity)|(NaN)/g;
const parseNumber = (value) => {
    const matches = value.match(NUMBER_REGEX);
    if (matches === null || matches[0].length !== value.length) {
        throw new TypeError(`Expected real number, got implicit NaN`);
    }
    return parseFloat(value);
};
const strictParseShort = (value) => {
    if (typeof value === "string") {
        return expectShort(parseNumber(value));
    }
    return expectShort(value);
};
const strictParseByte = (value) => {
    if (typeof value === "string") {
        return expectByte(parseNumber(value));
    }
    return expectByte(value);
};
const stackTraceWarning = (message) => {
    return String(new TypeError(message).stack || message)
        .split("\n")
        .slice(0, 5)
        .filter((s) => !s.includes("stackTraceWarning"))
        .join("\n");
};
const logger = {
    warn: console.warn,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateToUtcString(date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const dayOfWeek = date.getUTCDay();
    const dayOfMonthInt = date.getUTCDate();
    const hoursInt = date.getUTCHours();
    const minutesInt = date.getUTCMinutes();
    const secondsInt = date.getUTCSeconds();
    const dayOfMonthString = dayOfMonthInt < 10 ? `0${dayOfMonthInt}` : `${dayOfMonthInt}`;
    const hoursString = hoursInt < 10 ? `0${hoursInt}` : `${hoursInt}`;
    const minutesString = minutesInt < 10 ? `0${minutesInt}` : `${minutesInt}`;
    const secondsString = secondsInt < 10 ? `0${secondsInt}` : `${secondsInt}`;
    return `${DAYS[dayOfWeek]}, ${dayOfMonthString} ${MONTHS[month]} ${year} ${hoursString}:${minutesString}:${secondsString} GMT`;
}
const IMF_FIXDATE$1 = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
const RFC_850_DATE$1 = new RegExp(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
const ASC_TIME$1 = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? (\d{4})$/);
const parseRfc7231DateTime = (value) => {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new TypeError("RFC-7231 date-times must be expressed as strings");
    }
    let match = IMF_FIXDATE$1.exec(value);
    if (match) {
        const [_, dayStr, monthStr, yearStr, hours, minutes, seconds, fractionalMilliseconds] = match;
        return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), { hours, minutes, seconds, fractionalMilliseconds });
    }
    match = RFC_850_DATE$1.exec(value);
    if (match) {
        const [_, dayStr, monthStr, yearStr, hours, minutes, seconds, fractionalMilliseconds] = match;
        return adjustRfc850Year(buildDate(parseTwoDigitYear(yearStr), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), {
            hours,
            minutes,
            seconds,
            fractionalMilliseconds,
        }));
    }
    match = ASC_TIME$1.exec(value);
    if (match) {
        const [_, monthStr, dayStr, hours, minutes, seconds, fractionalMilliseconds, yearStr] = match;
        return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr.trimLeft(), "day", 1, 31), { hours, minutes, seconds, fractionalMilliseconds });
    }
    throw new TypeError("Invalid RFC-7231 date-time value");
};
const buildDate = (year, month, day, time) => {
    const adjustedMonth = month - 1;
    validateDayOfMonth(year, adjustedMonth, day);
    return new Date(Date.UTC(year, adjustedMonth, day, parseDateValue(time.hours, "hour", 0, 23), parseDateValue(time.minutes, "minute", 0, 59), parseDateValue(time.seconds, "seconds", 0, 60), parseMilliseconds(time.fractionalMilliseconds)));
};
const parseTwoDigitYear = (value) => {
    const thisYear = new Date().getUTCFullYear();
    const valueInThisCentury = Math.floor(thisYear / 100) * 100 + strictParseShort(stripLeadingZeroes(value));
    if (valueInThisCentury < thisYear) {
        return valueInThisCentury + 100;
    }
    return valueInThisCentury;
};
const FIFTY_YEARS_IN_MILLIS = 50 * 365 * 24 * 60 * 60 * 1000;
const adjustRfc850Year = (input) => {
    if (input.getTime() - new Date().getTime() > FIFTY_YEARS_IN_MILLIS) {
        return new Date(Date.UTC(input.getUTCFullYear() - 100, input.getUTCMonth(), input.getUTCDate(), input.getUTCHours(), input.getUTCMinutes(), input.getUTCSeconds(), input.getUTCMilliseconds()));
    }
    return input;
};
const parseMonthByShortName = (value) => {
    const monthIdx = MONTHS.indexOf(value);
    if (monthIdx < 0) {
        throw new TypeError(`Invalid month: ${value}`);
    }
    return monthIdx + 1;
};
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const validateDayOfMonth = (year, month, day) => {
    let maxDays = DAYS_IN_MONTH[month];
    if (month === 1 && isLeapYear(year)) {
        maxDays = 29;
    }
    if (day > maxDays) {
        throw new TypeError(`Invalid day for ${MONTHS[month]} in ${year}: ${day}`);
    }
};
const isLeapYear = (year) => {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
};
const parseDateValue = (value, type, lower, upper) => {
    const dateVal = strictParseByte(stripLeadingZeroes(value));
    if (dateVal < lower || dateVal > upper) {
        throw new TypeError(`${type} must be between ${lower} and ${upper}, inclusive`);
    }
    return dateVal;
};
const parseMilliseconds = (value) => {
    if (value === null || value === undefined) {
        return 0;
    }
    return strictParseFloat32("0." + value) * 1000;
};
const stripLeadingZeroes = (value) => {
    let idx = 0;
    while (idx < value.length - 1 && value.charAt(idx) === "0") {
        idx++;
    }
    if (idx === 0) {
        return value;
    }
    return value.slice(idx);
};

const randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);

const decimalToHex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
const v4 = () => {
    if (randomUUID) {
        return randomUUID();
    }
    const rnds = new Uint8Array(16);
    crypto.getRandomValues(rnds);
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;
    return (decimalToHex[rnds[0]] +
        decimalToHex[rnds[1]] +
        decimalToHex[rnds[2]] +
        decimalToHex[rnds[3]] +
        "-" +
        decimalToHex[rnds[4]] +
        decimalToHex[rnds[5]] +
        "-" +
        decimalToHex[rnds[6]] +
        decimalToHex[rnds[7]] +
        "-" +
        decimalToHex[rnds[8]] +
        decimalToHex[rnds[9]] +
        "-" +
        decimalToHex[rnds[10]] +
        decimalToHex[rnds[11]] +
        decimalToHex[rnds[12]] +
        decimalToHex[rnds[13]] +
        decimalToHex[rnds[14]] +
        decimalToHex[rnds[15]]);
};

const LazyJsonString = function LazyJsonString(val) {
    const str = Object.assign(new String(val), {
        deserializeJSON() {
            return JSON.parse(String(val));
        },
        toString() {
            return String(val);
        },
        toJSON() {
            return String(val);
        },
    });
    return str;
};
LazyJsonString.from = (object) => {
    if (object && typeof object === "object" && (object instanceof LazyJsonString || "deserializeJSON" in object)) {
        return object;
    }
    else if (typeof object === "string" || Object.getPrototypeOf(object) === String.prototype) {
        return LazyJsonString(String(object));
    }
    return LazyJsonString(JSON.stringify(object));
};
LazyJsonString.fromObject = LazyJsonString.from;

function quoteHeader(part) {
    if (part.includes(",") || part.includes('"')) {
        part = `"${part.replace(/"/g, '\\"')}"`;
    }
    return part;
}

const ddd = `(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:[ne|u?r]?s?day)?`;
const mmm = `(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)`;
const time = `(\\d?\\d):(\\d{2}):(\\d{2})(?:\\.(\\d+))?`;
const date = `(\\d?\\d)`;
const year = `(\\d{4})`;
const RFC3339_WITH_OFFSET = new RegExp(/^(\d{4})-(\d\d)-(\d\d)[tT](\d\d):(\d\d):(\d\d)(\.(\d+))?(([-+]\d\d:\d\d)|[zZ])$/);
const IMF_FIXDATE = new RegExp(`^${ddd}, ${date} ${mmm} ${year} ${time} GMT$`);
const RFC_850_DATE = new RegExp(`^${ddd}, ${date}-${mmm}-(\\d\\d) ${time} GMT$`);
const ASC_TIME = new RegExp(`^${ddd} ${mmm} ( [1-9]|\\d\\d) ${time} ${year}$`);
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const _parseEpochTimestamp = (value) => {
    if (value == null) {
        return void 0;
    }
    let num = NaN;
    if (typeof value === "number") {
        num = value;
    }
    else if (typeof value === "string") {
        if (!/^-?\d*\.?\d+$/.test(value)) {
            throw new TypeError(`parseEpochTimestamp - numeric string invalid.`);
        }
        num = Number.parseFloat(value);
    }
    else if (typeof value === "object" && value.tag === 1) {
        num = value.value;
    }
    if (isNaN(num) || Math.abs(num) === Infinity) {
        throw new TypeError("Epoch timestamps must be valid finite numbers.");
    }
    return new Date(Math.round(num * 1000));
};
const _parseRfc3339DateTimeWithOffset = (value) => {
    if (value == null) {
        return void 0;
    }
    if (typeof value !== "string") {
        throw new TypeError("RFC3339 timestamps must be strings");
    }
    const matches = RFC3339_WITH_OFFSET.exec(value);
    if (!matches) {
        throw new TypeError(`Invalid RFC3339 timestamp format ${value}`);
    }
    const [, yearStr, monthStr, dayStr, hours, minutes, seconds, , ms, offsetStr] = matches;
    range(monthStr, 1, 12);
    range(dayStr, 1, 31);
    range(hours, 0, 23);
    range(minutes, 0, 59);
    range(seconds, 0, 60);
    const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), Number(hours), Number(minutes), Number(seconds), Number(ms) ? Math.round(parseFloat(`0.${ms}`) * 1000) : 0));
    date.setUTCFullYear(Number(yearStr));
    if (offsetStr.toUpperCase() != "Z") {
        const [, sign, offsetH, offsetM] = /([+-])(\d\d):(\d\d)/.exec(offsetStr) || [void 0, "+", 0, 0];
        const scalar = sign === "-" ? 1 : -1;
        date.setTime(date.getTime() + scalar * (Number(offsetH) * 60 * 60 * 1000 + Number(offsetM) * 60 * 1000));
    }
    return date;
};
const _parseRfc7231DateTime = (value) => {
    if (value == null) {
        return void 0;
    }
    if (typeof value !== "string") {
        throw new TypeError("RFC7231 timestamps must be strings.");
    }
    let day;
    let month;
    let year;
    let hour;
    let minute;
    let second;
    let fraction;
    let matches;
    if ((matches = IMF_FIXDATE.exec(value))) {
        [, day, month, year, hour, minute, second, fraction] = matches;
    }
    else if ((matches = RFC_850_DATE.exec(value))) {
        [, day, month, year, hour, minute, second, fraction] = matches;
        year = (Number(year) + 1900).toString();
    }
    else if ((matches = ASC_TIME.exec(value))) {
        [, month, day, hour, minute, second, fraction, year] = matches;
    }
    if (year && second) {
        const timestamp = Date.UTC(Number(year), months.indexOf(month), Number(day), Number(hour), Number(minute), Number(second), fraction ? Math.round(parseFloat(`0.${fraction}`) * 1000) : 0);
        range(day, 1, 31);
        range(hour, 0, 23);
        range(minute, 0, 59);
        range(second, 0, 60);
        const date = new Date(timestamp);
        date.setUTCFullYear(Number(year));
        return date;
    }
    throw new TypeError(`Invalid RFC7231 date-time value ${value}.`);
};
function range(v, min, max) {
    const _v = Number(v);
    if (_v < min || _v > max) {
        throw new Error(`Value ${_v} out of range [${min}, ${max}]`);
    }
}

function splitEvery(value, delimiter, numDelimiters) {
    if (!Number.isInteger(numDelimiters)) {
        throw new Error("Invalid number of delimiters (" + numDelimiters + ") for splitEvery.");
    }
    const segments = value.split(delimiter);
    const compoundSegments = [];
    let currentSegment = "";
    for (let i = 0; i < segments.length; i++) {
        if (currentSegment === "") {
            currentSegment = segments[i];
        }
        else {
            currentSegment += delimiter + segments[i];
        }
        if ((i + 1) % numDelimiters === 0) {
            compoundSegments.push(currentSegment);
            currentSegment = "";
        }
    }
    if (currentSegment !== "") {
        compoundSegments.push(currentSegment);
    }
    return compoundSegments;
}

const splitHeader = (value) => {
    const z = value.length;
    const values = [];
    let withinQuotes = false;
    let prevChar = undefined;
    let anchor = 0;
    for (let i = 0; i < z; ++i) {
        const char = value[i];
        switch (char) {
            case `"`:
                if (prevChar !== "\\") {
                    withinQuotes = !withinQuotes;
                }
                break;
            case ",":
                if (!withinQuotes) {
                    values.push(value.slice(anchor, i));
                    anchor = i + 1;
                }
                break;
        }
        prevChar = char;
    }
    values.push(value.slice(anchor));
    return values.map((v) => {
        v = v.trim();
        const z = v.length;
        if (z < 2) {
            return v;
        }
        if (v[0] === `"` && v[z - 1] === `"`) {
            v = v.slice(1, z - 1);
        }
        return v.replace(/\\"/g, '"');
    });
};

const format = /^-?\d*(\.\d+)?$/;
class NumericValue {
    string;
    type;
    constructor(string, type) {
        this.string = string;
        this.type = type;
        if (!format.test(string)) {
            throw new Error(`@smithy/core/serde - NumericValue must only contain [0-9], at most one decimal point ".", and an optional negation prefix "-".`);
        }
    }
    toString() {
        return this.string;
    }
    static [Symbol.hasInstance](object) {
        if (!object || typeof object !== "object") {
            return false;
        }
        const _nv = object;
        return NumericValue.prototype.isPrototypeOf(object) || (_nv.type === "bigDecimal" && format.test(_nv.string));
    }
}

class SerdeContext {
    serdeContext;
    setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
    }
}

class HttpProtocol extends SerdeContext {
    options;
    compositeErrorRegistry;
    constructor(options) {
        super();
        this.options = options;
        this.compositeErrorRegistry = TypeRegistry.for(options.defaultNamespace);
        for (const etr of options.errorTypeRegistries ?? []) {
            this.compositeErrorRegistry.copyFrom(etr);
        }
    }
    getRequestType() {
        return HttpRequest;
    }
    getResponseType() {
        return HttpResponse;
    }
    setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
        this.serializer.setSerdeContext(serdeContext);
        this.deserializer.setSerdeContext(serdeContext);
        if (this.getPayloadCodec()) {
            this.getPayloadCodec().setSerdeContext(serdeContext);
        }
    }
    updateServiceEndpoint(request, endpoint) {
        if ("url" in endpoint) {
            request.protocol = endpoint.url.protocol;
            request.hostname = endpoint.url.hostname;
            request.port = endpoint.url.port ? Number(endpoint.url.port) : undefined;
            request.path = endpoint.url.pathname;
            request.fragment = endpoint.url.hash || void 0;
            request.username = endpoint.url.username || void 0;
            request.password = endpoint.url.password || void 0;
            if (!request.query) {
                request.query = {};
            }
            for (const [k, v] of endpoint.url.searchParams.entries()) {
                request.query[k] = v;
            }
            if (endpoint.headers) {
                for (const [name, values] of Object.entries(endpoint.headers)) {
                    request.headers[name] = values.join(", ");
                }
            }
            return request;
        }
        else {
            request.protocol = endpoint.protocol;
            request.hostname = endpoint.hostname;
            request.port = endpoint.port ? Number(endpoint.port) : undefined;
            request.path = endpoint.path;
            request.query = {
                ...endpoint.query,
            };
            if (endpoint.headers) {
                for (const [name, value] of Object.entries(endpoint.headers)) {
                    request.headers[name] = value;
                }
            }
            return request;
        }
    }
    setHostPrefix(request, operationSchema, input) {
        if (this.serdeContext?.disableHostPrefix) {
            return;
        }
        const inputNs = NormalizedSchema.of(operationSchema.input);
        const opTraits = translateTraits(operationSchema.traits ?? {});
        if (opTraits.endpoint) {
            let hostPrefix = opTraits.endpoint?.[0];
            if (typeof hostPrefix === "string") {
                const hostLabelInputs = [...inputNs.structIterator()].filter(([, member]) => member.getMergedTraits().hostLabel);
                for (const [name] of hostLabelInputs) {
                    const replacement = input[name];
                    if (typeof replacement !== "string") {
                        throw new Error(`@smithy/core/schema - ${name} in input must be a string as hostLabel.`);
                    }
                    hostPrefix = hostPrefix.replace(`{${name}}`, replacement);
                }
                request.hostname = hostPrefix + request.hostname;
            }
        }
    }
    deserializeMetadata(output) {
        return {
            httpStatusCode: output.statusCode,
            requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
            extendedRequestId: output.headers["x-amz-id-2"],
            cfId: output.headers["x-amz-cf-id"],
        };
    }
    async serializeEventStream({ eventStream, requestSchema, initialRequest, }) {
        const eventStreamSerde = await this.loadEventStreamCapability();
        return eventStreamSerde.serializeEventStream({
            eventStream,
            requestSchema,
            initialRequest,
        });
    }
    async deserializeEventStream({ response, responseSchema, initialResponseContainer, }) {
        const eventStreamSerde = await this.loadEventStreamCapability();
        return eventStreamSerde.deserializeEventStream({
            response,
            responseSchema,
            initialResponseContainer,
        });
    }
    async loadEventStreamCapability() {
        const { EventStreamSerde } = await import('./index-BWme7By5.js');
        return new EventStreamSerde({
            marshaller: this.getEventStreamMarshaller(),
            serializer: this.serializer,
            deserializer: this.deserializer,
            serdeContext: this.serdeContext,
            defaultContentType: this.getDefaultContentType(),
        });
    }
    getDefaultContentType() {
        throw new Error(`@smithy/core/protocols - ${this.constructor.name} getDefaultContentType() implementation missing.`);
    }
    async deserializeHttpMessage(schema, context, response, arg4, arg5) {
        return [];
    }
    getEventStreamMarshaller() {
        const context = this.serdeContext;
        if (!context.eventStreamMarshaller) {
            throw new Error("@smithy/core - HttpProtocol: eventStreamMarshaller missing in serdeContext.");
        }
        return context.eventStreamMarshaller;
    }
}

class HttpBindingProtocol extends HttpProtocol {
    async serializeRequest(operationSchema, _input, context) {
        const input = {
            ...(_input ?? {}),
        };
        const serializer = this.serializer;
        const query = {};
        const headers = {};
        const endpoint = await context.endpoint();
        const ns = NormalizedSchema.of(operationSchema?.input);
        const payloadMemberNames = [];
        const payloadMemberSchemas = [];
        let hasNonHttpBindingMember = false;
        let payload;
        const request = new HttpRequest({
            protocol: "",
            hostname: "",
            port: undefined,
            path: "",
            fragment: undefined,
            query: query,
            headers: headers,
            body: undefined,
        });
        if (endpoint) {
            this.updateServiceEndpoint(request, endpoint);
            this.setHostPrefix(request, operationSchema, input);
            const opTraits = translateTraits(operationSchema.traits);
            if (opTraits.http) {
                request.method = opTraits.http[0];
                const [path, search] = opTraits.http[1].split("?");
                if (request.path == "/") {
                    request.path = path;
                }
                else {
                    request.path += path;
                }
                const traitSearchParams = new URLSearchParams(search ?? "");
                Object.assign(query, Object.fromEntries(traitSearchParams));
            }
        }
        for (const [memberName, memberNs] of ns.structIterator()) {
            const memberTraits = memberNs.getMergedTraits() ?? {};
            const inputMemberValue = input[memberName];
            if (inputMemberValue == null && !memberNs.isIdempotencyToken()) {
                if (memberTraits.httpLabel) {
                    if (request.path.includes(`{${memberName}+}`) || request.path.includes(`{${memberName}}`)) {
                        throw new Error(`No value provided for input HTTP label: ${memberName}.`);
                    }
                }
                continue;
            }
            if (memberTraits.httpPayload) {
                const isStreaming = memberNs.isStreaming();
                if (isStreaming) {
                    const isEventStream = memberNs.isStructSchema();
                    if (isEventStream) {
                        if (input[memberName]) {
                            payload = await this.serializeEventStream({
                                eventStream: input[memberName],
                                requestSchema: ns,
                            });
                        }
                    }
                    else {
                        payload = inputMemberValue;
                    }
                }
                else {
                    serializer.write(memberNs, inputMemberValue);
                    payload = serializer.flush();
                }
                delete input[memberName];
            }
            else if (memberTraits.httpLabel) {
                serializer.write(memberNs, inputMemberValue);
                const replacement = serializer.flush();
                if (request.path.includes(`{${memberName}+}`)) {
                    request.path = request.path.replace(`{${memberName}+}`, replacement.split("/").map(extendedEncodeURIComponent).join("/"));
                }
                else if (request.path.includes(`{${memberName}}`)) {
                    request.path = request.path.replace(`{${memberName}}`, extendedEncodeURIComponent(replacement));
                }
                delete input[memberName];
            }
            else if (memberTraits.httpHeader) {
                serializer.write(memberNs, inputMemberValue);
                headers[memberTraits.httpHeader.toLowerCase()] = String(serializer.flush());
                delete input[memberName];
            }
            else if (typeof memberTraits.httpPrefixHeaders === "string") {
                for (const [key, val] of Object.entries(inputMemberValue)) {
                    const amalgam = memberTraits.httpPrefixHeaders + key;
                    serializer.write([memberNs.getValueSchema(), { httpHeader: amalgam }], val);
                    headers[amalgam.toLowerCase()] = serializer.flush();
                }
                delete input[memberName];
            }
            else if (memberTraits.httpQuery || memberTraits.httpQueryParams) {
                this.serializeQuery(memberNs, inputMemberValue, query);
                delete input[memberName];
            }
            else {
                hasNonHttpBindingMember = true;
                payloadMemberNames.push(memberName);
                payloadMemberSchemas.push(memberNs);
            }
        }
        if (hasNonHttpBindingMember && input) {
            const [namespace, name] = (ns.getName(true) ?? "#Unknown").split("#");
            const requiredMembers = ns.getSchema()[6];
            const payloadSchema = [
                3,
                namespace,
                name,
                ns.getMergedTraits(),
                payloadMemberNames,
                payloadMemberSchemas,
                undefined,
            ];
            if (requiredMembers) {
                payloadSchema[6] = requiredMembers;
            }
            else {
                payloadSchema.pop();
            }
            serializer.write(payloadSchema, input);
            payload = serializer.flush();
        }
        request.headers = headers;
        request.query = query;
        request.body = payload;
        return request;
    }
    serializeQuery(ns, data, query) {
        const serializer = this.serializer;
        const traits = ns.getMergedTraits();
        if (traits.httpQueryParams) {
            for (const [key, val] of Object.entries(data)) {
                if (!(key in query)) {
                    const valueSchema = ns.getValueSchema();
                    Object.assign(valueSchema.getMergedTraits(), {
                        ...traits,
                        httpQuery: key,
                        httpQueryParams: undefined,
                    });
                    this.serializeQuery(valueSchema, val, query);
                }
            }
            return;
        }
        if (ns.isListSchema()) {
            const sparse = !!ns.getMergedTraits().sparse;
            const buffer = [];
            for (const item of data) {
                serializer.write([ns.getValueSchema(), traits], item);
                const serializable = serializer.flush();
                if (sparse || serializable !== undefined) {
                    buffer.push(serializable);
                }
            }
            query[traits.httpQuery] = buffer;
        }
        else {
            serializer.write([ns, traits], data);
            query[traits.httpQuery] = serializer.flush();
        }
    }
    async deserializeResponse(operationSchema, context, response) {
        const deserializer = this.deserializer;
        const ns = NormalizedSchema.of(operationSchema.output);
        const dataObject = {};
        if (response.statusCode >= 300) {
            const bytes = await collectBody$1(response.body, context);
            if (bytes.byteLength > 0) {
                Object.assign(dataObject, await deserializer.read(15, bytes));
            }
            await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
            throw new Error("@smithy/core/protocols - HTTP Protocol error handler failed to throw.");
        }
        for (const header in response.headers) {
            const value = response.headers[header];
            delete response.headers[header];
            response.headers[header.toLowerCase()] = value;
        }
        const nonHttpBindingMembers = await this.deserializeHttpMessage(ns, context, response, dataObject);
        if (nonHttpBindingMembers.length) {
            const bytes = await collectBody$1(response.body, context);
            if (bytes.byteLength > 0) {
                const dataFromBody = await deserializer.read(ns, bytes);
                for (const member of nonHttpBindingMembers) {
                    if (dataFromBody[member] != null) {
                        dataObject[member] = dataFromBody[member];
                    }
                }
            }
        }
        else if (nonHttpBindingMembers.discardResponseBody) {
            await collectBody$1(response.body, context);
        }
        dataObject.$metadata = this.deserializeMetadata(response);
        return dataObject;
    }
    async deserializeHttpMessage(schema, context, response, arg4, arg5) {
        let dataObject;
        if (arg4 instanceof Set) {
            dataObject = arg5;
        }
        else {
            dataObject = arg4;
        }
        let discardResponseBody = true;
        const deserializer = this.deserializer;
        const ns = NormalizedSchema.of(schema);
        const nonHttpBindingMembers = [];
        for (const [memberName, memberSchema] of ns.structIterator()) {
            const memberTraits = memberSchema.getMemberTraits();
            if (memberTraits.httpPayload) {
                discardResponseBody = false;
                const isStreaming = memberSchema.isStreaming();
                if (isStreaming) {
                    const isEventStream = memberSchema.isStructSchema();
                    if (isEventStream) {
                        dataObject[memberName] = await this.deserializeEventStream({
                            response,
                            responseSchema: ns,
                        });
                    }
                    else {
                        dataObject[memberName] = sdkStreamMixin(response.body);
                    }
                }
                else if (response.body) {
                    const bytes = await collectBody$1(response.body, context);
                    if (bytes.byteLength > 0) {
                        dataObject[memberName] = await deserializer.read(memberSchema, bytes);
                    }
                }
            }
            else if (memberTraits.httpHeader) {
                const key = String(memberTraits.httpHeader).toLowerCase();
                const value = response.headers[key];
                if (null != value) {
                    if (memberSchema.isListSchema()) {
                        const headerListValueSchema = memberSchema.getValueSchema();
                        headerListValueSchema.getMergedTraits().httpHeader = key;
                        let sections;
                        if (headerListValueSchema.isTimestampSchema() &&
                            headerListValueSchema.getSchema() === 4) {
                            sections = splitEvery(value, ",", 2);
                        }
                        else {
                            sections = splitHeader(value);
                        }
                        const list = [];
                        for (const section of sections) {
                            list.push(await deserializer.read(headerListValueSchema, section.trim()));
                        }
                        dataObject[memberName] = list;
                    }
                    else {
                        dataObject[memberName] = await deserializer.read(memberSchema, value);
                    }
                }
            }
            else if (memberTraits.httpPrefixHeaders !== undefined) {
                dataObject[memberName] = {};
                for (const [header, value] of Object.entries(response.headers)) {
                    if (header.startsWith(memberTraits.httpPrefixHeaders)) {
                        const valueSchema = memberSchema.getValueSchema();
                        valueSchema.getMergedTraits().httpHeader = header;
                        dataObject[memberName][header.slice(memberTraits.httpPrefixHeaders.length)] = await deserializer.read(valueSchema, value);
                    }
                }
            }
            else if (memberTraits.httpResponseCode) {
                dataObject[memberName] = response.statusCode;
            }
            else {
                nonHttpBindingMembers.push(memberName);
            }
        }
        nonHttpBindingMembers.discardResponseBody = discardResponseBody;
        return nonHttpBindingMembers;
    }
}

function determineTimestampFormat(ns, settings) {
    if (settings.timestampFormat.useTrait) {
        if (ns.isTimestampSchema() &&
            (ns.getSchema() === 5 ||
                ns.getSchema() === 6 ||
                ns.getSchema() === 7)) {
            return ns.getSchema();
        }
    }
    const { httpLabel, httpPrefixHeaders, httpHeader, httpQuery } = ns.getMergedTraits();
    const bindingFormat = settings.httpBindings
        ? typeof httpPrefixHeaders === "string" || Boolean(httpHeader)
            ? 6
            : Boolean(httpQuery) || Boolean(httpLabel)
                ? 5
                : undefined
        : undefined;
    return bindingFormat ?? settings.timestampFormat.default;
}

class FromStringShapeDeserializer extends SerdeContext {
    settings;
    constructor(settings) {
        super();
        this.settings = settings;
    }
    read(_schema, data) {
        const ns = NormalizedSchema.of(_schema);
        if (ns.isListSchema()) {
            return splitHeader(data).map((item) => this.read(ns.getValueSchema(), item));
        }
        if (ns.isBlobSchema()) {
            return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
        }
        if (ns.isTimestampSchema()) {
            const format = determineTimestampFormat(ns, this.settings);
            switch (format) {
                case 5:
                    return _parseRfc3339DateTimeWithOffset(data);
                case 6:
                    return _parseRfc7231DateTime(data);
                case 7:
                    return _parseEpochTimestamp(data);
                default:
                    console.warn("Missing timestamp format, parsing value with Date constructor:", data);
                    return new Date(data);
            }
        }
        if (ns.isStringSchema()) {
            const mediaType = ns.getMergedTraits().mediaType;
            let intermediateValue = data;
            if (mediaType) {
                if (ns.getMergedTraits().httpHeader) {
                    intermediateValue = this.base64ToUtf8(intermediateValue);
                }
                const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
                if (isJson) {
                    intermediateValue = LazyJsonString.from(intermediateValue);
                }
                return intermediateValue;
            }
        }
        if (ns.isNumericSchema()) {
            return Number(data);
        }
        if (ns.isBigIntegerSchema()) {
            return BigInt(data);
        }
        if (ns.isBigDecimalSchema()) {
            return new NumericValue(data, "bigDecimal");
        }
        if (ns.isBooleanSchema()) {
            return String(data).toLowerCase() === "true";
        }
        return data;
    }
    base64ToUtf8(base64String) {
        return (this.serdeContext?.utf8Encoder ?? toUtf8)((this.serdeContext?.base64Decoder ?? fromBase64)(base64String));
    }
}

class HttpInterceptingShapeDeserializer extends SerdeContext {
    codecDeserializer;
    stringDeserializer;
    constructor(codecDeserializer, codecSettings) {
        super();
        this.codecDeserializer = codecDeserializer;
        this.stringDeserializer = new FromStringShapeDeserializer(codecSettings);
    }
    setSerdeContext(serdeContext) {
        this.stringDeserializer.setSerdeContext(serdeContext);
        this.codecDeserializer.setSerdeContext(serdeContext);
        this.serdeContext = serdeContext;
    }
    read(schema, data) {
        const ns = NormalizedSchema.of(schema);
        const traits = ns.getMergedTraits();
        const toString = this.serdeContext?.utf8Encoder ?? toUtf8;
        if (traits.httpHeader || traits.httpResponseCode) {
            return this.stringDeserializer.read(ns, toString(data));
        }
        if (traits.httpPayload) {
            if (ns.isBlobSchema()) {
                const toBytes = this.serdeContext?.utf8Decoder ?? fromUtf8$3;
                if (typeof data === "string") {
                    return toBytes(data);
                }
                return data;
            }
            else if (ns.isStringSchema()) {
                if ("byteLength" in data) {
                    return toString(data);
                }
                return data;
            }
        }
        return this.codecDeserializer.read(ns, data);
    }
}

class ToStringShapeSerializer extends SerdeContext {
    settings;
    stringBuffer = "";
    constructor(settings) {
        super();
        this.settings = settings;
    }
    write(schema, value) {
        const ns = NormalizedSchema.of(schema);
        switch (typeof value) {
            case "object":
                if (value === null) {
                    this.stringBuffer = "null";
                    return;
                }
                if (ns.isTimestampSchema()) {
                    if (!(value instanceof Date)) {
                        throw new Error(`@smithy/core/protocols - received non-Date value ${value} when schema expected Date in ${ns.getName(true)}`);
                    }
                    const format = determineTimestampFormat(ns, this.settings);
                    switch (format) {
                        case 5:
                            this.stringBuffer = value.toISOString().replace(".000Z", "Z");
                            break;
                        case 6:
                            this.stringBuffer = dateToUtcString(value);
                            break;
                        case 7:
                            this.stringBuffer = String(value.getTime() / 1000);
                            break;
                        default:
                            console.warn("Missing timestamp format, using epoch seconds", value);
                            this.stringBuffer = String(value.getTime() / 1000);
                    }
                    return;
                }
                if (ns.isBlobSchema() && "byteLength" in value) {
                    this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value);
                    return;
                }
                if (ns.isListSchema() && Array.isArray(value)) {
                    let buffer = "";
                    for (const item of value) {
                        this.write([ns.getValueSchema(), ns.getMergedTraits()], item);
                        const headerItem = this.flush();
                        const serialized = ns.getValueSchema().isTimestampSchema() ? headerItem : quoteHeader(headerItem);
                        if (buffer !== "") {
                            buffer += ", ";
                        }
                        buffer += serialized;
                    }
                    this.stringBuffer = buffer;
                    return;
                }
                this.stringBuffer = JSON.stringify(value, null, 2);
                break;
            case "string":
                const mediaType = ns.getMergedTraits().mediaType;
                let intermediateValue = value;
                if (mediaType) {
                    const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
                    if (isJson) {
                        intermediateValue = LazyJsonString.from(intermediateValue);
                    }
                    if (ns.getMergedTraits().httpHeader) {
                        this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(intermediateValue.toString());
                        return;
                    }
                }
                this.stringBuffer = value;
                break;
            default:
                if (ns.isIdempotencyToken()) {
                    this.stringBuffer = v4();
                }
                else {
                    this.stringBuffer = String(value);
                }
        }
    }
    flush() {
        const buffer = this.stringBuffer;
        this.stringBuffer = "";
        return buffer;
    }
}

class HttpInterceptingShapeSerializer {
    codecSerializer;
    stringSerializer;
    buffer;
    constructor(codecSerializer, codecSettings, stringSerializer = new ToStringShapeSerializer(codecSettings)) {
        this.codecSerializer = codecSerializer;
        this.stringSerializer = stringSerializer;
    }
    setSerdeContext(serdeContext) {
        this.codecSerializer.setSerdeContext(serdeContext);
        this.stringSerializer.setSerdeContext(serdeContext);
    }
    write(schema, value) {
        const ns = NormalizedSchema.of(schema);
        const traits = ns.getMergedTraits();
        if (traits.httpHeader || traits.httpLabel || traits.httpQuery) {
            this.stringSerializer.write(ns, value);
            this.buffer = this.stringSerializer.flush();
            return;
        }
        return this.codecSerializer.write(ns, value);
    }
    flush() {
        if (this.buffer !== undefined) {
            const buffer = this.buffer;
            this.buffer = undefined;
            return buffer;
        }
        return this.codecSerializer.flush();
    }
}

function setFeature(context, feature, value) {
    if (!context.__smithy_context) {
        context.__smithy_context = {
            features: {},
        };
    }
    else if (!context.__smithy_context.features) {
        context.__smithy_context.features = {};
    }
    context.__smithy_context.features[feature] = value;
}

class DefaultIdentityProviderConfig {
    authSchemes = new Map();
    constructor(config) {
        for (const [key, value] of Object.entries(config)) {
            if (value !== undefined) {
                this.authSchemes.set(key, value);
            }
        }
    }
    getIdentityProvider(schemeId) {
        return this.authSchemes.get(schemeId);
    }
}

const createIsIdentityExpiredFunction = (expirationMs) => function isIdentityExpired(identity) {
    return doesIdentityRequireRefresh(identity) && identity.expiration.getTime() - Date.now() < expirationMs;
};
const EXPIRATION_MS = 300_000;
const isIdentityExpired = createIsIdentityExpiredFunction(EXPIRATION_MS);
const doesIdentityRequireRefresh = (identity) => identity.expiration !== undefined;
const memoizeIdentityProvider = (provider, isExpired, requiresRefresh) => {
    if (provider === undefined) {
        return undefined;
    }
    const normalizedProvider = typeof provider !== "function" ? async () => Promise.resolve(provider) : provider;
    let resolved;
    let pending;
    let hasResult;
    let isConstant = false;
    const coalesceProvider = async (options) => {
        if (!pending) {
            pending = normalizedProvider(options);
        }
        try {
            resolved = await pending;
            hasResult = true;
            isConstant = false;
        }
        finally {
            pending = undefined;
        }
        return resolved;
    };
    if (isExpired === undefined) {
        return async (options) => {
            if (!hasResult || options?.forceRefresh) {
                resolved = await coalesceProvider(options);
            }
            return resolved;
        };
    }
    return async (options) => {
        if (!hasResult || options?.forceRefresh) {
            resolved = await coalesceProvider(options);
        }
        if (isConstant) {
            return resolved;
        }
        if (!requiresRefresh(resolved)) {
            isConstant = true;
            return resolved;
        }
        if (isExpired(resolved)) {
            await coalesceProvider(options);
            return resolved;
        }
        return resolved;
    };
};

const memoize = (provider, isExpired, requiresRefresh) => {
    let resolved;
    let pending;
    let hasResult;
    let isConstant = false;
    const coalesceProvider = async () => {
        if (!pending) {
            pending = provider();
        }
        try {
            resolved = await pending;
            hasResult = true;
            isConstant = false;
        }
        finally {
            pending = undefined;
        }
        return resolved;
    };
    {
        return async (options) => {
            if (!hasResult || options?.forceRefresh) {
                resolved = await coalesceProvider();
            }
            return resolved;
        };
    }
};

const resolveAwsSdkSigV4AConfig = (config) => {
    config.sigv4aSigningRegionSet = normalizeProvider(config.sigv4aSigningRegionSet);
    return config;
};

const resolveAwsSdkSigV4Config = (config) => {
    let inputCredentials = config.credentials;
    let isUserSupplied = !!config.credentials;
    let resolvedCredentials = undefined;
    Object.defineProperty(config, "credentials", {
        set(credentials) {
            if (credentials && credentials !== inputCredentials && credentials !== resolvedCredentials) {
                isUserSupplied = true;
            }
            inputCredentials = credentials;
            const memoizedProvider = normalizeCredentialProvider(config, {
                credentials: inputCredentials,
                credentialDefaultProvider: config.credentialDefaultProvider,
            });
            const boundProvider = bindCallerConfig(config, memoizedProvider);
            if (isUserSupplied && !boundProvider.attributed) {
                const isCredentialObject = typeof inputCredentials === "object" && inputCredentials !== null;
                resolvedCredentials = async (options) => {
                    const creds = await boundProvider(options);
                    const attributedCreds = creds;
                    if (isCredentialObject && (!attributedCreds.$source || Object.keys(attributedCreds.$source).length === 0)) {
                        return setCredentialFeature(attributedCreds, "CREDENTIALS_CODE", "e");
                    }
                    return attributedCreds;
                };
                resolvedCredentials.memoized = boundProvider.memoized;
                resolvedCredentials.configBound = boundProvider.configBound;
                resolvedCredentials.attributed = true;
            }
            else {
                resolvedCredentials = boundProvider;
            }
        },
        get() {
            return resolvedCredentials;
        },
        enumerable: true,
        configurable: true,
    });
    config.credentials = inputCredentials;
    const { signingEscapePath = true, systemClockOffset = config.systemClockOffset || 0, sha256, } = config;
    let signer;
    if (config.signer) {
        signer = normalizeProvider(config.signer);
    }
    else if (config.regionInfoProvider) {
        signer = () => normalizeProvider(config.region)()
            .then(async (region) => [
            (await config.regionInfoProvider(region, {
                useFipsEndpoint: await config.useFipsEndpoint(),
                useDualstackEndpoint: await config.useDualstackEndpoint(),
            })) || {},
            region,
        ])
            .then(([regionInfo, region]) => {
            const { signingRegion, signingService } = regionInfo;
            config.signingRegion = config.signingRegion || signingRegion || region;
            config.signingName = config.signingName || signingService || config.serviceId;
            const params = {
                ...config,
                credentials: config.credentials,
                region: config.signingRegion,
                service: config.signingName,
                sha256,
                uriEscapePath: signingEscapePath,
            };
            const SignerCtor = config.signerConstructor || SignatureV4;
            return new SignerCtor(params);
        });
    }
    else {
        signer = async (authScheme) => {
            authScheme = Object.assign({}, {
                name: "sigv4",
                signingName: config.signingName || config.defaultSigningName,
                signingRegion: await normalizeProvider(config.region)(),
                properties: {},
            }, authScheme);
            const signingRegion = authScheme.signingRegion;
            const signingService = authScheme.signingName;
            config.signingRegion = config.signingRegion || signingRegion;
            config.signingName = config.signingName || signingService || config.serviceId;
            const params = {
                ...config,
                credentials: config.credentials,
                region: config.signingRegion,
                service: config.signingName,
                sha256,
                uriEscapePath: signingEscapePath,
            };
            const SignerCtor = config.signerConstructor || SignatureV4;
            return new SignerCtor(params);
        };
    }
    const resolvedConfig = Object.assign(config, {
        systemClockOffset,
        signingEscapePath,
        signer,
    });
    return resolvedConfig;
};
function normalizeCredentialProvider(config, { credentials, credentialDefaultProvider, }) {
    let credentialsProvider;
    if (credentials) {
        if (!credentials?.memoized) {
            credentialsProvider = memoizeIdentityProvider(credentials, isIdentityExpired, doesIdentityRequireRefresh);
        }
        else {
            credentialsProvider = credentials;
        }
    }
    else {
        if (credentialDefaultProvider) {
            credentialsProvider = normalizeProvider(credentialDefaultProvider(Object.assign({}, config, {
                parentClientConfig: config,
            })));
        }
        else {
            credentialsProvider = async () => {
                throw new Error("@aws-sdk/core::resolveAwsSdkSigV4Config - `credentials` not provided and no credentialDefaultProvider was configured.");
            };
        }
    }
    credentialsProvider.memoized = true;
    return credentialsProvider;
}
function bindCallerConfig(config, credentialsProvider) {
    if (credentialsProvider.configBound) {
        return credentialsProvider;
    }
    const fn = async (options) => credentialsProvider({ ...options, callerClientConfig: config });
    fn.memoized = credentialsProvider.memoized;
    fn.configBound = true;
    return fn;
}

const TEXT_ENCODER = typeof TextEncoder == "function" ? new TextEncoder() : null;
const calculateBodyLength = (body) => {
    if (typeof body === "string") {
        if (TEXT_ENCODER) {
            return TEXT_ENCODER.encode(body).byteLength;
        }
        let len = body.length;
        for (let i = len - 1; i >= 0; i--) {
            const code = body.charCodeAt(i);
            if (code > 0x7f && code <= 0x7ff)
                len++;
            else if (code > 0x7ff && code <= 0xffff)
                len += 2;
            if (code >= 0xdc00 && code <= 0xdfff)
                i--;
        }
        return len;
    }
    else if (typeof body.byteLength === "number") {
        return body.byteLength;
    }
    else if (typeof body.size === "number") {
        return body.size;
    }
    throw new Error(`Body Length computation failed for ${body}`);
};

const getAllAliases = (name, aliases) => {
    const _aliases = [];
    if (name) {
        _aliases.push(name);
    }
    if (aliases) {
        for (const alias of aliases) {
            _aliases.push(alias);
        }
    }
    return _aliases;
};
const getMiddlewareNameWithAliases = (name, aliases) => {
    return `${name || "anonymous"}${aliases && aliases.length > 0 ? ` (a.k.a. ${aliases.join(",")})` : ""}`;
};
const constructStack = () => {
    let absoluteEntries = [];
    let relativeEntries = [];
    let identifyOnResolve = false;
    const entriesNameSet = new Set();
    const sort = (entries) => entries.sort((a, b) => stepWeights[b.step] - stepWeights[a.step] ||
        priorityWeights[b.priority || "normal"] - priorityWeights[a.priority || "normal"]);
    const removeByName = (toRemove) => {
        let isRemoved = false;
        const filterCb = (entry) => {
            const aliases = getAllAliases(entry.name, entry.aliases);
            if (aliases.includes(toRemove)) {
                isRemoved = true;
                for (const alias of aliases) {
                    entriesNameSet.delete(alias);
                }
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    const removeByReference = (toRemove) => {
        let isRemoved = false;
        const filterCb = (entry) => {
            if (entry.middleware === toRemove) {
                isRemoved = true;
                for (const alias of getAllAliases(entry.name, entry.aliases)) {
                    entriesNameSet.delete(alias);
                }
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    const cloneTo = (toStack) => {
        absoluteEntries.forEach((entry) => {
            toStack.add(entry.middleware, { ...entry });
        });
        relativeEntries.forEach((entry) => {
            toStack.addRelativeTo(entry.middleware, { ...entry });
        });
        toStack.identifyOnResolve?.(stack.identifyOnResolve());
        return toStack;
    };
    const expandRelativeMiddlewareList = (from) => {
        const expandedMiddlewareList = [];
        from.before.forEach((entry) => {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
            }
        });
        expandedMiddlewareList.push(from);
        from.after.reverse().forEach((entry) => {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
            }
        });
        return expandedMiddlewareList;
    };
    const getMiddlewareList = (debug = false) => {
        const normalizedAbsoluteEntries = [];
        const normalizedRelativeEntries = [];
        const normalizedEntriesNameMap = {};
        absoluteEntries.forEach((entry) => {
            const normalizedEntry = {
                ...entry,
                before: [],
                after: [],
            };
            for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
                normalizedEntriesNameMap[alias] = normalizedEntry;
            }
            normalizedAbsoluteEntries.push(normalizedEntry);
        });
        relativeEntries.forEach((entry) => {
            const normalizedEntry = {
                ...entry,
                before: [],
                after: [],
            };
            for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
                normalizedEntriesNameMap[alias] = normalizedEntry;
            }
            normalizedRelativeEntries.push(normalizedEntry);
        });
        normalizedRelativeEntries.forEach((entry) => {
            if (entry.toMiddleware) {
                const toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
                if (toMiddleware === undefined) {
                    if (debug) {
                        return;
                    }
                    throw new Error(`${entry.toMiddleware} is not found when adding ` +
                        `${getMiddlewareNameWithAliases(entry.name, entry.aliases)} ` +
                        `middleware ${entry.relation} ${entry.toMiddleware}`);
                }
                if (entry.relation === "after") {
                    toMiddleware.after.push(entry);
                }
                if (entry.relation === "before") {
                    toMiddleware.before.push(entry);
                }
            }
        });
        const mainChain = sort(normalizedAbsoluteEntries)
            .map(expandRelativeMiddlewareList)
            .reduce((wholeList, expandedMiddlewareList) => {
            wholeList.push(...expandedMiddlewareList);
            return wholeList;
        }, []);
        return mainChain;
    };
    const stack = {
        add: (middleware, options = {}) => {
            const { name, override, aliases: _aliases } = options;
            const entry = {
                step: "initialize",
                priority: "normal",
                middleware,
                ...options,
            };
            const aliases = getAllAliases(name, _aliases);
            if (aliases.length > 0) {
                if (aliases.some((alias) => entriesNameSet.has(alias))) {
                    if (!override)
                        throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
                    for (const alias of aliases) {
                        const toOverrideIndex = absoluteEntries.findIndex((entry) => entry.name === alias || entry.aliases?.some((a) => a === alias));
                        if (toOverrideIndex === -1) {
                            continue;
                        }
                        const toOverride = absoluteEntries[toOverrideIndex];
                        if (toOverride.step !== entry.step || entry.priority !== toOverride.priority) {
                            throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware with ` +
                                `${toOverride.priority} priority in ${toOverride.step} step cannot ` +
                                `be overridden by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware with ` +
                                `${entry.priority} priority in ${entry.step} step.`);
                        }
                        absoluteEntries.splice(toOverrideIndex, 1);
                    }
                }
                for (const alias of aliases) {
                    entriesNameSet.add(alias);
                }
            }
            absoluteEntries.push(entry);
        },
        addRelativeTo: (middleware, options) => {
            const { name, override, aliases: _aliases } = options;
            const entry = {
                middleware,
                ...options,
            };
            const aliases = getAllAliases(name, _aliases);
            if (aliases.length > 0) {
                if (aliases.some((alias) => entriesNameSet.has(alias))) {
                    if (!override)
                        throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
                    for (const alias of aliases) {
                        const toOverrideIndex = relativeEntries.findIndex((entry) => entry.name === alias || entry.aliases?.some((a) => a === alias));
                        if (toOverrideIndex === -1) {
                            continue;
                        }
                        const toOverride = relativeEntries[toOverrideIndex];
                        if (toOverride.toMiddleware !== entry.toMiddleware || toOverride.relation !== entry.relation) {
                            throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware ` +
                                `${toOverride.relation} "${toOverride.toMiddleware}" middleware cannot be overridden ` +
                                `by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware ${entry.relation} ` +
                                `"${entry.toMiddleware}" middleware.`);
                        }
                        relativeEntries.splice(toOverrideIndex, 1);
                    }
                }
                for (const alias of aliases) {
                    entriesNameSet.add(alias);
                }
            }
            relativeEntries.push(entry);
        },
        clone: () => cloneTo(constructStack()),
        use: (plugin) => {
            plugin.applyToStack(stack);
        },
        remove: (toRemove) => {
            if (typeof toRemove === "string")
                return removeByName(toRemove);
            else
                return removeByReference(toRemove);
        },
        removeByTag: (toRemove) => {
            let isRemoved = false;
            const filterCb = (entry) => {
                const { tags, name, aliases: _aliases } = entry;
                if (tags && tags.includes(toRemove)) {
                    const aliases = getAllAliases(name, _aliases);
                    for (const alias of aliases) {
                        entriesNameSet.delete(alias);
                    }
                    isRemoved = true;
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        },
        concat: (from) => {
            const cloned = cloneTo(constructStack());
            cloned.use(from);
            cloned.identifyOnResolve(identifyOnResolve || cloned.identifyOnResolve() || (from.identifyOnResolve?.() ?? false));
            return cloned;
        },
        applyToStack: cloneTo,
        identify: () => {
            return getMiddlewareList(true).map((mw) => {
                const step = mw.step ??
                    mw.relation +
                        " " +
                        mw.toMiddleware;
                return getMiddlewareNameWithAliases(mw.name, mw.aliases) + " - " + step;
            });
        },
        identifyOnResolve(toggle) {
            if (typeof toggle === "boolean")
                identifyOnResolve = toggle;
            return identifyOnResolve;
        },
        resolve: (handler, context) => {
            for (const middleware of getMiddlewareList()
                .map((entry) => entry.middleware)
                .reverse()) {
                handler = middleware(handler, context);
            }
            if (identifyOnResolve) {
                console.log(stack.identify());
            }
            return handler;
        },
    };
    return stack;
};
const stepWeights = {
    initialize: 5,
    serialize: 4,
    build: 3,
    finalizeRequest: 2,
    deserialize: 1,
};
const priorityWeights = {
    high: 3,
    normal: 2,
    low: 1,
};

class Client {
    config;
    middlewareStack = constructStack();
    initConfig;
    handlers;
    constructor(config) {
        this.config = config;
        const { protocol, protocolSettings } = config;
        if (protocolSettings) {
            if (typeof protocol === "function") {
                config.protocol = new protocol(protocolSettings);
            }
        }
    }
    send(command, optionsOrCb, cb) {
        const options = typeof optionsOrCb !== "function" ? optionsOrCb : undefined;
        const callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
        const useHandlerCache = options === undefined && this.config.cacheMiddleware === true;
        let handler;
        if (useHandlerCache) {
            if (!this.handlers) {
                this.handlers = new WeakMap();
            }
            const handlers = this.handlers;
            if (handlers.has(command.constructor)) {
                handler = handlers.get(command.constructor);
            }
            else {
                handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
                handlers.set(command.constructor, handler);
            }
        }
        else {
            delete this.handlers;
            handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
        }
        if (callback) {
            handler(command)
                .then((result) => callback(null, result.output), (err) => callback(err))
                .catch(() => { });
        }
        else {
            return handler(command).then((result) => result.output);
        }
    }
    destroy() {
        this.config?.requestHandler?.destroy?.();
        delete this.handlers;
    }
}

const SENSITIVE_STRING = "***SensitiveInformation***";
function schemaLogFilter(schema, data) {
    if (data == null) {
        return data;
    }
    const ns = NormalizedSchema.of(schema);
    if (ns.getMergedTraits().sensitive) {
        return SENSITIVE_STRING;
    }
    if (ns.isListSchema()) {
        const isSensitive = !!ns.getValueSchema().getMergedTraits().sensitive;
        if (isSensitive) {
            return SENSITIVE_STRING;
        }
    }
    else if (ns.isMapSchema()) {
        const isSensitive = !!ns.getKeySchema().getMergedTraits().sensitive || !!ns.getValueSchema().getMergedTraits().sensitive;
        if (isSensitive) {
            return SENSITIVE_STRING;
        }
    }
    else if (ns.isStructSchema() && typeof data === "object") {
        const object = data;
        const newObject = {};
        for (const [member, memberNs] of ns.structIterator()) {
            if (object[member] != null) {
                newObject[member] = schemaLogFilter(memberNs, object[member]);
            }
        }
        return newObject;
    }
    return data;
}

class Command {
    middlewareStack = constructStack();
    schema;
    static classBuilder() {
        return new ClassBuilder();
    }
    resolveMiddlewareWithContext(clientStack, configuration, options, { middlewareFn, clientName, commandName, inputFilterSensitiveLog, outputFilterSensitiveLog, smithyContext, additionalContext, CommandCtor, }) {
        for (const mw of middlewareFn.bind(this)(CommandCtor, clientStack, configuration, options)) {
            this.middlewareStack.use(mw);
        }
        const stack = clientStack.concat(this.middlewareStack);
        const { logger } = configuration;
        const handlerExecutionContext = {
            logger,
            clientName,
            commandName,
            inputFilterSensitiveLog,
            outputFilterSensitiveLog,
            [SMITHY_CONTEXT_KEY]: {
                commandInstance: this,
                ...smithyContext,
            },
            ...additionalContext,
        };
        const { requestHandler } = configuration;
        return stack.resolve((request) => requestHandler.handle(request.request, options || {}), handlerExecutionContext);
    }
}
class ClassBuilder {
    _init = () => { };
    _ep = {};
    _middlewareFn = () => [];
    _commandName = "";
    _clientName = "";
    _additionalContext = {};
    _smithyContext = {};
    _inputFilterSensitiveLog = undefined;
    _outputFilterSensitiveLog = undefined;
    _serializer = null;
    _deserializer = null;
    _operationSchema;
    init(cb) {
        this._init = cb;
    }
    ep(endpointParameterInstructions) {
        this._ep = endpointParameterInstructions;
        return this;
    }
    m(middlewareSupplier) {
        this._middlewareFn = middlewareSupplier;
        return this;
    }
    s(service, operation, smithyContext = {}) {
        this._smithyContext = {
            service,
            operation,
            ...smithyContext,
        };
        return this;
    }
    c(additionalContext = {}) {
        this._additionalContext = additionalContext;
        return this;
    }
    n(clientName, commandName) {
        this._clientName = clientName;
        this._commandName = commandName;
        return this;
    }
    f(inputFilter = (_) => _, outputFilter = (_) => _) {
        this._inputFilterSensitiveLog = inputFilter;
        this._outputFilterSensitiveLog = outputFilter;
        return this;
    }
    ser(serializer) {
        this._serializer = serializer;
        return this;
    }
    de(deserializer) {
        this._deserializer = deserializer;
        return this;
    }
    sc(operation) {
        this._operationSchema = operation;
        this._smithyContext.operationSchema = operation;
        return this;
    }
    build() {
        const closure = this;
        let CommandRef;
        return (CommandRef = class extends Command {
            input;
            static getEndpointParameterInstructions() {
                return closure._ep;
            }
            constructor(...[input]) {
                super();
                this.input = input ?? {};
                closure._init(this);
                this.schema = closure._operationSchema;
            }
            resolveMiddleware(stack, configuration, options) {
                const op = closure._operationSchema;
                const input = op?.[4] ?? op?.input;
                const output = op?.[5] ?? op?.output;
                return this.resolveMiddlewareWithContext(stack, configuration, options, {
                    CommandCtor: CommandRef,
                    middlewareFn: closure._middlewareFn,
                    clientName: closure._clientName,
                    commandName: closure._commandName,
                    inputFilterSensitiveLog: closure._inputFilterSensitiveLog ?? (op ? schemaLogFilter.bind(null, input) : (_) => _),
                    outputFilterSensitiveLog: closure._outputFilterSensitiveLog ?? (op ? schemaLogFilter.bind(null, output) : (_) => _),
                    smithyContext: closure._smithyContext,
                    additionalContext: closure._additionalContext,
                });
            }
            serialize = closure._serializer;
            deserialize = closure._deserializer;
        });
    }
}

const createAggregatedClient = (commands, Client, options) => {
    for (const [command, CommandCtor] of Object.entries(commands)) {
        const methodImpl = async function (args, optionsOrCb, cb) {
            const command = new CommandCtor(args);
            if (typeof optionsOrCb === "function") {
                this.send(command, optionsOrCb);
            }
            else if (typeof cb === "function") {
                if (typeof optionsOrCb !== "object")
                    throw new Error(`Expected http options but got ${typeof optionsOrCb}`);
                this.send(command, optionsOrCb || {}, cb);
            }
            else {
                return this.send(command, optionsOrCb);
            }
        };
        const methodName = (command[0].toLowerCase() + command.slice(1)).replace(/Command$/, "");
        Client.prototype[methodName] = methodImpl;
    }
    const { paginators = {}, waiters = {} } = options ?? {};
    for (const [paginatorName, paginatorFn] of Object.entries(paginators)) {
        if (Client.prototype[paginatorName] === void 0) {
            Client.prototype[paginatorName] = function (commandInput = {}, paginationConfiguration, ...rest) {
                return paginatorFn({
                    ...paginationConfiguration,
                    client: this,
                }, commandInput, ...rest);
            };
        }
    }
    for (const [waiterName, waiterFn] of Object.entries(waiters)) {
        if (Client.prototype[waiterName] === void 0) {
            Client.prototype[waiterName] = async function (commandInput = {}, waiterConfiguration, ...rest) {
                let config = waiterConfiguration;
                if (typeof waiterConfiguration === "number") {
                    config = {
                        maxWaitTime: waiterConfiguration,
                    };
                }
                return waiterFn({
                    ...config,
                    client: this,
                }, commandInput, ...rest);
            };
        }
    }
};

class ServiceException extends Error {
    $fault;
    $response;
    $retryable;
    $metadata;
    constructor(options) {
        super(options.message);
        Object.setPrototypeOf(this, Object.getPrototypeOf(this).constructor.prototype);
        this.name = options.name;
        this.$fault = options.$fault;
        this.$metadata = options.$metadata;
    }
    static isInstance(value) {
        if (!value)
            return false;
        const candidate = value;
        return (ServiceException.prototype.isPrototypeOf(candidate) ||
            (Boolean(candidate.$fault) &&
                Boolean(candidate.$metadata) &&
                (candidate.$fault === "client" || candidate.$fault === "server")));
    }
    static [Symbol.hasInstance](instance) {
        if (!instance)
            return false;
        const candidate = instance;
        if (this === ServiceException) {
            return ServiceException.isInstance(instance);
        }
        if (ServiceException.isInstance(instance)) {
            if (candidate.name && this.name) {
                return this.prototype.isPrototypeOf(instance) || candidate.name === this.name;
            }
            return this.prototype.isPrototypeOf(instance);
        }
        return false;
    }
}
const decorateServiceException = (exception, additions = {}) => {
    Object.entries(additions)
        .filter(([, v]) => v !== undefined)
        .forEach(([k, v]) => {
        if (exception[k] == undefined || exception[k] === "") {
            exception[k] = v;
        }
    });
    const message = exception.message || exception.Message || "UnknownError";
    exception.message = message;
    delete exception.Message;
    return exception;
};

const loadConfigsForDefaultMode = (mode) => {
    switch (mode) {
        case "standard":
            return {
                retryMode: "standard",
                connectionTimeout: 3100,
            };
        case "in-region":
            return {
                retryMode: "standard",
                connectionTimeout: 1100,
            };
        case "cross-region":
            return {
                retryMode: "standard",
                connectionTimeout: 3100,
            };
        case "mobile":
            return {
                retryMode: "standard",
                connectionTimeout: 30000,
            };
        default:
            return {};
    }
};

const knownAlgorithms = Object.values(AlgorithmId);
const getChecksumConfiguration = (runtimeConfig) => {
    const checksumAlgorithms = [];
    for (const id in AlgorithmId) {
        const algorithmId = AlgorithmId[id];
        if (runtimeConfig[algorithmId] === undefined) {
            continue;
        }
        checksumAlgorithms.push({
            algorithmId: () => algorithmId,
            checksumConstructor: () => runtimeConfig[algorithmId],
        });
    }
    for (const [id, ChecksumCtor] of Object.entries(runtimeConfig.checksumAlgorithms ?? {})) {
        checksumAlgorithms.push({
            algorithmId: () => id,
            checksumConstructor: () => ChecksumCtor,
        });
    }
    return {
        addChecksumAlgorithm(algo) {
            runtimeConfig.checksumAlgorithms = runtimeConfig.checksumAlgorithms ?? {};
            const id = algo.algorithmId();
            const ctor = algo.checksumConstructor();
            if (knownAlgorithms.includes(id)) {
                runtimeConfig.checksumAlgorithms[id.toUpperCase()] = ctor;
            }
            else {
                runtimeConfig.checksumAlgorithms[id] = ctor;
            }
            checksumAlgorithms.push(algo);
        },
        checksumAlgorithms() {
            return checksumAlgorithms;
        },
    };
};
const resolveChecksumRuntimeConfig = (clientConfig) => {
    const runtimeConfig = {};
    clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
        const id = checksumAlgorithm.algorithmId();
        if (knownAlgorithms.includes(id)) {
            runtimeConfig[id] = checksumAlgorithm.checksumConstructor();
        }
    });
    return runtimeConfig;
};

const getRetryConfiguration = (runtimeConfig) => {
    return {
        setRetryStrategy(retryStrategy) {
            runtimeConfig.retryStrategy = retryStrategy;
        },
        retryStrategy() {
            return runtimeConfig.retryStrategy;
        },
    };
};
const resolveRetryRuntimeConfig = (retryStrategyConfiguration) => {
    const runtimeConfig = {};
    runtimeConfig.retryStrategy = retryStrategyConfiguration.retryStrategy();
    return runtimeConfig;
};

const getDefaultExtensionConfiguration = (runtimeConfig) => {
    return Object.assign(getChecksumConfiguration(runtimeConfig), getRetryConfiguration(runtimeConfig));
};
const resolveDefaultRuntimeConfig = (config) => {
    return Object.assign(resolveChecksumRuntimeConfig(config), resolveRetryRuntimeConfig(config));
};

const getValueFromTextNode = (obj) => {
    const textNodeName = "#text";
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key][textNodeName] !== undefined) {
            obj[key] = obj[key][textNodeName];
        }
        else if (typeof obj[key] === "object" && obj[key] !== null) {
            obj[key] = getValueFromTextNode(obj[key]);
        }
    }
    return obj;
};

class NoOpLogger {
    trace() { }
    debug() { }
    info() { }
    warn() { }
    error() { }
}

class ProtocolLib {
    queryCompat;
    errorRegistry;
    constructor(queryCompat = false) {
        this.queryCompat = queryCompat;
    }
    resolveRestContentType(defaultContentType, inputSchema) {
        const members = inputSchema.getMemberSchemas();
        const httpPayloadMember = Object.values(members).find((m) => {
            return !!m.getMergedTraits().httpPayload;
        });
        if (httpPayloadMember) {
            const mediaType = httpPayloadMember.getMergedTraits().mediaType;
            if (mediaType) {
                return mediaType;
            }
            else if (httpPayloadMember.isStringSchema()) {
                return "text/plain";
            }
            else if (httpPayloadMember.isBlobSchema()) {
                return "application/octet-stream";
            }
            else {
                return defaultContentType;
            }
        }
        else if (!inputSchema.isUnitSchema()) {
            const hasBody = Object.values(members).find((m) => {
                const { httpQuery, httpQueryParams, httpHeader, httpLabel, httpPrefixHeaders } = m.getMergedTraits();
                const noPrefixHeaders = httpPrefixHeaders === void 0;
                return !httpQuery && !httpQueryParams && !httpHeader && !httpLabel && noPrefixHeaders;
            });
            if (hasBody) {
                return defaultContentType;
            }
        }
    }
    async getErrorSchemaOrThrowBaseException(errorIdentifier, defaultNamespace, response, dataObject, metadata, getErrorSchema) {
        let errorName = errorIdentifier;
        if (errorIdentifier.includes("#")) {
            [, errorName] = errorIdentifier.split("#");
        }
        const errorMetadata = {
            $metadata: metadata,
            $fault: response.statusCode < 500 ? "client" : "server",
        };
        if (!this.errorRegistry) {
            throw new Error("@aws-sdk/core/protocols - error handler not initialized.");
        }
        try {
            const errorSchema = getErrorSchema?.(this.errorRegistry, errorName) ??
                this.errorRegistry.getSchema(errorIdentifier);
            return { errorSchema, errorMetadata };
        }
        catch (e) {
            dataObject.message = dataObject.message ?? dataObject.Message ?? "UnknownError";
            const synthetic = this.errorRegistry;
            const baseExceptionSchema = synthetic.getBaseException();
            if (baseExceptionSchema) {
                const ErrorCtor = synthetic.getErrorCtor(baseExceptionSchema) ?? Error;
                throw this.decorateServiceException(Object.assign(new ErrorCtor({ name: errorName }), errorMetadata), dataObject);
            }
            const d = dataObject;
            const message = d?.message ?? d?.Message ?? d?.Error?.Message ?? d?.Error?.message;
            throw this.decorateServiceException(Object.assign(new Error(message), {
                name: errorName,
            }, errorMetadata), dataObject);
        }
    }
    compose(composite, errorIdentifier, defaultNamespace) {
        let namespace = defaultNamespace;
        if (errorIdentifier.includes("#")) {
            [namespace] = errorIdentifier.split("#");
        }
        const staticRegistry = TypeRegistry.for(namespace);
        const defaultSyntheticRegistry = TypeRegistry.for("smithy.ts.sdk.synthetic." + defaultNamespace);
        composite.copyFrom(staticRegistry);
        composite.copyFrom(defaultSyntheticRegistry);
        this.errorRegistry = composite;
    }
    decorateServiceException(exception, additions = {}) {
        if (this.queryCompat) {
            const msg = exception.Message ?? additions.Message;
            const error = decorateServiceException(exception, additions);
            if (msg) {
                error.message = msg;
            }
            error.Error = {
                ...error.Error,
                Type: error.Error?.Type,
                Code: error.Error?.Code,
                Message: error.Error?.message ?? error.Error?.Message ?? msg,
            };
            const reqId = error.$metadata.requestId;
            if (reqId) {
                error.RequestId = reqId;
            }
            return error;
        }
        return decorateServiceException(exception, additions);
    }
    setQueryCompatError(output, response) {
        const queryErrorHeader = response.headers?.["x-amzn-query-error"];
        if (output !== undefined && queryErrorHeader != null) {
            const [Code, Type] = queryErrorHeader.split(";");
            const entries = Object.entries(output);
            const Error = {
                Code,
                Type,
            };
            Object.assign(output, Error);
            for (const [k, v] of entries) {
                Error[k === "message" ? "Message" : k] = v;
            }
            delete Error.__type;
            output.Error = Error;
        }
    }
    queryCompatOutput(queryCompatErrorData, errorData) {
        if (queryCompatErrorData.Error) {
            errorData.Error = queryCompatErrorData.Error;
        }
        if (queryCompatErrorData.Type) {
            errorData.Type = queryCompatErrorData.Type;
        }
        if (queryCompatErrorData.Code) {
            errorData.Code = queryCompatErrorData.Code;
        }
    }
    findQueryCompatibleError(registry, errorName) {
        try {
            return registry.getSchema(errorName);
        }
        catch (e) {
            return registry.find((schema) => NormalizedSchema.of(schema).getMergedTraits().awsQueryError?.[0] === errorName);
        }
    }
}

class SerdeContextConfig {
    serdeContext;
    setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
    }
}

class UnionSerde {
    from;
    to;
    keys;
    constructor(from, to) {
        this.from = from;
        this.to = to;
        this.keys = new Set(Object.keys(this.from).filter((k) => k !== "__type"));
    }
    mark(key) {
        this.keys.delete(key);
    }
    hasUnknown() {
        return this.keys.size === 1 && Object.keys(this.to).length === 0;
    }
    writeUnknown() {
        if (this.hasUnknown()) {
            const k = this.keys.values().next().value;
            const v = this.from[k];
            this.to.$unknown = [k, v];
        }
    }
}

const ATTR_ESCAPE_RE = /[&<>"]/g;
const ATTR_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
};
function escapeAttribute(value) {
    return value.replace(ATTR_ESCAPE_RE, (ch) => ATTR_ESCAPE_MAP[ch]);
}

const ELEMENT_ESCAPE_RE = /[&"'<>\r\n\u0085\u2028]/g;
const ELEMENT_ESCAPE_MAP = {
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;",
    "\r": "&#x0D;",
    "\n": "&#x0A;",
    "\u0085": "&#x85;",
    "\u2028": "&#x2028;",
};
function escapeElement(value) {
    return value.replace(ELEMENT_ESCAPE_RE, (ch) => ELEMENT_ESCAPE_MAP[ch]);
}

class XmlText {
    value;
    constructor(value) {
        this.value = value;
    }
    toString() {
        return escapeElement("" + this.value);
    }
}

class XmlNode {
    name;
    children;
    attributes = {};
    static of(name, childText, withName) {
        const node = new XmlNode(name);
        if (childText !== undefined) {
            node.addChildNode(new XmlText(childText));
        }
        if (withName !== undefined) {
            node.withName(withName);
        }
        return node;
    }
    constructor(name, children = []) {
        this.name = name;
        this.children = children;
    }
    withName(name) {
        this.name = name;
        return this;
    }
    addAttribute(name, value) {
        this.attributes[name] = value;
        return this;
    }
    addChildNode(child) {
        this.children.push(child);
        return this;
    }
    removeAttribute(name) {
        delete this.attributes[name];
        return this;
    }
    n(name) {
        this.name = name;
        return this;
    }
    c(child) {
        this.children.push(child);
        return this;
    }
    a(name, value) {
        if (value != null) {
            this.attributes[name] = value;
        }
        return this;
    }
    cc(input, field, withName = field) {
        if (input[field] != null) {
            const node = XmlNode.of(field, input[field]).withName(withName);
            this.c(node);
        }
    }
    l(input, listName, memberName, valueProvider) {
        if (input[listName] != null) {
            const nodes = valueProvider();
            nodes.map((node) => {
                node.withName(memberName);
                this.c(node);
            });
        }
    }
    lc(input, listName, memberName, valueProvider) {
        if (input[listName] != null) {
            const nodes = valueProvider();
            const containerNode = new XmlNode(memberName);
            nodes.map((node) => {
                containerNode.c(node);
            });
            this.c(containerNode);
        }
    }
    toString() {
        const hasChildren = Boolean(this.children.length);
        let xmlText = `<${this.name}`;
        const attributes = this.attributes;
        for (const attributeName of Object.keys(attributes)) {
            const attribute = attributes[attributeName];
            if (attribute != null) {
                xmlText += ` ${attributeName}="${escapeAttribute("" + attribute)}"`;
            }
        }
        return (xmlText += !hasChildren ? "/>" : `>${this.children.map((c) => c.toString()).join("")}</${this.name}>`);
    }
}

let parser;
function parseXML(xmlString) {
    if (!parser) {
        parser = new DOMParser();
    }
    const xmlDocument = parser.parseFromString(xmlString, "application/xml");
    if (xmlDocument.getElementsByTagName("parsererror").length > 0) {
        throw new Error("DOMParser XML parsing error.");
    }
    const xmlToObj = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent?.trim()) {
                return node.textContent;
            }
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.attributes.length === 0 && element.childNodes.length === 0) {
                return "";
            }
            const obj = {};
            const attributes = Array.from(element.attributes);
            for (const attr of attributes) {
                obj[`${attr.name}`] = attr.value;
            }
            const childNodes = Array.from(element.childNodes);
            for (const child of childNodes) {
                const childResult = xmlToObj(child);
                if (childResult != null) {
                    const childName = child.nodeName;
                    if (childNodes.length === 1 && attributes.length === 0 && childName === "#text") {
                        return childResult;
                    }
                    if (obj[childName]) {
                        if (Array.isArray(obj[childName])) {
                            obj[childName].push(childResult);
                        }
                        else {
                            obj[childName] = [obj[childName], childResult];
                        }
                    }
                    else {
                        obj[childName] = childResult;
                    }
                }
                else if (childNodes.length === 1 && attributes.length === 0) {
                    return element.textContent;
                }
            }
            return obj;
        }
        return null;
    };
    return {
        [xmlDocument.documentElement.nodeName]: xmlToObj(xmlDocument.documentElement),
    };
}

class XmlShapeDeserializer extends SerdeContextConfig {
    settings;
    stringDeserializer;
    constructor(settings) {
        super();
        this.settings = settings;
        this.stringDeserializer = new FromStringShapeDeserializer(settings);
    }
    setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
        this.stringDeserializer.setSerdeContext(serdeContext);
    }
    read(schema, bytes, key) {
        const ns = NormalizedSchema.of(schema);
        const memberSchemas = ns.getMemberSchemas();
        const isEventPayload = ns.isStructSchema() &&
            ns.isMemberSchema() &&
            !!Object.values(memberSchemas).find((memberNs) => {
                return !!memberNs.getMemberTraits().eventPayload;
            });
        if (isEventPayload) {
            const output = {};
            const memberName = Object.keys(memberSchemas)[0];
            const eventMemberSchema = memberSchemas[memberName];
            if (eventMemberSchema.isBlobSchema()) {
                output[memberName] = bytes;
            }
            else {
                output[memberName] = this.read(memberSchemas[memberName], bytes);
            }
            return output;
        }
        const xmlString = (this.serdeContext?.utf8Encoder ?? toUtf8)(bytes);
        const parsedObject = this.parseXml(xmlString);
        return this.readSchema(schema, key ? parsedObject[key] : parsedObject);
    }
    readSchema(_schema, value) {
        const ns = NormalizedSchema.of(_schema);
        if (ns.isUnitSchema()) {
            return;
        }
        const traits = ns.getMergedTraits();
        if (ns.isListSchema() && !Array.isArray(value)) {
            return this.readSchema(ns, [value]);
        }
        if (value == null) {
            return value;
        }
        if (typeof value === "object") {
            const flat = !!traits.xmlFlattened;
            if (ns.isListSchema()) {
                const listValue = ns.getValueSchema();
                const buffer = [];
                const sourceKey = listValue.getMergedTraits().xmlName ?? "member";
                const source = flat ? value : (value[0] ?? value)[sourceKey];
                if (source == null) {
                    return buffer;
                }
                const sourceArray = Array.isArray(source) ? source : [source];
                for (const v of sourceArray) {
                    buffer.push(this.readSchema(listValue, v));
                }
                return buffer;
            }
            const buffer = {};
            if (ns.isMapSchema()) {
                const keyNs = ns.getKeySchema();
                const memberNs = ns.getValueSchema();
                let entries;
                if (flat) {
                    entries = Array.isArray(value) ? value : [value];
                }
                else {
                    entries = Array.isArray(value.entry) ? value.entry : [value.entry];
                }
                const keyProperty = keyNs.getMergedTraits().xmlName ?? "key";
                const valueProperty = memberNs.getMergedTraits().xmlName ?? "value";
                for (const entry of entries) {
                    const key = entry[keyProperty];
                    const value = entry[valueProperty];
                    buffer[key] = this.readSchema(memberNs, value);
                }
                return buffer;
            }
            if (ns.isStructSchema()) {
                const union = ns.isUnionSchema();
                let unionSerde;
                if (union) {
                    unionSerde = new UnionSerde(value, buffer);
                }
                for (const [memberName, memberSchema] of ns.structIterator()) {
                    const memberTraits = memberSchema.getMergedTraits();
                    const xmlObjectKey = !memberTraits.httpPayload
                        ? memberSchema.getMemberTraits().xmlName ?? memberName
                        : memberTraits.xmlName ?? memberSchema.getName();
                    if (union) {
                        unionSerde.mark(xmlObjectKey);
                    }
                    if (value[xmlObjectKey] != null) {
                        buffer[memberName] = this.readSchema(memberSchema, value[xmlObjectKey]);
                    }
                }
                if (union) {
                    unionSerde.writeUnknown();
                }
                return buffer;
            }
            if (ns.isDocumentSchema()) {
                return value;
            }
            throw new Error(`@aws-sdk/core/protocols - xml deserializer unhandled schema type for ${ns.getName(true)}`);
        }
        if (ns.isListSchema()) {
            return [];
        }
        if (ns.isMapSchema() || ns.isStructSchema()) {
            return {};
        }
        return this.stringDeserializer.read(ns, value);
    }
    parseXml(xml) {
        if (xml.length) {
            let parsedObj;
            try {
                parsedObj = parseXML(xml);
            }
            catch (e) {
                if (e && typeof e === "object") {
                    Object.defineProperty(e, "$responseBodyText", {
                        value: xml,
                    });
                }
                throw e;
            }
            const textNodeName = "#text";
            const key = Object.keys(parsedObj)[0];
            const parsedObjToReturn = parsedObj[key];
            if (parsedObjToReturn[textNodeName]) {
                parsedObjToReturn[key] = parsedObjToReturn[textNodeName];
                delete parsedObjToReturn[textNodeName];
            }
            return getValueFromTextNode(parsedObjToReturn);
        }
        return {};
    }
}

const loadRestXmlErrorCode = (output, data) => {
    if (data?.Error?.Code !== undefined) {
        return data.Error.Code;
    }
    if (data?.Code !== undefined) {
        return data.Code;
    }
    if (output.statusCode == 404) {
        return "NotFound";
    }
};

class XmlShapeSerializer extends SerdeContextConfig {
    settings;
    stringBuffer;
    byteBuffer;
    buffer;
    constructor(settings) {
        super();
        this.settings = settings;
    }
    write(schema, value) {
        const ns = NormalizedSchema.of(schema);
        if (ns.isStringSchema() && typeof value === "string") {
            this.stringBuffer = value;
        }
        else if (ns.isBlobSchema()) {
            this.byteBuffer =
                "byteLength" in value
                    ? value
                    : (this.serdeContext?.base64Decoder ?? fromBase64)(value);
        }
        else {
            this.buffer = this.writeStruct(ns, value, undefined);
            const traits = ns.getMergedTraits();
            if (traits.httpPayload && !traits.xmlName) {
                this.buffer.withName(ns.getName());
            }
        }
    }
    flush() {
        if (this.byteBuffer !== undefined) {
            const bytes = this.byteBuffer;
            delete this.byteBuffer;
            return bytes;
        }
        if (this.stringBuffer !== undefined) {
            const str = this.stringBuffer;
            delete this.stringBuffer;
            return str;
        }
        const buffer = this.buffer;
        if (this.settings.xmlNamespace) {
            if (!buffer?.attributes?.["xmlns"]) {
                buffer.addAttribute("xmlns", this.settings.xmlNamespace);
            }
        }
        delete this.buffer;
        return buffer.toString();
    }
    writeStruct(ns, value, parentXmlns) {
        const traits = ns.getMergedTraits();
        const name = ns.isMemberSchema() && !traits.httpPayload
            ? ns.getMemberTraits().xmlName ?? ns.getMemberName()
            : traits.xmlName ?? ns.getName();
        if (!name || !ns.isStructSchema()) {
            throw new Error(`@aws-sdk/core/protocols - xml serializer, cannot write struct with empty name or non-struct, schema=${ns.getName(true)}.`);
        }
        const structXmlNode = XmlNode.of(name);
        const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(ns, parentXmlns);
        for (const [memberName, memberSchema] of ns.structIterator()) {
            const val = value[memberName];
            if (val != null || memberSchema.isIdempotencyToken()) {
                if (memberSchema.getMergedTraits().xmlAttribute) {
                    structXmlNode.addAttribute(memberSchema.getMergedTraits().xmlName ?? memberName, this.writeSimple(memberSchema, val));
                    continue;
                }
                if (memberSchema.isListSchema()) {
                    this.writeList(memberSchema, val, structXmlNode, xmlns);
                }
                else if (memberSchema.isMapSchema()) {
                    this.writeMap(memberSchema, val, structXmlNode, xmlns);
                }
                else if (memberSchema.isStructSchema()) {
                    structXmlNode.addChildNode(this.writeStruct(memberSchema, val, xmlns));
                }
                else {
                    const memberNode = XmlNode.of(memberSchema.getMergedTraits().xmlName ?? memberSchema.getMemberName());
                    this.writeSimpleInto(memberSchema, val, memberNode, xmlns);
                    structXmlNode.addChildNode(memberNode);
                }
            }
        }
        const { $unknown } = value;
        if ($unknown && ns.isUnionSchema() && Array.isArray($unknown) && Object.keys(value).length === 1) {
            const [k, v] = $unknown;
            const node = XmlNode.of(k);
            if (typeof v !== "string") {
                if (value instanceof XmlNode || value instanceof XmlText) {
                    structXmlNode.addChildNode(value);
                }
                else {
                    throw new Error(`@aws-sdk - $unknown union member in XML requires ` +
                        `value of type string, @aws-sdk/xml-builder::XmlNode or XmlText.`);
                }
            }
            this.writeSimpleInto(0, v, node, xmlns);
            structXmlNode.addChildNode(node);
        }
        if (xmlns) {
            structXmlNode.addAttribute(xmlnsAttr, xmlns);
        }
        return structXmlNode;
    }
    writeList(listMember, array, container, parentXmlns) {
        if (!listMember.isMemberSchema()) {
            throw new Error(`@aws-sdk/core/protocols - xml serializer, cannot write non-member list: ${listMember.getName(true)}`);
        }
        const listTraits = listMember.getMergedTraits();
        const listValueSchema = listMember.getValueSchema();
        const listValueTraits = listValueSchema.getMergedTraits();
        const sparse = !!listValueTraits.sparse;
        const flat = !!listTraits.xmlFlattened;
        const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(listMember, parentXmlns);
        const writeItem = (container, value) => {
            if (listValueSchema.isListSchema()) {
                this.writeList(listValueSchema, Array.isArray(value) ? value : [value], container, xmlns);
            }
            else if (listValueSchema.isMapSchema()) {
                this.writeMap(listValueSchema, value, container, xmlns);
            }
            else if (listValueSchema.isStructSchema()) {
                const struct = this.writeStruct(listValueSchema, value, xmlns);
                container.addChildNode(struct.withName(flat ? listTraits.xmlName ?? listMember.getMemberName() : listValueTraits.xmlName ?? "member"));
            }
            else {
                const listItemNode = XmlNode.of(flat ? listTraits.xmlName ?? listMember.getMemberName() : listValueTraits.xmlName ?? "member");
                this.writeSimpleInto(listValueSchema, value, listItemNode, xmlns);
                container.addChildNode(listItemNode);
            }
        };
        if (flat) {
            for (const value of array) {
                if (sparse || value != null) {
                    writeItem(container, value);
                }
            }
        }
        else {
            const listNode = XmlNode.of(listTraits.xmlName ?? listMember.getMemberName());
            if (xmlns) {
                listNode.addAttribute(xmlnsAttr, xmlns);
            }
            for (const value of array) {
                if (sparse || value != null) {
                    writeItem(listNode, value);
                }
            }
            container.addChildNode(listNode);
        }
    }
    writeMap(mapMember, map, container, parentXmlns, containerIsMap = false) {
        if (!mapMember.isMemberSchema()) {
            throw new Error(`@aws-sdk/core/protocols - xml serializer, cannot write non-member map: ${mapMember.getName(true)}`);
        }
        const mapTraits = mapMember.getMergedTraits();
        const mapKeySchema = mapMember.getKeySchema();
        const mapKeyTraits = mapKeySchema.getMergedTraits();
        const keyTag = mapKeyTraits.xmlName ?? "key";
        const mapValueSchema = mapMember.getValueSchema();
        const mapValueTraits = mapValueSchema.getMergedTraits();
        const valueTag = mapValueTraits.xmlName ?? "value";
        const sparse = !!mapValueTraits.sparse;
        const flat = !!mapTraits.xmlFlattened;
        const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(mapMember, parentXmlns);
        const addKeyValue = (entry, key, val) => {
            const keyNode = XmlNode.of(keyTag, key);
            const [keyXmlnsAttr, keyXmlns] = this.getXmlnsAttribute(mapKeySchema, xmlns);
            if (keyXmlns) {
                keyNode.addAttribute(keyXmlnsAttr, keyXmlns);
            }
            entry.addChildNode(keyNode);
            let valueNode = XmlNode.of(valueTag);
            if (mapValueSchema.isListSchema()) {
                this.writeList(mapValueSchema, val, valueNode, xmlns);
            }
            else if (mapValueSchema.isMapSchema()) {
                this.writeMap(mapValueSchema, val, valueNode, xmlns, true);
            }
            else if (mapValueSchema.isStructSchema()) {
                valueNode = this.writeStruct(mapValueSchema, val, xmlns);
            }
            else {
                this.writeSimpleInto(mapValueSchema, val, valueNode, xmlns);
            }
            entry.addChildNode(valueNode);
        };
        if (flat) {
            for (const [key, val] of Object.entries(map)) {
                if (sparse || val != null) {
                    const entry = XmlNode.of(mapTraits.xmlName ?? mapMember.getMemberName());
                    addKeyValue(entry, key, val);
                    container.addChildNode(entry);
                }
            }
        }
        else {
            let mapNode;
            if (!containerIsMap) {
                mapNode = XmlNode.of(mapTraits.xmlName ?? mapMember.getMemberName());
                if (xmlns) {
                    mapNode.addAttribute(xmlnsAttr, xmlns);
                }
                container.addChildNode(mapNode);
            }
            for (const [key, val] of Object.entries(map)) {
                if (sparse || val != null) {
                    const entry = XmlNode.of("entry");
                    addKeyValue(entry, key, val);
                    (containerIsMap ? container : mapNode).addChildNode(entry);
                }
            }
        }
    }
    writeSimple(_schema, value) {
        if (null === value) {
            throw new Error("@aws-sdk/core/protocols - (XML serializer) cannot write null value.");
        }
        const ns = NormalizedSchema.of(_schema);
        let nodeContents = null;
        if (value && typeof value === "object") {
            if (ns.isBlobSchema()) {
                nodeContents = (this.serdeContext?.base64Encoder ?? toBase64)(value);
            }
            else if (ns.isTimestampSchema() && value instanceof Date) {
                const format = determineTimestampFormat(ns, this.settings);
                switch (format) {
                    case 5:
                        nodeContents = value.toISOString().replace(".000Z", "Z");
                        break;
                    case 6:
                        nodeContents = dateToUtcString(value);
                        break;
                    case 7:
                        nodeContents = String(value.getTime() / 1000);
                        break;
                    default:
                        console.warn("Missing timestamp format, using http date", value);
                        nodeContents = dateToUtcString(value);
                        break;
                }
            }
            else if (ns.isBigDecimalSchema() && value) {
                if (value instanceof NumericValue) {
                    return value.string;
                }
                return String(value);
            }
            else if (ns.isMapSchema() || ns.isListSchema()) {
                throw new Error("@aws-sdk/core/protocols - xml serializer, cannot call _write() on List/Map schema, call writeList or writeMap() instead.");
            }
            else {
                throw new Error(`@aws-sdk/core/protocols - xml serializer, unhandled schema type for object value and schema: ${ns.getName(true)}`);
            }
        }
        if (ns.isBooleanSchema() || ns.isNumericSchema() || ns.isBigIntegerSchema() || ns.isBigDecimalSchema()) {
            nodeContents = String(value);
        }
        if (ns.isStringSchema()) {
            if (value === undefined && ns.isIdempotencyToken()) {
                nodeContents = v4();
            }
            else {
                nodeContents = String(value);
            }
        }
        if (nodeContents === null) {
            throw new Error(`Unhandled schema-value pair ${ns.getName(true)}=${value}`);
        }
        return nodeContents;
    }
    writeSimpleInto(_schema, value, into, parentXmlns) {
        const nodeContents = this.writeSimple(_schema, value);
        const ns = NormalizedSchema.of(_schema);
        const content = new XmlText(nodeContents);
        const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(ns, parentXmlns);
        if (xmlns) {
            into.addAttribute(xmlnsAttr, xmlns);
        }
        into.addChildNode(content);
    }
    getXmlnsAttribute(ns, parentXmlns) {
        const traits = ns.getMergedTraits();
        const [prefix, xmlns] = traits.xmlNamespace ?? [];
        if (xmlns && xmlns !== parentXmlns) {
            return [prefix ? `xmlns:${prefix}` : "xmlns", xmlns];
        }
        return [void 0, void 0];
    }
}

class XmlCodec extends SerdeContextConfig {
    settings;
    constructor(settings) {
        super();
        this.settings = settings;
    }
    createSerializer() {
        const serializer = new XmlShapeSerializer(this.settings);
        serializer.setSerdeContext(this.serdeContext);
        return serializer;
    }
    createDeserializer() {
        const deserializer = new XmlShapeDeserializer(this.settings);
        deserializer.setSerdeContext(this.serdeContext);
        return deserializer;
    }
}

class AwsRestXmlProtocol extends HttpBindingProtocol {
    codec;
    serializer;
    deserializer;
    mixin = new ProtocolLib();
    constructor(options) {
        super(options);
        const settings = {
            timestampFormat: {
                useTrait: true,
                default: 5,
            },
            httpBindings: true,
            xmlNamespace: options.xmlNamespace,
            serviceNamespace: options.defaultNamespace,
        };
        this.codec = new XmlCodec(settings);
        this.serializer = new HttpInterceptingShapeSerializer(this.codec.createSerializer(), settings);
        this.deserializer = new HttpInterceptingShapeDeserializer(this.codec.createDeserializer(), settings);
        this.compositeErrorRegistry;
    }
    getPayloadCodec() {
        return this.codec;
    }
    getShapeId() {
        return "aws.protocols#restXml";
    }
    async serializeRequest(operationSchema, input, context) {
        const request = await super.serializeRequest(operationSchema, input, context);
        const inputSchema = NormalizedSchema.of(operationSchema.input);
        if (!request.headers["content-type"]) {
            const contentType = this.mixin.resolveRestContentType(this.getDefaultContentType(), inputSchema);
            if (contentType) {
                request.headers["content-type"] = contentType;
            }
        }
        if (typeof request.body === "string" &&
            request.headers["content-type"] === this.getDefaultContentType() &&
            !request.body.startsWith("<?xml ") &&
            !this.hasUnstructuredPayloadBinding(inputSchema)) {
            request.body = '<?xml version="1.0" encoding="UTF-8"?>' + request.body;
        }
        return request;
    }
    async deserializeResponse(operationSchema, context, response) {
        return super.deserializeResponse(operationSchema, context, response);
    }
    async handleError(operationSchema, context, response, dataObject, metadata) {
        const errorIdentifier = loadRestXmlErrorCode(response, dataObject) ?? "Unknown";
        this.mixin.compose(this.compositeErrorRegistry, errorIdentifier, this.options.defaultNamespace);
        if (dataObject.Error && typeof dataObject.Error === "object") {
            for (const key of Object.keys(dataObject.Error)) {
                dataObject[key] = dataObject.Error[key];
                if (key.toLowerCase() === "message") {
                    dataObject.message = dataObject.Error[key];
                }
            }
        }
        if (dataObject.RequestId && !metadata.requestId) {
            metadata.requestId = dataObject.RequestId;
        }
        const { errorSchema, errorMetadata } = await this.mixin.getErrorSchemaOrThrowBaseException(errorIdentifier, this.options.defaultNamespace, response, dataObject, metadata);
        const ns = NormalizedSchema.of(errorSchema);
        const message = dataObject.Error?.message ??
            dataObject.Error?.Message ??
            dataObject.message ??
            dataObject.Message ??
            "UnknownError";
        const ErrorCtor = this.compositeErrorRegistry.getErrorCtor(errorSchema) ?? Error;
        const exception = new ErrorCtor(message);
        await this.deserializeHttpMessage(errorSchema, context, response, dataObject);
        const output = {};
        for (const [name, member] of ns.structIterator()) {
            const target = member.getMergedTraits().xmlName ?? name;
            const value = dataObject.Error?.[target] ?? dataObject[target];
            output[name] = this.codec.createDeserializer().readSchema(member, value);
        }
        throw this.mixin.decorateServiceException(Object.assign(exception, errorMetadata, {
            $fault: ns.getMergedTraits().error,
            message,
        }, output), dataObject);
    }
    getDefaultContentType() {
        return "application/xml";
    }
    hasUnstructuredPayloadBinding(ns) {
        for (const [, member] of ns.structIterator()) {
            if (member.getMergedTraits().httpPayload) {
                return !(member.isStructSchema() || member.isMapSchema() || member.isListSchema());
            }
        }
        return false;
    }
}

const getChecksumAlgorithmForRequest = (input, { requestChecksumRequired, requestAlgorithmMember, requestChecksumCalculation }) => {
    if (!requestAlgorithmMember) {
        return requestChecksumCalculation === RequestChecksumCalculation.WHEN_SUPPORTED || requestChecksumRequired
            ? DEFAULT_CHECKSUM_ALGORITHM
            : undefined;
    }
    if (!input[requestAlgorithmMember]) {
        return undefined;
    }
    const checksumAlgorithm = input[requestAlgorithmMember];
    return checksumAlgorithm;
};

const getChecksumLocationName = (algorithm) => algorithm === ChecksumAlgorithm$1.MD5 ? "content-md5" : `x-amz-checksum-${algorithm.toLowerCase()}`;

const hasHeader = (header, headers) => {
    const soughtHeader = header.toLowerCase();
    for (const headerName of Object.keys(headers)) {
        if (soughtHeader === headerName.toLowerCase()) {
            return true;
        }
    }
    return false;
};

const hasHeaderWithPrefix = (headerPrefix, headers) => {
    const soughtHeaderPrefix = headerPrefix.toLowerCase();
    for (const headerName of Object.keys(headers)) {
        if (headerName.toLowerCase().startsWith(soughtHeaderPrefix)) {
            return true;
        }
    }
    return false;
};

const isStreaming = (body) => body !== undefined && typeof body !== "string" && !ArrayBuffer.isView(body) && !isArrayBuffer(body);

const fromUtf8$2 = (input) => new TextEncoder().encode(input);

// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
// Quick polyfill
var fromUtf8$1 = typeof Buffer !== "undefined" && Buffer.from
    ? function (input) { return Buffer.from(input, "utf8"); }
    : fromUtf8$2;
function convertToBuffer$2(data) {
    // Already a Uint8, do nothing
    if (data instanceof Uint8Array)
        return data;
    if (typeof data === "string") {
        return fromUtf8$1(data);
    }
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
    }
    return new Uint8Array(data);
}

// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
function isEmptyData$2(data) {
    if (typeof data === "string") {
        return data.length === 0;
    }
    return data.byteLength === 0;
}

// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
function numToUint8(num) {
    return new Uint8Array([
        (num & 0xff000000) >> 24,
        (num & 0x00ff0000) >> 16,
        (num & 0x0000ff00) >> 8,
        num & 0x000000ff,
    ]);
}

// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
// IE 11 does not support Array.from, so we do it manually
function uint32ArrayFrom(a_lookUpTable) {
    if (!Uint32Array.from) {
        var return_array = new Uint32Array(a_lookUpTable.length);
        var a_index = 0;
        while (a_index < a_lookUpTable.length) {
            return_array[a_index] = a_lookUpTable[a_index];
            a_index += 1;
        }
        return return_array;
    }
    return Uint32Array.from(a_lookUpTable);
}

// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
var AwsCrc32c = /** @class */ (function () {
    function AwsCrc32c() {
        this.crc32c = new Crc32c();
    }
    AwsCrc32c.prototype.update = function (toHash) {
        if (isEmptyData$2(toHash))
            return;
        this.crc32c.update(convertToBuffer$2(toHash));
    };
    AwsCrc32c.prototype.digest = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, numToUint8(this.crc32c.digest())];
            });
        });
    };
    AwsCrc32c.prototype.reset = function () {
        this.crc32c = new Crc32c();
    };
    return AwsCrc32c;
}());

// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
var Crc32c = /** @class */ (function () {
    function Crc32c() {
        this.checksum = 0xffffffff;
    }
    Crc32c.prototype.update = function (data) {
        var e_1, _a;
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var byte = data_1_1.value;
                this.checksum =
                    (this.checksum >>> 8) ^ lookupTable$1[(this.checksum ^ byte) & 0xff];
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return this;
    };
    Crc32c.prototype.digest = function () {
        return (this.checksum ^ 0xffffffff) >>> 0;
    };
    return Crc32c;
}());
// prettier-ignore
var a_lookupTable = [
    0x00000000, 0xF26B8303, 0xE13B70F7, 0x1350F3F4, 0xC79A971F, 0x35F1141C, 0x26A1E7E8, 0xD4CA64EB,
    0x8AD958CF, 0x78B2DBCC, 0x6BE22838, 0x9989AB3B, 0x4D43CFD0, 0xBF284CD3, 0xAC78BF27, 0x5E133C24,
    0x105EC76F, 0xE235446C, 0xF165B798, 0x030E349B, 0xD7C45070, 0x25AFD373, 0x36FF2087, 0xC494A384,
    0x9A879FA0, 0x68EC1CA3, 0x7BBCEF57, 0x89D76C54, 0x5D1D08BF, 0xAF768BBC, 0xBC267848, 0x4E4DFB4B,
    0x20BD8EDE, 0xD2D60DDD, 0xC186FE29, 0x33ED7D2A, 0xE72719C1, 0x154C9AC2, 0x061C6936, 0xF477EA35,
    0xAA64D611, 0x580F5512, 0x4B5FA6E6, 0xB93425E5, 0x6DFE410E, 0x9F95C20D, 0x8CC531F9, 0x7EAEB2FA,
    0x30E349B1, 0xC288CAB2, 0xD1D83946, 0x23B3BA45, 0xF779DEAE, 0x05125DAD, 0x1642AE59, 0xE4292D5A,
    0xBA3A117E, 0x4851927D, 0x5B016189, 0xA96AE28A, 0x7DA08661, 0x8FCB0562, 0x9C9BF696, 0x6EF07595,
    0x417B1DBC, 0xB3109EBF, 0xA0406D4B, 0x522BEE48, 0x86E18AA3, 0x748A09A0, 0x67DAFA54, 0x95B17957,
    0xCBA24573, 0x39C9C670, 0x2A993584, 0xD8F2B687, 0x0C38D26C, 0xFE53516F, 0xED03A29B, 0x1F682198,
    0x5125DAD3, 0xA34E59D0, 0xB01EAA24, 0x42752927, 0x96BF4DCC, 0x64D4CECF, 0x77843D3B, 0x85EFBE38,
    0xDBFC821C, 0x2997011F, 0x3AC7F2EB, 0xC8AC71E8, 0x1C661503, 0xEE0D9600, 0xFD5D65F4, 0x0F36E6F7,
    0x61C69362, 0x93AD1061, 0x80FDE395, 0x72966096, 0xA65C047D, 0x5437877E, 0x4767748A, 0xB50CF789,
    0xEB1FCBAD, 0x197448AE, 0x0A24BB5A, 0xF84F3859, 0x2C855CB2, 0xDEEEDFB1, 0xCDBE2C45, 0x3FD5AF46,
    0x7198540D, 0x83F3D70E, 0x90A324FA, 0x62C8A7F9, 0xB602C312, 0x44694011, 0x5739B3E5, 0xA55230E6,
    0xFB410CC2, 0x092A8FC1, 0x1A7A7C35, 0xE811FF36, 0x3CDB9BDD, 0xCEB018DE, 0xDDE0EB2A, 0x2F8B6829,
    0x82F63B78, 0x709DB87B, 0x63CD4B8F, 0x91A6C88C, 0x456CAC67, 0xB7072F64, 0xA457DC90, 0x563C5F93,
    0x082F63B7, 0xFA44E0B4, 0xE9141340, 0x1B7F9043, 0xCFB5F4A8, 0x3DDE77AB, 0x2E8E845F, 0xDCE5075C,
    0x92A8FC17, 0x60C37F14, 0x73938CE0, 0x81F80FE3, 0x55326B08, 0xA759E80B, 0xB4091BFF, 0x466298FC,
    0x1871A4D8, 0xEA1A27DB, 0xF94AD42F, 0x0B21572C, 0xDFEB33C7, 0x2D80B0C4, 0x3ED04330, 0xCCBBC033,
    0xA24BB5A6, 0x502036A5, 0x4370C551, 0xB11B4652, 0x65D122B9, 0x97BAA1BA, 0x84EA524E, 0x7681D14D,
    0x2892ED69, 0xDAF96E6A, 0xC9A99D9E, 0x3BC21E9D, 0xEF087A76, 0x1D63F975, 0x0E330A81, 0xFC588982,
    0xB21572C9, 0x407EF1CA, 0x532E023E, 0xA145813D, 0x758FE5D6, 0x87E466D5, 0x94B49521, 0x66DF1622,
    0x38CC2A06, 0xCAA7A905, 0xD9F75AF1, 0x2B9CD9F2, 0xFF56BD19, 0x0D3D3E1A, 0x1E6DCDEE, 0xEC064EED,
    0xC38D26C4, 0x31E6A5C7, 0x22B65633, 0xD0DDD530, 0x0417B1DB, 0xF67C32D8, 0xE52CC12C, 0x1747422F,
    0x49547E0B, 0xBB3FFD08, 0xA86F0EFC, 0x5A048DFF, 0x8ECEE914, 0x7CA56A17, 0x6FF599E3, 0x9D9E1AE0,
    0xD3D3E1AB, 0x21B862A8, 0x32E8915C, 0xC083125F, 0x144976B4, 0xE622F5B7, 0xF5720643, 0x07198540,
    0x590AB964, 0xAB613A67, 0xB831C993, 0x4A5A4A90, 0x9E902E7B, 0x6CFBAD78, 0x7FAB5E8C, 0x8DC0DD8F,
    0xE330A81A, 0x115B2B19, 0x020BD8ED, 0xF0605BEE, 0x24AA3F05, 0xD6C1BC06, 0xC5914FF2, 0x37FACCF1,
    0x69E9F0D5, 0x9B8273D6, 0x88D28022, 0x7AB90321, 0xAE7367CA, 0x5C18E4C9, 0x4F48173D, 0xBD23943E,
    0xF36E6F75, 0x0105EC76, 0x12551F82, 0xE03E9C81, 0x34F4F86A, 0xC69F7B69, 0xD5CF889D, 0x27A40B9E,
    0x79B737BA, 0x8BDCB4B9, 0x988C474D, 0x6AE7C44E, 0xBE2DA0A5, 0x4C4623A6, 0x5F16D052, 0xAD7D5351,
];
var lookupTable$1 = uint32ArrayFrom(a_lookupTable);

const generateCRC64NVMETable = () => {
    const sliceLength = 8;
    const tables = new Array(sliceLength);
    for (let slice = 0; slice < sliceLength; slice++) {
        const table = new Array(512);
        for (let i = 0; i < 256; i++) {
            let crc = BigInt(i);
            for (let j = 0; j < 8 * (slice + 1); j++) {
                if (crc & 1n) {
                    crc = (crc >> 1n) ^ 0x9a6c9329ac4bc9b5n;
                }
                else {
                    crc = crc >> 1n;
                }
            }
            table[i * 2] = Number((crc >> 32n) & 0xffffffffn);
            table[i * 2 + 1] = Number(crc & 0xffffffffn);
        }
        tables[slice] = new Uint32Array(table);
    }
    return tables;
};
let CRC64_NVME_REVERSED_TABLE;
let t0, t1, t2, t3;
let t4, t5, t6, t7;
const ensureTablesInitialized = () => {
    if (!CRC64_NVME_REVERSED_TABLE) {
        CRC64_NVME_REVERSED_TABLE = generateCRC64NVMETable();
        [t0, t1, t2, t3, t4, t5, t6, t7] = CRC64_NVME_REVERSED_TABLE;
    }
};
class Crc64Nvme {
    c1 = 0;
    c2 = 0;
    constructor() {
        ensureTablesInitialized();
        this.reset();
    }
    update(data) {
        const len = data.length;
        let i = 0;
        let crc1 = this.c1;
        let crc2 = this.c2;
        while (i + 8 <= len) {
            const idx0 = ((crc2 ^ data[i++]) & 255) << 1;
            const idx1 = (((crc2 >>> 8) ^ data[i++]) & 255) << 1;
            const idx2 = (((crc2 >>> 16) ^ data[i++]) & 255) << 1;
            const idx3 = (((crc2 >>> 24) ^ data[i++]) & 255) << 1;
            const idx4 = ((crc1 ^ data[i++]) & 255) << 1;
            const idx5 = (((crc1 >>> 8) ^ data[i++]) & 255) << 1;
            const idx6 = (((crc1 >>> 16) ^ data[i++]) & 255) << 1;
            const idx7 = (((crc1 >>> 24) ^ data[i++]) & 255) << 1;
            crc1 = t7[idx0] ^ t6[idx1] ^ t5[idx2] ^ t4[idx3] ^ t3[idx4] ^ t2[idx5] ^ t1[idx6] ^ t0[idx7];
            crc2 =
                t7[idx0 + 1] ^
                    t6[idx1 + 1] ^
                    t5[idx2 + 1] ^
                    t4[idx3 + 1] ^
                    t3[idx4 + 1] ^
                    t2[idx5 + 1] ^
                    t1[idx6 + 1] ^
                    t0[idx7 + 1];
        }
        while (i < len) {
            const idx = ((crc2 ^ data[i]) & 255) << 1;
            crc2 = ((crc2 >>> 8) | ((crc1 & 255) << 24)) >>> 0;
            crc1 = (crc1 >>> 8) ^ t0[idx];
            crc2 ^= t0[idx + 1];
            i++;
        }
        this.c1 = crc1;
        this.c2 = crc2;
    }
    async digest() {
        const c1 = this.c1 ^ 4294967295;
        const c2 = this.c2 ^ 4294967295;
        return new Uint8Array([
            c1 >>> 24,
            (c1 >>> 16) & 255,
            (c1 >>> 8) & 255,
            c1 & 255,
            c2 >>> 24,
            (c2 >>> 16) & 255,
            (c2 >>> 8) & 255,
            c2 & 255,
        ]);
    }
    reset() {
        this.c1 = 4294967295;
        this.c2 = 4294967295;
    }
}

// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
var AwsCrc32 = /** @class */ (function () {
    function AwsCrc32() {
        this.crc32 = new Crc32();
    }
    AwsCrc32.prototype.update = function (toHash) {
        if (isEmptyData$2(toHash))
            return;
        this.crc32.update(convertToBuffer$2(toHash));
    };
    AwsCrc32.prototype.digest = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, numToUint8(this.crc32.digest())];
            });
        });
    };
    AwsCrc32.prototype.reset = function () {
        this.crc32 = new Crc32();
    };
    return AwsCrc32;
}());

var Crc32 = /** @class */ (function () {
    function Crc32() {
        this.checksum = 0xffffffff;
    }
    Crc32.prototype.update = function (data) {
        var e_1, _a;
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var byte = data_1_1.value;
                this.checksum =
                    (this.checksum >>> 8) ^ lookupTable[(this.checksum ^ byte) & 0xff];
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return this;
    };
    Crc32.prototype.digest = function () {
        return (this.checksum ^ 0xffffffff) >>> 0;
    };
    return Crc32;
}());
// prettier-ignore
var a_lookUpTable = [
    0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
    0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
    0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
    0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
    0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
    0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
    0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
    0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
    0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
    0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
    0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
    0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
    0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
    0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
    0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
    0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
    0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
    0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
    0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
    0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
    0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
    0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
    0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
    0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
    0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
    0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
    0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
    0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
    0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
    0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
    0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
    0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
    0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
    0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
    0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
    0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
    0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
    0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
    0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
    0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
    0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
    0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
    0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
    0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
    0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
    0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
    0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
    0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
    0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
    0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
    0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
    0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
    0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
    0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
    0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
    0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
    0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
    0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
    0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
    0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
    0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
    0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
    0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
    0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D,
];
var lookupTable = uint32ArrayFrom(a_lookUpTable);

const getCrc32ChecksumAlgorithmFunction = () => AwsCrc32;

const CLIENT_SUPPORTED_ALGORITHMS = [
    ChecksumAlgorithm$1.CRC32,
    ChecksumAlgorithm$1.CRC32C,
    ChecksumAlgorithm$1.CRC64NVME,
    ChecksumAlgorithm$1.SHA1,
    ChecksumAlgorithm$1.SHA256,
];
const PRIORITY_ORDER_ALGORITHMS = [
    ChecksumAlgorithm$1.SHA256,
    ChecksumAlgorithm$1.SHA1,
    ChecksumAlgorithm$1.CRC32,
    ChecksumAlgorithm$1.CRC32C,
    ChecksumAlgorithm$1.CRC64NVME,
];

const selectChecksumAlgorithmFunction = (checksumAlgorithm, config) => {
    const { checksumAlgorithms = {} } = config;
    switch (checksumAlgorithm) {
        case ChecksumAlgorithm$1.MD5:
            return checksumAlgorithms?.MD5 ?? config.md5;
        case ChecksumAlgorithm$1.CRC32:
            return checksumAlgorithms?.CRC32 ?? getCrc32ChecksumAlgorithmFunction();
        case ChecksumAlgorithm$1.CRC32C:
            return checksumAlgorithms?.CRC32C ?? AwsCrc32c;
        case ChecksumAlgorithm$1.CRC64NVME:
            {
                return checksumAlgorithms?.CRC64NVME ?? Crc64Nvme;
            }
        case ChecksumAlgorithm$1.SHA1:
            return checksumAlgorithms?.SHA1 ?? config.sha1;
        case ChecksumAlgorithm$1.SHA256:
            return checksumAlgorithms?.SHA256 ?? config.sha256;
        default:
            if (checksumAlgorithms?.[checksumAlgorithm]) {
                return checksumAlgorithms[checksumAlgorithm];
            }
            throw new Error(`The checksum algorithm "${checksumAlgorithm}" is not supported by the client.` +
                ` Select one of ${CLIENT_SUPPORTED_ALGORITHMS}, or provide an implementation to ` +
                ` the client constructor checksums field.`);
    }
};

const stringHasher = (checksumAlgorithmFn, body) => {
    const hash = new checksumAlgorithmFn();
    hash.update(toUint8Array(body || ""));
    return hash.digest();
};

const flexibleChecksumsMiddlewareOptions = {
    name: "flexibleChecksumsMiddleware",
    step: "build",
    tags: ["BODY_CHECKSUM"],
    override: true,
};
const flexibleChecksumsMiddleware = (config, middlewareConfig) => (next, context) => async (args) => {
    if (!HttpRequest.isInstance(args.request)) {
        return next(args);
    }
    if (hasHeaderWithPrefix("x-amz-checksum-", args.request.headers)) {
        return next(args);
    }
    const { request, input } = args;
    const { body: requestBody, headers } = request;
    const { base64Encoder, streamHasher } = config;
    const { requestChecksumRequired, requestAlgorithmMember } = middlewareConfig;
    const requestChecksumCalculation = await config.requestChecksumCalculation();
    const requestAlgorithmMemberName = requestAlgorithmMember?.name;
    const requestAlgorithmMemberHttpHeader = requestAlgorithmMember?.httpHeader;
    if (requestAlgorithmMemberName && !input[requestAlgorithmMemberName]) {
        if (requestChecksumCalculation === RequestChecksumCalculation.WHEN_SUPPORTED || requestChecksumRequired) {
            input[requestAlgorithmMemberName] = DEFAULT_CHECKSUM_ALGORITHM;
            if (requestAlgorithmMemberHttpHeader) {
                headers[requestAlgorithmMemberHttpHeader] = DEFAULT_CHECKSUM_ALGORITHM;
            }
        }
    }
    const checksumAlgorithm = getChecksumAlgorithmForRequest(input, {
        requestChecksumRequired,
        requestAlgorithmMember: requestAlgorithmMember?.name,
        requestChecksumCalculation,
    });
    let updatedBody = requestBody;
    let updatedHeaders = headers;
    if (checksumAlgorithm) {
        switch (checksumAlgorithm) {
            case ChecksumAlgorithm$1.CRC32:
                setFeature$1(context, "FLEXIBLE_CHECKSUMS_REQ_CRC32", "U");
                break;
            case ChecksumAlgorithm$1.CRC32C:
                setFeature$1(context, "FLEXIBLE_CHECKSUMS_REQ_CRC32C", "V");
                break;
            case ChecksumAlgorithm$1.CRC64NVME:
                setFeature$1(context, "FLEXIBLE_CHECKSUMS_REQ_CRC64", "W");
                break;
            case ChecksumAlgorithm$1.SHA1:
                setFeature$1(context, "FLEXIBLE_CHECKSUMS_REQ_SHA1", "X");
                break;
            case ChecksumAlgorithm$1.SHA256:
                setFeature$1(context, "FLEXIBLE_CHECKSUMS_REQ_SHA256", "Y");
                break;
        }
        const checksumLocationName = getChecksumLocationName(checksumAlgorithm);
        const checksumAlgorithmFn = selectChecksumAlgorithmFunction(checksumAlgorithm, config);
        if (isStreaming(requestBody)) {
            const { getAwsChunkedEncodingStream, bodyLengthChecker } = config;
            updatedBody = getAwsChunkedEncodingStream(typeof config.requestStreamBufferSize === "number" && config.requestStreamBufferSize >= 8 * 1024
                ? createBufferedReadable(requestBody, config.requestStreamBufferSize, context.logger)
                : requestBody, {
                base64Encoder,
                bodyLengthChecker,
                checksumLocationName,
                checksumAlgorithmFn,
                streamHasher,
            });
            updatedHeaders = {
                ...headers,
                "content-encoding": headers["content-encoding"]
                    ? `${headers["content-encoding"]},aws-chunked`
                    : "aws-chunked",
                "transfer-encoding": "chunked",
                "x-amz-decoded-content-length": headers["content-length"],
                "x-amz-content-sha256": "STREAMING-UNSIGNED-PAYLOAD-TRAILER",
                "x-amz-trailer": checksumLocationName,
            };
            delete updatedHeaders["content-length"];
        }
        else if (!hasHeader(checksumLocationName, headers)) {
            const rawChecksum = await stringHasher(checksumAlgorithmFn, requestBody);
            updatedHeaders = {
                ...headers,
                [checksumLocationName]: base64Encoder(rawChecksum),
            };
        }
    }
    try {
        const result = await next({
            ...args,
            request: {
                ...request,
                headers: updatedHeaders,
                body: updatedBody,
            },
        });
        return result;
    }
    catch (e) {
        if (e instanceof Error && e.name === "InvalidChunkSizeError") {
            try {
                if (!e.message.endsWith(".")) {
                    e.message += ".";
                }
                e.message +=
                    " Set [requestStreamBufferSize=number e.g. 65_536] in client constructor to instruct AWS SDK to buffer your input stream.";
            }
            catch (ignored) {
            }
        }
        throw e;
    }
};

const flexibleChecksumsInputMiddlewareOptions = {
    name: "flexibleChecksumsInputMiddleware",
    toMiddleware: "serializerMiddleware",
    relation: "before",
    tags: ["BODY_CHECKSUM"],
    override: true,
};
const flexibleChecksumsInputMiddleware = (config, middlewareConfig) => (next, context) => async (args) => {
    const input = args.input;
    const { requestValidationModeMember } = middlewareConfig;
    const requestChecksumCalculation = await config.requestChecksumCalculation();
    const responseChecksumValidation = await config.responseChecksumValidation();
    switch (requestChecksumCalculation) {
        case RequestChecksumCalculation.WHEN_REQUIRED:
            setFeature$1(context, "FLEXIBLE_CHECKSUMS_REQ_WHEN_REQUIRED", "a");
            break;
        case RequestChecksumCalculation.WHEN_SUPPORTED:
            setFeature$1(context, "FLEXIBLE_CHECKSUMS_REQ_WHEN_SUPPORTED", "Z");
            break;
    }
    switch (responseChecksumValidation) {
        case ResponseChecksumValidation.WHEN_REQUIRED:
            setFeature$1(context, "FLEXIBLE_CHECKSUMS_RES_WHEN_REQUIRED", "c");
            break;
        case ResponseChecksumValidation.WHEN_SUPPORTED:
            setFeature$1(context, "FLEXIBLE_CHECKSUMS_RES_WHEN_SUPPORTED", "b");
            break;
    }
    if (requestValidationModeMember && !input[requestValidationModeMember]) {
        if (responseChecksumValidation === ResponseChecksumValidation.WHEN_SUPPORTED) {
            input[requestValidationModeMember] = "ENABLED";
        }
    }
    return next(args);
};

const getChecksumAlgorithmListForResponse = (responseAlgorithms = []) => {
    const validChecksumAlgorithms = [];
    let i = PRIORITY_ORDER_ALGORITHMS.length;
    for (const algorithm of responseAlgorithms) {
        const priority = PRIORITY_ORDER_ALGORITHMS.indexOf(algorithm);
        if (priority !== -1) {
            validChecksumAlgorithms[priority] = algorithm;
        }
        else {
            validChecksumAlgorithms[i++] = algorithm;
        }
    }
    return validChecksumAlgorithms.filter(Boolean);
};

const isChecksumWithPartNumber = (checksum) => {
    const lastHyphenIndex = checksum.lastIndexOf("-");
    if (lastHyphenIndex !== -1) {
        const numberPart = checksum.slice(lastHyphenIndex + 1);
        if (!numberPart.startsWith("0")) {
            const number = parseInt(numberPart, 10);
            if (!isNaN(number) && number >= 1 && number <= 10000) {
                return true;
            }
        }
    }
    return false;
};

const getChecksum = async (body, { checksumAlgorithmFn, base64Encoder }) => base64Encoder(await stringHasher(checksumAlgorithmFn, body));

const validateChecksumFromResponse = async (response, { config, responseAlgorithms, logger }) => {
    const checksumAlgorithms = getChecksumAlgorithmListForResponse(responseAlgorithms);
    const { body: responseBody, headers: responseHeaders } = response;
    for (const algorithm of checksumAlgorithms) {
        const responseHeader = getChecksumLocationName(algorithm);
        const checksumFromResponse = responseHeaders[responseHeader];
        if (checksumFromResponse) {
            let checksumAlgorithmFn;
            try {
                checksumAlgorithmFn = selectChecksumAlgorithmFunction(algorithm, config);
            }
            catch (error) {
                if (algorithm === ChecksumAlgorithm$1.CRC64NVME) {
                    logger?.warn(`Skipping ${ChecksumAlgorithm$1.CRC64NVME} checksum validation: ${error.message}`);
                    continue;
                }
                throw error;
            }
            const { base64Encoder } = config;
            if (isStreaming(responseBody)) {
                response.body = createChecksumStream({
                    expectedChecksum: checksumFromResponse,
                    checksumSourceLocation: responseHeader,
                    checksum: new checksumAlgorithmFn(),
                    source: responseBody,
                    base64Encoder,
                });
                return;
            }
            const checksum = await getChecksum(responseBody, { checksumAlgorithmFn, base64Encoder });
            if (checksum === checksumFromResponse) {
                break;
            }
            throw new Error(`Checksum mismatch: expected "${checksum}" but received "${checksumFromResponse}"` +
                ` in response header "${responseHeader}".`);
        }
    }
};

const flexibleChecksumsResponseMiddlewareOptions = {
    name: "flexibleChecksumsResponseMiddleware",
    toMiddleware: "deserializerMiddleware",
    relation: "after",
    tags: ["BODY_CHECKSUM"],
    override: true,
};
const flexibleChecksumsResponseMiddleware = (config, middlewareConfig) => (next, context) => async (args) => {
    if (!HttpRequest.isInstance(args.request)) {
        return next(args);
    }
    const input = args.input;
    const result = await next(args);
    const response = result.response;
    const { requestValidationModeMember, responseAlgorithms } = middlewareConfig;
    if (requestValidationModeMember && input[requestValidationModeMember] === "ENABLED") {
        const { clientName, commandName } = context;
        const customChecksumAlgorithms = Object.keys(config.checksumAlgorithms ?? {}).filter((algorithm) => {
            const responseHeader = getChecksumLocationName(algorithm);
            return response.headers[responseHeader] !== undefined;
        });
        const algoList = getChecksumAlgorithmListForResponse([
            ...(responseAlgorithms ?? []),
            ...customChecksumAlgorithms,
        ]);
        const isS3WholeObjectMultipartGetResponseChecksum = clientName === "S3Client" &&
            commandName === "GetObjectCommand" &&
            algoList.every((algorithm) => {
                const responseHeader = getChecksumLocationName(algorithm);
                const checksumFromResponse = response.headers[responseHeader];
                return !checksumFromResponse || isChecksumWithPartNumber(checksumFromResponse);
            });
        if (isS3WholeObjectMultipartGetResponseChecksum) {
            return result;
        }
        await validateChecksumFromResponse(response, {
            config,
            responseAlgorithms: algoList,
            logger: context.logger,
        });
    }
    return result;
};

const getFlexibleChecksumsPlugin = (config, middlewareConfig) => ({
    applyToStack: (clientStack) => {
        clientStack.add(flexibleChecksumsMiddleware(config, middlewareConfig), flexibleChecksumsMiddlewareOptions);
        clientStack.addRelativeTo(flexibleChecksumsInputMiddleware(config, middlewareConfig), flexibleChecksumsInputMiddlewareOptions);
        clientStack.addRelativeTo(flexibleChecksumsResponseMiddleware(config, middlewareConfig), flexibleChecksumsResponseMiddlewareOptions);
    },
});

const resolveFlexibleChecksumsConfig = (input) => {
    const { requestChecksumCalculation, responseChecksumValidation, requestStreamBufferSize } = input;
    return Object.assign(input, {
        requestChecksumCalculation: normalizeProvider$1(requestChecksumCalculation ?? DEFAULT_REQUEST_CHECKSUM_CALCULATION),
        responseChecksumValidation: normalizeProvider$1(responseChecksumValidation ?? DEFAULT_RESPONSE_CHECKSUM_VALIDATION),
        requestStreamBufferSize: Number(requestStreamBufferSize ?? 0),
        checksumAlgorithms: input.checksumAlgorithms ?? {},
    });
};

function resolveHostHeaderConfig(input) {
    return input;
}
const hostHeaderMiddleware = (options) => (next) => async (args) => {
    if (!HttpRequest.isInstance(args.request))
        return next(args);
    const { request } = args;
    const { handlerProtocol = "" } = options.requestHandler.metadata || {};
    if (handlerProtocol.indexOf("h2") >= 0 && !request.headers[":authority"]) {
        delete request.headers["host"];
        request.headers[":authority"] = request.hostname + (request.port ? ":" + request.port : "");
    }
    else if (!request.headers["host"]) {
        let host = request.hostname;
        if (request.port != null)
            host += `:${request.port}`;
        request.headers["host"] = host;
    }
    return next(args);
};
const hostHeaderMiddlewareOptions = {
    name: "hostHeaderMiddleware",
    step: "build",
    priority: "low",
    tags: ["HOST"],
    override: true,
};
const getHostHeaderPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(hostHeaderMiddleware(options), hostHeaderMiddlewareOptions);
    },
});

const loggerMiddleware = () => (next, context) => async (args) => {
    try {
        const response = await next(args);
        const { clientName, commandName, logger, dynamoDbDocumentClientOptions = {} } = context;
        const { overrideInputFilterSensitiveLog, overrideOutputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
        const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
        const outputFilterSensitiveLog = overrideOutputFilterSensitiveLog ?? context.outputFilterSensitiveLog;
        const { $metadata, ...outputWithoutMetadata } = response.output;
        logger?.info?.({
            clientName,
            commandName,
            input: inputFilterSensitiveLog(args.input),
            output: outputFilterSensitiveLog(outputWithoutMetadata),
            metadata: $metadata,
        });
        return response;
    }
    catch (error) {
        const { clientName, commandName, logger, dynamoDbDocumentClientOptions = {} } = context;
        const { overrideInputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
        const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
        logger?.error?.({
            clientName,
            commandName,
            input: inputFilterSensitiveLog(args.input),
            error,
            metadata: error.$metadata,
        });
        throw error;
    }
};
const loggerMiddlewareOptions = {
    name: "loggerMiddleware",
    tags: ["LOGGER"],
    step: "initialize",
    override: true,
};
const getLoggerPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(loggerMiddleware(), loggerMiddlewareOptions);
    },
});

const recursionDetectionMiddlewareOptions = {
    step: "build",
    tags: ["RECURSION_DETECTION"],
    name: "recursionDetectionMiddleware",
    override: true,
    priority: "low",
};

const recursionDetectionMiddleware = () => (next) => async (args) => next(args);

const getRecursionDetectionPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(recursionDetectionMiddleware(), recursionDetectionMiddlewareOptions);
    },
});

const CONTENT_LENGTH_HEADER$1 = "content-length";
const DECODED_CONTENT_LENGTH_HEADER = "x-amz-decoded-content-length";
function checkContentLengthHeader() {
    return (next, context) => async (args) => {
        const { request } = args;
        if (HttpRequest.isInstance(request)) {
            if (!(CONTENT_LENGTH_HEADER$1 in request.headers) && !(DECODED_CONTENT_LENGTH_HEADER in request.headers)) {
                const message = `Are you using a Stream of unknown length as the Body of a PutObject request? Consider using Upload instead from @aws-sdk/lib-storage.`;
                if (typeof context?.logger?.warn === "function" && !(context.logger instanceof NoOpLogger)) {
                    context.logger.warn(message);
                }
                else {
                    console.warn(message);
                }
            }
        }
        return next({ ...args });
    };
}
const checkContentLengthHeaderMiddlewareOptions = {
    step: "finalizeRequest",
    tags: ["CHECK_CONTENT_LENGTH_HEADER"],
    name: "getCheckContentLengthHeaderPlugin",
    override: true,
};
const getCheckContentLengthHeaderPlugin = (unused) => ({
    applyToStack: (clientStack) => {
        clientStack.add(checkContentLengthHeader(), checkContentLengthHeaderMiddlewareOptions);
    },
});

const regionRedirectEndpointMiddleware = (config) => {
    return (next, context) => async (args) => {
        const originalRegion = await config.region();
        const regionProviderRef = config.region;
        let unlock = () => { };
        if (context.__s3RegionRedirect) {
            Object.defineProperty(config, "region", {
                writable: false,
                value: async () => {
                    return context.__s3RegionRedirect;
                },
            });
            unlock = () => Object.defineProperty(config, "region", {
                writable: true,
                value: regionProviderRef,
            });
        }
        try {
            const result = await next(args);
            if (context.__s3RegionRedirect) {
                unlock();
                const region = await config.region();
                if (originalRegion !== region) {
                    throw new Error("Region was not restored following S3 region redirect.");
                }
            }
            return result;
        }
        catch (e) {
            unlock();
            throw e;
        }
    };
};
const regionRedirectEndpointMiddlewareOptions = {
    tags: ["REGION_REDIRECT", "S3"],
    name: "regionRedirectEndpointMiddleware",
    override: true,
    relation: "before",
    toMiddleware: "endpointV2Middleware",
};

function regionRedirectMiddleware(clientConfig) {
    return (next, context) => async (args) => {
        try {
            return await next(args);
        }
        catch (err) {
            if (clientConfig.followRegionRedirects) {
                const statusCode = err?.$metadata?.httpStatusCode;
                const isHeadBucket = context.commandName === "HeadBucketCommand";
                const bucketRegionHeader = err?.$response?.headers?.["x-amz-bucket-region"];
                if (bucketRegionHeader) {
                    if (statusCode === 301 ||
                        (statusCode === 400 && (err?.name === "IllegalLocationConstraintException" || isHeadBucket))) {
                        try {
                            const actualRegion = bucketRegionHeader;
                            context.logger?.debug(`Redirecting from ${await clientConfig.region()} to ${actualRegion}`);
                            context.__s3RegionRedirect = actualRegion;
                        }
                        catch (e) {
                            throw new Error("Region redirect failed: " + e);
                        }
                        return next(args);
                    }
                }
            }
            throw err;
        }
    };
}
const regionRedirectMiddlewareOptions = {
    step: "initialize",
    tags: ["REGION_REDIRECT", "S3"],
    name: "regionRedirectMiddleware",
    override: true,
};
const getRegionRedirectMiddlewarePlugin = (clientConfig) => ({
    applyToStack: (clientStack) => {
        clientStack.add(regionRedirectMiddleware(clientConfig), regionRedirectMiddlewareOptions);
        clientStack.addRelativeTo(regionRedirectEndpointMiddleware(clientConfig), regionRedirectEndpointMiddlewareOptions);
    },
});

const s3ExpiresMiddleware = (config) => {
    return (next, context) => async (args) => {
        const result = await next(args);
        const { response } = result;
        if (HttpResponse.isInstance(response)) {
            if (response.headers.expires) {
                response.headers.expiresstring = response.headers.expires;
                try {
                    parseRfc7231DateTime(response.headers.expires);
                }
                catch (e) {
                    context.logger?.warn(`AWS SDK Warning for ${context.clientName}::${context.commandName} response parsing (${response.headers.expires}): ${e}`);
                    delete response.headers.expires;
                }
            }
        }
        return result;
    };
};
const s3ExpiresMiddlewareOptions = {
    tags: ["S3"],
    name: "s3ExpiresMiddleware",
    override: true,
    relation: "after",
    toMiddleware: "deserializerMiddleware",
};
const getS3ExpiresMiddlewarePlugin = (clientConfig) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(s3ExpiresMiddleware(), s3ExpiresMiddlewareOptions);
    },
});

class S3ExpressIdentityCache {
    data;
    lastPurgeTime = Date.now();
    static EXPIRED_CREDENTIAL_PURGE_INTERVAL_MS = 30_000;
    constructor(data = {}) {
        this.data = data;
    }
    get(key) {
        const entry = this.data[key];
        if (!entry) {
            return;
        }
        return entry;
    }
    set(key, entry) {
        this.data[key] = entry;
        return entry;
    }
    delete(key) {
        delete this.data[key];
    }
    async purgeExpired() {
        const now = Date.now();
        if (this.lastPurgeTime + S3ExpressIdentityCache.EXPIRED_CREDENTIAL_PURGE_INTERVAL_MS > now) {
            return;
        }
        for (const key in this.data) {
            const entry = this.data[key];
            if (!entry.isRefreshing) {
                const credential = await entry.identity;
                if (credential.expiration) {
                    if (credential.expiration.getTime() < now) {
                        delete this.data[key];
                    }
                }
            }
        }
    }
}

class S3ExpressIdentityCacheEntry {
    _identity;
    isRefreshing;
    accessed;
    constructor(_identity, isRefreshing = false, accessed = Date.now()) {
        this._identity = _identity;
        this.isRefreshing = isRefreshing;
        this.accessed = accessed;
    }
    get identity() {
        this.accessed = Date.now();
        return this._identity;
    }
}

class S3ExpressIdentityProviderImpl {
    createSessionFn;
    cache;
    static REFRESH_WINDOW_MS = 60_000;
    constructor(createSessionFn, cache = new S3ExpressIdentityCache()) {
        this.createSessionFn = createSessionFn;
        this.cache = cache;
    }
    async getS3ExpressIdentity(awsIdentity, identityProperties) {
        const key = identityProperties.Bucket;
        const { cache } = this;
        const entry = cache.get(key);
        if (entry) {
            return entry.identity.then((identity) => {
                const isExpired = (identity.expiration?.getTime() ?? 0) < Date.now();
                if (isExpired) {
                    return cache.set(key, new S3ExpressIdentityCacheEntry(this.getIdentity(key))).identity;
                }
                const isExpiringSoon = (identity.expiration?.getTime() ?? 0) < Date.now() + S3ExpressIdentityProviderImpl.REFRESH_WINDOW_MS;
                if (isExpiringSoon && !entry.isRefreshing) {
                    entry.isRefreshing = true;
                    this.getIdentity(key).then((id) => {
                        cache.set(key, new S3ExpressIdentityCacheEntry(Promise.resolve(id)));
                    });
                }
                return identity;
            });
        }
        return cache.set(key, new S3ExpressIdentityCacheEntry(this.getIdentity(key))).identity;
    }
    async getIdentity(key) {
        await this.cache.purgeExpired().catch((error) => {
            console.warn("Error while clearing expired entries in S3ExpressIdentityCache: \n" + error);
        });
        const session = await this.createSessionFn(key);
        if (!session.Credentials?.AccessKeyId || !session.Credentials?.SecretAccessKey) {
            throw new Error("s3#createSession response credential missing AccessKeyId or SecretAccessKey.");
        }
        const identity = {
            accessKeyId: session.Credentials.AccessKeyId,
            secretAccessKey: session.Credentials.SecretAccessKey,
            sessionToken: session.Credentials.SessionToken,
            expiration: session.Credentials.Expiration ? new Date(session.Credentials.Expiration) : undefined,
        };
        return identity;
    }
}

const s3ExpressMiddleware = (options) => {
    return (next, context) => async (args) => {
        if (context.endpointV2) {
            const endpoint = context.endpointV2;
            const isS3ExpressAuth = endpoint.properties?.authSchemes?.[0]?.name === S3_EXPRESS_AUTH_SCHEME;
            const isS3ExpressBucket = endpoint.properties?.backend === S3_EXPRESS_BACKEND ||
                endpoint.properties?.bucketType === S3_EXPRESS_BUCKET_TYPE;
            if (isS3ExpressBucket) {
                setFeature$1(context, "S3_EXPRESS_BUCKET", "J");
                context.isS3ExpressBucket = true;
            }
            if (isS3ExpressAuth) {
                const requestBucket = args.input.Bucket;
                if (requestBucket) {
                    const s3ExpressIdentity = await options.s3ExpressIdentityProvider.getS3ExpressIdentity(await options.credentials(), {
                        Bucket: requestBucket,
                    });
                    context.s3ExpressIdentity = s3ExpressIdentity;
                    if (HttpRequest.isInstance(args.request) && s3ExpressIdentity.sessionToken) {
                        args.request.headers[SESSION_TOKEN_HEADER] = s3ExpressIdentity.sessionToken;
                    }
                }
            }
        }
        return next(args);
    };
};
const s3ExpressMiddlewareOptions = {
    name: "s3ExpressMiddleware",
    step: "build",
    tags: ["S3", "S3_EXPRESS"],
    override: true,
};
const getS3ExpressPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(s3ExpressMiddleware(options), s3ExpressMiddlewareOptions);
    },
});

const signS3Express = async (s3ExpressIdentity, signingOptions, request, sigV4MultiRegionSigner) => {
    const signedRequest = await sigV4MultiRegionSigner.signWithCredentials(request, s3ExpressIdentity, {});
    if (signedRequest.headers["X-Amz-Security-Token"] || signedRequest.headers["x-amz-security-token"]) {
        throw new Error("X-Amz-Security-Token must not be set for s3-express requests.");
    }
    return signedRequest;
};

const defaultErrorHandler = (signingProperties) => (error) => {
    throw error;
};
const defaultSuccessHandler = (httpResponse, signingProperties) => { };
const s3ExpressHttpSigningMiddleware = (config) => (next, context) => async (args) => {
    if (!HttpRequest.isInstance(args.request)) {
        return next(args);
    }
    const smithyContext = getSmithyContext(context);
    const scheme = smithyContext.selectedHttpAuthScheme;
    if (!scheme) {
        throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
    }
    const { httpAuthOption: { signingProperties = {} }, identity, signer, } = scheme;
    let request;
    if (context.s3ExpressIdentity) {
        request = await signS3Express(context.s3ExpressIdentity, signingProperties, args.request, await config.signer());
    }
    else {
        request = await signer.sign(args.request, identity, signingProperties);
    }
    const output = await next({
        ...args,
        request,
    }).catch((signer.errorHandler || defaultErrorHandler)(signingProperties));
    (signer.successHandler || defaultSuccessHandler)(output.response, signingProperties);
    return output;
};
const getS3ExpressHttpSigningPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(s3ExpressHttpSigningMiddleware(config), httpSigningMiddlewareOptions);
    },
});

const resolveS3Config = (input, { session, }) => {
    const [s3ClientProvider, CreateSessionCommandCtor] = session;
    const { forcePathStyle, useAccelerateEndpoint, disableMultiregionAccessPoints, followRegionRedirects, s3ExpressIdentityProvider, bucketEndpoint, expectContinueHeader, } = input;
    return Object.assign(input, {
        forcePathStyle: forcePathStyle ?? false,
        useAccelerateEndpoint: useAccelerateEndpoint ?? false,
        disableMultiregionAccessPoints: disableMultiregionAccessPoints ?? false,
        followRegionRedirects: followRegionRedirects ?? false,
        s3ExpressIdentityProvider: s3ExpressIdentityProvider ??
            new S3ExpressIdentityProviderImpl(async (key) => s3ClientProvider().send(new CreateSessionCommandCtor({
                Bucket: key,
            }))),
        bucketEndpoint: bucketEndpoint ?? false,
        expectContinueHeader: expectContinueHeader ?? 2_097_152,
    });
};

const THROW_IF_EMPTY_BODY = {
    CopyObjectCommand: true,
    UploadPartCopyCommand: true,
    CompleteMultipartUploadCommand: true,
};
const MAX_BYTES_TO_INSPECT = 3000;
const throw200ExceptionsMiddleware = (config) => (next, context) => async (args) => {
    const result = await next(args);
    const { response } = result;
    if (!HttpResponse.isInstance(response)) {
        return result;
    }
    const { statusCode, body: sourceBody } = response;
    if (statusCode < 200 || statusCode >= 300) {
        return result;
    }
    const isSplittableStream = typeof sourceBody?.stream === "function" ||
        typeof sourceBody?.pipe === "function" ||
        typeof sourceBody?.tee === "function";
    if (!isSplittableStream) {
        return result;
    }
    let bodyCopy = sourceBody;
    let body = sourceBody;
    if (sourceBody && typeof sourceBody === "object" && !(sourceBody instanceof Uint8Array)) {
        [bodyCopy, body] = await splitStream(sourceBody);
    }
    response.body = body;
    const bodyBytes = await collectBody(bodyCopy, {
        streamCollector: async (stream) => {
            return headStream(stream, MAX_BYTES_TO_INSPECT);
        },
    });
    if (typeof bodyCopy?.destroy === "function") {
        bodyCopy.destroy();
    }
    const bodyStringTail = config.utf8Encoder(bodyBytes.subarray(bodyBytes.length - 16));
    if (bodyBytes.length === 0 && THROW_IF_EMPTY_BODY[context.commandName]) {
        const err = new Error("S3 aborted request");
        err.name = "InternalError";
        throw err;
    }
    if (bodyStringTail && bodyStringTail.endsWith("</Error>")) {
        response.statusCode = 400;
    }
    return result;
};
const collectBody = (streamBody = new Uint8Array(), context) => {
    if (streamBody instanceof Uint8Array) {
        return Promise.resolve(streamBody);
    }
    return context.streamCollector(streamBody) || Promise.resolve(new Uint8Array());
};
const throw200ExceptionsMiddlewareOptions = {
    relation: "after",
    toMiddleware: "deserializerMiddleware",
    tags: ["THROW_200_EXCEPTIONS", "S3"],
    name: "throw200ExceptionsMiddleware",
    override: true,
};
const getThrow200ExceptionsPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(throw200ExceptionsMiddleware(config), throw200ExceptionsMiddlewareOptions);
    },
});

const validate = (str) => typeof str === "string" && str.indexOf("arn:") === 0 && str.split(":").length >= 6;

function bucketEndpointMiddleware(options) {
    return (next, context) => async (args) => {
        if (options.bucketEndpoint) {
            const endpoint = context.endpointV2;
            if (endpoint) {
                const bucket = args.input.Bucket;
                if (typeof bucket === "string") {
                    try {
                        const bucketEndpointUrl = new URL(bucket);
                        context.endpointV2 = {
                            ...endpoint,
                            url: bucketEndpointUrl,
                        };
                    }
                    catch (e) {
                        const warning = `@aws-sdk/middleware-sdk-s3: bucketEndpoint=true was set but Bucket=${bucket} could not be parsed as URL.`;
                        if (context.logger?.constructor?.name === "NoOpLogger") {
                            console.warn(warning);
                        }
                        else {
                            context.logger?.warn?.(warning);
                        }
                        throw e;
                    }
                }
            }
        }
        return next(args);
    };
}
const bucketEndpointMiddlewareOptions = {
    name: "bucketEndpointMiddleware",
    override: true,
    relation: "after",
    toMiddleware: "endpointV2Middleware",
};

function validateBucketNameMiddleware({ bucketEndpoint }) {
    return (next) => async (args) => {
        const { input: { Bucket }, } = args;
        if (!bucketEndpoint && typeof Bucket === "string" && !validate(Bucket) && Bucket.indexOf("/") >= 0) {
            const err = new Error(`Bucket name shouldn't contain '/', received '${Bucket}'`);
            err.name = "InvalidBucketName";
            throw err;
        }
        return next({ ...args });
    };
}
const validateBucketNameMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BUCKET_NAME"],
    name: "validateBucketNameMiddleware",
    override: true,
};
const getValidateBucketNamePlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(validateBucketNameMiddleware(options), validateBucketNameMiddlewareOptions);
        clientStack.addRelativeTo(bucketEndpointMiddleware(options), bucketEndpointMiddlewareOptions);
    },
});

class S3RestXmlProtocol extends AwsRestXmlProtocol {
    async serializeRequest(operationSchema, input, context) {
        const request = await super.serializeRequest(operationSchema, input, context);
        const ns = NormalizedSchema.of(operationSchema.input);
        const staticStructureSchema = ns.getSchema();
        let bucketMemberIndex = 0;
        const requiredMemberCount = staticStructureSchema[6] ?? 0;
        if (input && typeof input === "object") {
            for (const [memberName, memberNs] of ns.structIterator()) {
                if (++bucketMemberIndex > requiredMemberCount) {
                    break;
                }
                if (memberName === "Bucket") {
                    if (!input.Bucket && memberNs.getMergedTraits().httpLabel) {
                        throw new Error(`No value provided for input HTTP label: Bucket.`);
                    }
                    break;
                }
            }
        }
        return request;
    }
}

const DEFAULT_UA_APP_ID = undefined;
function isValidUserAgentAppId(appId) {
    if (appId === undefined) {
        return true;
    }
    return typeof appId === "string" && appId.length <= 50;
}
function resolveUserAgentConfig(input) {
    const normalizedAppIdProvider = normalizeProvider(input.userAgentAppId ?? DEFAULT_UA_APP_ID);
    const { customUserAgent } = input;
    return Object.assign(input, {
        customUserAgent: typeof customUserAgent === "string" ? [[customUserAgent]] : customUserAgent,
        userAgentAppId: async () => {
            const appId = await normalizedAppIdProvider();
            if (!isValidUserAgentAppId(appId)) {
                const logger = input.logger?.constructor?.name === "NoOpLogger" || !input.logger ? console : input.logger;
                if (typeof appId !== "string") {
                    logger?.warn("userAgentAppId must be a string or undefined.");
                }
                else if (appId.length > 50) {
                    logger?.warn("The provided userAgentAppId exceeds the maximum length of 50 characters.");
                }
            }
            return appId;
        },
    });
}

class EndpointCache {
    capacity;
    data = new Map();
    parameters = [];
    constructor({ size, params }) {
        this.capacity = size ?? 50;
        if (params) {
            this.parameters = params;
        }
    }
    get(endpointParams, resolver) {
        const key = this.hash(endpointParams);
        if (key === false) {
            return resolver();
        }
        if (!this.data.has(key)) {
            if (this.data.size > this.capacity + 10) {
                const keys = this.data.keys();
                let i = 0;
                while (true) {
                    const { value, done } = keys.next();
                    this.data.delete(value);
                    if (done || ++i > 10) {
                        break;
                    }
                }
            }
            this.data.set(key, resolver());
        }
        return this.data.get(key);
    }
    size() {
        return this.data.size;
    }
    hash(endpointParams) {
        let buffer = "";
        const { parameters } = this;
        if (parameters.length === 0) {
            return false;
        }
        for (const param of parameters) {
            const val = String(endpointParams[param] ?? "");
            if (val.includes("|;")) {
                return false;
            }
            buffer += val + "|;";
        }
        return buffer;
    }
}

const IP_V4_REGEX = new RegExp(`^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}$`);
const isIpAddress = (value) => IP_V4_REGEX.test(value) || (value.startsWith("[") && value.endsWith("]"));

const VALID_HOST_LABEL_REGEX = new RegExp(`^(?!.*-$)(?!-)[a-zA-Z0-9-]{1,63}$`);
const isValidHostLabel = (value, allowSubDomains = false) => {
    if (!allowSubDomains) {
        return VALID_HOST_LABEL_REGEX.test(value);
    }
    const labels = value.split(".");
    for (const label of labels) {
        if (!isValidHostLabel(label)) {
            return false;
        }
    }
    return true;
};

const customEndpointFunctions = {};

const debugId = "endpoints";

function toDebugString(input) {
    if (typeof input !== "object" || input == null) {
        return input;
    }
    if ("ref" in input) {
        return `$${toDebugString(input.ref)}`;
    }
    if ("fn" in input) {
        return `${input.fn}(${(input.argv || []).map(toDebugString).join(", ")})`;
    }
    return JSON.stringify(input, null, 2);
}

class EndpointError extends Error {
    constructor(message) {
        super(message);
        this.name = "EndpointError";
    }
}

const booleanEquals = (value1, value2) => value1 === value2;

const getAttrPathList = (path) => {
    const parts = path.split(".");
    const pathList = [];
    for (const part of parts) {
        const squareBracketIndex = part.indexOf("[");
        if (squareBracketIndex !== -1) {
            if (part.indexOf("]") !== part.length - 1) {
                throw new EndpointError(`Path: '${path}' does not end with ']'`);
            }
            const arrayIndex = part.slice(squareBracketIndex + 1, -1);
            if (Number.isNaN(parseInt(arrayIndex))) {
                throw new EndpointError(`Invalid array index: '${arrayIndex}' in path: '${path}'`);
            }
            if (squareBracketIndex !== 0) {
                pathList.push(part.slice(0, squareBracketIndex));
            }
            pathList.push(arrayIndex);
        }
        else {
            pathList.push(part);
        }
    }
    return pathList;
};

const getAttr = (value, path) => getAttrPathList(path).reduce((acc, index) => {
    if (typeof acc !== "object") {
        throw new EndpointError(`Index '${index}' in '${path}' not found in '${JSON.stringify(value)}'`);
    }
    else if (Array.isArray(acc)) {
        return acc[parseInt(index)];
    }
    return acc[index];
}, value);

const isSet = (value) => value != null;

const not = (value) => !value;

const DEFAULT_PORTS = {
    [EndpointURLScheme.HTTP]: 80,
    [EndpointURLScheme.HTTPS]: 443,
};
const parseURL = (value) => {
    const whatwgURL = (() => {
        try {
            if (value instanceof URL) {
                return value;
            }
            if (typeof value === "object" && "hostname" in value) {
                const { hostname, port, protocol = "", path = "", query = {} } = value;
                const url = new URL(`${protocol}//${hostname}${port ? `:${port}` : ""}${path}`);
                url.search = Object.entries(query)
                    .map(([k, v]) => `${k}=${v}`)
                    .join("&");
                return url;
            }
            return new URL(value);
        }
        catch (error) {
            return null;
        }
    })();
    if (!whatwgURL) {
        console.error(`Unable to parse ${JSON.stringify(value)} as a whatwg URL.`);
        return null;
    }
    const urlString = whatwgURL.href;
    const { host, hostname, pathname, protocol, search } = whatwgURL;
    if (search) {
        return null;
    }
    const scheme = protocol.slice(0, -1);
    if (!Object.values(EndpointURLScheme).includes(scheme)) {
        return null;
    }
    const isIp = isIpAddress(hostname);
    const inputContainsDefaultPort = urlString.includes(`${host}:${DEFAULT_PORTS[scheme]}`) ||
        (typeof value === "string" && value.includes(`${host}:${DEFAULT_PORTS[scheme]}`));
    const authority = `${host}${inputContainsDefaultPort ? `:${DEFAULT_PORTS[scheme]}` : ``}`;
    return {
        scheme,
        authority,
        path: pathname,
        normalizedPath: pathname.endsWith("/") ? pathname : `${pathname}/`,
        isIp,
    };
};

const stringEquals = (value1, value2) => value1 === value2;

const substring = (input, start, stop, reverse) => {
    if (start >= stop || input.length < stop || /[^\u0000-\u007f]/.test(input)) {
        return null;
    }
    if (!reverse) {
        return input.substring(start, stop);
    }
    return input.substring(input.length - stop, input.length - start);
};

const uriEncode = (value) => encodeURIComponent(value).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const endpointFunctions = {
    booleanEquals,
    getAttr,
    isSet,
    isValidHostLabel,
    not,
    parseURL,
    stringEquals,
    substring,
    uriEncode,
};

const evaluateTemplate = (template, options) => {
    const evaluatedTemplateArr = [];
    const templateContext = {
        ...options.endpointParams,
        ...options.referenceRecord,
    };
    let currentIndex = 0;
    while (currentIndex < template.length) {
        const openingBraceIndex = template.indexOf("{", currentIndex);
        if (openingBraceIndex === -1) {
            evaluatedTemplateArr.push(template.slice(currentIndex));
            break;
        }
        evaluatedTemplateArr.push(template.slice(currentIndex, openingBraceIndex));
        const closingBraceIndex = template.indexOf("}", openingBraceIndex);
        if (closingBraceIndex === -1) {
            evaluatedTemplateArr.push(template.slice(openingBraceIndex));
            break;
        }
        if (template[openingBraceIndex + 1] === "{" && template[closingBraceIndex + 1] === "}") {
            evaluatedTemplateArr.push(template.slice(openingBraceIndex + 1, closingBraceIndex));
            currentIndex = closingBraceIndex + 2;
        }
        const parameterName = template.substring(openingBraceIndex + 1, closingBraceIndex);
        if (parameterName.includes("#")) {
            const [refName, attrName] = parameterName.split("#");
            evaluatedTemplateArr.push(getAttr(templateContext[refName], attrName));
        }
        else {
            evaluatedTemplateArr.push(templateContext[parameterName]);
        }
        currentIndex = closingBraceIndex + 1;
    }
    return evaluatedTemplateArr.join("");
};

const getReferenceValue = ({ ref }, options) => {
    const referenceRecord = {
        ...options.endpointParams,
        ...options.referenceRecord,
    };
    return referenceRecord[ref];
};

const evaluateExpression = (obj, keyName, options) => {
    if (typeof obj === "string") {
        return evaluateTemplate(obj, options);
    }
    else if (obj["fn"]) {
        return group$2.callFunction(obj, options);
    }
    else if (obj["ref"]) {
        return getReferenceValue(obj, options);
    }
    throw new EndpointError(`'${keyName}': ${String(obj)} is not a string, function or reference.`);
};
const callFunction = ({ fn, argv }, options) => {
    const evaluatedArgs = argv.map((arg) => ["boolean", "number"].includes(typeof arg) ? arg : group$2.evaluateExpression(arg, "arg", options));
    const fnSegments = fn.split(".");
    if (fnSegments[0] in customEndpointFunctions && fnSegments[1] != null) {
        return customEndpointFunctions[fnSegments[0]][fnSegments[1]](...evaluatedArgs);
    }
    return endpointFunctions[fn](...evaluatedArgs);
};
const group$2 = {
    evaluateExpression,
    callFunction,
};

const evaluateCondition = ({ assign, ...fnArgs }, options) => {
    if (assign && assign in options.referenceRecord) {
        throw new EndpointError(`'${assign}' is already defined in Reference Record.`);
    }
    const value = callFunction(fnArgs, options);
    options.logger?.debug?.(`${debugId} evaluateCondition: ${toDebugString(fnArgs)} = ${toDebugString(value)}`);
    return {
        result: value === "" ? true : !!value,
        ...(assign != null && { toAssign: { name: assign, value } }),
    };
};

const evaluateConditions = (conditions = [], options) => {
    const conditionsReferenceRecord = {};
    for (const condition of conditions) {
        const { result, toAssign } = evaluateCondition(condition, {
            ...options,
            referenceRecord: {
                ...options.referenceRecord,
                ...conditionsReferenceRecord,
            },
        });
        if (!result) {
            return { result };
        }
        if (toAssign) {
            conditionsReferenceRecord[toAssign.name] = toAssign.value;
            options.logger?.debug?.(`${debugId} assign: ${toAssign.name} := ${toDebugString(toAssign.value)}`);
        }
    }
    return { result: true, referenceRecord: conditionsReferenceRecord };
};

const getEndpointHeaders = (headers, options) => Object.entries(headers).reduce((acc, [headerKey, headerVal]) => ({
    ...acc,
    [headerKey]: headerVal.map((headerValEntry) => {
        const processedExpr = evaluateExpression(headerValEntry, "Header value entry", options);
        if (typeof processedExpr !== "string") {
            throw new EndpointError(`Header '${headerKey}' value '${processedExpr}' is not a string`);
        }
        return processedExpr;
    }),
}), {});

const getEndpointProperties = (properties, options) => Object.entries(properties).reduce((acc, [propertyKey, propertyVal]) => ({
    ...acc,
    [propertyKey]: group$1.getEndpointProperty(propertyVal, options),
}), {});
const getEndpointProperty = (property, options) => {
    if (Array.isArray(property)) {
        return property.map((propertyEntry) => getEndpointProperty(propertyEntry, options));
    }
    switch (typeof property) {
        case "string":
            return evaluateTemplate(property, options);
        case "object":
            if (property === null) {
                throw new EndpointError(`Unexpected endpoint property: ${property}`);
            }
            return group$1.getEndpointProperties(property, options);
        case "boolean":
            return property;
        default:
            throw new EndpointError(`Unexpected endpoint property type: ${typeof property}`);
    }
};
const group$1 = {
    getEndpointProperty,
    getEndpointProperties,
};

const getEndpointUrl = (endpointUrl, options) => {
    const expression = evaluateExpression(endpointUrl, "Endpoint URL", options);
    if (typeof expression === "string") {
        try {
            return new URL(expression);
        }
        catch (error) {
            console.error(`Failed to construct URL with ${expression}`, error);
            throw error;
        }
    }
    throw new EndpointError(`Endpoint URL must be a string, got ${typeof expression}`);
};

const evaluateEndpointRule = (endpointRule, options) => {
    const { conditions, endpoint } = endpointRule;
    const { result, referenceRecord } = evaluateConditions(conditions, options);
    if (!result) {
        return;
    }
    const endpointRuleOptions = {
        ...options,
        referenceRecord: { ...options.referenceRecord, ...referenceRecord },
    };
    const { url, properties, headers } = endpoint;
    options.logger?.debug?.(`${debugId} Resolving endpoint from template: ${toDebugString(endpoint)}`);
    return {
        ...(headers != undefined && {
            headers: getEndpointHeaders(headers, endpointRuleOptions),
        }),
        ...(properties != undefined && {
            properties: getEndpointProperties(properties, endpointRuleOptions),
        }),
        url: getEndpointUrl(url, endpointRuleOptions),
    };
};

const evaluateErrorRule = (errorRule, options) => {
    const { conditions, error } = errorRule;
    const { result, referenceRecord } = evaluateConditions(conditions, options);
    if (!result) {
        return;
    }
    throw new EndpointError(evaluateExpression(error, "Error", {
        ...options,
        referenceRecord: { ...options.referenceRecord, ...referenceRecord },
    }));
};

const evaluateRules = (rules, options) => {
    for (const rule of rules) {
        if (rule.type === "endpoint") {
            const endpointOrUndefined = evaluateEndpointRule(rule, options);
            if (endpointOrUndefined) {
                return endpointOrUndefined;
            }
        }
        else if (rule.type === "error") {
            evaluateErrorRule(rule, options);
        }
        else if (rule.type === "tree") {
            const endpointOrUndefined = group.evaluateTreeRule(rule, options);
            if (endpointOrUndefined) {
                return endpointOrUndefined;
            }
        }
        else {
            throw new EndpointError(`Unknown endpoint rule: ${rule}`);
        }
    }
    throw new EndpointError(`Rules evaluation failed`);
};
const evaluateTreeRule = (treeRule, options) => {
    const { conditions, rules } = treeRule;
    const { result, referenceRecord } = evaluateConditions(conditions, options);
    if (!result) {
        return;
    }
    return group.evaluateRules(rules, {
        ...options,
        referenceRecord: { ...options.referenceRecord, ...referenceRecord },
    });
};
const group = {
    evaluateRules,
    evaluateTreeRule,
};

const resolveEndpoint = (ruleSetObject, options) => {
    const { endpointParams, logger } = options;
    const { parameters, rules } = ruleSetObject;
    options.logger?.debug?.(`${debugId} Initial EndpointParams: ${toDebugString(endpointParams)}`);
    const paramsWithDefault = Object.entries(parameters)
        .filter(([, v]) => v.default != null)
        .map(([k, v]) => [k, v.default]);
    if (paramsWithDefault.length > 0) {
        for (const [paramKey, paramDefaultValue] of paramsWithDefault) {
            endpointParams[paramKey] = endpointParams[paramKey] ?? paramDefaultValue;
        }
    }
    const requiredParams = Object.entries(parameters)
        .filter(([, v]) => v.required)
        .map(([k]) => k);
    for (const requiredParam of requiredParams) {
        if (endpointParams[requiredParam] == null) {
            throw new EndpointError(`Missing required parameter: '${requiredParam}'`);
        }
    }
    const endpoint = evaluateRules(rules, { endpointParams, logger, referenceRecord: {} });
    options.logger?.debug?.(`${debugId} Resolved endpoint: ${toDebugString(endpoint)}`);
    return endpoint;
};

const isVirtualHostableS3Bucket = (value, allowSubDomains = false) => {
    if (allowSubDomains) {
        for (const label of value.split(".")) {
            if (!isVirtualHostableS3Bucket(label)) {
                return false;
            }
        }
        return true;
    }
    if (!isValidHostLabel(value)) {
        return false;
    }
    if (value.length < 3 || value.length > 63) {
        return false;
    }
    if (value !== value.toLowerCase()) {
        return false;
    }
    if (isIpAddress(value)) {
        return false;
    }
    return true;
};

const ARN_DELIMITER = ":";
const RESOURCE_DELIMITER = "/";
const parseArn = (value) => {
    const segments = value.split(ARN_DELIMITER);
    if (segments.length < 6)
        return null;
    const [arn, partition, service, region, accountId, ...resourcePath] = segments;
    if (arn !== "arn" || partition === "" || service === "" || resourcePath.join(ARN_DELIMITER) === "")
        return null;
    const resourceId = resourcePath.map((resource) => resource.split(RESOURCE_DELIMITER)).flat();
    return {
        partition,
        service,
        region,
        accountId,
        resourceId,
    };
};

var partitions = [
	{
		id: "aws",
		outputs: {
			dnsSuffix: "amazonaws.com",
			dualStackDnsSuffix: "api.aws",
			implicitGlobalRegion: "us-east-1",
			name: "aws",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^(us|eu|ap|sa|ca|me|af|il|mx)\\-\\w+\\-\\d+$",
		regions: {
			"af-south-1": {
				description: "Africa (Cape Town)"
			},
			"ap-east-1": {
				description: "Asia Pacific (Hong Kong)"
			},
			"ap-east-2": {
				description: "Asia Pacific (Taipei)"
			},
			"ap-northeast-1": {
				description: "Asia Pacific (Tokyo)"
			},
			"ap-northeast-2": {
				description: "Asia Pacific (Seoul)"
			},
			"ap-northeast-3": {
				description: "Asia Pacific (Osaka)"
			},
			"ap-south-1": {
				description: "Asia Pacific (Mumbai)"
			},
			"ap-south-2": {
				description: "Asia Pacific (Hyderabad)"
			},
			"ap-southeast-1": {
				description: "Asia Pacific (Singapore)"
			},
			"ap-southeast-2": {
				description: "Asia Pacific (Sydney)"
			},
			"ap-southeast-3": {
				description: "Asia Pacific (Jakarta)"
			},
			"ap-southeast-4": {
				description: "Asia Pacific (Melbourne)"
			},
			"ap-southeast-5": {
				description: "Asia Pacific (Malaysia)"
			},
			"ap-southeast-6": {
				description: "Asia Pacific (New Zealand)"
			},
			"ap-southeast-7": {
				description: "Asia Pacific (Thailand)"
			},
			"aws-global": {
				description: "aws global region"
			},
			"ca-central-1": {
				description: "Canada (Central)"
			},
			"ca-west-1": {
				description: "Canada West (Calgary)"
			},
			"eu-central-1": {
				description: "Europe (Frankfurt)"
			},
			"eu-central-2": {
				description: "Europe (Zurich)"
			},
			"eu-north-1": {
				description: "Europe (Stockholm)"
			},
			"eu-south-1": {
				description: "Europe (Milan)"
			},
			"eu-south-2": {
				description: "Europe (Spain)"
			},
			"eu-west-1": {
				description: "Europe (Ireland)"
			},
			"eu-west-2": {
				description: "Europe (London)"
			},
			"eu-west-3": {
				description: "Europe (Paris)"
			},
			"il-central-1": {
				description: "Israel (Tel Aviv)"
			},
			"me-central-1": {
				description: "Middle East (UAE)"
			},
			"me-south-1": {
				description: "Middle East (Bahrain)"
			},
			"mx-central-1": {
				description: "Mexico (Central)"
			},
			"sa-east-1": {
				description: "South America (Sao Paulo)"
			},
			"us-east-1": {
				description: "US East (N. Virginia)"
			},
			"us-east-2": {
				description: "US East (Ohio)"
			},
			"us-west-1": {
				description: "US West (N. California)"
			},
			"us-west-2": {
				description: "US West (Oregon)"
			}
		}
	},
	{
		id: "aws-cn",
		outputs: {
			dnsSuffix: "amazonaws.com.cn",
			dualStackDnsSuffix: "api.amazonwebservices.com.cn",
			implicitGlobalRegion: "cn-northwest-1",
			name: "aws-cn",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^cn\\-\\w+\\-\\d+$",
		regions: {
			"aws-cn-global": {
				description: "aws-cn global region"
			},
			"cn-north-1": {
				description: "China (Beijing)"
			},
			"cn-northwest-1": {
				description: "China (Ningxia)"
			}
		}
	},
	{
		id: "aws-eusc",
		outputs: {
			dnsSuffix: "amazonaws.eu",
			dualStackDnsSuffix: "api.amazonwebservices.eu",
			implicitGlobalRegion: "eusc-de-east-1",
			name: "aws-eusc",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^eusc\\-(de)\\-\\w+\\-\\d+$",
		regions: {
			"eusc-de-east-1": {
				description: "AWS European Sovereign Cloud (Germany)"
			}
		}
	},
	{
		id: "aws-iso",
		outputs: {
			dnsSuffix: "c2s.ic.gov",
			dualStackDnsSuffix: "api.aws.ic.gov",
			implicitGlobalRegion: "us-iso-east-1",
			name: "aws-iso",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^us\\-iso\\-\\w+\\-\\d+$",
		regions: {
			"aws-iso-global": {
				description: "aws-iso global region"
			},
			"us-iso-east-1": {
				description: "US ISO East"
			},
			"us-iso-west-1": {
				description: "US ISO WEST"
			}
		}
	},
	{
		id: "aws-iso-b",
		outputs: {
			dnsSuffix: "sc2s.sgov.gov",
			dualStackDnsSuffix: "api.aws.scloud",
			implicitGlobalRegion: "us-isob-east-1",
			name: "aws-iso-b",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^us\\-isob\\-\\w+\\-\\d+$",
		regions: {
			"aws-iso-b-global": {
				description: "aws-iso-b global region"
			},
			"us-isob-east-1": {
				description: "US ISOB East (Ohio)"
			},
			"us-isob-west-1": {
				description: "US ISOB West"
			}
		}
	},
	{
		id: "aws-iso-e",
		outputs: {
			dnsSuffix: "cloud.adc-e.uk",
			dualStackDnsSuffix: "api.cloud-aws.adc-e.uk",
			implicitGlobalRegion: "eu-isoe-west-1",
			name: "aws-iso-e",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^eu\\-isoe\\-\\w+\\-\\d+$",
		regions: {
			"aws-iso-e-global": {
				description: "aws-iso-e global region"
			},
			"eu-isoe-west-1": {
				description: "EU ISOE West"
			}
		}
	},
	{
		id: "aws-iso-f",
		outputs: {
			dnsSuffix: "csp.hci.ic.gov",
			dualStackDnsSuffix: "api.aws.hci.ic.gov",
			implicitGlobalRegion: "us-isof-south-1",
			name: "aws-iso-f",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^us\\-isof\\-\\w+\\-\\d+$",
		regions: {
			"aws-iso-f-global": {
				description: "aws-iso-f global region"
			},
			"us-isof-east-1": {
				description: "US ISOF EAST"
			},
			"us-isof-south-1": {
				description: "US ISOF SOUTH"
			}
		}
	},
	{
		id: "aws-us-gov",
		outputs: {
			dnsSuffix: "amazonaws.com",
			dualStackDnsSuffix: "api.aws",
			implicitGlobalRegion: "us-gov-west-1",
			name: "aws-us-gov",
			supportsDualStack: true,
			supportsFIPS: true
		},
		regionRegex: "^us\\-gov\\-\\w+\\-\\d+$",
		regions: {
			"aws-us-gov-global": {
				description: "aws-us-gov global region"
			},
			"us-gov-east-1": {
				description: "AWS GovCloud (US-East)"
			},
			"us-gov-west-1": {
				description: "AWS GovCloud (US-West)"
			}
		}
	}
];
var partitionsInfo = {
	partitions: partitions};

let selectedPartitionsInfo = partitionsInfo;
const partition = (value) => {
    const { partitions } = selectedPartitionsInfo;
    for (const partition of partitions) {
        const { regions, outputs } = partition;
        for (const [region, regionData] of Object.entries(regions)) {
            if (region === value) {
                return {
                    ...outputs,
                    ...regionData,
                };
            }
        }
    }
    for (const partition of partitions) {
        const { regionRegex, outputs } = partition;
        if (new RegExp(regionRegex).test(value)) {
            return {
                ...outputs,
            };
        }
    }
    const DEFAULT_PARTITION = partitions.find((partition) => partition.id === "aws");
    if (!DEFAULT_PARTITION) {
        throw new Error("Provided region was not found in the partition array or regex," +
            " and default partition with id 'aws' doesn't exist.");
    }
    return {
        ...DEFAULT_PARTITION.outputs,
    };
};

const awsEndpointFunctions = {
    isVirtualHostableS3Bucket: isVirtualHostableS3Bucket,
    parseArn: parseArn,
    partition: partition,
};
customEndpointFunctions.aws = awsEndpointFunctions;

var RETRY_MODES;
(function (RETRY_MODES) {
    RETRY_MODES["STANDARD"] = "standard";
    RETRY_MODES["ADAPTIVE"] = "adaptive";
})(RETRY_MODES || (RETRY_MODES = {}));
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_MODE = RETRY_MODES.STANDARD;

const THROTTLING_ERROR_CODES = [
    "BandwidthLimitExceeded",
    "EC2ThrottledException",
    "LimitExceededException",
    "PriorRequestNotComplete",
    "ProvisionedThroughputExceededException",
    "RequestLimitExceeded",
    "RequestThrottled",
    "RequestThrottledException",
    "SlowDown",
    "ThrottledException",
    "Throttling",
    "ThrottlingException",
    "TooManyRequestsException",
    "TransactionInProgressException",
];
const TRANSIENT_ERROR_CODES = ["TimeoutError", "RequestTimeout", "RequestTimeoutException"];
const TRANSIENT_ERROR_STATUS_CODES = [500, 502, 503, 504];
const NODEJS_TIMEOUT_ERROR_CODES = ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"];
const NODEJS_NETWORK_ERROR_CODES = ["EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND"];

const isRetryableByTrait = (error) => error?.$retryable !== undefined;
const isClockSkewCorrectedError = (error) => error.$metadata?.clockSkewCorrected;
const isBrowserNetworkError = (error) => {
    const errorMessages = new Set([
        "Failed to fetch",
        "NetworkError when attempting to fetch resource",
        "The Internet connection appears to be offline",
        "Load failed",
        "Network request failed",
    ]);
    const isValid = error && error instanceof TypeError;
    if (!isValid) {
        return false;
    }
    return errorMessages.has(error.message);
};
const isThrottlingError = (error) => error.$metadata?.httpStatusCode === 429 ||
    THROTTLING_ERROR_CODES.includes(error.name) ||
    error.$retryable?.throttling == true;
const isTransientError = (error, depth = 0) => isRetryableByTrait(error) ||
    isClockSkewCorrectedError(error) ||
    TRANSIENT_ERROR_CODES.includes(error.name) ||
    NODEJS_TIMEOUT_ERROR_CODES.includes(error?.code || "") ||
    NODEJS_NETWORK_ERROR_CODES.includes(error?.code || "") ||
    TRANSIENT_ERROR_STATUS_CODES.includes(error.$metadata?.httpStatusCode || 0) ||
    isBrowserNetworkError(error) ||
    (error.cause !== undefined && depth <= 10 && isTransientError(error.cause, depth + 1));
const isServerError = (error) => {
    if (error.$metadata?.httpStatusCode !== undefined) {
        const statusCode = error.$metadata.httpStatusCode;
        if (500 <= statusCode && statusCode <= 599 && !isTransientError(error)) {
            return true;
        }
        return false;
    }
    return false;
};

class DefaultRateLimiter {
    static setTimeoutFn = setTimeout;
    beta;
    minCapacity;
    minFillRate;
    scaleConstant;
    smooth;
    currentCapacity = 0;
    enabled = false;
    lastMaxRate = 0;
    measuredTxRate = 0;
    requestCount = 0;
    fillRate;
    lastThrottleTime;
    lastTimestamp = 0;
    lastTxRateBucket;
    maxCapacity;
    timeWindow = 0;
    constructor(options) {
        this.beta = options?.beta ?? 0.7;
        this.minCapacity = options?.minCapacity ?? 1;
        this.minFillRate = options?.minFillRate ?? 0.5;
        this.scaleConstant = options?.scaleConstant ?? 0.4;
        this.smooth = options?.smooth ?? 0.8;
        const currentTimeInSeconds = this.getCurrentTimeInSeconds();
        this.lastThrottleTime = currentTimeInSeconds;
        this.lastTxRateBucket = Math.floor(this.getCurrentTimeInSeconds());
        this.fillRate = this.minFillRate;
        this.maxCapacity = this.minCapacity;
    }
    getCurrentTimeInSeconds() {
        return Date.now() / 1000;
    }
    async getSendToken() {
        return this.acquireTokenBucket(1);
    }
    async acquireTokenBucket(amount) {
        if (!this.enabled) {
            return;
        }
        this.refillTokenBucket();
        if (amount > this.currentCapacity) {
            const delay = ((amount - this.currentCapacity) / this.fillRate) * 1000;
            await new Promise((resolve) => DefaultRateLimiter.setTimeoutFn(resolve, delay));
        }
        this.currentCapacity = this.currentCapacity - amount;
    }
    refillTokenBucket() {
        const timestamp = this.getCurrentTimeInSeconds();
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
            return;
        }
        const fillAmount = (timestamp - this.lastTimestamp) * this.fillRate;
        this.currentCapacity = Math.min(this.maxCapacity, this.currentCapacity + fillAmount);
        this.lastTimestamp = timestamp;
    }
    updateClientSendingRate(response) {
        let calculatedRate;
        this.updateMeasuredRate();
        if (isThrottlingError(response)) {
            const rateToUse = !this.enabled ? this.measuredTxRate : Math.min(this.measuredTxRate, this.fillRate);
            this.lastMaxRate = rateToUse;
            this.calculateTimeWindow();
            this.lastThrottleTime = this.getCurrentTimeInSeconds();
            calculatedRate = this.cubicThrottle(rateToUse);
            this.enableTokenBucket();
        }
        else {
            this.calculateTimeWindow();
            calculatedRate = this.cubicSuccess(this.getCurrentTimeInSeconds());
        }
        const newRate = Math.min(calculatedRate, 2 * this.measuredTxRate);
        this.updateTokenBucketRate(newRate);
    }
    calculateTimeWindow() {
        this.timeWindow = this.getPrecise(Math.pow((this.lastMaxRate * (1 - this.beta)) / this.scaleConstant, 1 / 3));
    }
    cubicThrottle(rateToUse) {
        return this.getPrecise(rateToUse * this.beta);
    }
    cubicSuccess(timestamp) {
        return this.getPrecise(this.scaleConstant * Math.pow(timestamp - this.lastThrottleTime - this.timeWindow, 3) + this.lastMaxRate);
    }
    enableTokenBucket() {
        this.enabled = true;
    }
    updateTokenBucketRate(newRate) {
        this.refillTokenBucket();
        this.fillRate = Math.max(newRate, this.minFillRate);
        this.maxCapacity = Math.max(newRate, this.minCapacity);
        this.currentCapacity = Math.min(this.currentCapacity, this.maxCapacity);
    }
    updateMeasuredRate() {
        const t = this.getCurrentTimeInSeconds();
        const timeBucket = Math.floor(t * 2) / 2;
        this.requestCount++;
        if (timeBucket > this.lastTxRateBucket) {
            const currentRate = this.requestCount / (timeBucket - this.lastTxRateBucket);
            this.measuredTxRate = this.getPrecise(currentRate * this.smooth + this.measuredTxRate * (1 - this.smooth));
            this.requestCount = 0;
            this.lastTxRateBucket = timeBucket;
        }
    }
    getPrecise(num) {
        return parseFloat(num.toFixed(8));
    }
}

const DEFAULT_RETRY_DELAY_BASE = 100;
const MAXIMUM_RETRY_DELAY = 20 * 1000;
const THROTTLING_RETRY_DELAY_BASE = 500;
const INITIAL_RETRY_TOKENS = 500;
const RETRY_COST = 5;
const TIMEOUT_RETRY_COST = 10;
const NO_RETRY_INCREMENT = 1;
const INVOCATION_ID_HEADER = "amz-sdk-invocation-id";
const REQUEST_HEADER = "amz-sdk-request";

const getDefaultRetryBackoffStrategy = () => {
    let delayBase = DEFAULT_RETRY_DELAY_BASE;
    const computeNextBackoffDelay = (attempts) => {
        return Math.floor(Math.min(MAXIMUM_RETRY_DELAY, Math.random() * 2 ** attempts * delayBase));
    };
    const setDelayBase = (delay) => {
        delayBase = delay;
    };
    return {
        computeNextBackoffDelay,
        setDelayBase,
    };
};

const createDefaultRetryToken = ({ retryDelay, retryCount, retryCost, }) => {
    const getRetryCount = () => retryCount;
    const getRetryDelay = () => Math.min(MAXIMUM_RETRY_DELAY, retryDelay);
    const getRetryCost = () => retryCost;
    return {
        getRetryCount,
        getRetryDelay,
        getRetryCost,
    };
};

class StandardRetryStrategy {
    maxAttempts;
    mode = RETRY_MODES.STANDARD;
    capacity = INITIAL_RETRY_TOKENS;
    retryBackoffStrategy = getDefaultRetryBackoffStrategy();
    maxAttemptsProvider;
    constructor(maxAttempts) {
        this.maxAttempts = maxAttempts;
        this.maxAttemptsProvider = typeof maxAttempts === "function" ? maxAttempts : async () => maxAttempts;
    }
    async acquireInitialRetryToken(retryTokenScope) {
        return createDefaultRetryToken({
            retryDelay: DEFAULT_RETRY_DELAY_BASE,
            retryCount: 0,
        });
    }
    async refreshRetryTokenForRetry(token, errorInfo) {
        const maxAttempts = await this.getMaxAttempts();
        if (this.shouldRetry(token, errorInfo, maxAttempts)) {
            const errorType = errorInfo.errorType;
            this.retryBackoffStrategy.setDelayBase(errorType === "THROTTLING" ? THROTTLING_RETRY_DELAY_BASE : DEFAULT_RETRY_DELAY_BASE);
            const delayFromErrorType = this.retryBackoffStrategy.computeNextBackoffDelay(token.getRetryCount());
            const retryDelay = errorInfo.retryAfterHint
                ? Math.max(errorInfo.retryAfterHint.getTime() - Date.now() || 0, delayFromErrorType)
                : delayFromErrorType;
            const capacityCost = this.getCapacityCost(errorType);
            this.capacity -= capacityCost;
            return createDefaultRetryToken({
                retryDelay,
                retryCount: token.getRetryCount() + 1,
                retryCost: capacityCost,
            });
        }
        throw new Error("No retry token available");
    }
    recordSuccess(token) {
        this.capacity = Math.max(INITIAL_RETRY_TOKENS, this.capacity + (token.getRetryCost() ?? NO_RETRY_INCREMENT));
    }
    getCapacity() {
        return this.capacity;
    }
    async getMaxAttempts() {
        try {
            return await this.maxAttemptsProvider();
        }
        catch (error) {
            console.warn(`Max attempts provider could not resolve. Using default of ${DEFAULT_MAX_ATTEMPTS}`);
            return DEFAULT_MAX_ATTEMPTS;
        }
    }
    shouldRetry(tokenToRenew, errorInfo, maxAttempts) {
        const attempts = tokenToRenew.getRetryCount() + 1;
        return (attempts < maxAttempts &&
            this.capacity >= this.getCapacityCost(errorInfo.errorType) &&
            this.isRetryableError(errorInfo.errorType));
    }
    getCapacityCost(errorType) {
        return errorType === "TRANSIENT" ? TIMEOUT_RETRY_COST : RETRY_COST;
    }
    isRetryableError(errorType) {
        return errorType === "THROTTLING" || errorType === "TRANSIENT";
    }
}

class AdaptiveRetryStrategy {
    maxAttemptsProvider;
    rateLimiter;
    standardRetryStrategy;
    mode = RETRY_MODES.ADAPTIVE;
    constructor(maxAttemptsProvider, options) {
        this.maxAttemptsProvider = maxAttemptsProvider;
        const { rateLimiter } = options ?? {};
        this.rateLimiter = rateLimiter ?? new DefaultRateLimiter();
        this.standardRetryStrategy = new StandardRetryStrategy(maxAttemptsProvider);
    }
    async acquireInitialRetryToken(retryTokenScope) {
        await this.rateLimiter.getSendToken();
        return this.standardRetryStrategy.acquireInitialRetryToken(retryTokenScope);
    }
    async refreshRetryTokenForRetry(tokenToRenew, errorInfo) {
        this.rateLimiter.updateClientSendingRate(errorInfo);
        return this.standardRetryStrategy.refreshRetryTokenForRetry(tokenToRenew, errorInfo);
    }
    recordSuccess(token) {
        this.rateLimiter.updateClientSendingRate({});
        this.standardRetryStrategy.recordSuccess(token);
    }
}

const ACCOUNT_ID_ENDPOINT_REGEX = /\d{12}\.ddb/;
async function checkFeatures(context, config, args) {
    const request = args.request;
    if (request?.headers?.["smithy-protocol"] === "rpc-v2-cbor") {
        setFeature$1(context, "PROTOCOL_RPC_V2_CBOR", "M");
    }
    if (typeof config.retryStrategy === "function") {
        const retryStrategy = await config.retryStrategy();
        if (typeof retryStrategy.mode === "string") {
            switch (retryStrategy.mode) {
                case RETRY_MODES.ADAPTIVE:
                    setFeature$1(context, "RETRY_MODE_ADAPTIVE", "F");
                    break;
                case RETRY_MODES.STANDARD:
                    setFeature$1(context, "RETRY_MODE_STANDARD", "E");
                    break;
            }
        }
    }
    if (typeof config.accountIdEndpointMode === "function") {
        const endpointV2 = context.endpointV2;
        if (String(endpointV2?.url?.hostname).match(ACCOUNT_ID_ENDPOINT_REGEX)) {
            setFeature$1(context, "ACCOUNT_ID_ENDPOINT", "O");
        }
        switch (await config.accountIdEndpointMode?.()) {
            case "disabled":
                setFeature$1(context, "ACCOUNT_ID_MODE_DISABLED", "Q");
                break;
            case "preferred":
                setFeature$1(context, "ACCOUNT_ID_MODE_PREFERRED", "P");
                break;
            case "required":
                setFeature$1(context, "ACCOUNT_ID_MODE_REQUIRED", "R");
                break;
        }
    }
    const identity = context.__smithy_context?.selectedHttpAuthScheme?.identity;
    if (identity?.$source) {
        const credentials = identity;
        if (credentials.accountId) {
            setFeature$1(context, "RESOLVED_ACCOUNT_ID", "T");
        }
        for (const [key, value] of Object.entries(credentials.$source ?? {})) {
            setFeature$1(context, key, value);
        }
    }
}

const USER_AGENT = "user-agent";
const X_AMZ_USER_AGENT = "x-amz-user-agent";
const SPACE = " ";
const UA_NAME_SEPARATOR = "/";
const UA_NAME_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w]/g;
const UA_VALUE_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w#]/g;
const UA_ESCAPE_CHAR = "-";

const BYTE_LIMIT = 1024;
function encodeFeatures(features) {
    let buffer = "";
    for (const key in features) {
        const val = features[key];
        if (buffer.length + val.length + 1 <= BYTE_LIMIT) {
            if (buffer.length) {
                buffer += "," + val;
            }
            else {
                buffer += val;
            }
            continue;
        }
        break;
    }
    return buffer;
}

const userAgentMiddleware = (options) => (next, context) => async (args) => {
    const { request } = args;
    if (!HttpRequest.isInstance(request)) {
        return next(args);
    }
    const { headers } = request;
    const userAgent = context?.userAgent?.map(escapeUserAgent) || [];
    const defaultUserAgent = (await options.defaultUserAgentProvider()).map(escapeUserAgent);
    await checkFeatures(context, options, args);
    const awsContext = context;
    defaultUserAgent.push(`m/${encodeFeatures(Object.assign({}, context.__smithy_context?.features, awsContext.__aws_sdk_context?.features))}`);
    const customUserAgent = options?.customUserAgent?.map(escapeUserAgent) || [];
    const appId = await options.userAgentAppId();
    if (appId) {
        defaultUserAgent.push(escapeUserAgent([`app`, `${appId}`]));
    }
    const sdkUserAgentValue = ([])
        .concat([...defaultUserAgent, ...userAgent, ...customUserAgent])
        .join(SPACE);
    const normalUAValue = [
        ...defaultUserAgent.filter((section) => section.startsWith("aws-sdk-")),
        ...customUserAgent,
    ].join(SPACE);
    if (options.runtime !== "browser") {
        if (normalUAValue) {
            headers[X_AMZ_USER_AGENT] = headers[X_AMZ_USER_AGENT]
                ? `${headers[USER_AGENT]} ${normalUAValue}`
                : normalUAValue;
        }
        headers[USER_AGENT] = sdkUserAgentValue;
    }
    else {
        headers[X_AMZ_USER_AGENT] = sdkUserAgentValue;
    }
    return next({
        ...args,
        request,
    });
};
const escapeUserAgent = (userAgentPair) => {
    const name = userAgentPair[0]
        .split(UA_NAME_SEPARATOR)
        .map((part) => part.replace(UA_NAME_ESCAPE_REGEX, UA_ESCAPE_CHAR))
        .join(UA_NAME_SEPARATOR);
    const version = userAgentPair[1]?.replace(UA_VALUE_ESCAPE_REGEX, UA_ESCAPE_CHAR);
    const prefixSeparatorIndex = name.indexOf(UA_NAME_SEPARATOR);
    const prefix = name.substring(0, prefixSeparatorIndex);
    let uaName = name.substring(prefixSeparatorIndex + 1);
    if (prefix === "api") {
        uaName = uaName.toLowerCase();
    }
    return [prefix, uaName, version]
        .filter((item) => item && item.length > 0)
        .reduce((acc, item, index) => {
        switch (index) {
            case 0:
                return item;
            case 1:
                return `${acc}/${item}`;
            default:
                return `${acc}#${item}`;
        }
    }, "");
};
const getUserAgentMiddlewareOptions = {
    name: "getUserAgentMiddleware",
    step: "build",
    priority: "low",
    tags: ["SET_USER_AGENT", "USER_AGENT"],
    override: true,
};
const getUserAgentPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(userAgentMiddleware(config), getUserAgentMiddlewareOptions);
    },
});

const DEFAULT_USE_DUALSTACK_ENDPOINT = false;

const DEFAULT_USE_FIPS_ENDPOINT = false;

const validRegions = new Set();
const checkRegion = (region, check = isValidHostLabel) => {
    if (!validRegions.has(region) && !check(region)) {
        if (region === "*") {
            console.warn(`@smithy/config-resolver WARN - Please use the caller region instead of "*". See "sigv4a" in https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/CLIENTS.md.`);
        }
        else {
            throw new Error(`Region not accepted: region="${region}" is not a valid hostname component.`);
        }
    }
    else {
        validRegions.add(region);
    }
};

const isFipsRegion = (region) => typeof region === "string" && (region.startsWith("fips-") || region.endsWith("-fips"));

const getRealRegion = (region) => isFipsRegion(region)
    ? ["fips-aws-global", "aws-fips"].includes(region)
        ? "us-east-1"
        : region.replace(/fips-(dkr-|prod-)?|-fips/, "")
    : region;

const resolveRegionConfig = (input) => {
    const { region, useFipsEndpoint } = input;
    if (!region) {
        throw new Error("Region is missing");
    }
    return Object.assign(input, {
        region: async () => {
            const providedRegion = typeof region === "function" ? await region() : region;
            const realRegion = getRealRegion(providedRegion);
            checkRegion(realRegion);
            return realRegion;
        },
        useFipsEndpoint: async () => {
            const providedRegion = typeof region === "string" ? region : await region();
            if (isFipsRegion(providedRegion)) {
                return true;
            }
            return typeof useFipsEndpoint !== "function" ? Promise.resolve(!!useFipsEndpoint) : useFipsEndpoint();
        },
    });
};

const resolveEventStreamSerdeConfig = (input) => Object.assign(input, {
    eventStreamMarshaller: input.eventStreamSerdeProvider(input),
});

const CONTENT_LENGTH_HEADER = "content-length";
function contentLengthMiddleware(bodyLengthChecker) {
    return (next) => async (args) => {
        const request = args.request;
        if (HttpRequest.isInstance(request)) {
            const { body, headers } = request;
            if (body &&
                Object.keys(headers)
                    .map((str) => str.toLowerCase())
                    .indexOf(CONTENT_LENGTH_HEADER) === -1) {
                try {
                    const length = bodyLengthChecker(body);
                    request.headers = {
                        ...request.headers,
                        [CONTENT_LENGTH_HEADER]: String(length),
                    };
                }
                catch (error) {
                }
            }
        }
        return next({
            ...args,
            request,
        });
    };
}
const contentLengthMiddlewareOptions = {
    step: "build",
    tags: ["SET_CONTENT_LENGTH", "CONTENT_LENGTH"],
    name: "contentLengthMiddleware",
    override: true,
};
const getContentLengthPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(contentLengthMiddleware(options.bodyLengthChecker), contentLengthMiddlewareOptions);
    },
});

const endpointMiddleware = ({ config, instructions, }) => {
    return (next, context) => async (args) => {
        if (config.isCustomEndpoint) {
            setFeature(context, "ENDPOINT_OVERRIDE", "N");
        }
        const endpoint = await getEndpointFromInstructions(args.input, {
            getEndpointParameterInstructions() {
                return instructions;
            },
        }, { ...config }, context);
        context.endpointV2 = endpoint;
        context.authSchemes = endpoint.properties?.authSchemes;
        const authScheme = context.authSchemes?.[0];
        if (authScheme) {
            context["signing_region"] = authScheme.signingRegion;
            context["signing_service"] = authScheme.signingName;
            const smithyContext = getSmithyContext(context);
            const httpAuthOption = smithyContext?.selectedHttpAuthScheme?.httpAuthOption;
            if (httpAuthOption) {
                httpAuthOption.signingProperties = Object.assign(httpAuthOption.signingProperties || {}, {
                    signing_region: authScheme.signingRegion,
                    signingRegion: authScheme.signingRegion,
                    signing_service: authScheme.signingName,
                    signingName: authScheme.signingName,
                    signingRegionSet: authScheme.signingRegionSet,
                }, authScheme.properties);
            }
        }
        return next({
            ...args,
        });
    };
};

const serializerMiddlewareOption = {
    name: "serializerMiddleware"};

const endpointMiddlewareOptions = {
    step: "serialize",
    tags: ["ENDPOINT_PARAMETERS", "ENDPOINT_V2", "ENDPOINT"],
    name: "endpointV2Middleware",
    override: true,
    relation: "before",
    toMiddleware: serializerMiddlewareOption.name,
};
const getEndpointPlugin = (config, instructions) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(endpointMiddleware({
            config,
            instructions,
        }), endpointMiddlewareOptions);
    },
});

const resolveEndpointConfig = (input) => {
    const tls = input.tls ?? true;
    const { endpoint, useDualstackEndpoint, useFipsEndpoint } = input;
    const customEndpointProvider = endpoint != null ? async () => toEndpointV1$1(await normalizeProvider$1(endpoint)()) : undefined;
    const isCustomEndpoint = !!endpoint;
    const resolvedConfig = Object.assign(input, {
        endpoint: customEndpointProvider,
        tls,
        isCustomEndpoint,
        useDualstackEndpoint: normalizeProvider$1(useDualstackEndpoint ?? false),
        useFipsEndpoint: normalizeProvider$1(useFipsEndpoint ?? false),
    });
    let configuredEndpointPromise = undefined;
    resolvedConfig.serviceConfiguredEndpoint = async () => {
        if (input.serviceId && !configuredEndpointPromise) {
            configuredEndpointPromise = getEndpointFromConfig(input.serviceId);
        }
        return configuredEndpointPromise;
    };
    return resolvedConfig;
};

const asSdkError = (error) => {
    if (error instanceof Error)
        return error;
    if (error instanceof Object)
        return Object.assign(new Error(), error);
    if (typeof error === "string")
        return new Error(error);
    return new Error(`AWS SDK error wrapper for ${error}`);
};

const resolveRetryConfig = (input) => {
    const { retryStrategy, retryMode } = input;
    const maxAttempts = normalizeProvider$1(input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    let controller = retryStrategy
        ? Promise.resolve(retryStrategy)
        : undefined;
    const getDefault = async () => (await normalizeProvider$1(retryMode)()) === RETRY_MODES.ADAPTIVE
        ? new AdaptiveRetryStrategy(maxAttempts)
        : new StandardRetryStrategy(maxAttempts);
    return Object.assign(input, {
        maxAttempts,
        retryStrategy: () => (controller ??= getDefault()),
    });
};

const isStreamingPayload = (request) => request?.body instanceof ReadableStream;

const retryMiddleware = (options) => (next, context) => async (args) => {
    let retryStrategy = await options.retryStrategy();
    const maxAttempts = await options.maxAttempts();
    if (isRetryStrategyV2(retryStrategy)) {
        retryStrategy = retryStrategy;
        let retryToken = await retryStrategy.acquireInitialRetryToken(context["partition_id"]);
        let lastError = new Error();
        let attempts = 0;
        let totalRetryDelay = 0;
        const { request } = args;
        const isRequest = HttpRequest.isInstance(request);
        if (isRequest) {
            request.headers[INVOCATION_ID_HEADER] = v4();
        }
        while (true) {
            try {
                if (isRequest) {
                    request.headers[REQUEST_HEADER] = `attempt=${attempts + 1}; max=${maxAttempts}`;
                }
                const { response, output } = await next(args);
                retryStrategy.recordSuccess(retryToken);
                output.$metadata.attempts = attempts + 1;
                output.$metadata.totalRetryDelay = totalRetryDelay;
                return { response, output };
            }
            catch (e) {
                const retryErrorInfo = getRetryErrorInfo(e);
                lastError = asSdkError(e);
                if (isRequest && isStreamingPayload(request)) {
                    (context.logger instanceof NoOpLogger ? console : context.logger)?.warn("An error was encountered in a non-retryable streaming request.");
                    throw lastError;
                }
                try {
                    retryToken = await retryStrategy.refreshRetryTokenForRetry(retryToken, retryErrorInfo);
                }
                catch (refreshError) {
                    if (!lastError.$metadata) {
                        lastError.$metadata = {};
                    }
                    lastError.$metadata.attempts = attempts + 1;
                    lastError.$metadata.totalRetryDelay = totalRetryDelay;
                    throw lastError;
                }
                attempts = retryToken.getRetryCount();
                const delay = retryToken.getRetryDelay();
                totalRetryDelay += delay;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    else {
        retryStrategy = retryStrategy;
        if (retryStrategy?.mode)
            context.userAgent = [...(context.userAgent || []), ["cfg/retry-mode", retryStrategy.mode]];
        return retryStrategy.retry(next, args);
    }
};
const isRetryStrategyV2 = (retryStrategy) => typeof retryStrategy.acquireInitialRetryToken !== "undefined" &&
    typeof retryStrategy.refreshRetryTokenForRetry !== "undefined" &&
    typeof retryStrategy.recordSuccess !== "undefined";
const getRetryErrorInfo = (error) => {
    const errorInfo = {
        error,
        errorType: getRetryErrorType(error),
    };
    const retryAfterHint = getRetryAfterHint(error.$response);
    if (retryAfterHint) {
        errorInfo.retryAfterHint = retryAfterHint;
    }
    return errorInfo;
};
const getRetryErrorType = (error) => {
    if (isThrottlingError(error))
        return "THROTTLING";
    if (isTransientError(error))
        return "TRANSIENT";
    if (isServerError(error))
        return "SERVER_ERROR";
    return "CLIENT_ERROR";
};
const retryMiddlewareOptions = {
    name: "retryMiddleware",
    tags: ["RETRY"],
    step: "finalizeRequest",
    priority: "high",
    override: true,
};
const getRetryPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(retryMiddleware(options), retryMiddlewareOptions);
    },
});
const getRetryAfterHint = (response) => {
    if (!HttpResponse.isInstance(response))
        return;
    const retryAfterHeaderName = Object.keys(response.headers).find((key) => key.toLowerCase() === "retry-after");
    if (!retryAfterHeaderName)
        return;
    const retryAfter = response.headers[retryAfterHeaderName];
    const retryAfterSeconds = Number(retryAfter);
    if (!Number.isNaN(retryAfterSeconds))
        return new Date(retryAfterSeconds * 1000);
    const retryAfterDate = new Date(retryAfter);
    return retryAfterDate;
};

const cs = "required", ct = "type", cu = "rules", cv = "conditions", cw = "fn", cx = "argv", cy = "ref", cz = "assign", cA = "url", cB = "properties", cC = "backend", cD = "authSchemes", cE = "disableDoubleEncoding", cF = "signingName", cG = "signingRegion", cH = "headers", cI = "signingRegionSet";
const a = 6, b = false, c = true, d = "isSet", e = "booleanEquals", f = "error", g = "aws.partition", h = "stringEquals", i = "getAttr", j = "name", k = "substring", l = "bucketSuffix", m = "parseURL", n = "endpoint", o = "tree", p = "aws.isVirtualHostableS3Bucket", q = "{url#scheme}://{Bucket}.{url#authority}{url#path}", r = "not", s = "accessPointSuffix", t = "{url#scheme}://{url#authority}{url#path}", u = "hardwareType", v = "regionPrefix", w = "bucketAliasSuffix", x = "outpostId", y = "isValidHostLabel", z = "sigv4a", A = "s3-outposts", B = "s3", C = "{url#scheme}://{url#authority}{url#normalizedPath}{Bucket}", D = "https://{Bucket}.s3-accelerate.{partitionResult#dnsSuffix}", E = "https://{Bucket}.s3.{partitionResult#dnsSuffix}", F = "aws.parseArn", G = "bucketArn", H = "arnType", I = "", J = "s3-object-lambda", K = "accesspoint", L = "accessPointName", M = "{url#scheme}://{accessPointName}-{bucketArn#accountId}.{url#authority}{url#path}", N = "mrapPartition", O = "outpostType", P = "arnPrefix", Q = "{url#scheme}://{url#authority}{url#normalizedPath}{uri_encoded_bucket}", R = "https://s3.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", S = "https://s3.{partitionResult#dnsSuffix}", T = { [cs]: false, [ct]: "string" }, U = { [cs]: true, "default": false, [ct]: "boolean" }, V = { [cs]: false, [ct]: "boolean" }, W = { [cw]: e, [cx]: [{ [cy]: "Accelerate" }, true] }, X = { [cw]: e, [cx]: [{ [cy]: "UseFIPS" }, true] }, Y = { [cw]: e, [cx]: [{ [cy]: "UseDualStack" }, true] }, Z = { [cw]: d, [cx]: [{ [cy]: "Endpoint" }] }, aa = { [cw]: g, [cx]: [{ [cy]: "Region" }], [cz]: "partitionResult" }, ab = { [cw]: h, [cx]: [{ [cw]: i, [cx]: [{ [cy]: "partitionResult" }, j] }, "aws-cn"] }, ac = { [cw]: d, [cx]: [{ [cy]: "Bucket" }] }, ad = { [cy]: "Bucket" }, ae = { [cv]: [W], [f]: "S3Express does not support S3 Accelerate.", [ct]: f }, af = { [cv]: [Z, { [cw]: m, [cx]: [{ [cy]: "Endpoint" }], [cz]: "url" }], [cu]: [{ [cv]: [{ [cw]: d, [cx]: [{ [cy]: "DisableS3ExpressSessionAuth" }] }, { [cw]: e, [cx]: [{ [cy]: "DisableS3ExpressSessionAuth" }, true] }], [cu]: [{ [cv]: [{ [cw]: e, [cx]: [{ [cw]: i, [cx]: [{ [cy]: "url" }, "isIp"] }, true] }], [cu]: [{ [cv]: [{ [cw]: "uriEncode", [cx]: [ad], [cz]: "uri_encoded_bucket" }], [cu]: [{ [n]: { [cA]: "{url#scheme}://{url#authority}/{uri_encoded_bucket}{url#path}", [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }], [ct]: o }], [ct]: o }, { [cv]: [{ [cw]: p, [cx]: [ad, false] }], [cu]: [{ [n]: { [cA]: q, [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }], [ct]: o }, { [f]: "S3Express bucket name is not a valid virtual hostable name.", [ct]: f }], [ct]: o }, { [cv]: [{ [cw]: e, [cx]: [{ [cw]: i, [cx]: [{ [cy]: "url" }, "isIp"] }, true] }], [cu]: [{ [cv]: [{ [cw]: "uriEncode", [cx]: [ad], [cz]: "uri_encoded_bucket" }], [cu]: [{ [n]: { [cA]: "{url#scheme}://{url#authority}/{uri_encoded_bucket}{url#path}", [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4-s3express", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }], [ct]: o }], [ct]: o }, { [cv]: [{ [cw]: p, [cx]: [ad, false] }], [cu]: [{ [n]: { [cA]: q, [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4-s3express", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }], [ct]: o }, { [f]: "S3Express bucket name is not a valid virtual hostable name.", [ct]: f }], [ct]: o }, ag = { [cw]: m, [cx]: [{ [cy]: "Endpoint" }], [cz]: "url" }, ah = { [cw]: e, [cx]: [{ [cw]: i, [cx]: [{ [cy]: "url" }, "isIp"] }, true] }, ai = { [cy]: "url" }, aj = { [cw]: "uriEncode", [cx]: [ad], [cz]: "uri_encoded_bucket" }, ak = { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: "s3express", [cG]: "{Region}" }] }, al = {}, am = { [cw]: p, [cx]: [ad, false] }, an = { [f]: "S3Express bucket name is not a valid virtual hostable name.", [ct]: f }, ao = { [cw]: d, [cx]: [{ [cy]: "UseS3ExpressControlEndpoint" }] }, ap = { [cw]: e, [cx]: [{ [cy]: "UseS3ExpressControlEndpoint" }, true] }, aq = { [cw]: r, [cx]: [Z] }, ar = { [cw]: e, [cx]: [{ [cy]: "UseDualStack" }, false] }, as = { [cw]: e, [cx]: [{ [cy]: "UseFIPS" }, false] }, at = { [f]: "Unrecognized S3Express bucket name format.", [ct]: f }, au = { [cw]: r, [cx]: [ac] }, av = { [cy]: u }, aw = { [cv]: [aq], [f]: "Expected a endpoint to be specified but no endpoint was found", [ct]: f }, ax = { [cD]: [{ [cE]: true, [j]: z, [cF]: A, [cI]: ["*"] }, { [cE]: true, [j]: "sigv4", [cF]: A, [cG]: "{Region}" }] }, ay = { [cw]: e, [cx]: [{ [cy]: "ForcePathStyle" }, false] }, az = { [cy]: "ForcePathStyle" }, aA = { [cw]: e, [cx]: [{ [cy]: "Accelerate" }, false] }, aB = { [cw]: h, [cx]: [{ [cy]: "Region" }, "aws-global"] }, aC = { [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: B, [cG]: "us-east-1" }] }, aD = { [cw]: r, [cx]: [aB] }, aE = { [cw]: e, [cx]: [{ [cy]: "UseGlobalEndpoint" }, true] }, aF = { [cA]: "https://{Bucket}.s3-fips.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: { [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: B, [cG]: "{Region}" }] }, [cH]: {} }, aG = { [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: B, [cG]: "{Region}" }] }, aH = { [cw]: e, [cx]: [{ [cy]: "UseGlobalEndpoint" }, false] }, aI = { [cA]: "https://{Bucket}.s3-fips.{Region}.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, aJ = { [cA]: "https://{Bucket}.s3-accelerate.dualstack.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, aK = { [cA]: "https://{Bucket}.s3.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, aL = { [cw]: e, [cx]: [{ [cw]: i, [cx]: [ai, "isIp"] }, false] }, aM = { [cA]: C, [cB]: aG, [cH]: {} }, aN = { [cA]: q, [cB]: aG, [cH]: {} }, aO = { [n]: aN, [ct]: n }, aP = { [cA]: D, [cB]: aG, [cH]: {} }, aQ = { [cA]: "https://{Bucket}.s3.{Region}.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, aR = { [f]: "Invalid region: region was not a valid DNS name.", [ct]: f }, aS = { [cy]: G }, aT = { [cy]: H }, aU = { [cw]: i, [cx]: [aS, "service"] }, aV = { [cy]: L }, aW = { [cv]: [Y], [f]: "S3 Object Lambda does not support Dual-stack", [ct]: f }, aX = { [cv]: [W], [f]: "S3 Object Lambda does not support S3 Accelerate", [ct]: f }, aY = { [cv]: [{ [cw]: d, [cx]: [{ [cy]: "DisableAccessPoints" }] }, { [cw]: e, [cx]: [{ [cy]: "DisableAccessPoints" }, true] }], [f]: "Access points are not supported for this operation", [ct]: f }, aZ = { [cv]: [{ [cw]: d, [cx]: [{ [cy]: "UseArnRegion" }] }, { [cw]: e, [cx]: [{ [cy]: "UseArnRegion" }, false] }, { [cw]: r, [cx]: [{ [cw]: h, [cx]: [{ [cw]: i, [cx]: [aS, "region"] }, "{Region}"] }] }], [f]: "Invalid configuration: region from ARN `{bucketArn#region}` does not match client region `{Region}` and UseArnRegion is `false`", [ct]: f }, ba = { [cw]: i, [cx]: [{ [cy]: "bucketPartition" }, j] }, bb = { [cw]: i, [cx]: [aS, "accountId"] }, bc = { [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: J, [cG]: "{bucketArn#region}" }] }, bd = { [f]: "Invalid ARN: The access point name may only contain a-z, A-Z, 0-9 and `-`. Found: `{accessPointName}`", [ct]: f }, be = { [f]: "Invalid ARN: The account id may only contain a-z, A-Z, 0-9 and `-`. Found: `{bucketArn#accountId}`", [ct]: f }, bf = { [f]: "Invalid region in ARN: `{bucketArn#region}` (invalid DNS name)", [ct]: f }, bg = { [f]: "Client was configured for partition `{partitionResult#name}` but ARN (`{Bucket}`) has `{bucketPartition#name}`", [ct]: f }, bh = { [f]: "Invalid ARN: The ARN may only contain a single resource component after `accesspoint`.", [ct]: f }, bi = { [f]: "Invalid ARN: Expected a resource of the format `accesspoint:<accesspoint name>` but no name was provided", [ct]: f }, bj = { [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: B, [cG]: "{bucketArn#region}" }] }, bk = { [cD]: [{ [cE]: true, [j]: z, [cF]: A, [cI]: ["*"] }, { [cE]: true, [j]: "sigv4", [cF]: A, [cG]: "{bucketArn#region}" }] }, bl = { [cw]: F, [cx]: [ad] }, bm = { [cA]: "https://s3-fips.dualstack.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: aG, [cH]: {} }, bn = { [cA]: "https://s3-fips.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: aG, [cH]: {} }, bo = { [cA]: "https://s3.dualstack.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: aG, [cH]: {} }, bp = { [cA]: Q, [cB]: aG, [cH]: {} }, bq = { [cA]: "https://s3.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: aG, [cH]: {} }, br = { [cy]: "UseObjectLambdaEndpoint" }, bs = { [cD]: [{ [cE]: true, [j]: "sigv4", [cF]: J, [cG]: "{Region}" }] }, bt = { [cA]: "https://s3-fips.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, bu = { [cA]: "https://s3-fips.{Region}.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, bv = { [cA]: "https://s3.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, bw = { [cA]: t, [cB]: aG, [cH]: {} }, bx = { [cA]: "https://s3.{Region}.{partitionResult#dnsSuffix}", [cB]: aG, [cH]: {} }, by = [{ [cy]: "Region" }], bz = [{ [cy]: "Endpoint" }], bA = [ad], bB = [W], bC = [Z, ag], bD = [{ [cw]: d, [cx]: [{ [cy]: "DisableS3ExpressSessionAuth" }] }, { [cw]: e, [cx]: [{ [cy]: "DisableS3ExpressSessionAuth" }, true] }], bE = [aj], bF = [am], bG = [aa], bH = [X, Y], bI = [X, ar], bJ = [as, Y], bK = [as, ar], bL = [{ [cw]: k, [cx]: [ad, 6, 14, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 14, 16, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bM = [{ [cv]: [X, Y], [n]: { [cA]: "https://{Bucket}.s3express-fips-{s3expressAvailabilityZoneId}.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: {} }, [ct]: n }, { [cv]: bI, [n]: { [cA]: "https://{Bucket}.s3express-fips-{s3expressAvailabilityZoneId}.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: {} }, [ct]: n }, { [cv]: bJ, [n]: { [cA]: "https://{Bucket}.s3express-{s3expressAvailabilityZoneId}.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: {} }, [ct]: n }, { [cv]: bK, [n]: { [cA]: "https://{Bucket}.s3express-{s3expressAvailabilityZoneId}.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: {} }, [ct]: n }], bN = [{ [cw]: k, [cx]: [ad, 6, 15, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 15, 17, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bO = [{ [cw]: k, [cx]: [ad, 6, 19, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 19, 21, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bP = [{ [cw]: k, [cx]: [ad, 6, 20, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 20, 22, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bQ = [{ [cw]: k, [cx]: [ad, 6, 26, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 26, 28, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bR = [{ [cv]: [X, Y], [n]: { [cA]: "https://{Bucket}.s3express-fips-{s3expressAvailabilityZoneId}.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4-s3express", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }, { [cv]: bI, [n]: { [cA]: "https://{Bucket}.s3express-fips-{s3expressAvailabilityZoneId}.{Region}.{partitionResult#dnsSuffix}", [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4-s3express", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }, { [cv]: bJ, [n]: { [cA]: "https://{Bucket}.s3express-{s3expressAvailabilityZoneId}.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4-s3express", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }, { [cv]: bK, [n]: { [cA]: "https://{Bucket}.s3express-{s3expressAvailabilityZoneId}.{Region}.{partitionResult#dnsSuffix}", [cB]: { [cC]: "S3Express", [cD]: [{ [cE]: true, [j]: "sigv4-s3express", [cF]: "s3express", [cG]: "{Region}" }] }, [cH]: {} }, [ct]: n }], bS = [ad, 0, 7, true], bT = [{ [cw]: k, [cx]: [ad, 7, 15, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 15, 17, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bU = [{ [cw]: k, [cx]: [ad, 7, 16, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 16, 18, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bV = [{ [cw]: k, [cx]: [ad, 7, 20, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 20, 22, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bW = [{ [cw]: k, [cx]: [ad, 7, 21, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 21, 23, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bX = [{ [cw]: k, [cx]: [ad, 7, 27, true], [cz]: "s3expressAvailabilityZoneId" }, { [cw]: k, [cx]: [ad, 27, 29, true], [cz]: "s3expressAvailabilityZoneDelim" }, { [cw]: h, [cx]: [{ [cy]: "s3expressAvailabilityZoneDelim" }, "--"] }], bY = [ac], bZ = [{ [cw]: y, [cx]: [{ [cy]: x }, false] }], ca = [{ [cw]: h, [cx]: [{ [cy]: v }, "beta"] }], cb = ["*"], cc = [{ [cw]: y, [cx]: [{ [cy]: "Region" }, false] }], cd = [{ [cw]: h, [cx]: [{ [cy]: "Region" }, "us-east-1"] }], ce = [{ [cw]: h, [cx]: [aT, K] }], cf = [{ [cw]: i, [cx]: [aS, "resourceId[1]"], [cz]: L }, { [cw]: r, [cx]: [{ [cw]: h, [cx]: [aV, I] }] }], cg = [aS, "resourceId[1]"], ch = [Y], ci = [{ [cw]: r, [cx]: [{ [cw]: h, [cx]: [{ [cw]: i, [cx]: [aS, "region"] }, I] }] }], cj = [{ [cw]: r, [cx]: [{ [cw]: d, [cx]: [{ [cw]: i, [cx]: [aS, "resourceId[2]"] }] }] }], ck = [aS, "resourceId[2]"], cl = [{ [cw]: g, [cx]: [{ [cw]: i, [cx]: [aS, "region"] }], [cz]: "bucketPartition" }], cm = [{ [cw]: h, [cx]: [ba, { [cw]: i, [cx]: [{ [cy]: "partitionResult" }, j] }] }], cn = [{ [cw]: y, [cx]: [{ [cw]: i, [cx]: [aS, "region"] }, true] }], co = [{ [cw]: y, [cx]: [bb, false] }], cp = [{ [cw]: y, [cx]: [aV, false] }], cq = [X], cr = [{ [cw]: y, [cx]: [{ [cy]: "Region" }, true] }];
const _data = { parameters: { Bucket: T, Region: T, UseFIPS: U, UseDualStack: U, Endpoint: T, ForcePathStyle: U, Accelerate: U, UseGlobalEndpoint: U, UseObjectLambdaEndpoint: V, Key: T, Prefix: T, CopySource: T, DisableAccessPoints: V, DisableMultiRegionAccessPoints: U, UseArnRegion: V, UseS3ExpressControlEndpoint: V, DisableS3ExpressSessionAuth: V }, [cu]: [{ [cv]: [{ [cw]: d, [cx]: by }], [cu]: [{ [cv]: [W, X], error: "Accelerate cannot be used with FIPS", [ct]: f }, { [cv]: [Y, Z], error: "Cannot set dual-stack in combination with a custom endpoint.", [ct]: f }, { [cv]: [Z, X], error: "A custom endpoint cannot be combined with FIPS", [ct]: f }, { [cv]: [Z, W], error: "A custom endpoint cannot be combined with S3 Accelerate", [ct]: f }, { [cv]: [X, aa, ab], error: "Partition does not support FIPS", [ct]: f }, { [cv]: [ac, { [cw]: k, [cx]: [ad, 0, a, c], [cz]: l }, { [cw]: h, [cx]: [{ [cy]: l }, "--x-s3"] }], [cu]: [ae, af, { [cv]: [ao, ap], [cu]: [{ [cv]: bG, [cu]: [{ [cv]: [aj, aq], [cu]: [{ [cv]: bH, endpoint: { [cA]: "https://s3express-control-fips.dualstack.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: ak, [cH]: al }, [ct]: n }, { [cv]: bI, endpoint: { [cA]: "https://s3express-control-fips.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: ak, [cH]: al }, [ct]: n }, { [cv]: bJ, endpoint: { [cA]: "https://s3express-control.dualstack.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: ak, [cH]: al }, [ct]: n }, { [cv]: bK, endpoint: { [cA]: "https://s3express-control.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: ak, [cH]: al }, [ct]: n }], [ct]: o }], [ct]: o }], [ct]: o }, { [cv]: bF, [cu]: [{ [cv]: bG, [cu]: [{ [cv]: bD, [cu]: [{ [cv]: bL, [cu]: bM, [ct]: o }, { [cv]: bN, [cu]: bM, [ct]: o }, { [cv]: bO, [cu]: bM, [ct]: o }, { [cv]: bP, [cu]: bM, [ct]: o }, { [cv]: bQ, [cu]: bM, [ct]: o }, at], [ct]: o }, { [cv]: bL, [cu]: bR, [ct]: o }, { [cv]: bN, [cu]: bR, [ct]: o }, { [cv]: bO, [cu]: bR, [ct]: o }, { [cv]: bP, [cu]: bR, [ct]: o }, { [cv]: bQ, [cu]: bR, [ct]: o }, at], [ct]: o }], [ct]: o }, an], [ct]: o }, { [cv]: [ac, { [cw]: k, [cx]: bS, [cz]: s }, { [cw]: h, [cx]: [{ [cy]: s }, "--xa-s3"] }], [cu]: [ae, af, { [cv]: bF, [cu]: [{ [cv]: bG, [cu]: [{ [cv]: bD, [cu]: [{ [cv]: bT, [cu]: bM, [ct]: o }, { [cv]: bU, [cu]: bM, [ct]: o }, { [cv]: bV, [cu]: bM, [ct]: o }, { [cv]: bW, [cu]: bM, [ct]: o }, { [cv]: bX, [cu]: bM, [ct]: o }, at], [ct]: o }, { [cv]: bT, [cu]: bR, [ct]: o }, { [cv]: bU, [cu]: bR, [ct]: o }, { [cv]: bV, [cu]: bR, [ct]: o }, { [cv]: bW, [cu]: bR, [ct]: o }, { [cv]: bX, [cu]: bR, [ct]: o }, at], [ct]: o }], [ct]: o }, an], [ct]: o }, { [cv]: [au, ao, ap], [cu]: [{ [cv]: bG, [cu]: [{ [cv]: bC, endpoint: { [cA]: t, [cB]: ak, [cH]: al }, [ct]: n }, { [cv]: bH, endpoint: { [cA]: "https://s3express-control-fips.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: al }, [ct]: n }, { [cv]: bI, endpoint: { [cA]: "https://s3express-control-fips.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: al }, [ct]: n }, { [cv]: bJ, endpoint: { [cA]: "https://s3express-control.dualstack.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: al }, [ct]: n }, { [cv]: bK, endpoint: { [cA]: "https://s3express-control.{Region}.{partitionResult#dnsSuffix}", [cB]: ak, [cH]: al }, [ct]: n }], [ct]: o }], [ct]: o }, { [cv]: [ac, { [cw]: k, [cx]: [ad, 49, 50, c], [cz]: u }, { [cw]: k, [cx]: [ad, 8, 12, c], [cz]: v }, { [cw]: k, [cx]: bS, [cz]: w }, { [cw]: k, [cx]: [ad, 32, 49, c], [cz]: x }, { [cw]: g, [cx]: by, [cz]: "regionPartition" }, { [cw]: h, [cx]: [{ [cy]: w }, "--op-s3"] }], [cu]: [{ [cv]: bZ, [cu]: [{ [cv]: bF, [cu]: [{ [cv]: [{ [cw]: h, [cx]: [av, "e"] }], [cu]: [{ [cv]: ca, [cu]: [aw, { [cv]: bC, endpoint: { [cA]: "https://{Bucket}.ec2.{url#authority}", [cB]: ax, [cH]: al }, [ct]: n }], [ct]: o }, { endpoint: { [cA]: "https://{Bucket}.ec2.s3-outposts.{Region}.{regionPartition#dnsSuffix}", [cB]: ax, [cH]: al }, [ct]: n }], [ct]: o }, { [cv]: [{ [cw]: h, [cx]: [av, "o"] }], [cu]: [{ [cv]: ca, [cu]: [aw, { [cv]: bC, endpoint: { [cA]: "https://{Bucket}.op-{outpostId}.{url#authority}", [cB]: ax, [cH]: al }, [ct]: n }], [ct]: o }, { endpoint: { [cA]: "https://{Bucket}.op-{outpostId}.s3-outposts.{Region}.{regionPartition#dnsSuffix}", [cB]: ax, [cH]: al }, [ct]: n }], [ct]: o }, { error: "Unrecognized hardware type: \"Expected hardware type o or e but got {hardwareType}\"", [ct]: f }], [ct]: o }, { error: "Invalid Outposts Bucket alias - it must be a valid bucket name.", [ct]: f }], [ct]: o }, { error: "Invalid ARN: The outpost Id must only contain a-z, A-Z, 0-9 and `-`.", [ct]: f }], [ct]: o }, { [cv]: bY, [cu]: [{ [cv]: [Z, { [cw]: r, [cx]: [{ [cw]: d, [cx]: [{ [cw]: m, [cx]: bz }] }] }], error: "Custom endpoint `{Endpoint}` was not a valid URI", [ct]: f }, { [cv]: [ay, am], [cu]: [{ [cv]: bG, [cu]: [{ [cv]: cc, [cu]: [{ [cv]: [W, ab], error: "S3 Accelerate cannot be used in this region", [ct]: f }, { [cv]: [Y, X, aA, aq, aB], endpoint: { [cA]: "https://{Bucket}.s3-fips.dualstack.us-east-1.{partitionResult#dnsSuffix}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [Y, X, aA, aq, aD, aE], [cu]: [{ endpoint: aF, [ct]: n }], [ct]: o }, { [cv]: [Y, X, aA, aq, aD, aH], endpoint: aF, [ct]: n }, { [cv]: [ar, X, aA, aq, aB], endpoint: { [cA]: "https://{Bucket}.s3-fips.us-east-1.{partitionResult#dnsSuffix}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, X, aA, aq, aD, aE], [cu]: [{ endpoint: aI, [ct]: n }], [ct]: o }, { [cv]: [ar, X, aA, aq, aD, aH], endpoint: aI, [ct]: n }, { [cv]: [Y, as, W, aq, aB], endpoint: { [cA]: "https://{Bucket}.s3-accelerate.dualstack.us-east-1.{partitionResult#dnsSuffix}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [Y, as, W, aq, aD, aE], [cu]: [{ endpoint: aJ, [ct]: n }], [ct]: o }, { [cv]: [Y, as, W, aq, aD, aH], endpoint: aJ, [ct]: n }, { [cv]: [Y, as, aA, aq, aB], endpoint: { [cA]: "https://{Bucket}.s3.dualstack.us-east-1.{partitionResult#dnsSuffix}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [Y, as, aA, aq, aD, aE], [cu]: [{ endpoint: aK, [ct]: n }], [ct]: o }, { [cv]: [Y, as, aA, aq, aD, aH], endpoint: aK, [ct]: n }, { [cv]: [ar, as, aA, Z, ag, ah, aB], endpoint: { [cA]: C, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, as, aA, Z, ag, aL, aB], endpoint: { [cA]: q, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, as, aA, Z, ag, ah, aD, aE], [cu]: [{ [cv]: cd, endpoint: aM, [ct]: n }, { endpoint: aM, [ct]: n }], [ct]: o }, { [cv]: [ar, as, aA, Z, ag, aL, aD, aE], [cu]: [{ [cv]: cd, endpoint: aN, [ct]: n }, aO], [ct]: o }, { [cv]: [ar, as, aA, Z, ag, ah, aD, aH], endpoint: aM, [ct]: n }, { [cv]: [ar, as, aA, Z, ag, aL, aD, aH], endpoint: aN, [ct]: n }, { [cv]: [ar, as, W, aq, aB], endpoint: { [cA]: D, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, as, W, aq, aD, aE], [cu]: [{ [cv]: cd, endpoint: aP, [ct]: n }, { endpoint: aP, [ct]: n }], [ct]: o }, { [cv]: [ar, as, W, aq, aD, aH], endpoint: aP, [ct]: n }, { [cv]: [ar, as, aA, aq, aB], endpoint: { [cA]: E, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, as, aA, aq, aD, aE], [cu]: [{ [cv]: cd, endpoint: { [cA]: E, [cB]: aG, [cH]: al }, [ct]: n }, { endpoint: aQ, [ct]: n }], [ct]: o }, { [cv]: [ar, as, aA, aq, aD, aH], endpoint: aQ, [ct]: n }], [ct]: o }, aR], [ct]: o }], [ct]: o }, { [cv]: [Z, ag, { [cw]: h, [cx]: [{ [cw]: i, [cx]: [ai, "scheme"] }, "http"] }, { [cw]: p, [cx]: [ad, c] }, ay, as, ar, aA], [cu]: [{ [cv]: bG, [cu]: [{ [cv]: cc, [cu]: [aO], [ct]: o }, aR], [ct]: o }], [ct]: o }, { [cv]: [ay, { [cw]: F, [cx]: bA, [cz]: G }], [cu]: [{ [cv]: [{ [cw]: i, [cx]: [aS, "resourceId[0]"], [cz]: H }, { [cw]: r, [cx]: [{ [cw]: h, [cx]: [aT, I] }] }], [cu]: [{ [cv]: [{ [cw]: h, [cx]: [aU, J] }], [cu]: [{ [cv]: ce, [cu]: [{ [cv]: cf, [cu]: [aW, aX, { [cv]: ci, [cu]: [aY, { [cv]: cj, [cu]: [aZ, { [cv]: cl, [cu]: [{ [cv]: bG, [cu]: [{ [cv]: cm, [cu]: [{ [cv]: cn, [cu]: [{ [cv]: [{ [cw]: h, [cx]: [bb, I] }], error: "Invalid ARN: Missing account id", [ct]: f }, { [cv]: co, [cu]: [{ [cv]: cp, [cu]: [{ [cv]: bC, endpoint: { [cA]: M, [cB]: bc, [cH]: al }, [ct]: n }, { [cv]: cq, endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.s3-object-lambda-fips.{bucketArn#region}.{bucketPartition#dnsSuffix}", [cB]: bc, [cH]: al }, [ct]: n }, { endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.s3-object-lambda.{bucketArn#region}.{bucketPartition#dnsSuffix}", [cB]: bc, [cH]: al }, [ct]: n }], [ct]: o }, bd], [ct]: o }, be], [ct]: o }, bf], [ct]: o }, bg], [ct]: o }], [ct]: o }], [ct]: o }, bh], [ct]: o }, { error: "Invalid ARN: bucket ARN is missing a region", [ct]: f }], [ct]: o }, bi], [ct]: o }, { error: "Invalid ARN: Object Lambda ARNs only support `accesspoint` arn types, but found: `{arnType}`", [ct]: f }], [ct]: o }, { [cv]: ce, [cu]: [{ [cv]: cf, [cu]: [{ [cv]: ci, [cu]: [{ [cv]: ce, [cu]: [{ [cv]: ci, [cu]: [aY, { [cv]: cj, [cu]: [aZ, { [cv]: cl, [cu]: [{ [cv]: bG, [cu]: [{ [cv]: [{ [cw]: h, [cx]: [ba, "{partitionResult#name}"] }], [cu]: [{ [cv]: cn, [cu]: [{ [cv]: [{ [cw]: h, [cx]: [aU, B] }], [cu]: [{ [cv]: co, [cu]: [{ [cv]: cp, [cu]: [{ [cv]: bB, error: "Access Points do not support S3 Accelerate", [ct]: f }, { [cv]: bH, endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.s3-accesspoint-fips.dualstack.{bucketArn#region}.{bucketPartition#dnsSuffix}", [cB]: bj, [cH]: al }, [ct]: n }, { [cv]: bI, endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.s3-accesspoint-fips.{bucketArn#region}.{bucketPartition#dnsSuffix}", [cB]: bj, [cH]: al }, [ct]: n }, { [cv]: bJ, endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.s3-accesspoint.dualstack.{bucketArn#region}.{bucketPartition#dnsSuffix}", [cB]: bj, [cH]: al }, [ct]: n }, { [cv]: [as, ar, Z, ag], endpoint: { [cA]: M, [cB]: bj, [cH]: al }, [ct]: n }, { [cv]: bK, endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.s3-accesspoint.{bucketArn#region}.{bucketPartition#dnsSuffix}", [cB]: bj, [cH]: al }, [ct]: n }], [ct]: o }, bd], [ct]: o }, be], [ct]: o }, { error: "Invalid ARN: The ARN was not for the S3 service, found: {bucketArn#service}", [ct]: f }], [ct]: o }, bf], [ct]: o }, bg], [ct]: o }], [ct]: o }], [ct]: o }, bh], [ct]: o }], [ct]: o }], [ct]: o }, { [cv]: [{ [cw]: y, [cx]: [aV, c] }], [cu]: [{ [cv]: ch, error: "S3 MRAP does not support dual-stack", [ct]: f }, { [cv]: cq, error: "S3 MRAP does not support FIPS", [ct]: f }, { [cv]: bB, error: "S3 MRAP does not support S3 Accelerate", [ct]: f }, { [cv]: [{ [cw]: e, [cx]: [{ [cy]: "DisableMultiRegionAccessPoints" }, c] }], error: "Invalid configuration: Multi-Region Access Point ARNs are disabled.", [ct]: f }, { [cv]: [{ [cw]: g, [cx]: by, [cz]: N }], [cu]: [{ [cv]: [{ [cw]: h, [cx]: [{ [cw]: i, [cx]: [{ [cy]: N }, j] }, { [cw]: i, [cx]: [aS, "partition"] }] }], [cu]: [{ endpoint: { [cA]: "https://{accessPointName}.accesspoint.s3-global.{mrapPartition#dnsSuffix}", [cB]: { [cD]: [{ [cE]: c, name: z, [cF]: B, [cI]: cb }] }, [cH]: al }, [ct]: n }], [ct]: o }, { error: "Client was configured for partition `{mrapPartition#name}` but bucket referred to partition `{bucketArn#partition}`", [ct]: f }], [ct]: o }], [ct]: o }, { error: "Invalid Access Point Name", [ct]: f }], [ct]: o }, bi], [ct]: o }, { [cv]: [{ [cw]: h, [cx]: [aU, A] }], [cu]: [{ [cv]: ch, error: "S3 Outposts does not support Dual-stack", [ct]: f }, { [cv]: cq, error: "S3 Outposts does not support FIPS", [ct]: f }, { [cv]: bB, error: "S3 Outposts does not support S3 Accelerate", [ct]: f }, { [cv]: [{ [cw]: d, [cx]: [{ [cw]: i, [cx]: [aS, "resourceId[4]"] }] }], error: "Invalid Arn: Outpost Access Point ARN contains sub resources", [ct]: f }, { [cv]: [{ [cw]: i, [cx]: cg, [cz]: x }], [cu]: [{ [cv]: bZ, [cu]: [aZ, { [cv]: cl, [cu]: [{ [cv]: bG, [cu]: [{ [cv]: cm, [cu]: [{ [cv]: cn, [cu]: [{ [cv]: co, [cu]: [{ [cv]: [{ [cw]: i, [cx]: ck, [cz]: O }], [cu]: [{ [cv]: [{ [cw]: i, [cx]: [aS, "resourceId[3]"], [cz]: L }], [cu]: [{ [cv]: [{ [cw]: h, [cx]: [{ [cy]: O }, K] }], [cu]: [{ [cv]: bC, endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.{outpostId}.{url#authority}", [cB]: bk, [cH]: al }, [ct]: n }, { endpoint: { [cA]: "https://{accessPointName}-{bucketArn#accountId}.{outpostId}.s3-outposts.{bucketArn#region}.{bucketPartition#dnsSuffix}", [cB]: bk, [cH]: al }, [ct]: n }], [ct]: o }, { error: "Expected an outpost type `accesspoint`, found {outpostType}", [ct]: f }], [ct]: o }, { error: "Invalid ARN: expected an access point name", [ct]: f }], [ct]: o }, { error: "Invalid ARN: Expected a 4-component resource", [ct]: f }], [ct]: o }, be], [ct]: o }, bf], [ct]: o }, bg], [ct]: o }], [ct]: o }], [ct]: o }, { error: "Invalid ARN: The outpost Id may only contain a-z, A-Z, 0-9 and `-`. Found: `{outpostId}`", [ct]: f }], [ct]: o }, { error: "Invalid ARN: The Outpost Id was not set", [ct]: f }], [ct]: o }, { error: "Invalid ARN: Unrecognized format: {Bucket} (type: {arnType})", [ct]: f }], [ct]: o }, { error: "Invalid ARN: No ARN type specified", [ct]: f }], [ct]: o }, { [cv]: [{ [cw]: k, [cx]: [ad, 0, 4, b], [cz]: P }, { [cw]: h, [cx]: [{ [cy]: P }, "arn:"] }, { [cw]: r, [cx]: [{ [cw]: d, [cx]: [bl] }] }], error: "Invalid ARN: `{Bucket}` was not a valid ARN", [ct]: f }, { [cv]: [{ [cw]: e, [cx]: [az, c] }, bl], error: "Path-style addressing cannot be used with ARN buckets", [ct]: f }, { [cv]: bE, [cu]: [{ [cv]: bG, [cu]: [{ [cv]: [aA], [cu]: [{ [cv]: [Y, aq, X, aB], endpoint: { [cA]: "https://s3-fips.dualstack.us-east-1.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [Y, aq, X, aD, aE], [cu]: [{ endpoint: bm, [ct]: n }], [ct]: o }, { [cv]: [Y, aq, X, aD, aH], endpoint: bm, [ct]: n }, { [cv]: [ar, aq, X, aB], endpoint: { [cA]: "https://s3-fips.us-east-1.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, aq, X, aD, aE], [cu]: [{ endpoint: bn, [ct]: n }], [ct]: o }, { [cv]: [ar, aq, X, aD, aH], endpoint: bn, [ct]: n }, { [cv]: [Y, aq, as, aB], endpoint: { [cA]: "https://s3.dualstack.us-east-1.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [Y, aq, as, aD, aE], [cu]: [{ endpoint: bo, [ct]: n }], [ct]: o }, { [cv]: [Y, aq, as, aD, aH], endpoint: bo, [ct]: n }, { [cv]: [ar, Z, ag, as, aB], endpoint: { [cA]: Q, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, Z, ag, as, aD, aE], [cu]: [{ [cv]: cd, endpoint: bp, [ct]: n }, { endpoint: bp, [ct]: n }], [ct]: o }, { [cv]: [ar, Z, ag, as, aD, aH], endpoint: bp, [ct]: n }, { [cv]: [ar, aq, as, aB], endpoint: { [cA]: R, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [ar, aq, as, aD, aE], [cu]: [{ [cv]: cd, endpoint: { [cA]: R, [cB]: aG, [cH]: al }, [ct]: n }, { endpoint: bq, [ct]: n }], [ct]: o }, { [cv]: [ar, aq, as, aD, aH], endpoint: bq, [ct]: n }], [ct]: o }, { error: "Path-style addressing cannot be used with S3 Accelerate", [ct]: f }], [ct]: o }], [ct]: o }], [ct]: o }, { [cv]: [{ [cw]: d, [cx]: [br] }, { [cw]: e, [cx]: [br, c] }], [cu]: [{ [cv]: bG, [cu]: [{ [cv]: cr, [cu]: [aW, aX, { [cv]: bC, endpoint: { [cA]: t, [cB]: bs, [cH]: al }, [ct]: n }, { [cv]: cq, endpoint: { [cA]: "https://s3-object-lambda-fips.{Region}.{partitionResult#dnsSuffix}", [cB]: bs, [cH]: al }, [ct]: n }, { endpoint: { [cA]: "https://s3-object-lambda.{Region}.{partitionResult#dnsSuffix}", [cB]: bs, [cH]: al }, [ct]: n }], [ct]: o }, aR], [ct]: o }], [ct]: o }, { [cv]: [au], [cu]: [{ [cv]: bG, [cu]: [{ [cv]: cr, [cu]: [{ [cv]: [X, Y, aq, aB], endpoint: { [cA]: "https://s3-fips.dualstack.us-east-1.{partitionResult#dnsSuffix}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [X, Y, aq, aD, aE], [cu]: [{ endpoint: bt, [ct]: n }], [ct]: o }, { [cv]: [X, Y, aq, aD, aH], endpoint: bt, [ct]: n }, { [cv]: [X, ar, aq, aB], endpoint: { [cA]: "https://s3-fips.us-east-1.{partitionResult#dnsSuffix}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [X, ar, aq, aD, aE], [cu]: [{ endpoint: bu, [ct]: n }], [ct]: o }, { [cv]: [X, ar, aq, aD, aH], endpoint: bu, [ct]: n }, { [cv]: [as, Y, aq, aB], endpoint: { [cA]: "https://s3.dualstack.us-east-1.{partitionResult#dnsSuffix}", [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [as, Y, aq, aD, aE], [cu]: [{ endpoint: bv, [ct]: n }], [ct]: o }, { [cv]: [as, Y, aq, aD, aH], endpoint: bv, [ct]: n }, { [cv]: [as, ar, Z, ag, aB], endpoint: { [cA]: t, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [as, ar, Z, ag, aD, aE], [cu]: [{ [cv]: cd, endpoint: bw, [ct]: n }, { endpoint: bw, [ct]: n }], [ct]: o }, { [cv]: [as, ar, Z, ag, aD, aH], endpoint: bw, [ct]: n }, { [cv]: [as, ar, aq, aB], endpoint: { [cA]: S, [cB]: aC, [cH]: al }, [ct]: n }, { [cv]: [as, ar, aq, aD, aE], [cu]: [{ [cv]: cd, endpoint: { [cA]: S, [cB]: aG, [cH]: al }, [ct]: n }, { endpoint: bx, [ct]: n }], [ct]: o }, { [cv]: [as, ar, aq, aD, aH], endpoint: bx, [ct]: n }], [ct]: o }, aR], [ct]: o }], [ct]: o }], [ct]: o }, { error: "A region must be set when sending requests to S3.", [ct]: f }] };
const ruleSet = _data;

const cache = new EndpointCache({
    size: 50,
    params: [
        "Accelerate",
        "Bucket",
        "DisableAccessPoints",
        "DisableMultiRegionAccessPoints",
        "DisableS3ExpressSessionAuth",
        "Endpoint",
        "ForcePathStyle",
        "Region",
        "UseArnRegion",
        "UseDualStack",
        "UseFIPS",
        "UseGlobalEndpoint",
        "UseObjectLambdaEndpoint",
        "UseS3ExpressControlEndpoint",
    ],
});
const defaultEndpointResolver = (endpointParams, context = {}) => {
    return cache.get(endpointParams, () => resolveEndpoint(ruleSet, {
        endpointParams: endpointParams,
        logger: context.logger,
    }));
};
customEndpointFunctions.aws = awsEndpointFunctions;

const createEndpointRuleSetHttpAuthSchemeParametersProvider = (defaultHttpAuthSchemeParametersProvider) => async (config, context, input) => {
    if (!input) {
        throw new Error("Could not find `input` for `defaultEndpointRuleSetHttpAuthSchemeParametersProvider`");
    }
    const defaultParameters = await defaultHttpAuthSchemeParametersProvider(config, context, input);
    const instructionsFn = getSmithyContext(context)?.commandInstance?.constructor
        ?.getEndpointParameterInstructions;
    if (!instructionsFn) {
        throw new Error(`getEndpointParameterInstructions() is not defined on '${context.commandName}'`);
    }
    const endpointParameters = await resolveParams(input, { getEndpointParameterInstructions: instructionsFn }, config);
    return Object.assign(defaultParameters, endpointParameters);
};
const _defaultS3HttpAuthSchemeParametersProvider = async (config, context, input) => {
    return {
        operation: getSmithyContext(context).operation,
        region: await normalizeProvider$1(config.region)() || (() => {
            throw new Error("expected `region` to be configured for `aws.auth#sigv4`");
        })(),
    };
};
const defaultS3HttpAuthSchemeParametersProvider = createEndpointRuleSetHttpAuthSchemeParametersProvider(_defaultS3HttpAuthSchemeParametersProvider);
function createAwsAuthSigv4HttpAuthOption(authParameters) {
    return {
        schemeId: "aws.auth#sigv4",
        signingProperties: {
            name: "s3",
            region: authParameters.region,
        },
        propertiesExtractor: (config, context) => ({
            signingProperties: {
                config,
                context,
            },
        }),
    };
}
function createAwsAuthSigv4aHttpAuthOption(authParameters) {
    return {
        schemeId: "aws.auth#sigv4a",
        signingProperties: {
            name: "s3",
            region: authParameters.region,
        },
        propertiesExtractor: (config, context) => ({
            signingProperties: {
                config,
                context,
            },
        }),
    };
}
const createEndpointRuleSetHttpAuthSchemeProvider = (defaultEndpointResolver, defaultHttpAuthSchemeResolver, createHttpAuthOptionFunctions) => {
    const endpointRuleSetHttpAuthSchemeProvider = (authParameters) => {
        const endpoint = defaultEndpointResolver(authParameters);
        const authSchemes = endpoint.properties?.authSchemes;
        if (!authSchemes) {
            return defaultHttpAuthSchemeResolver(authParameters);
        }
        const options = [];
        for (const scheme of authSchemes) {
            const { name: resolvedName, properties = {}, ...rest } = scheme;
            const name = resolvedName.toLowerCase();
            if (resolvedName !== name) {
                console.warn(`HttpAuthScheme has been normalized with lowercasing: '${resolvedName}' to '${name}'`);
            }
            let schemeId;
            if (name === "sigv4a") {
                schemeId = "aws.auth#sigv4a";
                const sigv4Present = authSchemes.find((s) => {
                    const name = s.name.toLowerCase();
                    return name !== "sigv4a" && name.startsWith("sigv4");
                });
                if (SignatureV4MultiRegion.sigv4aDependency() === "none" && sigv4Present) {
                    continue;
                }
            }
            else if (name.startsWith("sigv4")) {
                schemeId = "aws.auth#sigv4";
            }
            else {
                throw new Error(`Unknown HttpAuthScheme found in '@smithy.rules#endpointRuleSet': '${name}'`);
            }
            const createOption = createHttpAuthOptionFunctions[schemeId];
            if (!createOption) {
                throw new Error(`Could not find HttpAuthOption create function for '${schemeId}'`);
            }
            const option = createOption(authParameters);
            option.schemeId = schemeId;
            option.signingProperties = { ...(option.signingProperties || {}), ...rest, ...properties };
            options.push(option);
        }
        return options;
    };
    return endpointRuleSetHttpAuthSchemeProvider;
};
const _defaultS3HttpAuthSchemeProvider = (authParameters) => {
    const options = [];
    switch (authParameters.operation) {
        default: {
            options.push(createAwsAuthSigv4HttpAuthOption(authParameters));
            options.push(createAwsAuthSigv4aHttpAuthOption(authParameters));
        }
    }
    return options;
};
const defaultS3HttpAuthSchemeProvider = createEndpointRuleSetHttpAuthSchemeProvider(defaultEndpointResolver, _defaultS3HttpAuthSchemeProvider, {
    "aws.auth#sigv4": createAwsAuthSigv4HttpAuthOption,
    "aws.auth#sigv4a": createAwsAuthSigv4aHttpAuthOption,
});
const resolveHttpAuthSchemeConfig = (config) => {
    const config_0 = resolveAwsSdkSigV4Config(config);
    const config_1 = resolveAwsSdkSigV4AConfig(config_0);
    return Object.assign(config_1, {
        authSchemePreference: normalizeProvider$1(config.authSchemePreference ?? []),
    });
};

const resolveClientEndpointParameters = (options) => {
    return Object.assign(options, {
        useFipsEndpoint: options.useFipsEndpoint ?? false,
        useDualstackEndpoint: options.useDualstackEndpoint ?? false,
        forcePathStyle: options.forcePathStyle ?? false,
        useAccelerateEndpoint: options.useAccelerateEndpoint ?? false,
        useGlobalEndpoint: options.useGlobalEndpoint ?? false,
        disableMultiregionAccessPoints: options.disableMultiregionAccessPoints ?? false,
        defaultSigningName: "s3",
        clientContextParams: options.clientContextParams ?? {},
    });
};
const commonParams = {
    ForcePathStyle: { type: "clientContextParams", name: "forcePathStyle" },
    UseArnRegion: { type: "clientContextParams", name: "useArnRegion" },
    DisableMultiRegionAccessPoints: { type: "clientContextParams", name: "disableMultiregionAccessPoints" },
    Accelerate: { type: "clientContextParams", name: "useAccelerateEndpoint" },
    DisableS3ExpressSessionAuth: { type: "clientContextParams", name: "disableS3ExpressSessionAuth" },
    UseGlobalEndpoint: { type: "builtInParams", name: "useGlobalEndpoint" },
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
    UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
};

class S3ServiceException extends ServiceException {
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, S3ServiceException.prototype);
    }
}

class NoSuchUpload extends S3ServiceException {
    name = "NoSuchUpload";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NoSuchUpload",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NoSuchUpload.prototype);
    }
}
class AccessDenied extends S3ServiceException {
    name = "AccessDenied";
    $fault = "client";
    constructor(opts) {
        super({
            name: "AccessDenied",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, AccessDenied.prototype);
    }
}
class ObjectNotInActiveTierError extends S3ServiceException {
    name = "ObjectNotInActiveTierError";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ObjectNotInActiveTierError",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ObjectNotInActiveTierError.prototype);
    }
}
class BucketAlreadyExists extends S3ServiceException {
    name = "BucketAlreadyExists";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BucketAlreadyExists",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BucketAlreadyExists.prototype);
    }
}
class BucketAlreadyOwnedByYou extends S3ServiceException {
    name = "BucketAlreadyOwnedByYou";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BucketAlreadyOwnedByYou",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BucketAlreadyOwnedByYou.prototype);
    }
}
class NoSuchBucket extends S3ServiceException {
    name = "NoSuchBucket";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NoSuchBucket",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NoSuchBucket.prototype);
    }
}
class InvalidObjectState extends S3ServiceException {
    name = "InvalidObjectState";
    $fault = "client";
    StorageClass;
    AccessTier;
    constructor(opts) {
        super({
            name: "InvalidObjectState",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidObjectState.prototype);
        this.StorageClass = opts.StorageClass;
        this.AccessTier = opts.AccessTier;
    }
}
class NoSuchKey extends S3ServiceException {
    name = "NoSuchKey";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NoSuchKey",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NoSuchKey.prototype);
    }
}
class NotFound extends S3ServiceException {
    name = "NotFound";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NotFound",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NotFound.prototype);
    }
}
class EncryptionTypeMismatch extends S3ServiceException {
    name = "EncryptionTypeMismatch";
    $fault = "client";
    constructor(opts) {
        super({
            name: "EncryptionTypeMismatch",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, EncryptionTypeMismatch.prototype);
    }
}
class InvalidRequest extends S3ServiceException {
    name = "InvalidRequest";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidRequest",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidRequest.prototype);
    }
}
class InvalidWriteOffset extends S3ServiceException {
    name = "InvalidWriteOffset";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidWriteOffset",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidWriteOffset.prototype);
    }
}
class TooManyParts extends S3ServiceException {
    name = "TooManyParts";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TooManyParts",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TooManyParts.prototype);
    }
}
class IdempotencyParameterMismatch extends S3ServiceException {
    name = "IdempotencyParameterMismatch";
    $fault = "client";
    constructor(opts) {
        super({
            name: "IdempotencyParameterMismatch",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, IdempotencyParameterMismatch.prototype);
    }
}
class ObjectAlreadyInActiveTierError extends S3ServiceException {
    name = "ObjectAlreadyInActiveTierError";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ObjectAlreadyInActiveTierError",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ObjectAlreadyInActiveTierError.prototype);
    }
}

const _A = "Account";
const _AAO = "AnalyticsAndOperator";
const _AC = "AccelerateConfiguration";
const _ACL = "AccessControlList";
const _ACL_ = "ACL";
const _ACLn = "AnalyticsConfigurationList";
const _ACP = "AccessControlPolicy";
const _ACT = "AccessControlTranslation";
const _ACn = "AnalyticsConfiguration";
const _AD = "AccessDenied";
const _ADb = "AbortDate";
const _AED = "AnalyticsExportDestination";
const _AF = "AnalyticsFilter";
const _AH = "AllowedHeaders";
const _AHl = "AllowedHeader";
const _AI = "AccountId";
const _AIMU = "AbortIncompleteMultipartUpload";
const _AKI = "AccessKeyId";
const _AM = "AllowedMethods";
const _AMU = "AbortMultipartUpload";
const _AMUO = "AbortMultipartUploadOutput";
const _AMUR = "AbortMultipartUploadRequest";
const _AMl = "AllowedMethod";
const _AO = "AllowedOrigins";
const _AOl = "AllowedOrigin";
const _APA = "AccessPointAlias";
const _APAc = "AccessPointArn";
const _AQRD = "AllowQuotedRecordDelimiter";
const _AR = "AcceptRanges";
const _ARI = "AbortRuleId";
const _AS = "AbacStatus";
const _ASBD = "AnalyticsS3BucketDestination";
const _ASSEBD = "ApplyServerSideEncryptionByDefault";
const _ASr = "ArchiveStatus";
const _AT = "AccessTier";
const _An = "And";
const _B = "Bucket";
const _BA = "BucketArn";
const _BAE = "BucketAlreadyExists";
const _BAI = "BucketAccountId";
const _BAOBY = "BucketAlreadyOwnedByYou";
const _BET = "BlockedEncryptionTypes";
const _BGR = "BypassGovernanceRetention";
const _BI = "BucketInfo";
const _BKE = "BucketKeyEnabled";
const _BLC = "BucketLifecycleConfiguration";
const _BLN = "BucketLocationName";
const _BLS = "BucketLoggingStatus";
const _BLT = "BucketLocationType";
const _BN = "BucketNamespace";
const _BNu = "BucketName";
const _BP = "BytesProcessed";
const _BPA = "BlockPublicAcls";
const _BPP = "BlockPublicPolicy";
const _BR = "BucketRegion";
const _BRy = "BytesReturned";
const _BS = "BytesScanned";
const _Bo = "Body";
const _Bu = "Buckets";
const _C = "Checksum";
const _CA = "ChecksumAlgorithm";
const _CACL = "CannedACL";
const _CB = "CreateBucket";
const _CBC = "CreateBucketConfiguration";
const _CBMC = "CreateBucketMetadataConfiguration";
const _CBMCR = "CreateBucketMetadataConfigurationRequest";
const _CBMTC = "CreateBucketMetadataTableConfiguration";
const _CBMTCR = "CreateBucketMetadataTableConfigurationRequest";
const _CBO = "CreateBucketOutput";
const _CBR = "CreateBucketRequest";
const _CC = "CacheControl";
const _CCRC = "ChecksumCRC32";
const _CCRCC = "ChecksumCRC32C";
const _CCRCNVME = "ChecksumCRC64NVME";
const _CC_ = "Cache-Control";
const _CD = "CreationDate";
const _CD_ = "Content-Disposition";
const _CDo = "ContentDisposition";
const _CE = "ContinuationEvent";
const _CE_ = "Content-Encoding";
const _CEo = "ContentEncoding";
const _CF = "CloudFunction";
const _CFC = "CloudFunctionConfiguration";
const _CL = "ContentLanguage";
const _CL_ = "Content-Language";
const _CL__ = "Content-Length";
const _CLo = "ContentLength";
const _CM = "Content-MD5";
const _CMD = "ContentMD5";
const _CMU = "CompletedMultipartUpload";
const _CMUO = "CompleteMultipartUploadOutput";
const _CMUOr = "CreateMultipartUploadOutput";
const _CMUR = "CompleteMultipartUploadResult";
const _CMURo = "CompleteMultipartUploadRequest";
const _CMURr = "CreateMultipartUploadRequest";
const _CMUo = "CompleteMultipartUpload";
const _CMUr = "CreateMultipartUpload";
const _CMh = "ChecksumMode";
const _CO = "CopyObject";
const _COO = "CopyObjectOutput";
const _COR = "CopyObjectResult";
const _CORSC = "CORSConfiguration";
const _CORSR = "CORSRules";
const _CORSRu = "CORSRule";
const _CORo = "CopyObjectRequest";
const _CP = "CommonPrefix";
const _CPL = "CommonPrefixList";
const _CPLo = "CompletedPartList";
const _CPR = "CopyPartResult";
const _CPo = "CompletedPart";
const _CPom = "CommonPrefixes";
const _CR = "ContentRange";
const _CRSBA = "ConfirmRemoveSelfBucketAccess";
const _CR_ = "Content-Range";
const _CS = "CopySource";
const _CSHA = "ChecksumSHA1";
const _CSHAh = "ChecksumSHA256";
const _CSIM = "CopySourceIfMatch";
const _CSIMS = "CopySourceIfModifiedSince";
const _CSINM = "CopySourceIfNoneMatch";
const _CSIUS = "CopySourceIfUnmodifiedSince";
const _CSO = "CreateSessionOutput";
const _CSR = "CreateSessionResult";
const _CSRo = "CopySourceRange";
const _CSRr = "CreateSessionRequest";
const _CSSSECA = "CopySourceSSECustomerAlgorithm";
const _CSSSECK = "CopySourceSSECustomerKey";
const _CSSSECKMD = "CopySourceSSECustomerKeyMD5";
const _CSV = "CSV";
const _CSVI = "CopySourceVersionId";
const _CSVIn = "CSVInput";
const _CSVO = "CSVOutput";
const _CSo = "ConfigurationState";
const _CSr = "CreateSession";
const _CT = "ChecksumType";
const _CT_ = "Content-Type";
const _CTl = "ClientToken";
const _CTo = "ContentType";
const _CTom = "CompressionType";
const _CTon = "ContinuationToken";
const _Co = "Condition";
const _Cod = "Code";
const _Com = "Comments";
const _Con = "Contents";
const _Cont = "Cont";
const _Cr = "Credentials";
const _D = "Days";
const _DAI = "DaysAfterInitiation";
const _DB = "DeleteBucket";
const _DBAC = "DeleteBucketAnalyticsConfiguration";
const _DBACR = "DeleteBucketAnalyticsConfigurationRequest";
const _DBC = "DeleteBucketCors";
const _DBCR = "DeleteBucketCorsRequest";
const _DBE = "DeleteBucketEncryption";
const _DBER = "DeleteBucketEncryptionRequest";
const _DBIC = "DeleteBucketInventoryConfiguration";
const _DBICR = "DeleteBucketInventoryConfigurationRequest";
const _DBITC = "DeleteBucketIntelligentTieringConfiguration";
const _DBITCR = "DeleteBucketIntelligentTieringConfigurationRequest";
const _DBL = "DeleteBucketLifecycle";
const _DBLR = "DeleteBucketLifecycleRequest";
const _DBMC = "DeleteBucketMetadataConfiguration";
const _DBMCR = "DeleteBucketMetadataConfigurationRequest";
const _DBMCRe = "DeleteBucketMetricsConfigurationRequest";
const _DBMCe = "DeleteBucketMetricsConfiguration";
const _DBMTC = "DeleteBucketMetadataTableConfiguration";
const _DBMTCR = "DeleteBucketMetadataTableConfigurationRequest";
const _DBOC = "DeleteBucketOwnershipControls";
const _DBOCR = "DeleteBucketOwnershipControlsRequest";
const _DBP = "DeleteBucketPolicy";
const _DBPR = "DeleteBucketPolicyRequest";
const _DBR = "DeleteBucketRequest";
const _DBRR = "DeleteBucketReplicationRequest";
const _DBRe = "DeleteBucketReplication";
const _DBT = "DeleteBucketTagging";
const _DBTR = "DeleteBucketTaggingRequest";
const _DBW = "DeleteBucketWebsite";
const _DBWR = "DeleteBucketWebsiteRequest";
const _DE = "DataExport";
const _DIM = "DestinationIfMatch";
const _DIMS = "DestinationIfModifiedSince";
const _DINM = "DestinationIfNoneMatch";
const _DIUS = "DestinationIfUnmodifiedSince";
const _DM = "DeleteMarker";
const _DME = "DeleteMarkerEntry";
const _DMR = "DeleteMarkerReplication";
const _DMVI = "DeleteMarkerVersionId";
const _DMe = "DeleteMarkers";
const _DN = "DisplayName";
const _DO = "DeletedObject";
const _DOO = "DeleteObjectOutput";
const _DOOe = "DeleteObjectsOutput";
const _DOR = "DeleteObjectRequest";
const _DORe = "DeleteObjectsRequest";
const _DOT = "DeleteObjectTagging";
const _DOTO = "DeleteObjectTaggingOutput";
const _DOTR = "DeleteObjectTaggingRequest";
const _DOe = "DeletedObjects";
const _DOel = "DeleteObject";
const _DOele = "DeleteObjects";
const _DPAB = "DeletePublicAccessBlock";
const _DPABR = "DeletePublicAccessBlockRequest";
const _DR = "DataRedundancy";
const _DRe = "DefaultRetention";
const _DRel = "DeleteResult";
const _DRes = "DestinationResult";
const _Da = "Date";
const _De = "Delete";
const _Del = "Deleted";
const _Deli = "Delimiter";
const _Des = "Destination";
const _Desc = "Description";
const _Det = "Details";
const _E = "Expiration";
const _EA = "EmailAddress";
const _EBC = "EventBridgeConfiguration";
const _EBO = "ExpectedBucketOwner";
const _EC = "EncryptionConfiguration";
const _ECr = "ErrorCode";
const _ED = "ErrorDetails";
const _EDr = "ErrorDocument";
const _EE = "EndEvent";
const _EH = "ExposeHeaders";
const _EHx = "ExposeHeader";
const _EM = "ErrorMessage";
const _EODM = "ExpiredObjectDeleteMarker";
const _EOR = "ExistingObjectReplication";
const _ES = "ExpiresString";
const _ESBO = "ExpectedSourceBucketOwner";
const _ET = "EncryptionType";
const _ETL = "EncryptionTypeList";
const _ETM = "EncryptionTypeMismatch";
const _ETa = "ETag";
const _ETn = "EncodingType";
const _ETv = "EventThreshold";
const _ETx = "ExpressionType";
const _En = "Encryption";
const _Ena = "Enabled";
const _End = "End";
const _Er = "Errors";
const _Err = "Error";
const _Ev = "Events";
const _Eve = "Event";
const _Ex = "Expires";
const _Exp = "Expression";
const _F = "Filter";
const _FD = "FieldDelimiter";
const _FHI = "FileHeaderInfo";
const _FO = "FetchOwner";
const _FR = "FilterRule";
const _FRL = "FilterRuleList";
const _FRi = "FilterRules";
const _Fi = "Field";
const _Fo = "Format";
const _Fr = "Frequency";
const _G = "Grants";
const _GBA = "GetBucketAbac";
const _GBAC = "GetBucketAccelerateConfiguration";
const _GBACO = "GetBucketAccelerateConfigurationOutput";
const _GBACOe = "GetBucketAnalyticsConfigurationOutput";
const _GBACR = "GetBucketAccelerateConfigurationRequest";
const _GBACRe = "GetBucketAnalyticsConfigurationRequest";
const _GBACe = "GetBucketAnalyticsConfiguration";
const _GBAO = "GetBucketAbacOutput";
const _GBAOe = "GetBucketAclOutput";
const _GBAR = "GetBucketAbacRequest";
const _GBARe = "GetBucketAclRequest";
const _GBAe = "GetBucketAcl";
const _GBC = "GetBucketCors";
const _GBCO = "GetBucketCorsOutput";
const _GBCR = "GetBucketCorsRequest";
const _GBE = "GetBucketEncryption";
const _GBEO = "GetBucketEncryptionOutput";
const _GBER = "GetBucketEncryptionRequest";
const _GBIC = "GetBucketInventoryConfiguration";
const _GBICO = "GetBucketInventoryConfigurationOutput";
const _GBICR = "GetBucketInventoryConfigurationRequest";
const _GBITC = "GetBucketIntelligentTieringConfiguration";
const _GBITCO = "GetBucketIntelligentTieringConfigurationOutput";
const _GBITCR = "GetBucketIntelligentTieringConfigurationRequest";
const _GBL = "GetBucketLocation";
const _GBLC = "GetBucketLifecycleConfiguration";
const _GBLCO = "GetBucketLifecycleConfigurationOutput";
const _GBLCR = "GetBucketLifecycleConfigurationRequest";
const _GBLO = "GetBucketLocationOutput";
const _GBLOe = "GetBucketLoggingOutput";
const _GBLR = "GetBucketLocationRequest";
const _GBLRe = "GetBucketLoggingRequest";
const _GBLe = "GetBucketLogging";
const _GBMC = "GetBucketMetadataConfiguration";
const _GBMCO = "GetBucketMetadataConfigurationOutput";
const _GBMCOe = "GetBucketMetricsConfigurationOutput";
const _GBMCR = "GetBucketMetadataConfigurationResult";
const _GBMCRe = "GetBucketMetadataConfigurationRequest";
const _GBMCRet = "GetBucketMetricsConfigurationRequest";
const _GBMCe = "GetBucketMetricsConfiguration";
const _GBMTC = "GetBucketMetadataTableConfiguration";
const _GBMTCO = "GetBucketMetadataTableConfigurationOutput";
const _GBMTCR = "GetBucketMetadataTableConfigurationResult";
const _GBMTCRe = "GetBucketMetadataTableConfigurationRequest";
const _GBNC = "GetBucketNotificationConfiguration";
const _GBNCR = "GetBucketNotificationConfigurationRequest";
const _GBOC = "GetBucketOwnershipControls";
const _GBOCO = "GetBucketOwnershipControlsOutput";
const _GBOCR = "GetBucketOwnershipControlsRequest";
const _GBP = "GetBucketPolicy";
const _GBPO = "GetBucketPolicyOutput";
const _GBPR = "GetBucketPolicyRequest";
const _GBPS = "GetBucketPolicyStatus";
const _GBPSO = "GetBucketPolicyStatusOutput";
const _GBPSR = "GetBucketPolicyStatusRequest";
const _GBR = "GetBucketReplication";
const _GBRO = "GetBucketReplicationOutput";
const _GBRP = "GetBucketRequestPayment";
const _GBRPO = "GetBucketRequestPaymentOutput";
const _GBRPR = "GetBucketRequestPaymentRequest";
const _GBRR = "GetBucketReplicationRequest";
const _GBT = "GetBucketTagging";
const _GBTO = "GetBucketTaggingOutput";
const _GBTR = "GetBucketTaggingRequest";
const _GBV = "GetBucketVersioning";
const _GBVO = "GetBucketVersioningOutput";
const _GBVR = "GetBucketVersioningRequest";
const _GBW = "GetBucketWebsite";
const _GBWO = "GetBucketWebsiteOutput";
const _GBWR = "GetBucketWebsiteRequest";
const _GFC = "GrantFullControl";
const _GJP = "GlacierJobParameters";
const _GO = "GetObject";
const _GOA = "GetObjectAcl";
const _GOAO = "GetObjectAclOutput";
const _GOAOe = "GetObjectAttributesOutput";
const _GOAP = "GetObjectAttributesParts";
const _GOAR = "GetObjectAclRequest";
const _GOARe = "GetObjectAttributesResponse";
const _GOARet = "GetObjectAttributesRequest";
const _GOAe = "GetObjectAttributes";
const _GOLC = "GetObjectLockConfiguration";
const _GOLCO = "GetObjectLockConfigurationOutput";
const _GOLCR = "GetObjectLockConfigurationRequest";
const _GOLH = "GetObjectLegalHold";
const _GOLHO = "GetObjectLegalHoldOutput";
const _GOLHR = "GetObjectLegalHoldRequest";
const _GOO = "GetObjectOutput";
const _GOR = "GetObjectRequest";
const _GORO = "GetObjectRetentionOutput";
const _GORR = "GetObjectRetentionRequest";
const _GORe = "GetObjectRetention";
const _GOT = "GetObjectTagging";
const _GOTO = "GetObjectTaggingOutput";
const _GOTOe = "GetObjectTorrentOutput";
const _GOTR = "GetObjectTaggingRequest";
const _GOTRe = "GetObjectTorrentRequest";
const _GOTe = "GetObjectTorrent";
const _GPAB = "GetPublicAccessBlock";
const _GPABO = "GetPublicAccessBlockOutput";
const _GPABR = "GetPublicAccessBlockRequest";
const _GR = "GrantRead";
const _GRACP = "GrantReadACP";
const _GW = "GrantWrite";
const _GWACP = "GrantWriteACP";
const _Gr = "Grant";
const _Gra = "Grantee";
const _HB = "HeadBucket";
const _HBO = "HeadBucketOutput";
const _HBR = "HeadBucketRequest";
const _HECRE = "HttpErrorCodeReturnedEquals";
const _HN = "HostName";
const _HO = "HeadObject";
const _HOO = "HeadObjectOutput";
const _HOR = "HeadObjectRequest";
const _HRC = "HttpRedirectCode";
const _I = "Id";
const _IC = "InventoryConfiguration";
const _ICL = "InventoryConfigurationList";
const _ID = "ID";
const _IDn = "IndexDocument";
const _IDnv = "InventoryDestination";
const _IE = "IsEnabled";
const _IEn = "InventoryEncryption";
const _IF = "InventoryFilter";
const _IL = "IsLatest";
const _IM = "IfMatch";
const _IMIT = "IfMatchInitiatedTime";
const _IMLMT = "IfMatchLastModifiedTime";
const _IMS = "IfMatchSize";
const _IMS_ = "If-Modified-Since";
const _IMSf = "IfModifiedSince";
const _IMUR = "InitiateMultipartUploadResult";
const _IM_ = "If-Match";
const _INM = "IfNoneMatch";
const _INM_ = "If-None-Match";
const _IOF = "InventoryOptionalFields";
const _IOS = "InvalidObjectState";
const _IOV = "IncludedObjectVersions";
const _IP = "IsPublic";
const _IPA = "IgnorePublicAcls";
const _IPM = "IdempotencyParameterMismatch";
const _IR = "InvalidRequest";
const _IRIP = "IsRestoreInProgress";
const _IS = "InputSerialization";
const _ISBD = "InventoryS3BucketDestination";
const _ISn = "InventorySchedule";
const _IT = "IsTruncated";
const _ITAO = "IntelligentTieringAndOperator";
const _ITC = "IntelligentTieringConfiguration";
const _ITCL = "IntelligentTieringConfigurationList";
const _ITCR = "InventoryTableConfigurationResult";
const _ITCU = "InventoryTableConfigurationUpdates";
const _ITCn = "InventoryTableConfiguration";
const _ITF = "IntelligentTieringFilter";
const _IUS = "IfUnmodifiedSince";
const _IUS_ = "If-Unmodified-Since";
const _IWO = "InvalidWriteOffset";
const _In = "Initiator";
const _Ini = "Initiated";
const _JSON = "JSON";
const _JSONI = "JSONInput";
const _JSONO = "JSONOutput";
const _JTC = "JournalTableConfiguration";
const _JTCR = "JournalTableConfigurationResult";
const _JTCU = "JournalTableConfigurationUpdates";
const _K = "Key";
const _KC = "KeyCount";
const _KI = "KeyId";
const _KKA = "KmsKeyArn";
const _KM = "KeyMarker";
const _KMSC = "KMSContext";
const _KMSKA = "KMSKeyArn";
const _KMSKI = "KMSKeyId";
const _KMSMKID = "KMSMasterKeyID";
const _KPE = "KeyPrefixEquals";
const _L = "Location";
const _LAMBR = "ListAllMyBucketsResult";
const _LAMDBR = "ListAllMyDirectoryBucketsResult";
const _LB = "ListBuckets";
const _LBAC = "ListBucketAnalyticsConfigurations";
const _LBACO = "ListBucketAnalyticsConfigurationsOutput";
const _LBACR = "ListBucketAnalyticsConfigurationResult";
const _LBACRi = "ListBucketAnalyticsConfigurationsRequest";
const _LBIC = "ListBucketInventoryConfigurations";
const _LBICO = "ListBucketInventoryConfigurationsOutput";
const _LBICR = "ListBucketInventoryConfigurationsRequest";
const _LBITC = "ListBucketIntelligentTieringConfigurations";
const _LBITCO = "ListBucketIntelligentTieringConfigurationsOutput";
const _LBITCR = "ListBucketIntelligentTieringConfigurationsRequest";
const _LBMC = "ListBucketMetricsConfigurations";
const _LBMCO = "ListBucketMetricsConfigurationsOutput";
const _LBMCR = "ListBucketMetricsConfigurationsRequest";
const _LBO = "ListBucketsOutput";
const _LBR = "ListBucketsRequest";
const _LBRi = "ListBucketResult";
const _LC = "LocationConstraint";
const _LCi = "LifecycleConfiguration";
const _LDB = "ListDirectoryBuckets";
const _LDBO = "ListDirectoryBucketsOutput";
const _LDBR = "ListDirectoryBucketsRequest";
const _LE = "LoggingEnabled";
const _LEi = "LifecycleExpiration";
const _LFA = "LambdaFunctionArn";
const _LFC = "LambdaFunctionConfiguration";
const _LFCL = "LambdaFunctionConfigurationList";
const _LFCa = "LambdaFunctionConfigurations";
const _LH = "LegalHold";
const _LI = "LocationInfo";
const _LICR = "ListInventoryConfigurationsResult";
const _LM = "LastModified";
const _LMCR = "ListMetricsConfigurationsResult";
const _LMT = "LastModifiedTime";
const _LMU = "ListMultipartUploads";
const _LMUO = "ListMultipartUploadsOutput";
const _LMUR = "ListMultipartUploadsResult";
const _LMURi = "ListMultipartUploadsRequest";
const _LM_ = "Last-Modified";
const _LO = "ListObjects";
const _LOO = "ListObjectsOutput";
const _LOR = "ListObjectsRequest";
const _LOV = "ListObjectsV2";
const _LOVO = "ListObjectsV2Output";
const _LOVOi = "ListObjectVersionsOutput";
const _LOVR = "ListObjectsV2Request";
const _LOVRi = "ListObjectVersionsRequest";
const _LOVi = "ListObjectVersions";
const _LP = "ListParts";
const _LPO = "ListPartsOutput";
const _LPR = "ListPartsResult";
const _LPRi = "ListPartsRequest";
const _LR = "LifecycleRule";
const _LRAO = "LifecycleRuleAndOperator";
const _LRF = "LifecycleRuleFilter";
const _LRi = "LifecycleRules";
const _LVR = "ListVersionsResult";
const _M = "Metadata";
const _MAO = "MetricsAndOperator";
const _MAS = "MaxAgeSeconds";
const _MB = "MaxBuckets";
const _MC = "MetadataConfiguration";
const _MCL = "MetricsConfigurationList";
const _MCR = "MetadataConfigurationResult";
const _MCe = "MetricsConfiguration";
const _MD = "MetadataDirective";
const _MDB = "MaxDirectoryBuckets";
const _MDf = "MfaDelete";
const _ME = "MetadataEntry";
const _MF = "MetricsFilter";
const _MFA = "MFA";
const _MFAD = "MFADelete";
const _MK = "MaxKeys";
const _MM = "MissingMeta";
const _MOS = "MpuObjectSize";
const _MP = "MaxParts";
const _MTC = "MetadataTableConfiguration";
const _MTCR = "MetadataTableConfigurationResult";
const _MTEC = "MetadataTableEncryptionConfiguration";
const _MU = "MultipartUpload";
const _MUL = "MultipartUploadList";
const _MUa = "MaxUploads";
const _Ma = "Marker";
const _Me = "Metrics";
const _Mes = "Message";
const _Mi = "Minutes";
const _Mo = "Mode";
const _N = "Name";
const _NC = "NotificationConfiguration";
const _NCF = "NotificationConfigurationFilter";
const _NCT = "NextContinuationToken";
const _ND = "NoncurrentDays";
const _NEKKAS = "NonEmptyKmsKeyArnString";
const _NF = "NotFound";
const _NKM = "NextKeyMarker";
const _NM = "NextMarker";
const _NNV = "NewerNoncurrentVersions";
const _NPNM = "NextPartNumberMarker";
const _NSB = "NoSuchBucket";
const _NSK = "NoSuchKey";
const _NSU = "NoSuchUpload";
const _NUIM = "NextUploadIdMarker";
const _NVE = "NoncurrentVersionExpiration";
const _NVIM = "NextVersionIdMarker";
const _NVT = "NoncurrentVersionTransitions";
const _NVTL = "NoncurrentVersionTransitionList";
const _NVTo = "NoncurrentVersionTransition";
const _O = "Owner";
const _OA = "ObjectAttributes";
const _OAIATE = "ObjectAlreadyInActiveTierError";
const _OC = "OwnershipControls";
const _OCR = "OwnershipControlsRule";
const _OCRw = "OwnershipControlsRules";
const _OE = "ObjectEncryption";
const _OF = "OptionalFields";
const _OI = "ObjectIdentifier";
const _OIL = "ObjectIdentifierList";
const _OL = "OutputLocation";
const _OLC = "ObjectLockConfiguration";
const _OLE = "ObjectLockEnabled";
const _OLEFB = "ObjectLockEnabledForBucket";
const _OLLH = "ObjectLockLegalHold";
const _OLLHS = "ObjectLockLegalHoldStatus";
const _OLM = "ObjectLockMode";
const _OLR = "ObjectLockRetention";
const _OLRUD = "ObjectLockRetainUntilDate";
const _OLRb = "ObjectLockRule";
const _OLb = "ObjectList";
const _ONIATE = "ObjectNotInActiveTierError";
const _OO = "ObjectOwnership";
const _OOA = "OptionalObjectAttributes";
const _OP = "ObjectParts";
const _OPb = "ObjectPart";
const _OS = "ObjectSize";
const _OSGT = "ObjectSizeGreaterThan";
const _OSLT = "ObjectSizeLessThan";
const _OSV = "OutputSchemaVersion";
const _OSu = "OutputSerialization";
const _OV = "ObjectVersion";
const _OVL = "ObjectVersionList";
const _Ob = "Objects";
const _Obj = "Object";
const _P = "Prefix";
const _PABC = "PublicAccessBlockConfiguration";
const _PBA = "PutBucketAbac";
const _PBAC = "PutBucketAccelerateConfiguration";
const _PBACR = "PutBucketAccelerateConfigurationRequest";
const _PBACRu = "PutBucketAnalyticsConfigurationRequest";
const _PBACu = "PutBucketAnalyticsConfiguration";
const _PBAR = "PutBucketAbacRequest";
const _PBARu = "PutBucketAclRequest";
const _PBAu = "PutBucketAcl";
const _PBC = "PutBucketCors";
const _PBCR = "PutBucketCorsRequest";
const _PBE = "PutBucketEncryption";
const _PBER = "PutBucketEncryptionRequest";
const _PBIC = "PutBucketInventoryConfiguration";
const _PBICR = "PutBucketInventoryConfigurationRequest";
const _PBITC = "PutBucketIntelligentTieringConfiguration";
const _PBITCR = "PutBucketIntelligentTieringConfigurationRequest";
const _PBL = "PutBucketLogging";
const _PBLC = "PutBucketLifecycleConfiguration";
const _PBLCO = "PutBucketLifecycleConfigurationOutput";
const _PBLCR = "PutBucketLifecycleConfigurationRequest";
const _PBLR = "PutBucketLoggingRequest";
const _PBMC = "PutBucketMetricsConfiguration";
const _PBMCR = "PutBucketMetricsConfigurationRequest";
const _PBNC = "PutBucketNotificationConfiguration";
const _PBNCR = "PutBucketNotificationConfigurationRequest";
const _PBOC = "PutBucketOwnershipControls";
const _PBOCR = "PutBucketOwnershipControlsRequest";
const _PBP = "PutBucketPolicy";
const _PBPR = "PutBucketPolicyRequest";
const _PBR = "PutBucketReplication";
const _PBRP = "PutBucketRequestPayment";
const _PBRPR = "PutBucketRequestPaymentRequest";
const _PBRR = "PutBucketReplicationRequest";
const _PBT = "PutBucketTagging";
const _PBTR = "PutBucketTaggingRequest";
const _PBV = "PutBucketVersioning";
const _PBVR = "PutBucketVersioningRequest";
const _PBW = "PutBucketWebsite";
const _PBWR = "PutBucketWebsiteRequest";
const _PC = "PartsCount";
const _PDS = "PartitionDateSource";
const _PE = "ProgressEvent";
const _PI = "ParquetInput";
const _PL = "PartsList";
const _PN = "PartNumber";
const _PNM = "PartNumberMarker";
const _PO = "PutObject";
const _POA = "PutObjectAcl";
const _POAO = "PutObjectAclOutput";
const _POAR = "PutObjectAclRequest";
const _POLC = "PutObjectLockConfiguration";
const _POLCO = "PutObjectLockConfigurationOutput";
const _POLCR = "PutObjectLockConfigurationRequest";
const _POLH = "PutObjectLegalHold";
const _POLHO = "PutObjectLegalHoldOutput";
const _POLHR = "PutObjectLegalHoldRequest";
const _POO = "PutObjectOutput";
const _POR = "PutObjectRequest";
const _PORO = "PutObjectRetentionOutput";
const _PORR = "PutObjectRetentionRequest";
const _PORu = "PutObjectRetention";
const _POT = "PutObjectTagging";
const _POTO = "PutObjectTaggingOutput";
const _POTR = "PutObjectTaggingRequest";
const _PP = "PartitionedPrefix";
const _PPAB = "PutPublicAccessBlock";
const _PPABR = "PutPublicAccessBlockRequest";
const _PS = "PolicyStatus";
const _Pa = "Parts";
const _Par = "Part";
const _Parq = "Parquet";
const _Pay = "Payer";
const _Payl = "Payload";
const _Pe = "Permission";
const _Po = "Policy";
const _Pr = "Progress";
const _Pri = "Priority";
const _Pro = "Protocol";
const _Q = "Quiet";
const _QA = "QueueArn";
const _QC = "QuoteCharacter";
const _QCL = "QueueConfigurationList";
const _QCu = "QueueConfigurations";
const _QCue = "QueueConfiguration";
const _QEC = "QuoteEscapeCharacter";
const _QF = "QuoteFields";
const _Qu = "Queue";
const _R = "Rules";
const _RART = "RedirectAllRequestsTo";
const _RC = "RequestCharged";
const _RCC = "ResponseCacheControl";
const _RCD = "ResponseContentDisposition";
const _RCE = "ResponseContentEncoding";
const _RCL = "ResponseContentLanguage";
const _RCT = "ResponseContentType";
const _RCe = "ReplicationConfiguration";
const _RD = "RecordDelimiter";
const _RE = "ResponseExpires";
const _RED = "RestoreExpiryDate";
const _REe = "RecordExpiration";
const _REec = "RecordsEvent";
const _RKKID = "ReplicaKmsKeyID";
const _RKPW = "ReplaceKeyPrefixWith";
const _RKW = "ReplaceKeyWith";
const _RM = "ReplicaModifications";
const _RO = "RenameObject";
const _ROO = "RenameObjectOutput";
const _ROOe = "RestoreObjectOutput";
const _ROP = "RestoreOutputPath";
const _ROR = "RenameObjectRequest";
const _RORe = "RestoreObjectRequest";
const _ROe = "RestoreObject";
const _RP = "RequestPayer";
const _RPB = "RestrictPublicBuckets";
const _RPC = "RequestPaymentConfiguration";
const _RPe = "RequestProgress";
const _RR = "RoutingRules";
const _RRAO = "ReplicationRuleAndOperator";
const _RRF = "ReplicationRuleFilter";
const _RRe = "ReplicationRule";
const _RRep = "ReplicationRules";
const _RReq = "RequestRoute";
const _RRes = "RestoreRequest";
const _RRo = "RoutingRule";
const _RS = "ReplicationStatus";
const _RSe = "RestoreStatus";
const _RSen = "RenameSource";
const _RT = "ReplicationTime";
const _RTV = "ReplicationTimeValue";
const _RTe = "RequestToken";
const _RUD = "RetainUntilDate";
const _Ra = "Range";
const _Re = "Restore";
const _Rec = "Records";
const _Red = "Redirect";
const _Ret = "Retention";
const _Ro = "Role";
const _Ru = "Rule";
const _S = "Status";
const _SA = "StartAfter";
const _SAK = "SecretAccessKey";
const _SAs = "SseAlgorithm";
const _SB = "StreamingBlob";
const _SBD = "S3BucketDestination";
const _SC = "StorageClass";
const _SCA = "StorageClassAnalysis";
const _SCADE = "StorageClassAnalysisDataExport";
const _SCV = "SessionCredentialValue";
const _SCe = "SessionCredentials";
const _SCt = "StatusCode";
const _SDV = "SkipDestinationValidation";
const _SE = "StatsEvent";
const _SIM = "SourceIfMatch";
const _SIMS = "SourceIfModifiedSince";
const _SINM = "SourceIfNoneMatch";
const _SIUS = "SourceIfUnmodifiedSince";
const _SK = "SSE-KMS";
const _SKEO = "SseKmsEncryptedObjects";
const _SKF = "S3KeyFilter";
const _SKe = "S3Key";
const _SL = "S3Location";
const _SM = "SessionMode";
const _SOC = "SelectObjectContent";
const _SOCES = "SelectObjectContentEventStream";
const _SOCO = "SelectObjectContentOutput";
const _SOCR = "SelectObjectContentRequest";
const _SP = "SelectParameters";
const _SPi = "SimplePrefix";
const _SR = "ScanRange";
const _SS = "SSE-S3";
const _SSC = "SourceSelectionCriteria";
const _SSE = "ServerSideEncryption";
const _SSEA = "SSEAlgorithm";
const _SSEBD = "ServerSideEncryptionByDefault";
const _SSEC = "ServerSideEncryptionConfiguration";
const _SSECA = "SSECustomerAlgorithm";
const _SSECK = "SSECustomerKey";
const _SSECKMD = "SSECustomerKeyMD5";
const _SSEKMS = "SSEKMS";
const _SSEKMSE = "SSEKMSEncryption";
const _SSEKMSEC = "SSEKMSEncryptionContext";
const _SSEKMSKI = "SSEKMSKeyId";
const _SSER = "ServerSideEncryptionRule";
const _SSERe = "ServerSideEncryptionRules";
const _SSES = "SSES3";
const _ST = "SessionToken";
const _STD = "S3TablesDestination";
const _STDR = "S3TablesDestinationResult";
const _S_ = "S3";
const _Sc = "Schedule";
const _Si = "Size";
const _St = "Start";
const _Sta = "Stats";
const _Su = "Suffix";
const _T = "Tags";
const _TA = "TableArn";
const _TAo = "TopicArn";
const _TB = "TargetBucket";
const _TBA = "TableBucketArn";
const _TBT = "TableBucketType";
const _TC = "TagCount";
const _TCL = "TopicConfigurationList";
const _TCo = "TopicConfigurations";
const _TCop = "TopicConfiguration";
const _TD = "TaggingDirective";
const _TDMOS = "TransitionDefaultMinimumObjectSize";
const _TG = "TargetGrants";
const _TGa = "TargetGrant";
const _TL = "TieringList";
const _TLr = "TransitionList";
const _TMP = "TooManyParts";
const _TN = "TableNamespace";
const _TNa = "TableName";
const _TOKF = "TargetObjectKeyFormat";
const _TP = "TargetPrefix";
const _TPC = "TotalPartsCount";
const _TS = "TagSet";
const _TSa = "TableStatus";
const _Ta = "Tag";
const _Tag = "Tagging";
const _Ti = "Tier";
const _Tie = "Tierings";
const _Tier = "Tiering";
const _Tim = "Time";
const _To = "Token";
const _Top = "Topic";
const _Tr = "Transitions";
const _Tra = "Transition";
const _Ty = "Type";
const _U = "Uploads";
const _UBMITC = "UpdateBucketMetadataInventoryTableConfiguration";
const _UBMITCR = "UpdateBucketMetadataInventoryTableConfigurationRequest";
const _UBMJTC = "UpdateBucketMetadataJournalTableConfiguration";
const _UBMJTCR = "UpdateBucketMetadataJournalTableConfigurationRequest";
const _UI = "UploadId";
const _UIM = "UploadIdMarker";
const _UM = "UserMetadata";
const _UOE = "UpdateObjectEncryption";
const _UOER = "UpdateObjectEncryptionRequest";
const _UOERp = "UpdateObjectEncryptionResponse";
const _UP = "UploadPart";
const _UPC = "UploadPartCopy";
const _UPCO = "UploadPartCopyOutput";
const _UPCR = "UploadPartCopyRequest";
const _UPO = "UploadPartOutput";
const _UPR = "UploadPartRequest";
const _URI = "URI";
const _Up = "Upload";
const _V = "Value";
const _VC = "VersioningConfiguration";
const _VI = "VersionId";
const _VIM = "VersionIdMarker";
const _Ve = "Versions";
const _Ver = "Version";
const _WC = "WebsiteConfiguration";
const _WGOR = "WriteGetObjectResponse";
const _WGORR = "WriteGetObjectResponseRequest";
const _WOB = "WriteOffsetBytes";
const _WRL = "WebsiteRedirectLocation";
const _Y = "Years";
const _ar = "accept-ranges";
const _br = "bucket-region";
const _c = "client";
const _ct = "continuation-token";
const _d = "delimiter";
const _e = "error";
const _eP = "eventPayload";
const _en = "endpoint";
const _et = "encoding-type";
const _fo = "fetch-owner";
const _h = "http";
const _hC = "httpChecksum";
const _hE = "httpError";
const _hH = "httpHeader";
const _hL = "hostLabel";
const _hP = "httpPayload";
const _hPH = "httpPrefixHeaders";
const _hQ = "httpQuery";
const _hi = "http://www.w3.org/2001/XMLSchema-instance";
const _i = "id";
const _iT = "idempotencyToken";
const _km = "key-marker";
const _m = "marker";
const _mb = "max-buckets";
const _mdb = "max-directory-buckets";
const _mk = "max-keys";
const _mp = "max-parts";
const _mu = "max-uploads";
const _p = "prefix";
const _pN = "partNumber";
const _pnm = "part-number-marker";
const _rcc = "response-cache-control";
const _rcd = "response-content-disposition";
const _rce = "response-content-encoding";
const _rcl = "response-content-language";
const _rct = "response-content-type";
const _re = "response-expires";
const _s = "smithy.ts.sdk.synthetic.com.amazonaws.s3";
const _sa = "start-after";
const _st = "streaming";
const _uI = "uploadId";
const _uim = "upload-id-marker";
const _vI = "versionId";
const _vim = "version-id-marker";
const _x = "xsi";
const _xA = "xmlAttribute";
const _xF = "xmlFlattened";
const _xN = "xmlName";
const _xNm = "xmlNamespace";
const _xaa = "x-amz-acl";
const _xaad = "x-amz-abort-date";
const _xaapa = "x-amz-access-point-alias";
const _xaari = "x-amz-abort-rule-id";
const _xaas = "x-amz-archive-status";
const _xaba = "x-amz-bucket-arn";
const _xabgr = "x-amz-bypass-governance-retention";
const _xabln = "x-amz-bucket-location-name";
const _xablt = "x-amz-bucket-location-type";
const _xabn = "x-amz-bucket-namespace";
const _xabole = "x-amz-bucket-object-lock-enabled";
const _xabolt = "x-amz-bucket-object-lock-token";
const _xabr = "x-amz-bucket-region";
const _xaca = "x-amz-checksum-algorithm";
const _xacc = "x-amz-checksum-crc32";
const _xacc_ = "x-amz-checksum-crc32c";
const _xacc__ = "x-amz-checksum-crc64nvme";
const _xacm = "x-amz-checksum-mode";
const _xacrsba = "x-amz-confirm-remove-self-bucket-access";
const _xacs = "x-amz-checksum-sha1";
const _xacs_ = "x-amz-checksum-sha256";
const _xacs__ = "x-amz-copy-source";
const _xacsim = "x-amz-copy-source-if-match";
const _xacsims = "x-amz-copy-source-if-modified-since";
const _xacsinm = "x-amz-copy-source-if-none-match";
const _xacsius = "x-amz-copy-source-if-unmodified-since";
const _xacsm = "x-amz-create-session-mode";
const _xacsr = "x-amz-copy-source-range";
const _xacssseca = "x-amz-copy-source-server-side-encryption-customer-algorithm";
const _xacssseck = "x-amz-copy-source-server-side-encryption-customer-key";
const _xacssseckM = "x-amz-copy-source-server-side-encryption-customer-key-MD5";
const _xacsvi = "x-amz-copy-source-version-id";
const _xact = "x-amz-checksum-type";
const _xact_ = "x-amz-client-token";
const _xadm = "x-amz-delete-marker";
const _xae = "x-amz-expiration";
const _xaebo = "x-amz-expected-bucket-owner";
const _xafec = "x-amz-fwd-error-code";
const _xafem = "x-amz-fwd-error-message";
const _xafhCC = "x-amz-fwd-header-Cache-Control";
const _xafhCD = "x-amz-fwd-header-Content-Disposition";
const _xafhCE = "x-amz-fwd-header-Content-Encoding";
const _xafhCL = "x-amz-fwd-header-Content-Language";
const _xafhCR = "x-amz-fwd-header-Content-Range";
const _xafhCT = "x-amz-fwd-header-Content-Type";
const _xafhE = "x-amz-fwd-header-ETag";
const _xafhE_ = "x-amz-fwd-header-Expires";
const _xafhLM = "x-amz-fwd-header-Last-Modified";
const _xafhar = "x-amz-fwd-header-accept-ranges";
const _xafhxacc = "x-amz-fwd-header-x-amz-checksum-crc32";
const _xafhxacc_ = "x-amz-fwd-header-x-amz-checksum-crc32c";
const _xafhxacc__ = "x-amz-fwd-header-x-amz-checksum-crc64nvme";
const _xafhxacs = "x-amz-fwd-header-x-amz-checksum-sha1";
const _xafhxacs_ = "x-amz-fwd-header-x-amz-checksum-sha256";
const _xafhxadm = "x-amz-fwd-header-x-amz-delete-marker";
const _xafhxae = "x-amz-fwd-header-x-amz-expiration";
const _xafhxamm = "x-amz-fwd-header-x-amz-missing-meta";
const _xafhxampc = "x-amz-fwd-header-x-amz-mp-parts-count";
const _xafhxaollh = "x-amz-fwd-header-x-amz-object-lock-legal-hold";
const _xafhxaolm = "x-amz-fwd-header-x-amz-object-lock-mode";
const _xafhxaolrud = "x-amz-fwd-header-x-amz-object-lock-retain-until-date";
const _xafhxar = "x-amz-fwd-header-x-amz-restore";
const _xafhxarc = "x-amz-fwd-header-x-amz-request-charged";
const _xafhxars = "x-amz-fwd-header-x-amz-replication-status";
const _xafhxasc = "x-amz-fwd-header-x-amz-storage-class";
const _xafhxasse = "x-amz-fwd-header-x-amz-server-side-encryption";
const _xafhxasseakki = "x-amz-fwd-header-x-amz-server-side-encryption-aws-kms-key-id";
const _xafhxassebke = "x-amz-fwd-header-x-amz-server-side-encryption-bucket-key-enabled";
const _xafhxasseca = "x-amz-fwd-header-x-amz-server-side-encryption-customer-algorithm";
const _xafhxasseckM = "x-amz-fwd-header-x-amz-server-side-encryption-customer-key-MD5";
const _xafhxatc = "x-amz-fwd-header-x-amz-tagging-count";
const _xafhxavi = "x-amz-fwd-header-x-amz-version-id";
const _xafs = "x-amz-fwd-status";
const _xagfc = "x-amz-grant-full-control";
const _xagr = "x-amz-grant-read";
const _xagra = "x-amz-grant-read-acp";
const _xagw = "x-amz-grant-write";
const _xagwa = "x-amz-grant-write-acp";
const _xaimit = "x-amz-if-match-initiated-time";
const _xaimlmt = "x-amz-if-match-last-modified-time";
const _xaims = "x-amz-if-match-size";
const _xam = "x-amz-meta-";
const _xam_ = "x-amz-mfa";
const _xamd = "x-amz-metadata-directive";
const _xamm = "x-amz-missing-meta";
const _xamos = "x-amz-mp-object-size";
const _xamp = "x-amz-max-parts";
const _xampc = "x-amz-mp-parts-count";
const _xaoa = "x-amz-object-attributes";
const _xaollh = "x-amz-object-lock-legal-hold";
const _xaolm = "x-amz-object-lock-mode";
const _xaolrud = "x-amz-object-lock-retain-until-date";
const _xaoo = "x-amz-object-ownership";
const _xaooa = "x-amz-optional-object-attributes";
const _xaos = "x-amz-object-size";
const _xapnm = "x-amz-part-number-marker";
const _xar = "x-amz-restore";
const _xarc = "x-amz-request-charged";
const _xarop = "x-amz-restore-output-path";
const _xarp = "x-amz-request-payer";
const _xarr = "x-amz-request-route";
const _xars = "x-amz-replication-status";
const _xars_ = "x-amz-rename-source";
const _xarsim = "x-amz-rename-source-if-match";
const _xarsims = "x-amz-rename-source-if-modified-since";
const _xarsinm = "x-amz-rename-source-if-none-match";
const _xarsius = "x-amz-rename-source-if-unmodified-since";
const _xart = "x-amz-request-token";
const _xasc = "x-amz-storage-class";
const _xasca = "x-amz-sdk-checksum-algorithm";
const _xasdv = "x-amz-skip-destination-validation";
const _xasebo = "x-amz-source-expected-bucket-owner";
const _xasse = "x-amz-server-side-encryption";
const _xasseakki = "x-amz-server-side-encryption-aws-kms-key-id";
const _xassebke = "x-amz-server-side-encryption-bucket-key-enabled";
const _xassec = "x-amz-server-side-encryption-context";
const _xasseca = "x-amz-server-side-encryption-customer-algorithm";
const _xasseck = "x-amz-server-side-encryption-customer-key";
const _xasseckM = "x-amz-server-side-encryption-customer-key-MD5";
const _xat = "x-amz-tagging";
const _xatc = "x-amz-tagging-count";
const _xatd = "x-amz-tagging-directive";
const _xatdmos = "x-amz-transition-default-minimum-object-size";
const _xavi = "x-amz-version-id";
const _xawob = "x-amz-write-offset-bytes";
const _xawrl = "x-amz-website-redirect-location";
const _xs = "xsi:type";
const n0 = "com.amazonaws.s3";
const _s_registry = TypeRegistry.for(_s);
var S3ServiceException$ = [-3, _s, "S3ServiceException", 0, [], []];
_s_registry.registerError(S3ServiceException$, S3ServiceException);
const n0_registry = TypeRegistry.for(n0);
var AccessDenied$ = [-3, n0, _AD,
    { [_e]: _c, [_hE]: 403 },
    [],
    []
];
n0_registry.registerError(AccessDenied$, AccessDenied);
var BucketAlreadyExists$ = [-3, n0, _BAE,
    { [_e]: _c, [_hE]: 409 },
    [],
    []
];
n0_registry.registerError(BucketAlreadyExists$, BucketAlreadyExists);
var BucketAlreadyOwnedByYou$ = [-3, n0, _BAOBY,
    { [_e]: _c, [_hE]: 409 },
    [],
    []
];
n0_registry.registerError(BucketAlreadyOwnedByYou$, BucketAlreadyOwnedByYou);
var EncryptionTypeMismatch$ = [-3, n0, _ETM,
    { [_e]: _c, [_hE]: 400 },
    [],
    []
];
n0_registry.registerError(EncryptionTypeMismatch$, EncryptionTypeMismatch);
var IdempotencyParameterMismatch$ = [-3, n0, _IPM,
    { [_e]: _c, [_hE]: 400 },
    [],
    []
];
n0_registry.registerError(IdempotencyParameterMismatch$, IdempotencyParameterMismatch);
var InvalidObjectState$ = [-3, n0, _IOS,
    { [_e]: _c, [_hE]: 403 },
    [_SC, _AT],
    [0, 0]
];
n0_registry.registerError(InvalidObjectState$, InvalidObjectState);
var InvalidRequest$ = [-3, n0, _IR,
    { [_e]: _c, [_hE]: 400 },
    [],
    []
];
n0_registry.registerError(InvalidRequest$, InvalidRequest);
var InvalidWriteOffset$ = [-3, n0, _IWO,
    { [_e]: _c, [_hE]: 400 },
    [],
    []
];
n0_registry.registerError(InvalidWriteOffset$, InvalidWriteOffset);
var NoSuchBucket$ = [-3, n0, _NSB,
    { [_e]: _c, [_hE]: 404 },
    [],
    []
];
n0_registry.registerError(NoSuchBucket$, NoSuchBucket);
var NoSuchKey$ = [-3, n0, _NSK,
    { [_e]: _c, [_hE]: 404 },
    [],
    []
];
n0_registry.registerError(NoSuchKey$, NoSuchKey);
var NoSuchUpload$ = [-3, n0, _NSU,
    { [_e]: _c, [_hE]: 404 },
    [],
    []
];
n0_registry.registerError(NoSuchUpload$, NoSuchUpload);
var NotFound$ = [-3, n0, _NF,
    { [_e]: _c },
    [],
    []
];
n0_registry.registerError(NotFound$, NotFound);
var ObjectAlreadyInActiveTierError$ = [-3, n0, _OAIATE,
    { [_e]: _c, [_hE]: 403 },
    [],
    []
];
n0_registry.registerError(ObjectAlreadyInActiveTierError$, ObjectAlreadyInActiveTierError);
var ObjectNotInActiveTierError$ = [-3, n0, _ONIATE,
    { [_e]: _c, [_hE]: 403 },
    [],
    []
];
n0_registry.registerError(ObjectNotInActiveTierError$, ObjectNotInActiveTierError);
var TooManyParts$ = [-3, n0, _TMP,
    { [_e]: _c, [_hE]: 400 },
    [],
    []
];
n0_registry.registerError(TooManyParts$, TooManyParts);
const errorTypeRegistries = [
    _s_registry,
    n0_registry,
];
var CopySourceSSECustomerKey = [0, n0, _CSSSECK, 8, 0];
var NonEmptyKmsKeyArnString = [0, n0, _NEKKAS, 8, 0];
var SessionCredentialValue = [0, n0, _SCV, 8, 0];
var SSECustomerKey = [0, n0, _SSECK, 8, 0];
var SSEKMSEncryptionContext = [0, n0, _SSEKMSEC, 8, 0];
var SSEKMSKeyId = [0, n0, _SSEKMSKI, 8, 0];
var StreamingBlob = [0, n0, _SB, { [_st]: 1 }, 42];
var AbacStatus$ = [3, n0, _AS,
    0,
    [_S],
    [0]
];
var AbortIncompleteMultipartUpload$ = [3, n0, _AIMU,
    0,
    [_DAI],
    [1]
];
var AbortMultipartUploadOutput$ = [3, n0, _AMUO,
    0,
    [_RC],
    [[0, { [_hH]: _xarc }]]
];
var AbortMultipartUploadRequest$ = [3, n0, _AMUR,
    0,
    [_B, _K, _UI, _RP, _EBO, _IMIT],
    [[0, 1], [0, 1], [0, { [_hQ]: _uI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [6, { [_hH]: _xaimit }]], 3
];
var AccelerateConfiguration$ = [3, n0, _AC,
    0,
    [_S],
    [0]
];
var AccessControlPolicy$ = [3, n0, _ACP,
    0,
    [_G, _O],
    [[() => Grants, { [_xN]: _ACL }], () => Owner$]
];
var AccessControlTranslation$ = [3, n0, _ACT,
    0,
    [_O],
    [0], 1
];
var AnalyticsAndOperator$ = [3, n0, _AAO,
    0,
    [_P, _T],
    [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }]]
];
var AnalyticsConfiguration$ = [3, n0, _ACn,
    0,
    [_I, _SCA, _F],
    [0, () => StorageClassAnalysis$, [() => AnalyticsFilter$, 0]], 2
];
var AnalyticsExportDestination$ = [3, n0, _AED,
    0,
    [_SBD],
    [() => AnalyticsS3BucketDestination$], 1
];
var AnalyticsS3BucketDestination$ = [3, n0, _ASBD,
    0,
    [_Fo, _B, _BAI, _P],
    [0, 0, 0, 0], 2
];
var BlockedEncryptionTypes$ = [3, n0, _BET,
    0,
    [_ET],
    [[() => EncryptionTypeList, { [_xF]: 1 }]]
];
var Bucket$ = [3, n0, _B,
    0,
    [_N, _CD, _BR, _BA],
    [0, 4, 0, 0]
];
var BucketInfo$ = [3, n0, _BI,
    0,
    [_DR, _Ty],
    [0, 0]
];
var BucketLifecycleConfiguration$ = [3, n0, _BLC,
    0,
    [_R],
    [[() => LifecycleRules, { [_xF]: 1, [_xN]: _Ru }]], 1
];
var BucketLoggingStatus$ = [3, n0, _BLS,
    0,
    [_LE],
    [[() => LoggingEnabled$, 0]]
];
var Checksum$ = [3, n0, _C,
    0,
    [_CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CT],
    [0, 0, 0, 0, 0, 0]
];
var CommonPrefix$ = [3, n0, _CP,
    0,
    [_P],
    [0]
];
var CompletedMultipartUpload$ = [3, n0, _CMU,
    0,
    [_Pa],
    [[() => CompletedPartList, { [_xF]: 1, [_xN]: _Par }]]
];
var CompletedPart$ = [3, n0, _CPo,
    0,
    [_ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _PN],
    [0, 0, 0, 0, 0, 0, 1]
];
var CompleteMultipartUploadOutput$ = [3, n0, _CMUO,
    { [_xN]: _CMUR },
    [_L, _B, _K, _E, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CT, _SSE, _VI, _SSEKMSKI, _BKE, _RC],
    [0, 0, 0, [0, { [_hH]: _xae }], 0, 0, 0, 0, 0, 0, 0, [0, { [_hH]: _xasse }], [0, { [_hH]: _xavi }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var CompleteMultipartUploadRequest$ = [3, n0, _CMURo,
    0,
    [_B, _K, _UI, _MU, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CT, _MOS, _RP, _EBO, _IM, _INM, _SSECA, _SSECK, _SSECKMD],
    [[0, 1], [0, 1], [0, { [_hQ]: _uI }], [() => CompletedMultipartUpload$, { [_hP]: 1, [_xN]: _CMUo }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xact }], [1, { [_hH]: _xamos }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }]], 3
];
var Condition$ = [3, n0, _Co,
    0,
    [_HECRE, _KPE],
    [0, 0]
];
var ContinuationEvent$ = [3, n0, _CE,
    0,
    [],
    []
];
var CopyObjectOutput$ = [3, n0, _COO,
    0,
    [_COR, _E, _CSVI, _VI, _SSE, _SSECA, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RC],
    [[() => CopyObjectResult$, 16], [0, { [_hH]: _xae }], [0, { [_hH]: _xacsvi }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var CopyObjectRequest$ = [3, n0, _CORo,
    0,
    [_B, _CS, _K, _ACL_, _CC, _CA, _CDo, _CEo, _CL, _CTo, _CSIM, _CSIMS, _CSINM, _CSIUS, _Ex, _GFC, _GR, _GRACP, _GWACP, _IM, _INM, _M, _MD, _TD, _SSE, _SC, _WRL, _SSECA, _SSECK, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _CSSSECA, _CSSSECK, _CSSSECKMD, _RP, _Tag, _OLM, _OLRUD, _OLLHS, _EBO, _ESBO],
    [[0, 1], [0, { [_hH]: _xacs__ }], [0, 1], [0, { [_hH]: _xaa }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _xaca }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CT_ }], [0, { [_hH]: _xacsim }], [4, { [_hH]: _xacsims }], [0, { [_hH]: _xacsinm }], [4, { [_hH]: _xacsius }], [4, { [_hH]: _Ex }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagwa }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xamd }], [0, { [_hH]: _xatd }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xacssseca }], [() => CopySourceSSECustomerKey, { [_hH]: _xacssseck }], [0, { [_hH]: _xacssseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xat }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasebo }]], 3
];
var CopyObjectResult$ = [3, n0, _COR,
    0,
    [_ETa, _LM, _CT, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh],
    [0, 4, 0, 0, 0, 0, 0, 0]
];
var CopyPartResult$ = [3, n0, _CPR,
    0,
    [_ETa, _LM, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh],
    [0, 4, 0, 0, 0, 0, 0]
];
var CORSConfiguration$ = [3, n0, _CORSC,
    0,
    [_CORSR],
    [[() => CORSRules, { [_xF]: 1, [_xN]: _CORSRu }]], 1
];
var CORSRule$ = [3, n0, _CORSRu,
    0,
    [_AM, _AO, _ID, _AH, _EH, _MAS],
    [[64 | 0, { [_xF]: 1, [_xN]: _AMl }], [64 | 0, { [_xF]: 1, [_xN]: _AOl }], 0, [64 | 0, { [_xF]: 1, [_xN]: _AHl }], [64 | 0, { [_xF]: 1, [_xN]: _EHx }], 1], 2
];
var CreateBucketConfiguration$ = [3, n0, _CBC,
    0,
    [_LC, _L, _B, _T],
    [0, () => LocationInfo$, () => BucketInfo$, [() => TagSet, 0]]
];
var CreateBucketMetadataConfigurationRequest$ = [3, n0, _CBMCR,
    0,
    [_B, _MC, _CMD, _CA, _EBO],
    [[0, 1], [() => MetadataConfiguration$, { [_hP]: 1, [_xN]: _MC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var CreateBucketMetadataTableConfigurationRequest$ = [3, n0, _CBMTCR,
    0,
    [_B, _MTC, _CMD, _CA, _EBO],
    [[0, 1], [() => MetadataTableConfiguration$, { [_hP]: 1, [_xN]: _MTC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var CreateBucketOutput$ = [3, n0, _CBO,
    0,
    [_L, _BA],
    [[0, { [_hH]: _L }], [0, { [_hH]: _xaba }]]
];
var CreateBucketRequest$ = [3, n0, _CBR,
    0,
    [_B, _ACL_, _CBC, _GFC, _GR, _GRACP, _GW, _GWACP, _OLEFB, _OO, _BN],
    [[0, 1], [0, { [_hH]: _xaa }], [() => CreateBucketConfiguration$, { [_hP]: 1, [_xN]: _CBC }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagw }], [0, { [_hH]: _xagwa }], [2, { [_hH]: _xabole }], [0, { [_hH]: _xaoo }], [0, { [_hH]: _xabn }]], 1
];
var CreateMultipartUploadOutput$ = [3, n0, _CMUOr,
    { [_xN]: _IMUR },
    [_ADb, _ARI, _B, _K, _UI, _SSE, _SSECA, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RC, _CA, _CT],
    [[4, { [_hH]: _xaad }], [0, { [_hH]: _xaari }], [0, { [_xN]: _B }], 0, 0, [0, { [_hH]: _xasse }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }], [0, { [_hH]: _xaca }], [0, { [_hH]: _xact }]]
];
var CreateMultipartUploadRequest$ = [3, n0, _CMURr,
    0,
    [_B, _K, _ACL_, _CC, _CDo, _CEo, _CL, _CTo, _Ex, _GFC, _GR, _GRACP, _GWACP, _M, _SSE, _SC, _WRL, _SSECA, _SSECK, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RP, _Tag, _OLM, _OLRUD, _OLLHS, _EBO, _CA, _CT],
    [[0, 1], [0, 1], [0, { [_hH]: _xaa }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CT_ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagwa }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xat }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xaca }], [0, { [_hH]: _xact }]], 2
];
var CreateSessionOutput$ = [3, n0, _CSO,
    { [_xN]: _CSR },
    [_Cr, _SSE, _SSEKMSKI, _SSEKMSEC, _BKE],
    [[() => SessionCredentials$, { [_xN]: _Cr }], [0, { [_hH]: _xasse }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }]], 1
];
var CreateSessionRequest$ = [3, n0, _CSRr,
    0,
    [_B, _SM, _SSE, _SSEKMSKI, _SSEKMSEC, _BKE],
    [[0, 1], [0, { [_hH]: _xacsm }], [0, { [_hH]: _xasse }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }]], 1
];
var CSVInput$ = [3, n0, _CSVIn,
    0,
    [_FHI, _Com, _QEC, _RD, _FD, _QC, _AQRD],
    [0, 0, 0, 0, 0, 0, 2]
];
var CSVOutput$ = [3, n0, _CSVO,
    0,
    [_QF, _QEC, _RD, _FD, _QC],
    [0, 0, 0, 0, 0]
];
var DefaultRetention$ = [3, n0, _DRe,
    0,
    [_Mo, _D, _Y],
    [0, 1, 1]
];
var Delete$ = [3, n0, _De,
    0,
    [_Ob, _Q],
    [[() => ObjectIdentifierList, { [_xF]: 1, [_xN]: _Obj }], 2], 1
];
var DeleteBucketAnalyticsConfigurationRequest$ = [3, n0, _DBACR,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var DeleteBucketCorsRequest$ = [3, n0, _DBCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketEncryptionRequest$ = [3, n0, _DBER,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketIntelligentTieringConfigurationRequest$ = [3, n0, _DBITCR,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var DeleteBucketInventoryConfigurationRequest$ = [3, n0, _DBICR,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var DeleteBucketLifecycleRequest$ = [3, n0, _DBLR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketMetadataConfigurationRequest$ = [3, n0, _DBMCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketMetadataTableConfigurationRequest$ = [3, n0, _DBMTCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketMetricsConfigurationRequest$ = [3, n0, _DBMCRe,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var DeleteBucketOwnershipControlsRequest$ = [3, n0, _DBOCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketPolicyRequest$ = [3, n0, _DBPR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketReplicationRequest$ = [3, n0, _DBRR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketRequest$ = [3, n0, _DBR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketTaggingRequest$ = [3, n0, _DBTR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeleteBucketWebsiteRequest$ = [3, n0, _DBWR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var DeletedObject$ = [3, n0, _DO,
    0,
    [_K, _VI, _DM, _DMVI],
    [0, 0, 2, 0]
];
var DeleteMarkerEntry$ = [3, n0, _DME,
    0,
    [_O, _K, _VI, _IL, _LM],
    [() => Owner$, 0, 0, 2, 4]
];
var DeleteMarkerReplication$ = [3, n0, _DMR,
    0,
    [_S],
    [0]
];
var DeleteObjectOutput$ = [3, n0, _DOO,
    0,
    [_DM, _VI, _RC],
    [[2, { [_hH]: _xadm }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xarc }]]
];
var DeleteObjectRequest$ = [3, n0, _DOR,
    0,
    [_B, _K, _MFA, _VI, _RP, _BGR, _EBO, _IM, _IMLMT, _IMS],
    [[0, 1], [0, 1], [0, { [_hH]: _xam_ }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [2, { [_hH]: _xabgr }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _IM_ }], [6, { [_hH]: _xaimlmt }], [1, { [_hH]: _xaims }]], 2
];
var DeleteObjectsOutput$ = [3, n0, _DOOe,
    { [_xN]: _DRel },
    [_Del, _RC, _Er],
    [[() => DeletedObjects, { [_xF]: 1 }], [0, { [_hH]: _xarc }], [() => Errors, { [_xF]: 1, [_xN]: _Err }]]
];
var DeleteObjectsRequest$ = [3, n0, _DORe,
    0,
    [_B, _De, _MFA, _RP, _BGR, _EBO, _CA],
    [[0, 1], [() => Delete$, { [_hP]: 1, [_xN]: _De }], [0, { [_hH]: _xam_ }], [0, { [_hH]: _xarp }], [2, { [_hH]: _xabgr }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasca }]], 2
];
var DeleteObjectTaggingOutput$ = [3, n0, _DOTO,
    0,
    [_VI],
    [[0, { [_hH]: _xavi }]]
];
var DeleteObjectTaggingRequest$ = [3, n0, _DOTR,
    0,
    [_B, _K, _VI, _EBO],
    [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xaebo }]], 2
];
var DeletePublicAccessBlockRequest$ = [3, n0, _DPABR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var Destination$ = [3, n0, _Des,
    0,
    [_B, _A, _SC, _ACT, _EC, _RT, _Me],
    [0, 0, 0, () => AccessControlTranslation$, () => EncryptionConfiguration$, () => ReplicationTime$, () => Metrics$], 1
];
var DestinationResult$ = [3, n0, _DRes,
    0,
    [_TBT, _TBA, _TN],
    [0, 0, 0]
];
var Encryption$ = [3, n0, _En,
    0,
    [_ET, _KMSKI, _KMSC],
    [0, [() => SSEKMSKeyId, 0], 0], 1
];
var EncryptionConfiguration$ = [3, n0, _EC,
    0,
    [_RKKID],
    [0]
];
var EndEvent$ = [3, n0, _EE,
    0,
    [],
    []
];
var _Error$ = [3, n0, _Err,
    0,
    [_K, _VI, _Cod, _Mes],
    [0, 0, 0, 0]
];
var ErrorDetails$ = [3, n0, _ED,
    0,
    [_ECr, _EM],
    [0, 0]
];
var ErrorDocument$ = [3, n0, _EDr,
    0,
    [_K],
    [0], 1
];
var EventBridgeConfiguration$ = [3, n0, _EBC,
    0,
    [],
    []
];
var ExistingObjectReplication$ = [3, n0, _EOR,
    0,
    [_S],
    [0], 1
];
var FilterRule$ = [3, n0, _FR,
    0,
    [_N, _V],
    [0, 0]
];
var GetBucketAbacOutput$ = [3, n0, _GBAO,
    0,
    [_AS],
    [[() => AbacStatus$, 16]]
];
var GetBucketAbacRequest$ = [3, n0, _GBAR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketAccelerateConfigurationOutput$ = [3, n0, _GBACO,
    { [_xN]: _AC },
    [_S, _RC],
    [0, [0, { [_hH]: _xarc }]]
];
var GetBucketAccelerateConfigurationRequest$ = [3, n0, _GBACR,
    0,
    [_B, _EBO, _RP],
    [[0, 1], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]], 1
];
var GetBucketAclOutput$ = [3, n0, _GBAOe,
    { [_xN]: _ACP },
    [_O, _G],
    [() => Owner$, [() => Grants, { [_xN]: _ACL }]]
];
var GetBucketAclRequest$ = [3, n0, _GBARe,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketAnalyticsConfigurationOutput$ = [3, n0, _GBACOe,
    0,
    [_ACn],
    [[() => AnalyticsConfiguration$, 16]]
];
var GetBucketAnalyticsConfigurationRequest$ = [3, n0, _GBACRe,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var GetBucketCorsOutput$ = [3, n0, _GBCO,
    { [_xN]: _CORSC },
    [_CORSR],
    [[() => CORSRules, { [_xF]: 1, [_xN]: _CORSRu }]]
];
var GetBucketCorsRequest$ = [3, n0, _GBCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketEncryptionOutput$ = [3, n0, _GBEO,
    0,
    [_SSEC],
    [[() => ServerSideEncryptionConfiguration$, 16]]
];
var GetBucketEncryptionRequest$ = [3, n0, _GBER,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketIntelligentTieringConfigurationOutput$ = [3, n0, _GBITCO,
    0,
    [_ITC],
    [[() => IntelligentTieringConfiguration$, 16]]
];
var GetBucketIntelligentTieringConfigurationRequest$ = [3, n0, _GBITCR,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var GetBucketInventoryConfigurationOutput$ = [3, n0, _GBICO,
    0,
    [_IC],
    [[() => InventoryConfiguration$, 16]]
];
var GetBucketInventoryConfigurationRequest$ = [3, n0, _GBICR,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var GetBucketLifecycleConfigurationOutput$ = [3, n0, _GBLCO,
    { [_xN]: _LCi },
    [_R, _TDMOS],
    [[() => LifecycleRules, { [_xF]: 1, [_xN]: _Ru }], [0, { [_hH]: _xatdmos }]]
];
var GetBucketLifecycleConfigurationRequest$ = [3, n0, _GBLCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketLocationOutput$ = [3, n0, _GBLO,
    { [_xN]: _LC },
    [_LC],
    [0]
];
var GetBucketLocationRequest$ = [3, n0, _GBLR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketLoggingOutput$ = [3, n0, _GBLOe,
    { [_xN]: _BLS },
    [_LE],
    [[() => LoggingEnabled$, 0]]
];
var GetBucketLoggingRequest$ = [3, n0, _GBLRe,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketMetadataConfigurationOutput$ = [3, n0, _GBMCO,
    0,
    [_GBMCR],
    [[() => GetBucketMetadataConfigurationResult$, 16]]
];
var GetBucketMetadataConfigurationRequest$ = [3, n0, _GBMCRe,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketMetadataConfigurationResult$ = [3, n0, _GBMCR,
    0,
    [_MCR],
    [() => MetadataConfigurationResult$], 1
];
var GetBucketMetadataTableConfigurationOutput$ = [3, n0, _GBMTCO,
    0,
    [_GBMTCR],
    [[() => GetBucketMetadataTableConfigurationResult$, 16]]
];
var GetBucketMetadataTableConfigurationRequest$ = [3, n0, _GBMTCRe,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketMetadataTableConfigurationResult$ = [3, n0, _GBMTCR,
    0,
    [_MTCR, _S, _Err],
    [() => MetadataTableConfigurationResult$, 0, () => ErrorDetails$], 2
];
var GetBucketMetricsConfigurationOutput$ = [3, n0, _GBMCOe,
    0,
    [_MCe],
    [[() => MetricsConfiguration$, 16]]
];
var GetBucketMetricsConfigurationRequest$ = [3, n0, _GBMCRet,
    0,
    [_B, _I, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]], 2
];
var GetBucketNotificationConfigurationRequest$ = [3, n0, _GBNCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketOwnershipControlsOutput$ = [3, n0, _GBOCO,
    0,
    [_OC],
    [[() => OwnershipControls$, 16]]
];
var GetBucketOwnershipControlsRequest$ = [3, n0, _GBOCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketPolicyOutput$ = [3, n0, _GBPO,
    0,
    [_Po],
    [[0, 16]]
];
var GetBucketPolicyRequest$ = [3, n0, _GBPR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketPolicyStatusOutput$ = [3, n0, _GBPSO,
    0,
    [_PS],
    [[() => PolicyStatus$, 16]]
];
var GetBucketPolicyStatusRequest$ = [3, n0, _GBPSR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketReplicationOutput$ = [3, n0, _GBRO,
    0,
    [_RCe],
    [[() => ReplicationConfiguration$, 16]]
];
var GetBucketReplicationRequest$ = [3, n0, _GBRR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketRequestPaymentOutput$ = [3, n0, _GBRPO,
    { [_xN]: _RPC },
    [_Pay],
    [0]
];
var GetBucketRequestPaymentRequest$ = [3, n0, _GBRPR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketTaggingOutput$ = [3, n0, _GBTO,
    { [_xN]: _Tag },
    [_TS],
    [[() => TagSet, 0]], 1
];
var GetBucketTaggingRequest$ = [3, n0, _GBTR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketVersioningOutput$ = [3, n0, _GBVO,
    { [_xN]: _VC },
    [_S, _MFAD],
    [0, [0, { [_xN]: _MDf }]]
];
var GetBucketVersioningRequest$ = [3, n0, _GBVR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetBucketWebsiteOutput$ = [3, n0, _GBWO,
    { [_xN]: _WC },
    [_RART, _IDn, _EDr, _RR],
    [() => RedirectAllRequestsTo$, () => IndexDocument$, () => ErrorDocument$, [() => RoutingRules, 0]]
];
var GetBucketWebsiteRequest$ = [3, n0, _GBWR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetObjectAclOutput$ = [3, n0, _GOAO,
    { [_xN]: _ACP },
    [_O, _G, _RC],
    [() => Owner$, [() => Grants, { [_xN]: _ACL }], [0, { [_hH]: _xarc }]]
];
var GetObjectAclRequest$ = [3, n0, _GOAR,
    0,
    [_B, _K, _VI, _RP, _EBO],
    [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]], 2
];
var GetObjectAttributesOutput$ = [3, n0, _GOAOe,
    { [_xN]: _GOARe },
    [_DM, _LM, _VI, _RC, _ETa, _C, _OP, _SC, _OS],
    [[2, { [_hH]: _xadm }], [4, { [_hH]: _LM_ }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xarc }], 0, () => Checksum$, [() => GetObjectAttributesParts$, 0], 0, 1]
];
var GetObjectAttributesParts$ = [3, n0, _GOAP,
    0,
    [_TPC, _PNM, _NPNM, _MP, _IT, _Pa],
    [[1, { [_xN]: _PC }], 0, 0, 1, 2, [() => PartsList, { [_xF]: 1, [_xN]: _Par }]]
];
var GetObjectAttributesRequest$ = [3, n0, _GOARet,
    0,
    [_B, _K, _OA, _VI, _MP, _PNM, _SSECA, _SSECK, _SSECKMD, _RP, _EBO],
    [[0, 1], [0, 1], [64 | 0, { [_hH]: _xaoa }], [0, { [_hQ]: _vI }], [1, { [_hH]: _xamp }], [0, { [_hH]: _xapnm }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]], 3
];
var GetObjectLegalHoldOutput$ = [3, n0, _GOLHO,
    0,
    [_LH],
    [[() => ObjectLockLegalHold$, { [_hP]: 1, [_xN]: _LH }]]
];
var GetObjectLegalHoldRequest$ = [3, n0, _GOLHR,
    0,
    [_B, _K, _VI, _RP, _EBO],
    [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]], 2
];
var GetObjectLockConfigurationOutput$ = [3, n0, _GOLCO,
    0,
    [_OLC],
    [[() => ObjectLockConfiguration$, 16]]
];
var GetObjectLockConfigurationRequest$ = [3, n0, _GOLCR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GetObjectOutput$ = [3, n0, _GOO,
    0,
    [_Bo, _DM, _AR, _E, _Re, _LM, _CLo, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CT, _MM, _VI, _CC, _CDo, _CEo, _CL, _CR, _CTo, _Ex, _ES, _WRL, _SSE, _M, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _SC, _RC, _RS, _PC, _TC, _OLM, _OLRUD, _OLLHS],
    [[() => StreamingBlob, 16], [2, { [_hH]: _xadm }], [0, { [_hH]: _ar }], [0, { [_hH]: _xae }], [0, { [_hH]: _xar }], [4, { [_hH]: _LM_ }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _ETa }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xact }], [1, { [_hH]: _xamm }], [0, { [_hH]: _xavi }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CR_ }], [0, { [_hH]: _CT_ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _ES }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasse }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xarc }], [0, { [_hH]: _xars }], [1, { [_hH]: _xampc }], [1, { [_hH]: _xatc }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }]]
];
var GetObjectRequest$ = [3, n0, _GOR,
    0,
    [_B, _K, _IM, _IMSf, _INM, _IUS, _Ra, _RCC, _RCD, _RCE, _RCL, _RCT, _RE, _VI, _SSECA, _SSECK, _SSECKMD, _RP, _PN, _EBO, _CMh],
    [[0, 1], [0, 1], [0, { [_hH]: _IM_ }], [4, { [_hH]: _IMS_ }], [0, { [_hH]: _INM_ }], [4, { [_hH]: _IUS_ }], [0, { [_hH]: _Ra }], [0, { [_hQ]: _rcc }], [0, { [_hQ]: _rcd }], [0, { [_hQ]: _rce }], [0, { [_hQ]: _rcl }], [0, { [_hQ]: _rct }], [6, { [_hQ]: _re }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [1, { [_hQ]: _pN }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xacm }]], 2
];
var GetObjectRetentionOutput$ = [3, n0, _GORO,
    0,
    [_Ret],
    [[() => ObjectLockRetention$, { [_hP]: 1, [_xN]: _Ret }]]
];
var GetObjectRetentionRequest$ = [3, n0, _GORR,
    0,
    [_B, _K, _VI, _RP, _EBO],
    [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]], 2
];
var GetObjectTaggingOutput$ = [3, n0, _GOTO,
    { [_xN]: _Tag },
    [_TS, _VI],
    [[() => TagSet, 0], [0, { [_hH]: _xavi }]], 1
];
var GetObjectTaggingRequest$ = [3, n0, _GOTR,
    0,
    [_B, _K, _VI, _EBO, _RP],
    [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]], 2
];
var GetObjectTorrentOutput$ = [3, n0, _GOTOe,
    0,
    [_Bo, _RC],
    [[() => StreamingBlob, 16], [0, { [_hH]: _xarc }]]
];
var GetObjectTorrentRequest$ = [3, n0, _GOTRe,
    0,
    [_B, _K, _RP, _EBO],
    [[0, 1], [0, 1], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]], 2
];
var GetPublicAccessBlockOutput$ = [3, n0, _GPABO,
    0,
    [_PABC],
    [[() => PublicAccessBlockConfiguration$, 16]]
];
var GetPublicAccessBlockRequest$ = [3, n0, _GPABR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var GlacierJobParameters$ = [3, n0, _GJP,
    0,
    [_Ti],
    [0], 1
];
var Grant$ = [3, n0, _Gr,
    0,
    [_Gra, _Pe],
    [[() => Grantee$, { [_xNm]: [_x, _hi] }], 0]
];
var Grantee$ = [3, n0, _Gra,
    0,
    [_Ty, _DN, _EA, _ID, _URI],
    [[0, { [_xA]: 1, [_xN]: _xs }], 0, 0, 0, 0], 1
];
var HeadBucketOutput$ = [3, n0, _HBO,
    0,
    [_BA, _BLT, _BLN, _BR, _APA],
    [[0, { [_hH]: _xaba }], [0, { [_hH]: _xablt }], [0, { [_hH]: _xabln }], [0, { [_hH]: _xabr }], [2, { [_hH]: _xaapa }]]
];
var HeadBucketRequest$ = [3, n0, _HBR,
    0,
    [_B, _EBO],
    [[0, 1], [0, { [_hH]: _xaebo }]], 1
];
var HeadObjectOutput$ = [3, n0, _HOO,
    0,
    [_DM, _AR, _E, _Re, _ASr, _LM, _CLo, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CT, _ETa, _MM, _VI, _CC, _CDo, _CEo, _CL, _CTo, _CR, _Ex, _ES, _WRL, _SSE, _M, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _SC, _RC, _RS, _PC, _TC, _OLM, _OLRUD, _OLLHS],
    [[2, { [_hH]: _xadm }], [0, { [_hH]: _ar }], [0, { [_hH]: _xae }], [0, { [_hH]: _xar }], [0, { [_hH]: _xaas }], [4, { [_hH]: _LM_ }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xact }], [0, { [_hH]: _ETa }], [1, { [_hH]: _xamm }], [0, { [_hH]: _xavi }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CT_ }], [0, { [_hH]: _CR_ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _ES }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasse }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xarc }], [0, { [_hH]: _xars }], [1, { [_hH]: _xampc }], [1, { [_hH]: _xatc }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }]]
];
var HeadObjectRequest$ = [3, n0, _HOR,
    0,
    [_B, _K, _IM, _IMSf, _INM, _IUS, _Ra, _RCC, _RCD, _RCE, _RCL, _RCT, _RE, _VI, _SSECA, _SSECK, _SSECKMD, _RP, _PN, _EBO, _CMh],
    [[0, 1], [0, 1], [0, { [_hH]: _IM_ }], [4, { [_hH]: _IMS_ }], [0, { [_hH]: _INM_ }], [4, { [_hH]: _IUS_ }], [0, { [_hH]: _Ra }], [0, { [_hQ]: _rcc }], [0, { [_hQ]: _rcd }], [0, { [_hQ]: _rce }], [0, { [_hQ]: _rcl }], [0, { [_hQ]: _rct }], [6, { [_hQ]: _re }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [1, { [_hQ]: _pN }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xacm }]], 2
];
var IndexDocument$ = [3, n0, _IDn,
    0,
    [_Su],
    [0], 1
];
var Initiator$ = [3, n0, _In,
    0,
    [_ID, _DN],
    [0, 0]
];
var InputSerialization$ = [3, n0, _IS,
    0,
    [_CSV, _CTom, _JSON, _Parq],
    [() => CSVInput$, 0, () => JSONInput$, () => ParquetInput$]
];
var IntelligentTieringAndOperator$ = [3, n0, _ITAO,
    0,
    [_P, _T],
    [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }]]
];
var IntelligentTieringConfiguration$ = [3, n0, _ITC,
    0,
    [_I, _S, _Tie, _F],
    [0, 0, [() => TieringList, { [_xF]: 1, [_xN]: _Tier }], [() => IntelligentTieringFilter$, 0]], 3
];
var IntelligentTieringFilter$ = [3, n0, _ITF,
    0,
    [_P, _Ta, _An],
    [0, () => Tag$, [() => IntelligentTieringAndOperator$, 0]]
];
var InventoryConfiguration$ = [3, n0, _IC,
    0,
    [_Des, _IE, _I, _IOV, _Sc, _F, _OF],
    [[() => InventoryDestination$, 0], 2, 0, 0, () => InventorySchedule$, () => InventoryFilter$, [() => InventoryOptionalFields, 0]], 5
];
var InventoryDestination$ = [3, n0, _IDnv,
    0,
    [_SBD],
    [[() => InventoryS3BucketDestination$, 0]], 1
];
var InventoryEncryption$ = [3, n0, _IEn,
    0,
    [_SSES, _SSEKMS],
    [[() => SSES3$, { [_xN]: _SS }], [() => SSEKMS$, { [_xN]: _SK }]]
];
var InventoryFilter$ = [3, n0, _IF,
    0,
    [_P],
    [0], 1
];
var InventoryS3BucketDestination$ = [3, n0, _ISBD,
    0,
    [_B, _Fo, _AI, _P, _En],
    [0, 0, 0, 0, [() => InventoryEncryption$, 0]], 2
];
var InventorySchedule$ = [3, n0, _ISn,
    0,
    [_Fr],
    [0], 1
];
var InventoryTableConfiguration$ = [3, n0, _ITCn,
    0,
    [_CSo, _EC],
    [0, () => MetadataTableEncryptionConfiguration$], 1
];
var InventoryTableConfigurationResult$ = [3, n0, _ITCR,
    0,
    [_CSo, _TSa, _Err, _TNa, _TA],
    [0, 0, () => ErrorDetails$, 0, 0], 1
];
var InventoryTableConfigurationUpdates$ = [3, n0, _ITCU,
    0,
    [_CSo, _EC],
    [0, () => MetadataTableEncryptionConfiguration$], 1
];
var JournalTableConfiguration$ = [3, n0, _JTC,
    0,
    [_REe, _EC],
    [() => RecordExpiration$, () => MetadataTableEncryptionConfiguration$], 1
];
var JournalTableConfigurationResult$ = [3, n0, _JTCR,
    0,
    [_TSa, _TNa, _REe, _Err, _TA],
    [0, 0, () => RecordExpiration$, () => ErrorDetails$, 0], 3
];
var JournalTableConfigurationUpdates$ = [3, n0, _JTCU,
    0,
    [_REe],
    [() => RecordExpiration$], 1
];
var JSONInput$ = [3, n0, _JSONI,
    0,
    [_Ty],
    [0]
];
var JSONOutput$ = [3, n0, _JSONO,
    0,
    [_RD],
    [0]
];
var LambdaFunctionConfiguration$ = [3, n0, _LFC,
    0,
    [_LFA, _Ev, _I, _F],
    [[0, { [_xN]: _CF }], [64 | 0, { [_xF]: 1, [_xN]: _Eve }], 0, [() => NotificationConfigurationFilter$, 0]], 2
];
var LifecycleExpiration$ = [3, n0, _LEi,
    0,
    [_Da, _D, _EODM],
    [5, 1, 2]
];
var LifecycleRule$ = [3, n0, _LR,
    0,
    [_S, _E, _ID, _P, _F, _Tr, _NVT, _NVE, _AIMU],
    [0, () => LifecycleExpiration$, 0, 0, [() => LifecycleRuleFilter$, 0], [() => TransitionList, { [_xF]: 1, [_xN]: _Tra }], [() => NoncurrentVersionTransitionList, { [_xF]: 1, [_xN]: _NVTo }], () => NoncurrentVersionExpiration$, () => AbortIncompleteMultipartUpload$], 1
];
var LifecycleRuleAndOperator$ = [3, n0, _LRAO,
    0,
    [_P, _T, _OSGT, _OSLT],
    [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }], 1, 1]
];
var LifecycleRuleFilter$ = [3, n0, _LRF,
    0,
    [_P, _Ta, _OSGT, _OSLT, _An],
    [0, () => Tag$, 1, 1, [() => LifecycleRuleAndOperator$, 0]]
];
var ListBucketAnalyticsConfigurationsOutput$ = [3, n0, _LBACO,
    { [_xN]: _LBACR },
    [_IT, _CTon, _NCT, _ACLn],
    [2, 0, 0, [() => AnalyticsConfigurationList, { [_xF]: 1, [_xN]: _ACn }]]
];
var ListBucketAnalyticsConfigurationsRequest$ = [3, n0, _LBACRi,
    0,
    [_B, _CTon, _EBO],
    [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]], 1
];
var ListBucketIntelligentTieringConfigurationsOutput$ = [3, n0, _LBITCO,
    0,
    [_IT, _CTon, _NCT, _ITCL],
    [2, 0, 0, [() => IntelligentTieringConfigurationList, { [_xF]: 1, [_xN]: _ITC }]]
];
var ListBucketIntelligentTieringConfigurationsRequest$ = [3, n0, _LBITCR,
    0,
    [_B, _CTon, _EBO],
    [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]], 1
];
var ListBucketInventoryConfigurationsOutput$ = [3, n0, _LBICO,
    { [_xN]: _LICR },
    [_CTon, _ICL, _IT, _NCT],
    [0, [() => InventoryConfigurationList, { [_xF]: 1, [_xN]: _IC }], 2, 0]
];
var ListBucketInventoryConfigurationsRequest$ = [3, n0, _LBICR,
    0,
    [_B, _CTon, _EBO],
    [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]], 1
];
var ListBucketMetricsConfigurationsOutput$ = [3, n0, _LBMCO,
    { [_xN]: _LMCR },
    [_IT, _CTon, _NCT, _MCL],
    [2, 0, 0, [() => MetricsConfigurationList, { [_xF]: 1, [_xN]: _MCe }]]
];
var ListBucketMetricsConfigurationsRequest$ = [3, n0, _LBMCR,
    0,
    [_B, _CTon, _EBO],
    [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]], 1
];
var ListBucketsOutput$ = [3, n0, _LBO,
    { [_xN]: _LAMBR },
    [_Bu, _O, _CTon, _P],
    [[() => Buckets, 0], () => Owner$, 0, 0]
];
var ListBucketsRequest$ = [3, n0, _LBR,
    0,
    [_MB, _CTon, _P, _BR],
    [[1, { [_hQ]: _mb }], [0, { [_hQ]: _ct }], [0, { [_hQ]: _p }], [0, { [_hQ]: _br }]]
];
var ListDirectoryBucketsOutput$ = [3, n0, _LDBO,
    { [_xN]: _LAMDBR },
    [_Bu, _CTon],
    [[() => Buckets, 0], 0]
];
var ListDirectoryBucketsRequest$ = [3, n0, _LDBR,
    0,
    [_CTon, _MDB],
    [[0, { [_hQ]: _ct }], [1, { [_hQ]: _mdb }]]
];
var ListMultipartUploadsOutput$ = [3, n0, _LMUO,
    { [_xN]: _LMUR },
    [_B, _KM, _UIM, _NKM, _P, _Deli, _NUIM, _MUa, _IT, _U, _CPom, _ETn, _RC],
    [0, 0, 0, 0, 0, 0, 0, 1, 2, [() => MultipartUploadList, { [_xF]: 1, [_xN]: _Up }], [() => CommonPrefixList, { [_xF]: 1 }], 0, [0, { [_hH]: _xarc }]]
];
var ListMultipartUploadsRequest$ = [3, n0, _LMURi,
    0,
    [_B, _Deli, _ETn, _KM, _MUa, _P, _UIM, _EBO, _RP],
    [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [0, { [_hQ]: _km }], [1, { [_hQ]: _mu }], [0, { [_hQ]: _p }], [0, { [_hQ]: _uim }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]], 1
];
var ListObjectsOutput$ = [3, n0, _LOO,
    { [_xN]: _LBRi },
    [_IT, _Ma, _NM, _Con, _N, _P, _Deli, _MK, _CPom, _ETn, _RC],
    [2, 0, 0, [() => ObjectList, { [_xF]: 1 }], 0, 0, 0, 1, [() => CommonPrefixList, { [_xF]: 1 }], 0, [0, { [_hH]: _xarc }]]
];
var ListObjectsRequest$ = [3, n0, _LOR,
    0,
    [_B, _Deli, _ETn, _Ma, _MK, _P, _RP, _EBO, _OOA],
    [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [0, { [_hQ]: _m }], [1, { [_hQ]: _mk }], [0, { [_hQ]: _p }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [64 | 0, { [_hH]: _xaooa }]], 1
];
var ListObjectsV2Output$ = [3, n0, _LOVO,
    { [_xN]: _LBRi },
    [_IT, _Con, _N, _P, _Deli, _MK, _CPom, _ETn, _KC, _CTon, _NCT, _SA, _RC],
    [2, [() => ObjectList, { [_xF]: 1 }], 0, 0, 0, 1, [() => CommonPrefixList, { [_xF]: 1 }], 0, 1, 0, 0, 0, [0, { [_hH]: _xarc }]]
];
var ListObjectsV2Request$ = [3, n0, _LOVR,
    0,
    [_B, _Deli, _ETn, _MK, _P, _CTon, _FO, _SA, _RP, _EBO, _OOA],
    [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [1, { [_hQ]: _mk }], [0, { [_hQ]: _p }], [0, { [_hQ]: _ct }], [2, { [_hQ]: _fo }], [0, { [_hQ]: _sa }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [64 | 0, { [_hH]: _xaooa }]], 1
];
var ListObjectVersionsOutput$ = [3, n0, _LOVOi,
    { [_xN]: _LVR },
    [_IT, _KM, _VIM, _NKM, _NVIM, _Ve, _DMe, _N, _P, _Deli, _MK, _CPom, _ETn, _RC],
    [2, 0, 0, 0, 0, [() => ObjectVersionList, { [_xF]: 1, [_xN]: _Ver }], [() => DeleteMarkers, { [_xF]: 1, [_xN]: _DM }], 0, 0, 0, 1, [() => CommonPrefixList, { [_xF]: 1 }], 0, [0, { [_hH]: _xarc }]]
];
var ListObjectVersionsRequest$ = [3, n0, _LOVRi,
    0,
    [_B, _Deli, _ETn, _KM, _MK, _P, _VIM, _EBO, _RP, _OOA],
    [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [0, { [_hQ]: _km }], [1, { [_hQ]: _mk }], [0, { [_hQ]: _p }], [0, { [_hQ]: _vim }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }], [64 | 0, { [_hH]: _xaooa }]], 1
];
var ListPartsOutput$ = [3, n0, _LPO,
    { [_xN]: _LPR },
    [_ADb, _ARI, _B, _K, _UI, _PNM, _NPNM, _MP, _IT, _Pa, _In, _O, _SC, _RC, _CA, _CT],
    [[4, { [_hH]: _xaad }], [0, { [_hH]: _xaari }], 0, 0, 0, 0, 0, 1, 2, [() => Parts, { [_xF]: 1, [_xN]: _Par }], () => Initiator$, () => Owner$, 0, [0, { [_hH]: _xarc }], 0, 0]
];
var ListPartsRequest$ = [3, n0, _LPRi,
    0,
    [_B, _K, _UI, _MP, _PNM, _RP, _EBO, _SSECA, _SSECK, _SSECKMD],
    [[0, 1], [0, 1], [0, { [_hQ]: _uI }], [1, { [_hQ]: _mp }], [0, { [_hQ]: _pnm }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }]], 3
];
var LocationInfo$ = [3, n0, _LI,
    0,
    [_Ty, _N],
    [0, 0]
];
var LoggingEnabled$ = [3, n0, _LE,
    0,
    [_TB, _TP, _TG, _TOKF],
    [0, 0, [() => TargetGrants, 0], [() => TargetObjectKeyFormat$, 0]], 2
];
var MetadataConfiguration$ = [3, n0, _MC,
    0,
    [_JTC, _ITCn],
    [() => JournalTableConfiguration$, () => InventoryTableConfiguration$], 1
];
var MetadataConfigurationResult$ = [3, n0, _MCR,
    0,
    [_DRes, _JTCR, _ITCR],
    [() => DestinationResult$, () => JournalTableConfigurationResult$, () => InventoryTableConfigurationResult$], 1
];
var MetadataEntry$ = [3, n0, _ME,
    0,
    [_N, _V],
    [0, 0]
];
var MetadataTableConfiguration$ = [3, n0, _MTC,
    0,
    [_STD],
    [() => S3TablesDestination$], 1
];
var MetadataTableConfigurationResult$ = [3, n0, _MTCR,
    0,
    [_STDR],
    [() => S3TablesDestinationResult$], 1
];
var MetadataTableEncryptionConfiguration$ = [3, n0, _MTEC,
    0,
    [_SAs, _KKA],
    [0, 0], 1
];
var Metrics$ = [3, n0, _Me,
    0,
    [_S, _ETv],
    [0, () => ReplicationTimeValue$], 1
];
var MetricsAndOperator$ = [3, n0, _MAO,
    0,
    [_P, _T, _APAc],
    [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }], 0]
];
var MetricsConfiguration$ = [3, n0, _MCe,
    0,
    [_I, _F],
    [0, [() => MetricsFilter$, 0]], 1
];
var MultipartUpload$ = [3, n0, _MU,
    0,
    [_UI, _K, _Ini, _SC, _O, _In, _CA, _CT],
    [0, 0, 4, 0, () => Owner$, () => Initiator$, 0, 0]
];
var NoncurrentVersionExpiration$ = [3, n0, _NVE,
    0,
    [_ND, _NNV],
    [1, 1]
];
var NoncurrentVersionTransition$ = [3, n0, _NVTo,
    0,
    [_ND, _SC, _NNV],
    [1, 0, 1]
];
var NotificationConfiguration$ = [3, n0, _NC,
    0,
    [_TCo, _QCu, _LFCa, _EBC],
    [[() => TopicConfigurationList, { [_xF]: 1, [_xN]: _TCop }], [() => QueueConfigurationList, { [_xF]: 1, [_xN]: _QCue }], [() => LambdaFunctionConfigurationList, { [_xF]: 1, [_xN]: _CFC }], () => EventBridgeConfiguration$]
];
var NotificationConfigurationFilter$ = [3, n0, _NCF,
    0,
    [_K],
    [[() => S3KeyFilter$, { [_xN]: _SKe }]]
];
var _Object$ = [3, n0, _Obj,
    0,
    [_K, _LM, _ETa, _CA, _CT, _Si, _SC, _O, _RSe],
    [0, 4, 0, [64 | 0, { [_xF]: 1 }], 0, 1, 0, () => Owner$, () => RestoreStatus$]
];
var ObjectIdentifier$ = [3, n0, _OI,
    0,
    [_K, _VI, _ETa, _LMT, _Si],
    [0, 0, 0, 6, 1], 1
];
var ObjectLockConfiguration$ = [3, n0, _OLC,
    0,
    [_OLE, _Ru],
    [0, () => ObjectLockRule$]
];
var ObjectLockLegalHold$ = [3, n0, _OLLH,
    0,
    [_S],
    [0]
];
var ObjectLockRetention$ = [3, n0, _OLR,
    0,
    [_Mo, _RUD],
    [0, 5]
];
var ObjectLockRule$ = [3, n0, _OLRb,
    0,
    [_DRe],
    [() => DefaultRetention$]
];
var ObjectPart$ = [3, n0, _OPb,
    0,
    [_PN, _Si, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh],
    [1, 1, 0, 0, 0, 0, 0]
];
var ObjectVersion$ = [3, n0, _OV,
    0,
    [_ETa, _CA, _CT, _Si, _SC, _K, _VI, _IL, _LM, _O, _RSe],
    [0, [64 | 0, { [_xF]: 1 }], 0, 1, 0, 0, 0, 2, 4, () => Owner$, () => RestoreStatus$]
];
var OutputLocation$ = [3, n0, _OL,
    0,
    [_S_],
    [[() => S3Location$, 0]]
];
var OutputSerialization$ = [3, n0, _OSu,
    0,
    [_CSV, _JSON],
    [() => CSVOutput$, () => JSONOutput$]
];
var Owner$ = [3, n0, _O,
    0,
    [_DN, _ID],
    [0, 0]
];
var OwnershipControls$ = [3, n0, _OC,
    0,
    [_R],
    [[() => OwnershipControlsRules, { [_xF]: 1, [_xN]: _Ru }]], 1
];
var OwnershipControlsRule$ = [3, n0, _OCR,
    0,
    [_OO],
    [0], 1
];
var ParquetInput$ = [3, n0, _PI,
    0,
    [],
    []
];
var Part$ = [3, n0, _Par,
    0,
    [_PN, _LM, _ETa, _Si, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh],
    [1, 4, 0, 1, 0, 0, 0, 0, 0]
];
var PartitionedPrefix$ = [3, n0, _PP,
    { [_xN]: _PP },
    [_PDS],
    [0]
];
var PolicyStatus$ = [3, n0, _PS,
    0,
    [_IP],
    [[2, { [_xN]: _IP }]]
];
var Progress$ = [3, n0, _Pr,
    0,
    [_BS, _BP, _BRy],
    [1, 1, 1]
];
var ProgressEvent$ = [3, n0, _PE,
    0,
    [_Det],
    [[() => Progress$, { [_eP]: 1 }]]
];
var PublicAccessBlockConfiguration$ = [3, n0, _PABC,
    0,
    [_BPA, _IPA, _BPP, _RPB],
    [[2, { [_xN]: _BPA }], [2, { [_xN]: _IPA }], [2, { [_xN]: _BPP }], [2, { [_xN]: _RPB }]]
];
var PutBucketAbacRequest$ = [3, n0, _PBAR,
    0,
    [_B, _AS, _CMD, _CA, _EBO],
    [[0, 1], [() => AbacStatus$, { [_hP]: 1, [_xN]: _AS }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketAccelerateConfigurationRequest$ = [3, n0, _PBACR,
    0,
    [_B, _AC, _EBO, _CA],
    [[0, 1], [() => AccelerateConfiguration$, { [_hP]: 1, [_xN]: _AC }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasca }]], 2
];
var PutBucketAclRequest$ = [3, n0, _PBARu,
    0,
    [_B, _ACL_, _ACP, _CMD, _CA, _GFC, _GR, _GRACP, _GW, _GWACP, _EBO],
    [[0, 1], [0, { [_hH]: _xaa }], [() => AccessControlPolicy$, { [_hP]: 1, [_xN]: _ACP }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagw }], [0, { [_hH]: _xagwa }], [0, { [_hH]: _xaebo }]], 1
];
var PutBucketAnalyticsConfigurationRequest$ = [3, n0, _PBACRu,
    0,
    [_B, _I, _ACn, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [() => AnalyticsConfiguration$, { [_hP]: 1, [_xN]: _ACn }], [0, { [_hH]: _xaebo }]], 3
];
var PutBucketCorsRequest$ = [3, n0, _PBCR,
    0,
    [_B, _CORSC, _CMD, _CA, _EBO],
    [[0, 1], [() => CORSConfiguration$, { [_hP]: 1, [_xN]: _CORSC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketEncryptionRequest$ = [3, n0, _PBER,
    0,
    [_B, _SSEC, _CMD, _CA, _EBO],
    [[0, 1], [() => ServerSideEncryptionConfiguration$, { [_hP]: 1, [_xN]: _SSEC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketIntelligentTieringConfigurationRequest$ = [3, n0, _PBITCR,
    0,
    [_B, _I, _ITC, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [() => IntelligentTieringConfiguration$, { [_hP]: 1, [_xN]: _ITC }], [0, { [_hH]: _xaebo }]], 3
];
var PutBucketInventoryConfigurationRequest$ = [3, n0, _PBICR,
    0,
    [_B, _I, _IC, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [() => InventoryConfiguration$, { [_hP]: 1, [_xN]: _IC }], [0, { [_hH]: _xaebo }]], 3
];
var PutBucketLifecycleConfigurationOutput$ = [3, n0, _PBLCO,
    0,
    [_TDMOS],
    [[0, { [_hH]: _xatdmos }]]
];
var PutBucketLifecycleConfigurationRequest$ = [3, n0, _PBLCR,
    0,
    [_B, _CA, _LCi, _EBO, _TDMOS],
    [[0, 1], [0, { [_hH]: _xasca }], [() => BucketLifecycleConfiguration$, { [_hP]: 1, [_xN]: _LCi }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xatdmos }]], 1
];
var PutBucketLoggingRequest$ = [3, n0, _PBLR,
    0,
    [_B, _BLS, _CMD, _CA, _EBO],
    [[0, 1], [() => BucketLoggingStatus$, { [_hP]: 1, [_xN]: _BLS }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketMetricsConfigurationRequest$ = [3, n0, _PBMCR,
    0,
    [_B, _I, _MCe, _EBO],
    [[0, 1], [0, { [_hQ]: _i }], [() => MetricsConfiguration$, { [_hP]: 1, [_xN]: _MCe }], [0, { [_hH]: _xaebo }]], 3
];
var PutBucketNotificationConfigurationRequest$ = [3, n0, _PBNCR,
    0,
    [_B, _NC, _EBO, _SDV],
    [[0, 1], [() => NotificationConfiguration$, { [_hP]: 1, [_xN]: _NC }], [0, { [_hH]: _xaebo }], [2, { [_hH]: _xasdv }]], 2
];
var PutBucketOwnershipControlsRequest$ = [3, n0, _PBOCR,
    0,
    [_B, _OC, _CMD, _EBO, _CA],
    [[0, 1], [() => OwnershipControls$, { [_hP]: 1, [_xN]: _OC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasca }]], 2
];
var PutBucketPolicyRequest$ = [3, n0, _PBPR,
    0,
    [_B, _Po, _CMD, _CA, _CRSBA, _EBO],
    [[0, 1], [0, 16], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [2, { [_hH]: _xacrsba }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketReplicationRequest$ = [3, n0, _PBRR,
    0,
    [_B, _RCe, _CMD, _CA, _To, _EBO],
    [[0, 1], [() => ReplicationConfiguration$, { [_hP]: 1, [_xN]: _RCe }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xabolt }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketRequestPaymentRequest$ = [3, n0, _PBRPR,
    0,
    [_B, _RPC, _CMD, _CA, _EBO],
    [[0, 1], [() => RequestPaymentConfiguration$, { [_hP]: 1, [_xN]: _RPC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketTaggingRequest$ = [3, n0, _PBTR,
    0,
    [_B, _Tag, _CMD, _CA, _EBO],
    [[0, 1], [() => Tagging$, { [_hP]: 1, [_xN]: _Tag }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketVersioningRequest$ = [3, n0, _PBVR,
    0,
    [_B, _VC, _CMD, _CA, _MFA, _EBO],
    [[0, 1], [() => VersioningConfiguration$, { [_hP]: 1, [_xN]: _VC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xam_ }], [0, { [_hH]: _xaebo }]], 2
];
var PutBucketWebsiteRequest$ = [3, n0, _PBWR,
    0,
    [_B, _WC, _CMD, _CA, _EBO],
    [[0, 1], [() => WebsiteConfiguration$, { [_hP]: 1, [_xN]: _WC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutObjectAclOutput$ = [3, n0, _POAO,
    0,
    [_RC],
    [[0, { [_hH]: _xarc }]]
];
var PutObjectAclRequest$ = [3, n0, _POAR,
    0,
    [_B, _K, _ACL_, _ACP, _CMD, _CA, _GFC, _GR, _GRACP, _GW, _GWACP, _RP, _VI, _EBO],
    [[0, 1], [0, 1], [0, { [_hH]: _xaa }], [() => AccessControlPolicy$, { [_hP]: 1, [_xN]: _ACP }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagw }], [0, { [_hH]: _xagwa }], [0, { [_hH]: _xarp }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xaebo }]], 2
];
var PutObjectLegalHoldOutput$ = [3, n0, _POLHO,
    0,
    [_RC],
    [[0, { [_hH]: _xarc }]]
];
var PutObjectLegalHoldRequest$ = [3, n0, _POLHR,
    0,
    [_B, _K, _LH, _RP, _VI, _CMD, _CA, _EBO],
    [[0, 1], [0, 1], [() => ObjectLockLegalHold$, { [_hP]: 1, [_xN]: _LH }], [0, { [_hH]: _xarp }], [0, { [_hQ]: _vI }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutObjectLockConfigurationOutput$ = [3, n0, _POLCO,
    0,
    [_RC],
    [[0, { [_hH]: _xarc }]]
];
var PutObjectLockConfigurationRequest$ = [3, n0, _POLCR,
    0,
    [_B, _OLC, _RP, _To, _CMD, _CA, _EBO],
    [[0, 1], [() => ObjectLockConfiguration$, { [_hP]: 1, [_xN]: _OLC }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xabolt }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 1
];
var PutObjectOutput$ = [3, n0, _POO,
    0,
    [_E, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CT, _SSE, _VI, _SSECA, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _Si, _RC],
    [[0, { [_hH]: _xae }], [0, { [_hH]: _ETa }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xact }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [1, { [_hH]: _xaos }], [0, { [_hH]: _xarc }]]
];
var PutObjectRequest$ = [3, n0, _POR,
    0,
    [_B, _K, _ACL_, _Bo, _CC, _CDo, _CEo, _CL, _CLo, _CMD, _CTo, _CA, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _Ex, _IM, _INM, _GFC, _GR, _GRACP, _GWACP, _WOB, _M, _SSE, _SC, _WRL, _SSECA, _SSECK, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RP, _Tag, _OLM, _OLRUD, _OLLHS, _EBO],
    [[0, 1], [0, 1], [0, { [_hH]: _xaa }], [() => StreamingBlob, 16], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _CM }], [0, { [_hH]: _CT_ }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagwa }], [1, { [_hH]: _xawob }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xat }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }], [0, { [_hH]: _xaebo }]], 2
];
var PutObjectRetentionOutput$ = [3, n0, _PORO,
    0,
    [_RC],
    [[0, { [_hH]: _xarc }]]
];
var PutObjectRetentionRequest$ = [3, n0, _PORR,
    0,
    [_B, _K, _Ret, _RP, _VI, _BGR, _CMD, _CA, _EBO],
    [[0, 1], [0, 1], [() => ObjectLockRetention$, { [_hP]: 1, [_xN]: _Ret }], [0, { [_hH]: _xarp }], [0, { [_hQ]: _vI }], [2, { [_hH]: _xabgr }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var PutObjectTaggingOutput$ = [3, n0, _POTO,
    0,
    [_VI],
    [[0, { [_hH]: _xavi }]]
];
var PutObjectTaggingRequest$ = [3, n0, _POTR,
    0,
    [_B, _K, _Tag, _VI, _CMD, _CA, _EBO, _RP],
    [[0, 1], [0, 1], [() => Tagging$, { [_hP]: 1, [_xN]: _Tag }], [0, { [_hQ]: _vI }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]], 3
];
var PutPublicAccessBlockRequest$ = [3, n0, _PPABR,
    0,
    [_B, _PABC, _CMD, _CA, _EBO],
    [[0, 1], [() => PublicAccessBlockConfiguration$, { [_hP]: 1, [_xN]: _PABC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var QueueConfiguration$ = [3, n0, _QCue,
    0,
    [_QA, _Ev, _I, _F],
    [[0, { [_xN]: _Qu }], [64 | 0, { [_xF]: 1, [_xN]: _Eve }], 0, [() => NotificationConfigurationFilter$, 0]], 2
];
var RecordExpiration$ = [3, n0, _REe,
    0,
    [_E, _D],
    [0, 1], 1
];
var RecordsEvent$ = [3, n0, _REec,
    0,
    [_Payl],
    [[21, { [_eP]: 1 }]]
];
var Redirect$ = [3, n0, _Red,
    0,
    [_HN, _HRC, _Pro, _RKPW, _RKW],
    [0, 0, 0, 0, 0]
];
var RedirectAllRequestsTo$ = [3, n0, _RART,
    0,
    [_HN, _Pro],
    [0, 0], 1
];
var RenameObjectOutput$ = [3, n0, _ROO,
    0,
    [],
    []
];
var RenameObjectRequest$ = [3, n0, _ROR,
    0,
    [_B, _K, _RSen, _DIM, _DINM, _DIMS, _DIUS, _SIM, _SINM, _SIMS, _SIUS, _CTl],
    [[0, 1], [0, 1], [0, { [_hH]: _xars_ }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [4, { [_hH]: _IMS_ }], [4, { [_hH]: _IUS_ }], [0, { [_hH]: _xarsim }], [0, { [_hH]: _xarsinm }], [6, { [_hH]: _xarsims }], [6, { [_hH]: _xarsius }], [0, { [_hH]: _xact_, [_iT]: 1 }]], 3
];
var ReplicaModifications$ = [3, n0, _RM,
    0,
    [_S],
    [0], 1
];
var ReplicationConfiguration$ = [3, n0, _RCe,
    0,
    [_Ro, _R],
    [0, [() => ReplicationRules, { [_xF]: 1, [_xN]: _Ru }]], 2
];
var ReplicationRule$ = [3, n0, _RRe,
    0,
    [_S, _Des, _ID, _Pri, _P, _F, _SSC, _EOR, _DMR],
    [0, () => Destination$, 0, 1, 0, [() => ReplicationRuleFilter$, 0], () => SourceSelectionCriteria$, () => ExistingObjectReplication$, () => DeleteMarkerReplication$], 2
];
var ReplicationRuleAndOperator$ = [3, n0, _RRAO,
    0,
    [_P, _T],
    [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }]]
];
var ReplicationRuleFilter$ = [3, n0, _RRF,
    0,
    [_P, _Ta, _An],
    [0, () => Tag$, [() => ReplicationRuleAndOperator$, 0]]
];
var ReplicationTime$ = [3, n0, _RT,
    0,
    [_S, _Tim],
    [0, () => ReplicationTimeValue$], 2
];
var ReplicationTimeValue$ = [3, n0, _RTV,
    0,
    [_Mi],
    [1]
];
var RequestPaymentConfiguration$ = [3, n0, _RPC,
    0,
    [_Pay],
    [0], 1
];
var RequestProgress$ = [3, n0, _RPe,
    0,
    [_Ena],
    [2]
];
var RestoreObjectOutput$ = [3, n0, _ROOe,
    0,
    [_RC, _ROP],
    [[0, { [_hH]: _xarc }], [0, { [_hH]: _xarop }]]
];
var RestoreObjectRequest$ = [3, n0, _RORe,
    0,
    [_B, _K, _VI, _RRes, _RP, _CA, _EBO],
    [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [() => RestoreRequest$, { [_hP]: 1, [_xN]: _RRes }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var RestoreRequest$ = [3, n0, _RRes,
    0,
    [_D, _GJP, _Ty, _Ti, _Desc, _SP, _OL],
    [1, () => GlacierJobParameters$, 0, 0, 0, () => SelectParameters$, [() => OutputLocation$, 0]]
];
var RestoreStatus$ = [3, n0, _RSe,
    0,
    [_IRIP, _RED],
    [2, 4]
];
var RoutingRule$ = [3, n0, _RRo,
    0,
    [_Red, _Co],
    [() => Redirect$, () => Condition$], 1
];
var S3KeyFilter$ = [3, n0, _SKF,
    0,
    [_FRi],
    [[() => FilterRuleList, { [_xF]: 1, [_xN]: _FR }]]
];
var S3Location$ = [3, n0, _SL,
    0,
    [_BNu, _P, _En, _CACL, _ACL, _Tag, _UM, _SC],
    [0, 0, [() => Encryption$, 0], 0, [() => Grants, 0], [() => Tagging$, 0], [() => UserMetadata, 0], 0], 2
];
var S3TablesDestination$ = [3, n0, _STD,
    0,
    [_TBA, _TNa],
    [0, 0], 2
];
var S3TablesDestinationResult$ = [3, n0, _STDR,
    0,
    [_TBA, _TNa, _TA, _TN],
    [0, 0, 0, 0], 4
];
var ScanRange$ = [3, n0, _SR,
    0,
    [_St, _End],
    [1, 1]
];
var SelectObjectContentOutput$ = [3, n0, _SOCO,
    0,
    [_Payl],
    [[() => SelectObjectContentEventStream$, 16]]
];
var SelectObjectContentRequest$ = [3, n0, _SOCR,
    0,
    [_B, _K, _Exp, _ETx, _IS, _OSu, _SSECA, _SSECK, _SSECKMD, _RPe, _SR, _EBO],
    [[0, 1], [0, 1], 0, 0, () => InputSerialization$, () => OutputSerialization$, [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], () => RequestProgress$, () => ScanRange$, [0, { [_hH]: _xaebo }]], 6
];
var SelectParameters$ = [3, n0, _SP,
    0,
    [_IS, _ETx, _Exp, _OSu],
    [() => InputSerialization$, 0, 0, () => OutputSerialization$], 4
];
var ServerSideEncryptionByDefault$ = [3, n0, _SSEBD,
    0,
    [_SSEA, _KMSMKID],
    [0, [() => SSEKMSKeyId, 0]], 1
];
var ServerSideEncryptionConfiguration$ = [3, n0, _SSEC,
    0,
    [_R],
    [[() => ServerSideEncryptionRules, { [_xF]: 1, [_xN]: _Ru }]], 1
];
var ServerSideEncryptionRule$ = [3, n0, _SSER,
    0,
    [_ASSEBD, _BKE, _BET],
    [[() => ServerSideEncryptionByDefault$, 0], 2, [() => BlockedEncryptionTypes$, 0]]
];
var SessionCredentials$ = [3, n0, _SCe,
    0,
    [_AKI, _SAK, _ST, _E],
    [[0, { [_xN]: _AKI }], [() => SessionCredentialValue, { [_xN]: _SAK }], [() => SessionCredentialValue, { [_xN]: _ST }], [4, { [_xN]: _E }]], 4
];
var SimplePrefix$ = [3, n0, _SPi,
    { [_xN]: _SPi },
    [],
    []
];
var SourceSelectionCriteria$ = [3, n0, _SSC,
    0,
    [_SKEO, _RM],
    [() => SseKmsEncryptedObjects$, () => ReplicaModifications$]
];
var SSEKMS$ = [3, n0, _SSEKMS,
    { [_xN]: _SK },
    [_KI],
    [[() => SSEKMSKeyId, 0]], 1
];
var SseKmsEncryptedObjects$ = [3, n0, _SKEO,
    0,
    [_S],
    [0], 1
];
var SSEKMSEncryption$ = [3, n0, _SSEKMSE,
    { [_xN]: _SK },
    [_KMSKA, _BKE],
    [[() => NonEmptyKmsKeyArnString, 0], 2], 1
];
var SSES3$ = [3, n0, _SSES,
    { [_xN]: _SS },
    [],
    []
];
var Stats$ = [3, n0, _Sta,
    0,
    [_BS, _BP, _BRy],
    [1, 1, 1]
];
var StatsEvent$ = [3, n0, _SE,
    0,
    [_Det],
    [[() => Stats$, { [_eP]: 1 }]]
];
var StorageClassAnalysis$ = [3, n0, _SCA,
    0,
    [_DE],
    [() => StorageClassAnalysisDataExport$]
];
var StorageClassAnalysisDataExport$ = [3, n0, _SCADE,
    0,
    [_OSV, _Des],
    [0, () => AnalyticsExportDestination$], 2
];
var Tag$ = [3, n0, _Ta,
    0,
    [_K, _V],
    [0, 0], 2
];
var Tagging$ = [3, n0, _Tag,
    0,
    [_TS],
    [[() => TagSet, 0]], 1
];
var TargetGrant$ = [3, n0, _TGa,
    0,
    [_Gra, _Pe],
    [[() => Grantee$, { [_xNm]: [_x, _hi] }], 0]
];
var TargetObjectKeyFormat$ = [3, n0, _TOKF,
    0,
    [_SPi, _PP],
    [[() => SimplePrefix$, { [_xN]: _SPi }], [() => PartitionedPrefix$, { [_xN]: _PP }]]
];
var Tiering$ = [3, n0, _Tier,
    0,
    [_D, _AT],
    [1, 0], 2
];
var TopicConfiguration$ = [3, n0, _TCop,
    0,
    [_TAo, _Ev, _I, _F],
    [[0, { [_xN]: _Top }], [64 | 0, { [_xF]: 1, [_xN]: _Eve }], 0, [() => NotificationConfigurationFilter$, 0]], 2
];
var Transition$ = [3, n0, _Tra,
    0,
    [_Da, _D, _SC],
    [5, 1, 0]
];
var UpdateBucketMetadataInventoryTableConfigurationRequest$ = [3, n0, _UBMITCR,
    0,
    [_B, _ITCn, _CMD, _CA, _EBO],
    [[0, 1], [() => InventoryTableConfigurationUpdates$, { [_hP]: 1, [_xN]: _ITCn }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var UpdateBucketMetadataJournalTableConfigurationRequest$ = [3, n0, _UBMJTCR,
    0,
    [_B, _JTC, _CMD, _CA, _EBO],
    [[0, 1], [() => JournalTableConfigurationUpdates$, { [_hP]: 1, [_xN]: _JTC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]], 2
];
var UpdateObjectEncryptionRequest$ = [3, n0, _UOER,
    0,
    [_B, _K, _OE, _VI, _RP, _EBO, _CMD, _CA],
    [[0, 1], [0, 1], [() => ObjectEncryption$, 16], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }]], 3
];
var UpdateObjectEncryptionResponse$ = [3, n0, _UOERp,
    0,
    [_RC],
    [[0, { [_hH]: _xarc }]]
];
var UploadPartCopyOutput$ = [3, n0, _UPCO,
    0,
    [_CSVI, _CPR, _SSE, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _RC],
    [[0, { [_hH]: _xacsvi }], [() => CopyPartResult$, 16], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var UploadPartCopyRequest$ = [3, n0, _UPCR,
    0,
    [_B, _CS, _K, _PN, _UI, _CSIM, _CSIMS, _CSINM, _CSIUS, _CSRo, _SSECA, _SSECK, _SSECKMD, _CSSSECA, _CSSSECK, _CSSSECKMD, _RP, _EBO, _ESBO],
    [[0, 1], [0, { [_hH]: _xacs__ }], [0, 1], [1, { [_hQ]: _pN }], [0, { [_hQ]: _uI }], [0, { [_hH]: _xacsim }], [4, { [_hH]: _xacsims }], [0, { [_hH]: _xacsinm }], [4, { [_hH]: _xacsius }], [0, { [_hH]: _xacsr }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xacssseca }], [() => CopySourceSSECustomerKey, { [_hH]: _xacssseck }], [0, { [_hH]: _xacssseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasebo }]], 5
];
var UploadPartOutput$ = [3, n0, _UPO,
    0,
    [_SSE, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _RC],
    [[0, { [_hH]: _xasse }], [0, { [_hH]: _ETa }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var UploadPartRequest$ = [3, n0, _UPR,
    0,
    [_B, _K, _PN, _UI, _Bo, _CLo, _CMD, _CA, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _SSECA, _SSECK, _SSECKMD, _RP, _EBO],
    [[0, 1], [0, 1], [1, { [_hQ]: _pN }], [0, { [_hQ]: _uI }], [() => StreamingBlob, 16], [1, { [_hH]: _CL__ }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]], 4
];
var VersioningConfiguration$ = [3, n0, _VC,
    0,
    [_MFAD, _S],
    [[0, { [_xN]: _MDf }], 0]
];
var WebsiteConfiguration$ = [3, n0, _WC,
    0,
    [_EDr, _IDn, _RART, _RR],
    [() => ErrorDocument$, () => IndexDocument$, () => RedirectAllRequestsTo$, [() => RoutingRules, 0]]
];
var WriteGetObjectResponseRequest$ = [3, n0, _WGORR,
    0,
    [_RReq, _RTe, _Bo, _SCt, _ECr, _EM, _AR, _CC, _CDo, _CEo, _CL, _CLo, _CR, _CTo, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _DM, _ETa, _Ex, _E, _LM, _MM, _M, _OLM, _OLLHS, _OLRUD, _PC, _RS, _RC, _Re, _SSE, _SSECA, _SSEKMSKI, _SSECKMD, _SC, _TC, _VI, _BKE],
    [[0, { [_hL]: 1, [_hH]: _xarr }], [0, { [_hH]: _xart }], [() => StreamingBlob, 16], [1, { [_hH]: _xafs }], [0, { [_hH]: _xafec }], [0, { [_hH]: _xafem }], [0, { [_hH]: _xafhar }], [0, { [_hH]: _xafhCC }], [0, { [_hH]: _xafhCD }], [0, { [_hH]: _xafhCE }], [0, { [_hH]: _xafhCL }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _xafhCR }], [0, { [_hH]: _xafhCT }], [0, { [_hH]: _xafhxacc }], [0, { [_hH]: _xafhxacc_ }], [0, { [_hH]: _xafhxacc__ }], [0, { [_hH]: _xafhxacs }], [0, { [_hH]: _xafhxacs_ }], [2, { [_hH]: _xafhxadm }], [0, { [_hH]: _xafhE }], [4, { [_hH]: _xafhE_ }], [0, { [_hH]: _xafhxae }], [4, { [_hH]: _xafhLM }], [1, { [_hH]: _xafhxamm }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xafhxaolm }], [0, { [_hH]: _xafhxaollh }], [5, { [_hH]: _xafhxaolrud }], [1, { [_hH]: _xafhxampc }], [0, { [_hH]: _xafhxars }], [0, { [_hH]: _xafhxarc }], [0, { [_hH]: _xafhxar }], [0, { [_hH]: _xafhxasse }], [0, { [_hH]: _xafhxasseca }], [() => SSEKMSKeyId, { [_hH]: _xafhxasseakki }], [0, { [_hH]: _xafhxasseckM }], [0, { [_hH]: _xafhxasc }], [1, { [_hH]: _xafhxatc }], [0, { [_hH]: _xafhxavi }], [2, { [_hH]: _xafhxassebke }]], 2
];
var __Unit = "unit";
var AnalyticsConfigurationList = [1, n0, _ACLn,
    0, [() => AnalyticsConfiguration$,
        0]
];
var Buckets = [1, n0, _Bu,
    0, [() => Bucket$,
        { [_xN]: _B }]
];
var CommonPrefixList = [1, n0, _CPL,
    0, () => CommonPrefix$
];
var CompletedPartList = [1, n0, _CPLo,
    0, () => CompletedPart$
];
var CORSRules = [1, n0, _CORSR,
    0, [() => CORSRule$,
        0]
];
var DeletedObjects = [1, n0, _DOe,
    0, () => DeletedObject$
];
var DeleteMarkers = [1, n0, _DMe,
    0, () => DeleteMarkerEntry$
];
var EncryptionTypeList = [1, n0, _ETL,
    0, [0,
        { [_xN]: _ET }]
];
var Errors = [1, n0, _Er,
    0, () => _Error$
];
var FilterRuleList = [1, n0, _FRL,
    0, () => FilterRule$
];
var Grants = [1, n0, _G,
    0, [() => Grant$,
        { [_xN]: _Gr }]
];
var IntelligentTieringConfigurationList = [1, n0, _ITCL,
    0, [() => IntelligentTieringConfiguration$,
        0]
];
var InventoryConfigurationList = [1, n0, _ICL,
    0, [() => InventoryConfiguration$,
        0]
];
var InventoryOptionalFields = [1, n0, _IOF,
    0, [0,
        { [_xN]: _Fi }]
];
var LambdaFunctionConfigurationList = [1, n0, _LFCL,
    0, [() => LambdaFunctionConfiguration$,
        0]
];
var LifecycleRules = [1, n0, _LRi,
    0, [() => LifecycleRule$,
        0]
];
var MetricsConfigurationList = [1, n0, _MCL,
    0, [() => MetricsConfiguration$,
        0]
];
var MultipartUploadList = [1, n0, _MUL,
    0, () => MultipartUpload$
];
var NoncurrentVersionTransitionList = [1, n0, _NVTL,
    0, () => NoncurrentVersionTransition$
];
var ObjectIdentifierList = [1, n0, _OIL,
    0, () => ObjectIdentifier$
];
var ObjectList = [1, n0, _OLb,
    0, [() => _Object$,
        0]
];
var ObjectVersionList = [1, n0, _OVL,
    0, [() => ObjectVersion$,
        0]
];
var OwnershipControlsRules = [1, n0, _OCRw,
    0, () => OwnershipControlsRule$
];
var Parts = [1, n0, _Pa,
    0, () => Part$
];
var PartsList = [1, n0, _PL,
    0, () => ObjectPart$
];
var QueueConfigurationList = [1, n0, _QCL,
    0, [() => QueueConfiguration$,
        0]
];
var ReplicationRules = [1, n0, _RRep,
    0, [() => ReplicationRule$,
        0]
];
var RoutingRules = [1, n0, _RR,
    0, [() => RoutingRule$,
        { [_xN]: _RRo }]
];
var ServerSideEncryptionRules = [1, n0, _SSERe,
    0, [() => ServerSideEncryptionRule$,
        0]
];
var TagSet = [1, n0, _TS,
    0, [() => Tag$,
        { [_xN]: _Ta }]
];
var TargetGrants = [1, n0, _TG,
    0, [() => TargetGrant$,
        { [_xN]: _Gr }]
];
var TieringList = [1, n0, _TL,
    0, () => Tiering$
];
var TopicConfigurationList = [1, n0, _TCL,
    0, [() => TopicConfiguration$,
        0]
];
var TransitionList = [1, n0, _TLr,
    0, () => Transition$
];
var UserMetadata = [1, n0, _UM,
    0, [() => MetadataEntry$,
        { [_xN]: _ME }]
];
var AnalyticsFilter$ = [4, n0, _AF,
    0,
    [_P, _Ta, _An],
    [0, () => Tag$, [() => AnalyticsAndOperator$, 0]]
];
var MetricsFilter$ = [4, n0, _MF,
    0,
    [_P, _Ta, _APAc, _An],
    [0, () => Tag$, 0, [() => MetricsAndOperator$, 0]]
];
var ObjectEncryption$ = [4, n0, _OE,
    0,
    [_SSEKMS],
    [[() => SSEKMSEncryption$, { [_xN]: _SK }]]
];
var SelectObjectContentEventStream$ = [4, n0, _SOCES,
    { [_st]: 1 },
    [_Rec, _Sta, _Pr, _Cont, _End],
    [[() => RecordsEvent$, 0], [() => StatsEvent$, 0], [() => ProgressEvent$, 0], () => ContinuationEvent$, () => EndEvent$]
];
var AbortMultipartUpload$ = [9, n0, _AMU,
    { [_h]: ["DELETE", "/{Key+}?x-id=AbortMultipartUpload", 204] }, () => AbortMultipartUploadRequest$, () => AbortMultipartUploadOutput$
];
var CompleteMultipartUpload$ = [9, n0, _CMUo,
    { [_h]: ["POST", "/{Key+}", 200] }, () => CompleteMultipartUploadRequest$, () => CompleteMultipartUploadOutput$
];
var CopyObject$ = [9, n0, _CO,
    { [_h]: ["PUT", "/{Key+}?x-id=CopyObject", 200] }, () => CopyObjectRequest$, () => CopyObjectOutput$
];
var CreateBucket$ = [9, n0, _CB,
    { [_h]: ["PUT", "/", 200] }, () => CreateBucketRequest$, () => CreateBucketOutput$
];
var CreateBucketMetadataConfiguration$ = [9, n0, _CBMC,
    { [_hC]: "-", [_h]: ["POST", "/?metadataConfiguration", 200] }, () => CreateBucketMetadataConfigurationRequest$, () => __Unit
];
var CreateBucketMetadataTableConfiguration$ = [9, n0, _CBMTC,
    { [_hC]: "-", [_h]: ["POST", "/?metadataTable", 200] }, () => CreateBucketMetadataTableConfigurationRequest$, () => __Unit
];
var CreateMultipartUpload$ = [9, n0, _CMUr,
    { [_h]: ["POST", "/{Key+}?uploads", 200] }, () => CreateMultipartUploadRequest$, () => CreateMultipartUploadOutput$
];
var CreateSession$ = [9, n0, _CSr,
    { [_h]: ["GET", "/?session", 200] }, () => CreateSessionRequest$, () => CreateSessionOutput$
];
var DeleteBucket$ = [9, n0, _DB,
    { [_h]: ["DELETE", "/", 204] }, () => DeleteBucketRequest$, () => __Unit
];
var DeleteBucketAnalyticsConfiguration$ = [9, n0, _DBAC,
    { [_h]: ["DELETE", "/?analytics", 204] }, () => DeleteBucketAnalyticsConfigurationRequest$, () => __Unit
];
var DeleteBucketCors$ = [9, n0, _DBC,
    { [_h]: ["DELETE", "/?cors", 204] }, () => DeleteBucketCorsRequest$, () => __Unit
];
var DeleteBucketEncryption$ = [9, n0, _DBE,
    { [_h]: ["DELETE", "/?encryption", 204] }, () => DeleteBucketEncryptionRequest$, () => __Unit
];
var DeleteBucketIntelligentTieringConfiguration$ = [9, n0, _DBITC,
    { [_h]: ["DELETE", "/?intelligent-tiering", 204] }, () => DeleteBucketIntelligentTieringConfigurationRequest$, () => __Unit
];
var DeleteBucketInventoryConfiguration$ = [9, n0, _DBIC,
    { [_h]: ["DELETE", "/?inventory", 204] }, () => DeleteBucketInventoryConfigurationRequest$, () => __Unit
];
var DeleteBucketLifecycle$ = [9, n0, _DBL,
    { [_h]: ["DELETE", "/?lifecycle", 204] }, () => DeleteBucketLifecycleRequest$, () => __Unit
];
var DeleteBucketMetadataConfiguration$ = [9, n0, _DBMC,
    { [_h]: ["DELETE", "/?metadataConfiguration", 204] }, () => DeleteBucketMetadataConfigurationRequest$, () => __Unit
];
var DeleteBucketMetadataTableConfiguration$ = [9, n0, _DBMTC,
    { [_h]: ["DELETE", "/?metadataTable", 204] }, () => DeleteBucketMetadataTableConfigurationRequest$, () => __Unit
];
var DeleteBucketMetricsConfiguration$ = [9, n0, _DBMCe,
    { [_h]: ["DELETE", "/?metrics", 204] }, () => DeleteBucketMetricsConfigurationRequest$, () => __Unit
];
var DeleteBucketOwnershipControls$ = [9, n0, _DBOC,
    { [_h]: ["DELETE", "/?ownershipControls", 204] }, () => DeleteBucketOwnershipControlsRequest$, () => __Unit
];
var DeleteBucketPolicy$ = [9, n0, _DBP,
    { [_h]: ["DELETE", "/?policy", 204] }, () => DeleteBucketPolicyRequest$, () => __Unit
];
var DeleteBucketReplication$ = [9, n0, _DBRe,
    { [_h]: ["DELETE", "/?replication", 204] }, () => DeleteBucketReplicationRequest$, () => __Unit
];
var DeleteBucketTagging$ = [9, n0, _DBT,
    { [_h]: ["DELETE", "/?tagging", 204] }, () => DeleteBucketTaggingRequest$, () => __Unit
];
var DeleteBucketWebsite$ = [9, n0, _DBW,
    { [_h]: ["DELETE", "/?website", 204] }, () => DeleteBucketWebsiteRequest$, () => __Unit
];
var DeleteObject$ = [9, n0, _DOel,
    { [_h]: ["DELETE", "/{Key+}?x-id=DeleteObject", 204] }, () => DeleteObjectRequest$, () => DeleteObjectOutput$
];
var DeleteObjects$ = [9, n0, _DOele,
    { [_hC]: "-", [_h]: ["POST", "/?delete", 200] }, () => DeleteObjectsRequest$, () => DeleteObjectsOutput$
];
var DeleteObjectTagging$ = [9, n0, _DOT,
    { [_h]: ["DELETE", "/{Key+}?tagging", 204] }, () => DeleteObjectTaggingRequest$, () => DeleteObjectTaggingOutput$
];
var DeletePublicAccessBlock$ = [9, n0, _DPAB,
    { [_h]: ["DELETE", "/?publicAccessBlock", 204] }, () => DeletePublicAccessBlockRequest$, () => __Unit
];
var GetBucketAbac$ = [9, n0, _GBA,
    { [_h]: ["GET", "/?abac", 200] }, () => GetBucketAbacRequest$, () => GetBucketAbacOutput$
];
var GetBucketAccelerateConfiguration$ = [9, n0, _GBAC,
    { [_h]: ["GET", "/?accelerate", 200] }, () => GetBucketAccelerateConfigurationRequest$, () => GetBucketAccelerateConfigurationOutput$
];
var GetBucketAcl$ = [9, n0, _GBAe,
    { [_h]: ["GET", "/?acl", 200] }, () => GetBucketAclRequest$, () => GetBucketAclOutput$
];
var GetBucketAnalyticsConfiguration$ = [9, n0, _GBACe,
    { [_h]: ["GET", "/?analytics&x-id=GetBucketAnalyticsConfiguration", 200] }, () => GetBucketAnalyticsConfigurationRequest$, () => GetBucketAnalyticsConfigurationOutput$
];
var GetBucketCors$ = [9, n0, _GBC,
    { [_h]: ["GET", "/?cors", 200] }, () => GetBucketCorsRequest$, () => GetBucketCorsOutput$
];
var GetBucketEncryption$ = [9, n0, _GBE,
    { [_h]: ["GET", "/?encryption", 200] }, () => GetBucketEncryptionRequest$, () => GetBucketEncryptionOutput$
];
var GetBucketIntelligentTieringConfiguration$ = [9, n0, _GBITC,
    { [_h]: ["GET", "/?intelligent-tiering&x-id=GetBucketIntelligentTieringConfiguration", 200] }, () => GetBucketIntelligentTieringConfigurationRequest$, () => GetBucketIntelligentTieringConfigurationOutput$
];
var GetBucketInventoryConfiguration$ = [9, n0, _GBIC,
    { [_h]: ["GET", "/?inventory&x-id=GetBucketInventoryConfiguration", 200] }, () => GetBucketInventoryConfigurationRequest$, () => GetBucketInventoryConfigurationOutput$
];
var GetBucketLifecycleConfiguration$ = [9, n0, _GBLC,
    { [_h]: ["GET", "/?lifecycle", 200] }, () => GetBucketLifecycleConfigurationRequest$, () => GetBucketLifecycleConfigurationOutput$
];
var GetBucketLocation$ = [9, n0, _GBL,
    { [_h]: ["GET", "/?location", 200] }, () => GetBucketLocationRequest$, () => GetBucketLocationOutput$
];
var GetBucketLogging$ = [9, n0, _GBLe,
    { [_h]: ["GET", "/?logging", 200] }, () => GetBucketLoggingRequest$, () => GetBucketLoggingOutput$
];
var GetBucketMetadataConfiguration$ = [9, n0, _GBMC,
    { [_h]: ["GET", "/?metadataConfiguration", 200] }, () => GetBucketMetadataConfigurationRequest$, () => GetBucketMetadataConfigurationOutput$
];
var GetBucketMetadataTableConfiguration$ = [9, n0, _GBMTC,
    { [_h]: ["GET", "/?metadataTable", 200] }, () => GetBucketMetadataTableConfigurationRequest$, () => GetBucketMetadataTableConfigurationOutput$
];
var GetBucketMetricsConfiguration$ = [9, n0, _GBMCe,
    { [_h]: ["GET", "/?metrics&x-id=GetBucketMetricsConfiguration", 200] }, () => GetBucketMetricsConfigurationRequest$, () => GetBucketMetricsConfigurationOutput$
];
var GetBucketNotificationConfiguration$ = [9, n0, _GBNC,
    { [_h]: ["GET", "/?notification", 200] }, () => GetBucketNotificationConfigurationRequest$, () => NotificationConfiguration$
];
var GetBucketOwnershipControls$ = [9, n0, _GBOC,
    { [_h]: ["GET", "/?ownershipControls", 200] }, () => GetBucketOwnershipControlsRequest$, () => GetBucketOwnershipControlsOutput$
];
var GetBucketPolicy$ = [9, n0, _GBP,
    { [_h]: ["GET", "/?policy", 200] }, () => GetBucketPolicyRequest$, () => GetBucketPolicyOutput$
];
var GetBucketPolicyStatus$ = [9, n0, _GBPS,
    { [_h]: ["GET", "/?policyStatus", 200] }, () => GetBucketPolicyStatusRequest$, () => GetBucketPolicyStatusOutput$
];
var GetBucketReplication$ = [9, n0, _GBR,
    { [_h]: ["GET", "/?replication", 200] }, () => GetBucketReplicationRequest$, () => GetBucketReplicationOutput$
];
var GetBucketRequestPayment$ = [9, n0, _GBRP,
    { [_h]: ["GET", "/?requestPayment", 200] }, () => GetBucketRequestPaymentRequest$, () => GetBucketRequestPaymentOutput$
];
var GetBucketTagging$ = [9, n0, _GBT,
    { [_h]: ["GET", "/?tagging", 200] }, () => GetBucketTaggingRequest$, () => GetBucketTaggingOutput$
];
var GetBucketVersioning$ = [9, n0, _GBV,
    { [_h]: ["GET", "/?versioning", 200] }, () => GetBucketVersioningRequest$, () => GetBucketVersioningOutput$
];
var GetBucketWebsite$ = [9, n0, _GBW,
    { [_h]: ["GET", "/?website", 200] }, () => GetBucketWebsiteRequest$, () => GetBucketWebsiteOutput$
];
var GetObject$ = [9, n0, _GO,
    { [_hC]: "-", [_h]: ["GET", "/{Key+}?x-id=GetObject", 200] }, () => GetObjectRequest$, () => GetObjectOutput$
];
var GetObjectAcl$ = [9, n0, _GOA,
    { [_h]: ["GET", "/{Key+}?acl", 200] }, () => GetObjectAclRequest$, () => GetObjectAclOutput$
];
var GetObjectAttributes$ = [9, n0, _GOAe,
    { [_h]: ["GET", "/{Key+}?attributes", 200] }, () => GetObjectAttributesRequest$, () => GetObjectAttributesOutput$
];
var GetObjectLegalHold$ = [9, n0, _GOLH,
    { [_h]: ["GET", "/{Key+}?legal-hold", 200] }, () => GetObjectLegalHoldRequest$, () => GetObjectLegalHoldOutput$
];
var GetObjectLockConfiguration$ = [9, n0, _GOLC,
    { [_h]: ["GET", "/?object-lock", 200] }, () => GetObjectLockConfigurationRequest$, () => GetObjectLockConfigurationOutput$
];
var GetObjectRetention$ = [9, n0, _GORe,
    { [_h]: ["GET", "/{Key+}?retention", 200] }, () => GetObjectRetentionRequest$, () => GetObjectRetentionOutput$
];
var GetObjectTagging$ = [9, n0, _GOT,
    { [_h]: ["GET", "/{Key+}?tagging", 200] }, () => GetObjectTaggingRequest$, () => GetObjectTaggingOutput$
];
var GetObjectTorrent$ = [9, n0, _GOTe,
    { [_h]: ["GET", "/{Key+}?torrent", 200] }, () => GetObjectTorrentRequest$, () => GetObjectTorrentOutput$
];
var GetPublicAccessBlock$ = [9, n0, _GPAB,
    { [_h]: ["GET", "/?publicAccessBlock", 200] }, () => GetPublicAccessBlockRequest$, () => GetPublicAccessBlockOutput$
];
var HeadBucket$ = [9, n0, _HB,
    { [_h]: ["HEAD", "/", 200] }, () => HeadBucketRequest$, () => HeadBucketOutput$
];
var HeadObject$ = [9, n0, _HO,
    { [_h]: ["HEAD", "/{Key+}", 200] }, () => HeadObjectRequest$, () => HeadObjectOutput$
];
var ListBucketAnalyticsConfigurations$ = [9, n0, _LBAC,
    { [_h]: ["GET", "/?analytics&x-id=ListBucketAnalyticsConfigurations", 200] }, () => ListBucketAnalyticsConfigurationsRequest$, () => ListBucketAnalyticsConfigurationsOutput$
];
var ListBucketIntelligentTieringConfigurations$ = [9, n0, _LBITC,
    { [_h]: ["GET", "/?intelligent-tiering&x-id=ListBucketIntelligentTieringConfigurations", 200] }, () => ListBucketIntelligentTieringConfigurationsRequest$, () => ListBucketIntelligentTieringConfigurationsOutput$
];
var ListBucketInventoryConfigurations$ = [9, n0, _LBIC,
    { [_h]: ["GET", "/?inventory&x-id=ListBucketInventoryConfigurations", 200] }, () => ListBucketInventoryConfigurationsRequest$, () => ListBucketInventoryConfigurationsOutput$
];
var ListBucketMetricsConfigurations$ = [9, n0, _LBMC,
    { [_h]: ["GET", "/?metrics&x-id=ListBucketMetricsConfigurations", 200] }, () => ListBucketMetricsConfigurationsRequest$, () => ListBucketMetricsConfigurationsOutput$
];
var ListBuckets$ = [9, n0, _LB,
    { [_h]: ["GET", "/?x-id=ListBuckets", 200] }, () => ListBucketsRequest$, () => ListBucketsOutput$
];
var ListDirectoryBuckets$ = [9, n0, _LDB,
    { [_h]: ["GET", "/?x-id=ListDirectoryBuckets", 200] }, () => ListDirectoryBucketsRequest$, () => ListDirectoryBucketsOutput$
];
var ListMultipartUploads$ = [9, n0, _LMU,
    { [_h]: ["GET", "/?uploads", 200] }, () => ListMultipartUploadsRequest$, () => ListMultipartUploadsOutput$
];
var ListObjects$ = [9, n0, _LO,
    { [_h]: ["GET", "/", 200] }, () => ListObjectsRequest$, () => ListObjectsOutput$
];
var ListObjectsV2$ = [9, n0, _LOV,
    { [_h]: ["GET", "/?list-type=2", 200] }, () => ListObjectsV2Request$, () => ListObjectsV2Output$
];
var ListObjectVersions$ = [9, n0, _LOVi,
    { [_h]: ["GET", "/?versions", 200] }, () => ListObjectVersionsRequest$, () => ListObjectVersionsOutput$
];
var ListParts$ = [9, n0, _LP,
    { [_h]: ["GET", "/{Key+}?x-id=ListParts", 200] }, () => ListPartsRequest$, () => ListPartsOutput$
];
var PutBucketAbac$ = [9, n0, _PBA,
    { [_hC]: "-", [_h]: ["PUT", "/?abac", 200] }, () => PutBucketAbacRequest$, () => __Unit
];
var PutBucketAccelerateConfiguration$ = [9, n0, _PBAC,
    { [_hC]: "-", [_h]: ["PUT", "/?accelerate", 200] }, () => PutBucketAccelerateConfigurationRequest$, () => __Unit
];
var PutBucketAcl$ = [9, n0, _PBAu,
    { [_hC]: "-", [_h]: ["PUT", "/?acl", 200] }, () => PutBucketAclRequest$, () => __Unit
];
var PutBucketAnalyticsConfiguration$ = [9, n0, _PBACu,
    { [_h]: ["PUT", "/?analytics", 200] }, () => PutBucketAnalyticsConfigurationRequest$, () => __Unit
];
var PutBucketCors$ = [9, n0, _PBC,
    { [_hC]: "-", [_h]: ["PUT", "/?cors", 200] }, () => PutBucketCorsRequest$, () => __Unit
];
var PutBucketEncryption$ = [9, n0, _PBE,
    { [_hC]: "-", [_h]: ["PUT", "/?encryption", 200] }, () => PutBucketEncryptionRequest$, () => __Unit
];
var PutBucketIntelligentTieringConfiguration$ = [9, n0, _PBITC,
    { [_h]: ["PUT", "/?intelligent-tiering", 200] }, () => PutBucketIntelligentTieringConfigurationRequest$, () => __Unit
];
var PutBucketInventoryConfiguration$ = [9, n0, _PBIC,
    { [_h]: ["PUT", "/?inventory", 200] }, () => PutBucketInventoryConfigurationRequest$, () => __Unit
];
var PutBucketLifecycleConfiguration$ = [9, n0, _PBLC,
    { [_hC]: "-", [_h]: ["PUT", "/?lifecycle", 200] }, () => PutBucketLifecycleConfigurationRequest$, () => PutBucketLifecycleConfigurationOutput$
];
var PutBucketLogging$ = [9, n0, _PBL,
    { [_hC]: "-", [_h]: ["PUT", "/?logging", 200] }, () => PutBucketLoggingRequest$, () => __Unit
];
var PutBucketMetricsConfiguration$ = [9, n0, _PBMC,
    { [_h]: ["PUT", "/?metrics", 200] }, () => PutBucketMetricsConfigurationRequest$, () => __Unit
];
var PutBucketNotificationConfiguration$ = [9, n0, _PBNC,
    { [_h]: ["PUT", "/?notification", 200] }, () => PutBucketNotificationConfigurationRequest$, () => __Unit
];
var PutBucketOwnershipControls$ = [9, n0, _PBOC,
    { [_hC]: "-", [_h]: ["PUT", "/?ownershipControls", 200] }, () => PutBucketOwnershipControlsRequest$, () => __Unit
];
var PutBucketPolicy$ = [9, n0, _PBP,
    { [_hC]: "-", [_h]: ["PUT", "/?policy", 200] }, () => PutBucketPolicyRequest$, () => __Unit
];
var PutBucketReplication$ = [9, n0, _PBR,
    { [_hC]: "-", [_h]: ["PUT", "/?replication", 200] }, () => PutBucketReplicationRequest$, () => __Unit
];
var PutBucketRequestPayment$ = [9, n0, _PBRP,
    { [_hC]: "-", [_h]: ["PUT", "/?requestPayment", 200] }, () => PutBucketRequestPaymentRequest$, () => __Unit
];
var PutBucketTagging$ = [9, n0, _PBT,
    { [_hC]: "-", [_h]: ["PUT", "/?tagging", 200] }, () => PutBucketTaggingRequest$, () => __Unit
];
var PutBucketVersioning$ = [9, n0, _PBV,
    { [_hC]: "-", [_h]: ["PUT", "/?versioning", 200] }, () => PutBucketVersioningRequest$, () => __Unit
];
var PutBucketWebsite$ = [9, n0, _PBW,
    { [_hC]: "-", [_h]: ["PUT", "/?website", 200] }, () => PutBucketWebsiteRequest$, () => __Unit
];
var PutObject$ = [9, n0, _PO,
    { [_hC]: "-", [_h]: ["PUT", "/{Key+}?x-id=PutObject", 200] }, () => PutObjectRequest$, () => PutObjectOutput$
];
var PutObjectAcl$ = [9, n0, _POA,
    { [_hC]: "-", [_h]: ["PUT", "/{Key+}?acl", 200] }, () => PutObjectAclRequest$, () => PutObjectAclOutput$
];
var PutObjectLegalHold$ = [9, n0, _POLH,
    { [_hC]: "-", [_h]: ["PUT", "/{Key+}?legal-hold", 200] }, () => PutObjectLegalHoldRequest$, () => PutObjectLegalHoldOutput$
];
var PutObjectLockConfiguration$ = [9, n0, _POLC,
    { [_hC]: "-", [_h]: ["PUT", "/?object-lock", 200] }, () => PutObjectLockConfigurationRequest$, () => PutObjectLockConfigurationOutput$
];
var PutObjectRetention$ = [9, n0, _PORu,
    { [_hC]: "-", [_h]: ["PUT", "/{Key+}?retention", 200] }, () => PutObjectRetentionRequest$, () => PutObjectRetentionOutput$
];
var PutObjectTagging$ = [9, n0, _POT,
    { [_hC]: "-", [_h]: ["PUT", "/{Key+}?tagging", 200] }, () => PutObjectTaggingRequest$, () => PutObjectTaggingOutput$
];
var PutPublicAccessBlock$ = [9, n0, _PPAB,
    { [_hC]: "-", [_h]: ["PUT", "/?publicAccessBlock", 200] }, () => PutPublicAccessBlockRequest$, () => __Unit
];
var RenameObject$ = [9, n0, _RO,
    { [_h]: ["PUT", "/{Key+}?renameObject", 200] }, () => RenameObjectRequest$, () => RenameObjectOutput$
];
var RestoreObject$ = [9, n0, _ROe,
    { [_hC]: "-", [_h]: ["POST", "/{Key+}?restore", 200] }, () => RestoreObjectRequest$, () => RestoreObjectOutput$
];
var SelectObjectContent$ = [9, n0, _SOC,
    { [_h]: ["POST", "/{Key+}?select&select-type=2", 200] }, () => SelectObjectContentRequest$, () => SelectObjectContentOutput$
];
var UpdateBucketMetadataInventoryTableConfiguration$ = [9, n0, _UBMITC,
    { [_hC]: "-", [_h]: ["PUT", "/?metadataInventoryTable", 200] }, () => UpdateBucketMetadataInventoryTableConfigurationRequest$, () => __Unit
];
var UpdateBucketMetadataJournalTableConfiguration$ = [9, n0, _UBMJTC,
    { [_hC]: "-", [_h]: ["PUT", "/?metadataJournalTable", 200] }, () => UpdateBucketMetadataJournalTableConfigurationRequest$, () => __Unit
];
var UpdateObjectEncryption$ = [9, n0, _UOE,
    { [_hC]: "-", [_h]: ["PUT", "/{Key+}?encryption", 200] }, () => UpdateObjectEncryptionRequest$, () => UpdateObjectEncryptionResponse$
];
var UploadPart$ = [9, n0, _UP,
    { [_hC]: "-", [_h]: ["PUT", "/{Key+}?x-id=UploadPart", 200] }, () => UploadPartRequest$, () => UploadPartOutput$
];
var UploadPartCopy$ = [9, n0, _UPC,
    { [_h]: ["PUT", "/{Key+}?x-id=UploadPartCopy", 200] }, () => UploadPartCopyRequest$, () => UploadPartCopyOutput$
];
var WriteGetObjectResponse$ = [9, n0, _WGOR,
    { [_en]: ["{RequestRoute}."], [_h]: ["POST", "/WriteGetObjectResponse", 200] }, () => WriteGetObjectResponseRequest$, () => __Unit
];

class CreateSessionCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    DisableS3ExpressSessionAuth: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "CreateSession", {})
    .n("S3Client", "CreateSessionCommand")
    .sc(CreateSession$)
    .build() {
}

var version = "3.1019.0";
var packageInfo = {
	version: version};

const fromUtf8 = (input) => new TextEncoder().encode(input);

function isEmptyData$1(data) {
    if (typeof data === "string") {
        return data.length === 0;
    }
    return data.byteLength === 0;
}

var SHA_1_HASH = { name: "SHA-1" };
var SHA_1_HMAC_ALGO = {
    name: "HMAC",
    hash: SHA_1_HASH,
};
var EMPTY_DATA_SHA_1 = new Uint8Array([
    218,
    57,
    163,
    238,
    94,
    107,
    75,
    13,
    50,
    85,
    191,
    239,
    149,
    96,
    24,
    144,
    175,
    216,
    7,
    9,
]);

const fallbackWindow = {};
function locateWindow() {
    if (typeof window !== "undefined") {
        return window;
    }
    else if (typeof self !== "undefined") {
        return self;
    }
    return fallbackWindow;
}

var Sha1$1 = /** @class */ (function () {
    function Sha1(secret) {
        this.toHash = new Uint8Array(0);
        if (secret !== void 0) {
            this.key = new Promise(function (resolve, reject) {
                locateWindow()
                    .crypto.subtle.importKey("raw", convertToBuffer$1(secret), SHA_1_HMAC_ALGO, false, ["sign"])
                    .then(resolve, reject);
            });
            this.key.catch(function () { });
        }
    }
    Sha1.prototype.update = function (data) {
        if (isEmptyData$1(data)) {
            return;
        }
        var update = convertToBuffer$1(data);
        var typedArray = new Uint8Array(this.toHash.byteLength + update.byteLength);
        typedArray.set(this.toHash, 0);
        typedArray.set(update, this.toHash.byteLength);
        this.toHash = typedArray;
    };
    Sha1.prototype.digest = function () {
        var _this = this;
        if (this.key) {
            return this.key.then(function (key) {
                return locateWindow()
                    .crypto.subtle.sign(SHA_1_HMAC_ALGO, key, _this.toHash)
                    .then(function (data) { return new Uint8Array(data); });
            });
        }
        if (isEmptyData$1(this.toHash)) {
            return Promise.resolve(EMPTY_DATA_SHA_1);
        }
        return Promise.resolve()
            .then(function () { return locateWindow().crypto.subtle.digest(SHA_1_HASH, _this.toHash); })
            .then(function (data) { return Promise.resolve(new Uint8Array(data)); });
    };
    Sha1.prototype.reset = function () {
        this.toHash = new Uint8Array(0);
    };
    return Sha1;
}());
function convertToBuffer$1(data) {
    if (typeof data === "string") {
        return fromUtf8(data);
    }
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
    }
    return new Uint8Array(data);
}

var subtleCryptoMethods = [
    "decrypt",
    "digest",
    "encrypt",
    "exportKey",
    "generateKey",
    "importKey",
    "sign",
    "verify"
];
function supportsWebCrypto(window) {
    if (supportsSecureRandom(window) &&
        typeof window.crypto.subtle === "object") {
        var subtle = window.crypto.subtle;
        return supportsSubtleCrypto(subtle);
    }
    return false;
}
function supportsSecureRandom(window) {
    if (typeof window === "object" && typeof window.crypto === "object") {
        var getRandomValues = window.crypto.getRandomValues;
        return typeof getRandomValues === "function";
    }
    return false;
}
function supportsSubtleCrypto(subtle) {
    return (subtle &&
        subtleCryptoMethods.every(function (methodName) { return typeof subtle[methodName] === "function"; }));
}

var Sha1 = /** @class */ (function () {
    function Sha1(secret) {
        if (supportsWebCrypto(locateWindow())) {
            this.hash = new Sha1$1(secret);
        }
        else {
            throw new Error("SHA1 not supported");
        }
    }
    Sha1.prototype.update = function (data, encoding) {
        this.hash.update(convertToBuffer$2(data));
    };
    Sha1.prototype.digest = function () {
        return this.hash.digest();
    };
    Sha1.prototype.reset = function () {
        this.hash.reset();
    };
    return Sha1;
}());

var SHA_256_HASH = { name: "SHA-256" };
var SHA_256_HMAC_ALGO = {
    name: "HMAC",
    hash: SHA_256_HASH
};
var EMPTY_DATA_SHA_256 = new Uint8Array([
    227,
    176,
    196,
    66,
    152,
    252,
    28,
    20,
    154,
    251,
    244,
    200,
    153,
    111,
    185,
    36,
    39,
    174,
    65,
    228,
    100,
    155,
    147,
    76,
    164,
    149,
    153,
    27,
    120,
    82,
    184,
    85
]);

var Sha256$2 = /** @class */ (function () {
    function Sha256(secret) {
        this.toHash = new Uint8Array(0);
        this.secret = secret;
        this.reset();
    }
    Sha256.prototype.update = function (data) {
        if (isEmptyData$2(data)) {
            return;
        }
        var update = convertToBuffer$2(data);
        var typedArray = new Uint8Array(this.toHash.byteLength + update.byteLength);
        typedArray.set(this.toHash, 0);
        typedArray.set(update, this.toHash.byteLength);
        this.toHash = typedArray;
    };
    Sha256.prototype.digest = function () {
        var _this = this;
        if (this.key) {
            return this.key.then(function (key) {
                return locateWindow()
                    .crypto.subtle.sign(SHA_256_HMAC_ALGO, key, _this.toHash)
                    .then(function (data) { return new Uint8Array(data); });
            });
        }
        if (isEmptyData$2(this.toHash)) {
            return Promise.resolve(EMPTY_DATA_SHA_256);
        }
        return Promise.resolve()
            .then(function () {
            return locateWindow().crypto.subtle.digest(SHA_256_HASH, _this.toHash);
        })
            .then(function (data) { return Promise.resolve(new Uint8Array(data)); });
    };
    Sha256.prototype.reset = function () {
        var _this = this;
        this.toHash = new Uint8Array(0);
        if (this.secret && this.secret !== void 0) {
            this.key = new Promise(function (resolve, reject) {
                locateWindow()
                    .crypto.subtle.importKey("raw", convertToBuffer$2(_this.secret), SHA_256_HMAC_ALGO, false, ["sign"])
                    .then(resolve, reject);
            });
            this.key.catch(function () { });
        }
    };
    return Sha256;
}());

/**
 * @internal
 */
var BLOCK_SIZE$1 = 64;
/**
 * @internal
 */
var DIGEST_LENGTH$1 = 32;
/**
 * @internal
 */
var KEY = new Uint32Array([
    0x428a2f98,
    0x71374491,
    0xb5c0fbcf,
    0xe9b5dba5,
    0x3956c25b,
    0x59f111f1,
    0x923f82a4,
    0xab1c5ed5,
    0xd807aa98,
    0x12835b01,
    0x243185be,
    0x550c7dc3,
    0x72be5d74,
    0x80deb1fe,
    0x9bdc06a7,
    0xc19bf174,
    0xe49b69c1,
    0xefbe4786,
    0x0fc19dc6,
    0x240ca1cc,
    0x2de92c6f,
    0x4a7484aa,
    0x5cb0a9dc,
    0x76f988da,
    0x983e5152,
    0xa831c66d,
    0xb00327c8,
    0xbf597fc7,
    0xc6e00bf3,
    0xd5a79147,
    0x06ca6351,
    0x14292967,
    0x27b70a85,
    0x2e1b2138,
    0x4d2c6dfc,
    0x53380d13,
    0x650a7354,
    0x766a0abb,
    0x81c2c92e,
    0x92722c85,
    0xa2bfe8a1,
    0xa81a664b,
    0xc24b8b70,
    0xc76c51a3,
    0xd192e819,
    0xd6990624,
    0xf40e3585,
    0x106aa070,
    0x19a4c116,
    0x1e376c08,
    0x2748774c,
    0x34b0bcb5,
    0x391c0cb3,
    0x4ed8aa4a,
    0x5b9cca4f,
    0x682e6ff3,
    0x748f82ee,
    0x78a5636f,
    0x84c87814,
    0x8cc70208,
    0x90befffa,
    0xa4506ceb,
    0xbef9a3f7,
    0xc67178f2
]);
/**
 * @internal
 */
var INIT$1 = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
];
/**
 * @internal
 */
var MAX_HASHABLE_LENGTH = Math.pow(2, 53) - 1;

/**
 * @internal
 */
var RawSha256 = /** @class */ (function () {
    function RawSha256() {
        this.state = Int32Array.from(INIT$1);
        this.temp = new Int32Array(64);
        this.buffer = new Uint8Array(64);
        this.bufferLength = 0;
        this.bytesHashed = 0;
        /**
         * @internal
         */
        this.finished = false;
    }
    RawSha256.prototype.update = function (data) {
        if (this.finished) {
            throw new Error("Attempted to update an already finished hash.");
        }
        var position = 0;
        var byteLength = data.byteLength;
        this.bytesHashed += byteLength;
        if (this.bytesHashed * 8 > MAX_HASHABLE_LENGTH) {
            throw new Error("Cannot hash more than 2^53 - 1 bits");
        }
        while (byteLength > 0) {
            this.buffer[this.bufferLength++] = data[position++];
            byteLength--;
            if (this.bufferLength === BLOCK_SIZE$1) {
                this.hashBuffer();
                this.bufferLength = 0;
            }
        }
    };
    RawSha256.prototype.digest = function () {
        if (!this.finished) {
            var bitsHashed = this.bytesHashed * 8;
            var bufferView = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
            var undecoratedLength = this.bufferLength;
            bufferView.setUint8(this.bufferLength++, 0x80);
            // Ensure the final block has enough room for the hashed length
            if (undecoratedLength % BLOCK_SIZE$1 >= BLOCK_SIZE$1 - 8) {
                for (var i = this.bufferLength; i < BLOCK_SIZE$1; i++) {
                    bufferView.setUint8(i, 0);
                }
                this.hashBuffer();
                this.bufferLength = 0;
            }
            for (var i = this.bufferLength; i < BLOCK_SIZE$1 - 8; i++) {
                bufferView.setUint8(i, 0);
            }
            bufferView.setUint32(BLOCK_SIZE$1 - 8, Math.floor(bitsHashed / 0x100000000), true);
            bufferView.setUint32(BLOCK_SIZE$1 - 4, bitsHashed);
            this.hashBuffer();
            this.finished = true;
        }
        // The value in state is little-endian rather than big-endian, so flip
        // each word into a new Uint8Array
        var out = new Uint8Array(DIGEST_LENGTH$1);
        for (var i = 0; i < 8; i++) {
            out[i * 4] = (this.state[i] >>> 24) & 0xff;
            out[i * 4 + 1] = (this.state[i] >>> 16) & 0xff;
            out[i * 4 + 2] = (this.state[i] >>> 8) & 0xff;
            out[i * 4 + 3] = (this.state[i] >>> 0) & 0xff;
        }
        return out;
    };
    RawSha256.prototype.hashBuffer = function () {
        var _a = this, buffer = _a.buffer, state = _a.state;
        var state0 = state[0], state1 = state[1], state2 = state[2], state3 = state[3], state4 = state[4], state5 = state[5], state6 = state[6], state7 = state[7];
        for (var i = 0; i < BLOCK_SIZE$1; i++) {
            if (i < 16) {
                this.temp[i] =
                    ((buffer[i * 4] & 0xff) << 24) |
                        ((buffer[i * 4 + 1] & 0xff) << 16) |
                        ((buffer[i * 4 + 2] & 0xff) << 8) |
                        (buffer[i * 4 + 3] & 0xff);
            }
            else {
                var u = this.temp[i - 2];
                var t1_1 = ((u >>> 17) | (u << 15)) ^ ((u >>> 19) | (u << 13)) ^ (u >>> 10);
                u = this.temp[i - 15];
                var t2_1 = ((u >>> 7) | (u << 25)) ^ ((u >>> 18) | (u << 14)) ^ (u >>> 3);
                this.temp[i] =
                    ((t1_1 + this.temp[i - 7]) | 0) + ((t2_1 + this.temp[i - 16]) | 0);
            }
            var t1 = ((((((state4 >>> 6) | (state4 << 26)) ^
                ((state4 >>> 11) | (state4 << 21)) ^
                ((state4 >>> 25) | (state4 << 7))) +
                ((state4 & state5) ^ (~state4 & state6))) |
                0) +
                ((state7 + ((KEY[i] + this.temp[i]) | 0)) | 0)) |
                0;
            var t2 = ((((state0 >>> 2) | (state0 << 30)) ^
                ((state0 >>> 13) | (state0 << 19)) ^
                ((state0 >>> 22) | (state0 << 10))) +
                ((state0 & state1) ^ (state0 & state2) ^ (state1 & state2))) |
                0;
            state7 = state6;
            state6 = state5;
            state5 = state4;
            state4 = (state3 + t1) | 0;
            state3 = state2;
            state2 = state1;
            state1 = state0;
            state0 = (t1 + t2) | 0;
        }
        state[0] += state0;
        state[1] += state1;
        state[2] += state2;
        state[3] += state3;
        state[4] += state4;
        state[5] += state5;
        state[6] += state6;
        state[7] += state7;
    };
    return RawSha256;
}());

var Sha256$1 = /** @class */ (function () {
    function Sha256(secret) {
        this.secret = secret;
        this.hash = new RawSha256();
        this.reset();
    }
    Sha256.prototype.update = function (toHash) {
        if (isEmptyData$2(toHash) || this.error) {
            return;
        }
        try {
            this.hash.update(convertToBuffer$2(toHash));
        }
        catch (e) {
            this.error = e;
        }
    };
    /* This synchronous method keeps compatibility
     * with the v2 aws-sdk.
     */
    Sha256.prototype.digestSync = function () {
        if (this.error) {
            throw this.error;
        }
        if (this.outer) {
            if (!this.outer.finished) {
                this.outer.update(this.hash.digest());
            }
            return this.outer.digest();
        }
        return this.hash.digest();
    };
    /* The underlying digest method here is synchronous.
     * To keep the same interface with the other hash functions
     * the default is to expose this as an async method.
     * However, it can sometimes be useful to have a sync method.
     */
    Sha256.prototype.digest = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.digestSync()];
            });
        });
    };
    Sha256.prototype.reset = function () {
        this.hash = new RawSha256();
        if (this.secret) {
            this.outer = new RawSha256();
            var inner = bufferFromSecret(this.secret);
            var outer = new Uint8Array(BLOCK_SIZE$1);
            outer.set(inner);
            for (var i = 0; i < BLOCK_SIZE$1; i++) {
                inner[i] ^= 0x36;
                outer[i] ^= 0x5c;
            }
            this.hash.update(inner);
            this.outer.update(outer);
            // overwrite the copied key in memory
            for (var i = 0; i < inner.byteLength; i++) {
                inner[i] = 0;
            }
        }
    };
    return Sha256;
}());
function bufferFromSecret(secret) {
    var input = convertToBuffer$2(secret);
    if (input.byteLength > BLOCK_SIZE$1) {
        var bufferHash = new RawSha256();
        bufferHash.update(input);
        input = bufferHash.digest();
    }
    var buffer = new Uint8Array(BLOCK_SIZE$1);
    buffer.set(input);
    return buffer;
}

var Sha256 = /** @class */ (function () {
    function Sha256(secret) {
        if (supportsWebCrypto(locateWindow())) {
            this.hash = new Sha256$2(secret);
        }
        else {
            this.hash = new Sha256$1(secret);
        }
    }
    Sha256.prototype.update = function (data, encoding) {
        this.hash.update(convertToBuffer$2(data));
    };
    Sha256.prototype.digest = function () {
        return this.hash.digest();
    };
    Sha256.prototype.reset = function () {
        this.hash.reset();
    };
    return Sha256;
}());

const createDefaultUserAgentProvider = ({ serviceId, clientVersion }) => async (config) => {
    const navigator = typeof window !== "undefined" ? window.navigator : undefined;
    const uaString = navigator?.userAgent ?? "";
    const osName = navigator?.userAgentData?.platform ?? fallback.os(uaString) ?? "other";
    const osVersion = undefined;
    const brands = navigator?.userAgentData?.brands ?? [];
    const brand = brands[brands.length - 1];
    const browserName = brand?.brand ?? fallback.browser(uaString) ?? "unknown";
    const browserVersion = brand?.version ?? "unknown";
    const sections = [
        ["aws-sdk-js", clientVersion],
        ["ua", "2.1"],
        [`os/${osName}`, osVersion],
        ["lang/js"],
        ["md/browser", `${browserName}_${browserVersion}`],
    ];
    if (serviceId) {
        sections.push([`api/${serviceId}`, clientVersion]);
    }
    const appId = await config?.userAgentAppId?.();
    if (appId) {
        sections.push([`app/${appId}`]);
    }
    return sections;
};
const fallback = {
    os(ua) {
        if (/iPhone|iPad|iPod/.test(ua))
            return "iOS";
        if (/Macintosh|Mac OS X/.test(ua))
            return "macOS";
        if (/Windows NT/.test(ua))
            return "Windows";
        if (/Android/.test(ua))
            return "Android";
        if (/Linux/.test(ua))
            return "Linux";
        return undefined;
    },
    browser(ua) {
        if (/EdgiOS|EdgA|Edg\//.test(ua))
            return "Microsoft Edge";
        if (/Firefox\//.test(ua))
            return "Firefox";
        if (/Chrome\//.test(ua))
            return "Chrome";
        if (/Safari\//.test(ua))
            return "Safari";
        return undefined;
    },
};

class Int64 {
    bytes;
    constructor(bytes) {
        this.bytes = bytes;
        if (bytes.byteLength !== 8) {
            throw new Error("Int64 buffers must be exactly 8 bytes");
        }
    }
    static fromNumber(number) {
        if (number > 9_223_372_036_854_775_807 || number < -9223372036854776e3) {
            throw new Error(`${number} is too large (or, if negative, too small) to represent as an Int64`);
        }
        const bytes = new Uint8Array(8);
        for (let i = 7, remaining = Math.abs(Math.round(number)); i > -1 && remaining > 0; i--, remaining /= 256) {
            bytes[i] = remaining;
        }
        if (number < 0) {
            negate(bytes);
        }
        return new Int64(bytes);
    }
    valueOf() {
        const bytes = this.bytes.slice(0);
        const negative = bytes[0] & 0b10000000;
        if (negative) {
            negate(bytes);
        }
        return parseInt(toHex(bytes), 16) * (negative ? -1 : 1);
    }
    toString() {
        return String(this.valueOf());
    }
}
function negate(bytes) {
    for (let i = 0; i < 8; i++) {
        bytes[i] ^= 0xff;
    }
    for (let i = 7; i > -1; i--) {
        bytes[i]++;
        if (bytes[i] !== 0)
            break;
    }
}

class HeaderMarshaller {
    toUtf8;
    fromUtf8;
    constructor(toUtf8, fromUtf8) {
        this.toUtf8 = toUtf8;
        this.fromUtf8 = fromUtf8;
    }
    format(headers) {
        const chunks = [];
        for (const headerName of Object.keys(headers)) {
            const bytes = this.fromUtf8(headerName);
            chunks.push(Uint8Array.from([bytes.byteLength]), bytes, this.formatHeaderValue(headers[headerName]));
        }
        const out = new Uint8Array(chunks.reduce((carry, bytes) => carry + bytes.byteLength, 0));
        let position = 0;
        for (const chunk of chunks) {
            out.set(chunk, position);
            position += chunk.byteLength;
        }
        return out;
    }
    formatHeaderValue(header) {
        switch (header.type) {
            case "boolean":
                return Uint8Array.from([header.value ? 0 : 1]);
            case "byte":
                return Uint8Array.from([2, header.value]);
            case "short":
                const shortView = new DataView(new ArrayBuffer(3));
                shortView.setUint8(0, 3);
                shortView.setInt16(1, header.value, false);
                return new Uint8Array(shortView.buffer);
            case "integer":
                const intView = new DataView(new ArrayBuffer(5));
                intView.setUint8(0, 4);
                intView.setInt32(1, header.value, false);
                return new Uint8Array(intView.buffer);
            case "long":
                const longBytes = new Uint8Array(9);
                longBytes[0] = 5;
                longBytes.set(header.value.bytes, 1);
                return longBytes;
            case "binary":
                const binView = new DataView(new ArrayBuffer(3 + header.value.byteLength));
                binView.setUint8(0, 6);
                binView.setUint16(1, header.value.byteLength, false);
                const binBytes = new Uint8Array(binView.buffer);
                binBytes.set(header.value, 3);
                return binBytes;
            case "string":
                const utf8Bytes = this.fromUtf8(header.value);
                const strView = new DataView(new ArrayBuffer(3 + utf8Bytes.byteLength));
                strView.setUint8(0, 7);
                strView.setUint16(1, utf8Bytes.byteLength, false);
                const strBytes = new Uint8Array(strView.buffer);
                strBytes.set(utf8Bytes, 3);
                return strBytes;
            case "timestamp":
                const tsBytes = new Uint8Array(9);
                tsBytes[0] = 8;
                tsBytes.set(Int64.fromNumber(header.value.valueOf()).bytes, 1);
                return tsBytes;
            case "uuid":
                if (!UUID_PATTERN.test(header.value)) {
                    throw new Error(`Invalid UUID received: ${header.value}`);
                }
                const uuidBytes = new Uint8Array(17);
                uuidBytes[0] = 9;
                uuidBytes.set(fromHex(header.value.replace(/\-/g, "")), 1);
                return uuidBytes;
        }
    }
    parse(headers) {
        const out = {};
        let position = 0;
        while (position < headers.byteLength) {
            const nameLength = headers.getUint8(position++);
            const name = this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, nameLength));
            position += nameLength;
            switch (headers.getUint8(position++)) {
                case 0:
                    out[name] = {
                        type: BOOLEAN_TAG,
                        value: true,
                    };
                    break;
                case 1:
                    out[name] = {
                        type: BOOLEAN_TAG,
                        value: false,
                    };
                    break;
                case 2:
                    out[name] = {
                        type: BYTE_TAG,
                        value: headers.getInt8(position++),
                    };
                    break;
                case 3:
                    out[name] = {
                        type: SHORT_TAG,
                        value: headers.getInt16(position, false),
                    };
                    position += 2;
                    break;
                case 4:
                    out[name] = {
                        type: INT_TAG,
                        value: headers.getInt32(position, false),
                    };
                    position += 4;
                    break;
                case 5:
                    out[name] = {
                        type: LONG_TAG,
                        value: new Int64(new Uint8Array(headers.buffer, headers.byteOffset + position, 8)),
                    };
                    position += 8;
                    break;
                case 6:
                    const binaryLength = headers.getUint16(position, false);
                    position += 2;
                    out[name] = {
                        type: BINARY_TAG,
                        value: new Uint8Array(headers.buffer, headers.byteOffset + position, binaryLength),
                    };
                    position += binaryLength;
                    break;
                case 7:
                    const stringLength = headers.getUint16(position, false);
                    position += 2;
                    out[name] = {
                        type: STRING_TAG,
                        value: this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, stringLength)),
                    };
                    position += stringLength;
                    break;
                case 8:
                    out[name] = {
                        type: TIMESTAMP_TAG,
                        value: new Date(new Int64(new Uint8Array(headers.buffer, headers.byteOffset + position, 8)).valueOf()),
                    };
                    position += 8;
                    break;
                case 9:
                    const uuidBytes = new Uint8Array(headers.buffer, headers.byteOffset + position, 16);
                    position += 16;
                    out[name] = {
                        type: UUID_TAG,
                        value: `${toHex(uuidBytes.subarray(0, 4))}-${toHex(uuidBytes.subarray(4, 6))}-${toHex(uuidBytes.subarray(6, 8))}-${toHex(uuidBytes.subarray(8, 10))}-${toHex(uuidBytes.subarray(10))}`,
                    };
                    break;
                default:
                    throw new Error(`Unrecognized header type tag`);
            }
        }
        return out;
    }
}
var HEADER_VALUE_TYPE;
(function (HEADER_VALUE_TYPE) {
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolTrue"] = 0] = "boolTrue";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolFalse"] = 1] = "boolFalse";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byte"] = 2] = "byte";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["short"] = 3] = "short";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["integer"] = 4] = "integer";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["long"] = 5] = "long";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byteArray"] = 6] = "byteArray";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["string"] = 7] = "string";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["timestamp"] = 8] = "timestamp";
    HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["uuid"] = 9] = "uuid";
})(HEADER_VALUE_TYPE || (HEADER_VALUE_TYPE = {}));
const BOOLEAN_TAG = "boolean";
const BYTE_TAG = "byte";
const SHORT_TAG = "short";
const INT_TAG = "integer";
const LONG_TAG = "long";
const BINARY_TAG = "binary";
const STRING_TAG = "string";
const TIMESTAMP_TAG = "timestamp";
const UUID_TAG = "uuid";
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

const PRELUDE_MEMBER_LENGTH = 4;
const PRELUDE_LENGTH = PRELUDE_MEMBER_LENGTH * 2;
const CHECKSUM_LENGTH = 4;
const MINIMUM_MESSAGE_LENGTH = PRELUDE_LENGTH + CHECKSUM_LENGTH * 2;
function splitMessage({ byteLength, byteOffset, buffer }) {
    if (byteLength < MINIMUM_MESSAGE_LENGTH) {
        throw new Error("Provided message too short to accommodate event stream message overhead");
    }
    const view = new DataView(buffer, byteOffset, byteLength);
    const messageLength = view.getUint32(0, false);
    if (byteLength !== messageLength) {
        throw new Error("Reported message length does not match received message length");
    }
    const headerLength = view.getUint32(PRELUDE_MEMBER_LENGTH, false);
    const expectedPreludeChecksum = view.getUint32(PRELUDE_LENGTH, false);
    const expectedMessageChecksum = view.getUint32(byteLength - CHECKSUM_LENGTH, false);
    const checksummer = new Crc32().update(new Uint8Array(buffer, byteOffset, PRELUDE_LENGTH));
    if (expectedPreludeChecksum !== checksummer.digest()) {
        throw new Error(`The prelude checksum specified in the message (${expectedPreludeChecksum}) does not match the calculated CRC32 checksum (${checksummer.digest()})`);
    }
    checksummer.update(new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH, byteLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH)));
    if (expectedMessageChecksum !== checksummer.digest()) {
        throw new Error(`The message checksum (${checksummer.digest()}) did not match the expected value of ${expectedMessageChecksum}`);
    }
    return {
        headers: new DataView(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH, headerLength),
        body: new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH + headerLength, messageLength - headerLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH + CHECKSUM_LENGTH)),
    };
}

class EventStreamCodec {
    headerMarshaller;
    messageBuffer;
    isEndOfStream;
    constructor(toUtf8, fromUtf8) {
        this.headerMarshaller = new HeaderMarshaller(toUtf8, fromUtf8);
        this.messageBuffer = [];
        this.isEndOfStream = false;
    }
    feed(message) {
        this.messageBuffer.push(this.decode(message));
    }
    endOfStream() {
        this.isEndOfStream = true;
    }
    getMessage() {
        const message = this.messageBuffer.pop();
        const isEndOfStream = this.isEndOfStream;
        return {
            getMessage() {
                return message;
            },
            isEndOfStream() {
                return isEndOfStream;
            },
        };
    }
    getAvailableMessages() {
        const messages = this.messageBuffer;
        this.messageBuffer = [];
        const isEndOfStream = this.isEndOfStream;
        return {
            getMessages() {
                return messages;
            },
            isEndOfStream() {
                return isEndOfStream;
            },
        };
    }
    encode({ headers: rawHeaders, body }) {
        const headers = this.headerMarshaller.format(rawHeaders);
        const length = headers.byteLength + body.byteLength + 16;
        const out = new Uint8Array(length);
        const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
        const checksum = new Crc32();
        view.setUint32(0, length, false);
        view.setUint32(4, headers.byteLength, false);
        view.setUint32(8, checksum.update(out.subarray(0, 8)).digest(), false);
        out.set(headers, 12);
        out.set(body, headers.byteLength + 12);
        view.setUint32(length - 4, checksum.update(out.subarray(8, length - 4)).digest(), false);
        return out;
    }
    decode(message) {
        const { headers, body } = splitMessage(message);
        return { headers: this.headerMarshaller.parse(headers), body };
    }
    formatHeaders(rawHeaders) {
        return this.headerMarshaller.format(rawHeaders);
    }
}

class MessageDecoderStream {
    options;
    constructor(options) {
        this.options = options;
    }
    [Symbol.asyncIterator]() {
        return this.asyncIterator();
    }
    async *asyncIterator() {
        for await (const bytes of this.options.inputStream) {
            const decoded = this.options.decoder.decode(bytes);
            yield decoded;
        }
    }
}

class MessageEncoderStream {
    options;
    constructor(options) {
        this.options = options;
    }
    [Symbol.asyncIterator]() {
        return this.asyncIterator();
    }
    async *asyncIterator() {
        for await (const msg of this.options.messageStream) {
            const encoded = this.options.encoder.encode(msg);
            yield encoded;
        }
        if (this.options.includeEndFrame) {
            yield new Uint8Array(0);
        }
    }
}

class SmithyMessageDecoderStream {
    options;
    constructor(options) {
        this.options = options;
    }
    [Symbol.asyncIterator]() {
        return this.asyncIterator();
    }
    async *asyncIterator() {
        for await (const message of this.options.messageStream) {
            const deserialized = await this.options.deserializer(message);
            if (deserialized === undefined)
                continue;
            yield deserialized;
        }
    }
}

class SmithyMessageEncoderStream {
    options;
    constructor(options) {
        this.options = options;
    }
    [Symbol.asyncIterator]() {
        return this.asyncIterator();
    }
    async *asyncIterator() {
        for await (const chunk of this.options.inputStream) {
            const payloadBuf = this.options.serializer(chunk);
            yield payloadBuf;
        }
    }
}

function getChunkedStream(source) {
    let currentMessageTotalLength = 0;
    let currentMessagePendingLength = 0;
    let currentMessage = null;
    let messageLengthBuffer = null;
    const allocateMessage = (size) => {
        if (typeof size !== "number") {
            throw new Error("Attempted to allocate an event message where size was not a number: " + size);
        }
        currentMessageTotalLength = size;
        currentMessagePendingLength = 4;
        currentMessage = new Uint8Array(size);
        const currentMessageView = new DataView(currentMessage.buffer);
        currentMessageView.setUint32(0, size, false);
    };
    const iterator = async function* () {
        const sourceIterator = source[Symbol.asyncIterator]();
        while (true) {
            const { value, done } = await sourceIterator.next();
            if (done) {
                if (!currentMessageTotalLength) {
                    return;
                }
                else if (currentMessageTotalLength === currentMessagePendingLength) {
                    yield currentMessage;
                }
                else {
                    throw new Error("Truncated event message received.");
                }
                return;
            }
            const chunkLength = value.length;
            let currentOffset = 0;
            while (currentOffset < chunkLength) {
                if (!currentMessage) {
                    const bytesRemaining = chunkLength - currentOffset;
                    if (!messageLengthBuffer) {
                        messageLengthBuffer = new Uint8Array(4);
                    }
                    const numBytesForTotal = Math.min(4 - currentMessagePendingLength, bytesRemaining);
                    messageLengthBuffer.set(value.slice(currentOffset, currentOffset + numBytesForTotal), currentMessagePendingLength);
                    currentMessagePendingLength += numBytesForTotal;
                    currentOffset += numBytesForTotal;
                    if (currentMessagePendingLength < 4) {
                        break;
                    }
                    allocateMessage(new DataView(messageLengthBuffer.buffer).getUint32(0, false));
                    messageLengthBuffer = null;
                }
                const numBytesToWrite = Math.min(currentMessageTotalLength - currentMessagePendingLength, chunkLength - currentOffset);
                currentMessage.set(value.slice(currentOffset, currentOffset + numBytesToWrite), currentMessagePendingLength);
                currentMessagePendingLength += numBytesToWrite;
                currentOffset += numBytesToWrite;
                if (currentMessageTotalLength && currentMessageTotalLength === currentMessagePendingLength) {
                    yield currentMessage;
                    currentMessage = null;
                    currentMessageTotalLength = 0;
                    currentMessagePendingLength = 0;
                }
            }
        }
    };
    return {
        [Symbol.asyncIterator]: iterator,
    };
}

function getMessageUnmarshaller(deserializer, toUtf8) {
    return async function (message) {
        const { value: messageType } = message.headers[":message-type"];
        if (messageType === "error") {
            const unmodeledError = new Error(message.headers[":error-message"].value || "UnknownError");
            unmodeledError.name = message.headers[":error-code"].value;
            throw unmodeledError;
        }
        else if (messageType === "exception") {
            const code = message.headers[":exception-type"].value;
            const exception = { [code]: message };
            const deserializedException = await deserializer(exception);
            if (deserializedException.$unknown) {
                const error = new Error(toUtf8(message.body));
                error.name = code;
                throw error;
            }
            throw deserializedException[code];
        }
        else if (messageType === "event") {
            const event = {
                [message.headers[":event-type"].value]: message,
            };
            const deserialized = await deserializer(event);
            if (deserialized.$unknown)
                return;
            return deserialized;
        }
        else {
            throw Error(`Unrecognizable event type: ${message.headers[":event-type"].value}`);
        }
    };
}

let EventStreamMarshaller$1 = class EventStreamMarshaller {
    eventStreamCodec;
    utfEncoder;
    constructor({ utf8Encoder, utf8Decoder }) {
        this.eventStreamCodec = new EventStreamCodec(utf8Encoder, utf8Decoder);
        this.utfEncoder = utf8Encoder;
    }
    deserialize(body, deserializer) {
        const inputStream = getChunkedStream(body);
        return new SmithyMessageDecoderStream({
            messageStream: new MessageDecoderStream({ inputStream, decoder: this.eventStreamCodec }),
            deserializer: getMessageUnmarshaller(deserializer, this.utfEncoder),
        });
    }
    serialize(inputStream, serializer) {
        return new MessageEncoderStream({
            messageStream: new SmithyMessageEncoderStream({ inputStream, serializer }),
            encoder: this.eventStreamCodec,
            includeEndFrame: true,
        });
    }
};

const readableStreamtoIterable = (readableStream) => ({
    [Symbol.asyncIterator]: async function* () {
        const reader = readableStream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    return;
                yield value;
            }
        }
        finally {
            reader.releaseLock();
        }
    },
});
const iterableToReadableStream = (asyncIterable) => {
    const iterator = asyncIterable[Symbol.asyncIterator]();
    return new ReadableStream({
        async pull(controller) {
            const { done, value } = await iterator.next();
            if (done) {
                return controller.close();
            }
            controller.enqueue(value);
        },
    });
};

class EventStreamMarshaller {
    universalMarshaller;
    constructor({ utf8Encoder, utf8Decoder }) {
        this.universalMarshaller = new EventStreamMarshaller$1({
            utf8Decoder,
            utf8Encoder,
        });
    }
    deserialize(body, deserializer) {
        const bodyIterable = isReadableStream(body) ? readableStreamtoIterable(body) : body;
        return this.universalMarshaller.deserialize(bodyIterable, deserializer);
    }
    serialize(input, serializer) {
        const serialziedIterable = this.universalMarshaller.serialize(input, serializer);
        return typeof ReadableStream === "function" ? iterableToReadableStream(serialziedIterable) : serialziedIterable;
    }
}
const isReadableStream = (body) => typeof ReadableStream === "function" && body instanceof ReadableStream;

const eventStreamSerdeProvider = (options) => new EventStreamMarshaller(options);

async function blobReader(blob, onChunk, chunkSize = 1024 * 1024) {
    const size = blob.size;
    let totalBytesRead = 0;
    while (totalBytesRead < size) {
        const slice = blob.slice(totalBytesRead, Math.min(size, totalBytesRead + chunkSize));
        onChunk(new Uint8Array(await slice.arrayBuffer()));
        totalBytesRead += slice.size;
    }
}

const blobHasher = async function blobHasher(hashCtor, blob) {
    const hash = new hashCtor();
    await blobReader(blob, (chunk) => {
        hash.update(chunk);
    });
    return hash.digest();
};

const invalidProvider = (message) => () => Promise.reject(message);

const BLOCK_SIZE = 64;
const DIGEST_LENGTH = 16;
const INIT = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

class Md5 {
    state;
    buffer;
    bufferLength;
    bytesHashed;
    finished;
    constructor() {
        this.reset();
    }
    update(sourceData) {
        if (isEmptyData(sourceData)) {
            return;
        }
        else if (this.finished) {
            throw new Error("Attempted to update an already finished hash.");
        }
        const data = convertToBuffer(sourceData);
        let position = 0;
        let { byteLength } = data;
        this.bytesHashed += byteLength;
        while (byteLength > 0) {
            this.buffer.setUint8(this.bufferLength++, data[position++]);
            byteLength--;
            if (this.bufferLength === BLOCK_SIZE) {
                this.hashBuffer();
                this.bufferLength = 0;
            }
        }
    }
    async digest() {
        if (!this.finished) {
            const { buffer, bufferLength: undecoratedLength, bytesHashed } = this;
            const bitsHashed = bytesHashed * 8;
            buffer.setUint8(this.bufferLength++, 0b10000000);
            if (undecoratedLength % BLOCK_SIZE >= BLOCK_SIZE - 8) {
                for (let i = this.bufferLength; i < BLOCK_SIZE; i++) {
                    buffer.setUint8(i, 0);
                }
                this.hashBuffer();
                this.bufferLength = 0;
            }
            for (let i = this.bufferLength; i < BLOCK_SIZE - 8; i++) {
                buffer.setUint8(i, 0);
            }
            buffer.setUint32(BLOCK_SIZE - 8, bitsHashed >>> 0, true);
            buffer.setUint32(BLOCK_SIZE - 4, Math.floor(bitsHashed / 0x100000000), true);
            this.hashBuffer();
            this.finished = true;
        }
        const out = new DataView(new ArrayBuffer(DIGEST_LENGTH));
        for (let i = 0; i < 4; i++) {
            out.setUint32(i * 4, this.state[i], true);
        }
        return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
    }
    hashBuffer() {
        const { buffer, state } = this;
        let a = state[0], b = state[1], c = state[2], d = state[3];
        a = ff(a, b, c, d, buffer.getUint32(0, true), 7, 0xd76aa478);
        d = ff(d, a, b, c, buffer.getUint32(4, true), 12, 0xe8c7b756);
        c = ff(c, d, a, b, buffer.getUint32(8, true), 17, 0x242070db);
        b = ff(b, c, d, a, buffer.getUint32(12, true), 22, 0xc1bdceee);
        a = ff(a, b, c, d, buffer.getUint32(16, true), 7, 0xf57c0faf);
        d = ff(d, a, b, c, buffer.getUint32(20, true), 12, 0x4787c62a);
        c = ff(c, d, a, b, buffer.getUint32(24, true), 17, 0xa8304613);
        b = ff(b, c, d, a, buffer.getUint32(28, true), 22, 0xfd469501);
        a = ff(a, b, c, d, buffer.getUint32(32, true), 7, 0x698098d8);
        d = ff(d, a, b, c, buffer.getUint32(36, true), 12, 0x8b44f7af);
        c = ff(c, d, a, b, buffer.getUint32(40, true), 17, 0xffff5bb1);
        b = ff(b, c, d, a, buffer.getUint32(44, true), 22, 0x895cd7be);
        a = ff(a, b, c, d, buffer.getUint32(48, true), 7, 0x6b901122);
        d = ff(d, a, b, c, buffer.getUint32(52, true), 12, 0xfd987193);
        c = ff(c, d, a, b, buffer.getUint32(56, true), 17, 0xa679438e);
        b = ff(b, c, d, a, buffer.getUint32(60, true), 22, 0x49b40821);
        a = gg(a, b, c, d, buffer.getUint32(4, true), 5, 0xf61e2562);
        d = gg(d, a, b, c, buffer.getUint32(24, true), 9, 0xc040b340);
        c = gg(c, d, a, b, buffer.getUint32(44, true), 14, 0x265e5a51);
        b = gg(b, c, d, a, buffer.getUint32(0, true), 20, 0xe9b6c7aa);
        a = gg(a, b, c, d, buffer.getUint32(20, true), 5, 0xd62f105d);
        d = gg(d, a, b, c, buffer.getUint32(40, true), 9, 0x02441453);
        c = gg(c, d, a, b, buffer.getUint32(60, true), 14, 0xd8a1e681);
        b = gg(b, c, d, a, buffer.getUint32(16, true), 20, 0xe7d3fbc8);
        a = gg(a, b, c, d, buffer.getUint32(36, true), 5, 0x21e1cde6);
        d = gg(d, a, b, c, buffer.getUint32(56, true), 9, 0xc33707d6);
        c = gg(c, d, a, b, buffer.getUint32(12, true), 14, 0xf4d50d87);
        b = gg(b, c, d, a, buffer.getUint32(32, true), 20, 0x455a14ed);
        a = gg(a, b, c, d, buffer.getUint32(52, true), 5, 0xa9e3e905);
        d = gg(d, a, b, c, buffer.getUint32(8, true), 9, 0xfcefa3f8);
        c = gg(c, d, a, b, buffer.getUint32(28, true), 14, 0x676f02d9);
        b = gg(b, c, d, a, buffer.getUint32(48, true), 20, 0x8d2a4c8a);
        a = hh(a, b, c, d, buffer.getUint32(20, true), 4, 0xfffa3942);
        d = hh(d, a, b, c, buffer.getUint32(32, true), 11, 0x8771f681);
        c = hh(c, d, a, b, buffer.getUint32(44, true), 16, 0x6d9d6122);
        b = hh(b, c, d, a, buffer.getUint32(56, true), 23, 0xfde5380c);
        a = hh(a, b, c, d, buffer.getUint32(4, true), 4, 0xa4beea44);
        d = hh(d, a, b, c, buffer.getUint32(16, true), 11, 0x4bdecfa9);
        c = hh(c, d, a, b, buffer.getUint32(28, true), 16, 0xf6bb4b60);
        b = hh(b, c, d, a, buffer.getUint32(40, true), 23, 0xbebfbc70);
        a = hh(a, b, c, d, buffer.getUint32(52, true), 4, 0x289b7ec6);
        d = hh(d, a, b, c, buffer.getUint32(0, true), 11, 0xeaa127fa);
        c = hh(c, d, a, b, buffer.getUint32(12, true), 16, 0xd4ef3085);
        b = hh(b, c, d, a, buffer.getUint32(24, true), 23, 0x04881d05);
        a = hh(a, b, c, d, buffer.getUint32(36, true), 4, 0xd9d4d039);
        d = hh(d, a, b, c, buffer.getUint32(48, true), 11, 0xe6db99e5);
        c = hh(c, d, a, b, buffer.getUint32(60, true), 16, 0x1fa27cf8);
        b = hh(b, c, d, a, buffer.getUint32(8, true), 23, 0xc4ac5665);
        a = ii(a, b, c, d, buffer.getUint32(0, true), 6, 0xf4292244);
        d = ii(d, a, b, c, buffer.getUint32(28, true), 10, 0x432aff97);
        c = ii(c, d, a, b, buffer.getUint32(56, true), 15, 0xab9423a7);
        b = ii(b, c, d, a, buffer.getUint32(20, true), 21, 0xfc93a039);
        a = ii(a, b, c, d, buffer.getUint32(48, true), 6, 0x655b59c3);
        d = ii(d, a, b, c, buffer.getUint32(12, true), 10, 0x8f0ccc92);
        c = ii(c, d, a, b, buffer.getUint32(40, true), 15, 0xffeff47d);
        b = ii(b, c, d, a, buffer.getUint32(4, true), 21, 0x85845dd1);
        a = ii(a, b, c, d, buffer.getUint32(32, true), 6, 0x6fa87e4f);
        d = ii(d, a, b, c, buffer.getUint32(60, true), 10, 0xfe2ce6e0);
        c = ii(c, d, a, b, buffer.getUint32(24, true), 15, 0xa3014314);
        b = ii(b, c, d, a, buffer.getUint32(52, true), 21, 0x4e0811a1);
        a = ii(a, b, c, d, buffer.getUint32(16, true), 6, 0xf7537e82);
        d = ii(d, a, b, c, buffer.getUint32(44, true), 10, 0xbd3af235);
        c = ii(c, d, a, b, buffer.getUint32(8, true), 15, 0x2ad7d2bb);
        b = ii(b, c, d, a, buffer.getUint32(36, true), 21, 0xeb86d391);
        state[0] = (a + state[0]) & 0xffffffff;
        state[1] = (b + state[1]) & 0xffffffff;
        state[2] = (c + state[2]) & 0xffffffff;
        state[3] = (d + state[3]) & 0xffffffff;
    }
    reset() {
        this.state = Uint32Array.from(INIT);
        this.buffer = new DataView(new ArrayBuffer(BLOCK_SIZE));
        this.bufferLength = 0;
        this.bytesHashed = 0;
        this.finished = false;
    }
}
function cmn(q, a, b, x, s, t) {
    a = (((a + q) & 0xffffffff) + ((x + t) & 0xffffffff)) & 0xffffffff;
    return (((a << s) | (a >>> (32 - s))) + b) & 0xffffffff;
}
function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
}
function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
}
function isEmptyData(data) {
    if (typeof data === "string") {
        return data.length === 0;
    }
    return data.byteLength === 0;
}
function convertToBuffer(data) {
    if (typeof data === "string") {
        return fromUtf8$3(data);
    }
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
    }
    return new Uint8Array(data);
}

const DEFAULTS_MODE_OPTIONS = ["in-region", "cross-region", "mobile", "standard", "legacy"];

const resolveDefaultsModeConfig = ({ defaultsMode, } = {}) => memoize(async () => {
    const mode = typeof defaultsMode === "function" ? await defaultsMode() : defaultsMode;
    switch (mode?.toLowerCase()) {
        case "auto":
            return Promise.resolve(useMobileConfiguration() ? "mobile" : "standard");
        case "mobile":
        case "in-region":
        case "cross-region":
        case "standard":
        case "legacy":
            return Promise.resolve(mode?.toLocaleLowerCase());
        case undefined:
            return Promise.resolve("legacy");
        default:
            throw new Error(`Invalid parameter for "defaultsMode", expect ${DEFAULTS_MODE_OPTIONS.join(", ")}, got ${mode}`);
    }
});
const useMobileConfiguration = () => {
    const navigator = window?.navigator;
    if (navigator?.connection) {
        const { effectiveType, rtt, downlink } = navigator?.connection;
        const slow = (typeof effectiveType === "string" && effectiveType !== "4g") || Number(rtt) > 100 || Number(downlink) < 10;
        if (slow) {
            return true;
        }
    }
    return (navigator?.userAgentData?.mobile || (typeof navigator?.maxTouchPoints === "number" && navigator?.maxTouchPoints > 1));
};

const getRuntimeConfig$1 = (config) => {
    return {
        apiVersion: "2006-03-01",
        base64Decoder: config?.base64Decoder ?? fromBase64,
        base64Encoder: config?.base64Encoder ?? toBase64,
        disableHostPrefix: config?.disableHostPrefix ?? false,
        endpointProvider: config?.endpointProvider ?? defaultEndpointResolver,
        extensions: config?.extensions ?? [],
        getAwsChunkedEncodingStream: config?.getAwsChunkedEncodingStream ?? getAwsChunkedEncodingStream,
        httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? defaultS3HttpAuthSchemeProvider,
        httpAuthSchemes: config?.httpAuthSchemes ?? [
            {
                schemeId: "aws.auth#sigv4",
                identityProvider: (ipc) => ipc.getIdentityProvider("aws.auth#sigv4"),
                signer: new AwsSdkSigV4Signer(),
            },
            {
                schemeId: "aws.auth#sigv4a",
                identityProvider: (ipc) => ipc.getIdentityProvider("aws.auth#sigv4a"),
                signer: new AwsSdkSigV4ASigner(),
            },
        ],
        logger: config?.logger ?? new NoOpLogger(),
        protocol: config?.protocol ?? S3RestXmlProtocol,
        protocolSettings: config?.protocolSettings ?? {
            defaultNamespace: "com.amazonaws.s3",
            errorTypeRegistries,
            xmlNamespace: "http://s3.amazonaws.com/doc/2006-03-01/",
            version: "2006-03-01",
            serviceTarget: "AmazonS3",
        },
        sdkStreamMixin: config?.sdkStreamMixin ?? sdkStreamMixin,
        serviceId: config?.serviceId ?? "S3",
        signerConstructor: config?.signerConstructor ?? SignatureV4MultiRegion,
        signingEscapePath: config?.signingEscapePath ?? false,
        urlParser: config?.urlParser ?? parseUrl,
        useArnRegion: config?.useArnRegion ?? undefined,
        utf8Decoder: config?.utf8Decoder ?? fromUtf8$3,
        utf8Encoder: config?.utf8Encoder ?? toUtf8,
    };
};

const getRuntimeConfig = (config) => {
    const defaultsMode = resolveDefaultsModeConfig(config);
    const defaultConfigProvider = () => defaultsMode().then(loadConfigsForDefaultMode);
    const clientSharedValues = getRuntimeConfig$1(config);
    return {
        ...clientSharedValues,
        ...config,
        runtime: "browser",
        defaultsMode,
        bodyLengthChecker: config?.bodyLengthChecker ?? calculateBodyLength,
        credentialDefaultProvider: config?.credentialDefaultProvider ?? ((_) => () => Promise.reject(new Error("Credential is missing"))),
        defaultUserAgentProvider: config?.defaultUserAgentProvider ?? createDefaultUserAgentProvider({ serviceId: clientSharedValues.serviceId, clientVersion: packageInfo.version }),
        eventStreamSerdeProvider: config?.eventStreamSerdeProvider ?? eventStreamSerdeProvider,
        maxAttempts: config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        md5: config?.md5 ?? Md5,
        region: config?.region ?? invalidProvider("Region is missing"),
        requestHandler: FetchHttpHandler.create(config?.requestHandler ?? defaultConfigProvider),
        retryMode: config?.retryMode ?? (async () => (await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE),
        sha1: config?.sha1 ?? Sha1,
        sha256: config?.sha256 ?? Sha256,
        streamCollector: config?.streamCollector ?? streamCollector,
        streamHasher: config?.streamHasher ?? blobHasher,
        useDualstackEndpoint: config?.useDualstackEndpoint ?? (() => Promise.resolve(DEFAULT_USE_DUALSTACK_ENDPOINT)),
        useFipsEndpoint: config?.useFipsEndpoint ?? (() => Promise.resolve(DEFAULT_USE_FIPS_ENDPOINT)),
    };
};

const getAwsRegionExtensionConfiguration = (runtimeConfig) => {
    return {
        setRegion(region) {
            runtimeConfig.region = region;
        },
        region() {
            return runtimeConfig.region;
        },
    };
};
const resolveAwsRegionExtensionConfiguration = (awsRegionExtensionConfiguration) => {
    return {
        region: awsRegionExtensionConfiguration.region(),
    };
};

const getHttpAuthExtensionConfiguration = (runtimeConfig) => {
    const _httpAuthSchemes = runtimeConfig.httpAuthSchemes;
    let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider;
    let _credentials = runtimeConfig.credentials;
    return {
        setHttpAuthScheme(httpAuthScheme) {
            const index = _httpAuthSchemes.findIndex((scheme) => scheme.schemeId === httpAuthScheme.schemeId);
            if (index === -1) {
                _httpAuthSchemes.push(httpAuthScheme);
            }
            else {
                _httpAuthSchemes.splice(index, 1, httpAuthScheme);
            }
        },
        httpAuthSchemes() {
            return _httpAuthSchemes;
        },
        setHttpAuthSchemeProvider(httpAuthSchemeProvider) {
            _httpAuthSchemeProvider = httpAuthSchemeProvider;
        },
        httpAuthSchemeProvider() {
            return _httpAuthSchemeProvider;
        },
        setCredentials(credentials) {
            _credentials = credentials;
        },
        credentials() {
            return _credentials;
        },
    };
};
const resolveHttpAuthRuntimeConfig = (config) => {
    return {
        httpAuthSchemes: config.httpAuthSchemes(),
        httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
        credentials: config.credentials(),
    };
};

const resolveRuntimeExtensions = (runtimeConfig, extensions) => {
    const extensionConfiguration = Object.assign(getAwsRegionExtensionConfiguration(runtimeConfig), getDefaultExtensionConfiguration(runtimeConfig), getHttpHandlerExtensionConfiguration(runtimeConfig), getHttpAuthExtensionConfiguration(runtimeConfig));
    extensions.forEach((extension) => extension.configure(extensionConfiguration));
    return Object.assign(runtimeConfig, resolveAwsRegionExtensionConfiguration(extensionConfiguration), resolveDefaultRuntimeConfig(extensionConfiguration), resolveHttpHandlerRuntimeConfig(extensionConfiguration), resolveHttpAuthRuntimeConfig(extensionConfiguration));
};

class S3Client extends Client {
    config;
    constructor(...[configuration]) {
        const _config_0 = getRuntimeConfig(configuration || {});
        super(_config_0);
        this.initConfig = _config_0;
        const _config_1 = resolveClientEndpointParameters(_config_0);
        const _config_2 = resolveUserAgentConfig(_config_1);
        const _config_3 = resolveFlexibleChecksumsConfig(_config_2);
        const _config_4 = resolveRetryConfig(_config_3);
        const _config_5 = resolveRegionConfig(_config_4);
        const _config_6 = resolveHostHeaderConfig(_config_5);
        const _config_7 = resolveEndpointConfig(_config_6);
        const _config_8 = resolveEventStreamSerdeConfig(_config_7);
        const _config_9 = resolveHttpAuthSchemeConfig(_config_8);
        const _config_10 = resolveS3Config(_config_9, { session: [() => this, CreateSessionCommand] });
        const _config_11 = resolveRuntimeExtensions(_config_10, configuration?.extensions || []);
        this.config = _config_11;
        this.middlewareStack.use(getSchemaSerdePlugin(this.config));
        this.middlewareStack.use(getUserAgentPlugin(this.config));
        this.middlewareStack.use(getRetryPlugin(this.config));
        this.middlewareStack.use(getContentLengthPlugin(this.config));
        this.middlewareStack.use(getHostHeaderPlugin(this.config));
        this.middlewareStack.use(getLoggerPlugin(this.config));
        this.middlewareStack.use(getRecursionDetectionPlugin(this.config));
        this.middlewareStack.use(getHttpAuthSchemeEndpointRuleSetPlugin(this.config, {
            httpAuthSchemeParametersProvider: defaultS3HttpAuthSchemeParametersProvider,
            identityProviderConfigProvider: async (config) => new DefaultIdentityProviderConfig({
                "aws.auth#sigv4": config.credentials,
                "aws.auth#sigv4a": config.credentials,
            }),
        }));
        this.middlewareStack.use(getHttpSigningPlugin(this.config));
        this.middlewareStack.use(getValidateBucketNamePlugin(this.config));
        this.middlewareStack.use(getAddExpectContinuePlugin(this.config));
        this.middlewareStack.use(getRegionRedirectMiddlewarePlugin(this.config));
        this.middlewareStack.use(getS3ExpressPlugin(this.config));
        this.middlewareStack.use(getS3ExpressHttpSigningPlugin(this.config));
    }
    destroy() {
        super.destroy();
    }
}

class AbortMultipartUploadCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "AbortMultipartUpload", {})
    .n("S3Client", "AbortMultipartUploadCommand")
    .sc(AbortMultipartUpload$)
    .build() {
}

function ssecMiddleware(options) {
    return (next) => async (args) => {
        const input = { ...args.input };
        const properties = [
            {
                target: "SSECustomerKey",
                hash: "SSECustomerKeyMD5",
            },
            {
                target: "CopySourceSSECustomerKey",
                hash: "CopySourceSSECustomerKeyMD5",
            },
        ];
        for (const prop of properties) {
            const value = input[prop.target];
            if (value) {
                let valueForHash;
                if (typeof value === "string") {
                    if (isValidBase64EncodedSSECustomerKey(value, options)) {
                        valueForHash = options.base64Decoder(value);
                    }
                    else {
                        valueForHash = options.utf8Decoder(value);
                        input[prop.target] = options.base64Encoder(valueForHash);
                    }
                }
                else {
                    valueForHash = ArrayBuffer.isView(value)
                        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
                        : new Uint8Array(value);
                    input[prop.target] = options.base64Encoder(valueForHash);
                }
                const hash = new options.md5();
                hash.update(valueForHash);
                input[prop.hash] = options.base64Encoder(await hash.digest());
            }
        }
        return next({
            ...args,
            input,
        });
    };
}
const ssecMiddlewareOptions = {
    name: "ssecMiddleware",
    step: "initialize",
    tags: ["SSE"],
    override: true,
};
const getSsecPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(ssecMiddleware(config), ssecMiddlewareOptions);
    },
});
function isValidBase64EncodedSSECustomerKey(str, options) {
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    if (!base64Regex.test(str))
        return false;
    try {
        const decodedBytes = options.base64Decoder(str);
        return decodedBytes.length === 32;
    }
    catch {
        return false;
    }
}

class CompleteMultipartUploadCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "CompleteMultipartUpload", {})
    .n("S3Client", "CompleteMultipartUploadCommand")
    .sc(CompleteMultipartUpload$)
    .build() {
}

class CopyObjectCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    DisableS3ExpressSessionAuth: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
    CopySource: { type: "contextParams", name: "CopySource" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "CopyObject", {})
    .n("S3Client", "CopyObjectCommand")
    .sc(CopyObject$)
    .build() {
}

function locationConstraintMiddleware(options) {
    return (next) => async (args) => {
        const { CreateBucketConfiguration } = args.input;
        const region = await options.region();
        if (!CreateBucketConfiguration?.LocationConstraint && !CreateBucketConfiguration?.Location) {
            if (region !== "us-east-1") {
                args.input.CreateBucketConfiguration = args.input.CreateBucketConfiguration ?? {};
                args.input.CreateBucketConfiguration.LocationConstraint = region;
            }
        }
        return next(args);
    };
}
const locationConstraintMiddlewareOptions = {
    step: "initialize",
    tags: ["LOCATION_CONSTRAINT", "CREATE_BUCKET_CONFIGURATION"],
    name: "locationConstraintMiddleware",
    override: true,
};
const getLocationConstraintPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(locationConstraintMiddleware(config), locationConstraintMiddlewareOptions);
    },
});

class CreateBucketCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    DisableAccessPoints: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getLocationConstraintPlugin(config),
    ];
})
    .s("AmazonS3", "CreateBucket", {})
    .n("S3Client", "CreateBucketCommand")
    .sc(CreateBucket$)
    .build() {
}

class CreateBucketMetadataConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "CreateBucketMetadataConfiguration", {})
    .n("S3Client", "CreateBucketMetadataConfigurationCommand")
    .sc(CreateBucketMetadataConfiguration$)
    .build() {
}

class CreateBucketMetadataTableConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "CreateBucketMetadataTableConfiguration", {})
    .n("S3Client", "CreateBucketMetadataTableConfigurationCommand")
    .sc(CreateBucketMetadataTableConfiguration$)
    .build() {
}

class CreateMultipartUploadCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "CreateMultipartUpload", {})
    .n("S3Client", "CreateMultipartUploadCommand")
    .sc(CreateMultipartUpload$)
    .build() {
}

class DeleteBucketAnalyticsConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketAnalyticsConfiguration", {})
    .n("S3Client", "DeleteBucketAnalyticsConfigurationCommand")
    .sc(DeleteBucketAnalyticsConfiguration$)
    .build() {
}

class DeleteBucketCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucket", {})
    .n("S3Client", "DeleteBucketCommand")
    .sc(DeleteBucket$)
    .build() {
}

class DeleteBucketCorsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketCors", {})
    .n("S3Client", "DeleteBucketCorsCommand")
    .sc(DeleteBucketCors$)
    .build() {
}

class DeleteBucketEncryptionCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketEncryption", {})
    .n("S3Client", "DeleteBucketEncryptionCommand")
    .sc(DeleteBucketEncryption$)
    .build() {
}

class DeleteBucketIntelligentTieringConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketIntelligentTieringConfiguration", {})
    .n("S3Client", "DeleteBucketIntelligentTieringConfigurationCommand")
    .sc(DeleteBucketIntelligentTieringConfiguration$)
    .build() {
}

class DeleteBucketInventoryConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketInventoryConfiguration", {})
    .n("S3Client", "DeleteBucketInventoryConfigurationCommand")
    .sc(DeleteBucketInventoryConfiguration$)
    .build() {
}

class DeleteBucketLifecycleCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketLifecycle", {})
    .n("S3Client", "DeleteBucketLifecycleCommand")
    .sc(DeleteBucketLifecycle$)
    .build() {
}

class DeleteBucketMetadataConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketMetadataConfiguration", {})
    .n("S3Client", "DeleteBucketMetadataConfigurationCommand")
    .sc(DeleteBucketMetadataConfiguration$)
    .build() {
}

class DeleteBucketMetadataTableConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketMetadataTableConfiguration", {})
    .n("S3Client", "DeleteBucketMetadataTableConfigurationCommand")
    .sc(DeleteBucketMetadataTableConfiguration$)
    .build() {
}

class DeleteBucketMetricsConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketMetricsConfiguration", {})
    .n("S3Client", "DeleteBucketMetricsConfigurationCommand")
    .sc(DeleteBucketMetricsConfiguration$)
    .build() {
}

class DeleteBucketOwnershipControlsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketOwnershipControls", {})
    .n("S3Client", "DeleteBucketOwnershipControlsCommand")
    .sc(DeleteBucketOwnershipControls$)
    .build() {
}

class DeleteBucketPolicyCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketPolicy", {})
    .n("S3Client", "DeleteBucketPolicyCommand")
    .sc(DeleteBucketPolicy$)
    .build() {
}

class DeleteBucketReplicationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketReplication", {})
    .n("S3Client", "DeleteBucketReplicationCommand")
    .sc(DeleteBucketReplication$)
    .build() {
}

class DeleteBucketTaggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketTagging", {})
    .n("S3Client", "DeleteBucketTaggingCommand")
    .sc(DeleteBucketTagging$)
    .build() {
}

class DeleteBucketWebsiteCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeleteBucketWebsite", {})
    .n("S3Client", "DeleteBucketWebsiteCommand")
    .sc(DeleteBucketWebsite$)
    .build() {
}

class DeleteObjectCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "DeleteObject", {})
    .n("S3Client", "DeleteObjectCommand")
    .sc(DeleteObject$)
    .build() {
}

class DeleteObjectsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "DeleteObjects", {})
    .n("S3Client", "DeleteObjectsCommand")
    .sc(DeleteObjects$)
    .build() {
}

class DeleteObjectTaggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "DeleteObjectTagging", {})
    .n("S3Client", "DeleteObjectTaggingCommand")
    .sc(DeleteObjectTagging$)
    .build() {
}

class DeletePublicAccessBlockCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "DeletePublicAccessBlock", {})
    .n("S3Client", "DeletePublicAccessBlockCommand")
    .sc(DeletePublicAccessBlock$)
    .build() {
}

class GetBucketAbacCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketAbac", {})
    .n("S3Client", "GetBucketAbacCommand")
    .sc(GetBucketAbac$)
    .build() {
}

class GetBucketAccelerateConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketAccelerateConfiguration", {})
    .n("S3Client", "GetBucketAccelerateConfigurationCommand")
    .sc(GetBucketAccelerateConfiguration$)
    .build() {
}

class GetBucketAclCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketAcl", {})
    .n("S3Client", "GetBucketAclCommand")
    .sc(GetBucketAcl$)
    .build() {
}

class GetBucketAnalyticsConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketAnalyticsConfiguration", {})
    .n("S3Client", "GetBucketAnalyticsConfigurationCommand")
    .sc(GetBucketAnalyticsConfiguration$)
    .build() {
}

class GetBucketCorsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketCors", {})
    .n("S3Client", "GetBucketCorsCommand")
    .sc(GetBucketCors$)
    .build() {
}

class GetBucketEncryptionCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketEncryption", {})
    .n("S3Client", "GetBucketEncryptionCommand")
    .sc(GetBucketEncryption$)
    .build() {
}

class GetBucketIntelligentTieringConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketIntelligentTieringConfiguration", {})
    .n("S3Client", "GetBucketIntelligentTieringConfigurationCommand")
    .sc(GetBucketIntelligentTieringConfiguration$)
    .build() {
}

class GetBucketInventoryConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketInventoryConfiguration", {})
    .n("S3Client", "GetBucketInventoryConfigurationCommand")
    .sc(GetBucketInventoryConfiguration$)
    .build() {
}

class GetBucketLifecycleConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketLifecycleConfiguration", {})
    .n("S3Client", "GetBucketLifecycleConfigurationCommand")
    .sc(GetBucketLifecycleConfiguration$)
    .build() {
}

class GetBucketLocationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketLocation", {})
    .n("S3Client", "GetBucketLocationCommand")
    .sc(GetBucketLocation$)
    .build() {
}

class GetBucketLoggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketLogging", {})
    .n("S3Client", "GetBucketLoggingCommand")
    .sc(GetBucketLogging$)
    .build() {
}

class GetBucketMetadataConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketMetadataConfiguration", {})
    .n("S3Client", "GetBucketMetadataConfigurationCommand")
    .sc(GetBucketMetadataConfiguration$)
    .build() {
}

class GetBucketMetadataTableConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketMetadataTableConfiguration", {})
    .n("S3Client", "GetBucketMetadataTableConfigurationCommand")
    .sc(GetBucketMetadataTableConfiguration$)
    .build() {
}

class GetBucketMetricsConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketMetricsConfiguration", {})
    .n("S3Client", "GetBucketMetricsConfigurationCommand")
    .sc(GetBucketMetricsConfiguration$)
    .build() {
}

class GetBucketNotificationConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketNotificationConfiguration", {})
    .n("S3Client", "GetBucketNotificationConfigurationCommand")
    .sc(GetBucketNotificationConfiguration$)
    .build() {
}

class GetBucketOwnershipControlsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketOwnershipControls", {})
    .n("S3Client", "GetBucketOwnershipControlsCommand")
    .sc(GetBucketOwnershipControls$)
    .build() {
}

class GetBucketPolicyCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketPolicy", {})
    .n("S3Client", "GetBucketPolicyCommand")
    .sc(GetBucketPolicy$)
    .build() {
}

class GetBucketPolicyStatusCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketPolicyStatus", {})
    .n("S3Client", "GetBucketPolicyStatusCommand")
    .sc(GetBucketPolicyStatus$)
    .build() {
}

class GetBucketReplicationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketReplication", {})
    .n("S3Client", "GetBucketReplicationCommand")
    .sc(GetBucketReplication$)
    .build() {
}

class GetBucketRequestPaymentCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketRequestPayment", {})
    .n("S3Client", "GetBucketRequestPaymentCommand")
    .sc(GetBucketRequestPayment$)
    .build() {
}

class GetBucketTaggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketTagging", {})
    .n("S3Client", "GetBucketTaggingCommand")
    .sc(GetBucketTagging$)
    .build() {
}

class GetBucketVersioningCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketVersioning", {})
    .n("S3Client", "GetBucketVersioningCommand")
    .sc(GetBucketVersioning$)
    .build() {
}

class GetBucketWebsiteCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetBucketWebsite", {})
    .n("S3Client", "GetBucketWebsiteCommand")
    .sc(GetBucketWebsite$)
    .build() {
}

class GetObjectAclCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetObjectAcl", {})
    .n("S3Client", "GetObjectAclCommand")
    .sc(GetObjectAcl$)
    .build() {
}

class GetObjectAttributesCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "GetObjectAttributes", {})
    .n("S3Client", "GetObjectAttributesCommand")
    .sc(GetObjectAttributes$)
    .build() {
}

class GetObjectCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestChecksumRequired: false,
            requestValidationModeMember: 'ChecksumMode',
            'responseAlgorithms': ['CRC64NVME', 'CRC32', 'CRC32C', 'SHA256', 'SHA1'],
        }),
        getSsecPlugin(config),
        getS3ExpiresMiddlewarePlugin(),
    ];
})
    .s("AmazonS3", "GetObject", {})
    .n("S3Client", "GetObjectCommand")
    .sc(GetObject$)
    .build() {
}

class GetObjectLegalHoldCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetObjectLegalHold", {})
    .n("S3Client", "GetObjectLegalHoldCommand")
    .sc(GetObjectLegalHold$)
    .build() {
}

class GetObjectLockConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetObjectLockConfiguration", {})
    .n("S3Client", "GetObjectLockConfigurationCommand")
    .sc(GetObjectLockConfiguration$)
    .build() {
}

class GetObjectRetentionCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetObjectRetention", {})
    .n("S3Client", "GetObjectRetentionCommand")
    .sc(GetObjectRetention$)
    .build() {
}

class GetObjectTaggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetObjectTagging", {})
    .n("S3Client", "GetObjectTaggingCommand")
    .sc(GetObjectTagging$)
    .build() {
}

class GetObjectTorrentCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "GetObjectTorrent", {})
    .n("S3Client", "GetObjectTorrentCommand")
    .sc(GetObjectTorrent$)
    .build() {
}

class GetPublicAccessBlockCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "GetPublicAccessBlock", {})
    .n("S3Client", "GetPublicAccessBlockCommand")
    .sc(GetPublicAccessBlock$)
    .build() {
}

class HeadBucketCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "HeadBucket", {})
    .n("S3Client", "HeadBucketCommand")
    .sc(HeadBucket$)
    .build() {
}

class HeadObjectCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
        getS3ExpiresMiddlewarePlugin(),
    ];
})
    .s("AmazonS3", "HeadObject", {})
    .n("S3Client", "HeadObjectCommand")
    .sc(HeadObject$)
    .build() {
}

class ListBucketAnalyticsConfigurationsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListBucketAnalyticsConfigurations", {})
    .n("S3Client", "ListBucketAnalyticsConfigurationsCommand")
    .sc(ListBucketAnalyticsConfigurations$)
    .build() {
}

class ListBucketIntelligentTieringConfigurationsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListBucketIntelligentTieringConfigurations", {})
    .n("S3Client", "ListBucketIntelligentTieringConfigurationsCommand")
    .sc(ListBucketIntelligentTieringConfigurations$)
    .build() {
}

class ListBucketInventoryConfigurationsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListBucketInventoryConfigurations", {})
    .n("S3Client", "ListBucketInventoryConfigurationsCommand")
    .sc(ListBucketInventoryConfigurations$)
    .build() {
}

class ListBucketMetricsConfigurationsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListBucketMetricsConfigurations", {})
    .n("S3Client", "ListBucketMetricsConfigurationsCommand")
    .sc(ListBucketMetricsConfigurations$)
    .build() {
}

class ListBucketsCommand extends Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListBuckets", {})
    .n("S3Client", "ListBucketsCommand")
    .sc(ListBuckets$)
    .build() {
}

class ListDirectoryBucketsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListDirectoryBuckets", {})
    .n("S3Client", "ListDirectoryBucketsCommand")
    .sc(ListDirectoryBuckets$)
    .build() {
}

class ListMultipartUploadsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Prefix: { type: "contextParams", name: "Prefix" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListMultipartUploads", {})
    .n("S3Client", "ListMultipartUploadsCommand")
    .sc(ListMultipartUploads$)
    .build() {
}

class ListObjectsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Prefix: { type: "contextParams", name: "Prefix" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListObjects", {})
    .n("S3Client", "ListObjectsCommand")
    .sc(ListObjects$)
    .build() {
}

class ListObjectsV2Command extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Prefix: { type: "contextParams", name: "Prefix" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListObjectsV2", {})
    .n("S3Client", "ListObjectsV2Command")
    .sc(ListObjectsV2$)
    .build() {
}

class ListObjectVersionsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Prefix: { type: "contextParams", name: "Prefix" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "ListObjectVersions", {})
    .n("S3Client", "ListObjectVersionsCommand")
    .sc(ListObjectVersions$)
    .build() {
}

class ListPartsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "ListParts", {})
    .n("S3Client", "ListPartsCommand")
    .sc(ListParts$)
    .build() {
}

class PutBucketAbacCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: false,
        }),
    ];
})
    .s("AmazonS3", "PutBucketAbac", {})
    .n("S3Client", "PutBucketAbacCommand")
    .sc(PutBucketAbac$)
    .build() {
}

class PutBucketAccelerateConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: false,
        }),
    ];
})
    .s("AmazonS3", "PutBucketAccelerateConfiguration", {})
    .n("S3Client", "PutBucketAccelerateConfigurationCommand")
    .sc(PutBucketAccelerateConfiguration$)
    .build() {
}

class PutBucketAclCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketAcl", {})
    .n("S3Client", "PutBucketAclCommand")
    .sc(PutBucketAcl$)
    .build() {
}

class PutBucketAnalyticsConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "PutBucketAnalyticsConfiguration", {})
    .n("S3Client", "PutBucketAnalyticsConfigurationCommand")
    .sc(PutBucketAnalyticsConfiguration$)
    .build() {
}

class PutBucketCorsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketCors", {})
    .n("S3Client", "PutBucketCorsCommand")
    .sc(PutBucketCors$)
    .build() {
}

class PutBucketEncryptionCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketEncryption", {})
    .n("S3Client", "PutBucketEncryptionCommand")
    .sc(PutBucketEncryption$)
    .build() {
}

class PutBucketIntelligentTieringConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "PutBucketIntelligentTieringConfiguration", {})
    .n("S3Client", "PutBucketIntelligentTieringConfigurationCommand")
    .sc(PutBucketIntelligentTieringConfiguration$)
    .build() {
}

class PutBucketInventoryConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "PutBucketInventoryConfiguration", {})
    .n("S3Client", "PutBucketInventoryConfigurationCommand")
    .sc(PutBucketInventoryConfiguration$)
    .build() {
}

class PutBucketLifecycleConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "PutBucketLifecycleConfiguration", {})
    .n("S3Client", "PutBucketLifecycleConfigurationCommand")
    .sc(PutBucketLifecycleConfiguration$)
    .build() {
}

class PutBucketLoggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketLogging", {})
    .n("S3Client", "PutBucketLoggingCommand")
    .sc(PutBucketLogging$)
    .build() {
}

class PutBucketMetricsConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "PutBucketMetricsConfiguration", {})
    .n("S3Client", "PutBucketMetricsConfigurationCommand")
    .sc(PutBucketMetricsConfiguration$)
    .build() {
}

class PutBucketNotificationConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "PutBucketNotificationConfiguration", {})
    .n("S3Client", "PutBucketNotificationConfigurationCommand")
    .sc(PutBucketNotificationConfiguration$)
    .build() {
}

class PutBucketOwnershipControlsCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketOwnershipControls", {})
    .n("S3Client", "PutBucketOwnershipControlsCommand")
    .sc(PutBucketOwnershipControls$)
    .build() {
}

class PutBucketPolicyCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketPolicy", {})
    .n("S3Client", "PutBucketPolicyCommand")
    .sc(PutBucketPolicy$)
    .build() {
}

class PutBucketReplicationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketReplication", {})
    .n("S3Client", "PutBucketReplicationCommand")
    .sc(PutBucketReplication$)
    .build() {
}

class PutBucketRequestPaymentCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketRequestPayment", {})
    .n("S3Client", "PutBucketRequestPaymentCommand")
    .sc(PutBucketRequestPayment$)
    .build() {
}

class PutBucketTaggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketTagging", {})
    .n("S3Client", "PutBucketTaggingCommand")
    .sc(PutBucketTagging$)
    .build() {
}

class PutBucketVersioningCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketVersioning", {})
    .n("S3Client", "PutBucketVersioningCommand")
    .sc(PutBucketVersioning$)
    .build() {
}

class PutBucketWebsiteCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutBucketWebsite", {})
    .n("S3Client", "PutBucketWebsiteCommand")
    .sc(PutBucketWebsite$)
    .build() {
}

class PutObjectAclCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "PutObjectAcl", {})
    .n("S3Client", "PutObjectAclCommand")
    .sc(PutObjectAcl$)
    .build() {
}

class PutObjectCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: false,
        }),
        getCheckContentLengthHeaderPlugin(),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "PutObject", {})
    .n("S3Client", "PutObjectCommand")
    .sc(PutObject$)
    .build() {
}

class PutObjectLegalHoldCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "PutObjectLegalHold", {})
    .n("S3Client", "PutObjectLegalHoldCommand")
    .sc(PutObjectLegalHold$)
    .build() {
}

class PutObjectLockConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "PutObjectLockConfiguration", {})
    .n("S3Client", "PutObjectLockConfigurationCommand")
    .sc(PutObjectLockConfiguration$)
    .build() {
}

class PutObjectRetentionCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "PutObjectRetention", {})
    .n("S3Client", "PutObjectRetentionCommand")
    .sc(PutObjectRetention$)
    .build() {
}

class PutObjectTaggingCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "PutObjectTagging", {})
    .n("S3Client", "PutObjectTaggingCommand")
    .sc(PutObjectTagging$)
    .build() {
}

class PutPublicAccessBlockCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "PutPublicAccessBlock", {})
    .n("S3Client", "PutPublicAccessBlockCommand")
    .sc(PutPublicAccessBlock$)
    .build() {
}

class RenameObjectCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "RenameObject", {})
    .n("S3Client", "RenameObjectCommand")
    .sc(RenameObject$)
    .build() {
}

class RestoreObjectCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: false,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "RestoreObject", {})
    .n("S3Client", "RestoreObjectCommand")
    .sc(RestoreObject$)
    .build() {
}

class SelectObjectContentCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "SelectObjectContent", {
    eventStream: {
        output: true,
    },
})
    .n("S3Client", "SelectObjectContentCommand")
    .sc(SelectObjectContent$)
    .build() {
}

class UpdateBucketMetadataInventoryTableConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "UpdateBucketMetadataInventoryTableConfiguration", {})
    .n("S3Client", "UpdateBucketMetadataInventoryTableConfigurationCommand")
    .sc(UpdateBucketMetadataInventoryTableConfiguration$)
    .build() {
}

class UpdateBucketMetadataJournalTableConfigurationCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseS3ExpressControlEndpoint: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
    ];
})
    .s("AmazonS3", "UpdateBucketMetadataJournalTableConfiguration", {})
    .n("S3Client", "UpdateBucketMetadataJournalTableConfigurationCommand")
    .sc(UpdateBucketMetadataJournalTableConfiguration$)
    .build() {
}

class UpdateObjectEncryptionCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: true,
        }),
        getThrow200ExceptionsPlugin(config),
    ];
})
    .s("AmazonS3", "UpdateObjectEncryption", {})
    .n("S3Client", "UpdateObjectEncryptionCommand")
    .sc(UpdateObjectEncryption$)
    .build() {
}

class UploadPartCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    Bucket: { type: "contextParams", name: "Bucket" },
    Key: { type: "contextParams", name: "Key" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getFlexibleChecksumsPlugin(config, {
            requestAlgorithmMember: { 'httpHeader': 'x-amz-sdk-checksum-algorithm', 'name': 'ChecksumAlgorithm' },
            requestChecksumRequired: false,
        }),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "UploadPart", {})
    .n("S3Client", "UploadPartCommand")
    .sc(UploadPart$)
    .build() {
}

class UploadPartCopyCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    DisableS3ExpressSessionAuth: { type: "staticContextParams", value: true },
    Bucket: { type: "contextParams", name: "Bucket" },
})
    .m(function (Command, cs, config, o) {
    return [
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
        getThrow200ExceptionsPlugin(config),
        getSsecPlugin(config),
    ];
})
    .s("AmazonS3", "UploadPartCopy", {})
    .n("S3Client", "UploadPartCopyCommand")
    .sc(UploadPartCopy$)
    .build() {
}

class WriteGetObjectResponseCommand extends Command
    .classBuilder()
    .ep({
    ...commonParams,
    UseObjectLambdaEndpoint: { type: "staticContextParams", value: true },
})
    .m(function (Command, cs, config, o) {
    return [getEndpointPlugin(config, Command.getEndpointParameterInstructions())];
})
    .s("AmazonS3", "WriteGetObjectResponse", {})
    .n("S3Client", "WriteGetObjectResponseCommand")
    .sc(WriteGetObjectResponse$)
    .build() {
}

const paginateListBuckets = createPaginator(S3Client, ListBucketsCommand, "ContinuationToken", "ContinuationToken", "MaxBuckets");

const paginateListDirectoryBuckets = createPaginator(S3Client, ListDirectoryBucketsCommand, "ContinuationToken", "ContinuationToken", "MaxDirectoryBuckets");

const paginateListObjectsV2 = createPaginator(S3Client, ListObjectsV2Command, "ContinuationToken", "NextContinuationToken", "MaxKeys");

const paginateListParts = createPaginator(S3Client, ListPartsCommand, "PartNumberMarker", "NextPartNumberMarker", "MaxParts");

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "[Circular]";
            }
            seen.add(value);
        }
        return value;
    };
};

const sleep = (seconds) => {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

const waiterServiceDefaults = {
    minDelay: 2,
    maxDelay: 120,
};
var WaiterState;
(function (WaiterState) {
    WaiterState["ABORTED"] = "ABORTED";
    WaiterState["FAILURE"] = "FAILURE";
    WaiterState["SUCCESS"] = "SUCCESS";
    WaiterState["RETRY"] = "RETRY";
    WaiterState["TIMEOUT"] = "TIMEOUT";
})(WaiterState || (WaiterState = {}));
const checkExceptions = (result) => {
    if (result.state === WaiterState.ABORTED) {
        const abortError = new Error(`${JSON.stringify({
            ...result,
            reason: "Request was aborted",
        }, getCircularReplacer())}`);
        abortError.name = "AbortError";
        throw abortError;
    }
    else if (result.state === WaiterState.TIMEOUT) {
        const timeoutError = new Error(`${JSON.stringify({
            ...result,
            reason: "Waiter has timed out",
        }, getCircularReplacer())}`);
        timeoutError.name = "TimeoutError";
        throw timeoutError;
    }
    else if (result.state !== WaiterState.SUCCESS) {
        throw new Error(`${JSON.stringify(result, getCircularReplacer())}`);
    }
    return result;
};

const exponentialBackoffWithJitter = (minDelay, maxDelay, attemptCeiling, attempt) => {
    if (attempt > attemptCeiling)
        return maxDelay;
    const delay = minDelay * 2 ** (attempt - 1);
    return randomInRange(minDelay, delay);
};
const randomInRange = (min, max) => min + Math.random() * (max - min);
const runPolling = async ({ minDelay, maxDelay, maxWaitTime, abortController, client, abortSignal }, input, acceptorChecks) => {
    const observedResponses = {};
    const { state, reason } = await acceptorChecks(client, input);
    if (reason) {
        const message = createMessageFromResponse(reason);
        observedResponses[message] |= 0;
        observedResponses[message] += 1;
    }
    if (state !== WaiterState.RETRY) {
        return { state, reason, observedResponses };
    }
    let currentAttempt = 1;
    const waitUntil = Date.now() + maxWaitTime * 1000;
    const attemptCeiling = Math.log(maxDelay / minDelay) / Math.log(2) + 1;
    while (true) {
        if (abortController?.signal?.aborted || abortSignal?.aborted) {
            const message = "AbortController signal aborted.";
            observedResponses[message] |= 0;
            observedResponses[message] += 1;
            return { state: WaiterState.ABORTED, observedResponses };
        }
        const delay = exponentialBackoffWithJitter(minDelay, maxDelay, attemptCeiling, currentAttempt);
        if (Date.now() + delay * 1000 > waitUntil) {
            return { state: WaiterState.TIMEOUT, observedResponses };
        }
        await sleep(delay);
        const { state, reason } = await acceptorChecks(client, input);
        if (reason) {
            const message = createMessageFromResponse(reason);
            observedResponses[message] |= 0;
            observedResponses[message] += 1;
        }
        if (state !== WaiterState.RETRY) {
            return { state, reason, observedResponses };
        }
        currentAttempt += 1;
    }
};
const createMessageFromResponse = (reason) => {
    if (reason?.$responseBodyText) {
        return `Deserialization error for body: ${reason.$responseBodyText}`;
    }
    if (reason?.$metadata?.httpStatusCode) {
        if (reason.$response || reason.message) {
            return `${reason.$response?.statusCode ?? reason.$metadata.httpStatusCode ?? "Unknown"}: ${reason.message}`;
        }
        return `${reason.$metadata.httpStatusCode}: OK`;
    }
    return String(reason?.message ?? JSON.stringify(reason, getCircularReplacer()) ?? "Unknown");
};

const validateWaiterOptions = (options) => {
    if (options.maxWaitTime <= 0) {
        throw new Error(`WaiterConfiguration.maxWaitTime must be greater than 0`);
    }
    else if (options.minDelay <= 0) {
        throw new Error(`WaiterConfiguration.minDelay must be greater than 0`);
    }
    else if (options.maxDelay <= 0) {
        throw new Error(`WaiterConfiguration.maxDelay must be greater than 0`);
    }
    else if (options.maxWaitTime <= options.minDelay) {
        throw new Error(`WaiterConfiguration.maxWaitTime [${options.maxWaitTime}] must be greater than WaiterConfiguration.minDelay [${options.minDelay}] for this waiter`);
    }
    else if (options.maxDelay < options.minDelay) {
        throw new Error(`WaiterConfiguration.maxDelay [${options.maxDelay}] must be greater than WaiterConfiguration.minDelay [${options.minDelay}] for this waiter`);
    }
};

const abortTimeout = (abortSignal) => {
    let onAbort;
    const promise = new Promise((resolve) => {
        onAbort = () => resolve({ state: WaiterState.ABORTED });
        if (typeof abortSignal.addEventListener === "function") {
            abortSignal.addEventListener("abort", onAbort);
        }
        else {
            abortSignal.onabort = onAbort;
        }
    });
    return {
        clearListener() {
            if (typeof abortSignal.removeEventListener === "function") {
                abortSignal.removeEventListener("abort", onAbort);
            }
        },
        aborted: promise,
    };
};
const createWaiter = async (options, input, acceptorChecks) => {
    const params = {
        ...waiterServiceDefaults,
        ...options,
    };
    validateWaiterOptions(params);
    const exitConditions = [runPolling(params, input, acceptorChecks)];
    const finalize = [];
    if (options.abortSignal) {
        const { aborted, clearListener } = abortTimeout(options.abortSignal);
        finalize.push(clearListener);
        exitConditions.push(aborted);
    }
    if (options.abortController?.signal) {
        const { aborted, clearListener } = abortTimeout(options.abortController.signal);
        finalize.push(clearListener);
        exitConditions.push(aborted);
    }
    return Promise.race(exitConditions).then((result) => {
        for (const fn of finalize) {
            fn();
        }
        return result;
    });
};

const checkState$3 = async (client, input) => {
    let reason;
    try {
        let result = await client.send(new HeadBucketCommand(input));
        reason = result;
        return { state: WaiterState.SUCCESS, reason };
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "NotFound") {
            return { state: WaiterState.RETRY, reason };
        }
    }
    return { state: WaiterState.RETRY, reason };
};
const waitForBucketExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    return createWaiter({ ...serviceDefaults, ...params }, input, checkState$3);
};
const waitUntilBucketExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState$3);
    return checkExceptions(result);
};

const checkState$2 = async (client, input) => {
    let reason;
    try {
        let result = await client.send(new HeadBucketCommand(input));
        reason = result;
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "NotFound") {
            return { state: WaiterState.SUCCESS, reason };
        }
    }
    return { state: WaiterState.RETRY, reason };
};
const waitForBucketNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    return createWaiter({ ...serviceDefaults, ...params }, input, checkState$2);
};
const waitUntilBucketNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState$2);
    return checkExceptions(result);
};

const checkState$1 = async (client, input) => {
    let reason;
    try {
        let result = await client.send(new HeadObjectCommand(input));
        reason = result;
        return { state: WaiterState.SUCCESS, reason };
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "NotFound") {
            return { state: WaiterState.RETRY, reason };
        }
    }
    return { state: WaiterState.RETRY, reason };
};
const waitForObjectExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    return createWaiter({ ...serviceDefaults, ...params }, input, checkState$1);
};
const waitUntilObjectExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState$1);
    return checkExceptions(result);
};

const checkState = async (client, input) => {
    let reason;
    try {
        let result = await client.send(new HeadObjectCommand(input));
        reason = result;
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "NotFound") {
            return { state: WaiterState.SUCCESS, reason };
        }
    }
    return { state: WaiterState.RETRY, reason };
};
const waitForObjectNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    return createWaiter({ ...serviceDefaults, ...params }, input, checkState);
};
const waitUntilObjectNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 5, maxDelay: 120 };
    const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState);
    return checkExceptions(result);
};

const commands = {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CopyObjectCommand,
    CreateBucketCommand,
    CreateBucketMetadataConfigurationCommand,
    CreateBucketMetadataTableConfigurationCommand,
    CreateMultipartUploadCommand,
    CreateSessionCommand,
    DeleteBucketCommand,
    DeleteBucketAnalyticsConfigurationCommand,
    DeleteBucketCorsCommand,
    DeleteBucketEncryptionCommand,
    DeleteBucketIntelligentTieringConfigurationCommand,
    DeleteBucketInventoryConfigurationCommand,
    DeleteBucketLifecycleCommand,
    DeleteBucketMetadataConfigurationCommand,
    DeleteBucketMetadataTableConfigurationCommand,
    DeleteBucketMetricsConfigurationCommand,
    DeleteBucketOwnershipControlsCommand,
    DeleteBucketPolicyCommand,
    DeleteBucketReplicationCommand,
    DeleteBucketTaggingCommand,
    DeleteBucketWebsiteCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    DeleteObjectTaggingCommand,
    DeletePublicAccessBlockCommand,
    GetBucketAbacCommand,
    GetBucketAccelerateConfigurationCommand,
    GetBucketAclCommand,
    GetBucketAnalyticsConfigurationCommand,
    GetBucketCorsCommand,
    GetBucketEncryptionCommand,
    GetBucketIntelligentTieringConfigurationCommand,
    GetBucketInventoryConfigurationCommand,
    GetBucketLifecycleConfigurationCommand,
    GetBucketLocationCommand,
    GetBucketLoggingCommand,
    GetBucketMetadataConfigurationCommand,
    GetBucketMetadataTableConfigurationCommand,
    GetBucketMetricsConfigurationCommand,
    GetBucketNotificationConfigurationCommand,
    GetBucketOwnershipControlsCommand,
    GetBucketPolicyCommand,
    GetBucketPolicyStatusCommand,
    GetBucketReplicationCommand,
    GetBucketRequestPaymentCommand,
    GetBucketTaggingCommand,
    GetBucketVersioningCommand,
    GetBucketWebsiteCommand,
    GetObjectCommand,
    GetObjectAclCommand,
    GetObjectAttributesCommand,
    GetObjectLegalHoldCommand,
    GetObjectLockConfigurationCommand,
    GetObjectRetentionCommand,
    GetObjectTaggingCommand,
    GetObjectTorrentCommand,
    GetPublicAccessBlockCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    ListBucketAnalyticsConfigurationsCommand,
    ListBucketIntelligentTieringConfigurationsCommand,
    ListBucketInventoryConfigurationsCommand,
    ListBucketMetricsConfigurationsCommand,
    ListBucketsCommand,
    ListDirectoryBucketsCommand,
    ListMultipartUploadsCommand,
    ListObjectsCommand,
    ListObjectsV2Command,
    ListObjectVersionsCommand,
    ListPartsCommand,
    PutBucketAbacCommand,
    PutBucketAccelerateConfigurationCommand,
    PutBucketAclCommand,
    PutBucketAnalyticsConfigurationCommand,
    PutBucketCorsCommand,
    PutBucketEncryptionCommand,
    PutBucketIntelligentTieringConfigurationCommand,
    PutBucketInventoryConfigurationCommand,
    PutBucketLifecycleConfigurationCommand,
    PutBucketLoggingCommand,
    PutBucketMetricsConfigurationCommand,
    PutBucketNotificationConfigurationCommand,
    PutBucketOwnershipControlsCommand,
    PutBucketPolicyCommand,
    PutBucketReplicationCommand,
    PutBucketRequestPaymentCommand,
    PutBucketTaggingCommand,
    PutBucketVersioningCommand,
    PutBucketWebsiteCommand,
    PutObjectCommand,
    PutObjectAclCommand,
    PutObjectLegalHoldCommand,
    PutObjectLockConfigurationCommand,
    PutObjectRetentionCommand,
    PutObjectTaggingCommand,
    PutPublicAccessBlockCommand,
    RenameObjectCommand,
    RestoreObjectCommand,
    SelectObjectContentCommand,
    UpdateBucketMetadataInventoryTableConfigurationCommand,
    UpdateBucketMetadataJournalTableConfigurationCommand,
    UpdateObjectEncryptionCommand,
    UploadPartCommand,
    UploadPartCopyCommand,
    WriteGetObjectResponseCommand,
};
const paginators = {
    paginateListBuckets,
    paginateListDirectoryBuckets,
    paginateListObjectsV2,
    paginateListParts,
};
const waiters = {
    waitUntilBucketExists,
    waitUntilBucketNotExists,
    waitUntilObjectExists,
    waitUntilObjectNotExists,
};
class S3 extends S3Client {
}
createAggregatedClient(commands, S3, { paginators, waiters });

const BucketAbacStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const RequestCharged = {
    requester: "requester",
};
const RequestPayer = {
    requester: "requester",
};
const BucketAccelerateStatus = {
    Enabled: "Enabled",
    Suspended: "Suspended",
};
const Type = {
    AmazonCustomerByEmail: "AmazonCustomerByEmail",
    CanonicalUser: "CanonicalUser",
    Group: "Group",
};
const Permission = {
    FULL_CONTROL: "FULL_CONTROL",
    READ: "READ",
    READ_ACP: "READ_ACP",
    WRITE: "WRITE",
    WRITE_ACP: "WRITE_ACP",
};
const OwnerOverride = {
    Destination: "Destination",
};
const ChecksumType = {
    COMPOSITE: "COMPOSITE",
    FULL_OBJECT: "FULL_OBJECT",
};
const ServerSideEncryption = {
    AES256: "AES256",
    aws_fsx: "aws:fsx",
    aws_kms: "aws:kms",
    aws_kms_dsse: "aws:kms:dsse",
};
const ObjectCannedACL = {
    authenticated_read: "authenticated-read",
    aws_exec_read: "aws-exec-read",
    bucket_owner_full_control: "bucket-owner-full-control",
    bucket_owner_read: "bucket-owner-read",
    private: "private",
    public_read: "public-read",
    public_read_write: "public-read-write",
};
const ChecksumAlgorithm = {
    CRC32: "CRC32",
    CRC32C: "CRC32C",
    CRC64NVME: "CRC64NVME",
    SHA1: "SHA1",
    SHA256: "SHA256",
};
const MetadataDirective = {
    COPY: "COPY",
    REPLACE: "REPLACE",
};
const ObjectLockLegalHoldStatus = {
    OFF: "OFF",
    ON: "ON",
};
const ObjectLockMode = {
    COMPLIANCE: "COMPLIANCE",
    GOVERNANCE: "GOVERNANCE",
};
const StorageClass = {
    DEEP_ARCHIVE: "DEEP_ARCHIVE",
    EXPRESS_ONEZONE: "EXPRESS_ONEZONE",
    FSX_ONTAP: "FSX_ONTAP",
    FSX_OPENZFS: "FSX_OPENZFS",
    GLACIER: "GLACIER",
    GLACIER_IR: "GLACIER_IR",
    INTELLIGENT_TIERING: "INTELLIGENT_TIERING",
    ONEZONE_IA: "ONEZONE_IA",
    OUTPOSTS: "OUTPOSTS",
    REDUCED_REDUNDANCY: "REDUCED_REDUNDANCY",
    SNOW: "SNOW",
    STANDARD: "STANDARD",
    STANDARD_IA: "STANDARD_IA",
};
const TaggingDirective = {
    COPY: "COPY",
    REPLACE: "REPLACE",
};
const BucketCannedACL = {
    authenticated_read: "authenticated-read",
    private: "private",
    public_read: "public-read",
    public_read_write: "public-read-write",
};
const BucketNamespace = {
    ACCOUNT_REGIONAL: "account-regional",
    GLOBAL: "global",
};
const DataRedundancy = {
    SingleAvailabilityZone: "SingleAvailabilityZone",
    SingleLocalZone: "SingleLocalZone",
};
const BucketType = {
    Directory: "Directory",
};
const LocationType = {
    AvailabilityZone: "AvailabilityZone",
    LocalZone: "LocalZone",
};
const BucketLocationConstraint = {
    EU: "EU",
    af_south_1: "af-south-1",
    ap_east_1: "ap-east-1",
    ap_northeast_1: "ap-northeast-1",
    ap_northeast_2: "ap-northeast-2",
    ap_northeast_3: "ap-northeast-3",
    ap_south_1: "ap-south-1",
    ap_south_2: "ap-south-2",
    ap_southeast_1: "ap-southeast-1",
    ap_southeast_2: "ap-southeast-2",
    ap_southeast_3: "ap-southeast-3",
    ap_southeast_4: "ap-southeast-4",
    ap_southeast_5: "ap-southeast-5",
    ca_central_1: "ca-central-1",
    cn_north_1: "cn-north-1",
    cn_northwest_1: "cn-northwest-1",
    eu_central_1: "eu-central-1",
    eu_central_2: "eu-central-2",
    eu_north_1: "eu-north-1",
    eu_south_1: "eu-south-1",
    eu_south_2: "eu-south-2",
    eu_west_1: "eu-west-1",
    eu_west_2: "eu-west-2",
    eu_west_3: "eu-west-3",
    il_central_1: "il-central-1",
    me_central_1: "me-central-1",
    me_south_1: "me-south-1",
    sa_east_1: "sa-east-1",
    us_east_2: "us-east-2",
    us_gov_east_1: "us-gov-east-1",
    us_gov_west_1: "us-gov-west-1",
    us_west_1: "us-west-1",
    us_west_2: "us-west-2",
};
const ObjectOwnership = {
    BucketOwnerEnforced: "BucketOwnerEnforced",
    BucketOwnerPreferred: "BucketOwnerPreferred",
    ObjectWriter: "ObjectWriter",
};
const InventoryConfigurationState = {
    DISABLED: "DISABLED",
    ENABLED: "ENABLED",
};
const TableSseAlgorithm = {
    AES256: "AES256",
    aws_kms: "aws:kms",
};
const ExpirationState = {
    DISABLED: "DISABLED",
    ENABLED: "ENABLED",
};
const SessionMode = {
    ReadOnly: "ReadOnly",
    ReadWrite: "ReadWrite",
};
const AnalyticsS3ExportFileFormat = {
    CSV: "CSV",
};
const StorageClassAnalysisSchemaVersion = {
    V_1: "V_1",
};
const EncryptionType = {
    NONE: "NONE",
    SSE_C: "SSE-C",
};
const IntelligentTieringStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const IntelligentTieringAccessTier = {
    ARCHIVE_ACCESS: "ARCHIVE_ACCESS",
    DEEP_ARCHIVE_ACCESS: "DEEP_ARCHIVE_ACCESS",
};
const InventoryFormat = {
    CSV: "CSV",
    ORC: "ORC",
    Parquet: "Parquet",
};
const InventoryIncludedObjectVersions = {
    All: "All",
    Current: "Current",
};
const InventoryOptionalField = {
    BucketKeyStatus: "BucketKeyStatus",
    ChecksumAlgorithm: "ChecksumAlgorithm",
    ETag: "ETag",
    EncryptionStatus: "EncryptionStatus",
    IntelligentTieringAccessTier: "IntelligentTieringAccessTier",
    IsMultipartUploaded: "IsMultipartUploaded",
    LastModifiedDate: "LastModifiedDate",
    LifecycleExpirationDate: "LifecycleExpirationDate",
    ObjectAccessControlList: "ObjectAccessControlList",
    ObjectLockLegalHoldStatus: "ObjectLockLegalHoldStatus",
    ObjectLockMode: "ObjectLockMode",
    ObjectLockRetainUntilDate: "ObjectLockRetainUntilDate",
    ObjectOwner: "ObjectOwner",
    ReplicationStatus: "ReplicationStatus",
    Size: "Size",
    StorageClass: "StorageClass",
};
const InventoryFrequency = {
    Daily: "Daily",
    Weekly: "Weekly",
};
const TransitionStorageClass = {
    DEEP_ARCHIVE: "DEEP_ARCHIVE",
    GLACIER: "GLACIER",
    GLACIER_IR: "GLACIER_IR",
    INTELLIGENT_TIERING: "INTELLIGENT_TIERING",
    ONEZONE_IA: "ONEZONE_IA",
    STANDARD_IA: "STANDARD_IA",
};
const ExpirationStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const TransitionDefaultMinimumObjectSize = {
    all_storage_classes_128K: "all_storage_classes_128K",
    varies_by_storage_class: "varies_by_storage_class",
};
const BucketLogsPermission = {
    FULL_CONTROL: "FULL_CONTROL",
    READ: "READ",
    WRITE: "WRITE",
};
const PartitionDateSource = {
    DeliveryTime: "DeliveryTime",
    EventTime: "EventTime",
};
const S3TablesBucketType = {
    aws: "aws",
    customer: "customer",
};
const Event = {
    s3_IntelligentTiering: "s3:IntelligentTiering",
    s3_LifecycleExpiration_: "s3:LifecycleExpiration:*",
    s3_LifecycleExpiration_Delete: "s3:LifecycleExpiration:Delete",
    s3_LifecycleExpiration_DeleteMarkerCreated: "s3:LifecycleExpiration:DeleteMarkerCreated",
    s3_LifecycleTransition: "s3:LifecycleTransition",
    s3_ObjectAcl_Put: "s3:ObjectAcl:Put",
    s3_ObjectCreated_: "s3:ObjectCreated:*",
    s3_ObjectCreated_CompleteMultipartUpload: "s3:ObjectCreated:CompleteMultipartUpload",
    s3_ObjectCreated_Copy: "s3:ObjectCreated:Copy",
    s3_ObjectCreated_Post: "s3:ObjectCreated:Post",
    s3_ObjectCreated_Put: "s3:ObjectCreated:Put",
    s3_ObjectRemoved_: "s3:ObjectRemoved:*",
    s3_ObjectRemoved_Delete: "s3:ObjectRemoved:Delete",
    s3_ObjectRemoved_DeleteMarkerCreated: "s3:ObjectRemoved:DeleteMarkerCreated",
    s3_ObjectRestore_: "s3:ObjectRestore:*",
    s3_ObjectRestore_Completed: "s3:ObjectRestore:Completed",
    s3_ObjectRestore_Delete: "s3:ObjectRestore:Delete",
    s3_ObjectRestore_Post: "s3:ObjectRestore:Post",
    s3_ObjectTagging_: "s3:ObjectTagging:*",
    s3_ObjectTagging_Delete: "s3:ObjectTagging:Delete",
    s3_ObjectTagging_Put: "s3:ObjectTagging:Put",
    s3_ReducedRedundancyLostObject: "s3:ReducedRedundancyLostObject",
    s3_Replication_: "s3:Replication:*",
    s3_Replication_OperationFailedReplication: "s3:Replication:OperationFailedReplication",
    s3_Replication_OperationMissedThreshold: "s3:Replication:OperationMissedThreshold",
    s3_Replication_OperationNotTracked: "s3:Replication:OperationNotTracked",
    s3_Replication_OperationReplicatedAfterThreshold: "s3:Replication:OperationReplicatedAfterThreshold",
};
const FilterRuleName = {
    prefix: "prefix",
    suffix: "suffix",
};
const DeleteMarkerReplicationStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const MetricsStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const ReplicationTimeStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const ExistingObjectReplicationStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const ReplicaModificationsStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const SseKmsEncryptedObjectsStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const ReplicationRuleStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const Payer = {
    BucketOwner: "BucketOwner",
    Requester: "Requester",
};
const MFADeleteStatus = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const BucketVersioningStatus = {
    Enabled: "Enabled",
    Suspended: "Suspended",
};
const Protocol = {
    http: "http",
    https: "https",
};
const ReplicationStatus = {
    COMPLETE: "COMPLETE",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    PENDING: "PENDING",
    REPLICA: "REPLICA",
};
const ChecksumMode = {
    ENABLED: "ENABLED",
};
const ObjectAttributes = {
    CHECKSUM: "Checksum",
    ETAG: "ETag",
    OBJECT_PARTS: "ObjectParts",
    OBJECT_SIZE: "ObjectSize",
    STORAGE_CLASS: "StorageClass",
};
const ObjectLockEnabled = {
    Enabled: "Enabled",
};
const ObjectLockRetentionMode = {
    COMPLIANCE: "COMPLIANCE",
    GOVERNANCE: "GOVERNANCE",
};
const ArchiveStatus = {
    ARCHIVE_ACCESS: "ARCHIVE_ACCESS",
    DEEP_ARCHIVE_ACCESS: "DEEP_ARCHIVE_ACCESS",
};
const EncodingType = {
    url: "url",
};
const ObjectStorageClass = {
    DEEP_ARCHIVE: "DEEP_ARCHIVE",
    EXPRESS_ONEZONE: "EXPRESS_ONEZONE",
    FSX_ONTAP: "FSX_ONTAP",
    FSX_OPENZFS: "FSX_OPENZFS",
    GLACIER: "GLACIER",
    GLACIER_IR: "GLACIER_IR",
    INTELLIGENT_TIERING: "INTELLIGENT_TIERING",
    ONEZONE_IA: "ONEZONE_IA",
    OUTPOSTS: "OUTPOSTS",
    REDUCED_REDUNDANCY: "REDUCED_REDUNDANCY",
    SNOW: "SNOW",
    STANDARD: "STANDARD",
    STANDARD_IA: "STANDARD_IA",
};
const OptionalObjectAttributes = {
    RESTORE_STATUS: "RestoreStatus",
};
const ObjectVersionStorageClass = {
    STANDARD: "STANDARD",
};
const MFADelete = {
    Disabled: "Disabled",
    Enabled: "Enabled",
};
const Tier = {
    Bulk: "Bulk",
    Expedited: "Expedited",
    Standard: "Standard",
};
const ExpressionType = {
    SQL: "SQL",
};
const CompressionType = {
    BZIP2: "BZIP2",
    GZIP: "GZIP",
    NONE: "NONE",
};
const FileHeaderInfo = {
    IGNORE: "IGNORE",
    NONE: "NONE",
    USE: "USE",
};
const JSONType = {
    DOCUMENT: "DOCUMENT",
    LINES: "LINES",
};
const QuoteFields = {
    ALWAYS: "ALWAYS",
    ASNEEDED: "ASNEEDED",
};
const RestoreRequestType = {
    SELECT: "SELECT",
};

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    $Command: Command,
    AbacStatus$: AbacStatus$,
    AbortIncompleteMultipartUpload$: AbortIncompleteMultipartUpload$,
    AbortMultipartUpload$: AbortMultipartUpload$,
    AbortMultipartUploadCommand: AbortMultipartUploadCommand,
    AbortMultipartUploadOutput$: AbortMultipartUploadOutput$,
    AbortMultipartUploadRequest$: AbortMultipartUploadRequest$,
    AccelerateConfiguration$: AccelerateConfiguration$,
    AccessControlPolicy$: AccessControlPolicy$,
    AccessControlTranslation$: AccessControlTranslation$,
    AccessDenied: AccessDenied,
    AccessDenied$: AccessDenied$,
    AnalyticsAndOperator$: AnalyticsAndOperator$,
    AnalyticsConfiguration$: AnalyticsConfiguration$,
    AnalyticsExportDestination$: AnalyticsExportDestination$,
    AnalyticsFilter$: AnalyticsFilter$,
    AnalyticsS3BucketDestination$: AnalyticsS3BucketDestination$,
    AnalyticsS3ExportFileFormat: AnalyticsS3ExportFileFormat,
    ArchiveStatus: ArchiveStatus,
    BlockedEncryptionTypes$: BlockedEncryptionTypes$,
    Bucket$: Bucket$,
    BucketAbacStatus: BucketAbacStatus,
    BucketAccelerateStatus: BucketAccelerateStatus,
    BucketAlreadyExists: BucketAlreadyExists,
    BucketAlreadyExists$: BucketAlreadyExists$,
    BucketAlreadyOwnedByYou: BucketAlreadyOwnedByYou,
    BucketAlreadyOwnedByYou$: BucketAlreadyOwnedByYou$,
    BucketCannedACL: BucketCannedACL,
    BucketInfo$: BucketInfo$,
    BucketLifecycleConfiguration$: BucketLifecycleConfiguration$,
    BucketLocationConstraint: BucketLocationConstraint,
    BucketLoggingStatus$: BucketLoggingStatus$,
    BucketLogsPermission: BucketLogsPermission,
    BucketNamespace: BucketNamespace,
    BucketType: BucketType,
    BucketVersioningStatus: BucketVersioningStatus,
    CORSConfiguration$: CORSConfiguration$,
    CORSRule$: CORSRule$,
    CSVInput$: CSVInput$,
    CSVOutput$: CSVOutput$,
    Checksum$: Checksum$,
    ChecksumAlgorithm: ChecksumAlgorithm,
    ChecksumMode: ChecksumMode,
    ChecksumType: ChecksumType,
    CommonPrefix$: CommonPrefix$,
    CompleteMultipartUpload$: CompleteMultipartUpload$,
    CompleteMultipartUploadCommand: CompleteMultipartUploadCommand,
    CompleteMultipartUploadOutput$: CompleteMultipartUploadOutput$,
    CompleteMultipartUploadRequest$: CompleteMultipartUploadRequest$,
    CompletedMultipartUpload$: CompletedMultipartUpload$,
    CompletedPart$: CompletedPart$,
    CompressionType: CompressionType,
    Condition$: Condition$,
    ContinuationEvent$: ContinuationEvent$,
    CopyObject$: CopyObject$,
    CopyObjectCommand: CopyObjectCommand,
    CopyObjectOutput$: CopyObjectOutput$,
    CopyObjectRequest$: CopyObjectRequest$,
    CopyObjectResult$: CopyObjectResult$,
    CopyPartResult$: CopyPartResult$,
    CreateBucket$: CreateBucket$,
    CreateBucketCommand: CreateBucketCommand,
    CreateBucketConfiguration$: CreateBucketConfiguration$,
    CreateBucketMetadataConfiguration$: CreateBucketMetadataConfiguration$,
    CreateBucketMetadataConfigurationCommand: CreateBucketMetadataConfigurationCommand,
    CreateBucketMetadataConfigurationRequest$: CreateBucketMetadataConfigurationRequest$,
    CreateBucketMetadataTableConfiguration$: CreateBucketMetadataTableConfiguration$,
    CreateBucketMetadataTableConfigurationCommand: CreateBucketMetadataTableConfigurationCommand,
    CreateBucketMetadataTableConfigurationRequest$: CreateBucketMetadataTableConfigurationRequest$,
    CreateBucketOutput$: CreateBucketOutput$,
    CreateBucketRequest$: CreateBucketRequest$,
    CreateMultipartUpload$: CreateMultipartUpload$,
    CreateMultipartUploadCommand: CreateMultipartUploadCommand,
    CreateMultipartUploadOutput$: CreateMultipartUploadOutput$,
    CreateMultipartUploadRequest$: CreateMultipartUploadRequest$,
    CreateSession$: CreateSession$,
    CreateSessionCommand: CreateSessionCommand,
    CreateSessionOutput$: CreateSessionOutput$,
    CreateSessionRequest$: CreateSessionRequest$,
    DataRedundancy: DataRedundancy,
    DefaultRetention$: DefaultRetention$,
    Delete$: Delete$,
    DeleteBucket$: DeleteBucket$,
    DeleteBucketAnalyticsConfiguration$: DeleteBucketAnalyticsConfiguration$,
    DeleteBucketAnalyticsConfigurationCommand: DeleteBucketAnalyticsConfigurationCommand,
    DeleteBucketAnalyticsConfigurationRequest$: DeleteBucketAnalyticsConfigurationRequest$,
    DeleteBucketCommand: DeleteBucketCommand,
    DeleteBucketCors$: DeleteBucketCors$,
    DeleteBucketCorsCommand: DeleteBucketCorsCommand,
    DeleteBucketCorsRequest$: DeleteBucketCorsRequest$,
    DeleteBucketEncryption$: DeleteBucketEncryption$,
    DeleteBucketEncryptionCommand: DeleteBucketEncryptionCommand,
    DeleteBucketEncryptionRequest$: DeleteBucketEncryptionRequest$,
    DeleteBucketIntelligentTieringConfiguration$: DeleteBucketIntelligentTieringConfiguration$,
    DeleteBucketIntelligentTieringConfigurationCommand: DeleteBucketIntelligentTieringConfigurationCommand,
    DeleteBucketIntelligentTieringConfigurationRequest$: DeleteBucketIntelligentTieringConfigurationRequest$,
    DeleteBucketInventoryConfiguration$: DeleteBucketInventoryConfiguration$,
    DeleteBucketInventoryConfigurationCommand: DeleteBucketInventoryConfigurationCommand,
    DeleteBucketInventoryConfigurationRequest$: DeleteBucketInventoryConfigurationRequest$,
    DeleteBucketLifecycle$: DeleteBucketLifecycle$,
    DeleteBucketLifecycleCommand: DeleteBucketLifecycleCommand,
    DeleteBucketLifecycleRequest$: DeleteBucketLifecycleRequest$,
    DeleteBucketMetadataConfiguration$: DeleteBucketMetadataConfiguration$,
    DeleteBucketMetadataConfigurationCommand: DeleteBucketMetadataConfigurationCommand,
    DeleteBucketMetadataConfigurationRequest$: DeleteBucketMetadataConfigurationRequest$,
    DeleteBucketMetadataTableConfiguration$: DeleteBucketMetadataTableConfiguration$,
    DeleteBucketMetadataTableConfigurationCommand: DeleteBucketMetadataTableConfigurationCommand,
    DeleteBucketMetadataTableConfigurationRequest$: DeleteBucketMetadataTableConfigurationRequest$,
    DeleteBucketMetricsConfiguration$: DeleteBucketMetricsConfiguration$,
    DeleteBucketMetricsConfigurationCommand: DeleteBucketMetricsConfigurationCommand,
    DeleteBucketMetricsConfigurationRequest$: DeleteBucketMetricsConfigurationRequest$,
    DeleteBucketOwnershipControls$: DeleteBucketOwnershipControls$,
    DeleteBucketOwnershipControlsCommand: DeleteBucketOwnershipControlsCommand,
    DeleteBucketOwnershipControlsRequest$: DeleteBucketOwnershipControlsRequest$,
    DeleteBucketPolicy$: DeleteBucketPolicy$,
    DeleteBucketPolicyCommand: DeleteBucketPolicyCommand,
    DeleteBucketPolicyRequest$: DeleteBucketPolicyRequest$,
    DeleteBucketReplication$: DeleteBucketReplication$,
    DeleteBucketReplicationCommand: DeleteBucketReplicationCommand,
    DeleteBucketReplicationRequest$: DeleteBucketReplicationRequest$,
    DeleteBucketRequest$: DeleteBucketRequest$,
    DeleteBucketTagging$: DeleteBucketTagging$,
    DeleteBucketTaggingCommand: DeleteBucketTaggingCommand,
    DeleteBucketTaggingRequest$: DeleteBucketTaggingRequest$,
    DeleteBucketWebsite$: DeleteBucketWebsite$,
    DeleteBucketWebsiteCommand: DeleteBucketWebsiteCommand,
    DeleteBucketWebsiteRequest$: DeleteBucketWebsiteRequest$,
    DeleteMarkerEntry$: DeleteMarkerEntry$,
    DeleteMarkerReplication$: DeleteMarkerReplication$,
    DeleteMarkerReplicationStatus: DeleteMarkerReplicationStatus,
    DeleteObject$: DeleteObject$,
    DeleteObjectCommand: DeleteObjectCommand,
    DeleteObjectOutput$: DeleteObjectOutput$,
    DeleteObjectRequest$: DeleteObjectRequest$,
    DeleteObjectTagging$: DeleteObjectTagging$,
    DeleteObjectTaggingCommand: DeleteObjectTaggingCommand,
    DeleteObjectTaggingOutput$: DeleteObjectTaggingOutput$,
    DeleteObjectTaggingRequest$: DeleteObjectTaggingRequest$,
    DeleteObjects$: DeleteObjects$,
    DeleteObjectsCommand: DeleteObjectsCommand,
    DeleteObjectsOutput$: DeleteObjectsOutput$,
    DeleteObjectsRequest$: DeleteObjectsRequest$,
    DeletePublicAccessBlock$: DeletePublicAccessBlock$,
    DeletePublicAccessBlockCommand: DeletePublicAccessBlockCommand,
    DeletePublicAccessBlockRequest$: DeletePublicAccessBlockRequest$,
    DeletedObject$: DeletedObject$,
    Destination$: Destination$,
    DestinationResult$: DestinationResult$,
    EncodingType: EncodingType,
    Encryption$: Encryption$,
    EncryptionConfiguration$: EncryptionConfiguration$,
    EncryptionType: EncryptionType,
    EncryptionTypeMismatch: EncryptionTypeMismatch,
    EncryptionTypeMismatch$: EncryptionTypeMismatch$,
    EndEvent$: EndEvent$,
    ErrorDetails$: ErrorDetails$,
    ErrorDocument$: ErrorDocument$,
    Event: Event,
    EventBridgeConfiguration$: EventBridgeConfiguration$,
    ExistingObjectReplication$: ExistingObjectReplication$,
    ExistingObjectReplicationStatus: ExistingObjectReplicationStatus,
    ExpirationState: ExpirationState,
    ExpirationStatus: ExpirationStatus,
    ExpressionType: ExpressionType,
    FileHeaderInfo: FileHeaderInfo,
    FilterRule$: FilterRule$,
    FilterRuleName: FilterRuleName,
    GetBucketAbac$: GetBucketAbac$,
    GetBucketAbacCommand: GetBucketAbacCommand,
    GetBucketAbacOutput$: GetBucketAbacOutput$,
    GetBucketAbacRequest$: GetBucketAbacRequest$,
    GetBucketAccelerateConfiguration$: GetBucketAccelerateConfiguration$,
    GetBucketAccelerateConfigurationCommand: GetBucketAccelerateConfigurationCommand,
    GetBucketAccelerateConfigurationOutput$: GetBucketAccelerateConfigurationOutput$,
    GetBucketAccelerateConfigurationRequest$: GetBucketAccelerateConfigurationRequest$,
    GetBucketAcl$: GetBucketAcl$,
    GetBucketAclCommand: GetBucketAclCommand,
    GetBucketAclOutput$: GetBucketAclOutput$,
    GetBucketAclRequest$: GetBucketAclRequest$,
    GetBucketAnalyticsConfiguration$: GetBucketAnalyticsConfiguration$,
    GetBucketAnalyticsConfigurationCommand: GetBucketAnalyticsConfigurationCommand,
    GetBucketAnalyticsConfigurationOutput$: GetBucketAnalyticsConfigurationOutput$,
    GetBucketAnalyticsConfigurationRequest$: GetBucketAnalyticsConfigurationRequest$,
    GetBucketCors$: GetBucketCors$,
    GetBucketCorsCommand: GetBucketCorsCommand,
    GetBucketCorsOutput$: GetBucketCorsOutput$,
    GetBucketCorsRequest$: GetBucketCorsRequest$,
    GetBucketEncryption$: GetBucketEncryption$,
    GetBucketEncryptionCommand: GetBucketEncryptionCommand,
    GetBucketEncryptionOutput$: GetBucketEncryptionOutput$,
    GetBucketEncryptionRequest$: GetBucketEncryptionRequest$,
    GetBucketIntelligentTieringConfiguration$: GetBucketIntelligentTieringConfiguration$,
    GetBucketIntelligentTieringConfigurationCommand: GetBucketIntelligentTieringConfigurationCommand,
    GetBucketIntelligentTieringConfigurationOutput$: GetBucketIntelligentTieringConfigurationOutput$,
    GetBucketIntelligentTieringConfigurationRequest$: GetBucketIntelligentTieringConfigurationRequest$,
    GetBucketInventoryConfiguration$: GetBucketInventoryConfiguration$,
    GetBucketInventoryConfigurationCommand: GetBucketInventoryConfigurationCommand,
    GetBucketInventoryConfigurationOutput$: GetBucketInventoryConfigurationOutput$,
    GetBucketInventoryConfigurationRequest$: GetBucketInventoryConfigurationRequest$,
    GetBucketLifecycleConfiguration$: GetBucketLifecycleConfiguration$,
    GetBucketLifecycleConfigurationCommand: GetBucketLifecycleConfigurationCommand,
    GetBucketLifecycleConfigurationOutput$: GetBucketLifecycleConfigurationOutput$,
    GetBucketLifecycleConfigurationRequest$: GetBucketLifecycleConfigurationRequest$,
    GetBucketLocation$: GetBucketLocation$,
    GetBucketLocationCommand: GetBucketLocationCommand,
    GetBucketLocationOutput$: GetBucketLocationOutput$,
    GetBucketLocationRequest$: GetBucketLocationRequest$,
    GetBucketLogging$: GetBucketLogging$,
    GetBucketLoggingCommand: GetBucketLoggingCommand,
    GetBucketLoggingOutput$: GetBucketLoggingOutput$,
    GetBucketLoggingRequest$: GetBucketLoggingRequest$,
    GetBucketMetadataConfiguration$: GetBucketMetadataConfiguration$,
    GetBucketMetadataConfigurationCommand: GetBucketMetadataConfigurationCommand,
    GetBucketMetadataConfigurationOutput$: GetBucketMetadataConfigurationOutput$,
    GetBucketMetadataConfigurationRequest$: GetBucketMetadataConfigurationRequest$,
    GetBucketMetadataConfigurationResult$: GetBucketMetadataConfigurationResult$,
    GetBucketMetadataTableConfiguration$: GetBucketMetadataTableConfiguration$,
    GetBucketMetadataTableConfigurationCommand: GetBucketMetadataTableConfigurationCommand,
    GetBucketMetadataTableConfigurationOutput$: GetBucketMetadataTableConfigurationOutput$,
    GetBucketMetadataTableConfigurationRequest$: GetBucketMetadataTableConfigurationRequest$,
    GetBucketMetadataTableConfigurationResult$: GetBucketMetadataTableConfigurationResult$,
    GetBucketMetricsConfiguration$: GetBucketMetricsConfiguration$,
    GetBucketMetricsConfigurationCommand: GetBucketMetricsConfigurationCommand,
    GetBucketMetricsConfigurationOutput$: GetBucketMetricsConfigurationOutput$,
    GetBucketMetricsConfigurationRequest$: GetBucketMetricsConfigurationRequest$,
    GetBucketNotificationConfiguration$: GetBucketNotificationConfiguration$,
    GetBucketNotificationConfigurationCommand: GetBucketNotificationConfigurationCommand,
    GetBucketNotificationConfigurationRequest$: GetBucketNotificationConfigurationRequest$,
    GetBucketOwnershipControls$: GetBucketOwnershipControls$,
    GetBucketOwnershipControlsCommand: GetBucketOwnershipControlsCommand,
    GetBucketOwnershipControlsOutput$: GetBucketOwnershipControlsOutput$,
    GetBucketOwnershipControlsRequest$: GetBucketOwnershipControlsRequest$,
    GetBucketPolicy$: GetBucketPolicy$,
    GetBucketPolicyCommand: GetBucketPolicyCommand,
    GetBucketPolicyOutput$: GetBucketPolicyOutput$,
    GetBucketPolicyRequest$: GetBucketPolicyRequest$,
    GetBucketPolicyStatus$: GetBucketPolicyStatus$,
    GetBucketPolicyStatusCommand: GetBucketPolicyStatusCommand,
    GetBucketPolicyStatusOutput$: GetBucketPolicyStatusOutput$,
    GetBucketPolicyStatusRequest$: GetBucketPolicyStatusRequest$,
    GetBucketReplication$: GetBucketReplication$,
    GetBucketReplicationCommand: GetBucketReplicationCommand,
    GetBucketReplicationOutput$: GetBucketReplicationOutput$,
    GetBucketReplicationRequest$: GetBucketReplicationRequest$,
    GetBucketRequestPayment$: GetBucketRequestPayment$,
    GetBucketRequestPaymentCommand: GetBucketRequestPaymentCommand,
    GetBucketRequestPaymentOutput$: GetBucketRequestPaymentOutput$,
    GetBucketRequestPaymentRequest$: GetBucketRequestPaymentRequest$,
    GetBucketTagging$: GetBucketTagging$,
    GetBucketTaggingCommand: GetBucketTaggingCommand,
    GetBucketTaggingOutput$: GetBucketTaggingOutput$,
    GetBucketTaggingRequest$: GetBucketTaggingRequest$,
    GetBucketVersioning$: GetBucketVersioning$,
    GetBucketVersioningCommand: GetBucketVersioningCommand,
    GetBucketVersioningOutput$: GetBucketVersioningOutput$,
    GetBucketVersioningRequest$: GetBucketVersioningRequest$,
    GetBucketWebsite$: GetBucketWebsite$,
    GetBucketWebsiteCommand: GetBucketWebsiteCommand,
    GetBucketWebsiteOutput$: GetBucketWebsiteOutput$,
    GetBucketWebsiteRequest$: GetBucketWebsiteRequest$,
    GetObject$: GetObject$,
    GetObjectAcl$: GetObjectAcl$,
    GetObjectAclCommand: GetObjectAclCommand,
    GetObjectAclOutput$: GetObjectAclOutput$,
    GetObjectAclRequest$: GetObjectAclRequest$,
    GetObjectAttributes$: GetObjectAttributes$,
    GetObjectAttributesCommand: GetObjectAttributesCommand,
    GetObjectAttributesOutput$: GetObjectAttributesOutput$,
    GetObjectAttributesParts$: GetObjectAttributesParts$,
    GetObjectAttributesRequest$: GetObjectAttributesRequest$,
    GetObjectCommand: GetObjectCommand,
    GetObjectLegalHold$: GetObjectLegalHold$,
    GetObjectLegalHoldCommand: GetObjectLegalHoldCommand,
    GetObjectLegalHoldOutput$: GetObjectLegalHoldOutput$,
    GetObjectLegalHoldRequest$: GetObjectLegalHoldRequest$,
    GetObjectLockConfiguration$: GetObjectLockConfiguration$,
    GetObjectLockConfigurationCommand: GetObjectLockConfigurationCommand,
    GetObjectLockConfigurationOutput$: GetObjectLockConfigurationOutput$,
    GetObjectLockConfigurationRequest$: GetObjectLockConfigurationRequest$,
    GetObjectOutput$: GetObjectOutput$,
    GetObjectRequest$: GetObjectRequest$,
    GetObjectRetention$: GetObjectRetention$,
    GetObjectRetentionCommand: GetObjectRetentionCommand,
    GetObjectRetentionOutput$: GetObjectRetentionOutput$,
    GetObjectRetentionRequest$: GetObjectRetentionRequest$,
    GetObjectTagging$: GetObjectTagging$,
    GetObjectTaggingCommand: GetObjectTaggingCommand,
    GetObjectTaggingOutput$: GetObjectTaggingOutput$,
    GetObjectTaggingRequest$: GetObjectTaggingRequest$,
    GetObjectTorrent$: GetObjectTorrent$,
    GetObjectTorrentCommand: GetObjectTorrentCommand,
    GetObjectTorrentOutput$: GetObjectTorrentOutput$,
    GetObjectTorrentRequest$: GetObjectTorrentRequest$,
    GetPublicAccessBlock$: GetPublicAccessBlock$,
    GetPublicAccessBlockCommand: GetPublicAccessBlockCommand,
    GetPublicAccessBlockOutput$: GetPublicAccessBlockOutput$,
    GetPublicAccessBlockRequest$: GetPublicAccessBlockRequest$,
    GlacierJobParameters$: GlacierJobParameters$,
    Grant$: Grant$,
    Grantee$: Grantee$,
    HeadBucket$: HeadBucket$,
    HeadBucketCommand: HeadBucketCommand,
    HeadBucketOutput$: HeadBucketOutput$,
    HeadBucketRequest$: HeadBucketRequest$,
    HeadObject$: HeadObject$,
    HeadObjectCommand: HeadObjectCommand,
    HeadObjectOutput$: HeadObjectOutput$,
    HeadObjectRequest$: HeadObjectRequest$,
    IdempotencyParameterMismatch: IdempotencyParameterMismatch,
    IdempotencyParameterMismatch$: IdempotencyParameterMismatch$,
    IndexDocument$: IndexDocument$,
    Initiator$: Initiator$,
    InputSerialization$: InputSerialization$,
    IntelligentTieringAccessTier: IntelligentTieringAccessTier,
    IntelligentTieringAndOperator$: IntelligentTieringAndOperator$,
    IntelligentTieringConfiguration$: IntelligentTieringConfiguration$,
    IntelligentTieringFilter$: IntelligentTieringFilter$,
    IntelligentTieringStatus: IntelligentTieringStatus,
    InvalidObjectState: InvalidObjectState,
    InvalidObjectState$: InvalidObjectState$,
    InvalidRequest: InvalidRequest,
    InvalidRequest$: InvalidRequest$,
    InvalidWriteOffset: InvalidWriteOffset,
    InvalidWriteOffset$: InvalidWriteOffset$,
    InventoryConfiguration$: InventoryConfiguration$,
    InventoryConfigurationState: InventoryConfigurationState,
    InventoryDestination$: InventoryDestination$,
    InventoryEncryption$: InventoryEncryption$,
    InventoryFilter$: InventoryFilter$,
    InventoryFormat: InventoryFormat,
    InventoryFrequency: InventoryFrequency,
    InventoryIncludedObjectVersions: InventoryIncludedObjectVersions,
    InventoryOptionalField: InventoryOptionalField,
    InventoryS3BucketDestination$: InventoryS3BucketDestination$,
    InventorySchedule$: InventorySchedule$,
    InventoryTableConfiguration$: InventoryTableConfiguration$,
    InventoryTableConfigurationResult$: InventoryTableConfigurationResult$,
    InventoryTableConfigurationUpdates$: InventoryTableConfigurationUpdates$,
    JSONInput$: JSONInput$,
    JSONOutput$: JSONOutput$,
    JSONType: JSONType,
    JournalTableConfiguration$: JournalTableConfiguration$,
    JournalTableConfigurationResult$: JournalTableConfigurationResult$,
    JournalTableConfigurationUpdates$: JournalTableConfigurationUpdates$,
    LambdaFunctionConfiguration$: LambdaFunctionConfiguration$,
    LifecycleExpiration$: LifecycleExpiration$,
    LifecycleRule$: LifecycleRule$,
    LifecycleRuleAndOperator$: LifecycleRuleAndOperator$,
    LifecycleRuleFilter$: LifecycleRuleFilter$,
    ListBucketAnalyticsConfigurations$: ListBucketAnalyticsConfigurations$,
    ListBucketAnalyticsConfigurationsCommand: ListBucketAnalyticsConfigurationsCommand,
    ListBucketAnalyticsConfigurationsOutput$: ListBucketAnalyticsConfigurationsOutput$,
    ListBucketAnalyticsConfigurationsRequest$: ListBucketAnalyticsConfigurationsRequest$,
    ListBucketIntelligentTieringConfigurations$: ListBucketIntelligentTieringConfigurations$,
    ListBucketIntelligentTieringConfigurationsCommand: ListBucketIntelligentTieringConfigurationsCommand,
    ListBucketIntelligentTieringConfigurationsOutput$: ListBucketIntelligentTieringConfigurationsOutput$,
    ListBucketIntelligentTieringConfigurationsRequest$: ListBucketIntelligentTieringConfigurationsRequest$,
    ListBucketInventoryConfigurations$: ListBucketInventoryConfigurations$,
    ListBucketInventoryConfigurationsCommand: ListBucketInventoryConfigurationsCommand,
    ListBucketInventoryConfigurationsOutput$: ListBucketInventoryConfigurationsOutput$,
    ListBucketInventoryConfigurationsRequest$: ListBucketInventoryConfigurationsRequest$,
    ListBucketMetricsConfigurations$: ListBucketMetricsConfigurations$,
    ListBucketMetricsConfigurationsCommand: ListBucketMetricsConfigurationsCommand,
    ListBucketMetricsConfigurationsOutput$: ListBucketMetricsConfigurationsOutput$,
    ListBucketMetricsConfigurationsRequest$: ListBucketMetricsConfigurationsRequest$,
    ListBuckets$: ListBuckets$,
    ListBucketsCommand: ListBucketsCommand,
    ListBucketsOutput$: ListBucketsOutput$,
    ListBucketsRequest$: ListBucketsRequest$,
    ListDirectoryBuckets$: ListDirectoryBuckets$,
    ListDirectoryBucketsCommand: ListDirectoryBucketsCommand,
    ListDirectoryBucketsOutput$: ListDirectoryBucketsOutput$,
    ListDirectoryBucketsRequest$: ListDirectoryBucketsRequest$,
    ListMultipartUploads$: ListMultipartUploads$,
    ListMultipartUploadsCommand: ListMultipartUploadsCommand,
    ListMultipartUploadsOutput$: ListMultipartUploadsOutput$,
    ListMultipartUploadsRequest$: ListMultipartUploadsRequest$,
    ListObjectVersions$: ListObjectVersions$,
    ListObjectVersionsCommand: ListObjectVersionsCommand,
    ListObjectVersionsOutput$: ListObjectVersionsOutput$,
    ListObjectVersionsRequest$: ListObjectVersionsRequest$,
    ListObjects$: ListObjects$,
    ListObjectsCommand: ListObjectsCommand,
    ListObjectsOutput$: ListObjectsOutput$,
    ListObjectsRequest$: ListObjectsRequest$,
    ListObjectsV2$: ListObjectsV2$,
    ListObjectsV2Command: ListObjectsV2Command,
    ListObjectsV2Output$: ListObjectsV2Output$,
    ListObjectsV2Request$: ListObjectsV2Request$,
    ListParts$: ListParts$,
    ListPartsCommand: ListPartsCommand,
    ListPartsOutput$: ListPartsOutput$,
    ListPartsRequest$: ListPartsRequest$,
    LocationInfo$: LocationInfo$,
    LocationType: LocationType,
    LoggingEnabled$: LoggingEnabled$,
    MFADelete: MFADelete,
    MFADeleteStatus: MFADeleteStatus,
    MetadataConfiguration$: MetadataConfiguration$,
    MetadataConfigurationResult$: MetadataConfigurationResult$,
    MetadataDirective: MetadataDirective,
    MetadataEntry$: MetadataEntry$,
    MetadataTableConfiguration$: MetadataTableConfiguration$,
    MetadataTableConfigurationResult$: MetadataTableConfigurationResult$,
    MetadataTableEncryptionConfiguration$: MetadataTableEncryptionConfiguration$,
    Metrics$: Metrics$,
    MetricsAndOperator$: MetricsAndOperator$,
    MetricsConfiguration$: MetricsConfiguration$,
    MetricsFilter$: MetricsFilter$,
    MetricsStatus: MetricsStatus,
    MultipartUpload$: MultipartUpload$,
    NoSuchBucket: NoSuchBucket,
    NoSuchBucket$: NoSuchBucket$,
    NoSuchKey: NoSuchKey,
    NoSuchKey$: NoSuchKey$,
    NoSuchUpload: NoSuchUpload,
    NoSuchUpload$: NoSuchUpload$,
    NoncurrentVersionExpiration$: NoncurrentVersionExpiration$,
    NoncurrentVersionTransition$: NoncurrentVersionTransition$,
    NotFound: NotFound,
    NotFound$: NotFound$,
    NotificationConfiguration$: NotificationConfiguration$,
    NotificationConfigurationFilter$: NotificationConfigurationFilter$,
    ObjectAlreadyInActiveTierError: ObjectAlreadyInActiveTierError,
    ObjectAlreadyInActiveTierError$: ObjectAlreadyInActiveTierError$,
    ObjectAttributes: ObjectAttributes,
    ObjectCannedACL: ObjectCannedACL,
    ObjectEncryption$: ObjectEncryption$,
    ObjectIdentifier$: ObjectIdentifier$,
    ObjectLockConfiguration$: ObjectLockConfiguration$,
    ObjectLockEnabled: ObjectLockEnabled,
    ObjectLockLegalHold$: ObjectLockLegalHold$,
    ObjectLockLegalHoldStatus: ObjectLockLegalHoldStatus,
    ObjectLockMode: ObjectLockMode,
    ObjectLockRetention$: ObjectLockRetention$,
    ObjectLockRetentionMode: ObjectLockRetentionMode,
    ObjectLockRule$: ObjectLockRule$,
    ObjectNotInActiveTierError: ObjectNotInActiveTierError,
    ObjectNotInActiveTierError$: ObjectNotInActiveTierError$,
    ObjectOwnership: ObjectOwnership,
    ObjectPart$: ObjectPart$,
    ObjectStorageClass: ObjectStorageClass,
    ObjectVersion$: ObjectVersion$,
    ObjectVersionStorageClass: ObjectVersionStorageClass,
    OptionalObjectAttributes: OptionalObjectAttributes,
    OutputLocation$: OutputLocation$,
    OutputSerialization$: OutputSerialization$,
    Owner$: Owner$,
    OwnerOverride: OwnerOverride,
    OwnershipControls$: OwnershipControls$,
    OwnershipControlsRule$: OwnershipControlsRule$,
    ParquetInput$: ParquetInput$,
    Part$: Part$,
    PartitionDateSource: PartitionDateSource,
    PartitionedPrefix$: PartitionedPrefix$,
    Payer: Payer,
    Permission: Permission,
    PolicyStatus$: PolicyStatus$,
    Progress$: Progress$,
    ProgressEvent$: ProgressEvent$,
    Protocol: Protocol,
    PublicAccessBlockConfiguration$: PublicAccessBlockConfiguration$,
    PutBucketAbac$: PutBucketAbac$,
    PutBucketAbacCommand: PutBucketAbacCommand,
    PutBucketAbacRequest$: PutBucketAbacRequest$,
    PutBucketAccelerateConfiguration$: PutBucketAccelerateConfiguration$,
    PutBucketAccelerateConfigurationCommand: PutBucketAccelerateConfigurationCommand,
    PutBucketAccelerateConfigurationRequest$: PutBucketAccelerateConfigurationRequest$,
    PutBucketAcl$: PutBucketAcl$,
    PutBucketAclCommand: PutBucketAclCommand,
    PutBucketAclRequest$: PutBucketAclRequest$,
    PutBucketAnalyticsConfiguration$: PutBucketAnalyticsConfiguration$,
    PutBucketAnalyticsConfigurationCommand: PutBucketAnalyticsConfigurationCommand,
    PutBucketAnalyticsConfigurationRequest$: PutBucketAnalyticsConfigurationRequest$,
    PutBucketCors$: PutBucketCors$,
    PutBucketCorsCommand: PutBucketCorsCommand,
    PutBucketCorsRequest$: PutBucketCorsRequest$,
    PutBucketEncryption$: PutBucketEncryption$,
    PutBucketEncryptionCommand: PutBucketEncryptionCommand,
    PutBucketEncryptionRequest$: PutBucketEncryptionRequest$,
    PutBucketIntelligentTieringConfiguration$: PutBucketIntelligentTieringConfiguration$,
    PutBucketIntelligentTieringConfigurationCommand: PutBucketIntelligentTieringConfigurationCommand,
    PutBucketIntelligentTieringConfigurationRequest$: PutBucketIntelligentTieringConfigurationRequest$,
    PutBucketInventoryConfiguration$: PutBucketInventoryConfiguration$,
    PutBucketInventoryConfigurationCommand: PutBucketInventoryConfigurationCommand,
    PutBucketInventoryConfigurationRequest$: PutBucketInventoryConfigurationRequest$,
    PutBucketLifecycleConfiguration$: PutBucketLifecycleConfiguration$,
    PutBucketLifecycleConfigurationCommand: PutBucketLifecycleConfigurationCommand,
    PutBucketLifecycleConfigurationOutput$: PutBucketLifecycleConfigurationOutput$,
    PutBucketLifecycleConfigurationRequest$: PutBucketLifecycleConfigurationRequest$,
    PutBucketLogging$: PutBucketLogging$,
    PutBucketLoggingCommand: PutBucketLoggingCommand,
    PutBucketLoggingRequest$: PutBucketLoggingRequest$,
    PutBucketMetricsConfiguration$: PutBucketMetricsConfiguration$,
    PutBucketMetricsConfigurationCommand: PutBucketMetricsConfigurationCommand,
    PutBucketMetricsConfigurationRequest$: PutBucketMetricsConfigurationRequest$,
    PutBucketNotificationConfiguration$: PutBucketNotificationConfiguration$,
    PutBucketNotificationConfigurationCommand: PutBucketNotificationConfigurationCommand,
    PutBucketNotificationConfigurationRequest$: PutBucketNotificationConfigurationRequest$,
    PutBucketOwnershipControls$: PutBucketOwnershipControls$,
    PutBucketOwnershipControlsCommand: PutBucketOwnershipControlsCommand,
    PutBucketOwnershipControlsRequest$: PutBucketOwnershipControlsRequest$,
    PutBucketPolicy$: PutBucketPolicy$,
    PutBucketPolicyCommand: PutBucketPolicyCommand,
    PutBucketPolicyRequest$: PutBucketPolicyRequest$,
    PutBucketReplication$: PutBucketReplication$,
    PutBucketReplicationCommand: PutBucketReplicationCommand,
    PutBucketReplicationRequest$: PutBucketReplicationRequest$,
    PutBucketRequestPayment$: PutBucketRequestPayment$,
    PutBucketRequestPaymentCommand: PutBucketRequestPaymentCommand,
    PutBucketRequestPaymentRequest$: PutBucketRequestPaymentRequest$,
    PutBucketTagging$: PutBucketTagging$,
    PutBucketTaggingCommand: PutBucketTaggingCommand,
    PutBucketTaggingRequest$: PutBucketTaggingRequest$,
    PutBucketVersioning$: PutBucketVersioning$,
    PutBucketVersioningCommand: PutBucketVersioningCommand,
    PutBucketVersioningRequest$: PutBucketVersioningRequest$,
    PutBucketWebsite$: PutBucketWebsite$,
    PutBucketWebsiteCommand: PutBucketWebsiteCommand,
    PutBucketWebsiteRequest$: PutBucketWebsiteRequest$,
    PutObject$: PutObject$,
    PutObjectAcl$: PutObjectAcl$,
    PutObjectAclCommand: PutObjectAclCommand,
    PutObjectAclOutput$: PutObjectAclOutput$,
    PutObjectAclRequest$: PutObjectAclRequest$,
    PutObjectCommand: PutObjectCommand,
    PutObjectLegalHold$: PutObjectLegalHold$,
    PutObjectLegalHoldCommand: PutObjectLegalHoldCommand,
    PutObjectLegalHoldOutput$: PutObjectLegalHoldOutput$,
    PutObjectLegalHoldRequest$: PutObjectLegalHoldRequest$,
    PutObjectLockConfiguration$: PutObjectLockConfiguration$,
    PutObjectLockConfigurationCommand: PutObjectLockConfigurationCommand,
    PutObjectLockConfigurationOutput$: PutObjectLockConfigurationOutput$,
    PutObjectLockConfigurationRequest$: PutObjectLockConfigurationRequest$,
    PutObjectOutput$: PutObjectOutput$,
    PutObjectRequest$: PutObjectRequest$,
    PutObjectRetention$: PutObjectRetention$,
    PutObjectRetentionCommand: PutObjectRetentionCommand,
    PutObjectRetentionOutput$: PutObjectRetentionOutput$,
    PutObjectRetentionRequest$: PutObjectRetentionRequest$,
    PutObjectTagging$: PutObjectTagging$,
    PutObjectTaggingCommand: PutObjectTaggingCommand,
    PutObjectTaggingOutput$: PutObjectTaggingOutput$,
    PutObjectTaggingRequest$: PutObjectTaggingRequest$,
    PutPublicAccessBlock$: PutPublicAccessBlock$,
    PutPublicAccessBlockCommand: PutPublicAccessBlockCommand,
    PutPublicAccessBlockRequest$: PutPublicAccessBlockRequest$,
    QueueConfiguration$: QueueConfiguration$,
    QuoteFields: QuoteFields,
    RecordExpiration$: RecordExpiration$,
    RecordsEvent$: RecordsEvent$,
    Redirect$: Redirect$,
    RedirectAllRequestsTo$: RedirectAllRequestsTo$,
    RenameObject$: RenameObject$,
    RenameObjectCommand: RenameObjectCommand,
    RenameObjectOutput$: RenameObjectOutput$,
    RenameObjectRequest$: RenameObjectRequest$,
    ReplicaModifications$: ReplicaModifications$,
    ReplicaModificationsStatus: ReplicaModificationsStatus,
    ReplicationConfiguration$: ReplicationConfiguration$,
    ReplicationRule$: ReplicationRule$,
    ReplicationRuleAndOperator$: ReplicationRuleAndOperator$,
    ReplicationRuleFilter$: ReplicationRuleFilter$,
    ReplicationRuleStatus: ReplicationRuleStatus,
    ReplicationStatus: ReplicationStatus,
    ReplicationTime$: ReplicationTime$,
    ReplicationTimeStatus: ReplicationTimeStatus,
    ReplicationTimeValue$: ReplicationTimeValue$,
    RequestCharged: RequestCharged,
    RequestPayer: RequestPayer,
    RequestPaymentConfiguration$: RequestPaymentConfiguration$,
    RequestProgress$: RequestProgress$,
    RestoreObject$: RestoreObject$,
    RestoreObjectCommand: RestoreObjectCommand,
    RestoreObjectOutput$: RestoreObjectOutput$,
    RestoreObjectRequest$: RestoreObjectRequest$,
    RestoreRequest$: RestoreRequest$,
    RestoreRequestType: RestoreRequestType,
    RestoreStatus$: RestoreStatus$,
    RoutingRule$: RoutingRule$,
    S3: S3,
    S3Client: S3Client,
    S3KeyFilter$: S3KeyFilter$,
    S3Location$: S3Location$,
    S3ServiceException: S3ServiceException,
    S3ServiceException$: S3ServiceException$,
    S3TablesBucketType: S3TablesBucketType,
    S3TablesDestination$: S3TablesDestination$,
    S3TablesDestinationResult$: S3TablesDestinationResult$,
    SSEKMS$: SSEKMS$,
    SSEKMSEncryption$: SSEKMSEncryption$,
    SSES3$: SSES3$,
    ScanRange$: ScanRange$,
    SelectObjectContent$: SelectObjectContent$,
    SelectObjectContentCommand: SelectObjectContentCommand,
    SelectObjectContentEventStream$: SelectObjectContentEventStream$,
    SelectObjectContentOutput$: SelectObjectContentOutput$,
    SelectObjectContentRequest$: SelectObjectContentRequest$,
    SelectParameters$: SelectParameters$,
    ServerSideEncryption: ServerSideEncryption,
    ServerSideEncryptionByDefault$: ServerSideEncryptionByDefault$,
    ServerSideEncryptionConfiguration$: ServerSideEncryptionConfiguration$,
    ServerSideEncryptionRule$: ServerSideEncryptionRule$,
    SessionCredentials$: SessionCredentials$,
    SessionMode: SessionMode,
    SimplePrefix$: SimplePrefix$,
    SourceSelectionCriteria$: SourceSelectionCriteria$,
    SseKmsEncryptedObjects$: SseKmsEncryptedObjects$,
    SseKmsEncryptedObjectsStatus: SseKmsEncryptedObjectsStatus,
    Stats$: Stats$,
    StatsEvent$: StatsEvent$,
    StorageClass: StorageClass,
    StorageClassAnalysis$: StorageClassAnalysis$,
    StorageClassAnalysisDataExport$: StorageClassAnalysisDataExport$,
    StorageClassAnalysisSchemaVersion: StorageClassAnalysisSchemaVersion,
    TableSseAlgorithm: TableSseAlgorithm,
    Tag$: Tag$,
    Tagging$: Tagging$,
    TaggingDirective: TaggingDirective,
    TargetGrant$: TargetGrant$,
    TargetObjectKeyFormat$: TargetObjectKeyFormat$,
    Tier: Tier,
    Tiering$: Tiering$,
    TooManyParts: TooManyParts,
    TooManyParts$: TooManyParts$,
    TopicConfiguration$: TopicConfiguration$,
    Transition$: Transition$,
    TransitionDefaultMinimumObjectSize: TransitionDefaultMinimumObjectSize,
    TransitionStorageClass: TransitionStorageClass,
    Type: Type,
    UpdateBucketMetadataInventoryTableConfiguration$: UpdateBucketMetadataInventoryTableConfiguration$,
    UpdateBucketMetadataInventoryTableConfigurationCommand: UpdateBucketMetadataInventoryTableConfigurationCommand,
    UpdateBucketMetadataInventoryTableConfigurationRequest$: UpdateBucketMetadataInventoryTableConfigurationRequest$,
    UpdateBucketMetadataJournalTableConfiguration$: UpdateBucketMetadataJournalTableConfiguration$,
    UpdateBucketMetadataJournalTableConfigurationCommand: UpdateBucketMetadataJournalTableConfigurationCommand,
    UpdateBucketMetadataJournalTableConfigurationRequest$: UpdateBucketMetadataJournalTableConfigurationRequest$,
    UpdateObjectEncryption$: UpdateObjectEncryption$,
    UpdateObjectEncryptionCommand: UpdateObjectEncryptionCommand,
    UpdateObjectEncryptionRequest$: UpdateObjectEncryptionRequest$,
    UpdateObjectEncryptionResponse$: UpdateObjectEncryptionResponse$,
    UploadPart$: UploadPart$,
    UploadPartCommand: UploadPartCommand,
    UploadPartCopy$: UploadPartCopy$,
    UploadPartCopyCommand: UploadPartCopyCommand,
    UploadPartCopyOutput$: UploadPartCopyOutput$,
    UploadPartCopyRequest$: UploadPartCopyRequest$,
    UploadPartOutput$: UploadPartOutput$,
    UploadPartRequest$: UploadPartRequest$,
    VersioningConfiguration$: VersioningConfiguration$,
    WebsiteConfiguration$: WebsiteConfiguration$,
    WriteGetObjectResponse$: WriteGetObjectResponse$,
    WriteGetObjectResponseCommand: WriteGetObjectResponseCommand,
    WriteGetObjectResponseRequest$: WriteGetObjectResponseRequest$,
    _Error$: _Error$,
    _Object$: _Object$,
    __Client: Client,
    errorTypeRegistries: errorTypeRegistries,
    paginateListBuckets: paginateListBuckets,
    paginateListDirectoryBuckets: paginateListDirectoryBuckets,
    paginateListObjectsV2: paginateListObjectsV2,
    paginateListParts: paginateListParts,
    waitForBucketExists: waitForBucketExists,
    waitForBucketNotExists: waitForBucketNotExists,
    waitForObjectExists: waitForObjectExists,
    waitForObjectNotExists: waitForObjectNotExists,
    waitUntilBucketExists: waitUntilBucketExists,
    waitUntilBucketNotExists: waitUntilBucketNotExists,
    waitUntilObjectExists: waitUntilObjectExists,
    waitUntilObjectNotExists: waitUntilObjectNotExists
});

export { index as i, toUtf8 as t };
//# sourceMappingURL=index-Bw-D7eG4.js.map
