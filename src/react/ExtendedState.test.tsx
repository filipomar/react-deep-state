import React, { ConsumerProps, FC, useState } from 'react';
import { act, fireEvent, render, findByTestId } from '@testing-library/react';

import { createExtendedState as createExtendedState, Dispatcher } from '.';

import { ExtendedStateManager } from '..';

type State = { readonly a: string | null; readonly b: string | null };
const { Provider, useExtendedState, useExtendedStateDispatcher } = createExtendedState<{ readonly a: string | null; readonly b: string | null }>();

const Helper: FC<ConsumerProps<void>> = ({ children }) => {
    return <>{children()}</>;
};

const delay = async (time: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, time));

describe(createExtendedState.name, () => {
    it('throws error if hooks are called outside of provider', () => {
        const errorSpy = jest.spyOn(console, 'error').mockReturnValue();
        expect(() => render(<Helper>{() => <>{useExtendedState((s) => s.a)}</>}</Helper>)).toThrowError(new Error('Must be used with-in a Provider'));
        expect(errorSpy).toBeCalledTimes(2);
    });

    it('allows for usage of useExtendedState hook inside of it', () => {
        const renderSpy = jest.fn();

        const { container } = render(
            <Provider initial={{ a: null, b: null }}>
                <Helper>
                    {() => {
                        const a = useExtendedState((s) => s.a);
                        renderSpy();
                        return <>{String(a)}</>;
                    }}
                </Helper>
            </Provider>
        );

        expect(container.innerHTML).toBe(String(null));
        expect(renderSpy).toBeCalledTimes(1);
    });

    it('only causes re-renders when useExtendedState hook deems necessary', () => {
        const renderSpy = jest.fn();

        const manager = new ExtendedStateManager<State>({ a: null, b: null });

        const { container } = render(
            <Provider manager={manager}>
                <Helper>
                    {() => {
                        const a = useExtendedState((s) => s.a);
                        renderSpy();
                        return <>{String(a)}</>;
                    }}
                </Helper>
            </Provider>
        );

        expect(container.innerHTML).toBe(String(null));
        expect(renderSpy).toBeCalledTimes(1);

        /**
         * A has changed, new render expected
         */
        manager.setState({ a: '1' });
        expect(container.innerHTML).toBe(String('1'));
        expect(renderSpy).toBeCalledTimes(2);

        /**
         * The same value is there again, no render
         */
        manager.setState({ a: '1' });
        expect(container.innerHTML).toBe(String('1'));
        expect(renderSpy).toBeCalledTimes(2);

        /**
         * Another value is set, new render
         */
        manager.setState({ a: '2' });
        expect(container.innerHTML).toBe(String('2'));
        expect(renderSpy).toBeCalledTimes(3);

        /**
         * Another prop is set, no render
         */
        manager.setState({ b: 'B' });
        expect(container.innerHTML).toBe(String('2'));
        expect(renderSpy).toBeCalledTimes(3);

        /**
         * Same value is set, no render
         */
        manager.setState({ a: '2' });
        expect(container.innerHTML).toBe(String('2'));
        expect(renderSpy).toBeCalledTimes(3);

        /**
         * Another value is set, new render
         */
        manager.setState({ a: '3' });
        expect(container.innerHTML).toBe(String('3'));
        expect(renderSpy).toBeCalledTimes(4);
    });

    it('allows for custom hook change filter', () => {
        const renderSpy = jest.fn();

        const manager = new ExtendedStateManager<State>({ a: null, b: null });
        const filterSpy = jest.fn<string | null, [State]>().mockImplementation((s) => s.a);

        const { container } = render(
            <Provider manager={manager}>
                <Helper>
                    {() => {
                        const { a } = useExtendedState((s) => s, filterSpy);
                        renderSpy();
                        return <>{String(a)}</>;
                    }}
                </Helper>
            </Provider>
        );

        expect(container.innerHTML).toBe(String(null));
        expect(renderSpy).toBeCalledTimes(1);
        expect(filterSpy).toBeCalledTimes(0);

        manager.setState({ a: '1' });
        expect(renderSpy).toBeCalledTimes(2);
        expect(filterSpy).toBeCalledTimes(2);

        /**
         * Even with no changes, the filter is called
         */
        manager.setState({ a: '1' });
        expect(renderSpy).toBeCalledTimes(2);
        expect(filterSpy).toBeCalledTimes(4);

        /**
         * New state, causes new render and new filter calls
         */
        manager.setState({ a: '2' });
        expect(renderSpy).toBeCalledTimes(3);
        expect(filterSpy).toBeCalledTimes(6);
    });

    it('allows for internal dispatching of changes', () => {
        const renderSpy = jest.fn<void, [ReturnType<Dispatcher<State>>]>();

        const { container } = render(
            <Provider initial={{ a: null, b: null }}>
                <Helper>
                    {() => {
                        const dispatch = useExtendedStateDispatcher();
                        const a = useExtendedState((s) => s.a);
                        renderSpy(dispatch);
                        return <>{String(a)}</>;
                    }}
                </Helper>
            </Provider>
        );

        expect(container.innerHTML).toBe(String(null));
        expect(renderSpy).toBeCalledTimes(1);

        const [[dispatcher]] = renderSpy.mock.calls;

        dispatcher({ a: '1' });
        expect(container.innerHTML).toBe(String('1'));
        expect(renderSpy).toBeCalledTimes(2);
    });

    it('allows for the usage of selectors that yield functions without calling them', () => {
        type State = { readonly handler: () => void };

        const { Provider, useExtendedState, useExtendedStateDispatcher } = createExtendedState<State>();

        const firstHandler = jest.fn<void, []>();
        const secondHandler = jest.fn<void, []>();

        const { container } = render(
            <Provider initial={{ handler: firstHandler }}>
                <Helper>
                    {() => {
                        const dispatch = useExtendedStateDispatcher();
                        const onClick = useExtendedState((s) => s.handler);

                        return (
                            <div>
                                <div id="reciever" onClick={onClick}>
                                    Click on me to execute
                                </div>
                                <div id="changer" onClick={() => dispatch({ handler: secondHandler })}>
                                    Click on me to change the executor
                                </div>
                            </div>
                        );
                    }}
                </Helper>
            </Provider>
        );

        /**
         * No calls were made
         */
        expect(firstHandler).toBeCalledTimes(0);
        expect(secondHandler).toBeCalledTimes(0);

        const reciever = container.querySelector('#reciever');
        const changer = container.querySelector('#changer');

        if (!reciever) {
            fail('Reciever was expected');
        }

        if (!changer) {
            fail('Changer was expected');
        }

        /**
         * Execute the handler
         */
        fireEvent.click(reciever);

        /**
         * The first handler should have been called once
         */
        expect(firstHandler).toBeCalledTimes(1);
        expect(secondHandler).toBeCalledTimes(0);

        /**
         * Swap the first for the second
         */
        fireEvent.click(changer);

        /**
         * No additional calls are made
         */
        expect(firstHandler).toBeCalledTimes(1);
        expect(secondHandler).toBeCalledTimes(0);

        /**
         * Execute the handler
         */
        fireEvent.click(reciever);

        /**
         * Second handler is called
         */
        expect(firstHandler).toBeCalledTimes(1);
        expect(secondHandler).toBeCalledTimes(1);
    });

    it('allows state update through derived state generation', () =>
        act(async () => {
            type State = { readonly value: number; readonly undisturbed: number };
            const renderSpy = jest.fn<void, [ReturnType<Dispatcher<State>>]>();

            const { Provider, useExtendedState, useExtendedStateDispatcher } = createExtendedState<State>();

            const { container } = render(
                <Provider initial={{ value: 2, undisturbed: 1 }}>
                    <Helper>
                        {() => {
                            const dispatch = useExtendedStateDispatcher();
                            renderSpy(dispatch);
                            return <>{useExtendedState((s) => `[${s.value},${s.undisturbed}]`)}</>;
                        }}
                    </Helper>
                </Provider>
            );

            await delay(0);

            /**
             * Initial state
             */
            expect(container.innerHTML).toBe('[2,1]');

            const [[dispatcher]] = renderSpy.mock.calls;

            /**
             * Update value, read from the whole state, but pass only the value
             */
            dispatcher(({ value, undisturbed }) => ({ value: value * 2 + undisturbed }));

            await delay(0);

            expect(container.innerHTML).toBe('[5,1]');

            dispatcher(({ value, undisturbed }) => ({ value: value * 2 + undisturbed }));

            await delay(0);

            expect(container.innerHTML).toBe('[11,1]');
        }));

    it('properly subscribes event even if changes are made before final render', () =>
        act(async () => {
            type State = { readonly value: number };
            const state = new ExtendedStateManager<State>({ value: 1 });

            const { Provider, useExtendedState } = createExtendedState<State>();

            const { container, unmount } = render(
                <Provider manager={state}>
                    <Helper>
                        {() => {
                            const state = useExtendedState((s) => s.value);
                            return <>{state}</>;
                        }}
                    </Helper>
                </Provider>
            );

            /**
             * Initial value is outputed
             */
            expect(container.textContent).toBe(String(1));

            /**
             * Update the outputed value even before the render is completeled
             */
            state.setState({ value: 2 });

            /**
             * Needs a quick second to update
             */
            expect(container.textContent).toBe(String(1));

            /**
             * Await for update
             */
            await delay(0);

            /**
             * Change was detected
             */
            expect(container.textContent).toBe(String(2));

            await delay(100);

            /**
             * Further updates after a couple of milliseconds
             */
            state.setState({ value: 3 });

            /**
             * Update is done right away
             */
            expect(container.textContent).toBe(String(3));

            unmount();
        }));

    it('will change provider if provider props are updated', () =>
        act(async () => {
            type State = { readonly value: number };

            const { Provider, useExtendedState } = createExtendedState<State>();

            const { container, unmount } = render(
                <Helper>
                    {() => {
                        const [value, setValue] = useState(0);

                        return (
                            <>
                                <button data-testid="button" onClick={() => setValue(1)}>
                                    Click me!
                                </button>
                                <div>Outer value: {value}</div>
                                <Provider initial={{ value }}>
                                    <Helper>
                                        {() => {
                                            const value = useExtendedState((s) => s.value);
                                            return (
                                                <>
                                                    <div>Internal value: {value}</div>
                                                </>
                                            );
                                        }}
                                    </Helper>
                                </Provider>
                            </>
                        );
                    }}
                </Helper>
            );

            /**
             * Initial value set to 0 everywhere
             */
            expect(Array.from(container.querySelectorAll('div')).map((el) => el.textContent)).toStrictEqual(['Outer value: 0', 'Internal value: 0']);

            fireEvent.click(await findByTestId(container, 'button'));

            /**
             * Initial value set to 1 everywhere
             */
            expect(Array.from(container.querySelectorAll('div')).map((el) => el.textContent)).toStrictEqual(['Outer value: 1', 'Internal value: 1']);

            unmount();
        }));

    it('will not change provider if provider props are updated', () =>
        act(async () => {
            type State = { readonly value: number };

            const { Provider, useExtendedState } = createExtendedState<State>({ ignoreInitialPropsChanges: true });

            const { container, unmount } = render(
                <Helper>
                    {() => {
                        const [value, setValue] = useState(0);

                        return (
                            <>
                                <button data-testid="button" onClick={() => setValue(1)}>
                                    Click me!
                                </button>
                                <div>Outer value: {value}</div>
                                <Provider initial={{ value }}>
                                    <Helper>
                                        {() => {
                                            const value = useExtendedState((s) => s.value);
                                            return (
                                                <>
                                                    <div>Internal value: {value}</div>
                                                </>
                                            );
                                        }}
                                    </Helper>
                                </Provider>
                            </>
                        );
                    }}
                </Helper>
            );

            /**
             * Initial value set to 0 everywhere
             */
            expect(Array.from(container.querySelectorAll('div')).map((el) => el.textContent)).toStrictEqual(['Outer value: 0', 'Internal value: 0']);

            fireEvent.click(await findByTestId(container, 'button'));

            /**
             * Initial value set to 1 only outside the provider
             */
            expect(Array.from(container.querySelectorAll('div')).map((el) => el.textContent)).toStrictEqual(['Outer value: 1', 'Internal value: 0']);

            unmount();
        }));
});
