import loggerMiddleware from './middleware/logger';
import rootReducer from './reducers';
import {applyMiddleware, compose} from 'redux';
import {createStore} from 'redux';
import thunkMiddleware from 'redux-thunk';

const middlewareEnhancer = applyMiddleware(loggerMiddleware,
  thunkMiddleware);

export default createStore(rootReducer, undefined, compose(middlewareEnhancer));

export type RootState = ReturnType<typeof rootReducer>;
