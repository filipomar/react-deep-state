import React, { createContext, FC, useContext, useEffect, useMemo, useState } from 'react';

import { DeepStateManager, areResultsEqual, Filter } from '../DeepStateManager';
import { CapturePoint, throwCaptured } from '../utils';

export type ProvderProps<S> = { readonly initial: S } | { readonly manager: DeepStateManager<S> };
export type Selector<S, R> = (s: S) => R;
export type Dispatcher<S> = () => (newState: Partial<S>) => void;

/**
 * Creates the `DeepState` object necessary to create and manage a deep state on react
 * Allowing simple way to manage a state with-out unnecessary renders
 *
 * @example const { Provider, useDeepState, useDeepStateDispatcher } = createDeepState<{ readonly a: string | null; }>();
 */
export type DeepState<S> = {
    /**
     * The provider of the deep state
     *
     * @example <Provider initial={{ a: null, b: null }}>{children}</Provider>
     * @example <Provider manager={new DeepStateManager({ a: null, b: null })}>{children}</Provider>
     */
    readonly Provider: FC<ProvderProps<S>>;

    /**
     * If you want to use the state as a hook
     * Check out `Filter<R>` for more complex filtering
     * @example useDeepState((s) => s.a)
     * @example useDeepState((s) => s.a, (s) => s.a)
     */
    readonly useDeepState: <R>(state: Selector<S, R>, filter?: Filter<R>) => R;

    /**
     * If you want to update the state
     * @example useDeepStateDispatcher()({ a: null })
     */
    readonly useDeepStateDispatcher: Dispatcher<S>;
};

export const createDeepState = <S extends unknown>(): DeepState<S> => {
    const Context = createContext<DeepStateManager<S> | null>(null);

    const getContext = (caller: CapturePoint): DeepStateManager<S> => {
        const state = useContext(Context);

        if (state) {
            return state;
        }

        return throwCaptured(new Error('Must be used with-in a Provider'), caller);
    };

    const Provider: DeepState<S>['Provider'] = ({ children, ...props }) => {
        /**
         * The manager is created at the beginning
         * All actions will be applied on to it
         */
        const manager = useMemo(() => ('initial' in props ? new DeepStateManager(props.initial) : props.manager), [
            'initial' in props ? props.initial : props.manager,
        ]);
        return <Context.Provider value={manager}>{children}</Context.Provider>;
    };

    const useDeepState: DeepState<S>['useDeepState'] = (selector, filter) => {
        /**
         * First retrieve the context
         */
        const manager = getContext(useDeepState);

        /**
         * Calulate initial value and set it to the result
         */
        const [currentResult, setResult] = useState(useMemo(() => selector(manager.getState()), []));

        useEffect(
            () =>
                manager.subscribe(
                    (previousState, currentState) => {
                        const previous = selector(previousState);
                        const current = selector(currentState);

                        /**
                         * True if
                         *
                         * - previous and current value match, so there is no need to give them a pass
                         * - there is a custom filter and it says they are equal
                         */
                        return Boolean(previous === current || (filter && areResultsEqual(current, previous, filter)));
                    },
                    () => setResult(selector(manager.getState()))
                ),
            []
        );

        return currentResult;
    };

    const useDeepStateDispatcher: DeepState<S>['useDeepStateDispatcher'] = (): ((newState: Partial<S>) => void) => {
        /**
         * First retrieve the context
         */
        const manager = getContext(useDeepStateDispatcher);

        return (s) => manager.setState(s);
    };

    return { Provider, useDeepState, useDeepStateDispatcher };
};
