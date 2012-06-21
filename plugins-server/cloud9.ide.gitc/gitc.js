"use strict";

var util = require("util");

var Plugin = require("../cloud9.core/plugin");
var c9util = require("../cloud9.core/util");

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

    this.init = function() {

        var self = this;
        this.eventbus.on(this.channel, function(msg) {
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

    this.command = function (user, message, client) {
        var self = this;
        var cmd = message.command ? message.command.toLowerCase() : "";

        if (cmd !== "gitc") {
            return false;
        }

        if (typeof message.protocol == "undefined")
            message.protocol = "client";

        // git encourages newlines in commit messages; see also #678
        // so if a \n is detected, treat them properly as newlines
        if (message.argv[1] == "commit" && message.argv[2] == "-m") {
            if (message.argv[3].indexOf("\\n") > -1) {
                message.argv[3] = message.argv[3].replace(/\\n/g,"\n");
            }
        }

        //remove gitc command and execute actual command
        var args = message.argv.slice(1);
        message.extra.args = args;

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

    this.canShutdown = function() {
        return this.processCount === 0;
    };

}).call(GitcPlugin.prototype);
