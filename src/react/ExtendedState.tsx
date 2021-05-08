import React, { createContext, FC, useContext, useEffect, useMemo, useState } from 'react';

import { ExtendedStateManager, areResultsEqual, Filter, PossibleExtendedState } from '../ExtendedStateManager';
import { CapturePoint, throwCaptured } from '../utils';

export type ProvderProps<S extends PossibleExtendedState> = { readonly initial: S } | { readonly manager: ExtendedStateManager<S> };
export type Selector<S, R> = (s: S) => R;
export type Dispatcher<S> = () => (newStateOrGenerator: Partial<S> | ((currentState: S) => Partial<S>)) => void;

/**
 * Creates the `ExtendedState` object necessary to create and manage an extended state on react
 * Allowing simple way to manage a state with-out unnecessary renders
 *
 * @example const { Provider, useExtendedState, useExtendedStateDispatcher } = createExtendedState<{ readonly a: string | null; }>();
 */
export type ExtendedState<S extends PossibleExtendedState> = {
    /**
     * The provider of the extended state
     *
     * @example <Provider initial={{ a: null, b: null }}>{children}</Provider>
     * @example <Provider manager={new ExtendedStateManager({ a: null, b: null })}>{children}</Provider>
     */
    readonly Provider: FC<ProvderProps<S>>;

    /**
     * If you want to use the state as a hook
     * Check out `Filter<R>` for more complex filtering
     * @example useExtendedState((s) => s.a)
     * @example useExtendedState((s) => s.a, (s) => s.a)
     */
    readonly useExtendedState: <R>(state: Selector<S, R>, filter?: Filter<R>) => R;

    /**
     * If you want to update the state
     * @example useExtendedStateDispatcher()({ a: null })
     */
    readonly useExtendedStateDispatcher: Dispatcher<S>;
};

export const createExtendedState = <S extends PossibleExtendedState>(): ExtendedState<S> => {
    const Context = createContext<ExtendedStateManager<S> | null>(null);

    const getManager = (caller: CapturePoint): ExtendedStateManager<S> => {
        const state = useContext(Context);

        if (state) {
            return state;
        }

        return throwCaptured(new Error('Must be used with-in a Provider'), caller);
    };

    const Provider: ExtendedState<S>['Provider'] = ({ children, ...props }) => {
        /**
         * The manager is created at the beginning
         * All actions will be applied on to it
         */
        const manager = useMemo(() => ('initial' in props ? new ExtendedStateManager(props.initial) : props.manager), [
            'initial' in props ? props.initial : props.manager,
        ]);

        return <Context.Provider value={manager}>{children}</Context.Provider>;
    };

    const useExtendedState: ExtendedState<S>['useExtendedState'] = (selector, filter) => {
        /**
         * First retrieve the context
         */
        const manager = getManager(useExtendedState);

        /**
         * Calulate initial value and set it to the result
         */
        const [currentResult, setResult] = useState(() => selector(manager.getState()));

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
                    /**
                     * If the the value being returned is a function
                     * Then it needs to be wrapped in another function in order to avoid its execution
                     *
                     * The reason?
                     * https://reactjs.org/docs/hooks-reference.html#functional-updates
                     */
                    () => {
                        const newValue = selector(manager.getState());
                        setResult(typeof newValue === 'function' ? () => newValue : newValue);
                    }
                ),
            []
        );

        return currentResult;
    };

    const useExtendedStateDispatcher: ExtendedState<S>['useExtendedStateDispatcher'] = () => {
        /**
         * First retrieve the context
         */
        const manager = getManager(useExtendedStateDispatcher);

        return (newStateOrGenerator) => {
            const state = newStateOrGenerator instanceof Function ? newStateOrGenerator(manager.getState()) : newStateOrGenerator;
            manager.setState(state);
        };
    };

    return { Provider, useExtendedState, useExtendedStateDispatcher };
};
