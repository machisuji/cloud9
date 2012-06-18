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


module.exports = ext.register("ext/gitc/gitc", {
    name     : "gitc",
    dev      : "wir",
    alone    : true,
    type     : ext.GENERAL,
    nodes    : [],
    css      : css,

    init : function(amlNode){
        apf.importCssString((this.css || ""));
        this.gitcCommands = new GitcCommands();
    },

    hook : function(){
        this.init();

        var _self = this;
        
        menus.addItemByPath("Tools/gitc", new apf.item({
            onclick : function(){

                _self.gitcCommands.send("diff", function(out, stream, pars) {
                    console.log(pars.parseDiff(out, stream));
                    console.log("");
                });
                
                var Range = require("ace/range").Range;
                var editor = editors.currentEditor.amlEditor.$editor;
                
                _self.markLineAsRemoved(38);
                _self.markLineAsAdded(39);
                _self.markLineAsChanged(40);
                
                var wordRange = new Range(38, 20, 38, 27);
                editor.getSession().addMarker(wordRange, "ace_active_line", "text");
                
                editor.getSession().setAnnotations([{
                  row: 38,
                  text: "bgRange",
                  type: "error"
                }]);
                
                var line = editor.getSession().getLine();
                //var ar = editor.getSession().getAWordRange(37, 39);
                
                
                
                
                //editor.getSession().on('change', function(e) { alert(e.data.text) });
                //var first = editor.getFirstVisibleRow();
                //var last = editor.getLastVisibleRow();
                
                
                //alert(theme);
            }
        }), 500);
        this.init();

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
    },
    
    markLineAsRemoved : function(line) {
		var editor = editors.currentEditor.amlEditor.$editor;
        editor.getSession().addMarker(new Range(line, 1, line, 10), "gitc-removed", "background");
    },
    
    markLineAsAdded : function(line) {
		var editor = editors.currentEditor.amlEditor.$editor;
        editor.getSession().addMarker(new Range(line, 1, line, 10), "gitc-added", "background");
    },
    
    markLineAsChanged : function(line) {
		var editor = editors.currentEditor.amlEditor.$editor;
        editor.getSession().addMarker(new Range(line, 1, line, 10), "gitc-changed", "background");
    }

});
});