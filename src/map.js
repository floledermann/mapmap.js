export default Map;


// not sure if this is even needed right now

function Map(options) {
    if (!this instanceof Map) return new Map(options);
    this.nodes = [];
    return this;
};

