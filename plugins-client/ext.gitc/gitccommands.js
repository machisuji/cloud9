/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var parseLine; // module loaded on demand
var ide     = require("core/ide");

module.exports = (function() {
    
    function GitCommands() {
        this.command_id_tracer = 1;
        this.command_to_callback_map = {};
    }

    GitCommands.prototype = {

        /**
         * Sends a git command and returns the output to callback.
         * 
         * @param {string} command A git command, e.g. "status" or "commit -m"
         * @param {function} callback A function that will be executed when the output of the 
         *          command is caught. The function will get the output as the first argument
         *          and the stream ("stdout", "stderr") as second.
         */
        send : function(command, callback) {
            if(!command)
                return; //no command

            parseLine || (parseLine = require("ext/console/parser"));
            var argv = parseLine(command);
            if (!argv || argv.length === 0) // no command
                return;

            argv.unshift("gitc");

            var data = {
                command: argv[0],
                argv: argv,
                line: command,
                cwd: ide.workspaceDir,
                requireshandling: false,
                extra : {
                    command_id : this.command_id_tracer
                }
            }

            if(!ide.onLine) {
                alert('Ide is offline.');
            }

            ide.send(data);

            this.command_to_callback_map[this.command_id_tracer] = callback;
            this.command_id_tracer++;
        },

        onMessage : function(e) {
            var msg = e.message;

            if(msg.type != "gitc-dt")
                return;      

            console.log("gitc result at pid " +msg.pid+ ": " + msg.data);

            //TODO collect all outputs with same pid
            var command = this.command_to_callback_map[msg.extra.command_id];
            if (command) {
                callback(msg.data, msg.stream);
            }

        }
    };

    return GitCommands;
})();

});