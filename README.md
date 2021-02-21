# react-extended-state

Sometimes `React.useState` and `React.useReducer` are not enough.<br />
Sometimes you need to have a complex object and still be concerned about speed of your react components on updates.<br />
Dont want to shell out for `redux`? Actions are too much or confusing for you?<br />
Then this is a perfect solution for you! A simple react provider and hook implementation to allow for state management of complex objects.<br />

---

### Quick overview:

-   It is light
-   It has type checking at its core
-   Easy setup (under 5 lines)
-   No more useless renders!
-   **No** right wing conspiracy, only a react helper :)

Usage:

```tsx
import React, { FC } from 'react';
import { render } from 'react-dom';
import { createDeepState } from 'react-extended-state';

type State = { readonly name: string };

const { Provider, useDeepState, useDeepStateDispatcher } = createDeepState<State>();

const App: FC = () => {
    const name = useDeepState((s) => s.name);
    const dispatch = useDeepStateDispatcher();

    return (
        <div>
            <label>Name: ${name}</label>
            <input type="text" value={name} onChange={(e) => dispatch({ name: e.target.value })} />
        </div>
    );
};

render(
    <Provider initial={{ name: '' }}>
        <App />
    </Provider>,
    document.querySelector('#root')
);
```

### LICENSE

MIT
