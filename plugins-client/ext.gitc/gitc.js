/**
 * Git Blame extension for the Cloud9 IDE client
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var ext     = require("core/ext");
var ide     = require("core/ide");
var menus = require("ext/menus/menus");
var editors = require("ext/editors/editors");
var BlameJS = require("ext/gitblame/blamejs");
var util    = require("core/util");

module.exports = ext.register("ext/gitc/gitc", {
    name     : "gitc",
    dev      : "wir",
    alone    : true,
    type     : ext.GENERAL,
    nodes    : [],

    init : function(amlNode){
        
    },

    hook : function(){
        var _self = this;
        
        menus.addItemByPath("Tools/gitc", new apf.item({
            // @TODO: Support more CVSs? Just "Blame this File"
            onclick : function(){
                alert("Hallo Extension!");
            }
        }), 500);
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