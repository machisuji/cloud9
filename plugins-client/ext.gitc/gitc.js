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
var GitcCommands = require("ext/gitc/gitccommands");


module.exports = ext.register("ext/gitc/gitc", {
    name     : "gitc",
    dev      : "wir",
    alone    : true,
    type     : ext.GENERAL,
    nodes    : [],

    init : function(amlNode){
        this.gitcCommands = new GitcCommands();
    },

    hook : function(){
        this.init();

        var _self = this;
        
        menus.addItemByPath("Tools/gitc", new apf.item({
            // @TODO: Support more CVSs? Just "Blame this File"
            onclick : function(){
                alert("Hallo Extension!");
            }
        }), 500);

        ide.addEventListener("socketMessage", this.gitcCommands.onMessage.bind(this.gitcCommands));
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