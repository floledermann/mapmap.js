import setImmediate from "setimmediate";

// global state singleton
export default (function() {
    
    var lastState = {};
    var subscribers = [];
    
    var state = function(_state) {
        if (_state !== undefined) {
            lastState = _state;
            subscribers.forEach(sub => sub.state(_state));
        }
        return lastState;
    };
    state.subscribe = function(subscriber) {
        subscribers.push(subscriber);
        // should we do this - immediately update to current state?
        // isolate through setImmediate to have callback separated
        setImmediate(() => subscriber.state(lastState));
    };
    return state;
})();