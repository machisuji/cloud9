/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {
var Range = require("ace/range").Range;


module.exports = (function() {
    
    function GitEditorVis(gitccommands) {
        this.gitcCommands = gitccommands;
        this.currentEditor = undefined;
        this.changes = undefined;
        this.annotations = [];
    }

    GitEditorVis.prototype = {
        
        markGutterLine : function(annotation) {
            this.annotations.push(annotation);
            
            if (annotation.type == "gitc-added") {
                this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-added", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-added");
            } else if (annotation.type == "gitc-changed") {
                this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-changed", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-changed");
            } else if (annotation.type == "gitc-removed") {
                this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-removed", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-removed");
            };
            
            this.addTooltip(annotation);
            
        },
        
        createAnnotation : function(line, type, msg) {
          var annotation = {
            row: line,
            type: type,
            text: msg,
            tooltip: this.createTooltip(msg)
          };  
          
          return annotation;
        },
        
        createTooltip : function(msg) {
          var tooltip = document.createElement('div');
          tooltip.innerText = msg;
          tooltip.className = 'gitc-tooltip';
          
          return tooltip;
        },

    	onTabSwitch : function(e){
            var closed_file = e.currentTarget.$activepage? this.getFilePath(e.currentTarget.$activepage.id) : undefined;
            var opened_file = this.getFilePath(e.nextPage.id);
            this.currentEditor = e.nextPage.$editor.amlEditor.$editor;
            //document change
            //this.currentEditor.on("change", function(evt) {
                // instead of change there are also 
                // "changeMode", "tokenizerUpdate","changeTabSize", "changeWrapLimit", 
                //"changeWrapMode", "changeFold", "changeFrontMarker", "changeBackMarker", 
                //"changeBreakpoint", "changeAnnotation", "changeOverwrite", 
                //"changeScrollTop", "changeScrollLeft", "changeCursor", "changeSelection"

                //console.log(evt)};
            
            console.log("tab switch from: " + closed_file + " to: " + opened_file);

            //unstaged changes
            this.gitcCommands.send("diff " + opened_file, this.addUnstagedChanges.bind(this));
            //staged changes
            this.gitcCommands.send("diff --cached " + opened_file, this.addStagedChanges.bind(this));
            //maintain gutter tooltips
            this.currentEditor.renderer.scrollBar.addEventListener("scroll", this.onScroll.bind(this));
			this.markGutterLine(this.createAnnotation(40, "gitc-removed", "Blub"));
        },

        addUnstagedChanges : function(diff_output, stream, parser) {
            var changes = parser.parseDiff(diff_output, stream);
            console.log(changes);
            //TODO
        },

        addStagedChanges : function(diff_output, stream, parser) {
            var changes = parser.parseDiff(diff_output, stream);
            console.log(changes);
            //TODO
        },

        getFilePath : function(filePath) {
            if (typeof filePath === "undefined")
                filePath = tabEditors.getPage().$model.data.getAttribute("path");
            if (filePath.indexOf("/workspace/") === 0)
                filePath = filePath.substr(11);

            return filePath;
        },

		onScroll : function(e) {
            for (var i = 0; i < this.annotations.length; i++) {
    		    this.addTooltip(this.annotations[i]);
			}
		},
        
        addTooltip : function(annotation) {
            console.log(annotation);
            var gutterLayer = document.getElementById('q11').children[2].children[1];
            var renderer = this.currentEditor.renderer;
            var firstLineIndex = renderer.getFirstVisibleRow();
            var lastLineIndex = renderer.getLastVisibleRow();
            //console.log("lastLine: " + lastLineIndex);
            //console.log("firstLine: " + firstLineIndex);
            //console.log("annoLine: " + annotation.row);
            if (firstLineIndex <= annotation.row && lastLineIndex >= annotation.row) {
                var el = gutterLayer.children[annotation.row-firstLineIndex];
                el.appendChild(annotation.tooltip);
            }
        }

    };

    return GitEditorVis;
})();

});