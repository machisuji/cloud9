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
        
		menus.addItemByPath("Tools/gitc", new apf.item({
            // @TODO: Support more CVSs? Just "Blame this File"
            onclick : function(){
				var editor = editors.currentEditor.amlEditor.$editor;
		        /*editor.on("document_change", function(e){
                    console.log("Blub");
		        });*/
                
                var Range = require("ace/range").Range;
                
                /*var diff = _self.gitcCommands.getChangesInFile("gitc.js");
                var adds = diff.added;
                var changes = diff.changed;*/
                
                _self.markLineAsRemoved(41);
                _self.markLineAsAdded(42);
                _self.markLineAsChanged(43);
                
                /*var annotations = {};
                var newAnnotation = {
                    row: 45,
                    text: "Removed XXX.",
                    type: "removed"
                };
                annotations[newAnnotation.row] = newAnnotation;
                _self.setAnnotations(annotations);*/
                
                _self.addTooltip(41, "Blub");
                
                
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

        tabEditors.addEventListener("beforeswitch", this.gitEditorVis.onTabSwitch.bind(this.gitEditorVis));

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
		editor.renderer.addGutterDecoration(line, "gitc-removed");
    },
    
    markLineAsAdded : function(line) {
		var editor = editors.currentEditor.amlEditor.$editor;
        editor.getSession().addMarker(new Range(line, 1, line, 10), "gitc-added", "background");
		editor.renderer.addGutterDecoration(line, "gitc-added");
    },
    
    markLineAsChanged : function(line) {
		var editor = editors.currentEditor.amlEditor.$editor;
        editor.getSession().addMarker(new Range(line, 1, line, 10), "gitc-changed", "background");
        editor.renderer.addGutterDecoration(line, "gitc-changed");
    },
    
    setAnnotations : function(annotations) {
        var el = document.getElementById('q11').children[2].children[1].firstChild;
        while (el.nextSibling) {
            var index = parseInt(el.innerHTML);
            if (annotations[index] != undefined) {
                var annotation = annotations[index];
                el.className += " gitc-" + annotation.type;
                el.title = annotation.text;
            }
            el = el.nextSibling;
        }
    },
    
    addTooltip : function(line, msg) {
        var gutterLayer = document.getElementById('q11').children[2].children[1];
        var renderer = editors.currentEditor.amlEditor.$editor.renderer;
        var firstLineIndex = renderer.getFirstVisibleRow();
        var lastLineIndex = renderer.getLastVisibleRow();
        if (firstLineIndex <= line && lastLineIndex >= line) {
            var el = gutterLayer.children[line-firstLineIndex];
            var tooltip = document.createElement('div');
            tooltip.className = "gitc-tooltip";
            tooltip.innerText = msg;
            el.appendChild(tooltip);
        }
    }

});
});
