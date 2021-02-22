import React, { ConsumerProps, FC } from 'react';
import { render } from '@testing-library/react';

import { createExtendedState as createExtendedState, Dispatcher } from '.';

import { ExtendedStateManager } from '..';

type State = { readonly a: string | null; readonly b: string | null };
const { Provider, useExtendedState, useExtendedStateDispatcher } = createExtendedState<{ readonly a: string | null; readonly b: string | null }>();

const Helper: FC<ConsumerProps<void>> = ({ children }) => {
    return <>{children()}</>;
};

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
});
