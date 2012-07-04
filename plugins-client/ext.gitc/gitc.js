/**
 * Gitc extension for the Cloud9 IDE client
 *
 * @copyright 2012
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var ext     = require("core/ext");
var ide     = require("core/ide");
var menus = require("ext/menus/menus");
var editors = require("ext/editors/editors");
var util    = require("core/util");
var css = require("text!ext/gitc/gitc.css");
var Range = require("ace/range").Range;
var GitcCommands = require("ext/gitc/gitccommands");
var gitcTree = require("ext/gitc/tree");
var GitEditorVis = require("ext/gitc/gitceditorvis");

module.exports = ext.register("ext/gitc/gitc", {
    name     : "gitc",
    dev      : "Markus Kahl, Stephanie Platz, Patrick Schilf",
    alone    : true,
    type     : ext.GENERAL,
    nodes    : [],
    css      : css,

    init : function(amlNode){
        apf.importCssString((this.css || ""));
        this.gitcCommands = new GitcCommands();
        this.gitEditorVis = new GitEditorVis(this.gitcCommands);
    },

    hook : function(){
        this.init();
        var _self = this;

        ide.addEventListener("socketMessage", this.gitcCommands.onMessage.bind(this.gitcCommands));
        tabEditors.addEventListener("beforeswitch", this.gitEditorVis.onTabSwitch.bind(this.gitEditorVis));
        ide.addEventListener("afteropenfile", this.gitEditorVis.onOpenFile);


    },

    enable : function(){
        this.nodes.each(function(item){
            item.enable();
        });
    },

    disable : function(){
        this.nodes.each(function(item){
            item.disable();
        });
    },

    destroy : function(){
        menus.remove("Tools/gitc");
        
        this.nodes.each(function(item){
            item.destroy(true, true);
        });
        this.nodes = [];
    }
});
});
