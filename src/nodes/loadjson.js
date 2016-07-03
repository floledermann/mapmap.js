export default LoadJSON;

import Node from "../node";

// -[URL] => Object
function LoadJSON(options) {
    
};

LoadJSON.prototype._do = function(options) {
    // TODO: pseudocode
    loadJSON.then((data, error) => {
        if (!error) {
            this.pushDownstream(data);
        }
        else {
            this.pushError(error);
        }
    });
};
