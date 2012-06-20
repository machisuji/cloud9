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
        this.annotations = {};
    }

    GitEditorVis.prototype = {
        
        markGutterLine : function(annotation) {
			var session = this.currentEditor.getSession();
            
            if (annotation.type == "added") {
                //this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-added", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-added");
            } else if (annotation.type == "changed") {
                //this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-changed", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-changed");
            } else if (annotation.type == "deleted") {
                //this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-removed", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-removed");
            };
            
            this.addTooltip(annotation);
            
        },
        
        createAnnotation : function(line, type, msg) {
          var annotation = {
            row: line,
            type: type,
            text: msg,
            tooltip: this.createTooltip(msg, type, line)
          };
          
          return annotation;
        },
        
        createTooltip : function(msg, type, line) {
          if (type == "added")
		  	return;

		  var anno = this.annotations[(line-1).toString()];
		  
		  if (anno && anno.type == type) {
			anno.text += "\n" + msg;
			var p = document.createElement('p');
			p.innerText = msg;
			anno.tooltip.appendChild(p);
			return;
		  } else {
		  	var tooltip = document.createElement('div');
			var p = document.createElement('p');
			p.innerText = msg;
			tooltip.appendChild(p);
	        tooltip.className = 'gitc-tooltip';
			return tooltip;
		  }
        },
        
        clearMarkers : function() {
            var ids = this.currentEditor.getSession().getMarkers();
            for (var i = 0; i < ids.length; i++) {
                this.currentEditor.getSession().removeMarker(ids[i]);
            }
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

            this.clearMarkers();
            
            //unstaged changes
            this.gitcCommands.send("git diff " + opened_file, this.addUnstagedChanges.bind(this));
            //staged changes
            this.gitcCommands.send("git diff --cached " + opened_file, this.addStagedChanges.bind(this));
            //maintain gutter tooltips
            this.currentEditor.renderer.scrollBar.addEventListener("scroll", this.onScroll.bind(this));
        },
        
        markChanges : function(changes) {
			for (var k = 0; k < changes.length; k++) {
				var change = changes[k];
				for (var i = 0; i < change.chunks.length; i++) {
					var chunk = change.chunks[i];
					for (var j = 0; j < chunk.lines.length; j++) {
						var line = chunk.lines[j];
						var annotation = this.createAnnotation(line.number_new-1, line.status, line.content);
						var existingAnnotation = this.annotations[(line.number_new-1).toString()];
						if (existingAnnotation && existingAnnotation.type == "deleted" && annotation.type == "added") {
							annotation = this.createAnnotation(line.number_new-1, "changed", line.content)
						}
						this.annotations[annotation.row.toString()] = annotation;
					}
				}
			}
			for (var i in this.annotations) {
				this.markGutterLine(this.annotations[i]);
			}
        },
        
        markStagedChanges : function(changes) {
            this.markChanges(changes);
        },
        
        markUnstagedChanges : function(changes) {
            this.markChanges(changes);
        },

        addUnstagedChanges : function(diff_output, stream, parser) {
            var changes = parser.parseDiff(diff_output, stream);
            this.markUnstagedChanges(changes);
        },

        addStagedChanges : function(diff_output, stream, parser) {
            var changes = parser.parseDiff(diff_output, stream);
            this.markStagedChanges(changes);
        },

        getFilePath : function(filePath) {
            if (typeof filePath === "undefined")
                filePath = tabEditors.getPage().$model.data.getAttribute("path");
            if (filePath.indexOf("/workspace/") === 0)
                filePath = filePath.substr(11);

            return filePath;
        },

		onScroll : function(e) {
            for (var i in this.annotations) {
    		    this.addTooltip(this.annotations[i]);
			}
		},
        
        addTooltip : function(annotation) {
            if (!annotation.tooltip)
				return;

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