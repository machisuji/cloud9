 /**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

module.exports = (function() {
    
    function Annotation(row, type, chunk, text, status) {
        this.row = row;
        this.type = type;
        this.chunk = chunk;
        this.text = text;
        this.status = status;
        this.tooltip = undefined;
    }

    Annotation.prototype = {
    	
    };
    
    return Annotation;
})();

});