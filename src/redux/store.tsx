
import loggerMiddleware from "./middleware/logger";
import monitorReducerEnhancer from "./enhancers/monitorReducer";
import rootReducer from "./reducers";
import {applyMiddleware, compose} from "redux";
import {createStore} from "redux";
import thunkMiddleware from "redux-thunk";

const middlewareEnhancer = applyMiddleware(loggerMiddleware,
  thunkMiddleware);

export default createStore(rootReducer, undefined, compose(middlewareEnhancer, monitorReducerEnhancer));

export type RootState = ReturnType<typeof rootReducer>;
