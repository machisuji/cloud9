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
        this.command_to_inner_callback_map = {};
        this.command_to_outer_callback_map = {};
        this.pid_to_message_map = {};
        this.git_parser = new GitParser();
    }

    GitCommands.prototype = {

        /**
         * Sends a git command and returns the output to callback.
         * 
         * @param {string} command A git command, e.g. "status" or "commit -m"
         * @param {function} callback A function that will be executed when the output of the 
         *          command is caught. The callback will get the output as the first argument
         *          and the stream ("stdout", "stderr") as second.
         */
         //TODO find better way than to use inner and outer callback...
        send : function(command, callback_inner, callback_outer) {
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

            this.command_to_inner_callback_map[this.command_id_tracer] = callback_inner;
            this.command_to_outer_callback_map[this.command_id_tracer] = callback_outer;
            return this.command_id_tracer++;
        },

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
                var callback = this.command_to_inner_callback_map[msg.extra.command_id];
                var outer_callback = this.command_to_outer_callback_map[msg.extra.command_id];
                var output = this.pid_to_message_map[msg.pid];
                if (callback) {
                    callback(output.data, output.stream, outer_callback);
                }
                delete this.command_to_inner_callback_map[msg.extra.command_id];
                delete this.command_to_outer_callback_map[msg.extra.command_id];
                delete this.pid_to_message_map[msg.pid];
            }

        },

        /**
         * Sends 'git status -s' command and returns the changed files to callback.
         * 
         * @param {function} callback A function that will be executed when the output of the 
         *          command is caught and parsed.
         */
        getChangedFiles : function(callback) {
            var id = this.send("status -s", this.git_parser.parseShortStatus, callback);
        },

        getChangesInFile : function(filename, callback) {
            //diff -> unstaged changes; diff --cached -> staged changes; 
            //git diff HEAD --> all staged or unstaged changes
            this.send("diff " + filename, this.git_parser.parseDiffForChangesInFile, callback);
        }



    };

    return GitCommands;
})();

});