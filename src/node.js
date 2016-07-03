export default Node;

import state from "state";

function Node(options) {
    state.subscribe(this);
    
    this.listeners = [];
    this.cachedResult = null;
};

Node.prototype.state = function(state) {
    // TODO: extract options from state
    this._do(options);
};

Node.prototype._do = function(options, data) {
    this.error("Nothing to do in Node._do - use or implement subclass!");
    this.pushDownstream(data);
};

Node.prototype.pushDownstream = function(data) {
    this.cachedResult = data;
    this.listeners.forEach(listener => listener.update(data));
};

Node.prototype.pullData = function() {
    return this.cachedResult;
};

Node.prototype.pushError = function(error) {
    console.err("pushError is not implemented");
    console.err("Error: " + error);
};

