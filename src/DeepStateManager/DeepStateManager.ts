/**
 * Represnts a function that once called, results in the removal of a subscription
 */

export type Unsubber = () => void;

/**
 * A manager subscriber
 */
export type Subscriber = () => void;

/**
 * Compares state changes if you wish to **not** perform unecessary re-renders
 *
 * @example `[(before, after) => before === after, () => { ... }]` as a equality validation
 * @example `[(value) => String(value), () => { ... }]` as a hash
 * @example `[() => { ... }]` without filter changes
 */
export type Filter<S> = ((result: S) => string | number | null | undefined) | ((a: S, b: S) => boolean);

export const areResultsEqual = <S>(previous: S, current: S, filter: Filter<S>): boolean => {
    const result = filter(previous, current);

    /**
     * If result is boolean, hash method is not used
     */
    if (typeof result === 'boolean') {
        return result;
    }

    /**
     * Else, hash method is being used
     */
    return result === filter(current, previous);
};

export class DeepStateManager<S> {
    private state: S;
    private subscribers: Set<Subscriber>;

    constructor(initialState: S) {
        this.state = initialState;
        this.subscribers = new Set();
    }

    /**
     * Allows for partial update of the state, triggers subscriber changes
     * @param state
     */
    setState(state: Partial<S>): void {
        this.state = { ...this.state, ...state };
        this.subscribers.forEach((l) => l());
    }

    /**
     * Gets the total state being managed
     */
    getState(): S {
        return this.state;
    }

    private addSubscriber(subscriber: Subscriber): Unsubber {
        this.subscribers.add(subscriber);
        return () => void this.subscribers.delete(subscriber);
    }

    /**
     * @param filter Optional filter for changes before subscriber gets called. See `Filter` for more
     * @param subscriber To subscribe to state changes
     */
    subscribe(...args: [Filter<S>, Subscriber] | [Subscriber]): Unsubber {
        const [filter, subscriber] = args.length === 1 ? [() => false, args[0]] : args;

        let previous = this.getState();

        return this.addSubscriber(() => {
            const current = this.getState();

            if (!areResultsEqual(previous, current, filter)) {
                subscriber();
            }

            previous = current;
        });
    }
}
