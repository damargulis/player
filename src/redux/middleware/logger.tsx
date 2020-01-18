import {Action, Dispatch, MiddlewareAPI} from 'redux';
/* tslint:disable:no-console */
const logger = ({getState}: MiddlewareAPI) => (next: Dispatch) => (action: Action) => {
    console.group(action.type);
    console.info('dispatching', action);
    const result = next(action);
    console.log('next state', getState());
    console.groupEnd();
    return result;
};

export default logger;
