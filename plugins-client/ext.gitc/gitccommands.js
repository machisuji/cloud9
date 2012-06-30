/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var parseLine; // module loaded on demand
var ide     = require("core/ide");
var GitParser = require("ext/gitc/gitparser");

module.exports = (function() {
    
    function GitCommands() {
        this.command_id_tracer = 1;
        this.command_to_callback_map = {};
        this.pid_to_message_map = {};
        this.git_parser = new GitParser();
    }

    GitCommands.prototype = {

        /**
         * Sends a command and returns the output to callback.
         * 
         * @param {string} command A command, e.g. "git status", "git commit -m" or "ls"
         * @param {function} callback A function that will be executed when the output of the 
         *          command is caught. The callback will get the output as the first argument
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
            return this.command_id_tracer++;
        },

        /**
         * Catches the output message of an event.
         *
         * @param {apf.AmlEvent} e holds the message and its extra data.
         */
        onMessage : function(e) {
            var msg = e.message;

            if(msg.type == "gitc-srt") {
                this.pid_to_message_map[msg.pid] = {data: ""};
            }

            if(msg.type == "gitc-dt"){
                this.pid_to_message_map[msg.pid].stream = msg.stream;
                this.pid_to_message_map[msg.pid].data += msg.data;
            }      

            if(msg.type == "gitc-ext") {
                var callback = this.command_to_callback_map[msg.extra.command_id];
                var output = this.pid_to_message_map[msg.pid];
                if (callback) {
                    var result = {data: output.data, stream: output.stream, args: msg.extra.args};
                    callback(result, this.git_parser);
                }
                delete this.command_to_callback_map[msg.extra.command_id];
                delete this.pid_to_message_map[msg.pid];
            }
        }

    };

    return GitCommands;
})();

});