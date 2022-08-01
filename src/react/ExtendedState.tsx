import React, { createContext, FC, PropsWithChildren, useContext, useLayoutEffect, useMemo, useState, DependencyList, useRef, useCallback } from 'react';

import { ExtendedStateManager, areResultsEqual, Filter, PossibleExtendedState } from '../ExtendedStateManager';
import { CapturePoint, throwCaptured } from '../utils';

export type ProvderProps<S extends PossibleExtendedState> = Readonly<{ value: S } | { manager: ExtendedStateManager<S> }>;
export type Selector<S, R> = (s: S) => R;
export type Dispatcher<S> = () => (newStateOrGenerator: Partial<S> | ((currentState: S) => Partial<S>)) => void;

type NormalizedUseExtendedStateArgs<S, R> = Readonly<{ selector: Selector<S, R>; filter: Filter<R> | null; dependencies: DependencyList }>;

type UseExtendedStateArgs<S, R> =
    | [selector: Selector<S, R>, filter?: Filter<R>, dependencies?: DependencyList]
    | [selector: Selector<S, R>, dependencies?: DependencyList, filter?: Filter<R>];

const normalizeArgs = <S, R>([selector, ...rest]: UseExtendedStateArgs<S, R>): NormalizedUseExtendedStateArgs<S, R> => ({
    selector,
    filter: rest.find((a): a is Exclude<NormalizedUseExtendedStateArgs<S, R>['filter'], null> => a instanceof Function) || null,
    dependencies: rest.find((a): a is NormalizedUseExtendedStateArgs<S, R>['dependencies'] => Array.isArray(a)) || [],
});

/**
 * Creates the `ExtendedState` object necessary to create and manage an extended state on react
 * Allowing simple way to manage a state with-out unnecessary renders
 *
 * @example const { Provider, useExtendedState, useExtendedStateDispatcher } = createExtendedState<Readonly<{ a: string | null; }>>();
 */
export type ExtendedState<S extends PossibleExtendedState> = Readonly<{
    /**
     * The provider of the extended state
     *
     * @example <Provider value={{ a: null, b: null }}>{children}</Provider>
     * @example <Provider manager={new ExtendedStateManager({ a: null, b: null })}>{children}</Provider>
     */
    Provider: FC<PropsWithChildren<ProvderProps<S>>>;

    /**
     * If you want to use the state as a hook
     * Check out `Filter<R>` for more complex filtering
     * @example useExtendedState((s) => s.a)
     * @example useExtendedState((s) => s.a, (s) => s.a)
     * @example useExtendedState((s) => s.a[b], (s) => s.a[b], [b])
     * @example useExtendedState((s) => s.a[b], [b], (s) => s.a[b])
     * @example useExtendedState((s) => s.a[b], [b])
     */
    useExtendedState: <R>(...args: UseExtendedStateArgs<S, R>) => R;

    /**
     * If you want to update the state
     * @example useExtendedStateDispatcher()({ a: null })
     */
    useExtendedStateDispatcher: Dispatcher<S>;
}>;

type CreateExtendedStateArgs = Readonly<{
    /**
     * Ignore if changes the Provider props should result in changes of the state
     * @default false
     */
    ignorePropsChanges?: boolean;
}>;

/**
 * For your sanity
 * Call this outside of react rendering cycles ;)
 */
export const createExtendedState = <S extends PossibleExtendedState>({ ignorePropsChanges = false }: CreateExtendedStateArgs = {}): ExtendedState<S> => {
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
        const manager = useMemo(() => ('value' in props ? new ExtendedStateManager(props.value) : props.manager), []);

        if (!ignorePropsChanges) {
            /**
             * If changes to the arguments are made
             * The state is updated
             */
            useLayoutEffect(() => {
                const state: S = 'value' in props ? props.value : props.manager.getState();
                if (state !== manager.getState()) {
                    manager.setState(state);
                }
            }, ['value' in props ? props.value : props.manager]);
        }

        return <Context.Provider value={manager}>{children}</Context.Provider>;
    };

    const useExtendedState: ExtendedState<S>['useExtendedState'] = (...args) => {
        /** Make sure args are properly assigned */
        const { selector, filter, dependencies } = normalizeArgs(args);

        /** First retrieve the context */
        const manager = getManager(useExtendedState);

        /** Aux ref to cheaply carry out the internal behaviours of the hook */
        const firstRender = useRef<S | null>(manager.getState());

        /** Calulate initial value and set it to the result */
        const [currentResult, setResult] = useState(() => selector(manager.getState()));

        /** Memoized updater of values, as the dependencies given from above change, so will the setter */
        const updateValue = useCallback(() => {
            const newValue = selector(manager.getState());

            /**
             * If the the value being returned is a function
             * Then it needs to be wrapped in another function in order to avoid its execution
             *
             * The reason?
             * https://reactjs.org/docs/hooks-reference.html#functional-updates
             */
            setResult(typeof newValue === 'function' ? () => newValue : newValue);
        }, [manager, ...dependencies]);

        /** Subscribes to further value changes at the first possible moment */
        useLayoutEffect(
            () => manager.subscribe((previousState, currentState) => {
                const previous = selector(previousState);
                const current = selector(currentState);

                if (previous === current) {
                    /** Primitive match, no need to check anything else */
                    return true;
                }

                /** Custom expensive filter */
                return Boolean(filter && areResultsEqual(current, previous, filter));
            }, updateValue),
            [manager, updateValue],
        );

        /** Updates the value if a change in the value occured between the firstRender and subscription */
        useLayoutEffect(() => {
            if (firstRender.current !== null && firstRender.current !== manager.getState()) {
                /**
                 * The state was changed between the hook and the layout effect execution
                 * Therefore this needs to be updated
                 */
                updateValue();
            }
        }, [manager, firstRender, updateValue]);

        /** Updates the value if there has been a change to the scope of the value updater */
        useLayoutEffect(() => {
            if (firstRender.current === null) {
                /** It is not on the first render, and there are dependencies (which caused later triggers) */
                updateValue();
            }
        }, [manager, updateValue]);

        useLayoutEffect(() => {
            /** Mark first render as done */
            firstRender.current = null;
        }, []);

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
