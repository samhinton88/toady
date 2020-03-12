// persist state throughout sequence
const bindState = initialState => (middleware) => {
    let state;

    middleware.forEach((mw) => {
        state = {
            ...state,
            ...mw()
        };
    });
}

// access through middleware

