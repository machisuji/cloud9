"use strict";

var util = require("util");

var Plugin = require("../cloud9.core/plugin");
var c9util = require("../cloud9.core/util");
var Fs = require("fs");

var name = "gitc";
var ProcessManager;
var EventBus;

module.exports = function setup(options, imports, register) {
    ProcessManager = imports["process-manager"];
    EventBus = imports.eventbus;
    imports.ide.register(name, GitcPlugin, register);
};

var GitcPlugin = function(ide, workspace) {
    Plugin.call(this, ide, workspace);

    this.pm = ProcessManager;
    this.eventbus = EventBus;
    this.workspaceId = workspace.workspaceId;
    this.channel = this.workspaceId + "::gitc";

    this.hooks = ["command"];
    this.name = "gitc";

    this.gitEnv = {
        GIT_ASKPASS: "/bin/echo",
        EDITOR: "",
        GIT_EDITOR: ""
    };

    this.processCount = 0;
};

util.inherits(GitcPlugin, Plugin);

(function() {
    /**
     * Initialize our plug-in: Register on eventbus to get notice
     * of messages send via our channel and adjust message type so
     * that other (client-side) extensions will not get notified
     * about our stuff.
     */
    this.init = function() {

        var self = this;
        this.eventbus.on(this.channel, function(msg) {
            if (msg.extra.nobroadcast === true) {
                return;
            }
            if (msg.type == "shell-start") {
                self.processCount += 1;
                msg.type = "gitc-srt";
            }

            if (msg.type == "shell-exit") {
                self.processCount -= 1;
                msg.type = "gitc-ext";
            }

            if (msg.type == "shell-data") {
                msg.type = "gitc-dt";
            }
            self.ide.broadcast(JSON.stringify(msg), self.name);
        });
    };

    /**
     * React on gitc-commands and spawn them as shell commands.
     * When command contains argument "gitcdiff" then treat is separately.
     */
    this.command = function (user, message, client) {
        var self = this;
        var cmd = message.command ? message.command.toLowerCase() : "";

        if (cmd !== "gitc") {
            return false;
        }


        if (typeof message.protocol == "undefined")
            message.protocol = "client";

        //remove gitc command and execute actual command
        var args = message.argv.slice(1);
        message.extra.args = args;
        
        if (args[0] === "gitcdiff") {
            //TODO echo will only take one argument and ignore further ones?!
            return this.gitcdiff_command(user, message, client);
            //return true;
        }

        // git encourages newlines in commit messages; see also #678
        // so if a \n is detected, treat them properly as newlines
        if (args[1] == "commit" && args[2] == "-m") {
            if (args[3].indexOf("\\n") > -1) {
                args[3] = args[3].replace(/\\n/g,"\n");
            }
        }

        this.pm.spawn("shell", {
            command: args[0],
            args: args.slice(1),
            cwd: message.cwd,
            env: this.gitEnv,
            extra: message.extra
        }, this.channel, function(err, pid) {
            if (err)
                self.error(err, 1, message, client);
        });

        return true;
    };

    /**
     * Special command: this will create a new file with the not yet saved
     * file content. Thus we can execute git diff with the original file and
     * get the differences.
     */
    this.gitcdiff_command = function(user, message, client) {
        var args;
        //save tmp file to execute git diff
        Fs.writeFile("~tmp.txt", message.extra.new_file_content, function (err) {
            if (err) {
                console.log("error writing tmp diff file");
                self.error(err, 1, message, client);
                return false;
            }
        });
       
        //execute git diff
        var args = ["git", "diff", "--no-index"];
        var msg_args = message.extra.args.slice(1); //remove gitcdiff
        for (var i = 0; i < msg_args.length - 1; i++) { //append arguments
            args.push(msg_args[i]);
        }
        args.push("--"); //append files to be diffed
        args.push("~tmp.txt");
        args.push(msg_args[msg_args.length-1]);

        this.pm.spawn("shell", {
            command: args[0],
            args: args.slice(1),
            cwd: message.cwd,
            env: this.gitEnv,
            extra: message.extra
        }, this.channel, function(err, pid) {
            if (err)
                self.error(err, 1, message, client);
        });

        //remove tmp file
        args = ["rm", "~tmp.txt"];
        this.pm.spawn("shell", {
            command: args[0],
            args: args.slice(1),
            cwd: message.cwd,
            env: this.gitEnv,
            extra: {nobroadcast: true}
        }, this.channel, function(err, pid) {
            if (err)
                self.error(err, 1, message, client);
        });
        return true;
    };

    this.canShutdown = function() {
        return this.processCount === 0;
    };

}).call(GitcPlugin.prototype);
