import { ExtendedStateManager } from '.';

type State = Readonly<{ a: string | null; b: string | null }>;

describe(ExtendedStateManager.name, () => {
    it('listens to any changes if no filter is passed', () => {
        const subscriber = jest.fn();

        const manager = new ExtendedStateManager<State>({ a: null, b: null });
        const unsub = manager.subscribe(subscriber);

        expect(manager.getState()).toStrictEqual<State>({ a: null, b: null });
        expect(subscriber).toHaveBeenCalledTimes(0);

        manager.setState({ b: 'B' });

        expect(manager.getState()).toStrictEqual<State>({ a: null, b: 'B' });
        expect(subscriber).toHaveBeenCalledTimes(1);

        manager.setState({ a: 'A' });

        expect(manager.getState()).toStrictEqual<State>({ a: 'A', b: 'B' });
        expect(subscriber).toHaveBeenCalledTimes(2);

        unsub();

        manager.setState({ a: null, b: null });

        expect(manager.getState()).toStrictEqual<State>({ a: null, b: null });
        expect(subscriber).toHaveBeenCalledTimes(2);
    });

    it('gets called only to changes that pass through the filter', () => {
        const subscriber = jest.fn();
        const filter = jest.fn().mockImplementation((previous: State, current: State) => previous.b === current.b);

        const manager = new ExtendedStateManager<State>({ a: null, b: null });
        const unsub = manager.subscribe(filter, subscriber);

        /**
         * Validating initial state
         */
        expect(manager.getState()).toStrictEqual<State>({ a: null, b: null });
        expect(filter).toHaveBeenCalledTimes(0);
        expect(subscriber).toHaveBeenCalledTimes(0);

        /**
         * On first change, the sub should be called as value changed from null to 'B'
         */
        manager.setState({ b: 'B' });
        expect(manager.getState()).toStrictEqual<State>({ a: null, b: 'B' });
        expect(filter).toHaveBeenCalledTimes(1);
        expect(subscriber).toHaveBeenCalledTimes(1);

        /**
         * The sub should not be called as value of B did not change
         */
        manager.setState({ a: 'A' });
        expect(manager.getState()).toStrictEqual<State>({ a: 'A', b: 'B' });
        expect(filter).toHaveBeenCalledTimes(2);
        expect(subscriber).toHaveBeenCalledTimes(1);

        /**
         * The sub should not be called as the value did not actually changed
         */
        manager.setState({ b: 'B' });
        expect(manager.getState()).toStrictEqual<State>({ a: 'A', b: 'B' });
        expect(filter).toHaveBeenCalledTimes(3);
        expect(subscriber).toHaveBeenCalledTimes(1);

        unsub();

        /**
         * The sub should not be called because unsub already happened
         */
        manager.setState({ a: null, b: null });
        expect(manager.getState()).toStrictEqual<State>({ a: null, b: null });
        expect(filter).toHaveBeenCalledTimes(3);
        expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('gets called only when the hash changes', () => {
        const subscriber = jest.fn();
        const filter = jest.fn().mockImplementation((state: State) => state.b);

        const manager = new ExtendedStateManager<State>({ a: null, b: null });
        const unsub = manager.subscribe(filter, subscriber);

        /**
         * Validating initial state
         */
        expect(manager.getState()).toStrictEqual<State>({ a: null, b: null });
        expect(filter).toHaveBeenCalledTimes(0);
        expect(subscriber).toHaveBeenCalledTimes(0);

        /**
         * On first change, the sub should be called as value changed from null to 'B'
         */
        manager.setState({ b: 'B' });
        expect(manager.getState()).toStrictEqual<State>({ a: null, b: 'B' });
        expect(filter).toHaveBeenCalledTimes(2);
        expect(subscriber).toHaveBeenCalledTimes(1);

        /**
         * The sub should not be called as value of B did not change
         */
        manager.setState({ a: 'A' });
        expect(manager.getState()).toStrictEqual<State>({ a: 'A', b: 'B' });
        expect(filter).toHaveBeenCalledTimes(4);
        expect(subscriber).toHaveBeenCalledTimes(1);

        /**
         * The sub should not be called as the value did not actually changed
         */
        manager.setState({ b: 'B' });
        expect(manager.getState()).toStrictEqual<State>({ a: 'A', b: 'B' });
        expect(filter).toHaveBeenCalledTimes(6);
        expect(subscriber).toHaveBeenCalledTimes(1);

        unsub();

        /**
         * The sub should not be called because unsub already happened
         */
        manager.setState({ a: null, b: null });
        expect(manager.getState()).toStrictEqual<State>({ a: null, b: null });
        expect(filter).toHaveBeenCalledTimes(6);
        expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('allows for the unsub method to be called more than once without issues', () => {
        const subscriberOne = jest.fn();
        const subscriberTwo = jest.fn();
        const subscriberThree = jest.fn();

        const manager = new ExtendedStateManager<State>({ a: null, b: null });

        const unsubOne = manager.subscribe(subscriberOne);
        const unsubTwo = manager.subscribe(subscriberTwo);
        const unsubThree = manager.subscribe(subscriberThree);

        expect(manager.getState()).toStrictEqual<State>({ a: null, b: null });
        expect(subscriberOne).toHaveBeenCalledTimes(0);
        expect(subscriberTwo).toHaveBeenCalledTimes(0);
        expect(subscriberThree).toHaveBeenCalledTimes(0);

        manager.setState({ a: 'A' });

        expect(subscriberOne).toHaveBeenCalledTimes(1);
        expect(subscriberTwo).toHaveBeenCalledTimes(1);
        expect(subscriberThree).toHaveBeenCalledTimes(1);

        /**
         * Unsub first time
         */
        unsubTwo();

        manager.setState({ a: 'A' });

        expect(subscriberOne).toHaveBeenCalledTimes(2);
        expect(subscriberTwo).toHaveBeenCalledTimes(1);
        expect(subscriberThree).toHaveBeenCalledTimes(2);

        /**
         * Unsub second time
         */
        unsubTwo();

        manager.setState({ a: 'A' });

        expect(subscriberOne).toHaveBeenCalledTimes(3);
        expect(subscriberTwo).toHaveBeenCalledTimes(1);
        expect(subscriberThree).toHaveBeenCalledTimes(3);

        /**
         * Unsub others
         */
        unsubOne();
        unsubThree();

        /**
         * Call again with no expected subscription calls
         */

        manager.setState({ a: 'A' });

        expect(subscriberOne).toHaveBeenCalledTimes(3);
        expect(subscriberTwo).toHaveBeenCalledTimes(1);
        expect(subscriberThree).toHaveBeenCalledTimes(3);
    });
});
