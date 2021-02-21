export type CapturePoint = Parameters<ErrorConstructor['captureStackTrace']>[1];

/**
 * Captures error so it appears to be yielded from the given function
 *
 * @param error Error to be thrown
 * @param func fake error origin
 */
export const throwCaptured = (error: Error, func: CapturePoint): never => {
    try {
        throw error;
    } catch (e) {
        Error.captureStackTrace(e, func);
        throw e;
    }
};
